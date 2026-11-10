// The fuel tank (weapons/fuel.js, used by weapon.js for a gun with `fuel`, the Leaf Blower): pure timing first, then a Weapon running on it.
// It refills by itself after you stop, running dry locks the trigger until it holds `restartAt` again, and nothing here reloads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFuel, tickFuel, resetFuel } from '../src/weapons/fuel.js';
import { Weapon } from '../src/weapons/weapon.js';

const dt = 1 / 60;
const cfg = { regenDelay: 0.5, regenPerSecond: 12, restartAt: 6 };

test('tickFuel: nothing refills while pulses go off or during the delay, then it refills at its rate, never past the capacity', () => {
  const state = createFuel();
  assert.equal(tickFuel(state, cfg, dt, { fired: true, level: 10, capacity: 40 }), 0, 'a pulse this tick: no refill');
  let level = 10, gained = 0;
  for (let t = 0; t < 0.49; t += dt) gained += tickFuel(state, cfg, dt, { fired: false, level, capacity: 40 });
  assert.equal(gained, 0, 'the delay');
  for (let t = 0; t < 1; t += dt) { const add = tickFuel(state, cfg, dt, { fired: false, level, capacity: 40 }); level += add; gained += add; }
  assert.ok(gained >= 11 && gained <= 12, `about 12 units in the next second (${gained})`);
  for (let t = 0; t < 3; t += dt) level += tickFuel(state, cfg, dt, { fired: false, level, capacity: 40 });
  assert.equal(level, 40, 'a full tank stops there');
  assert.equal(tickFuel(state, cfg, dt, { fired: false, level, capacity: 40 }), 0);
});

test('tickFuel: running dry locks it until the tank holds restartAt; a pulse restarts the delay', () => {
  const state = createFuel();
  tickFuel(state, cfg, dt, { fired: true, level: 0, capacity: 40 });
  assert.equal(state.locked, true, 'empty: locked');
  let level = 0;
  for (let t = 0; t < 0.5; t += dt) level += tickFuel(state, cfg, dt, { fired: false, level, capacity: 40 });
  assert.equal(state.locked, true, 'still locked inside the delay');
  while (level < cfg.restartAt - 1) level += tickFuel(state, cfg, dt, { fired: false, level, capacity: 40 });
  assert.equal(state.locked, true, 'locked below restartAt');
  while (level < cfg.restartAt) level += tickFuel(state, cfg, dt, { fired: false, level, capacity: 40 });
  assert.equal(state.locked, false, 'unlocked at restartAt');
  tickFuel(state, cfg, dt, { fired: true, level, capacity: 40 });
  assert.equal(state.sinceFire, 0);
  resetFuel(state);
  assert.deepEqual(state, { sinceFire: Infinity, carry: 0, locked: false });
});

// A bare gun entry: just what Weapon reads.
const def = { id: 'blower', fireMode: 'auto', magazineSize: 20, startingReserve: 0, fireInterval: 0.15, fireBuffer: 0.1, reloadTime: 1, fuel: cfg };
const stats = { reloadSpeed: 1 };
const hold = (weapon, seconds, held = true) => {
  const results = [];
  for (let t = 0; t < seconds; t += dt) results.push(weapon.update(dt, { triggerPressed: false, triggerHeld: held, reloadPressed: false }));
  return results;
};

const burnDry = (weapon) => { while (weapon.magazine > 0) weapon.update(dt, { triggerPressed: false, triggerHeld: true, reloadPressed: false }); };

test('a Weapon with a tank: holding the trigger pulses every fireInterval and burns one unit each; there is no reload', () => {
  const weapon = new Weapon(def, stats);
  assert.equal(weapon.magazine, 20);
  const pulses = hold(weapon, 1).filter((r) => r === 'fire').length;
  assert.ok(pulses >= 6 && pulses <= 7, `about 1 / 0.15 pulses in a second (${pulses})`);
  assert.equal(weapon.magazine, 20 - pulses);
  weapon.update(dt, { triggerPressed: false, triggerHeld: false, reloadPressed: true });
  assert.equal(weapon.isReloading, false, 'a reload press does nothing');
  assert.equal(weapon.canReload, false);
});

test('a Weapon with a tank: it refills by itself once you let go; run dry it clicks once per press and stays locked until it holds restartAt', () => {
  const weapon = new Weapon(def, stats);
  burnDry(weapon);
  weapon.update(dt, { triggerPressed: false, triggerHeld: true, reloadPressed: false }); // (the tick it notices)
  assert.equal(weapon.magazine, 0);
  assert.equal(weapon.fuel.locked, true);
  assert.equal(hold(weapon, 0.4).filter((r) => r === 'fire').length, 0, 'a held dry trigger fires nothing');
  assert.equal(weapon.update(dt, { triggerPressed: true, triggerHeld: true, reloadPressed: false }), 'empty', 'a fresh press clicks');
  hold(weapon, 0.3, false); // let go: the delay passes, the refill starts
  assert.ok(weapon.magazine > 0 && weapon.magazine < cfg.restartAt, `refilling (${weapon.magazine})`);
  assert.equal(weapon.update(dt, { triggerPressed: true, triggerHeld: true, reloadPressed: false }), 'empty', 'still locked below restartAt');
  hold(weapon, 0.6, false);
  assert.equal(weapon.fuel.locked, false);
  assert.ok(hold(weapon, 0.5).includes('fire'), 'fires again');
  hold(weapon, 6, false);
  assert.equal(weapon.magazine, 20, 'and refills all the way');
});

test('a Weapon with a tank: a refill (RESTOCK-O-MATIC) and a new run fill it and unlock it; blocked (a melee swing) fires nothing but still refills', () => {
  const weapon = new Weapon(def, stats);
  burnDry(weapon);
  weapon.update(dt, { triggerPressed: false, triggerHeld: true, reloadPressed: false });
  assert.equal(weapon.fuel.locked, true);
  weapon.refill();
  assert.deepEqual([weapon.magazine, weapon.fuel.locked], [20, false]);
  hold(weapon, 1);
  const level = weapon.magazine;
  const blocked = [];
  for (let t = 0; t < 2; t += dt) blocked.push(weapon.update(dt, { triggerPressed: false, triggerHeld: true, reloadPressed: false, blocked: true }));
  assert.ok(blocked.every((r) => r === null));
  assert.ok(weapon.magazine > level, 'it refilled while the trigger was blocked');
  burnDry(weapon);
  weapon.reset();
  assert.deepEqual([weapon.magazine, weapon.fuel.locked, weapon.cooldown], [20, false, 0]);
});

test('a gun without a tank is untouched: the normal magazine and reload still work', () => {
  const plain = { ...def, fuel: undefined, startingReserve: 40 };
  const weapon = new Weapon(plain, stats);
  const fired = hold(weapon, 1).filter((r) => r === 'fire').length;
  assert.ok(fired >= 6);
  assert.equal(weapon.magazine, 20 - fired, 'no refill without a tank');
  assert.equal(weapon.canReload, true);
});
