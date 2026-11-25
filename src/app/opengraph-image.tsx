// Share card for links to cortaku.com.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TAGLINE } from '@/lib/site';

export const dynamic = 'force-static';
export const alt = 'Cortaku';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const sprite = await readFile(join(process.cwd(), 'public/game-assets/robot-sprite.png'));
  const spriteUrl = `data:image/png;base64,${sprite.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 90px',
          background: 'linear-gradient(135deg, #ffd3e0 0%, #e4d4ff 55%, #c3e0ff 100%)',
          color: '#1d1736',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -6, lineHeight: 1 }}>Cortaku</div>
          <div style={{ fontSize: 40, marginTop: 28, maxWidth: 620 }}>{TAGLINE}</div>
        </div>
        {/* First frame of the sprite sheet. */}
        <div style={{ display: 'flex', width: 320, height: 320, overflow: 'hidden', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spriteUrl} alt="" width={1600} height={640} style={{ position: 'absolute', left: 0, top: 0 }} />
        </div>
      </div>
    ),
    size,
  );
}
