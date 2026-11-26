import { describe, expect, it } from 'vitest';
import { OBSTACLE_SIZES, ROBOT_X, STEP, Sim } from './sim';
import { encodeInput, replayRun } from './replay';

/** Plays like the engine does, jumping at whatever comes near, for `seconds`, then stops and dies. */
function play(seed: number, seconds: number) {
  const sim = new Sim(seed);
  const inputs: number[] = [];
  const quitAt = Math.round(seconds / STEP);
  let held = 0;
  for (let tick = 0; sim.alive; tick++) {
    const ahead = tick < quitAt && sim.obstacles.some((o) => {
      if (!o.active) return false;
      const x = o.x - sim.dist;
      return x + OBSTACLE_SIZES[o.kind].w > ROBOT_X + 20 && x < ROBOT_X + 60 + sim.speed * 0.14;
    });
    if (ahead && sim.grounded && held === 0) {
      inputs.push(encodeInput(tick, true));
      sim.press();
      held = 30 - (tick % 12);
    } else if (held > 0 && --held === 0) {
      inputs.push(encodeInput(tick, false));
      sim.release();
    }
    sim.step(STEP);
    sim.events.length = 0;
  }
  return { score: Math.floor(sim.score), seconds: sim.time, inputs };
}

describe('replay', () => {
  it('reproduces recorded runs exactly', () => {
    for (const [seed, seconds] of [[7, 20], [123456, 95], [2 ** 31 + 5, 240]]) {
      const run = play(seed, seconds);
      expect(run.score).toBeGreaterThan(0);
      expect(replayRun(seed, run.inputs)).toEqual({ score: run.score, seconds: run.seconds });
    }
  });

  it('gives a different result for a different seed or doctored inputs', () => {
    const run = play(99, 60);
    expect(replayRun(100, run.inputs)?.score).not.toBe(run.score);
    expect(replayRun(99, run.inputs.slice(0, 3))?.score).not.toBe(run.score);
  });

  it('rejects malformed input lists', () => {
    expect(replayRun(1, [10, 4])).toBeNull(); // out of order
    expect(replayRun(1, [-1])).toBeNull();
    expect(replayRun(1, [1.5])).toBeNull();
  });

  it('replays a long run quickly enough for a Worker', () => {
    const run = play(42, 25 * 60);
    const start = performance.now();
    replayRun(42, run.inputs);
    const ms = performance.now() - start;
    console.log(`replayed ${run.seconds.toFixed(0)} s of play (score ${run.score}) in ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(250);
  });
});
