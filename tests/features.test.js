// Map features (game/features/): everything in a map the player interacts with besides doors, as data
// (map.features) built by kind. A new kind = a module + one registry line; createGame never changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { buildFeatures, featuresOf, FEATURE_KINDS } from '../src/game/features/index.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';

test('the mall lists its wall buys and the ammo cache as features, each fully described', () => {
  const { g } = headlessGame();
  assert.deepEqual(FEATURE_KINDS, ['wallBuy', 'ammoCache']);
  assert.deepEqual(featuresOf(g.map, 'wallBuy').map((w) => w.weapon), ['priceGun', 'nailGun', 'foamDartBlaster', 'confettiCannon']);
  assert.equal(featuresOf(g.map, 'ammoCache').length, 1);
  for (const f of g.map.features) {
    assert.ok(f.kind && f.name && f.zone in g.map.zones && f.position?.isVector3 && f.normal?.isVector3, f.name);
  }
  assert.equal(g.features.list.length, g.map.features.length, 'every feature was built');
});

test('an unknown kind is an error naming the feature; a map without features is fine', () => {
  const map = { id: 'test', features: [{ kind: 'clawMachine', name: 'claw_1' }] };
  assert.throws(() => buildFeatures(map, {}), /claw_1.*unknown kind "clawMachine"/);
  assert.deepEqual(buildFeatures({ id: 'empty' }, {}).list, []);
});

test('a new kind plugs in with its own update/reset hooks (what hazards will use)', () => {
  const ticks = [];
  const kinds = {
    sprinkler: (feature, ctx) => ({
      update: (dt) => ticks.push([feature.name, dt, ctx.tag]),
      reset: () => ticks.push([feature.name, 'reset']),
    }),
  };
  const built = buildFeatures({ id: 'm', features: [{ kind: 'sprinkler', name: 'a' }, { kind: 'sprinkler', name: 'b' }] }, { tag: 'ctx' }, kinds);
  built.update(0.5);
  built.reset();
  assert.deepEqual(ticks, [['a', 0.5, 'ctx'], ['b', 0.5, 'ctx'], ['a', 'reset'], ['b', 'reset']]);
});

test('a wall buy for a gun that does not exist yet is inert (no prompt, nothing on the wall)', () => {
  const added = [];
  const scene = new THREE.Scene();
  buildFeatures(
    { id: 'm', zones: { a: { open: true } }, features: [{ kind: 'wallBuy', name: 'x', zone: 'a', weapon: 'rayGun', position: new THREE.Vector3(), normal: new THREE.Vector3(1, 0, 0) }] },
    { scene, map: { zones: { a: { open: true } } }, gun: {}, pricing: {}, interactions: { add: (item) => added.push(item) } },
  );
  assert.equal(added.length, 0);
  assert.equal(scene.children.length, 0);
});

test('the real game: buy the Price Gun off its wall, then refill it at the STAPLE-O-MAT', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.wallet.earn(5000);
  t.standAt(3.5, 10, -90); // facing the start room's east wall
  t.press('KeyF', 30);
  t.tick(40);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'priceGun']);
  assert.equal(g.gun.def.id, 'priceGun');
  for (const d of g.map.doors) d.open();
  t.tick(120);
  g.gun.weapon.magazine = 1;
  g.gun.weapon.reserve = 3;
  const before = g.wallet.points;
  const cache = featuresOf(g.map, 'ammoCache')[0];
  t.standAt(cache.position.x + 1.5, cache.position.z, 90); // facing the machine (west)
  t.press('KeyF', 30);
  assert.equal(g.gun.weapon.magazine, weapons.priceGun.magazineSize);
  assert.equal(before - g.wallet.points, economy.ammoCache.price);
});
