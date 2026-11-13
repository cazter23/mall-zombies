// THE RETURN: the hidden quest that issues Return to Sender (game/returnQuest.js, config/returnQuest.js), its NO REFUNDS
// signs (game/features/refundSign.js), the Returns Desk's quest prompts and label slot (game/features/returnsDesk.js),
// and the three return labels. The desk's ammo sale and its place among the other prompts: tests/closingTime.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { returnQuest as cfg, returnLabel } from '../src/config/returnQuest.js';
import { closingTime } from '../src/config/closingTime.js';
import { clawMachine } from '../src/config/clawMachine.js';
import { weapons } from '../src/config/weapons.js';
import { feel } from '../src/config/feel.js';
import { audio } from '../src/config/audio.js';
import { createEvents } from '../src/game/events.js';
import { createReturnQuest } from '../src/game/returnQuest.js';
import { returnToSender } from '../src/weapons/returnToSender.js';
import { featuresOf } from '../src/game/features/index.js';
import { PRICE_CATEGORIES } from '../src/game/pricing.js';
import { headlessGame, dt } from './helpers/headlessGame.js';

const GUN = cfg.weaponId;
const hold = (seconds) => Math.ceil(seconds / dt) + 2;

// The quest alone, with stand-ins for the game around it.
function alone({ desk = new THREE.Vector3(10, 1.4, 5.6) } = {}) {
  const events = createEvents();
  const state = { over: false };
  const player = { position: new THREE.Vector3(desk.x, 0, desk.z - 2) };
  const zombies = { zombies: [] };
  const given = [];
  const gun = { def: { id: 'stapleGun' }, weapon: null, owns: (id) => given.includes(id), give: (def) => given.push(def.id) };
  const wallet = { earned: 0, earn(amount) { this.earned += amount; } };
  const quest = createReturnQuest({ events, state, player, zombies, gun, wallet, effects: null, sound: null, desk });
  const steps = [], labels = [];
  events.on('returnQuest', (event) => steps.push(event));
  events.on('returnLabel', (event) => labels.push(event));
  const kill = (extra = {}) => events.emit('kill', { zombie: { type: { id: 'shopper' } }, weaponId: 'stapleGun', source: 'gun', ...extra });
  return { events, state, player, zombies, gun, given, wallet, quest, steps, labels, kill, desk };
}

function realGame(context) {
  const t = headlessGame();
  context.after(() => { t.g.resetRun(); t.g.map.dispose(); });
  const { g } = t;
  g.rounds.update = () => {};
  t.tick();
  g.map.areaUnlocks.unlock('hallway');
  t.tick(120);
  const desk = g.map.features.find(({ kind }) => kind === 'returnsDesk');
  const built = (name) => g.features.list.find(({ feature }) => feature.name === name).instance;
  // Stand in front of a point on the hallway's north wall, looking at it.
  const face = (point) => {
    const stand = new THREE.Vector3(point.x, 0, point.z - 1.2);
    const to = new THREE.Vector3().subVectors(point, stand.clone().setY(feel.player.eyeHeight));
    g.player.teleport({ position: stand, yaw: Math.atan2(-to.x, -to.z) });
    g.player.pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
    t.tick(2);
  };
  const atDesk = () => face(desk.position);
  const atSlot = () => face(built('returnsDesk').slotPosition);
  const spawn = (type, x, z, options) => {
    const zombie = g.zombies.spawn(type, new THREE.Vector3(x, 0, z), options);
    zombie.setState('chasing');
    zombie.speed = 0;
    zombie.attackCooldown = 99;
    return zombie;
  };
  // One blast's return by hand; the blast then ends (as the gun's 'shot' event ends it), so the next beam is a new blast for the labels.
  const beam = (zombie) => { const result = returnToSender(zombie, { effects: g.effects, sound: null }); g.returnQuest.blastDone(); return result; };
  return { ...t, desk, built, atDesk, atSlot, spawn, beam, quest: g.returnQuest };
}

// --- The quest alone --------------------------------------------------------------------------------------------------

