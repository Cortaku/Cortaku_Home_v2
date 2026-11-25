/**
 * The game's rules, free of browser APIs and fully deterministic: the same seed and
 * inputs always give the same run. That keeps the daily run fair and the rules testable.
 */

export const VIEW_W = 800;
export const VIEW_H = 450;
/** Y of the top of the ground strip. */
export const GROUND_Y = 350;
export const ROBOT_X = 100;
export const ROBOT_SIZE = 80;
/** Fixed tick. 120 Hz keeps input latency under 9 ms. */
export const STEP = 1 / 120;

const GRAVITY = 3600; // px/s²
const JUMP_VELOCITY = -900; // px/s
/** Releasing early multiplies upward speed by this. */
const JUMP_CUT = 0.45;
/** Minimum rise time, so a quick tap still clears a small obstacle. */
const MIN_HOLD = 0.08;
/** A press this long before landing still counts. */
const JUMP_BUFFER = 0.11;

const SPEED_START = 300; // px/s
const SPEED_MID = 720;
const SPEED_MAX = 1080;
const RAMP_FAST = 21; // px/s per second, up to SPEED_MID
const RAMP_SLOW = 6; // then a long slow climb to SPEED_MAX

/** Points per second at the starting speed. */
const SCORE_RATE = 10;

/** Shortest time between obstacle groups: a full jump plus a breath. */
const GAP_MIN = 0.62;
const GAP_MAX_EASY = 1.7;
const GAP_MAX_HARD = 1.05;
/** Air time of the shortest hop; every group must be clearable with it. */
const SHORT_HOP_AIR = 0.42;

export type Box = { x: number; y: number; w: number; h: number };

/** Relative to the robot's top-left: head, then legs. */
export const ROBOT_BOXES: readonly Box[] = [
  { x: 18, y: 24, w: 44, h: 28 },
  { x: 26, y: 52, w: 28, h: 26 },
];

export type ObstacleKind = 'S' | 'M' | 'L';

export const OBSTACLE_SIZES: Record<ObstacleKind, { w: number; h: number }> = {
  S: { w: 26, h: 24 },
  M: { w: 36, h: 33 },
  L: { w: 48, h: 44 },
};

/** Three stacked bands, as fractions of the obstacle's size, that follow its pile shape. */
export const OBSTACLE_BANDS: readonly Box[] = [
  { x: 0.3, y: 0.08, w: 0.4, h: 0.26 },
  { x: 0.16, y: 0.34, w: 0.68, h: 0.28 },
  { x: 0.06, y: 0.62, w: 0.88, h: 0.38 },
];

const GROUP_SPACING = 2;

type Pattern = { kinds: ObstacleKind[]; minDifficulty: number; weight: number; width: number };

const PATTERNS: Pattern[] = (
  [
    [['S'], 0, 3],
    [['M'], 0, 3],
    [['L'], 0.05, 2],
    [['S', 'S'], 0.1, 2],
    [['S', 'M'], 0.2, 2],
    [['M', 'S'], 0.2, 2],
    [['M', 'L'], 0.35, 1.5],
    [['S', 'L', 'S'], 0.5, 1.5],
    [['M', 'M', 'M'], 0.65, 1],
  ] as [ObstacleKind[], number, number][]
).map(([kinds, minDifficulty, weight]) => ({
  kinds,
  minDifficulty,
  weight,
  width: kinds.reduce((sum, k) => sum + OBSTACLE_SIZES[k].w, 0) + GROUP_SPACING * (kinds.length - 1),
}));

export function speedAt(time: number): number {
  const fastSeconds = (SPEED_MID - SPEED_START) / RAMP_FAST;
  if (time < fastSeconds) return SPEED_START + RAMP_FAST * time;
  return Math.min(SPEED_MAX, SPEED_MID + RAMP_SLOW * (time - fastSeconds));
}

/** Score at which zone `zone` begins: 300, 900, 1800, 3000, … */
export function zoneStart(zone: number): number {
  return 150 * zone * (zone + 1);
}

export function zoneForScore(score: number): number {
  let zone = 0;
  while (zoneStart(zone + 1) <= score) zone += 1;
  return zone;
}

/** Seedable random numbers (mulberry32). */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** String to seed (FNV-1a). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export type Obstacle = {
  active: boolean;
  /** World x of the left edge; screen x is `x - sim.dist`. */
  x: number;
  kind: ObstacleKind;
};

export type SimEvent = 'jump' | 'land' | 'death' | 'zone';

const POOL_SIZE = 24;
const REST_Y = GROUND_Y - ROBOT_SIZE;

export class Sim {
  time = 0;
  /** Distance scrolled, in px. */
  dist = 0;
  prevDist = 0;
  speed = SPEED_START;
  score = 0;
  zone = 0;
  alive = true;

  robotY = REST_Y;
  prevRobotY = REST_Y;
  vy = 0;
  grounded = true;

  /** Fixed pool, so play never allocates. */
  readonly obstacles: Obstacle[] = Array.from({ length: POOL_SIZE }, () => ({ active: false, x: 0, kind: 'S' as ObstacleKind }));
  /** What happened this step, for sound and effects. The caller clears it. */
  readonly events: SimEvent[] = [];

