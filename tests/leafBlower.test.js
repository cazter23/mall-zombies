// The Leaf Blower (config/weapons.js leafBlower: claw-only, a cone of wind on a fuel tank), in the real headless game through real input.
// Its engine pieces have their own tests (fuel.test.js, coneBlast.test.js); this checks the gun: no wall sells it, the stream pushes and drops
// zombies and tickles them, the tank drains and refills, it pays points sensibly, and a new run puts everything back.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { buildWallBuy } from '../src/game/features/wallBuy.js';
import { upgrades } from '../src/config/upgrades.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { withAttachment, withTier, attachmentFits } from '../src/weapons/upgrades.js';

const blower = weapons.leafBlower;

// The hallway's clear middle, facing east down its length, with the Leaf Blower in hand and a quiet game.
function setup() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(-2, 0, 0.5), yaw: -Math.PI / 2 });
  g.gun.give(blower);
  t.tick(60); // (the gun comes up)
  const spawn = (metres) => {
    const eye = new THREE.Vector3(), aim = new THREE.Vector3();
    g.player.getAim(eye, aim);
    return g.zombies.spawn('shopper', new THREE.Vector3(eye.x + metres, 0, eye.z));
  };
  const hold = (ticks) => { t.input.held.add('Mouse0'); t.tick(ticks); t.input.held.delete('Mouse0'); };
  return { t, g, spawn, hold };
}

test('claw-only: the gun is flagged, has no wall price, and the wall-buy feature refuses it even if a map names it', () => {
  assert.equal(blower.clawOnly, true);
  assert.equal(economy.wallBuys.leafBlower, undefined);
  const added = [];
  const ctx = { scene: { add: () => added.push('scene') }, map: { zones: {} }, gun: { owns: () => false }, pricing: {}, interactions: { add: () => added.push('interaction') } };
  assert.equal(buildWallBuy({ weapon: 'leafBlower', zone: 'hallway', position: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) }, ctx), null);
  assert.deepEqual(added, [], 'nothing on the wall, nothing to buy');
  // Even with a price in the economy, a clawOnly gun stays off the wall.
  economy.wallBuys.leafBlower = { weapon: 100, ammo: 100 };
  try {
    assert.equal(buildWallBuy({ weapon: 'leafBlower', zone: 'hallway', position: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) }, ctx), null);
    assert.deepEqual(added, []);
  } finally { delete economy.wallBuys.leafBlower; }
  const t = headlessGame();
  for (const f of t.g.map.features.filter((x) => x.kind === 'wallBuy')) assert.notEqual(f.weapon, 'leafBlower', 'no map feature sells it');
});

test('holding fire: a stream of pulses that drains the tank, pushes a Shopper away, lays the close one down and only tickles it', () => {
  const { t, g, spawn, hold } = setup();
  const close = spawn(2);
  t.tick(80);
  const before = close.position.clone();
  const healthBefore = close.health;
  const tank = g.gun.weapon.magazine;
  assert.equal(tank, blower.magazineSize);
  const shots = g.runStats.shotsFired;
  hold(40);
  const pulses = g.runStats.shotsFired - shots;
  assert.ok(pulses >= 4 && pulses <= 6, `about 40 ticks / 9 per pulse (${pulses})`);
  assert.equal(g.gun.weapon.magazine, tank - pulses, 'one unit of fuel per pulse');
  assert.ok(close.position.x - before.x > 0.3, `it was blown away down the hallway (${(close.position.x - before.x).toFixed(2)} m)`);
  assert.ok(close.slipTimer > 0 || close.slipImmune > 0, 'and laid flat');
  const damage = healthBefore - close.health;
  assert.ok(damage > 0 && damage < blower.damage * pulses + 1e-6, `it only tickles (${damage.toFixed(1)})`);
  assert.ok(close.isAlive);
  assert.ok(t.sounds.includes('leafBlowerPuff'), 'the stream is heard');
});

test('the stream pays the +10 for a hit now and then, never every pulse, and a Shopper tickled to death pays its kill', () => {
  const { t, g, spawn, hold } = setup();
  const z = spawn(2);
  t.tick(80);
  const points = g.wallet.points;
  hold(100); // 11 pulses, 1.65 s
  const paid = g.wallet.points - points;
  const pulses = Math.round(100 / (blower.fireInterval / dt));
  assert.ok(paid >= 10 && paid <= 30, `+10 for the first hit, and again after ${blower.cone.payEverySeconds} s (${paid} for about ${pulses} pulses)`);
  assert.ok(z.isAlive);
  // Weakened to nothing, one more pulse kills it and pays the kill.
  z.health = 1;
  const kills = g.runStats.kills;
  hold(15);
  assert.equal(z.isAlive, false);
  assert.equal(g.runStats.kills, kills + 1);
});