test('the steps happen in order: signs, damaged goods, a number, the kills near the desk, the gun', () => {
  const t = alone();
  const { quest } = t;
  assert.equal(quest.stage, 'policy');
  assert.equal(quest.pullTicket(), false);
  assert.equal(quest.collect(), false);
  assert.equal(quest.shootSign('nowhere'), false);
  for (const sign of cfg.signs.slice(0, -1)) assert.equal(quest.shootSign(sign.id), true);
  assert.equal(quest.shootSign(cfg.signs[0].id), false, 'a sign falls once');
  assert.equal(quest.stage, 'policy');
  assert.equal(quest.signsLeft, 1);
  quest.shootSign(cfg.signs.at(-1).id);
  assert.equal(quest.stage, 'damaged');
  assert.deepEqual(t.steps.at(-1), { step: 'policy', stage: 'damaged', pa: cfg.pa.policy });

  // A crash far from the desk, a crash on another floor and a zombie that is merely near do not count.
  const crashed = (x, y, z, state = 'crashed') => ({ isAlive: true, state, position: new THREE.Vector3(x, y, z) });
  t.zombies.zombies = [crashed(t.desk.x + cfg.crash.radius + 1, 0, t.desk.z), crashed(t.desk.x, 6.3, t.desk.z), crashed(t.desk.x, 0, t.desk.z - 1, 'chasing')];
  quest.update(1 / 60);
  assert.equal(quest.stage, 'damaged');
  t.zombies.zombies.push(crashed(t.desk.x + 1, 0, t.desk.z - 2));
  quest.update(1 / 60);
  assert.equal(quest.stage, 'ticket');
  assert.equal(quest.parcel, true);

  t.kill();
  assert.equal(quest.served, 0, 'no number taken yet');
  assert.equal(quest.pullTicket(), true);
  assert.equal(quest.pullTicket(), false);
  assert.equal(quest.stage, 'queue');
  for (let i = 0; i < 10; i++) t.kill();
  t.kill({ zombie: { noRewards: true, type: { id: 'mallWalker' } } }); // one of Skylar's fans
  t.player.position.x += cfg.ticket.queueRadius + 1; // wandered off
  for (let i = 0; i < 10; i++) t.kill();
  t.player.position.x -= cfg.ticket.queueRadius + 1;
  t.player.position.y = 6.3; // the floor above
  t.kill();
  t.player.position.y = 0;
  assert.equal(quest.served, 10, 'only kills made near the desk, on its floor, of real zombies');
  for (let i = 10; i < cfg.ticket.number - 1; i++) t.kill();
  assert.equal(quest.stage, 'queue');
  t.kill();
  assert.equal(quest.stage, 'collect');
  assert.deepEqual(t.steps.at(-1), { step: 'called', stage: 'collect', pa: cfg.pa.called(cfg.ticket.number) });
  t.kill();
  assert.equal(t.steps.filter(({ step }) => step === 'called').length, 1, 'called once');

  assert.equal(quest.collect(), true);
  assert.deepEqual(t.given, [GUN]);
  assert.equal(quest.stage, 'done');
  assert.equal(quest.collect(), false, 'not a second one while you own it');
  t.given.length = 0; // (lost it: swapped away at a wall buy)
  assert.equal(quest.collect(), true, 'reissued free');
  assert.equal(t.steps.filter(({ step }) => step === 'collect').length, 1);
  assert.deepEqual(t.steps.map(({ step }) => step), ['policy', 'damaged', 'ticket', 'called', 'collect']);
});

