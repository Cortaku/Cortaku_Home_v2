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

export type Replay = {
  score: number;
  seconds: number;
  /**
   * The inputs that made a difference, in order: those before the death, one press and/or release per tick, and
   * no releases while nothing was held.
   * Two recordings of the same run give the same list, so the Worker can tell a run that is posted twice.
   */
  played: number[];
};

/** Replays a run to its death. Null when the inputs are malformed or the robot never dies. */
export function replayRun(seed: number, inputs: readonly number[]): Replay | null {
  if (!Array.isArray(inputs) || inputs.length > MAX_INPUTS) return null;
  const sim = new Sim(seed);
  const played: number[] = [];
  let held: boolean = false;
  let next = 0;
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    // Several inputs on one tick come down to one effect: whether a press armed a jump, and whether the
    // button ended up held. `played` records just that, so padding a tick with extra inputs changes nothing.
    let any = false;
    let pressed = false;
    let last: boolean = held;
    while (next < inputs.length) {
      const input = inputs[next];
      if (!Number.isSafeInteger(input) || input < 0) return null;
      const at = Math.floor(input / 2);
      if (at < tick) return null; // out of order
      if (at > tick) break;
      last = input % 2 === 1;
      if (last) sim.press();
      else sim.release();
      any = true;
      pressed ||= last;
      next += 1;
    }
    if (any) {
      if (pressed) played.push(encodeInput(tick, true));
      // A release counts only if something was held: before this tick, or by a press on it.
      if (!last && (pressed || held)) played.push(encodeInput(tick, false));
      held = last;
    }
    sim.step(STEP);
    sim.events.length = 0;
    if (!sim.alive) return { score: Math.floor(sim.score), seconds: sim.time, played };
  }
  return null;
}
