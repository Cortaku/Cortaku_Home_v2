'use client';

import { useEffect, useState } from 'react';
import { fetchScores, type Score } from '@/lib/scores';
import { todayKey } from '@/game/profile';

type Tab = 'all' | 'daily';
/** undefined = still loading, null = API unreachable. */
type Result = Score[] | null | undefined;

const MEDALS = ['🥇', '🥈', '🥉'];

type Props = {
  initialTab?: Tab;
  /** Pass all-time scores if already loaded; otherwise the board fetches them. */
  allTime?: Result;
  children?: React.ReactNode;
};

/** All-time and today's daily scores, on two tabs. */
export default function ScoreBoard({ initialTab = 'all', allTime, children }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [today] = useState(todayKey);
  const [fetched, setFetched] = useState<Partial<Record<Tab, Score[] | null>>>({});

  const provided = tab === 'all' && allTime !== undefined;
  const result: Result = provided ? allTime : fetched[tab];

  useEffect(() => {
    if (provided || fetched[tab] !== undefined) return;
    let cancelled = false;
    fetchScores(tab === 'daily' ? today : undefined).then((scores) => {
      if (!cancelled) setFetched((prev) => ({ ...prev, [tab]: scores }));
    });
    return () => { cancelled = true; };
  }, [tab, today, provided, fetched]);

  return (
    <div className="board">
      <div className="board-tabs" role="tablist" aria-label="Leaderboard">
        <button type="button" role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>All-time</button>
        <button type="button" role="tab" aria-selected={tab === 'daily'} onClick={() => setTab('daily')}>Today&rsquo;s daily</button>
      </div>

      <div className="board-head">
        <span>Rank</span>
        <span>Player</span>
        <span>Score</span>
      </div>

      {result === undefined && <p className="board-note">Loading scores…</p>}
      {result === null && <p className="board-note">The scoreboard is offline right now. The game still works.</p>}
      {result && result.length === 0 && (
        <p className="board-note">{tab === 'daily' ? 'Nobody has posted a daily run yet today.' : 'No scores yet. Be the first.'}</p>
      )}
      {result && result.length > 0 && (
        <ol className="board-list">
          {result.map((entry, i) => (
            <li key={entry.id} className={i === 0 ? 'is-first' : undefined}>
              <span className="board-rank">{MEDALS[i] ?? String(i + 1).padStart(2, '0')}</span>
              <span className="board-name">{entry.player_name}</span>
              <span className="board-score">{entry.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}

      {children}
    </div>
  );
}
