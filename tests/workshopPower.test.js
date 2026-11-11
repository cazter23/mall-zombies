// The Build-A-Blaster power rework: a finished build powers the gun up itself (more than an Extended Warranty tier), the stuffings and Hearts each
// have a job, and the looks that go with them (zombies/statusTint.js, fx flashes) are driven by the same state the gameplay reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { economy } from '../src/config/economy.js';
import { workshopRitual, workshopStuffings, workshopHearts, stuffingLook, buildOf } from '../src/config/workshop.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { buildModifiers, withTier } from '../src/weapons/upgrades.js';
import { statusGlow } from '../src/zombies/statusTint.js';

const Y = LAYOUT.hallway.height + .3;

function fixture({ gun = weapons.nailGun } = {}) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.map.areaUnlocks.openAll();
  g.health.invulnerable = true;
  g.gun.give(gun); t.tick(50);
  g.wallet.earn(50000);
  const ritual = g.features.list.find(f => f.feature.kind === 'workshop').instance.ritual;
  const bench = g.map.features.find(f => f.kind === 'workshop');
  /** Fit a finished build straight onto the gun in hand, the way a collected order does (modifiers and all). */
  const fit = (stuffing, heart, quality = 'regular') => {
    const id = g.gun.def.id;
    const q = workshopRitual.qualities.find(x => x.id === quality);
    g.gun.setMods(id, [...g.gun.modsFor(id).filter(m => m.id !== 'build'),
      { id: 'build', build: { stuffing, heart, quality, kills: 0 }, modifiers: buildModifiers(g.gun.def.base, workshopStuffings[stuffing].color, q.gun) }]);
  };
  /** A row of still zombies along x at z, on the ground floor. */
  const row = (xs, z = 6, health = 100000) => xs.map(x => {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(x, 0, z));
    zombie.position.y = 0; zombie.setState('chasing'); zombie.speed = 0; zombie.health = zombie.maxHealth = health; zombie.updateHitboxes();
    return zombie;
  });
  /** A shot that hit this zombie's head (what the Hearts listen to). */
  const fire = (target, extra = {}) => g.events.emit('shot', {
    weaponId: g.gun.def.id, magazineLeft: 5, hits: [{ target, part: 'head' }], end: target.position.clone(), endNormal: new THREE.Vector3(0, 0, 1), ...extra,
  });
  return { ...t, ritual, bench, fit, row, fire };
}

test('a build powers the gun up by its quality, and each quality more than the last', () => {
  const base = weapons.nailGun;
  const damages = workshopRitual.qualities.map(q => resolveGun(base, [{ id: 'build', modifiers: buildModifiers(base, 0xffffff, q.gun) }]).damage);
  workshopRitual.qualities.forEach((q, i) => assert.equal(damages[i], base.damage * q.gun.damage, q.id));
  assert.deepEqual([...damages].sort((a, b) => a - b), damages, 'never worse with a better quality');
  assert.equal(new Set(damages).size, damages.length, 'and each one different');
  const big = resolveGun(base, [{ id: 'build', modifiers: buildModifiers(base, 0xffffff, workshopRitual.qualities.at(-1).gun) }]);
  assert.ok(big.magazineSize > base.magazineSize, 'a bigger magazine');
});

test('even the plainest build beats a Deluxe warranty, a Regular one beats Premium, the best one beats Platinum alone, and it costs less than Premium', () => {
  const understuffed = workshopRitual.qualities[0].gun.damage;
  const deluxe = upgrades.tiers.find(t => t.id === 'deluxe').effects.damage;
  assert.ok(understuffed > deluxe, `Understuffed x${understuffed} vs Deluxe x${deluxe}`);
  // (Platinum went from x1.65 to x1.9 on 10 November 2026, docs/economy-report.md C: it costs 10,000 in all, so it may now pass a Regular build.)
  const premium = upgrades.tiers.find(t => t.id === 'premium').effects.damage;
  assert.ok(workshopRitual.qualities.find(q => q.id === 'regular').gun.damage > premium, 'a Regular build beats Premium');
  const best = Math.max(...upgrades.tiers.map(t => t.effects.damage ?? 1));
  assert.ok(workshopRitual.qualities.at(-1).gun.damage > best, 'an Overstuffed build beats Platinum alone');
  assert.ok(economy.upgrades.workshop.ritual < economy.upgrades.tiers.premium, 'and it costs less than Premium, which does less');
});

