import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';

export const metadata: Metadata = { title: 'Lost · Cortaku' };

const SCENE = 1;
const LAYERS = [1, 2, 3, 4, 5];

/** The 404 page: the hero's Mount Fuji scene, standing still, with the robot stopped at a gap in the road. */
export default function NotFound() {
  return (
    <main className="lost">
      <div className="scene" aria-hidden="true">
        {(['day', 'night'] as const).map((time) => (
          <div key={time} className={`scene-stack scene-${time}`}>
            {LAYERS.map((n) => (
              <div key={n} className="scene-layer" style={{ backgroundImage: `url(/game-assets/Backgrounds/${SCENE}/${time}/${n}.png)` }} />
            ))}
          </div>
        ))}
        <div className="scene-ground lost-road" />
      </div>

      <Link href="/" className="brand lost-brand">
        <Logo className="size-7" />
        <span>Cortaku</span>
      </Link>

      <div className="hero-copy">
        <h1 className="wordmark">404</h1>
        <p className="tagline">This road doesn’t go anywhere.</p>
        <div className="hero-actions">
          <Link href="/" className="btn-arcade">
            <ArrowLeft className="size-5" aria-hidden="true" />
            Back to the start
          </Link>
        </div>
      </div>

      <div className="lost-robot" aria-hidden="true">
        <span className="mascot-bubble">…huh?</span>
        <span className="mascot-sprite" />
      </div>
    </main>
  );
}
