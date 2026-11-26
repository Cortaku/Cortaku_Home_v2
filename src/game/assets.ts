import { OBSTACLE_SIZES, type ObstacleKind } from './sim';
import { roadPalette, sampleGround, type RoadPalette } from './road';
import { LANDMARK_LAYERS } from '../lib/site';

export type DayTime = 'day' | 'night';
/**
 * `sun` is the sun (or moon) on its own, drawn once and still, between the sky and layer 2. `marks[i]` is the
 * landmark image drawn over `layers[i]`, when that layer has one. The game view is one tile wide, so
 * landmarks simply move with their layer here.
 */
export type Scene = {
  key: string;
  layers: HTMLImageElement[];
  marks: (HTMLImageElement | null)[];
  sun: HTMLImageElement;
  road: RoadPalette;
};

/** Scroll speed of each layer relative to the ground. Layer 0 is the still sky. */
export const LAYER_SPEEDS = [0, 0.05, 0.15, 0.3, 0.5];

const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let pending = images.get(src);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => {
        images.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      img.src = src;
    });
    images.set(src, pending);
  }
  return pending;
}

export async function loadScene(set: number, time: DayTime): Promise<Scene> {
  const dir = `/game-assets/Backgrounds/${set}/${time}`;
  const withMarks = LANDMARK_LAYERS[set] ?? [];
  const [sun, layers, marks] = await Promise.all([
    loadImage(`${dir}/sun.png`),
    Promise.all(LAYER_SPEEDS.map((_, i) => loadImage(`${dir}/${i + 1}.png`))),
    Promise.all(LAYER_SPEEDS.map((_, i) => (withMarks.includes(i + 1) ? loadImage(`${dir}/${i + 1}-landmark.png`) : null))),
  ]);
  return { key: `${set}/${time}`, layers, marks, sun, road: roadPalette(sampleGround(layers[layers.length - 1])) };
}

/** Transparent margin around each obstacle sprite for its glow, in game px. */
export const OBSTACLE_PAD = 3;

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

/**
 * Renders the device's own emoji once per size, cropped to its visible pixels and
 * fitted to the hitbox, so every platform's glyph matches what you can hit.
 */
export function buildObstacleSprites(pixelScale: number): Record<ObstacleKind, HTMLCanvasElement> {
  const sprites = {} as Record<ObstacleKind, HTMLCanvasElement>;

  for (const kind of Object.keys(OBSTACLE_SIZES) as ObstacleKind[]) {
    const { w, h } = OBSTACLE_SIZES[kind];
    const targetW = Math.ceil(w * pixelScale);
    const targetH = Math.ceil(h * pixelScale);
    const pad = Math.ceil(OBSTACLE_PAD * pixelScale);

    // Render the glyph large and find its visible bounds.
    const fontPx = Math.max(16, Math.round(targetH * 1.3));
    const scratch = document.createElement('canvas');
    scratch.width = scratch.height = Math.ceil(fontPx * 1.8);
    const sctx = scratch.getContext('2d', { willReadFrequently: true })!;
    sctx.font = `${fontPx}px ${EMOJI_FONT}`;
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('\u{1F4A9}', scratch.width / 2, scratch.height / 2);

    const { data, width, height } = sctx.getImageData(0, 0, scratch.width, scratch.height);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Fit it into the sprite, with a light edge for dark scenes.
    const sprite = document.createElement('canvas');
    sprite.width = targetW + pad * 2;
    sprite.height = targetH + pad * 2;
    const ctx = sprite.getContext('2d')!;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowBlur = pad * 0.8;

    if (maxX >= minX && maxY >= minY) {
      ctx.drawImage(scratch, minX, minY, maxX - minX + 1, maxY - minY + 1, pad, pad, targetW, targetH);
    } else {
      // No emoji font: draw a plain mound.
      ctx.fillStyle = '#7a4a2b';
      ctx.beginPath();
      ctx.moveTo(pad, pad + targetH);
      ctx.quadraticCurveTo(pad + targetW / 2, pad - targetH * 0.6, pad + targetW, pad + targetH);
      ctx.fill();
    }
    sprites[kind] = sprite;
  }
  return sprites;
}