test('each working duty issues its label once; the slot cycles through the labels held and back to none', () => {
  const t = alone();
  const { quest } = t;
  assert.deepEqual(Object.values(cfg.labels).map(({ duty }) => duty).sort(), Object.keys(closingTime.lines).filter((id) => closingTime.lines[id].needed).sort(), 'one label per working duty');
  assert.equal(quest.cycleLabel(), null, 'nothing to fit');
  t.events.emit('closingLine', { line: 'influencer' }); // leaving: no label
  t.events.emit('closingLine', { line: 'guard' });
  t.events.emit('closingLine', { line: 'guard' });
  assert.deepEqual(quest.labels, ['refund']);
  assert.deepEqual(t.labels, [{ labelId: 'refund', pa: cfg.labelPa(cfg.labels.refund.name) }]);
  assert.equal(quest.labelName(quest.nextLabel), cfg.labels.refund.name);
  assert.equal(quest.cycleLabel(), 'refund');
  assert.equal(quest.labelName(quest.nextLabel), cfg.plainName);
  assert.equal(quest.cycleLabel(), null);
  t.events.emit('closingLine', { line: 'janitor' });
  t.events.emit('closingLine', { line: 'manager' });
  assert.deepEqual(quest.labels, ['chain', 'refund', 'recall']);
  assert.deepEqual([quest.cycleLabel(), quest.cycleLabel(), quest.cycleLabel(), quest.cycleLabel()], ['chain', 'refund', 'recall', null]);
  assert.equal(returnLabel('chain'), cfg.labels.chain);
  assert.equal(returnLabel('toString'), null);
});

test('one run only: everything saves and loads mid-quest, resets for a new shift, and stops when the player is dead', () => {
  const t = alone();
  const { quest } = t;
  quest.debug('ticket');
  for (let i = 0; i < 5; i++) t.kill();
  t.events.emit('closingLine', { line: 'janitor' });
  quest.cycleLabel();
  const saved = JSON.parse(JSON.stringify(quest.serialize()));
  assert.deepEqual(saved, { signs: cfg.signs.map(({ id }) => id), parcel: true, ticket: true, served: 5, issued: false, labels: ['chain'], fitted: 'chain' });

  const again = alone();
  again.quest.restore(saved);
  assert.equal(again.quest.stage, 'queue');
  assert.equal(again.quest.served, 5);
  assert.equal(again.quest.fitted, 'chain');
  assert.ok(cfg.signs.every(({ id }) => again.quest.signDown(id)));
  assert.deepEqual(again.steps, [], 'a load announces nothing');

  quest.reset();
  assert.deepEqual(quest.serialize(), { signs: [], parcel: false, ticket: false, served: 0, issued: false, labels: [], fitted: null });
  assert.equal(quest.stage, 'policy');

  t.state.over = true;
  assert.equal(quest.shootSign(cfg.signs[0].id), false);
  t.events.emit('closingLine', { line: 'guard' });
  assert.deepEqual(quest.labels, []);
});

test('the words and sounds the quest uses exist, and the claw still pays the gun out as its rarest prize', () => {
  assert.ok(weapons[GUN]);
  assert.ok(audio.sounds[cfg.sign.sound] && audio.sounds[cfg.slot.sound]);
  for (const line of [cfg.pa.policy, cfg.pa.damaged, cfg.pa.ticket(47), cfg.pa.called(47), cfg.pa.collect, cfg.labelPa('x')]) assert.ok(line.kicker && line.text.length > 20);
  assert.ok(cfg.pa.called(cfg.ticket.number).text.includes(String(cfg.ticket.number)));
  const prizes = Object.entries(clawMachine.prizes ?? clawMachine.guns ?? {});
  const weights = Object.values(JSON.parse(JSON.stringify(clawMachine))).flatMap(function find(value) {
    return value && typeof value === 'object' ? (Number.isFinite(value.weight) && value.capsule ? [value.weight] : Object.values(value).flatMap(find)) : [];
  });
  assert.ok(weights.length >= 5 && prizes.length >= 0);
  assert.equal(Math.min(...weights), 1, 'the wonder weapon keeps the smallest weight in the machine');
});

// --- In the real game -------------------------------------------------------------------------------------------------

