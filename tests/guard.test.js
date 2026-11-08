import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { bossTypes, bossVouchers } from '../src/config/bosses.js';
import { economy, zombieCountForRound } from '../src/config/economy.js';

const cfg = bossTypes.guard;
function fixture(t) {
  const game = headlessGame(); const { g } = game;
  g.health.invulnerable = true; g.rounds.jumpTo(9);
  const updateRounds = g.rounds.update.bind(g.rounds); g.rounds.update = () => {};
  g.map.areaUnlocks.openAll(); game.tick(120);
  t.after(() => { g.resetRun(); g.map.dispose(); });
  return { ...game, updateRounds };
}
function summon(g) {
  const z = g.bosses.summon('guard'); assert.ok(z);
  z.position.set(0,0,9); z.prevPosition.copy(z.position); z.speed = 0;
  z.setState('chasing'); z.chargeCooldown = Infinity;
  return z;
}
function lock(z, tick) { z.health = z.maxHealth * cfg.lockdown.thresholds[0]; tick(); tick(Math.ceil(cfg.lockdown.alarmSeconds / dt)); }
const ownership = g => Object.entries(g.map.zones).map(([id,z]) => [id,z.open]);

test('lockdown finds every area, closes only surrounding shutters, spends backup quota, and preserves ownership', t => {
  const { g, tick } = fixture(t);
  const before = ownership(g);
  for (const zone of Object.keys(g.map.zones)) {
    const marker = g.map.spawnPoints.find(p => p.zone === zone);
    assert.ok(marker, zone);
    g.player.teleport({ position: marker.position, yaw: 0 }); tick();
    assert.equal(g.map.areaAt(g.player.position), zone);
    const doors = g.map.barriersAround(zone);
    assert.ok(doors.every(d => d.barrier.kind === 'shutter' && d.id !== 'escalatorRepair'));
    const z = summon(g); const remaining = g.rounds.remainingToSpawn;
    lock(z, tick);
    for (const d of doors) assert.ok(['closing','closed'].includes(d.barrier.state), `${zone}/${d.id}`);
    assert.equal(g.rounds.remainingToSpawn, remaining - cfg.lockdown.backup);
    assert.deepEqual(ownership(g), before);
    z.takeHit({ damage: z.health, part: 'body' });
    for (const d of doors) assert.ok(['opening','open'].includes(d.barrier.state));
    assert.deepEqual(ownership(g), before);
    g.bosses.reset(); g.zombies.clear(); tick(120);
  }
});

test('a shutter waits for the player or a zombie underneath it; the third headshot breaks the radio', t => {
  const { g, tick } = fixture(t);
  const door = g.map.doors.find(d => d.id === 'startShutter');
  const box = door.barrier.collider;
  g.player.teleport({ position: new THREE.Vector3((box.min.x+box.max.x)/2,0,(box.min.z+box.max.z)/2), yaw: 0 }); tick();
  const z = summon(g); lock(z, tick);
  assert.equal(door.barrier.state, 'open');
  const occupant = g.zombies.spawn('shopper', g.player.position); occupant.position.copy(g.player.position); occupant.setState('chasing'); occupant.speed = 0;
  occupant.applyHold(z, 20);
  g.player.teleport({ position: new THREE.Vector3(0,0,12), yaw: 0 }); tick();
  assert.equal(door.barrier.state, 'open');
  occupant.position.set(3,0,10); tick(); assert.equal(door.barrier.state, 'closing');
  const hit = () => g.events.emit('hit', { target: z, killed: false, headshot: true, melee: false });
  hit(); hit(); assert.equal(door.barrier.state, 'closing');
  hit(); assert.equal(door.barrier.state, 'opening');
  z.health = z.maxHealth * cfg.lockdown.thresholds[1]; tick(240);
  assert.equal(door.barrier.state, 'open', 'a broken radio cannot make a second call');
});

