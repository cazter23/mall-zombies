import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { bossTypes, bossVouchers } from '../src/config/bosses.js';
import { tierOf, withTier } from '../src/weapons/upgrades.js';

const cfg = bossTypes.manager;
function fixture(t) {
  const game = headlessGame();
  const { g } = game;
  g.rounds.jumpTo(13); g.rounds.update = () => {}; g.health.invulnerable = true;
  game.tick(); // build the navigation field before asking for a safe spawn
  const boss = g.bosses.summon('manager');
  boss.position.set(0, 0, 8); boss.setState('chasing'); boss.speed = 0;
  const staff = g.zombies.spawn('shopper', new THREE.Vector3(-2, 0, 8)); staff.setState('chasing'); staff.speed = 0;
  const phases = [];
  g.events.on('bossPhase', e => phases.push(e.phase));
  t.after(() => { g.resetRun(); g.map.dispose(); });
  return { ...game, boss, staff, phases };
}
const meeting = (boss, tick) => { boss.health = boss.maxHealth * cfg.meeting.thresholds[0]; tick(); };

test('Staff Meeting cancels at exactly 15% max health after vulnerability and releases holds', t => {
  const { g, boss, staff, phases, tick } = fixture(t);
  meeting(boss, tick);
  assert.equal(staff.hold.source, boss); assert.equal(boss.damageTakenMultiplier, cfg.meeting.damageTaken);
  const at = boss.position.clone(); tick(2); assert.ok(at.equals(boss.position));
  boss.takeHit({ damage: boss.maxHealth * cfg.meeting.cancelFraction / cfg.meeting.damageTaken, part: 'body' });
  tick();
  assert.ok(phases.includes('cancelled')); assert.equal(staff.hold, null);
  assert.equal(boss.damageTakenMultiplier, 1);
  assert.equal(g.zombies.zombies.some(z => z.buffs.size), false);
  tick(Math.ceil(cfg.meeting.stunSeconds / dt) + 1); assert.equal(boss.controlled, false);
});

test('uninterrupted meeting buffs every ordinary survivor, then expires', t => {
  const { g, boss, staff, phases, tick } = fixture(t);
  const far = g.zombies.spawn('shopper', new THREE.Vector3(3, 0, 15)); far.setState('chasing'); far.speed = 0;
  meeting(boss, tick); tick(Math.ceil(cfg.meeting.seconds / dt) + 1);
  assert.ok(phases.includes('failed'));
  for (const z of [staff, far]) {
    assert.equal(z.hold, null); assert.equal(z.speedMultiplier, cfg.meeting.speed); assert.equal(z.damageMultiplier, cfg.meeting.damage);
  }
  assert.equal(boss.damageMultiplier, 1);
  tick(Math.ceil(cfg.report.interval / dt) + 1);
  assert.equal(staff.damageMultiplier, cfg.meeting.damage, 'a Direct Report cannot replace the longer meeting damage buff');
  // Stop further reports; this checks the existing buff's own timer.
  boss.takeHit({ damage: boss.health, part: 'body' });
  tick(Math.ceil(cfg.meeting.buffSeconds / dt) + 1);
  assert.equal(staff.speedMultiplier, 1); assert.equal(staff.damageMultiplier, 1);
});

test('Direct Report respects its target cap and line of sight', t => {
  const { g, boss, staff, phases, tick } = fixture(t);
  const targets = [staff];
  for (let i = 0; i < cfg.report.maxTargets + 2; i++) {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(-3 + i * 0.7, 0, 9)); z.speed = 0; z.setState('chasing'); targets.push(z);
  }
  const hidden = g.zombies.spawn('shopper', new THREE.Vector3(-8, 0, 9)); hidden.setState('chasing'); hidden.speed = 0;
  tick(Math.ceil(cfg.report.interval / dt) + 1);
  assert.ok(phases.includes('report'));
  assert.equal(targets.filter(z => z.speedMultiplier === cfg.report.speed).length, cfg.report.maxTargets);
  assert.equal(hidden.speedMultiplier, 1);
});

test('boss death, player death, discard and Play again release meeting holds and whiteboard', t => {
  for (const exit of ['boss', 'player', 'discard', 'reset', 'vanish']) {
    const { g, boss, staff, tick } = fixture(t);
    meeting(boss, tick);
    if (exit === 'boss') boss.takeHit({ damage: boss.health, part: 'body' });
    if (exit === 'player') { g.health.invulnerable = false; g.health.takeDamage(g.stats.maxHealth); }
    if (exit === 'discard') g.rounds.jumpTo(14);
    if (exit === 'reset') g.resetRun();
    if (exit === 'vanish') { g.zombies.clearBosses(); tick(); }
    assert.equal(staff.hold, null, exit);
    assert.equal(boss.damageTakenMultiplier, 1, exit);
  }
});

test('Signed Approval drops, collects, survives Employee Discount, buys a booth tier, and converts at Premium', t => {
  const { g, boss, tick, standAt, press } = fixture(t);
  boss.position.set(0, 0, 10);
  boss.takeHit({ damage: boss.health, part: 'body' }); tick();
  assert.equal(g.powerUps.pickup.id, 'signedApproval');
  g.player.teleport({ position: g.powerUps.pickup.position, yaw: 0 }); tick();
  assert.equal(g.pricing.voucher, bossVouchers.signedApproval);
  g.pricing.setDiscount('tier', 0.5); g.pricing.setCoupon({ fraction: 0.5, maxSaving: 2000 });
  g.pricing.clearCoupon(); g.pricing.setDiscount('tier', 0);
  assert.equal(g.pricing.voucher, bossVouchers.signedApproval);
  g.map.areaUnlocks.unlock('hallway'); tick(120);
  const desk = g.map.features.find(f => f.kind === 'upgradeDesk');
  const points = g.wallet.points;
  standAt(desk.position.x, desk.position.z - 1.4, 180); press('KeyF', 30);
  assert.equal(tierOf(g.gun.modsFor(g.gun.def.id)), 'deluxe');
  assert.equal(g.wallet.points, points); assert.equal(g.pricing.voucher, null);
  g.pricing.setVoucher(bossVouchers.signedApproval);
  g.gun.setMods(g.gun.def.id, withTier(g.gun.def.base, g.gun.modsFor(g.gun.def.id), 'premium'));
  tick();
  assert.equal(g.pricing.voucher, null); assert.equal(g.wallet.points, points + bossVouchers.signedApproval.pointsInstead);
});