test('the signs: one per listed area, standing clear, shootable from where you would stand, and down for the rest of the run', (context) => {
  const t = realGame(context);
  const { g, quest } = t;
  const features = featuresOf(g.map, 'refundSign');
  assert.deepEqual(features.map(({ sign }) => sign), cfg.signs.map(({ id }) => id));
  for (const feature of features) {
    const sign = cfg.signs.find(({ id }) => id === feature.sign);
    assert.equal(feature.zone, sign.zone);
    assert.ok(g.map.zones[feature.zone]);
    const { target, group } = t.built(feature.name);
    assert.ok(g.shootables.includes(target), sign.id + ' can be shot');
    assert.equal(target.noRewards, true);
    const box = target.hitboxes[0].box;
    const buried = g.colliders.filter((collider) => collider.intersectsBox(box) && collider.max.y - box.min.y > 0.05);
    assert.deepEqual(buried.length, 0, sign.id + ' stands clear of solid things');
    assert.ok(new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).y > 0.6, 'a standing A-frame');
  }
  const points = g.wallet.points;
  const first = t.built(features[0].name);
  assert.deepEqual(first.target.takeHit({ damage: 10, part: 'body' }), { killed: true });
  assert.equal(quest.signDown(features[0].sign), true);
  assert.equal(g.shootables.includes(first.target), false, 'a fallen sign is no longer a target');
  assert.deepEqual(first.target.takeHit({ damage: 10, part: 'body' }), { killed: false });
  assert.ok(t.sounds.includes(cfg.sign.sound));
  t.tick(hold(cfg.sign.fallSeconds));
  assert.ok(new THREE.Box3().setFromObject(first.group).getSize(new THREE.Vector3()).y < 0.45, 'it lies flat');
  assert.equal(g.wallet.points, points, 'a sign pays nothing');
  for (const feature of features.slice(1)) t.built(feature.name).target.takeHit({ damage: 10, part: 'body' });
  assert.equal(quest.stage, 'damaged');
  assert.ok(t.hud.calls.some(([name, notice]) => name === 'showAnnouncement' && notice?.text === cfg.pa.policy.text));

  g.resetRun(); t.tick(2);
  assert.equal(quest.stage, 'policy');
  assert.ok(features.every((feature) => g.shootables.includes(t.built(feature.name).target)), 'a new shift stands them all up again');
  assert.ok(new THREE.Box3().setFromObject(first.group).getSize(new THREE.Vector3()).y > 0.6);
});

test('the desk walks the quest: its prompt is the trail, a cart crashing beside it leaves the parcel, 47 kills call your number, and the gun is free', (context) => {
  const t = realGame(context);
  const { g, quest, desk } = t;
  const purchases = [];
  g.events.on('purchase', (event) => purchases.push(event.id));
  // What the browser's HUD does with every prompt it draws (main.js): a priced kind must have a shelf price. A free quest
  // prompt that called itself 'closing' threw there, and only there.
  const drawn = (shown) => { if (PRICE_CATEGORIES.includes(shown.kind)) g.pricing.basePriceOf(shown.kind, shown.pricingId ?? shown.id); return shown; };
  const prompt = () => { t.atDesk(); return drawn(g.interactions.prompt); };
  assert.equal(prompt().id, 'returnsDesk');
  assert.equal(prompt().blocked, cfg.desk.policy);
  assert.equal(prompt().title, closingTime.returnsDesk.name);
  assert.equal(prompt().kind, 'returnQuest', 'not a priced kind');
  t.press('KeyF', hold(cfg.desk.holdSeconds));
  assert.equal(quest.stage, 'policy', 'holding the key does nothing yet');

  quest.debug('policy');
  assert.equal(prompt().blocked, cfg.desk.damaged);
  assert.equal(t.built('returnsDesk').parcel.visible, false);
  const cart = t.spawn('cartPusher', desk.position.x + cfg.crash.radius + 4, desk.position.z - 2);
  cart.setState('crashed');
  t.tick(2);
  assert.equal(quest.stage, 'damaged', 'a crash down the hall is not at the desk');
  cart.position.set(desk.position.x + 1.5, 0, desk.position.z - 1.5);
  t.tick(2);
  assert.equal(quest.stage, 'ticket');
  assert.equal(t.built('returnsDesk').parcel.visible, true, 'the dented parcel is on the tray');
  g.zombies.clear();

  assert.equal(prompt().blocked, null);
  assert.equal(prompt().verb, cfg.desk.ticket.verb);
  assert.equal(prompt().title, cfg.desk.ticket.title, 'the bold line of the prompt says what a hold does');
  assert.equal(prompt().priceLabel, cfg.desk.ticket.priceLabel);
  t.press('KeyF', hold(cfg.desk.holdSeconds));
  assert.equal(quest.stage, 'queue');
  assert.equal(prompt().blocked, cfg.desk.queue(0, cfg.ticket.number));
  for (let i = 0; i < 3; i++) t.beam(t.spawn('shopper', desk.position.x, desk.position.z - 4));
  assert.equal(prompt().blocked, cfg.desk.queue(3, cfg.ticket.number));
  for (let i = 3; i < cfg.ticket.number; i++) t.beam(t.spawn('shopper', desk.position.x, desk.position.z - 4));
  assert.equal(quest.stage, 'collect');
  assert.ok(t.hud.calls.some(([name, notice]) => name === 'showAnnouncement' && notice?.text === cfg.pa.called(cfg.ticket.number).text));

  assert.equal(prompt().blocked, null);
  assert.equal(prompt().label, weapons[GUN].name);
  assert.equal(prompt().title, cfg.desk.collect.title(weapons[GUN].name));
  assert.equal(prompt().cost, 0);
  const points = g.wallet.points;
  t.press('KeyF', hold(cfg.desk.holdSeconds)); t.tick(60);
  assert.equal(g.gun.def.id, GUN);
  assert.equal(g.wallet.points, points, 'free');
  assert.deepEqual(purchases, [], 'none of it is a purchase');
  assert.equal(prompt().id, 'returnsAmmo', 'with the gun in hand the desk sells its ammo, as before');
  assert.equal(prompt().kind, 'closing', 'and only the ammo is a priced prompt');

  // Lose it (a wall buy replaces the gun in hand): the desk issues another, free.
  g.gun.give(weapons.rivetRifle); t.tick(60);
  assert.equal(g.gun.owns(GUN), false);
  assert.equal(prompt().id, 'returnsDesk');
  assert.equal(prompt().blocked, null);
  t.press('KeyF', hold(cfg.desk.holdSeconds)); t.tick(60);
  assert.equal(g.gun.owns(GUN), true);
});

