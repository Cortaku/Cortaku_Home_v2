// The Cloudflare Worker in front of the static site. It serves the built pages,
// answers /api/status, and keeps the leaderboard's Supabase project awake.
import { APPS, SUPABASE_KEY, SUPABASE_URL } from '../src/lib/site';

type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };
type Context = { waitUntil(promise: Promise<unknown>): void };

const STATUS_TTL_SECONDS = 60;
const TIMEOUT_MS = 4_000;

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

const worker = {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    if (new URL(request.url).pathname === '/api/status') return status(request, ctx);
    return env.ASSETS.fetch(request);
  },

  // Supabase pauses idle free projects; a read twice a day (see wrangler.jsonc) keeps it active.
  async scheduled(): Promise<void> {
    await fetch(`${SUPABASE_URL}/rest/v1/cortaku_high_scores?select=id&limit=1`, { headers: { apikey: SUPABASE_KEY } });
  },
};

export default worker;
