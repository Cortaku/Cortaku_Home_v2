// Robot skins: recolours of the sprite sheet, unlocked by best score.
import { loadImage } from './assets';

const SPRITE_SRC = '/game-assets/robot-sprite.png';
export const SPRITE_COLUMNS = 5;
export const SPRITE_ROWS = 2;
export const SPRITE_FRAMES = 7;

type Rgb = [number, number, number];

export type Skin = {
  id: string;
  name: string;
  /** Best score needed. Secret skins never unlock by score. */
  unlockAt: number;
  /** Unlocked by finding something on the site instead (see Profile.secrets). */
  secret?: boolean;
  /** Casing and screen colours. Omitted for the original art. */
  body?: Rgb;
  screen?: Rgb;
};

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', unlockAt: 0 },
  { id: 'sakura', name: 'Sakura', unlockAt: 300, body: [255, 150, 188], screen: [255, 240, 246] },
  { id: 'mint', name: 'Mint', unlockAt: 800, body: [110, 220, 170], screen: [232, 255, 244] },
  { id: 'sunset', name: 'Sunset', unlockAt: 1800, body: [255, 160, 72], screen: [255, 240, 196] },
  { id: 'midnight', name: 'Midnight', unlockAt: 3500, body: [92, 96, 205], screen: [120, 248, 255] },
  { id: 'gold', name: 'Gold', unlockAt: 10000, body: [255, 208, 64], screen: [255, 251, 222] },
  // Caught the moon rabbit.
  { id: 'tsuki', name: 'Tsuki', unlockAt: Infinity, secret: true, body: [204, 198, 232], screen: [255, 176, 206] },
];

function getSkin(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function isUnlocked(skin: Skin, profile: { bestEver: number; secrets: string[] }): boolean {
  return skin.secret ? profile.secrets.includes(skin.id) : profile.bestEver >= skin.unlockAt;
}

export type SkinSheet = { source: CanvasImageSource; url: string; width: number; height: number };

const sheets = new Map<string, Promise<SkinSheet>>();

// Brightness of the original casing and screen, to keep the art's shading.
const BODY_LIGHT = 138;
const SCREEN_LIGHT = 172;

function recolour(image: HTMLImageElement, skin: Skin): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const light = 0.299 * r + 0.587 * g + 0.114 * b;
    if (light < 70) continue; // outlines and the dark belt stay as drawn
    const isScreen = b - r > 18;
    const tint = isScreen ? skin.screen! : skin.body!;
    const shade = Math.min(1.25, light / (isScreen ? SCREEN_LIGHT : BODY_LIGHT));
    d[i] = Math.min(255, tint[0] * shade);
    d[i + 1] = Math.min(255, tint[1] * shade);
    d[i + 2] = Math.min(255, tint[2] * shade);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/** Canvas source plus a URL for CSS. Built once per skin. */
export function loadSkinSheet(id: string): Promise<SkinSheet> {
  const skin = getSkin(id);
  let pending = sheets.get(skin.id);
  if (!pending) {
    pending = loadImage(SPRITE_SRC).then(async (image) => {
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      if (!skin.body) return { source: image, url: SPRITE_SRC, ...size };
      const canvas = recolour(image, skin);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      return { source: canvas, url: blob ? URL.createObjectURL(blob) : SPRITE_SRC, ...size };
    });
    sheets.set(skin.id, pending);
  }
  return pending;
}