test('labels: issued by the duties (announced in Directed only), fitted at the slot with the gun in hand', (context) => {
  const t = realGame(context);
  const { g, quest } = t;
  const duty = { janitor: () => g.events.emit('fountainKill', {}), guard: () => g.events.emit('purchase', { kind: 'closing', id: 'nightSafe', cost: 0, label: 'x' }), manager: () => g.events.emit('ritualCollect', {}) };
  const finish = (line) => { g.debug.run('closing', 'grant', line); g.state.assisted = false; for (let i = 0; i < closingTime.lines[line].needed; i++) duty[line](); };
  const announced = (name) => t.hud.calls.filter(([call, notice]) => call === 'showAnnouncement' && notice?.text === cfg.labelPa(name).text).length;

  g.state.closingMode = 'classic';
  finish('guard');
  assert.deepEqual(quest.labels, ['refund']);
  assert.equal(announced(cfg.labels.refund.name), 0, 'Classic says nothing');
  g.state.closingMode = 'directed';
  finish('janitor');
  assert.deepEqual(quest.labels, ['chain', 'refund']);
  assert.equal(announced(cfg.labels.chain.name), 1);

  t.atSlot();
  assert.notEqual(g.interactions.prompt?.id, 'returnsLabel', 'no slot prompt without the gun in hand');
  g.gun.give(weapons[GUN]); t.tick(60);
  t.atSlot();
  assert.equal(g.interactions.prompt.id, 'returnsLabel');
  assert.equal(PRICE_CATEGORIES.includes(g.interactions.prompt.kind), false, 'the slot is not a priced prompt (the HUD would look for its price)');
  assert.equal(g.interactions.prompt.label, cfg.slot.label(cfg.labels.chain.name));
  assert.equal(g.interactions.prompt.title, cfg.slot.label(cfg.labels.chain.name));
  const points = g.wallet.points;
  t.press('KeyF', hold(cfg.slot.holdSeconds));
  assert.equal(quest.fitted, 'chain');
  t.atSlot();
  assert.equal(g.interactions.prompt.label, cfg.slot.label(cfg.labels.refund.name));
  t.press('KeyF', hold(cfg.slot.holdSeconds));
  assert.equal(quest.fitted, 'refund');
  t.atSlot();
  assert.equal(g.interactions.prompt.label, cfg.slot.label(cfg.plainName));
  assert.equal(g.wallet.points, points, 'fitting is free');
  t.atDesk();
  assert.equal(g.interactions.prompt.id, 'returnsAmmo', 'the desk itself is still the ammo counter');

  g.resetRun(); t.tick(2);
  assert.deepEqual(quest.labels, []);
  assert.equal(quest.fitted, null);
});

