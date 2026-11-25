'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { DEFAULT_SCENE, SCENE_COUNT } from '@/lib/site';
import { fetchScores, type Score } from '@/lib/scores';

const JumpGame = dynamic(() => import('./JumpGame'), { ssr: false });

type ScoreState = 'loading' | 'ready' | 'offline';

type Arcade = {
  isOpen: boolean;
  openGame: () => void;
  scores: Score[];
  scoreState: ScoreState;
  scene: number;
  nextScene: () => void;
  party: () => void;
};

const ArcadeContext = createContext<Arcade | null>(null);

export function useArcade(): Arcade {
  const ctx = useContext(ArcadeContext);
  if (!ctx) throw new Error('useArcade must be used inside <ArcadeProvider>');
  return ctx;
}

type Confetti = { left: number; top: number; size: number; duration: number; delay: number };

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName);
}

export default function ArcadeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [scores, setScores] = useState<Score[]>([]);
  const [scoreState, setScoreState] = useState<ScoreState>('loading');
  const [scene, setScene] = useState(DEFAULT_SCENE);
  const [confetti, setConfetti] = useState<Confetti[] | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const partyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadScores = useCallback(() => {
    fetchScores().then((data) => {
      if (data) setScores(data);
      setScoreState(data ? 'ready' : 'offline');
    });
  }, []);

  useEffect(loadScores, [loadScores]);

  const setOpen = useCallback((next: boolean) => {
    const apply = () => flushSync(() => setIsOpen(next));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && 'startViewTransition' in document) {
      // An interrupted morph rejects; ignore it.
      const transition = document.startViewTransition(apply);
      transition.ready.catch(() => {});
      transition.finished.catch(() => {});
    } else {
      apply();
    }
  }, []);

  const openGame = useCallback(() => setOpen(true), [setOpen]);
  const closeGame = useCallback(() => {
    setOpen(false);
    loadScores();
  }, [setOpen, loadScores]);

  const nextScene = useCallback(() => setScene((s) => (s % SCENE_COUNT) + 1), []);

  const party = useCallback(() => {
    setConfetti(
      Array.from({ length: 24 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 30 + 20,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * -5,
      })),
    );
    audioRef.current?.play().catch(() => {});
    if (partyTimer.current) clearTimeout(partyTimer.current);
    partyTimer.current = setTimeout(() => setConfetti(null), 3200);
  }, []);

  // Pauses the page's animations behind the game.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-arcade-open', isOpen);
  }, [isOpen]);

  // Space starts the game; the Konami code throws a party.
  useEffect(() => {
    let progress = 0;
    const onKey = (e: KeyboardEvent) => {
      if (isOpen) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      progress = key === KONAMI[progress] ? progress + 1 : key === KONAMI[0] ? 1 : 0;
      if (progress === KONAMI.length) {
        progress = 0;
        party();
        return;
      }
      if (e.code === 'Space' && !e.repeat && !isTyping(e.target) && window.scrollY < 80) {
        e.preventDefault();
        openGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, openGame, party]);

  const value = useMemo(
    () => ({ isOpen, openGame, scores, scoreState, scene, nextScene, party }),
    [isOpen, openGame, scores, scoreState, scene, nextScene, party],
  );

  return (
    <ArcadeContext.Provider value={value}>
      {children}

      {isOpen && (
        <div className="arcade-overlay" role="dialog" aria-modal="true" aria-label="Cortaku jump game">
          <JumpGame onExit={closeGame} gameTheme={resolvedTheme === 'dark' ? 'night' : 'day'} backgroundSet={scene} />
        </div>
      )}

      {confetti && (
        <div className="party" aria-hidden="true">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="animate-float"
              style={{
                left: `${c.left}%`,
                top: `${c.top}%`,
                fontSize: c.size,
                animationDuration: `${c.duration}s`,
                animationDelay: `${c.delay}s`,
              }}
            >
              🌈
            </span>
          ))}
        </div>
      )}
      <audio ref={audioRef} src="/sounds/grunt_party.mp3" preload="none" />
    </ArcadeContext.Provider>
  );
}
