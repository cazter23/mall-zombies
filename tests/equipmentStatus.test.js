// Kiosk Kevin phase 5 (docs/kiosk-kevin-plan.md): the Glitter Bomb and the Sparkler Cake, the two products that work through a
// zombie's existing status methods (applyConfusion: Build-A-Blaster's Glitter confusion; applyBurn: its Fryer Oil burn), in the
// REAL game (tests/helpers/headlessGame.js). Checked: each does its job on Shoppers, Cart Pushers and Mascots; bosses ignore the
// Glitter Bomb and burn at half strength in the Sparkler Cake; kills pay only through 'kill' (source 'equipment': no 'hit', no +10,
// no power-up meter); the gold Mascot still drops its power-up when equipment kills it; both work through real input, and death
// and Play again leave nothing behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { kiosk } from '../src/config/kiosk.js';
import { equipmentPower } from '../src/game/equipment/equipmentDamage.js';
import { pointsForHit } from '../src/game/wallet.js';
import { hasStatNumber } from '../src/config/effectWords.js';

const glitter = kiosk.products.glitterBomb;
const cake = kiosk.products.sparklerCake;
const ticksFor = (seconds) => Math.ceil(seconds / dt);

// A real game in the start room at `round`, the round's own spawning switched off (zombies are placed by hand).
function fixture(round = 5) {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  t.standAt(0, 14, 0);
  g.rounds.jumpTo(round);
  g.rounds.update = () => {};
  g.bosses.update = () => {}; // (no scheduled boss walks in: the tests summon one where they want it)
  g.zombies.clear();
  g.health.invulnerable = true;
  return t;
}

// A zombie of `type` standing (all but) still at (x, z), up and chasing (no rising, no walking). (Not speed 0: the Mascot's
// pose divides by its speed, and 0/0 would leave its hitboxes NaN.)
function place(t, type, x, z, options) {
  const zombie = t.g.zombies.spawn(type, new THREE.Vector3(x, 0, z), options);
  zombie.position.set(x, 0, z);
  zombie.state = 'chasing';
  zombie.speed = 1e-6;
  zombie.updateHitboxes();
  return zombie;
}
// A boss (the Security Guard), placed like the others (its type is what the products check; no boss behaviour needed).
function summonBoss(t, x, z) {
  const boss = place(t, 'guard', x, z);
  assert.ok(boss.type.boss);
  return boss;
}
const floorAt = (x, z) => new THREE.Vector3(x, 0.12, z);
// Every payout the run makes, and every 'hit' and 'kill' event.
function ledger(g) {
  const log = { hits: [], kills: [], points: g.wallet.points, progress: g.powerUps.progress };
  g.events.on('hit', (h) => log.hits.push(h));
  g.events.on('kill', (k) => log.kills.push(k));
  return log;
}

test('the tickets say what each does in words (no numbers), bosses included', () => {
  for (const product of [glitter, cake]) {
    assert.ok(!hasStatNumber(product.detail), product.id);
    assert.match(product.detail, /Bosses/);
  }
  assert.equal(glitter.pocket, 'tactical');
  assert.equal(cake.pocket, 'lethal');
});

test('the Glitter Bomb confuses Shoppers, a charging Cart Pusher and a Mascot round it; a boss, and anything out of reach, is left alone', () => {
  const t = fixture(9);
  const { g } = t;
  const shopper = place(t, 'shopper', -1.5, 9);
  const cart = place(t, 'cartPusher', 1.5, 9);
  cart.chargeLeft = 2;
  const mascot = place(t, 'mascot', 0, 10.8);
  const boss = summonBoss(t, 0, 7.5);
  const far = place(t, 'shopper', 0, 9 - glitter.confuse.radius - 1.5);
  const health = [shopper, cart, mascot, boss, far].map((z) => z.health);
  const log = ledger(g);
  g.equipment.detonate('glitterBomb', floorAt(0, 9));
  for (const zombie of [shopper, cart, mascot]) {
    assert.ok(zombie.confusion, `${zombie.type.id} is confused`);
    assert.equal(zombie.confusion.seconds ?? zombie.confusion.left, glitter.confuse.seconds);
    assert.equal(zombie.confusion.source, 'equipment');
    assert.ok(Math.abs(zombie.confusion.damage - glitter.confuse.hitDamage * equipmentPower(9)) < 1e-9, 'its swings scale with the round');
  }
  assert.equal(cart.chargeLeft, 0, 'the charge is called off');
  assert.equal(boss.confusion, null, 'bosses ignore it');
  assert.equal(far.confusion, null, 'out of reach');
  assert.deepEqual([shopper, cart, mascot, boss, far].map((z) => z.health), health, 'the card itself hurts nobody');
  assert.equal(g.wallet.points, log.points, 'and pays nothing');
  assert.ok(t.sounds.includes(glitter.sounds.open));
  // It wears off.
  t.tick(ticksFor(glitter.confuse.seconds) + 2);
  assert.equal(shopper.confusion, null);
});

