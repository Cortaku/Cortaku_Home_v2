'use client';

import { useEffect, useRef, useState } from 'react';
import { loadSkinSheet } from '@/game/skins';
import { useProfile } from '@/game/profile';

const FRAMES = 7;
const COLUMNS = 5;
const FRAME_MS = 120;
const IDLE_MS = 7000;

const LINES = [
  'psst… press space',
  'bet you can’t beat the top score',
  'i run so you don’t have to',
  'click me. i jump.',
];

/** The game's robot on the homepage. Click it and it hops. */
export default function Mascot({ paused }: { paused: boolean }) {
  const spriteRef = useRef<HTMLSpanElement>(null);
  const [hopping, setHopping] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const { skin } = useProfile();
  const [sheet, setSheet] = useState<{ skin: string; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSkinSheet(skin)
      .then((loaded) => { if (!cancelled) setSheet({ skin, url: loaded.url }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [skin]);

  // Step the sprite sheet without re-rendering.
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const id = setInterval(() => {
      frame = (frame + 1) % FRAMES;
      const el = spriteRef.current;
      if (el) el.style.backgroundPosition = `${(frame % COLUMNS) * 25}% ${Math.floor(frame / COLUMNS) * 100}%`;
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [paused]);

  // Speak up when the visitor goes idle.
  useEffect(() => {
    if (paused) return;
    let next = 0;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      setLine(null);
      timer = setTimeout(() => {
        setLine(LINES[next % LINES.length]);
        next += 1;
      }, IDLE_MS);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [paused]);

  return (
    <button
      type="button"
      className={`mascot${hopping ? ' is-hopping' : ''}`}
      aria-label="Make the robot jump"
      onClick={() => setHopping(true)}
      onAnimationEnd={() => setHopping(false)}
    >
      {line && <span className="mascot-bubble">{line}</span>}
      <span
        ref={spriteRef}
        className="mascot-sprite"
        style={sheet?.skin === skin ? { backgroundImage: `url(${sheet.url})` } : undefined}
      />
    </button>
  );
}
