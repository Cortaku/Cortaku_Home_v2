// The leaderboard is a Supabase table the browser calls directly.
// Its rules are enforced by the database: see supabase/migrations.
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

export type SubmitResult = 'saved' | 'rate-limited' | 'failed';

export async function submitScore(playerName: string, score: number, daily?: string): Promise<SubmitResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ player_name: playerName, score, challenge_date: daily ?? null }),
    });
    if (res.ok) return 'saved';
    const error = (await res.json().catch(() => null)) as { message?: string } | null;
    return error?.message?.startsWith('Rate limit') ? 'rate-limited' : 'failed';
  } catch {
    return 'failed';
  }
}
