'use client';

import { useEffect, useRef } from 'react';
import { Play, Shuffle, Trophy } from 'lucide-react';
import { useArcade } from './ArcadeProvider';
import Petals from './Petals';
import Mascot from './Mascot';
import { SCENE_COUNT, TAGLINE } from '@/lib/site';
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

function SceneStack({ scene, time }: { scene: number; time: 'day' | 'night' }) {
  return (
    <div className={`scene-stack scene-${time}`}>
      {LAYERS.map((layer) => (
        <div
          key={layer.n}
          className={layer.seconds ? 'scene-layer is-moving' : 'scene-layer'}
          style={{
            backgroundImage: `url(/game-assets/Backgrounds/${scene}/${time}/${layer.n}.png)`,
            animationDuration: `${layer.seconds}s`,
            ['--depth' as string]: layer.depth,
          }}
        />
      ))}
    </div>
  );
}

export default function Hero() {
  const { isOpen, openGame, scores, scoreState, scene, nextScene } = useArcade();
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
