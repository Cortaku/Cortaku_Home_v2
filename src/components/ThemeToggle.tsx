'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import { useArcade, type Point } from './ArcadeProvider';
import MoonRabbit from './MoonRabbit';
import { reducedMotion } from '@/lib/motion';
import { themeChosen } from '@/lib/theme';

const RABBIT_AT = 5;
const SNAP_AT = 10;
/** How far the tassel stretches, and how far it must be pulled to count. */
const PULL_MAX = 26;
const PULL_TO_SWITCH = 14;

/**
 * A paper lantern on a pull cord: pull it (click, tap or drag the tassel) to switch day and night.
 * The fifth pull lets the moon rabbit out; the tenth snaps the cord and drops the lantern in the hero.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { fallenLantern, dropLantern } = useArcade();
  const rigRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const pulls = useRef(0);
  const drag = useRef<{ startY: number; pull: number } | null>(null);
  const dragged = useRef(false);
  const [rabbit, setRabbit] = useState<(Point & { id: number }) | null>(null);
  const snapped = fallenLantern !== null;

  const setPull = (px: number) => rigRef.current?.style.setProperty('--pull', `${px}px`);

  const swing = () => {
    if (reducedMotion()) return;
    rigRef.current?.animate(
      [
        { transform: 'translateY(0) rotate(0)' },
        { transform: 'translateY(5px) rotate(0)', offset: 0.12 },
        { transform: 'translateY(-2px) rotate(7deg)', offset: 0.32 },
        { transform: 'translateY(0) rotate(-5deg)', offset: 0.52 },
        { transform: 'rotate(3deg)', offset: 0.72 },
        { transform: 'rotate(-1deg)', offset: 0.88 },
        { transform: 'translateY(0) rotate(0)' },
      ],
      { duration: 1100, easing: 'ease-out' },
    );
  };

  const toggle = () => {
    themeChosen();
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    if (snapped) {
      rigRef.current?.animate([{ transform: 'scaleY(0.6)' }, { transform: 'scaleY(1)' }], { duration: 250, easing: 'ease-out' });
      return;
    }
    pulls.current += 1;
    const body = bodyRef.current?.getBoundingClientRect();
    if (!body) return;
    const centre = { x: body.left + body.width / 2, y: body.top + body.height / 2 };
    if (pulls.current === SNAP_AT) {
      dropLantern(centre);
      return;
    }
    swing();
    if (pulls.current === RABBIT_AT) setRabbit({ ...centre, id: Date.now() });
  };

  const endDrag = (pulled: boolean) => {
    const d = drag.current;
    drag.current = null;
    delete rigRef.current?.dataset.dragging;
    setPull(0);
    if (pulled && d && dragged.current && d.pull >= PULL_TO_SWITCH) toggle();
  };

  return (
    <>
      <button
        type="button"
        className={`lantern${snapped ? ' is-snapped' : ''}`}
        aria-label="Switch between day and night"
        onPointerDown={(e) => {
          dragged.current = false;
          if (snapped) return;
          drag.current = { startY: e.clientY, pull: 0 };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          d.pull = Math.max(0, Math.min(PULL_MAX, e.clientY - d.startY));
          if (d.pull > 3 && !dragged.current) {
            dragged.current = true;
            if (rigRef.current) rigRef.current.dataset.dragging = '';
          }
          setPull(d.pull);
        }}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onClick={() => {
          // A drag already did its work (or chose not to) on release.
          if (dragged.current) dragged.current = false;
          else toggle();
        }}
      >
        <span ref={rigRef} className="lantern-rig" aria-hidden="true">
          <span className="lantern-cord" />
          {!snapped && (
            <>
              <span ref={bodyRef} className="lantern-body" />
              <span className="lantern-string" />
              <span className="lantern-tassel" />
            </>
          )}
        </span>
      </button>
      {rabbit && createPortal(<MoonRabbit key={rabbit.id} from={rabbit} onDone={() => setRabbit(null)} />, document.body)}
    </>
  );
}
