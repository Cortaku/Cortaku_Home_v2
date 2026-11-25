// Runs the simulation on a fixed clock and draws it.
import {
  GROUND_Y, OBSTACLE_BANDS, OBSTACLE_SIZES, ROBOT_BOXES, ROBOT_SIZE, ROBOT_X, STEP, VIEW_H, VIEW_W, Sim,
  type ObstacleKind,
} from './sim';
import { LAYER_SPEEDS, OBSTACLE_PAD, buildObstacleSprites, loadScene, type DayTime, type Scene } from './assets';
import { DEFAULT_ROAD, drawRoad } from './road';
import { SPRITE_COLUMNS, SPRITE_FRAMES, SPRITE_ROWS, type SkinSheet } from './skins';
import { SCENE_COUNT } from '@/lib/site';

export type Phase = 'idle' | 'running' | 'paused' | 'dying' | 'over';

export type EngineHooks = {
  onPhase: (phase: Phase) => void;
  onScore: (score: number) => void;
  onSound: (name: 'jump' | 'death' | 'zone') => void;
};

export type EngineOptions = {
  /** Scene set the run starts in. */
  baseSet: number;
  baseTime: DayTime;
  /** Draw hitboxes. */
  debug?: boolean;
};

type Particle = { life: number; max: number; x: number; y: number; vx: number; vy: number; size: number; color: string };

const RUN_FRAME_SECONDS = 0.12;
const HIT_STOP = 0.09;
const DEATH_SECONDS = 0.85;
const SCENE_FADE_SECONDS = 1.4;
const IDLE_SPEED = 90;
const MAX_PIXEL_WIDTH = 1920;

export class Engine {
  readonly sim = new Sim();
  phase: Phase = 'idle';

  private readonly ctx: CanvasRenderingContext2D;
  /** Canvas pixels per game pixel; 0 until the first resize. */
  private scale = 0;
  private sprites: Record<ObstacleKind, HTMLCanvasElement> | null = null;
  private sheet: SkinSheet | null = null;

  private raf = 0;
  private last = 0;
  private acc = 0;
  private clock = 0;
  private lastScore = -1;
  /** Bumped on every start so scene loads from an old run are ignored. */
  private runId = 0;

  // Background scroll carries across restarts so the world never jumps.
  private bgBase = 0;
  private idleDist = 0;
  private scene: Scene | null = null;
  private nextScene: Scene | null = null;
  private lastRoadDist = 0;
  private fade = 0;

  // Presentation only; none of this affects the rules.
  private runFrame = 0;
  private runFrameTime = 0;
  private stretch = 0;
  private shake = 0;
  private tint = 0;
  private deathTime = 0;
  private deathY = 0;
  private deathVy = 0;
  private deathSpin = 0;
  private readonly particles: Particle[] = Array.from({ length: 64 }, () => ({
    life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, size: 2, color: '#fff',
  }));

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hooks: EngineHooks,
    private readonly options: EngineOptions,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;