  private rng = createRng(1);
  private held = false;
  private buffer = 0;
  private airTime = 0;
  private cut = false;
  private nextSpawnX = 0;

  constructor(seed = 1) {
    this.reset(seed);
  }

  reset(seed: number) {
    this.rng = createRng(seed);
    this.time = 0;
    this.dist = 0;
    this.prevDist = 0;
    this.speed = SPEED_START;
    this.score = 0;
    this.zone = 0;
    this.alive = true;
    this.robotY = REST_Y;
    this.prevRobotY = REST_Y;
    this.vy = 0;
    this.grounded = true;
    this.held = false;
    this.buffer = 0;
    this.airTime = 0;
    this.cut = false;
    this.events.length = 0;
    for (const o of this.obstacles) o.active = false;
    // A calm stretch before the first obstacle.
    this.nextSpawnX = VIEW_W + 500;
  }

  press() {
    this.held = true;
    this.buffer = JUMP_BUFFER;
  }

  release() {
    this.held = false;
  }

  /** 0 at the start of a run, 1 at top speed. */
  get difficulty(): number {
    return (this.speed - SPEED_START) / (SPEED_MAX - SPEED_START);
  }

  step(dt: number = STEP) {
    if (!this.alive) return;

    this.time += dt;
    this.speed = speedAt(this.time);
    this.prevDist = this.dist;
    this.dist += this.speed * dt;
    this.score += dt * SCORE_RATE * Math.pow(this.speed / SPEED_START, 1.5);

    this.stepRobot(dt);
    this.stepObstacles();

    const zone = zoneForScore(this.score);
    if (zone !== this.zone) {
      this.zone = zone;
      this.events.push('zone');
    }
  }

  private stepRobot(dt: number) {
    this.prevRobotY = this.robotY;
    if (this.buffer > 0) this.buffer -= dt;

    if (this.grounded && this.buffer > 0) {
      this.vy = JUMP_VELOCITY;
      this.grounded = false;
      this.buffer = 0;
      this.airTime = 0;
      this.cut = false;
      this.events.push('jump');
    }

    if (this.grounded) return;

    this.airTime += dt;
    if (!this.cut && !this.held && this.vy < 0 && this.airTime >= MIN_HOLD) {
      this.vy *= JUMP_CUT;
      this.cut = true;
    }
    this.vy += GRAVITY * dt;
    this.robotY += this.vy * dt;

    if (this.robotY >= REST_Y) {
      this.robotY = REST_Y;
      this.vy = 0;
      this.grounded = true;
      this.events.push('land');
    }
  }

  private stepObstacles() {
    while (this.nextSpawnX - this.dist < VIEW_W + 60) this.spawnGroup();

    for (const o of this.obstacles) {
      if (!o.active) continue;
      const size = OBSTACLE_SIZES[o.kind];
      const screenX = o.x - this.dist;
      if (screenX + size.w < -20) {
        o.active = false;
        continue;
      }
      if (screenX > ROBOT_X + ROBOT_SIZE || screenX + size.w < ROBOT_X) continue;
      if (this.hits(screenX, size.w, size.h)) {
        this.alive = false;
        this.events.push('death');
        return;
      }
    }
  }

  private hits(screenX: number, w: number, h: number): boolean {
    const top = GROUND_Y - h;
    for (const band of OBSTACLE_BANDS) {
      const bx = screenX + band.x * w;
      const by = top + band.y * h;
      const bw = band.w * w;
      const bh = band.h * h;
      for (const r of ROBOT_BOXES) {
        if (overlaps(ROBOT_X + r.x, this.robotY + r.y, r.w, r.h, bx, by, bw, bh)) return true;
      }
    }
    return false;
  }

  private spawnGroup() {
    const d = this.difficulty;
    // Widest group a short hop can clear at this speed.
    const maxWidth = this.speed * SHORT_HOP_AIR - 70;

    let total = 0;
    for (const p of PATTERNS) if (p.minDifficulty <= d && p.width <= maxWidth) total += p.weight;
    let pick = this.rng() * total;
    let pattern = PATTERNS[0];
    for (const p of PATTERNS) {
      if (p.minDifficulty > d || p.width > maxWidth) continue;
      pattern = p;
      pick -= p.weight;
      if (pick <= 0) break;
    }

    let x = this.nextSpawnX;
    for (const kind of pattern.kinds) {
      const slot = this.obstacles.find((o) => !o.active);
      if (slot) {
        slot.active = true;
        slot.x = x;
        slot.kind = kind;
      }
      x += OBSTACLE_SIZES[kind].w + GROUP_SPACING;
    }

    const gapMax = GAP_MAX_EASY + (GAP_MAX_HARD - GAP_MAX_EASY) * d;
    const gapSeconds = GAP_MIN + this.rng() * (gapMax - GAP_MIN);
    this.nextSpawnX += pattern.width + this.speed * gapSeconds;
  }
}