test('a card that opens in the air (on a zombie\'s chest, off a wall) still catches the zombies on that floor, and none a floor away', () => {
  const t = fixture(5);
  const shopper = place(t, 'shopper', 0, 9);
  const other = place(t, 'shopper', 1.5, 9.5);
  t.g.equipment.detonate('glitterBomb', new THREE.Vector3(0, 1.3, 9.4)); // (where a card bouncing off its chest opens)
  assert.ok(shopper.confusion && other.confusion);
  // One floor up (the Promenade is 6.3 m above): out of reach, whatever the distance across.
  const t2 = fixture(5);
  const below = place(t2, 'shopper', 0, 9);
  t2.g.equipment.detonate('glitterBomb', new THREE.Vector3(0, 6.3 + 0.12, 9));
  assert.equal(below.confusion, null);
});

test('a confused zombie that kills another pays the kill value through \'kill\' only (source equipment): no \'hit\', no +10, no meter', () => {
  const t = fixture(5);
  const { g } = t;
  const attacker = place(t, 'shopper', 0, 9);
  const victim = place(t, 'shopper', 0.8, 9);
  victim.health = 1; // (one swing finishes it)
  const log = ledger(g);
  g.equipment.detonate('glitterBomb', floorAt(-0.4, 9));
  assert.ok(attacker.confusion && victim.confusion);
  for (let i = 0; i < ticksFor(glitter.confuse.seconds) && victim.isAlive; i++) t.tick();
  assert.equal(victim.isAlive, false, 'the confused zombie swung at the other one');
  assert.equal(log.kills.length, 1);
  assert.equal(log.kills[0].source, 'equipment');
  assert.equal(log.hits.length, 0, 'never a \'hit\' event');
  assert.equal(g.wallet.points - log.points, pointsForHit({ target: victim, killed: true }), 'the kill value, no +10');
  assert.equal(g.powerUps.progress, log.progress, 'no power-up credit');
  assert.equal(g.health.fraction, 1, 'and it never turned on you');
});

test('the Sparkler Cake sets Shoppers, a Cart Pusher and a Mascot round it burning for its spray; a boss burns at half strength', () => {
  const t = fixture(9);
  const { g } = t;
  const shopper = place(t, 'shopper', -1.5, 9);
  const cart = place(t, 'cartPusher', 1.5, 9);
  const mascot = place(t, 'mascot', 0, 10.8);
  const boss = summonBoss(t, 0, 7.4);
  const far = place(t, 'shopper', 0, 9 - cake.spray.radius - 1.5);
  const log = ledger(g);
  const health = new Map([shopper, cart, mascot, boss, far].map((z) => [z, z.health]));
  g.equipment.detonate('sparklerCake', floorAt(0, 9));
  assert.equal(g.equipment.live.length, 1, 'the cake sits there');
  t.tick(1); // (the first pulse)
  const full = cake.spray.burn.damage * equipmentPower(9);
  const perTick = (total) => (total * cake.spray.burn.tickSeconds) / cake.spray.burn.seconds;
  for (const zombie of [shopper, cart, mascot]) {
    assert.ok(zombie.burn, `${zombie.type.id} is burning`);
    assert.equal(zombie.burn.source, 'equipment');
    assert.ok(Math.abs(zombie.burn.perTick - perTick(full)) < 1e-6, `${zombie.type.id}: the round's burn`);
  }
  assert.ok(Math.abs(boss.burn.perTick - perTick(full) * cake.spray.bossFactor) < 1e-6, 'the boss: half strength');
  assert.equal(far.burn, null, 'out of reach');
  // It keeps lighting them for its spray, then it's gone; they burn on a little after.
  t.tick(ticksFor(cake.spray.seconds));
  assert.equal(g.equipment.live.length, 0, 'spent');
  for (const zombie of [shopper, cart, mascot, boss]) assert.ok(zombie.health < health.get(zombie), `${zombie.type.id} took burn damage`);
  assert.equal(far.health, health.get(far));
  const shopperLost = health.get(shopper) - shopper.health;
  const bossLost = (health.get(boss) - boss.health) / boss.damageTakenMultiplier;
  assert.ok(Math.abs(bossLost / shopperLost - cake.spray.bossFactor) < 0.05, `boss ${bossLost.toFixed(0)} vs Shopper ${shopperLost.toFixed(0)}`);
  assert.equal(log.hits.length, 0, 'never a \'hit\' event');
  assert.equal(g.wallet.points, log.points, 'nothing died: nothing paid (no +10 a tick)');
});