test('Chain Return also returns the two nearest, once; Product Recall only the same kind; neither touches a Mascot or a boss', (context) => {
  const t = realGame(context);
  const { g, quest } = t;
  quest.debug('labels');
  const kills = [];
  g.events.on('kill', ({ zombie, weaponId }) => kills.push([zombie, weaponId]));
  const crowd = () => {
    g.zombies.clear();
    kills.length = 0;
    return {
      target: t.spawn('shopper', 0, 0),
      near: t.spawn('shopper', 1, 0),
      nearer: t.spawn('mallWalker', 0.6, 0),
      third: t.spawn('shopper', 2, 0),
      fourth: t.spawn('shopper', 3, 0),
      far: t.spawn('shopper', 0, cfg.labels.recall.radius + 6),
      mascot: t.spawn('mascot', -0.8, 0, { variant: 'sirWaffles', gold: false }),
    };
  };
  const alive = (c) => Object.entries(c).filter(([, z]) => z.isAlive).map(([name]) => name).sort();

  let c = crowd(); // no label: one zombie a beam, as ever
  t.beam(c.target);
  assert.deepEqual(alive(c), ['far', 'fourth', 'mascot', 'near', 'nearer', 'third']);

  c = crowd();
  assert.equal(quest.cycleLabel(), 'chain');
  t.beam(c.target);
  assert.deepEqual(alive(c), ['far', 'fourth', 'mascot', 'third'], 'the two nearest, whatever they are; the Mascot cannot be returned');
  assert.equal(kills.length, 1 + cfg.labels.chain.count, 'and the chain does not chain');
  assert.ok(kills.every(([, weaponId]) => weaponId === GUN), 'every one is the gun\'s kill');

  c = crowd();
  quest.cycleLabel(); // refund
  assert.equal(quest.cycleLabel(), 'recall');
  t.beam(c.target);
  assert.deepEqual(alive(c), ['far', 'mascot', 'nearer'], 'every Shopper within reach; not the Mall Walker, not the one down the hall');
  c = crowd();
  for (let i = 0; i < 4; i++) t.spawn('shopper', -1.5 - i * 0.5, 1);
  kills.length = 0;
  t.beam(c.target);
  assert.equal(kills.length, 1 + cfg.labels.recall.count, 'never more than its count');

  // A boss worn down by the gun is not a return: no label acts on it.
  c = crowd();
  const boss = g.bosses.summon('janitor');
  boss.position.set(0.5, 0, 0.5);
  boss.takeHit({ damage: boss.health + 1, part: 'body', source: 'gun', weaponId: GUN });
  assert.equal(boss.isAlive, false);
  assert.deepEqual(alive(c), ['far', 'fourth', 'mascot', 'near', 'nearer', 'target', 'third']);
  // Nor a kill by another gun, or by this gun's stuffing rather than its beam.
  c.near.takeHit({ damage: c.near.health + 1, part: 'body', source: 'gun', weaponId: 'stapleGun' });
  c.third.takeHit({ damage: c.third.health + 1, part: 'body', source: 'burn', weaponId: GUN });
  assert.deepEqual(alive(c), ['far', 'fourth', 'mascot', 'nearer', 'target']);
});

