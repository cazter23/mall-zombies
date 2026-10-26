// The horror layer (game/features/horror.js): from round 5 the mall darkens a little every round, flickering neon dies for good
// and lamps flicker out (and stay out); now and then the area you're in loses power to emergency red, then stutters back,
// never faster than 3 flashes a second. Comfort > Horror lighting off = none of it; Play again puts every light back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame, snapshot } from './helpers/headlessGame.js';
import { look } from '../src/config/look.js';

const neonsOf = (g) => Object.values(g.map.horror.neons);
const failedParts = (g) => neonsOf(g).reduce((n, neon) => n + neon.flickers.filter((p) => p.failed).length, 0);
const deadLamps = (g) => g.map.horror.lamps.filter((l) => l.intensity === 0).length;
const director = (g) => g.features.list.find((f) => f.feature.kind === 'horror').instance;

test('nothing before round 5; then darker every round, neon letters die for good and lamps flicker out', () => {
  const { g, tick } = headlessGame();
  tick(5);
  g.rounds.jumpTo(4);
  tick(200);
  assert.equal(g.map.horror.state.exposure, 1);
  assert.equal(failedParts(g), 0);
  assert.equal(deadLamps(g), 0);

  g.rounds.jumpTo(9);
  tick(1);
  const e9 = g.map.horror.state.exposure;
  assert.ok(e9 < 1 && e9 >= 1 - look.horror.darkness.max, `round 9 is darker (${e9})`);
  assert.ok(failedParts(g) > 0, 'some flickering neon has died');
  tick(Math.ceil(look.horror.lampDeaths.flickerSeconds * 60) + 5);
  const dead9 = deadLamps(g);
  assert.ok(dead9 >= 1, 'a lamp has gone out');
  assert.ok(dead9 <= Math.floor(g.map.horror.lamps.length * look.horror.lampDeaths.maxShare));

  g.rounds.jumpTo(30);
  tick(Math.ceil(look.horror.lampDeaths.flickerSeconds * 60) + 5);
  assert.equal(g.map.horror.state.exposure, 1 - look.horror.darkness.max, 'darkness is capped');
  assert.ok(deadLamps(g) >= dead9, 'dead lamps stay dead');
  assert.ok(deadLamps(g) <= Math.floor(g.map.horror.lamps.length * look.horror.lampDeaths.maxShare), 'never more than the cap');
});

test('a power cut darkens the area you are in (lamps, neon, emergency red), then stutters back under 3 flashes a second', () => {
  const saved = { ...look.horror.powerCuts };
  try {
    Object.assign(look.horror.powerCuts, { chance: 1, delay: [0.5, 0.5], seconds: [3, 3] });
    const { g, tick, standAt } = headlessGame();
    tick(5);
    g.debug.run('doors');
    standAt(0, 2); // the hallway
    g.rounds.jumpTo(7);
    let cut = null;
    for (let i = 0; i < 60 * 20 && !cut; i++) { tick(1); cut = g.map.horror.state.cut; }
    assert.ok(cut, 'the power went');
    assert.equal(cut.area, 'hallway');
    assert.deepEqual(cut.grades, ['front']);
    const hallwayLamps = g.map.horror.lamps.filter((l) => Math.abs(l.position.x) < 20 && l.position.z > -2 && l.position.z < 6 && l.position.y < 6);
    assert.ok(hallwayLamps.every((l) => l.intensity === 0), 'the hallway lamps are dark');
    assert.equal(g.map.horror.neons.hallway.power, 0, 'its neon is dark');
    assert.equal(g.map.horror.neons.foodCourt.power, 1, 'other areas keep their power');
    // Count flips while it stutters back: never more than 3 a second.
    let flips = 0;
    let last = g.map.horror.neons.hallway.power;
    let ticks = 0;
    while (g.map.horror.state.cut && ticks < 60 * 10) {
      tick(1);
      ticks++;
      const now = g.map.horror.neons.hallway.power;
      if (now !== last) flips++;
      last = now;
    }
    assert.equal(g.map.horror.state.cut, null, 'the power came back');
    assert.equal(g.map.horror.neons.hallway.power, 1);
    // A flash is an off + on pair = 2 flips, so 3 flashes a second is 6 flips a second (+1: the flip as the power returns).
    // (This used to count single flips, which only passed for some seeded random sequences; adding lamps reshuffles them.)
    assert.ok(flips <= Math.ceil(2 * 3 * look.horror.powerCuts.stutterSeconds) + 1, `${flips} flips in the stutter`);
  } finally { Object.assign(look.horror.powerCuts, saved); }
});

test('Horror lighting off puts everything back at once; Play again restores every light and equals a fresh game', () => {
  const { g, tick } = headlessGame();
  tick(5);
  g.rounds.jumpTo(14);
  tick(Math.ceil(look.horror.lampDeaths.flickerSeconds * 60) + 5);
  assert.ok(deadLamps(g) > 0 && failedParts(g) > 0);

  look.runtime.horror = false;
  try {
    tick(1);
    assert.equal(deadLamps(g), 0);
    assert.equal(failedParts(g), 0);
    assert.equal(g.map.horror.state.exposure, 1);
  } finally { look.runtime.horror = true; }
  tick(1);
  assert.ok(failedParts(g) > 0, 'back on: the round\'s damage returns');

  g.resetRun();
  assert.equal(deadLamps(g), 0);
  assert.equal(failedParts(g), 0);
  assert.equal(g.map.horror.state.exposure, 1);
  assert.equal(director(g).state.round, 0);
  const fresh = headlessGame();
  assert.deepEqual(snapshot(g), snapshot(fresh.g));
});