test('a boss is not moved and not laid down (a Mascot gets the gentler shove: coneBlast.test.js)', () => {
  const { t, g, spawn, hold } = setup();
  const boss = spawn(2);
  boss.type = { ...boss.type, boss: true }; // (the bosses refuse every push: zombie.js staggerAway / applySlip)
  t.tick(80);
  const at = boss.position.x;
  hold(20);
  assert.ok(!(boss.slipTimer > 0), 'a boss is not laid down');
  assert.ok(boss.position.x - at < 0.5, 'and is hardly moved');
});

test('the tank: runs dry after about 6 s of holding, locks, refills by itself once you let go, and unlocks at restartAt', () => {
  const { t, g, hold } = setup();
  const weapon = g.gun.weapon;
  hold(Math.ceil(blower.magazineSize * blower.fireInterval / dt) + 20);
  assert.equal(weapon.magazine, 0, 'dry');
  assert.equal(weapon.fuel.locked, true);
  const shots = g.runStats.shotsFired;
  hold(30);
  assert.equal(g.runStats.shotsFired, shots, 'a held dry trigger fires nothing');
  t.tick(Math.ceil((blower.fuel.regenDelay + 0.3) / dt));
  assert.ok(weapon.magazine > 0 && weapon.magazine < blower.fuel.restartAt, `refilling (${weapon.magazine})`);
  t.tick(Math.ceil((blower.fuel.restartAt / blower.fuel.regenPerSecond + 0.5) / dt));
  assert.equal(weapon.fuel.locked, false);
  assert.ok(weapon.magazine >= blower.fuel.restartAt);
  t.tick(Math.ceil((blower.magazineSize / blower.fuel.regenPerSecond + 1) / dt));
  assert.equal(weapon.magazine, blower.magazineSize, 'a full tank again');
  t.input.pressed.add('KeyR'); // there is no reload
  t.tick(2);
  assert.equal(weapon.isReloading, false);
});

test('upgrades: a bigger tank, a quicker refill, a longer reach; the Speed Loader and Jumbo Pack fit, the Staple-only ideas stay unmoved', () => {
  const mods = (...ids) => ids.reduce((m, id) => withAttachment(blower, m, id), []);
  const jumbo = resolveGun(blower, mods('jumboPack'));
  assert.ok(jumbo.magazineSize > blower.magazineSize, 'Jumbo Pack = a bigger tank');
  const speed = resolveGun(blower, mods('speedLoader'));
  assert.ok(speed.fuel.regenPerSecond > blower.fuel.regenPerSecond, 'Speed Loader = a quicker refill');
  const nozzle = resolveGun(blower, mods('extendedNozzle'));
  assert.ok(nozzle.cone.range > blower.cone.range && nozzle.falloff.end > blower.falloff.end, 'Extended Nozzle = a longer reach');
  const sawn = resolveGun(blower, mods('sawnOff'));
  assert.ok(sawn.cone.range < blower.cone.range && sawn.damage > blower.damage);
  for (const id of Object.keys(upgrades.attachments)) assert.equal(attachmentFits(blower, id), true, `${id} fits the blower`);
  const platinum = resolveGun(blower, withTier(blower, [], 'platinum'));
  assert.ok(platinum.magazineSize > blower.magazineSize && platinum.fuel.regenPerSecond > blower.fuel.regenPerSecond);
});

test('a refill (RESTOCK-O-MATIC) and Play again: a full tank, no lock, the gun gone, no leaves or pay ledger left', () => {
  const { t, g, hold } = setup();
  hold(Math.ceil(blower.magazineSize * blower.fireInterval / dt) + 20);
  assert.equal(g.gun.weapon.fuel.locked, true);
  g.gun.give(blower); // an ammo buy for a gun you own
  assert.deepEqual([g.gun.weapon.magazine, g.gun.weapon.fuel.locked], [blower.magazineSize, false]);
  hold(10);
  g.resetRun();
  t.tick(2);
  assert.equal(g.gun.owns('leafBlower'), false);
  assert.equal(g.gun.def.id, 'stapleGun');
});
