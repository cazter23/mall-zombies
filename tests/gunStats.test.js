// weapons/gunStats.js: the per-hit damage formula and resolveGun (upgrades as data: Build-A-Blaster etc.).
import test from 'node:test';
import assert from 'node:assert/strict';
import { damageFalloff, hitDamage, resolveGun } from '../src/weapons/gunStats.js';
import { weapons } from '../src/config/weapons.js';

const stats = (damageMultiplier = 1) => ({ damageMultiplier });

test('damageFalloff: full to start, a straight line to minMultiplier at end, flat after; none = 1', () => {
  const f = { start: 10, end: 30, minMultiplier: 0.6 };
  assert.equal(damageFalloff(5, f), 1);
  assert.equal(damageFalloff(10, f), 1);
  assert.ok(Math.abs(damageFalloff(20, f) - 0.8) < 1e-12);
  assert.equal(damageFalloff(30, f), 0.6);
  assert.equal(damageFalloff(500, f), 0.6);
  assert.equal(damageFalloff(500, undefined), 1);
});

test('hitDamage = damage x headshot x falloff x pierce (by zombie index) x player multiplier', () => {
  const gun = { damage: 40, headshotMultiplier: 3, falloff: { start: 10, end: 30, minMultiplier: 0.5 },
    pierce: { maxTargets: 3, damageFalloff: [1, 0.8, 0.6] } };
  assert.equal(hitDamage(gun, { part: 'body', distance: 5 }, 0, stats()), 40);
  assert.equal(hitDamage(gun, { part: 'head', distance: 5 }, 0, stats()), 120);
  assert.equal(hitDamage(gun, { part: 'body', distance: 30 }, 0, stats()), 20);
  assert.equal(hitDamage(gun, { part: 'body', distance: 5 }, 1, stats()), 32);
  assert.equal(hitDamage(gun, { part: 'body', distance: 5 }, 9, stats()), 24, 'past the list = its last entry');
  assert.equal(hitDamage(gun, { part: 'head', distance: 30 }, 2, stats(2)), 40 * 3 * 0.5 * 0.6 * 2);
  assert.equal(hitDamage({ damage: 30, headshotMultiplier: 3 }, { part: 'body', distance: 999 }, 0, stats()), 30, 'no falloff, no pierce');
});

test('resolveGun: no mods = an equal copy; the config entry is never touched', () => {
  const base = weapons.priceGun;
  const before = structuredClone(base);
  const gun = resolveGun(base, [{ id: 'x', modifiers: [{ stat: 'damage', op: 'mul', value: 2 }, { stat: 'falloff.start', op: 'add', value: 5 }] }]);
  assert.deepEqual(base, before, 'base unchanged (deep)');
  assert.equal(gun.damage, base.damage * 2);
  assert.equal(gun.falloff.start, base.falloff.start + 5);
  assert.notEqual(gun.falloff, base.falloff, 'nested objects are copies too');
  const plain = resolveGun(base);
  assert.equal(plain.damage, base.damage); assert.equal(plain.id, base.id); assert.equal(plain.base, base); assert.deepEqual(plain.mods, []);
});

test('resolveGun: set first, then every add, then every mul, whatever order the mods came in', () => {
  const base = { id: 'g', damage: 10, magazineSize: 10 };
  const mulMod = { id: 'double', modifiers: [{ stat: 'damage', op: 'mul', value: 2 }] };
  const addMod = { id: 'plus5', modifiers: [{ stat: 'damage', op: 'add', value: 5 }] };
  const setMod = { id: 'reset', modifiers: [{ stat: 'damage', op: 'set', value: 20 }] };
  for (const order of [[mulMod, addMod, setMod], [setMod, addMod, mulMod], [addMod, setMod, mulMod]]) {
    assert.equal(resolveGun(base, order).damage, (20 + 5) * 2, order.map((m) => m.id).join(','));
  }
  const twoAdds = resolveGun(base, [addMod, addMod, mulMod, mulMod]);
  assert.equal(twoAdds.damage, (10 + 5 + 5) * 2 * 2, 'adds stack additively, multipliers multiply');
  assert.deepEqual(twoAdds.mods, ['plus5', 'plus5', 'double', 'double']);
});

test('resolveGun: a mod can give a gun something it lacked (set), e.g. pierce or falloff', () => {
  const gun = resolveGun(weapons.stapleGun, [{ id: 'piercingStaples', modifiers: [
    { stat: 'pierce', op: 'set', value: { maxTargets: 2, damageFalloff: [1, 0.5] } },
  ] }]);
  assert.deepEqual(gun.pierce, { maxTargets: 2, damageFalloff: [1, 0.5] });
  assert.equal(weapons.stapleGun.pierce, undefined);
});

test('resolveGun: mistakes are errors, not silent no-ops', () => {
  const g = weapons.stapleGun;
  assert.throws(() => resolveGun(g, [{ id: 'typo', modifiers: [{ stat: 'damge', op: 'add', value: 1 }] }]), /not a number/);
  assert.throws(() => resolveGun(g, [{ id: 'deep', modifiers: [{ stat: 'pellets.count', op: 'add', value: 1 }] }]), /has no stat "pellets.count"/);
  assert.throws(() => resolveGun(g, [{ id: 'op', modifiers: [{ stat: 'damage', op: 'pow', value: 2 }] }]), /unknown op/);
  assert.throws(() => resolveGun(g, [{ id: 'obj', modifiers: [{ stat: 'spread', op: 'mul', value: 2 }] }]), /not a number/);
});
