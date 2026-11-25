import { describe, expect, it } from 'vitest';
import { GROUND_Y, OBSTACLE_SIZES, ROBOT_SIZE, ROBOT_X, STEP, Sim, hashSeed, speedAt, zoneForScore, zoneStart } from './sim';

/** Left edge (screen x) and total width of the nearest obstacle group still ahead of the robot's tail. */
function nextGroup(sim: Sim) {
  const ahead = sim.obstacles
    .filter((o) => o.active && o.x - sim.dist + OBSTACLE_SIZES[o.kind].w > ROBOT_X + 20)
    .sort((a, b) => a.x - b.x);
  if (ahead.length === 0) return null;
  let right = ahead[0].x + OBSTACLE_SIZES[ahead[0].kind].w;
  for (const o of ahead.slice(1)) {
    if (o.x - right > 10) break;
    right = o.x + OBSTACLE_SIZES[o.kind].w;
  }
  return { left: ahead[0].x - sim.dist, width: right - ahead[0].x };
}

/** A simple player: full jumps, timed so the top of the arc sits over the middle of the group. */
function runBot(seed: number, seconds: number) {
  const sim = new Sim(seed);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps && sim.alive; i++) {
    sim.events.length = 0;
    const group = nextGroup(sim);
    if (group && sim.grounded) {
      const robotCentre = ROBOT_X + ROBOT_SIZE / 2;
      const groupCentre = group.left + group.width / 2;
      const halfJump = sim.speed * 0.25; // a full jump lasts 0.5 s
      if (groupCentre - robotCentre <= halfJump) sim.press();
    }
    sim.step();
  }
  return sim;
}

describe('speed and zones', () => {
  it('starts at 300 px/s, never slows down and tops out at 1080', () => {
    expect(speedAt(0)).toBe(300);
    let last = 0;
    for (let t = 0; t < 200; t += 0.5) {
      expect(speedAt(t)).toBeGreaterThanOrEqual(last);
      last = speedAt(t);
    }
    expect(speedAt(1000)).toBe(1080);
  });

  it('maps scores to zones at 300, 900, 1800…', () => {
    expect([zoneStart(1), zoneStart(2), zoneStart(3)]).toEqual([300, 900, 1800]);
    expect(zoneForScore(0)).toBe(0);
    expect(zoneForScore(299.9)).toBe(0);
    expect(zoneForScore(300)).toBe(1);
    expect(zoneForScore(1799)).toBe(2);
  });
});

describe('jumping', () => {
  it('a held jump peaks about 112 px up and lasts half a second', () => {
    const sim = new Sim(1);
    sim.press();
    let peak = 0;
    let steps = 0;
    do {
      sim.step();
      steps += 1;
      peak = Math.max(peak, GROUND_Y - ROBOT_SIZE - sim.robotY);
    } while (!sim.grounded);
    expect(peak).toBeGreaterThan(108);
    expect(peak).toBeLessThan(116);
    expect(steps * STEP).toBeCloseTo(0.5, 1);
  });

  it('a quick tap gives a lower hop that still clears the tallest obstacle', () => {
    const sim = new Sim(1);
    sim.press();
    sim.step();
    sim.release();
    let peak = 0;
    do {
      sim.step();
      peak = Math.max(peak, GROUND_Y - ROBOT_SIZE - sim.robotY);
    } while (!sim.grounded);
    expect(peak).toBeLessThan(95);
    expect(peak).toBeGreaterThan(OBSTACLE_SIZES.L.h + 20);
  });

  it('remembers a press made just before landing', () => {
    const sim = new Sim(1);
    sim.press();
    sim.release();
    let jumps = 0;
    let pressedEarly = false;
    for (let i = 0; i < 200; i++) {
      sim.events.length = 0;
      // Press again just before touching down.
      if (!pressedEarly && !sim.grounded && sim.vy > 0 && GROUND_Y - ROBOT_SIZE - sim.robotY < 30) {
        sim.press();
        pressedEarly = true;
      }
      sim.step();
      if (sim.events.includes('jump')) jumps += 1;
    }
    expect(jumps).toBe(2);
  });
});

describe('course generation', () => {
  it('is identical for the same seed', () => {
    const a = runBot(hashSeed('cortaku-2026-11-24'), 45);
    const b = runBot(hashSeed('cortaku-2026-11-24'), 45);
    expect(a.score).toBe(b.score);
    expect(a.dist).toBe(b.dist);
    expect(a.obstacles).toEqual(b.obstacles);
  });

  it('differs between seeds', () => {
    const a = new Sim(1);
    const b = new Sim(2);
    for (let i = 0; i < 1200; i++) { a.step(); b.step(); }
    expect(a.obstacles).not.toEqual(b.obstacles);
  });

  it('kills a robot that never jumps', () => {
    const sim = new Sim(7);
    for (let i = 0; i < 120 * 20 && sim.alive; i++) sim.step();
    expect(sim.alive).toBe(false);
    expect(sim.time).toBeLessThan(8);
  });

  it('is always beatable: a simple bot survives three minutes on 150 different courses', () => {
    const deaths: string[] = [];
    for (let seed = 1; seed <= 150; seed++) {
      const sim = runBot(seed * 7919, 180);
      if (!sim.alive) deaths.push(`seed ${seed * 7919} at ${sim.time.toFixed(1)}s, speed ${sim.speed.toFixed(0)}`);
    }
    expect(deaths).toEqual([]);
  });
});
