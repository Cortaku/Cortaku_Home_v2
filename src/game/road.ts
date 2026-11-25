// The running surface. Colours come from each scene's own ground; details sit at
// irregular, world-fixed spots and blur with speed, so the road never strobes.
import { GROUND_Y, VIEW_W } from './sim';

export type Rgb = [number, number, number];
export type RoadPalette = { edge: string; top: string; lip: string; face: string; speck: string; joint: string };

/** Depths below GROUND_Y, in game px: highlight edge, walking surface, lip, then the front face. */
export const ROAD = { edge: 2, top: 12, lip: 13, bottom: 28 };

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const CELL = 26;

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function roadPalette(ground: Rgb): RoadPalette {
  return {
    edge: hex(mix(ground, WHITE, 0.55)),
    top: hex(mix(ground, WHITE, 0.22)),
    lip: hex(mix(ground, BLACK, 0.25)),
    face: hex(ground),
    speck: hex(mix(ground, WHITE, 0.38)),
    joint: hex(mix(ground, BLACK, 0.35)),
  };
}

/** Mount Fuji by day, used until a scene's own colours are known. */
export const DEFAULT_ROAD = roadPalette([55, 67, 122]);

/** The most common opaque colour along a low row of a scene's front layer: its ground. */
export function sampleGround(layer: HTMLImageElement): Rgb {
  const canvas = document.createElement('canvas');
  canvas.width = layer.naturalWidth;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const row = Math.round(layer.naturalHeight * 0.93);
  ctx.drawImage(layer, 0, row, layer.naturalWidth, 1, 0, 0, layer.naturalWidth, 1);
  const data = ctx.getImageData(0, 0, canvas.width, 1).data;
  const counts = new Map<number, number>();
  let best = -1;
  let bestCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 250) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n > bestCount) { best = key; bestCount = n; }
  }
  return best < 0 ? [55, 67, 122] : [best >> 16, (best >> 8) & 255, best & 255];
}

/** Repeatable 0..1 noise for an integer. */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * Draws the road scrolled to `dist`. `smear` is how far it moved this frame: each detail is
 * stretched by that much and dimmed to match, a cheap motion blur that fades it to a streak at speed.
 */
export function drawRoad(ctx: CanvasRenderingContext2D, p: RoadPalette, dist: number, smear: number, alpha: number) {
  const y = GROUND_Y;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.face;
  ctx.fillRect(0, y, VIEW_W, ROAD.bottom);
  ctx.fillStyle = p.top;
  ctx.fillRect(0, y, VIEW_W, ROAD.top);
  ctx.fillStyle = p.lip;
  ctx.fillRect(0, y + ROAD.top, VIEW_W, ROAD.lip - ROAD.top);
  ctx.fillStyle = p.edge;
  ctx.fillRect(0, y, VIEW_W, ROAD.edge);

  const detail = (x: number, top: number, w: number, h: number, colour: string, strength: number) => {
    if (x + w + smear < 0 || x > VIEW_W) return;
    ctx.globalAlpha = alpha * strength * (w / (w + smear));
    ctx.fillStyle = colour;
    ctx.fillRect(x, top, w + smear, h);
  };

  const first = Math.floor(dist / CELL) - 1;
  const last = Math.ceil((dist + VIEW_W) / CELL);
  for (let k = first; k <= last; k++) {
    const left = k * CELL - dist;
    if (hash(k) < 0.55) {
      const w = 2 + Math.floor(hash(k * 3 + 1) * 5);
      const top = y + ROAD.edge + 2 + Math.floor(hash(k * 5 + 2) * 7);
      detail(left + Math.floor(hash(k * 7 + 3) * CELL), top, w, hash(k * 11 + 4) < 0.7 ? 1 : 2, p.speck, 0.9);
    }
    if (hash(k * 13 + 5) < 0.3) {
      detail(left + Math.floor(hash(k * 17 + 6) * CELL), y + ROAD.lip + 2, 1, ROAD.bottom - ROAD.lip - 6, p.joint, 0.8);
    }
  }
  ctx.globalAlpha = 1;
}