test('a Sparkler Cake kill pays through \'kill\' only, and nothing pays after death', () => {
  const t = fixture(2);
  const { g } = t;
  const zombie = place(t, 'shopper', 0, 9);
  const log = ledger(g);
  g.equipment.detonate('sparklerCake', floorAt(0, 9.5));
  for (let i = 0; i < ticksFor(cake.spray.seconds + cake.spray.burn.seconds) && zombie.isAlive; i++) t.tick();
  assert.equal(zombie.isAlive, false, 'a round 2 Shopper burns down standing in it');
  assert.equal(log.kills.length, 1);
  assert.equal(log.kills[0].source, 'equipment');
  assert.equal(log.hits.length, 0);
  assert.equal(g.wallet.points - log.points, pointsForHit({ target: zombie, killed: true }));
  assert.equal(g.powerUps.progress, log.progress, 'no power-up credit');

  const later = place(t, 'shopper', 0, 9);
  g.equipment.detonate('sparklerCake', floorAt(0, 9.5));
  t.tick(1);
  assert.ok(later.burn);
  const points = g.wallet.points;
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  later.takeHit({ damage: 1e6, part: 'body', source: 'equipment' });
  assert.equal(g.wallet.points, points, 'dead: nothing more is paid');
});

test('the gold Employee of the Month still drops its power-up when equipment kills it (a Sparkler Cake burn, a confused zombie)', () => {
  for (const how of ['sparklerCake', 'glitterBomb']) {
    const t = fixture(20);
    const { g } = t;
    const drops = [];
    g.events.on('powerUpDrop', (drop) => drops.push(drop));
    const gold = place(t, 'mascot', 1, 9, { gold: true });
    assert.ok(gold.type.gold && gold.type.guaranteedDrop);
    gold.health = 1;
    if (how === 'glitterBomb') place(t, 'shopper', 0.2, 9);
    g.equipment.detonate(how, floorAt(0.6, 9));
    for (let i = 0; i < ticksFor(glitter.confuse.seconds) && gold.isAlive; i++) t.tick();
    assert.equal(gold.isAlive, false, `${how}: it died`);
    t.tick(2);
    assert.equal(drops.length, 1, `${how}: one power-up at its body`);
  }
});

test('through real input: G throws a Sparkler Cake that lands and sprays; middle click throws a Glitter Bomb that opens on landing', () => {
  const t = fixture(5);
  const { g } = t;
  g.equipment.give('sparklerCake', 2);
  g.equipment.give('glitterBomb', 2);
  const thrown = [];
  g.events.on('equipmentThrown', (e) => thrown.push(e));
  const opened = [];
  g.events.on('equipmentBurst', (e) => opened.push(e));
  t.press('KeyG', 1);
  assert.deepEqual(thrown[0], { id: 'sparklerCake', pocket: 'lethal', left: 1 });
  const item = g.equipment.live[0];
  let landedAfter = null;
  for (let i = 0; i < ticksFor(cake.landSeconds + 1) && landedAfter === null; i++) {
    t.tick();
    if (item.spraying) landedAfter = i;
  }
  assert.ok(landedAfter !== null, 'it landed and started spraying');
  assert.ok(item.position.y < 0.5, 'on the floor');
  // A Shopper walks into the sparks.
  const zombie = place(t, 'shopper', item.position.x, item.position.z - 1);
  t.tick(ticksFor(cake.spray.pulseSeconds) + 1);
  assert.ok(zombie.burn, 'it caught');
  t.tick(ticksFor(kiosk.throw.blockSeconds));
  // The card: thrown over a Shopper in the start room, it opens where it lands.
  g.zombies.clear();
  const target = place(t, 'shopper', 0, 7.5);
  t.press('Mouse1', 1);
  assert.deepEqual(thrown[1], { id: 'glitterBomb', pocket: 'tactical', left: 1 });
  for (let i = 0; i < ticksFor(glitter.landSeconds + 1) && !opened.length; i++) t.tick();
  assert.equal(opened.length, 1, 'it opened');
  assert.equal(opened[0].id, 'glitterBomb');
  assert.ok(target.confusion, `the Shopper in its path is confused (it opened at y ${opened[0].position.y.toFixed(2)})`);
  assert.deepEqual(opened[0].hit.map((h) => h.target), [target]);
  assert.ok(target.isAlive);
  assert.ok(!g.equipment.live.some((i) => i.id === 'glitterBomb'), 'the card is used up when it opens');
});

test('death and Play again leave no spraying cake behind', () => {
  const t = fixture(5);
  const { g } = t;
  const fresh = snapshot(headlessGame().g).equipment;
  g.equipment.detonate('sparklerCake', floorAt(0, 9));
  t.tick(1);
  assert.equal(g.equipment.live.length, 1);
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  t.tick(1);
  assert.equal(g.equipment.live.length, 0, 'death clears it');
  g.resetRun();
  assert.deepEqual(snapshot(g).equipment, fresh);
});
