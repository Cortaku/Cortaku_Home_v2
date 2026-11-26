'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import type { Point } from './ArcadeProvider';
import { reducedMotion } from '@/lib/motion';
import { themeChosen } from '@/lib/theme';

/** Lying down the lantern is 62 x 28 px; upright, its body's centre sits 11 px above the whole thing's. */
const HALF_W = 31;
const BODY_ABOVE_CENTRE = 11;
const ROLL = 16;

/** The theme lantern after its cord snaps: it falls onto the hero's road and stays there, still a switch. */
export default function FallenLantern({ from }: { from: Point }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  // Fall from where it hung, bounce, and tip over onto its side. Off screen it is simply already there.
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const rest = el.getBoundingClientRect();
    if (rest.bottom < 0 || rest.top > window.innerHeight) return;
    const dx = from.x - (rest.left + rest.width / 2);
    const dy = from.y + BODY_ABOVE_CENTRE - (rest.top + rest.height / 2);
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) rotate(-90deg)`, easing: 'cubic-bezier(0.5, 0, 1, 1)' },
        { transform: 'translate(-8px, 0) rotate(-35deg)', offset: 0.55, easing: 'cubic-bezier(0, 0, 0.5, 1)' },
        { transform: 'translate(-4px, -16px) rotate(-12deg)', offset: 0.7, easing: 'cubic-bezier(0.5, 0, 1, 1)' },
        { transform: 'translate(-1px, 0) rotate(0deg)', offset: 0.84, easing: 'ease-out' },
        { transform: 'translate(0, -3px) rotate(2deg)', offset: 0.92 },
        { transform: 'translate(0, 0) rotate(0deg)' },
      ],
      { duration: 1200 },
    );
  }, [from]);

  const toggle = () => {
    themeChosen();
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    if (!reducedMotion()) {
      ref.current?.animate(
        [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' }],
        { duration: 400, easing: 'ease-out' },
      );
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className="fallen-lantern"
      style={{ left: `${((from.x - HALF_W - ROLL) / window.innerWidth) * 100}%` }}
      aria-label="Switch between day and night"
      onClick={toggle}
    >
      <span className="fallen-lantern-inner" aria-hidden="true">
        <span className="lantern-cord" />
        <span className="lantern-body" />
        <span className="lantern-string" />
        <span className="lantern-tassel" />
      </span>
    </button>
  );
}
