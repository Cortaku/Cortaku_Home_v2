// The homepage hero's moving scene, drawn into one canvas.
//
// It used to be about twenty stacked, screen-sized CSS layers (day and night, each with sky, sun, four drifting
// layers and their landmarks). Phones draw layers that big in tiles and can't keep up: on a theme switch or a
// scroll back up, blocks of the scene (and the text over it) went missing for a moment. One canvas the size of
// the screen holds the same picture in a few megabytes and is always fully drawn.
//
// The motion matches what the CSS did: layer N drifts one tile every SECONDS[N] and leans DEPTH[N] px with the
// pointer; the sun stays put; each landmark crosses the screen once per pass of whole tiles (so it comes back on
// the same patch of hill) instead of repeating with its layer.
import { loadScene, type DayTime, type Scene } from './assets';
import type { RoadPalette } from './road';
import { SUN_X } from '../lib/site';
import { watchPixelRatio } from '../lib/pixel-ratio';

/** Per layer, sky first: seconds to drift one tile (0 = still), and px of lean at full pointer offset. */
const SECONDS = [0, 240, 120, 60, 36];
const DEPTH = [0, 4, 8, 14, 22];
const SUN_DEPTH = 2;
/** The scene reaches this far past each side, so leaning never shows an edge. */
const BLEED = 32;
const NIGHT_FADE_SECONDS = 0.8;
const SCENE_FADE_SECONDS = 0.5;
/** How quickly the lean catches up with the pointer (time constant). */
const LEAN_SECONDS = 0.15;
const MAX_DPR = 2;

type Pair = { set: number; day: Scene; night: Scene };

const smooth = (t: number) => t * t * (3 - 2 * t);

export class Backdrop {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private width = 0;
  private height = 0;
  private dpr = 1;

  /** Seconds of drift so far; stands still while the scene is off screen or paused. */
  private time = 0;
  private last = 0;
  private raf = 0;

  private lean = 0;
  private leanTarget = 0;
  /** 0 is day, 1 is night; eases toward nightTarget when the theme changes. */
  private night: number;
  private nightTarget: number;

  /**
   * The scenes on screen, oldest first: the first is drawn solid, each later one fades in over those below
   * (fade 0 to 1). Switching again mid-fade just adds another, so nothing on screen jumps.
   */
  private scenes: { pair: Pair; fade: number }[] = [];
  private sceneToken = 0;

  private onScreen = true;
  private readonly resizer: ResizeObserver;
  private readonly stopPixelRatio: () => void;
  private readonly visibility: IntersectionObserver;
  private readonly htmlWatcher: MutationObserver;

