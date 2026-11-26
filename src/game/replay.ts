// Recording and replaying runs. The browser records every press and release by simulation tick; the
// Worker replays them through the same Sim to get the score, so a posted score is one that really happened.
import { STEP, Sim, hashSeed } from './sim';

/** One input: the tick it happened before, doubled, plus 1 for a press or 0 for a release. */
export const encodeInput = (tick: number, press: boolean) => tick * 2 + (press ? 1 : 0);

/** The seed every player shares for one UTC date's daily run. */
export const dailySeed = (date: string) => hashSeed(`cortaku-daily-${date}`);

/** Longest run the Worker will replay: 30 minutes of play. */
export const MAX_TICKS = Math.round(30 * 60 / STEP);
export const MAX_INPUTS = 40_000;

export type Replay = { score: number; seconds: number };

/** Replays a run to its death. Null when the inputs are malformed or the robot never dies. */
export function replayRun(seed: number, inputs: readonly number[]): Replay | null {
  if (!Array.isArray(inputs) || inputs.length > MAX_INPUTS) return null;
  const sim = new Sim(seed);
  let next = 0;
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    while (next < inputs.length) {
      const input = inputs[next];
      if (!Number.isSafeInteger(input) || input < 0) return null;
      const at = Math.floor(input / 2);
      if (at < tick) return null; // out of order
      if (at > tick) break;
      if (input % 2) sim.press();
      else sim.release();
      next += 1;
    }
    sim.step(STEP);
    sim.events.length = 0;
    if (!sim.alive) return { score: Math.floor(sim.score), seconds: sim.time };
  }
  return null;
}
