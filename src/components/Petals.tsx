'use client';

import { useEffect, useRef } from 'react';

type Petal = {
  x: number; y: number; vx: number; vy: number;
  unit: number; phase: number; flutter: number; color: string;
  /** -1 drifts forever; burst petals count down and fade. */
  life: number;
};

type Range = [number, number];

/** How one season's particles look and move. Shapes are pixel offsets; a particle flips between the two. */
type Season = {
  colors: string[];
  shapes: [[number, number][], [number, number][]];
  unit: Range;
  vx: Range;
  vy: Range;
  /** Side-to-side sway, px/s. */
  sway: number;
  /** Fireflies wander and glow instead of falling. */
  glow?: boolean;
};

const SEASONS: Record<'spring' | 'summer' | 'autumn' | 'winter', Season> = {
  spring: {
    colors: ['#ffc2d6', '#ff9fc0', '#ffe0ea', '#ffffff', '#f7b4d0'],
    shapes: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[1, 0], [0, 1], [1, 1]]],
    unit: [2, 4], vx: [10, 30], vy: [26, 60], sway: 18,
  },
  summer: {
    colors: ['#eaff8a', '#fff39a', '#d8ff6a'],
    shapes: [[[0, 0]], [[0, 0]]],
    unit: [2, 3], vx: [-14, 14], vy: [-10, 10], sway: 12, glow: true,
  },
  autumn: {
    colors: ['#d8455a', '#e8553f', '#f08a3c', '#f2b33d', '#b83a2e'],
    shapes: [[[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]]],
    unit: [2, 3], vx: [10, 40], vy: [34, 70], sway: 34,
  },
  winter: {
    colors: ['#ffffff', '#eef3ff', '#dfe8ff'],
    shapes: [[[0, 0]], [[0, 0]]],
    unit: [2, 4], vx: [-6, 12], vy: [18, 40], sway: 10,
  },
};

/** Northern-hemisphere seasons by the visitor's month; `?season=autumn` (etc.) overrides it. */
function currentSeason(): Season {
  const asked = new URLSearchParams(window.location.search).get('season');
  if (asked && asked in SEASONS) return SEASONS[asked as keyof typeof SEASONS];
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return SEASONS.spring;
  if (month >= 5 && month <= 7) return SEASONS.summer;
  if (month >= 8 && month <= 10) return SEASONS.autumn;
  return SEASONS.winter;
}

const between = ([a, b]: Range) => a + Math.random() * (b - a);

/** The season's particles (sakura, fireflies, maple leaves or snow) on a breeze that follows the pointer; a click throws a burst. */
export default function Petals({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const season = currentSeason();

    let w = 0;
    let h = 0;
    let petals: Petal[] = [];
    let wind = 0;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    const pointer = { x: -999, y: -999, lastX: 0 };

    const spawn = (anywhere: boolean): Petal => ({
      x: Math.random() * w,
      y: anywhere || season.glow ? Math.random() * h : -12,
      vx: between(season.vx),
      vy: between(season.vy),
      unit: Math.round(between(season.unit)),
      phase: Math.random() * Math.PI * 2,
      flutter: 2 + Math.random() * 3,
      color: season.colors[Math.floor(Math.random() * season.colors.length)],
      life: -1,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.max(18, Math.min(64, Math.round((w * h) / 24000)));
      petals = petals.filter((p) => p.life < 0).slice(0, target);
      while (petals.length < target) petals.push(spawn(true));
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || pausedRef.current || document.hidden) return;

      wind *= 0.97;
      ctx.clearRect(0, 0, w, h);

      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.phase += p.flutter * dt;

        // Nudge petals away from the pointer.
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < 8100 && dist2 > 1) {
          const push = (1 - dist2 / 8100) * 260 * dt;
          const dist = Math.sqrt(dist2);
          p.x += (dx / dist) * push;
          p.y += (dy / dist) * push;
        }

        p.x += (p.vx + wind + Math.sin(p.phase) * season.sway) * dt;
        p.y += p.vy * dt;

        if (p.life >= 0) {
          p.vy += 220 * dt;
          p.life -= dt;
          if (p.life <= 0) { petals.splice(i, 1); continue; }
        } else if (p.y > h + 12 || p.y < -24 || p.x > w + 24 || p.x < -24) {
          petals[i] = spawn(false);
          if (p.x > w + 24) petals[i].x = -12;
          continue;
        }

        // Fireflies pulse; everything else is steady.
        const base = season.glow ? 0.35 + 0.65 * Math.max(0, Math.sin(p.phase * 0.7)) : 0.9;
        ctx.globalAlpha = p.life >= 0 ? Math.min(1, p.life * 2) : base;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = season.glow ? 8 : 0;
        const shape = season.shapes[Math.sin(p.phase) > 0 ? 0 : 1];
        const px = Math.round(p.x);
        const py = Math.round(p.y);
        for (const [cx, cy] of shape) ctx.fillRect(px + cx * p.unit, py + cy * p.unit, p.unit, p.unit);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      wind = Math.max(-160, Math.min(160, wind + (x - pointer.lastX) * 0.6));
      pointer.lastX = x;
      pointer.x = x;
      pointer.y = e.clientY - rect.top;
    };

    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > w || y > h) return;
      for (let i = 0; i < 14; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 160;
        petals.push({
          ...spawn(true),
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 80,
          life: 0.9 + Math.random() * 0.6,
        });
      }
    };

    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(canvas);
    const resizer = new ResizeObserver(resize);
    resizer.observe(canvas);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      resizer.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
    };
  }, []);

  return <canvas ref={canvasRef} className="petals" aria-hidden="true" />;
}