  /**
   * `onScene` hears each scene's road colours as it starts to show, so the road (CSS) can change with the
   * scene rather than ahead of it.
   */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onScene?: (road: Record<DayTime, RoadPalette>) => void,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.night = this.nightTarget = this.isDark() ? 1 : 0;

    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(canvas);
    this.stopPixelRatio = watchPixelRatio(() => this.resize());
    this.visibility = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      // The road (CSS) pauses with the scene.
      canvas.parentElement?.classList.toggle('is-offscreen', !this.onScreen);
      this.wake();
    });
    this.visibility.observe(canvas);
    this.htmlWatcher = new MutationObserver(() => this.onHtmlChange());
    this.htmlWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-arcade-open'] });
    document.addEventListener('visibilitychange', this.wake);
    if (!this.reduced) window.addEventListener('pointermove', this.onPointer, { passive: true });
    this.resize();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sceneToken += 1;
    this.resizer.disconnect();
    this.stopPixelRatio();
    this.visibility.disconnect();
    this.htmlWatcher.disconnect();
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('pointermove', this.onPointer);
  }

  /** Switch to scene set `set`, fading over once both its day and night art have loaded. */
  setScene(set: number) {
    const token = ++this.sceneToken;
    Promise.all([loadScene(set, 'day'), loadScene(set, 'night')])
      .then(([day, night]) => {
        if (token !== this.sceneToken) return;
        const pair = { set, day, night };
        if (this.scenes.length && !this.reduced) {
          // No cap needed: each one is solid within SCENE_FADE_SECONDS, which drops everything under it.
          this.scenes.push({ pair, fade: 0 });
        } else {
          this.scenes = [{ pair, fade: 1 }];
        }
        this.onScene?.({ day: day.road, night: night.road });
        this.draw();
        this.wake();
      })
      .catch(() => {});
  }

  private isDark() {
    return document.documentElement.classList.contains('dark');
  }

  private shouldRun() {
    if (!this.onScreen || document.hidden || document.documentElement.hasAttribute('data-arcade-open')) return false;
    return !this.reduced;
  }

  private onHtmlChange() {
    const target = this.isDark() ? 1 : 0;
    if (target !== this.nightTarget) {
      this.nightTarget = target;
      // Off screen or still: no one sees a fade, so just switch.
      if (!this.shouldRun()) {
        this.night = target;
        this.draw();
      }
    }
    this.wake();
  }

  private readonly onPointer = (e: PointerEvent) => {
    this.leanTarget = (e.clientX / window.innerWidth - 0.5) * -1;
  };

  private readonly wake = () => {
    if (this.raf || !this.shouldRun()) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  private readonly frame = (now: number) => {
    this.raf = 0;
    if (!this.shouldRun()) return;
    // A frame's timestamp can be a little before the performance.now() taken in wake().
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;

    this.time += dt;
    this.lean += (this.leanTarget - this.lean) * (1 - Math.exp(-dt / LEAN_SECONDS));
    if (this.night !== this.nightTarget) {
      const step = dt / NIGHT_FADE_SECONDS;
      this.night = this.nightTarget > this.night ? Math.min(1, this.night + step) : Math.max(0, this.night - step);
    }
    for (let i = 1; i < this.scenes.length; i++) {
      const scene = this.scenes[i];
      scene.fade = Math.min(1, scene.fade + dt / SCENE_FADE_SECONDS);
      // Fully faded in: everything below it is covered.
      if (scene.fade >= 1) {
        this.scenes.splice(0, i);
        i = 0;
      }
    }

    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width < 1 || height < 1) return;
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    // Resizing wipes the canvas.
    this.draw();
  }

  /** Round to a whole canvas pixel so pixel art doesn't shimmer. */
  private snap(value: number) {
    return Math.round(value * this.dpr) / this.dpr;
  }

  private draw() {
    const { ctx, width, height } = this;
    if (!width) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    // Until the art loads, the .scene gradient shows through.
    this.scenes.forEach(({ pair, fade }, i) => this.drawPair(pair, i === 0 ? 1 : smooth(fade)));
    ctx.globalAlpha = 1;
  }

  /** Day, then night over it as far as the theme fade has got. */
  private drawPair(pair: Pair, alpha: number) {
    const night = smooth(this.night);
    if (night < 1) this.drawStack(pair, 'day', alpha);
    if (night > 0) this.drawStack(pair, 'night', alpha * night);
  }

  private drawStack(pair: Pair, time: DayTime, alpha: number) {
    const { ctx, width, height } = this;
    const scene = pair[time];
    const tile = (height * 16) / 9;
    const left = -BLEED;
    const span = width + BLEED * 2;
    ctx.globalAlpha = alpha;

    // The sky, stretched across.
    ctx.drawImage(scene.layers[0], left, 0, span, height);

    // The sun, once, at the same fraction of the screen as of its tile.
    const sunX = left + (span - tile) * (SUN_X[pair.set] ?? 0.5) + this.lean * SUN_DEPTH;
    ctx.drawImage(scene.sun, this.snap(sunX), 0, tile, height);

    // Enough whole tiles per landmark pass to clear the screen, plus one.
    const passTiles = Math.ceil(span / tile) + 1;

    for (let i = 1; i < scene.layers.length; i++) {
      const seconds = SECONDS[i];
      const lean = this.lean * DEPTH[i];
      const drift = ((this.time / seconds) % 1) * tile;
      for (let x = left - drift + lean; x < width; x += tile) {
        const x0 = this.snap(x);
        ctx.drawImage(scene.layers[i], x0, 0, this.snap(x + tile) - x0, height);
      }

      const mark = scene.marks[i];
      if (mark) {
        const pass = seconds * passTiles;
        const phase = ((this.time + (passTiles - 1) * seconds) / pass) % 1;
        const x = left + tile * (passTiles - 1) - phase * tile * passTiles + lean;
        if (x < width && x + tile > 0) {
          const x0 = this.snap(x);
          ctx.drawImage(mark, x0, 0, this.snap(x + tile) - x0, height);
        }
      }
    }
  }
}
