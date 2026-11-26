'use client';

import { useEffect, useRef } from 'react';
import { Play, Shuffle, Trophy } from 'lucide-react';
import { useArcade } from './ArcadeProvider';
import Petals from './Petals';
import Mascot from './Mascot';
import FallenLantern from './FallenLantern';
import { LANDMARK_LAYERS, SCENE_COUNT, SUN_X, TAGLINE } from '@/lib/site';
import { loadImage } from '@/game/assets';
import { roadPalette, sampleGround } from '@/game/road';

// Layer 1 is the still sky; 2-5 scroll at increasing speed.
const LAYERS = [
  { n: 1, seconds: 0, depth: 0 },
  { n: 2, seconds: 240, depth: 4 },
  { n: 3, seconds: 120, depth: 8 },
  { n: 4, seconds: 60, depth: 14 },
  { n: 5, seconds: 36, depth: 22 },
];

/** The sun (or moon) on its own, drawn once and still, so a wide screen never shows two. */
function SceneSun({ scene, time }: { scene: number; time: 'day' | 'night' }) {
  return (
    <div
      className="scene-layer scene-sun"
      style={{
        backgroundImage: `url(/game-assets/Backgrounds/${scene}/${time}/sun.png)`,
        backgroundPositionX: `${(SUN_X[scene] ?? 0.5) * 100}%`,
        ['--depth' as string]: 2,
      }}
    />
  );
}

/**
 * A layer's landmarks (Fuji, a tower, a gate), drawn over the layer and moving at its speed, but crossing the
 * screen once before coming back rather than tiling, so a wide screen never shows two. See .scene-landmark.
 */
function SceneLandmark({ scene, time, layer }: { scene: number; time: 'day' | 'night'; layer: (typeof LAYERS)[number] }) {
  return (
    <div
      className="scene-layer scene-landmark"
      style={{
        backgroundImage: `url(/game-assets/Backgrounds/${scene}/${time}/${layer.n}-landmark.png)`,
        ['--seconds' as string]: layer.seconds,
        ['--depth' as string]: layer.depth,
      }}
    />
  );
}

function SceneStack({ scene, time }: { scene: number; time: 'day' | 'night' }) {
  const landmarks = LANDMARK_LAYERS[scene] ?? [];
  return (
    <div className={`scene-stack scene-${time}`}>
      {LAYERS.map((layer) => [
        layer.n === 2 && <SceneSun key="sun" scene={scene} time={time} />,
        <div
          key={layer.n}
          className={layer.seconds ? 'scene-layer is-moving' : 'scene-layer'}
          style={{
            backgroundImage: `url(/game-assets/Backgrounds/${scene}/${time}/${layer.n}.png)`,
            animationDuration: `${layer.seconds}s`,
            ['--depth' as string]: layer.depth,
          }}
        />,
        landmarks.includes(layer.n) && <SceneLandmark key={`mark-${layer.n}`} scene={scene} time={time} layer={layer} />,
      ])}
    </div>
  );
}

export default function Hero() {
  const { isOpen, openGame, scores, scoreState, scene, nextScene, fallenLantern } = useArcade();
  const sceneRef = useRef<HTMLDivElement>(null);

  // Lean the layers toward the pointer.
  useEffect(() => {
    const el = sceneRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--lean', String((e.clientX / window.innerWidth - 0.5) * -1));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // A landmark's pass is enough whole tiles to clear the screen, plus one; tell the CSS how many.
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const tile = (el.clientHeight * 16) / 9;
      if (tile > 0) el.style.setProperty('--mark-n', String(Math.ceil((el.clientWidth + 4 * rem) / tile) + 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pause the scene while it's scrolled out of view, so it isn't animating behind the rest of the page.
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => el.classList.toggle('is-offscreen', !entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Colour the road from the scene's ground, for both day and night.
  useEffect(() => {
    const el = sceneRef.current;
    let cancelled = false;
    for (const time of ['day', 'night'] as const) {
      loadImage(`/game-assets/Backgrounds/${scene}/${time}/5.png`)
        .then((layer) => {
          if (cancelled || !el) return;
          for (const [name, colour] of Object.entries(roadPalette(sampleGround(layer)))) {
            el.style.setProperty(`--road-${name}-${time}`, colour);
          }
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [scene]);

  const top = scores[0];

  return (
    <section id="top" className="hero">
      <div
        ref={sceneRef}
        className="scene"
        style={{ viewTransitionName: isOpen ? 'none' : 'arcade' }}
        aria-hidden="true"
      >
        <SceneStack scene={scene} time="day" />
        <SceneStack scene={scene} time="night" />
        <div className="scene-ground" />
      </div>

      <Petals paused={isOpen} />
      <Mascot paused={isOpen} />
      {fallenLantern && <FallenLantern from={fallenLantern} />}

      <div className="hero-copy">
        <h1 className="wordmark">Cortaku</h1>
        <p className="tagline">{TAGLINE}</p>

        <div className="hero-actions">
          <button type="button" className="btn-arcade" onClick={openGame}>
            <Play className="size-5 fill-current" aria-hidden="true" />
            Play
          </button>
          <a href="#arcade" className="chip">
            <Trophy className="size-4" aria-hidden="true" />
            {scoreState === 'ready' && top ? (
              <span>
                Score to beat: <strong>{top.score.toLocaleString()}</strong> by {top.player_name}
              </span>
            ) : (
              <span>High scores</span>
            )}
          </a>
        </div>
        <p className="hero-hint">
          <kbd>Space</kbd> to start and jump
        </p>
      </div>

      <button type="button" className="scene-switch" onClick={nextScene} aria-label="Switch to the next background scene">
        <Shuffle className="size-4" aria-hidden="true" />
        Scene {scene}/{SCENE_COUNT}
      </button>
    </section>
  );
}