test('a warranty and a build stack on the same gun', () => {
  const base = weapons.nailGun, q = workshopRitual.qualities.find(x => x.id === 'regular');
  let mods = withTier(base, [], 'premium');
  mods = [...mods, { id: 'build', modifiers: buildModifiers(base, 0xffffff, q.gun) }];
  const damage = upgrades.tiers.find(t => t.id === 'premium').effects.damage * q.gun.damage;
  assert.ok(Math.abs(resolveGun(base, mods).damage - base.damage * damage) < 1e-9);
});

test('a gun comes back from the workshop with the build in it, loaded to the bigger magazine, with a full reserve', () => {
  const t = fixture({ gun: weapons.nailGun }), { g, ritual, bench } = t;
  const plain = g.gun.def.damage, plainMag = g.gun.def.magazineSize;
  g.gun.weapon.magazine = 1; g.gun.weapon.reserve = 3;
  ritual.choose('fryerOil', 'headshot');
  g.player.teleport({ position: new THREE.Vector3(bench.position.x, Y, bench.position.z - 1), yaw: Math.PI }); t.tick();
  t.press('KeyF', 20); t.tick(); t.press('KeyF'); t.tick();
  ritual.finishNow(); t.tick(Math.ceil(workshopRitual.catchUpSeconds * 60) + 3);
  if (ritual.phase === 'ready') {
    const s = bench.stations.booth;
    g.player.teleport({ position: new THREE.Vector3(s.x - 1, Y, s.z), yaw: -Math.PI / 2 }); t.tick();
    t.press('KeyF', 20); t.tick();
  }
  assert.ok(buildOf(g.gun.modsFor('nailGun')), 'the build is on the gun');
  assert.ok(g.gun.def.damage > plain, `${g.gun.def.damage} vs ${plain}`);
  assert.ok(g.gun.def.magazineSize > plainMag);
  assert.equal(g.gun.weapon.magazine, g.gun.def.magazineSize, 'loaded to the bigger magazine');
  assert.ok(g.gun.weapon.reserve >= g.gun.def.startingReserve, 'and the reserve is full');
  g.map.dispose();
});

test('Smoothie: slowed zombies take more from everything', () => {
  const t = fixture(), { g } = t;
  t.fit('smoothie', 'headshot');
  const [target, neighbour, far] = t.row([0, .8, 20]);
  t.fire(target);
  assert.ok(neighbour.slowTimer > 0 && neighbour.slowKind === 'smoothie');
  const { multiplier } = workshopStuffings.smoothie.vulnerable;
  neighbour.health = far.health = 1000;
  neighbour.takeHit({ damage: 100, part: 'body' });
  far.takeHit({ damage: 100, part: 'body' });
  assert.ok(Math.abs(1000 - neighbour.health - 100 * multiplier) < 1e-9, 'a slowed zombie takes the extra');
  assert.equal(1000 - far.health, 100, 'one that was not hit takes the normal amount');
  g.map.dispose();
});

test('Popcorn Butter: a zombie on the puddle slips and falls, headshots on it do double, and it cannot be pinned down', () => {
  const t = fixture(), { g } = t;
  const { puddle } = workshopStuffings.popcornButter;
  t.fit('popcornButter', 'headshot');
  const [target, bystander] = t.row([0, 8]);
  t.fire(target);
  t.tick(3);
  assert.ok(target.slipTimer > 0, 'it slipped');
  assert.equal(bystander.slipTimer, 0, 'one nowhere near did not');
  assert.ok(target.slipPose > 0, 'and it lies back');
  assert.ok(target.hitboxes[0].box.max.y < target.position.y + target.type.hitbox.headTop, 'its head box came down with it');
  target.health = 1000;
  target.takeHit({ damage: 100, part: 'head' });
  assert.ok(Math.abs(1000 - target.health - 100 * puddle.fallenHeadshotMultiplier) < 1e-9, 'double on a fallen head');
  target.health = 1000;
  target.takeHit({ damage: 100, part: 'body' });
  assert.equal(1000 - target.health, 100, 'but a body shot is normal');
  t.tick(Math.ceil((puddle.slipSeconds + .1) * 60));
  assert.equal(target.slipTimer, 0, 'it gets up');
  t.tick(5);
  assert.equal(target.slipTimer, 0, 'and the puddle cannot knock it down again straight away');
  t.tick(Math.ceil(puddle.slipImmuneSeconds * 60));
  assert.ok(target.slipTimer > 0, 'but once it has had its breather, it can fall again');
  g.map.dispose();
});

