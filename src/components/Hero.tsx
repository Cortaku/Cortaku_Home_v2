'use client';

import { useEffect, useRef } from 'react';
import { Play, Shuffle, Trophy } from 'lucide-react';
import { useArcade } from './ArcadeProvider';
import Petals from './Petals';
import Mascot from './Mascot';
import FallenLantern from './FallenLantern';
import { SCENE_COUNT, TAGLINE } from '@/lib/site';
import { Backdrop } from '@/game/backdrop';

export default function Hero() {
  const { isOpen, openGame, scores, scoreState, scene, nextScene, fallenLantern } = useArcade();
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backdropRef = useRef<Backdrop | null>(null);

  // The moving scene is one canvas (see backdrop.ts for why). The road is CSS, coloured from each scene's
  // ground as that scene starts to show.
  useEffect(() => {
    const canvas = canvasRef.current;
    const el = sceneRef.current;
    if (!canvas || !el) return;
    const backdrop = new Backdrop(canvas, (road) => {
      for (const [time, palette] of Object.entries(road)) {
        for (const [name, colour] of Object.entries(palette)) el.style.setProperty(`--road-${name}-${time}`, colour);
      }
    });
    backdropRef.current = backdrop;
    return () => {
      backdrop.destroy();
      backdropRef.current = null;
    };
  }, []);

  useEffect(() => {
    backdropRef.current?.setScene(scene);
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
        <canvas ref={canvasRef} className="scene-canvas" />
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