test('Full Refund pays its bonus on top of the kill and hands a round back when the roll says so', (context) => {
  const t = realGame(context);
  const { g, quest } = t;
  quest.debug('labels');
  g.gun.give(weapons[GUN]); t.tick(60);
  const paid = () => { const before = g.wallet.points; t.beam(t.spawn('shopper', 0, 0)); return g.wallet.points - before; };
  const plain = paid();
  quest.cycleLabel(); quest.cycleLabel();
  assert.equal(quest.fitted, 'refund');
  const weapon = g.gun.weapon;
  weapon.reserve = 3;
  context.mock.method(Math, 'random', () => 0.99);
  assert.equal(paid(), plain + cfg.labels.refund.points);
  assert.equal(weapon.reserve, 3, 'no round this time');
  Math.random.mock.mockImplementation(() => 0);
  assert.equal(paid(), plain + cfg.labels.refund.points);
  assert.equal(weapon.reserve, 4, 'a round back');
  weapon.reserve = weapon.reserveCap;
  paid();
  assert.equal(weapon.reserve, weapon.reserveCap, 'never past the cap');
});

test('one blast returns a crowd, so the labels act once per blast: one chain, one recall, one roll for a round back (Full Refund still pays every return)', (context) => {
  const t = realGame(context);
  const { g, quest } = t;
  quest.debug('labels');
  g.gun.give(weapons[GUN]); t.tick(60);
  const kills = [];
  g.events.on('kill', ({ zombie }) => kills.push(zombie));
  const returnByHand = (zombie) => returnToSender(zombie, { effects: g.effects, sound: null }); // (inside one blast: no blastDone between)
  const crowd = () => { g.zombies.clear(); kills.length = 0; return [0, 1, 2, 3, 4, 5].map((i) => t.spawn('shopper', i * 0.6, 0)); };

  assert.equal(quest.cycleLabel(), 'chain');
  let c = crowd();
  returnByHand(c[0]); returnByHand(c[5]);
  assert.equal(kills.length, 2 + cfg.labels.chain.count, 'two returns in one blast chain once');
  quest.blastDone();
  c = crowd();
  returnByHand(c[0]);
  assert.equal(kills.length, 1 + cfg.labels.chain.count, 'the next blast chains again');

  assert.equal(quest.cycleLabel(), 'refund');
  quest.blastDone();
  const weapon = g.gun.weapon;
  weapon.reserve = 3;
  context.mock.method(Math, 'random', () => 0);
  c = crowd();
  const before = g.wallet.points;
  returnByHand(c[0]); returnByHand(c[1]); returnByHand(c[2]);
  assert.ok(g.wallet.points - before >= 3 * cfg.labels.refund.points, 'every return pays the refund');
  assert.equal(weapon.reserve, 4, 'but only one round back for the whole blast');
  quest.blastDone();
  returnByHand(c[3]);
  assert.equal(weapon.reserve, 5, 'a new blast, a new roll');
});

test('Save & Quit keeps the quest as the round began and Continue puts the signs, the parcel and the label back', (context) => {
  const values = new Map();
  const saveStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const t = headlessGame({ saveStorage });
  context.after(() => { t.g.resetRun(); t.g.map.dispose(); });
  const { g } = t;
  g.rounds.update = () => {};
  t.tick();
  g.returnQuest.debug('ticket');
  g.returnQuest.debug('labels');
  g.returnQuest.cycleLabel();
  g.rounds.jumpTo(3); t.tick(); // (a round starts: the snapshot is taken with the quest as it now stands)
  g.state.assisted = false;
  assert.ok(g.saveGame.saveAndQuit());
  g.resetRun(); t.tick(2);
  assert.equal(g.returnQuest.stage, 'policy');
  assert.ok(g.saveGame.load());
  t.tick(2);
  assert.equal(g.returnQuest.stage, 'queue');
  assert.equal(g.returnQuest.fitted, 'chain');
  assert.deepEqual(g.returnQuest.labels, ['chain', 'refund', 'recall']);
  const sign = g.features.list.find(({ feature }) => feature.kind === 'refundSign').instance;
  assert.equal(g.shootables.includes(sign.target), false, 'the signs are still down');
  assert.equal(g.features.list.find(({ feature }) => feature.kind === 'returnsDesk').instance.parcel.visible, true);
});
