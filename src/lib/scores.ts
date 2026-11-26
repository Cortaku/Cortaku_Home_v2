// The leaderboard is a Supabase table. The browser reads it directly; scores are posted through the
// Worker, which replays each run before saving it (worker/index.ts, supabase/migrations).
import { SUPABASE_KEY, SUPABASE_URL } from './site';

export type Score = { id: number; player_name: string; score: number };

const ENDPOINT = `${SUPABASE_URL}/rest/v1/cortaku_high_scores`;
const HEADERS = { apikey: SUPABASE_KEY };

/** Top ten: all-time by default, or one day's run when `daily` (YYYY-MM-DD) is given. Null if unreachable. */
export async function fetchScores(daily?: string): Promise<Score[] | null> {
  const query = new URLSearchParams({
    select: 'id,player_name,score',
    challenge_date: daily ? `eq.${daily}` : 'is.null',
    order: 'score.desc,id.asc',
    limit: '10',
  });
  try {
    const res = await fetch(`${ENDPOINT}?${query}`, { headers: HEADERS, cache: 'no-store' });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as Score[]) : [];
  } catch {
    return null;
  }
}

/** A signed ticket for one run: the endless seed, and proof of when the run could have started. */
export type RunTicket = { token: string; seed: number };

export async function requestRun(): Promise<RunTicket | null> {
  try {
    const res = await fetch('/api/run', { method: 'POST' });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<RunTicket>;
    return typeof data.token === 'string' && typeof data.seed === 'number' ? { token: data.token, seed: data.seed } : null;
  } catch {
    return null;
  }
}

export type SubmitResult = 'saved' | 'rate-limited' | 'duplicate' | 'expired' | 'invalid' | 'failed';

export async function submitScore(
  run: { ticket: RunTicket; inputs: number[] },
  playerName: string,
  score: number,
  daily?: string,
): Promise<SubmitResult> {
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: run.ticket.token, inputs: run.inputs, name: playerName, score, date: daily ?? null }),
    });
    if (res.ok) return 'saved';
    const { error } = ((await res.json().catch(() => ({}))) as { error?: string });
    return error === 'rate-limited' || error === 'duplicate' || error === 'expired' || error === 'invalid' ? error : 'failed';
  } catch {
    return 'failed';
  }
}
