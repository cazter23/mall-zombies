import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { workshopBuilds, workshopModOf } from '../src/config/workshop.js';
import { weapons } from '../src/config/weapons.js';
import { withTier, withAttachment } from '../src/weapons/upgrades.js';

function fixture(weapon) {
  const scene = new THREE.Scene();
  const t = headlessGame({ scene }), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;
  g.gun.give(weapon);
  t.tick(50);
  assert.equal(g.gun.def.id, weapon.id);
  return { ...t, scene };
}

test('a Limited Edition keeps a gun\'s other upgrades, stays through an ammo buy, and goes with the run', () => {
  const { g, tick } = fixture(weapons.priceGun);
  const id = g.gun.def.id;
  const tier = withTier(weapons.priceGun, [], 'deluxe');
  const oldMods = withAttachment(weapons.priceGun, tier, 'jumboPack');
  g.gun.setMods(id, oldMods);
  const { drops } = g.features.list.find(f => f.feature.kind === 'workshop').instance;
  drops.debugDrop('clearanceRack', g.player.position);
  tick(2);
  assert.deepEqual(g.gun.modsFor(id).slice(0, -1), oldMods);
  assert.equal(workshopModOf(g.gun.modsFor(id)), 'clearanceRack');
  g.gun.give(weapons.priceGun);
  assert.equal(workshopModOf(g.gun.modsFor(id)), 'clearanceRack');
  g.resetRun();
  assert.equal(g.gun.modsFor(id), null);
  g.map.dispose();
});

test('Clearance Rack tags different zombies, caps at three, and pays secondary kills once on a marked headshot', () => {
  const t = fixture(weapons.priceGun), { g } = t;
  g.gun.setMods('priceGun', [{ id: 'workshop', workshop: 'clearanceRack' }]);
  const group = [-2.3, -.75, .75, 2.3].map(x => {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(x, 0, 10));
    zombie.setState('chasing'); zombie.speed = 0; zombie.health = 1000;
    return zombie;
  });
  const shoot = (z, part) => {
    t.standAt(z.position.x, 12.5);
    const point = z.hitboxes.find(h => h.part === part).box.getCenter(new THREE.Vector3());
    g.player.pitch = Math.atan2(point.y - g.player.eyeHeight, 12.5 - point.z);
    t.input.held.add('Mouse2'); t.tick(25);
    t.press('Mouse0'); t.tick(10);
  };
  const tagged = z => z.model.root.getObjectByName('clearanceSticker') !== undefined;
  for (const z of group) shoot(z, 'body');
  assert.deepEqual(group.map(tagged), [false, true, true, true]);
  assert.equal(g.gun.weapon.clearanceTagCount, 3);
  shoot(group[0], 'head');
  assert.equal(g.gun.weapon.clearanceTagCount, 3, 'an unmarked headshot does not spend tags');
  group[1].health = 1; // even a lethal triggering headshot redeems the other tags
  group[2].health = g.gun.def.damage * 2;
  const before = group[3].health, kills = g.runStats.kills, shots = g.runStats.shotsFired;
  shoot(group[1], 'head');
  assert.equal(group[1].killedBy, 'gun');
  assert.equal(group[2].killedBy, 'clearanceRack');
  assert.equal(group[3].health, before - g.gun.def.damage * workshopBuilds.clearanceRack.damageMultiplier);
  assert.equal(g.runStats.kills - kills, 2);
  assert.equal(g.runStats.shotsFired - shots, 1);
  assert.equal(g.gun.weapon.clearanceTagCount, 0);
  assert.ok(group.every(z => !tagged(z)));
  shoot(group[3], 'body');
  assert.equal(g.gun.weapon.clearanceTagCount, 1);
  g.resetRun();
  assert.equal(tagged(group[3]), false, 'Play Again removes the remaining sticker');
  g.map.dispose();
});

test('Party Trap spends one shell, arms before damage, pays a kill once and cleans up on reset', () => {
  const t = fixture(weapons.confettiCannon), { g, scene } = t;
  g.gun.setMods('confettiCannon', [{ id: 'workshop', workshop: 'partyTrap' }]);
  t.standAt(0, 12, 0, -.8);
  t.input.held.add('Mouse2');
  t.tick(35);
  let placement;
  g.events.on('shot', shot => { placement = shot.workshopPlacement; });
  const ammo = g.gun.weapon.magazine;
  t.press('Mouse0');
  assert.equal(g.gun.weapon.magazine, ammo - 1);
  assert.ok(placement, 'real aimed floor shot planted a trap');
  const target = g.zombies.spawn('shopper', placement);
  target.setState('chasing'); target.speed = 0;
  const before = g.wallet.points;
  t.tick(10);
  assert.ok(target.isAlive, 'trap has not armed yet');
  t.tick(30);
  assert.equal(target.isAlive, false);
  assert.equal(target.killedBy, 'partyTrap');
  assert.ok(g.wallet.points > before);
  const particles = g.effects.counts.particles;
  g.zombies.render(0, 1);
  assert.ok(target.model.root.rotation.x > 0, 'ribbon yanks the body into a backward fall');
  assert.ok(scene.getObjectByName('partyTrapRibbon'), 'ribbon connects the trap to its victim');
  t.tick(26);
  assert.ok(!g.zombies.zombies.includes(target), 'pop removes the body instead of leaving a corpse');
  assert.equal(g.effects.counts.particles - particles, workshopBuilds.partyTrap.pop.count);
  assert.ok(scene.getObjectByName('partyTrapRibbon'), 'ribbon hangs in the air after the pop');
  assert.ok(t.sounds.includes('partySnap'));

  const paid = g.wallet.points;
  t.tick(15);
  assert.equal(g.wallet.points, paid);
  g.resetRun();
  assert.equal(g.gun.modsFor('confettiCannon'), null);
  assert.equal(scene.getObjectByName('partyTrapRibbon'), undefined);
  g.map.dispose();
});

test('Party Trap keeps the two newest charges, respects walls and floors, and removes live charges on reset', () => {
  const { g, scene, tick } = fixture(weapons.confettiCannon);
  const point = new THREE.Vector3(0, 0, 10);
  for (const x of [-3, -2, 0]) g.events.emit('shot', { workshopPlacement: point.clone().setX(x) });
  const charges = () => scene.children.filter(o => o.name === 'partyTrap');
  assert.deepEqual(charges().map(o => o.position.x), [-2, 0]);
  const wall = new THREE.Box3(new THREE.Vector3(.25, 0, 9), new THREE.Vector3(.35, 2, 11));
  g.colliders.push(wall);
  function spawn(x, y = 0) {
    const z = g.zombies.spawn('shopper', point.clone().setX(x));
    z.setState('chasing'); z.speed = 0; z.position.y = y;
    return z;
  }
  const shielded = spawn(.65), upstairs = spawn(.1, 6.3), exposed = spawn(-.2);
  // Advance workshop logic in isolation so the other-floor fixture stays upstairs.
  const workshop = g.features.list.find(f => f.feature.kind === 'workshop').instance;
  workshop.update(workshopBuilds.partyTrap.armSeconds);
  assert.equal(exposed.isAlive, false);
  assert.equal(shielded.isAlive, true);
  assert.equal(upstairs.isAlive, true);
  assert.equal(charges().length, 1);
  g.resetRun(); tick();
  assert.equal(charges().length, 0);
  g.map.dispose();
});
