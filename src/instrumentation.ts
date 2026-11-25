// Supabase pauses idle free projects, so the server reads the leaderboard twice a day to keep it awake.
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { fetchScores } = await import('@/lib/scores');
  const ping = () => { void fetchScores(); };
  ping();
  setInterval(ping, HALF_DAY_MS).unref();
}
