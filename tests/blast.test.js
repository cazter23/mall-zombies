// The blast (weapons/blast.js, the Bottle Rocket Bazooka's explosion) alone, on made-up numbers and fake targets: the falloff, who is caught (zombies in the
// radius and in sight, nearest first; never Sunny or a corpse; a wall shields), what your own blast does to you (capped below a one-shot, none behind a
// wall or in the blast-proof item), and the blast's damage in weapons/gunStats.js hitDamage. The gun's own test runs it in the real game.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { blastFalloff, findInBlast, selfBlastDamage } from '../src/weapons/blast.js';
import { hitDamage } from '../src/weapons/gunStats.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const blast = { radius: 4, edgeFraction: 0.25, self: { share: 0.5, maxShare: 0.8 } };
// A zombie standing at (x, z): a body box and a head box.
const zombie = (x, z, extra = {}) => ({
  isAlive: true, type: { id: 'shopper' },
  hitboxes: [{ part: 'body', box: new THREE.Box3(v(x - 0.3, 0, z - 0.3), v(x + 0.3, 1.4, z + 0.3)) }, { part: 'head', box: new THREE.Box3(v(x - 0.2, 1.4, z - 0.2), v(x + 0.2, 1.8, z + 0.2)) }],
  ...extra,
});
const wall = (x0, z0, x1, z1) => new THREE.Box3(v(x0, 0, z0), v(x1, 3, z1));

test('the falloff: 1 at the centre, edgeFraction at the edge, a straight line between, nothing past the radius', () => {
  assert.equal(blastFalloff(0, blast), 1);
  assert.equal(blastFalloff(4, blast), 0.25);
  assert.ok(Math.abs(blastFalloff(2, blast) - 0.625) < 1e-12);
  assert.equal(blastFalloff(4.01, blast), 0);
  assert.equal(blastFalloff(Infinity, blast), 0);
  assert.equal(blastFalloff(NaN, blast), 0);
});

test('who is caught: live zombies whose nearest hitbox point is in the radius, nearest first; never Sunny (noRewards), a dummy (no type) or a corpse', () => {
  const near = zombie(1, 0), far = zombie(4.2, 0), out = zombie(5, 0); // `far`: its body's near face is 3.9 m off (inside); `out`: 4.7 m (outside)
  const sunny = zombie(0.5, 1, { noRewards: true }), dummy = { ...zombie(0, 1.5), type: null }, dead = zombie(-1, 0, { isAlive: false });
  const found = findInBlast(v(0, 0.5, 0), blast, [], [out, far, sunny, near, dummy, dead]);
  assert.deepEqual(found.map((f) => f.target), [near, far]);
  assert.ok(Math.abs(found[0].distance - 0.7) < 1e-9 && Math.abs(found[1].distance - 3.9) < 1e-9);
});

test('a wall between the blast and a zombie shields it; one standing beside the same wall, in sight, is caught', () => {
  const shielded = zombie(2.5, 0), beside = zombie(0, 2.5);
  const colliders = [wall(1.2, -1, 1.4, 1)]; // a wall between the centre and +x
  const found = findInBlast(v(0, 0.5, 0), blast, colliders, [shielded, beside]);
  assert.deepEqual(found.map((f) => f.target), [beside]);
});

test('your own blast: half your health at its centre, less further out, nothing past the radius or behind a wall, and never more than maxShare', () => {
  const me = { eye: v(0, 1.6, 0), feetY: 0 };
  assert.equal(selfBlastDamage(me, v(0, 0.1, 0), blast, [], 100), 50, 'at your feet: measured from your feet, the centre');
  assert.ok(Math.abs(selfBlastDamage(me, v(2, 0.8, 0), blast, [], 100) - 50 * 0.625) < 1e-9, '2 m from your side');
  assert.equal(selfBlastDamage(me, v(4.5, 1, 0), blast, [], 100), 0, 'past the radius');
  assert.equal(selfBlastDamage(me, v(2.5, 1, 0), blast, [wall(1.2, -1, 1.4, 1)], 100), 0, 'behind a wall');
  const fierce = { ...blast, self: { share: 2, maxShare: 0.8 } };
  assert.equal(selfBlastDamage(me, v(0, 0.1, 0), fierce, [], 100), 80, 'capped: it can never kill you from full health');
  assert.equal(selfBlastDamage(me, v(0, 0.1, 0), blast, [], 100, 0), 0, 'the blast-proof item (multiplier 0)');
  assert.equal(selfBlastDamage(me, v(0, 0.1, 0), blast, [], 100, 0.5), 25);
  const scratch = { ...blast, self: { ...blast.self, ignoreBelow: 1 } };
  assert.equal(selfBlastDamage(me, v(0, 0.1, 0), scratch, [], 100, 0.01), 0, 'the Hi-Vis Vest: half a point is no hit at all');
  assert.equal(selfBlastDamage(me, v(0, 0.1, 0), scratch, [], 100), 50, 'and without it, the same blast bites');
  assert.equal(selfBlastDamage(me, v(0, 0.1, 0), { radius: 4, edgeFraction: 0.25 }, [], 100), 0, 'a blast without `self` never hurts you');
});

test('hitDamage of a blast: damage x the blast falloff x the damage stat; no headshot, no range falloff; a non-blast hit is unchanged', () => {
  const def = { damage: 800, headshotMultiplier: 3, falloff: { start: 1, end: 2, minMultiplier: 0.1 }, blast };
  const stats = { damageMultiplier: 1.5 };
  assert.equal(hitDamage(def, { part: 'body', blastDistance: 0 }, 0, stats), 1200);
  assert.equal(hitDamage(def, { part: 'head', blastDistance: 4 }, 0, stats), 800 * 0.25 * 1.5);
  assert.equal(hitDamage(def, { part: 'body', blastDistance: 9 }, 0, stats), 0);
  assert.equal(hitDamage(def, { part: 'head', distance: 1 }, 0, { damageMultiplier: 1 }), 2400, 'without blastDistance it is an ordinary hit');
});