test('boss death, player death, discard, vanished boss and Play again release a lockdown before map reset', t => {
  for (const exit of ['boss','player','discard','vanish','reset']) {
    const { g, tick } = fixture(t);
    const before = ownership(g); const z = summon(g); lock(z,tick);
    if (exit === 'boss') z.takeHit({ damage: z.health, part: 'body' });
    if (exit === 'player') { g.health.invulnerable = false; g.health.takeDamage(g.stats.maxHealth); }
    if (exit === 'discard') g.rounds.jumpTo(10);
    if (exit === 'vanish') { g.zombies.clearBosses(); tick(); }
    if (exit === 'reset') g.resetRun();
    if (exit !== 'reset') {
      assert.deepEqual(ownership(g),before);
      assert.ok(g.map.barriersAround('startRoom').every(d => ['opening','open'].includes(d.barrier.state)), exit);
    } else {
      assert.deepEqual(Object.keys(g.map.zones).filter(id => g.map.zones[id].open), ['startRoom']);
      tick(180);
      assert.ok(g.map.doors.every(d => !d.isOpen));
      assert.equal(g.map.doors.find(d => d.id === 'startShutter').barrier.state, 'closed');
      assert.ok(g.resetSteps.indexOf('bosses') < g.resetSteps.indexOf('map'));
    }
  }
});

test('lockdown expires and quota backup cannot add enemies or prevent a round ending', t => {
  const { g, tick, updateRounds } = fixture(t);
  const update = g.rounds.spawnBackup.bind(g.rounds);
  const z = summon(g); lock(z,tick);
  tick(Math.ceil(cfg.lockdown.seconds / dt) + 1);
  assert.ok(g.map.barriersAround('startRoom').every(d => ['opening','open'].includes(d.barrier.state)));
  while (g.rounds.remainingToSpawn > 0) {
    g.zombies.clear(); assert.ok(update('mallWalker'));
  }
  assert.equal(g.rounds.remainingToSpawn,0); assert.equal(update('mallWalker'),null);
  assert.equal(zombieCountForRound(9) - cfg.lockdown.backup > 0,true);
  g.zombies.clear(); g.rounds.update = updateRounds; tick();
  assert.equal(g.rounds.round,10);
});

test('taser telegraph locks a dodgeable lunge; a hit damages and briefly slows without input loss; a miss is vulnerable', t => {
  const { g, tick, press } = fixture(t); const z = summon(g);
  z.position.set(0,0,10); z.yaw = Math.PI;
  z.setState('chargeTelegraph');
  tick(Math.floor(cfg.charge.telegraphSeconds / dt) - 1); assert.equal(z.state,'chargeTelegraph');
  tick(2); assert.equal(z.state,'charging');
  g.health.invulnerable = false; const health = g.stats.health;
  for (let i=0;i<60 && z.state === 'charging';i++) tick();
  assert.equal(g.stats.health,health-cfg.charge.damage); assert.equal(g.stats.surfaceSpeed,cfg.taserSlow.speed);
  const at = g.player.position.clone(); press('KeyD',10);
  assert.ok(g.player.position.distanceTo(at)>0, 'the player can still move during the taser slow');
  tick(Math.ceil(cfg.taserSlow.seconds / dt)+1); assert.equal(g.stats.surfaceSpeed,1);
  z.position.set(0,0,9); z.chargeDir = {x:1,z:0}; z.chargeLeft = 0; z.setState('charging'); tick();
  assert.equal(z.state,'crashed'); const hp=z.health;
  z.takeHit({damage:10,part:'body'}); assert.equal(hp-z.health,10*cfg.charge.crashDamageTakenMultiplier);
});

test('Master Key buys any destination for zero and converts immediately when all areas are owned', t => {
  const { g, tick, standAt, press } = fixture(t);
  let points = g.wallet.points;
  g.pricing.setVoucher(bossVouchers.masterKey);
  assert.equal(g.pricing.voucher,null); assert.equal(g.wallet.points,points+bossVouchers.masterKey.pointsInstead);
  g.resetRun(); g.rounds.update=()=>{}; tick();
  g.pricing.setVoucher(bossVouchers.masterKey); points=g.wallet.points;
  standAt(0,8,0); press('KeyF',30);
  assert.equal(g.map.zones.hallway.open,true); assert.equal(g.wallet.points,points); assert.equal(g.pricing.voucher,null);
});