test('Popcorn Butter does not knock a boss down', () => {
  const t = fixture(), { g } = t;
  const [boss] = t.row([0]);
  boss.type = { ...boss.type, boss: true };
  assert.equal(boss.applySlip(1, .8), false);
  g.map.dispose();
});

test('Antifreeze: a shatter hits hard, and chills and hurts what stands round it', () => {
  const t = fixture(), { g } = t;
  const { shatter } = workshopStuffings.antifreeze;
  t.fit('antifreeze', 'headshot');
  const [target, near, far] = t.row([0, 1, 12]);
  t.fire(target); // chills the first two
  assert.ok(target.slowTimer > 0 && near.slowTimer > 0 && target.slowKind === 'antifreeze');
  assert.equal(far.slowTimer, 0);
  const [friend] = t.row([-.9]); // arrives after the first proc
  t.tick(60); // (past Headshot's cooldown)
  const before = { target: target.health, friend: friend.health };
  t.fire(target); // the second proc shatters the chilled
  assert.equal(target.slowTimer, 0, 'the shatter uses the chill up');
  assert.ok(target.health < before.target, 'it took the shatter');
  assert.ok(friend.health < before.friend, 'and the shards hit the one next to it');
  assert.ok(friend.slowTimer > 0, 'and chilled it');
  assert.ok(shatter.splashRadius > 0);
  g.map.dispose();
});

test('Reload: the blast only goes off with a zombie close, and saves its cooldown otherwise', () => {
  const t = fixture(), { g } = t;
  t.fit('smoothie', 'reload');
  const fired = [];
  g.events.on('buildFired', e => fired.push(e));
  t.standAt(0, 7);
  g.events.emit('reload', { weaponId: g.gun.def.id });
  assert.equal(fired.length, 0, 'nobody close: nothing goes off');
  t.row([0], 7 - workshopHearts.reload.nearRange / 2);
  g.events.emit('reload', { weaponId: g.gun.def.id });
  assert.equal(fired.length, 1, 'with a zombie close, it goes off straight away: nothing was spent before');
  g.map.dispose();
});

test('the status glow follows what is on the zombie: ice, goo, flames, rainbow, and nothing when it is clean', () => {
  const t = fixture(), { g } = t;
  const [z] = t.row([0]);
  const out = new THREE.Color();
  assert.equal(statusGlow(z, 1, out), 0, 'clean');
  z.applySlow(2, .5, 'antifreeze');
  assert.equal(statusGlow(z, 1, out), stuffingLook.antifreeze.strength);
  assert.equal(out.getHex(), stuffingLook.antifreeze.color);
  z.applySlow(2, .4, 'smoothie');
  assert.equal(statusGlow(z, 1, out), stuffingLook.smoothie.strength, 'the stronger slow decides the look');
  z.clearSlow();
  assert.equal(statusGlow(z, 1, out), 0);
  z.applyBurn(100, 3, .5);
  const flames = [0, .1, .2, .3, .4].map(time => statusGlow(z, time, out));
  assert.ok(flames.every(v => v > 0 && v <= stuffingLook.burn.strength + 1e-9) && new Set(flames).size > 1, 'it flickers');
  z.burn = null;
  z.applyConfusion(2, 10);
  statusGlow(z, 0, out);
  const first = out.getHex();
  statusGlow(z, .5, out);
  assert.notEqual(first, out.getHex(), 'glitter cycles colour');
  g.map.dispose();
});

test('a proc leaves a flash of light, and every stuffing has its look defined', () => {
  const t = fixture(), { g } = t;
  const scene = g.features.context.scene;
  t.fit('neonTube', 'headshot');
  const [target] = t.row([0, 1]);
  const flashes = () => scene.children.filter(o => o.visible && o.material?.blending === THREE.AdditiveBlending && o.geometry?.type === 'SphereGeometry');
  t.fire(target);
  assert.ok(flashes().length > 0, 'a flash where it went off');
  for (const key of ['burn', 'antifreeze', 'smoothie', 'butter', 'glitter', 'flame', 'frost', 'drip', 'bubble', 'hearts', 'flash']) assert.ok(stuffingLook[key], key);
  g.map.dispose();
});
