'use client';

import { Play } from 'lucide-react';
import { useArcade } from './ArcadeProvider';
import ScoreBoard from './ScoreBoard';

/** Remounts after each game so new scores show. */
export default function Leaderboard() {
  const { scores, scoreState, openGame, isOpen } = useArcade();
  const allTime = scoreState === 'loading' ? undefined : scoreState === 'offline' ? null : scores;

  return (
    <ScoreBoard key={isOpen ? 'playing' : 'idle'} allTime={allTime}>
      <button type="button" className="btn-arcade btn-arcade-sm" onClick={openGame}>
        <Play className="size-4 fill-current" aria-hidden="true" />
        Take your shot
      </button>
    </ScoreBoard>
  );
}
