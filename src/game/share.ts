// The result a player can share after a run: one blossom per zone cleared, then the crash.
import { SITE_URL } from '../lib/site';

/** Daily run #1 was this UTC date. */
const FIRST_DAILY = Date.UTC(2026, 10, 24);
const MAX_BLOSSOMS = 10;

export type SharedRun = { mode: 'endless' | 'daily'; date: string; score: number; zone: number };

export function dailyNumber(date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - FIRST_DAILY) / 86_400_000) + 1;
}

export function shareText({ mode, date, score, zone }: SharedRun): string {
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const title = mode === 'daily' ? `Cortaku Daily #${dailyNumber(date)} · ${day}` : 'Cortaku Endless';
  const blossoms = '🌸'.repeat(Math.min(zone, MAX_BLOSSOMS)) + (zone > MAX_BLOSSOMS ? `+${zone - MAX_BLOSSOMS}` : '');
  return `${title}\n${blossoms}💥 ${score.toLocaleString('en-US')}\n${SITE_URL.replace(/^https?:\/\/(www\.)?/, '')}`;
}

/** The share sheet on phones, the clipboard elsewhere. */
export async function shareRun(run: SharedRun): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = shareText(run);
  if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (error) {
      // The player closed the sheet: leave their clipboard alone. Otherwise (not allowed here) copy instead.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
