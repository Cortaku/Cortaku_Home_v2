'use client';

import { useEffect, useRef, useState } from 'react';
import type { Point } from './ArcadeProvider';
import { reducedMotion } from '@/lib/motion';
import { unlockSecret } from '@/game/profile';

/** Size of one frame of public/sprites/rabbit.png: frame 0 crouched, frame 1 mid-hop. */
const ART_W = 23;
const ART_H = 14;

const LEAP_MS = 750;
const LAND_MS = 140;
const HOP_MS = 380;
const CROUCH_MS = 110;
/** How long the rabbit sits after being caught before it vanishes. */
const CAUGHT_MS = 2600;

/**
 * The moon rabbit: leaps out of the lantern, lands on the hero's road and hops off the left edge.
 * Catch it (click or tap) to unlock the Tsuki skin.
 */
export default function MoonRabbit({ from, onDone }: { from: Point; onDone: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const caughtRef = useRef(false);
  /** Starts the countdown to vanishing; set by the effect, which owns the timers. */
  const finishRef = useRef<() => void>(() => {});
  const [caught, setCaught] = useState<'new' | 'again' | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = window.innerHeight < 640 ? 2 : 3;
    const w = ART_W * s;
    const h = ART_H * s;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    // Land on the road when it is on screen, otherwise along the bottom of the window.
    const road = document.querySelector('.scene-ground')?.getBoundingClientRect();
    const floor = road && road.top > 80 && road.top < window.innerHeight ? road.top + s : window.innerHeight - 4;
    const x0 = from.x - w / 2;
    const y0 = from.y - h / 2;
    const x1 = x0 - 90;
    const y1 = floor - h;
    const hopW = 30 * s;
    const hopH = 9 * s;
    let x = x1;

    const place = (px: number, py: number, airborne: boolean) => {
      el.style.transform = `translate(${px}px, ${py}px)`;
      el.style.backgroundPosition = airborne ? '100% 0' : '0 0';
    };

    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    finishRef.current = () => {
      clearTimeout(timer);
      timer = setTimeout(onDone, CAUGHT_MS);
    };

    if (reducedMotion()) {
      place(x1, y1, false);
      timer = setTimeout(() => { if (!caughtRef.current) onDone(); }, 4000);
    } else {
      const start = performance.now();
      const step = (now: number) => {
        // Caught: sit still where it was, on the ground.
        if (caughtRef.current) return place(x, y1, false);
        const t = now - start;
        if (t < LEAP_MS) {
          const u = t / LEAP_MS;
          place(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u * u - 40 * Math.sin(Math.PI * u), true);
        } else if (t < LEAP_MS + LAND_MS) {
          place(x1, y1, false);
        } else {
          const k = t - LEAP_MS - LAND_MS;
          x = x1 - Math.floor(k / HOP_MS) * hopW;
          if (x + w < 0) return onDone();
          const u = k % HOP_MS;
          if (u < CROUCH_MS) {
            place(x, y1, false);
          } else {
            const v = (u - CROUCH_MS) / (HOP_MS - CROUCH_MS);
            place(x - hopW * v, y1 - hopH * Math.sin(Math.PI * v), true);
          }
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [from, onDone]);

  const catchIt = () => {
    if (caughtRef.current) return;
    caughtRef.current = true;
    setCaught(unlockSecret('tsuki') ? 'new' : 'again');
    finishRef.current();
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`moon-rabbit${caught ? ' is-caught' : ''}`}
      aria-label="Catch the moon rabbit"
      onPointerDown={catchIt}
      onClick={catchIt}
    >
      {caught && (
        <span className="moon-rabbit-bubble" role="status">
          {caught === 'new' ? 'You caught the moon rabbit! Tsuki skin unlocked.' : 'Caught again! Tsuki is already yours.'}
        </span>
      )}
    </button>
  );
}