    this.loadSceneFor(0, true);
    document.addEventListener('visibilitychange', this.onHidden);
    window.addEventListener('blur', this.onHidden);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onHidden);
    window.removeEventListener('blur', this.onHidden);
    this.runId += 1;
  }

  get score(): number {
    return Math.floor(this.sim.score);
  }

  start(seed: number) {
    this.bgBase += this.phase === 'idle' ? this.idleDist : this.sim.dist;
    this.idleDist = 0;
    this.sim.reset(seed);
    this.runId += 1;
    this.acc = 0;
    this.lastScore = -1;
    this.stretch = 0;
    this.shake = 0;
    this.tint = 0;
    for (const p of this.particles) p.life = 0;
    this.loadSceneFor(0, false);
    this.setPhase('running');
    this.hooks.onScore(0);
  }

  /** Back to the attract screen. */
  toMenu() {
    this.bgBase += this.sim.dist;
    this.idleDist = 0;
    this.sim.reset(1);
    this.runId += 1;
    this.tint = 0;
    this.shake = 0;
    for (const p of this.particles) p.life = 0;
    this.loadSceneFor(0, false);
    this.setPhase('idle');
  }

  pause() {
    if (this.phase === 'running') this.setPhase('paused');
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.last = performance.now();
    this.acc = 0;
    this.setPhase('running');
  }

  press() {
    if (this.phase === 'running') this.sim.press();
  }

  release() {
    this.sim.release();
  }

  setSheet(sheet: SkinSheet) {
    this.sheet = sheet;
  }

  /** Match the canvas to its on-screen size. */
  resize(cssWidth: number, cssHeight: number) {
    if (cssWidth < 1 || cssHeight < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.min(MAX_PIXEL_WIDTH, Math.round(cssWidth * dpr));
    const height = Math.round((width * VIEW_H) / VIEW_W);
    const scale = width / VIEW_W;
    // Check our own scale too: a new engine can inherit a canvas that is already the right size.
    if (this.canvas.width === width && this.canvas.height === height && this.scale === scale) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.scale = scale;
    this.sprites = buildObstacleSprites(this.scale);
    // Resizing wipes the canvas, so repaint now.
    this.draw();
  }

  private readonly onHidden = () => {
    if (this.phase === 'running') this.pause();
  };

  private setPhase(phase: Phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.hooks.onPhase(phase);
  }

  private readonly frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.phase !== 'paused') this.update(dt);
    this.draw();
  };

  private update(dt: number) {
    this.clock += dt;

    if (this.phase === 'idle') {
      this.idleDist += IDLE_SPEED * dt;
    } else if (this.phase === 'running') {
      this.acc += dt;
      while (this.acc >= STEP && this.sim.alive) {
        this.sim.step(STEP);
        this.acc -= STEP;
        this.handleEvents();
      }
      const score = this.score;
      if (score !== this.lastScore) {
        this.lastScore = score;
        this.hooks.onScore(score);
      }
    } else if (this.phase === 'dying') {
      this.deathTime += dt;
      if (this.deathTime > HIT_STOP) {
        this.deathVy += 3200 * dt;
        this.deathY += this.deathVy * dt;
        this.deathSpin += 7 * dt;
      }
      if (this.deathTime > DEATH_SECONDS) this.setPhase('over');
    }

    const speedFactor = this.phase === 'running' ? Math.min(2, this.sim.speed / 300) : 1;
    if (this.phase === 'idle' || this.phase === 'running') {
      this.runFrameTime += dt * speedFactor;
      if (this.runFrameTime >= RUN_FRAME_SECONDS) {
        this.runFrameTime -= RUN_FRAME_SECONDS;
        this.runFrame = (this.runFrame + 1) % SPRITE_FRAMES;
      }
    }
    this.stretch *= Math.exp(-dt * 14);
    this.shake *= Math.exp(-dt * 9);
    if (this.phase === 'dying' || this.phase === 'over') this.tint = Math.min(0.45, this.tint + dt * 1.2);

    if (this.nextScene) {
      this.fade += dt / SCENE_FADE_SECONDS;
      if (this.fade >= 1) {
        this.scene = this.nextScene;
        this.nextScene = null;
      }
    }

    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private handleEvents() {
    for (const event of this.sim.events) {
      if (event === 'jump') {
        this.stretch = 0.18;
        this.puff(3, this.road().edge);
        this.hooks.onSound('jump');
      } else if (event === 'land') {
        this.stretch = -0.2;
        this.puff(5, this.road().edge);
      } else if (event === 'zone') {
        this.loadSceneFor(this.sim.zone, false);
        this.hooks.onSound('zone');
      } else if (event === 'death') {
        this.shake = 10;
        this.deathTime = 0;
        this.deathY = this.sim.robotY;
        this.deathVy = -620;
        this.deathSpin = 0;
        this.burst();
        this.hooks.onSound('death');
        this.setPhase('dying');
      }
    }
    this.sim.events.length = 0;
  }

  /** Each zone moves to the next scene set and flips day and night. */
  private sceneFor(zone: number): [number, DayTime] {
    const set = ((this.options.baseSet - 1 + zone) % SCENE_COUNT) + 1;
    const flipped: DayTime = this.options.baseTime === 'day' ? 'night' : 'day';
    return [set, zone % 2 === 0 ? this.options.baseTime : flipped];
  }

  private loadSceneFor(zone: number, immediate: boolean) {
    const runId = this.runId;
    const [set, time] = this.sceneFor(zone);
    loadScene(set, time)
      .then((scene) => {
        if (runId !== this.runId) return;
        if (immediate || !this.scene) {
          this.scene = scene;
        } else if (scene.key !== this.scene.key) {
          this.nextScene = scene;
          this.fade = 0;
        }
      })
      .catch(() => {});
    // Preload the next zone's scene.
    const [nextSet, nextTime] = this.sceneFor(zone + 1);
    loadScene(nextSet, nextTime).catch(() => {});
  }

  private emit(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string) {
    const p = this.particles.find((q) => q.life <= 0);
    if (!p) return;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.color = color;
  }

  private road() {
    return (this.nextScene && this.fade > 0.5 ? this.nextScene : this.scene)?.road ?? DEFAULT_ROAD;
  }

  private puff(count: number, color: string) {
    for (let i = 0; i < count; i++) {
      this.emit(
        ROBOT_X + 26 + Math.random() * 28, GROUND_Y - 2,
        -60 - Math.random() * 120, -40 - Math.random() * 90,
        0.25 + Math.random() * 0.2, 3 + Math.random() * 3, color,
      );
    }
  }

  private burst() {
    const colors = ['#ff5c8f', '#ffd84d', '#ffffff', '#9bb0bd'];
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 320;
      this.emit(
        ROBOT_X + ROBOT_SIZE / 2, this.sim.robotY + ROBOT_SIZE / 2,
        Math.cos(angle) * speed, Math.sin(angle) * speed - 160,
        0.5 + Math.random() * 0.4, 3 + Math.random() * 4, colors[i % colors.length],
      );
    }
  }

  /** Round to a whole screen pixel so pixel art doesn't shimmer. */
  private snap(value: number): number {
    return Math.round(value * this.scale) / this.scale;
  }

  private draw() {
    const { ctx, sim } = this;
    const s = this.scale;
    if (s === 0) return; // not sized yet
    const running = this.phase === 'running';
    const alpha = running ? Math.min(1, this.acc / STEP) : 1;
    const simDist = running ? sim.prevDist + (sim.dist - sim.prevDist) * alpha : sim.dist;
    const dist = this.phase === 'idle' ? this.idleDist : simDist;
    const bgDist = this.bgBase + dist;

    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;

    if (this.scene) {
      this.drawScene(this.scene, bgDist, 1);
      if (this.nextScene) this.drawScene(this.nextScene, bgDist, Math.min(1, this.fade));
    } else {
      ctx.fillStyle = this.options.baseTime === 'day' ? '#bfe3ff' : '#141033';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (this.shake > 0.3) {
      ctx.translate(Math.sin(this.clock * 95) * this.shake, Math.cos(this.clock * 71) * this.shake * 0.6);
    }

    // How far the road moved since the last frame drives its motion blur. A jump means a reset, not speed.
    const moved = dist - this.lastRoadDist;
    this.lastRoadDist = dist;
    const smear = moved > 0 && moved < 120 ? moved : 0;
    drawRoad(ctx, this.scene?.road ?? DEFAULT_ROAD, dist, smear, 1);
    if (this.nextScene) drawRoad(ctx, this.nextScene.road, dist, smear, Math.min(1, this.fade));

    if (this.sprites && this.phase !== 'idle') {
      ctx.imageSmoothingEnabled = true;
      for (const o of sim.obstacles) {
        if (!o.active) continue;
        const { w, h } = OBSTACLE_SIZES[o.kind];
        const x = this.snap(o.x - simDist);
        if (x > VIEW_W + 10) continue;
        ctx.drawImage(this.sprites[o.kind], x - OBSTACLE_PAD, GROUND_Y - h - OBSTACLE_PAD, w + OBSTACLE_PAD * 2, h + OBSTACLE_PAD * 2);
      }
      ctx.imageSmoothingEnabled = false;
    }

    this.drawRobot(alpha);

    for (const p of this.particles) {
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(this.snap(p.x), this.snap(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    if (this.options.debug) this.drawHitboxes(simDist);

    if (this.tint > 0) {
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.fillStyle = `rgba(10, 8, 24, ${this.tint})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  private drawScene(scene: Scene, dist: number, alpha: number) {
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.drawImage(scene.layers[0], 0, 0, VIEW_W, VIEW_H);
    for (let i = 1; i < scene.layers.length; i++) {
      const x = -this.snap((dist * LAYER_SPEEDS[i]) % VIEW_W);
      ctx.drawImage(scene.layers[i], x, 0, VIEW_W + 0.5, VIEW_H);
      ctx.drawImage(scene.layers[i], x + VIEW_W, 0, VIEW_W + 0.5, VIEW_H);
    }
    ctx.globalAlpha = 1;
  }

  private drawRobot(alpha: number) {
    const { ctx, sim, sheet } = this;
    if (!sheet) return;
    const dead = this.phase === 'dying' || this.phase === 'over';
    const idle = this.phase === 'idle';

    let y = GROUND_Y - ROBOT_SIZE;
    if (dead) y = this.deathY;
    else if (!idle) y = sim.prevRobotY + (sim.robotY - sim.prevRobotY) * alpha;
    if (y > VIEW_H + ROBOT_SIZE) return;

    // In the air: one frame going up, another coming down.
    let frame = this.runFrame;
    if (!idle && !dead && !sim.grounded) frame = sim.vy < 0 ? 2 : 4;
    const fw = sheet.width / SPRITE_COLUMNS;
    const fh = sheet.height / SPRITE_ROWS;
    const sx = (frame % SPRITE_COLUMNS) * fw;
    const sy = Math.floor(frame / SPRITE_COLUMNS) * fh;

    // Squash and stretch about the feet.
    const stretch = dead ? 0 : this.stretch;
    const w = ROBOT_SIZE * (1 - stretch * 0.6);
    const h = ROBOT_SIZE * (1 + stretch);
    const x = ROBOT_X + (ROBOT_SIZE - w) / 2;

    if (dead && this.deathSpin !== 0) {
      ctx.save();
      ctx.translate(ROBOT_X + ROBOT_SIZE / 2, y + ROBOT_SIZE / 2);
      ctx.rotate(this.deathSpin);
      ctx.drawImage(sheet.source, sx, sy, fw, fh, -ROBOT_SIZE / 2, -ROBOT_SIZE / 2, ROBOT_SIZE, ROBOT_SIZE);
      ctx.restore();
    } else {
      ctx.drawImage(sheet.source, sx, sy, fw, fh, this.snap(x), this.snap(y + ROBOT_SIZE - h), w, h);
    }
  }

  private drawHitboxes(simDist: number) {
    const { ctx, sim } = this;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#00ff7f';
    for (const r of ROBOT_BOXES) ctx.strokeRect(ROBOT_X + r.x, sim.robotY + r.y, r.w, r.h);
    ctx.strokeStyle = '#ff2d55';
    for (const o of sim.obstacles) {
      if (!o.active) continue;
      const { w, h } = OBSTACLE_SIZES[o.kind];
      const x = o.x - simDist;
      for (const b of OBSTACLE_BANDS) ctx.strokeRect(x + b.x * w, GROUND_Y - h + b.y * h, b.w * w, b.h * h);
    }
  }
}
