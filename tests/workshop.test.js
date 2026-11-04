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

test('Promenade work order is gated by the zone, charges the live price and preserves existing upgrades', () => {
  const { g, tick, press } = fixture(weapons.priceGun);
  const bench = g.map.features.find(f => f.kind === 'workshop');
  const position = bench.position.clone();
  position.y = g.map.navigation.floors[1];
  position.z -= 1.1;
  g.player.teleport({ position, yaw: Math.PI });
  tick();
  assert.notEqual(g.interactions.prompt?.kind, 'workshop');
  g.map.areaUnlocks.openAll();
  tick(120);
  g.wallet.earn(5000);
  const id = g.gun.def.id;
  const tier = withTier(weapons.priceGun, [], 'deluxe');
  const oldMods = withAttachment(weapons.priceGun, tier, 'jumboPack');
  g.gun.setMods(id, oldMods);
  g.pricing.setDiscount('workshop', .25);
  tick();
  assert.equal(g.interactions.prompt?.id, 'skateFeed');
  const cost = g.interactions.prompt.cost;
  const before = g.wallet.points;
  let receipt;
  g.events.on('purchase', p => { receipt = p; });
  press('KeyF', 30);
  assert.equal(g.wallet.points, before - cost);
  assert.match(receipt.label, /Skate Feed installed.*reserve/);
  assert.deepEqual(g.gun.modsFor(id).slice(0, -1), oldMods);
  assert.equal(workshopModOf(g.gun.modsFor(id)), 'skateFeed');
  g.gun.give(weapons.priceGun);
  assert.equal(workshopModOf(g.gun.modsFor(id)), 'skateFeed');
  tick();
  assert.notEqual(g.interactions.prompt?.kind, 'workshop');
  g.resetRun();
  assert.equal(g.gun.modsFor(id), null);
  g.map.dispose();
});

test('Skate Feed transfers reserve ammo once at the start of a real slide and respects cooldown', () => {
  const t = fixture(weapons.priceGun), { g } = t;
  g.gun.setMods('priceGun', [{ id: 'workshop', workshop: 'skateFeed' }]);
  const weapon = g.gun.weapon;
  weapon.magazine = 8; weapon.reserve = 30;
  t.standAt(0, 13);
  t.input.held.add('KeyW'); t.input.held.add('ShiftLeft'); t.tick(12);
  t.press('KeyC', 1);
  assert.equal(g.player.stance, 'slide');
  assert.equal(weapon.magazine, 8 + workshopBuilds.skateFeed.rounds);
  assert.equal(weapon.magazine + weapon.reserve, 38);
  t.tick(5);
  assert.equal(weapon.magazine, 14);
  // Re-enter a slide while the feed is still on cooldown.
  t.input.held.clear();
  t.standAt(0, 13);
  t.input.held.add('KeyW'); t.input.held.add('ShiftLeft'); t.tick(12); t.press('KeyC');
  assert.equal(g.player.stance, 'slide');
  assert.equal(weapon.magazine, 14);
  g.map.dispose();
});

test('Party Trap spends one shell, arms before damage, pays a kill once and cleans up on reset', () => {
  const t = fixture(weapons.confettiCannon), { g } = t;
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
  assert.ok(target.model.root.scale.x > 1, 'body balloons during the trap death wind-up');
  t.tick(15);
  assert.ok(!g.zombies.zombies.includes(target), 'pop removes the body instead of leaving a corpse');
  assert.equal(g.effects.counts.particles - particles, workshopBuilds.partyTrap.pop.count);

  const paid = g.wallet.points;
  t.tick(15);
  assert.equal(g.wallet.points, paid);
  g.resetRun();
  assert.equal(g.gun.modsFor('confettiCannon'), null);
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
