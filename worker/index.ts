// The Cloudflare Worker in front of the static site. It serves the built pages, answers /api/status,
// verifies and posts leaderboard scores, and keeps the leaderboard's Supabase project awake.
import { APPS, SUPABASE_KEY, SUPABASE_URL } from '../src/lib/site';
import { dailySeed, replayRun } from '../src/game/replay';

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Signs run tickets and authorises score posts with the database. Set with `wrangler secret put RUN_SECRET`. */
  RUN_SECRET?: string;
};
type Context = { waitUntil(promise: Promise<unknown>): void };

const STATUS_TTL_SECONDS = 60;
const TIMEOUT_MS = 4_000;
/** How long a run ticket stays good. */
const TICKET_MS = 12 * 60 * 60 * 1000;
/** Slack for the "no faster than it took to play" check. */
const CLOCK_SLACK_MS = 3_000;
const MAX_BODY_BYTES = 512 * 1024;
/** A daily run with at least this many inputs (about five jumps) is keyed on the run itself; see postScore. */
const DAILY_KEY_MIN_INPUTS = 10;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// ---------- App status ----------

async function isUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    // A redirect or a 401 still means the app is up.
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Up/down state of every app, cached at the edge so visitors don't each trigger six checks. */
async function status(request: Request, ctx: Context): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL('/api/status', request.url));
  const hit = await cache.match(key);
  if (hit) return hit;

  const results = await Promise.all(APPS.map(async (app) => [app.id, await isUp(app.url)] as const));
  const response = Response.json(Object.fromEntries(results), {
    headers: { 'Cache-Control': `public, max-age=${STATUS_TTL_SECONDS}` },
  });
  ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

// ---------- Run tickets ----------
// A ticket is `id.seed.issuedAt.signature`. The id makes each endless run postable once, the seed is the endless
// course, and issuedAt lets the Worker refuse a score that arrives faster than the run could be played.

const encoder = new TextEncoder();

function hmacKey(secret: string, use: 'sign' | 'verify') {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [use]);
}

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function issueRun(secret: string): Promise<Response> {
  const id = crypto.randomUUID();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const body = `${id}.${seed}.${Date.now()}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), encoder.encode(body));
  return json({ token: `${body}.${toBase64Url(signature)}`, seed });
}

type Ticket = { id: string; seed: number; issued: number };

async function readTicket(secret: string, token: string): Promise<Ticket | null> {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [id, seed, issued, signature] = parts;
  const bytes = fromBase64Url(signature);
  if (!bytes) return null;
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), bytes, encoder.encode(`${id}.${seed}.${issued}`));
  return valid ? { id, seed: Number(seed), issued: Number(issued) } : null;
}

// ---------- Scores ----------

type Submission = { token: string; name: string; score: number; date: string | null; inputs: number[] };

function parseSubmission(body: unknown): Submission | null {
  const b = body as Partial<Submission> | null;
  if (!b || typeof b.token !== 'string' || typeof b.name !== 'string' || !Number.isInteger(b.score) || !Array.isArray(b.inputs)) return null;
  const name = b.name.trim();
  if (name.length < 1 || name.length > 15) return null;
  const date = b.date ?? null;
  if (date !== null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))) return null;
  return { token: b.token, name, score: b.score!, date, inputs: b.inputs };
}

const TOO_LARGE = Symbol('too large');

/**
 * The body as JSON (null if it isn't), counting bytes as they arrive: a chunked request has no
 * Content-Length, so the header alone can't hold it to MAX_BODY_BYTES.
 */
async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return TOO_LARGE;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return TOO_LARGE;
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** SHA-256 of a list of inputs, base64url. */
async function digest(inputs: readonly number[]): Promise<string> {
  return toBase64Url(await crypto.subtle.digest('SHA-256', encoder.encode(inputs.join(','))));
}

/** Replays the run; posts the replayed score only if it matches and the run took as long as it claims. */
async function postScore(request: Request, secret: string): Promise<Response> {
  const body = await readJson(request);
  if (body === TOO_LARGE) return json({ error: 'invalid' }, 413);
  const submission = parseSubmission(body);
  if (!submission) return json({ error: 'invalid' }, 400);

  const ticket = await readTicket(secret, submission.token);
  if (!ticket) return json({ error: 'invalid' }, 400);
  const age = Date.now() - ticket.issued;
  if (age > TICKET_MS) return json({ error: 'expired' }, 400);

  const run = replayRun(submission.date ? dailySeed(submission.date) : ticket.seed, submission.inputs);
  if (!run || Math.abs(run.score - submission.score) > 1) return json({ error: 'invalid' }, 400);
  if (age < run.seconds * 1000 - CLOCK_SLACK_MS) return json({ error: 'invalid' }, 400);

  // Each row's run_id is unique. An endless run is its ticket. A daily course is the same for everyone and
  // doesn't depend on the ticket, so there the run itself is the key: the same run can't go up twice under
  // fresh tickets. Very short runs (no jumps, say) stay on the ticket: two players can easily play the same
  // one, and it isn't worth copying.
  const byRun = submission.date !== null && run.played.length >= DAILY_KEY_MIN_INPUTS;
  const runId = byRun ? `daily:${submission.date}:${await digest(run.played)}` : ticket.id;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cortaku_post_score`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_key: secret,
      p_name: submission.name,
      p_score: run.score,
      p_date: submission.date,
      p_run_id: runId,
      p_ip: request.headers.get('CF-Connecting-IP'),
    }),
  });
  if (res.ok) return json({ ok: true, score: run.score });

  const error = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  if (error?.message?.startsWith('Rate limit')) return json({ error: 'rate-limited' }, 429);
  if (error?.code === '23505') return json({ error: 'duplicate' }, 409);
  if (error?.message?.startsWith('Daily run is closed')) return json({ error: 'expired' }, 400);
  return json({ error: 'failed' }, 502);
}

// ---------- Entry points ----------

const worker = {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/status') return status(request, ctx);
    if (pathname === '/api/run' || pathname === '/api/score') {
      if (request.method !== 'POST') return json({ error: 'method' }, 405);
      if (!env.RUN_SECRET) return json({ error: 'unavailable' }, 503);
      return pathname === '/api/run' ? issueRun(env.RUN_SECRET) : postScore(request, env.RUN_SECRET);
    }
    return env.ASSETS.fetch(request);
  },

  // Supabase pauses idle free projects; a read twice a day (see wrangler.jsonc) keeps it active.
  async scheduled(): Promise<void> {
    await fetch(`${SUPABASE_URL}/rest/v1/cortaku_high_scores?select=id&limit=1`, { headers: { apikey: SUPABASE_KEY } });
  },
};

export default worker;
