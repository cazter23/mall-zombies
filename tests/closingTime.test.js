import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { dt, headlessGame, snapshot } from './helpers/headlessGame.js';
import { bossTypes, bossTiming, bossVouchers } from '../src/config/bosses.js';
import { closingTime } from '../src/config/closingTime.js';
import { returnQuest } from '../src/config/returnQuest.js';
import { CAREER_STATS_KEY, CAREER_STATS_VERSION, createCareerStats } from '../src/game/careerStats.js';
import { chooseBossSchedule } from '../src/game/bossDirector.js';
import { getDeathReport, deathReports } from '../src/config/deathReports.js';
import { economy, zombieCountForRound, zombieHealthFor } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { hazards } from '../src/config/hazards.js';
import { dealHazardDamage } from '../src/game/features/hazards.js';
import { hitDamage, isReturnable, resolveGun, INSTANT_KILL_DAMAGE } from '../src/weapons/gunStats.js';
import { returnToSender } from '../src/weapons/returnToSender.js';
import { withTier } from '../src/weapons/upgrades.js';
import { weapons } from '../src/config/weapons.js';
import { workshopRitual } from '../src/config/workshop.js';
import { powerUps as pickupConfig } from '../src/config/powerUps.js';
import { parkingLot } from '../src/config/parkingLot.js';
import { overlapsSolid, rampHeightAt } from '../src/world/collision.js';
import { createHud } from '../src/ui/hud.js';
import { menuDom } from './helpers/menuDom.js';
import { createScreens, receiptLinesFor } from '../src/ui/screens.js';

const bossIds = Object.keys(closingTime.lines);

function fixture(t) {
  const scene = new Scene();
  const game = headlessGame({ scene });
  t.mock.method(Math, 'random', () => 0.12);
  t.after(() => { game.g.resetRun(); game.g.map.dispose(); });
  game.tick();
  return { ...game, props: scene.getObjectByName('closingKeys') };
}

function defeat(g, id, at) {
  const boss = g.bosses.summon(id);
  assert.ok(boss, id);
  boss.position.copy(at);
  boss.takeHit({ damage: boss.health, part: 'body', source: 'gun' });
  return boss;
}

for (const id of bossIds) {
  test(id + ' drops one key and keeps its usual reward', (t) => {
    const { g, tick, standAt } = fixture(t);
    const at = new Vector3(2, 0, 12);
    const drops = [];
    g.events.on('closingKeyDrop', (event) => drops.push(event));

    const boss = defeat(g, id, at);
    assert.deepEqual(g.closing.pickups, [{ bossId: id, position: at }]);
    assert.deepEqual(drops, [{ bossId: id, position: at, pa: closingTime.pa.drop(closingTime.lines[id].key) }]);
    tick();
    assert.equal(g.powerUps.pickup?.id, boss.type.reward);

    g.rounds.skipRound();
    defeat(g, id, at); // An encore cannot duplicate a key already on the floor.
    assert.equal(drops.length, 1);
    standAt(at.x, at.z);
    g.rounds.skipRound();
    defeat(g, id, at); // Nor can it duplicate a held key.
    assert.equal(drops.length, 1);
    assert.ok(g.closing.hasKey(id));
    assert.equal(g.closing.done, 0, 'a key never ticks a line by itself');
  });
}

test('two keys stay through round changes and cleanup; collecting one opens just its duty', (t) => {
  const { g, tick, standAt, hud, props } = fixture(t);
  const ring = new Vector3(2, 0, 12);
  const safe = new Vector3(-2, 0, 12);
  const notices = [];
  for (const name of ['closingKey', 'closingLine']) g.events.on(name, (event) => notices.push([name, event]));

  defeat(g, 'janitor', ring);
  g.rounds.skipRound();
  g.powerUps.cleanSpill(ring);
  defeat(g, 'guard', safe);
  g.rounds.skipRound();
  g.rounds.update = () => {}; // Leave the floor clear while advancing past normal pickup lifetimes.
  tick(1800);
  assert.deepEqual(g.closing.pickups, [{ bossId: 'janitor', position: ring }, { bossId: 'guard', position: safe }]);
  assert.equal(g.closing.done, 0);
  assert.ok(props.getObjectByName('janitor').visible);
  g.player.yaw = 0; // (face -Z, as the old spawn did: the start room now spawns facing +Z, feel.player.spawnYaw)
  assert.equal(g.closing.markers.janitor.bearing, Math.PI / 2);
  assert.equal(g.closing.markers.guard.bearing, -Math.PI / 2);

  standAt(safe.x, safe.z);
  assert.equal(g.closing.done, 0);
  assert.deepEqual(g.closing.checklist.filter(({ count }) => count === 0).map(({ bossId }) => bossId), ['guard']);
  assert.deepEqual(g.closing.pickups, [{ bossId: 'janitor', position: ring }]);
  assert.ok(props.getObjectByName('janitor').visible);
  assert.ok(!props.getObjectByName('guard').visible);
  assert.equal(g.closing.markers.guard, undefined);
  const { key, needed } = closingTime.lines.guard;
  const pa = closingTime.pa.openNightSafe(key, needed);
  assert.deepEqual(notices, [['closingKey', { bossId: 'guard', pa }]]);
  const announcements = hud.calls.filter(([name]) => name === 'showAnnouncement').map(([, notice]) => notice.text);
  assert.ok(announcements.includes(closingTime.pa.drop(key).text));
  assert.ok(announcements.includes(pa.text));
});

test('death freezes checklist progress and Play again clears the held and floor keys', (t) => {
  const { g, standAt, props } = fixture(t);
  assert.ok(g.debug.keylessIds.includes('closing'));
  assert.ok(!g.debug.commands.some(({ id }) => id === 'closing'));
  assert.match(g.debug.run('closing', 'grant', 'influencer'), /Granted/);
  assert.match(g.debug.run('closing', 'drop', 'janitor', new Vector3(2, 0, 12)), /Dropped/);
  assert.ok(g.state.assisted);

  const events = [];
  for (const name of ['closingKeyDrop', 'closingKey', 'closingLine']) g.events.on(name, () => events.push(name));
  g.health.takeDamage(g.stats.maxHealth);
  assert.ok(g.state.over);
  standAt(2, 12);
  const zombie = { type: { id: 'manager' }, position: g.player.position };
  g.events.emit('bossDefeated', { zombie });
  g.events.emit('bossVanished', { zombie });
  assert.match(g.debug.run('closing', 'grant', 'manager'), /ended/);
  assert.match(g.debug.run('closing', 'drop', 'influencer'), /ended/);
  assert.deepEqual(events, []);
  assert.ok(g.closing.hasKey('influencer'));
  assert.equal(g.closing.done, 0);
  assert.ok(receiptLinesFor(g.death.summary).some(([label, value]) => label === 'Closing checklist' && value === '0 of 4'));

  g.resetRun();
  assert.equal(g.closing.done, 0);
  assert.equal(g.closing.checklist.length, 4);
  assert.ok(g.closing.checklist.every(({ done }) => !done));
  assert.deepEqual(g.closing.pickups, []);
  assert.deepEqual(g.closing.markers, {});
  assert.ok(props.children.every((prop) => !prop.visible));
});

// Is this spot floor a player can stand on and collect from? A floor or ramp surface right under it, and room for the pickup.
function assertOnClearFloor(g, position, label) {
  const { x, y, z } = position;
  const tops = g.colliders.filter((box) => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z).map((box) => box.max.y);
  const ramps = g.colliders.ramps.map((ramp) => rampHeightAt(ramp, x, z)).filter((height) => height !== null);
  assert.ok([...tops, ...ramps].some((height) => Math.abs(height - y) < 1e-6), label + ': it rests on a floor or ramp surface');
  assert.ok(!overlapsSolid(position, pickupConfig.clearRadius, pickupConfig.clearHeight, g.colliders, 0), label + ': nothing solid in it');
}

test('a key from a boss killed on an escalator ramp, and one killed against a wall, both land on floor the player can reach', (t) => {
  const { g, tick } = fixture(t);
  g.map.areaUnlocks.openAll(); // (the hallway escalator is repaired and walkable)
  g.rounds.update = () => {};
  tick();

  // Halfway up the hallway escalator.
  const ramp = g.colliders.ramps.find(({ id }) => id === 'escalator');
  const rampX = (ramp.minX + ramp.maxX) / 2, rampZ = (ramp.minZ + ramp.maxZ) / 2;
  const onRamp = new Vector3(rampX, rampHeightAt(ramp, rampX, rampZ), rampZ);
  assert.ok(onRamp.y > 1 && onRamp.y < 5, 'mid-ramp, well off both floors');
  defeat(g, 'janitor', onRamp);
  // Pressed against the start room's east wall (x 5).
  const wallX = g.map.playerSpawn.position.x + 5;
  const atWall = new Vector3(wallX - 0.05, 0, 12);
  assert.ok(overlapsSolid(atWall, pickupConfig.clearRadius, pickupConfig.clearHeight, g.colliders, 0), 'the body lies in the wall');
  g.rounds.skipRound(); // (one boss a round)
  defeat(g, 'guard', atWall);

  const pickups = Object.fromEntries(g.closing.pickups.map(({ bossId, position }) => [bossId, position]));
  assert.deepEqual(Object.keys(pickups), ['janitor', 'guard'], 'both keys dropped at once, neither is waiting for floor');
  assertOnClearFloor(g, pickups.janitor, 'ramp key');
  assert.ok(Math.abs(pickups.janitor.y - onRamp.y) <= pickupConfig.floorTolerance, 'on the escalator, not on the floor under it');
  assertOnClearFloor(g, pickups.guard, 'wall key');
  assert.ok(pickups.guard.x < wallX && pickups.guard.distanceTo(atWall) <= pickupConfig.placementRadii.at(-1) + 1e-6, 'inside the room, beside the body');

  // The player walks onto each spot and collects it.
  for (const id of ['janitor', 'guard']) {
    g.player.teleport({ position: pickups[id].clone(), yaw: 0 });
    tick(2);
    assert.ok(g.closing.hasKey(id), id + ' collected where it lay');
    assert.ok(Math.abs(g.player.position.y - pickups[id].y) <= pickupConfig.floorTolerance, 'the player stands at its height');
  }
  assert.deepEqual(g.closing.pickups, []);
});

test('a boss that vanishes while the player is mid-jump drops its key once they come down', (t) => {
  const { g, tick, input } = fixture(t);
  g.rounds.update = () => {};
  const drops = [];
  g.events.on('closingKeyDrop', ({ position }) => drops.push(position));
  assert.ok(g.bosses.summon('janitor'));
  g.health.invulnerable = true;
  tick();
  input.pressed.add('Space');
  input.held.add('Space');
  for (let i = 0; i < 60 && g.player.position.y <= pickupConfig.floorTolerance + 0.1; i++) tick();
  input.held.delete('Space');
  assert.ok(!g.player.grounded && g.player.position.y > pickupConfig.floorTolerance, 'in the air, too high for any floor to count');

  g.zombies.clear(); // the boss is gone without a kill: the director reports it vanished
  tick();
  assert.equal(g.bosses.active, null);
  assert.deepEqual(drops, [], 'no floor under a jumping player: the key waits');
  assert.deepEqual(g.closing.pickups, []);
  assert.ok(!g.closing.hasKey('janitor'));

  for (let i = 0; i < 120 && !g.player.grounded; i++) tick();
  tick(2);
  assert.ok(g.player.grounded);
  assert.equal(drops.length, 1, 'dropped once');
  assert.ok(Math.abs(drops[0].y) < 1e-6, 'on the floor');
  assert.ok(Math.hypot(drops[0].x - g.player.position.x, drops[0].z - g.player.position.z) <= pickupConfig.placementRadii.at(-1) + 0.5);
  assert.ok(g.closing.hasKey('janitor'), 'and collected, since it fell at their feet');
  tick(30);
  assert.equal(drops.length, 1);
});

test('a vanished boss drops its key at the player through the director', (t) => {
  const { g, tick } = fixture(t);
  assert.ok(g.bosses.summon('influencer'));
  const feet = g.player.position.clone();
  g.zombies.clear();
  tick();
  assert.equal(g.bosses.active, null);
  assert.deepEqual(g.closing.pickups, [{ bossId: 'influencer', position: feet }]);
  assert.ok(!g.closing.hasKey('influencer'));
  tick();
  assert.ok(g.closing.hasKey('influencer'));
  assert.equal(g.closing.done, 0, 'the Van Keys do not tick line 4');
  assert.deepEqual(g.closing.pickups, []);
});

const holdTicks = Math.ceil(feel.interact.holdSeconds / dt) + 1;

function approachVan(game) {
  const { g, standAt, tick } = game;
  const van = g.map.features.find(({ kind }) => kind === 'escapeVan');
  standAt(van.position.x + 1, van.position.z, 90);
  assert.equal(g.interactions.prompt, null, 'requires Customer Parking to be unlocked');
  g.map.areaUnlocks.openAll();
  tick();
  assert.equal(g.interactions.prompt?.id, van.name);
}

function grantKeys(g, ids = bossIds) {
  for (const id of ids) assert.match(g.debug.run('closing', 'grant', id), /Granted/);
  g.state.assisted = false; // stand in for earned keys in the career integration tests
}

// Lines 1 to 3, finished through the events the real duties send (the fountain, the Night Safe, the Naming Booth).
const dutyIds = bossIds.filter((id) => closingTime.lines[id].needed);
function finishDuties(g, ids = dutyIds) {
  const dutyEvents = {
    janitor: () => g.events.emit('fountainKill', {}),
    guard: () => g.events.emit('purchase', { label: closingTime.nightSafe.name, cost: 0, kind: 'closing', id: 'nightSafe' }),
    manager: () => g.events.emit('ritualCollect', {}),
  };
  for (const id of ids) {
    const done = g.closing.checklist.find(({ bossId }) => bossId === id).count ?? 0;
    for (let i = done; i < closingTime.lines[id].needed; i++) dutyEvents[id]();
    assert.ok(g.closing.isDone(id), id);
  }
}

// Stand in for the machine's paid purchase in tests about the win/receipt rather than the payment.
// Existing receipt/win fixtures stand in for the encounter. Phase 8 cases below kill the real boss.
function defeatCustomer(g) {
  g.events.emit('bossDefeated', { zombie: { type: bossTypes.lastCustomer, position: g.player.position }, round: g.rounds.round });
}

function validate(g) {
  g.events.emit('purchase', { kind: 'closing', id: 'validation', label: closingTime.validation.name, cost: 0 });
}

// Everything the van asks for: the four keys, lines 1 to 3 and validation.
function readyToLeave(g) {
  grantKeys(g);
  finishDuties(g);
  validate(g);
  defeatCustomer(g);
  assert.ok(g.closing.readyToLeave);
}

test("the HUD's next step walks the whole quest: waiting, a key on the floor, each duty with its count, validation, the Last Customer, the van", (t) => {
  const game = fixture(t), { g } = game;
  const o = closingTime.objective;
  assert.equal(g.closing.nextStep, o.waiting, 'nothing to act on yet: who carries the keys');

  // A key on the floor comes first; picked up, its duty (with its count) is the step.
  game.standAt(0, 12);
  assert.match(g.debug.run('closing', 'drop', 'janitor', new Vector3(2.5, 0, 12)), /Dropped/);
  assert.equal(g.closing.pickups.length, 1);
  assert.equal(g.closing.nextStep, o.collect(closingTime.lines.janitor.key));
  const [{ position }] = g.closing.pickups;
  game.standAt(position.x, position.z);
  game.tick();
  assert.ok(g.closing.hasKey('janitor'), 'walked onto the key');
  assert.equal(g.closing.nextStep, `${o.duty.janitor} 0/${closingTime.lines.janitor.needed}`);
  g.events.emit('fountainKill', {});
  assert.equal(g.closing.nextStep, `${o.duty.janitor} 1/${closingTime.lines.janitor.needed}`);
  finishDuties(g, ['janitor']);
  assert.equal(g.closing.nextStep, o.keys, 'a duty done, keys still out there');

  grantKeys(g, bossIds.filter((id) => id !== 'janitor'));
  assert.equal(g.closing.nextStep, `${o.duty.guard} 0/${closingTime.lines.guard.needed}`, 'the next open duty, in checklist order');
  finishDuties(g);
  assert.equal(g.closing.nextStep, o.validate);
  validate(g);
  assert.equal(g.closing.nextStep, o.lastCustomer);
  defeatCustomer(g);
  assert.equal(g.closing.nextStep, o.leave);
});

test('the van explains missing keys and duties, then a hold wins once and Clock out freezes the run', (t) => {
  const game = fixture(t);
  const { g, tick, press, hud } = game;
  const wins = [], ends = [];
  let deaths = 0;
  const career = createCareerStats();
  const { lines, van } = closingTime;
  g.events.on('runWon', ({ summary }) => wins.push(summary));
  g.events.on('runEnd', ({ summary }) => { ends.push(summary); career.recordRun(summary); });
  g.events.on('playerDeath', () => deaths++);
  approachVan(game);
  assert.equal(g.interactions.prompt.blocked, van.blockedPrefix + [...bossIds.map((id) => lines[id].key), closingTime.validation.missing, closingTime.finale.missing].join(', '));

  // Keys first, then the duty whose key is held but which is not done.
  grantKeys(g, ['janitor']);
  assert.equal(g.interactions.prompt.blocked,
    van.blockedPrefix + [lines.guard.key, lines.manager.key, lines.influencer.key, lines.janitor.duty, closingTime.validation.missing, closingTime.finale.missing].join(', '));

  grantKeys(g, ['guard', 'manager']);
  assert.match(g.interactions.prompt.blocked, /Skylar's Van Keys/);
  press('KeyF', holdTicks);
  assert.equal(g.state.won, false);

  // Four keys are not enough: the van refuses and names each unfinished duty.
  grantKeys(g, ['influencer']);
  assert.deepEqual(g.closing.missingKeys, []);
  assert.equal(g.interactions.prompt.blocked, van.blockedPrefix + [...dutyIds.map((id) => lines[id].duty), closingTime.validation.missing, closingTime.finale.missing].join(', '));
  finishDuties(g, ['janitor', 'guard']);
  assert.equal(g.interactions.prompt.blocked, van.blockedPrefix + [lines.manager.duty, closingTime.validation.missing, closingTime.finale.missing].join(', '));
  press('KeyF', holdTicks);
  g.events.emit('escapeVanStart');
  assert.equal(g.state.won, false, 'four keys and an unfinished duty do not start the van');
  assert.equal(wins.length, 0);

  finishDuties(g, ['manager']);
  assert.equal(g.interactions.prompt.blocked, van.blockedPrefix + [closingTime.validation.missing, closingTime.finale.missing].join(', '));
  press('KeyF', holdTicks);
  g.events.emit('escapeVanStart');
  assert.equal(g.state.won, false, 'completed duties still require validation');
  validate(g);
  defeatCustomer(g);
  assert.equal(g.interactions.prompt.blocked, null);
  press('KeyF', holdTicks);
  assert.equal(g.state.won, true);
  assert.equal(g.state.over, false);
  assert.equal(g.state.running, false);
  assert.equal(g.rounds.round, 1, 'there is no round gate');
  assert.equal(wins.length, 1);
  assert.equal(wins[0], g.winSummary);
  assert.ok(Object.isFrozen(wins[0]));
  g.events.emit('escapeVanStart');
  tick(holdTicks);
  assert.equal(wins.length, 1);
  assert.equal(g.runStats.timeAlive, wins[0].timeAlive);
  assert.equal(ends.length, 0);

  const before = g.wallet.points;
  assert.ok(g.clockOut());
  assert.equal(g.state.over, true);
  assert.equal(g.clockOut(), false);
  assert.equal(g.stayForOvertime(), false);
  g.events.emit('kill', { zombie: { type: { id: 'shopper' }, position: g.player.position } });
  g.events.emit('hit', { target: { type: { id: 'shopper' } }, killed: false });
  tick(Math.ceil(feel.death.resultsDelay / dt) + 1);
  assert.equal(g.wallet.points, before);
  assert.equal(g.runStats.kills, wins[0].kills);
  assert.equal(g.death.timer, 0);
  assert.equal(deaths, 0);
  assert.ok(!hud.calls.some(([name]) => name === 'showResults'));
  assert.deepEqual(ends, wins);
  assert.equal(career.snapshot().totals.wins, 1);
});

// A real break: the wave is fought down, so the next round is announced and nothing of it has spawned yet.
function playToBreak(game, round) {
  const { g, tick } = game;
  for (let i = 0; i < 6000 && !(g.rounds.inBreak && g.rounds.round === round); i++) {
    tick();
    for (const zombie of [...g.zombies.zombies]) zombie.takeHit({ damage: zombie.health, part: 'body', source: 'gun' });
  }
  assert.ok(g.rounds.inBreak, 'in the break');
  assert.equal(g.rounds.round, round);
  assert.equal(g.zombies.aliveCount, 0);
}

test('a win in the break keeps the announced round: overtime restarts its full break and skips nothing', (t) => {
  const game = fixture(t);
  const { g, tick, press, standAt } = game;
  const starts = [], announced = [], discards = [];
  g.events.on('overtimeStart', ({ round }) => starts.push(round));
  g.events.on('roundStart', ({ round }) => announced.push(round));
  g.events.on('roundDiscard', () => discards.push(g.rounds.round));
  approachVan(game);
  readyToLeave(g);
  g.health.invulnerable = true; // (the wave is only here to be fought down)
  playToBreak(game, 2);
  tick(Math.round(economy.rounds.breakSeconds / dt / 4)); // part of the break has gone
  assert.ok(g.rounds.breakRemaining < economy.rounds.breakSeconds);
  const van = g.map.features.find(({ kind }) => kind === 'escapeVan');
  standAt(van.position.x + 1, van.position.z, 90);
  announced.length = 0;

  press('KeyF', holdTicks);
  const win = g.winSummary;
  assert.equal(win.round, 2);
  assert.ok(g.stayForOvertime());
  assert.equal(g.rounds.round, 2, 'round 2 was announced and has spawned nothing: overtime plays it');
  assert.ok(g.rounds.inBreak);
  assert.equal(g.rounds.breakRemaining, economy.rounds.breakSeconds, 'a fresh full break');
  assert.equal(g.rounds.remainingToSpawn, zombieCountForRound(2));
  assert.deepEqual(starts, [2]);
  assert.deepEqual(announced, [], 'the round is not announced a second time');
  assert.deepEqual(discards, [], 'there was no wave to discard');

  g.rounds.endBreak(0);
  tick(3);
  assert.equal(g.rounds.state, 'active');
  assert.ok(g.zombies.aliveCount > 0, 'round 2 arrives after the break');
  assert.equal(g.rounds.round, 2);
  g.health.invulnerable = false;
  g.health.takeDamage(g.stats.maxHealth * 10);
  assert.equal(g.death.summary.winRound, 2);
  assert.equal(g.death.summary.overtimeRounds, 0, 'died in the first overtime round');
});

test('a boss voucher on the floor stays through Stay for overtime and still pays on expiry; a debug skip deletes it', (t) => {
  const game = fixture(t);
  const { g, tick, press } = game;
  const expired = [];
  g.events.on('powerUpExpire', (event) => expired.push(event));
  approachVan(game);
  readyToLeave(g);
  tick(Math.ceil(economy.rounds.firstRoundDelay / dt) + 1);
  assert.equal(g.rounds.state, 'active', 'a wave is live, so Stay for overtime discards it');

  const far = new Vector3(2, 0, 12);
  const boss = defeat(g, 'influencer', far);
  const voucher = bossVouchers[boss.type.reward];
  assert.ok(voucher?.pointsInstead > 0);
  tick();
  assert.equal(g.powerUps.pickup?.id, boss.type.reward);
  const lying = g.powerUps.pickup.position.clone();

  press('KeyF', holdTicks);
  assert.ok(g.state.winPending);
  assert.ok(g.stayForOvertime());
  assert.equal(g.rounds.round, g.winSummary.round + 1);
  assert.equal(g.powerUps.pickup?.id, boss.type.reward, 'the voucher is still on the floor');
  assert.deepEqual(g.powerUps.pickup.position, lying);

  g.rounds.update = () => {}; // (no overtime zombies while its timer runs out)
  const before = g.wallet.points;
  tick(Math.ceil(g.powerUps.pickup.remaining / dt) + 1);
  assert.equal(g.powerUps.pickup, null);
  assert.deepEqual(expired, [{ id: boss.type.reward, pointsInstead: voucher.pointsInstead }]);
  assert.equal(g.wallet.points - before, voucher.pointsInstead, 'it pays its pointsInstead as any expiry does');

  // Debug skipRound / jumpTo keep their behaviour: the uncollected boss reward goes with the wave and pays nothing.
  const next = defeat(g, 'guard', far);
  tick();
  assert.equal(g.powerUps.pickup?.id, next.type.reward);
  const points = g.wallet.points;
  g.rounds.skipRound();
  assert.equal(g.powerUps.pickup, null);
  assert.equal(g.wallet.points, points);
  assert.equal(expired.length, 1);
});

test('overtime starts a normal next round with the same wallet and loadout; death records the win once', (t) => {
  const game = fixture(t);
  const { g, tick, press, hud } = game;
  const career = createCareerStats();
  const starts = [], ends = [];
  g.events.on('overtimeStart', ({ round }) => starts.push(round));
  g.events.on('runEnd', ({ summary }) => { ends.push(summary); career.recordRun(summary); });
  g.wallet.earn(250);
  g.gun.give(weapons.nailGun);
  const points = g.wallet.points;
  const slots = [...g.gun.slots];
  approachVan(game);
  readyToLeave(g);
  tick(Math.ceil(economy.rounds.firstRoundDelay / dt) + 1);
  assert.equal(g.rounds.state, 'active', 'a wave is live');
  assert.ok(g.zombies.spawn('shopper'));
  press('KeyF', holdTicks);
  const win = g.winSummary;
  assert.ok(win?.won);
  assert.ok(g.stayForOvertime());
  assert.equal(g.stayForOvertime(), false);
  assert.equal(g.clockOut(), false);
  assert.equal(g.state.running, true);
  assert.equal(g.state.winPending, false);
  assert.equal(g.state.over, false);
  assert.equal(g.rounds.round, win.round + 1);
  assert.equal(g.zombies.aliveCount, 0, 'the previous wave is discarded without payouts');
  assert.equal(g.rounds.breakRemaining, economy.rounds.breakSeconds);
  assert.equal(g.rounds.remainingToSpawn, zombieCountForRound(win.round + 1));
  assert.deepEqual(starts, [win.round + 1]);
  assert.equal(g.wallet.points, points);
  assert.deepEqual(g.gun.slots, slots);
  assert.equal(g.interactions.prompt, null);
  tick(10);
  assert.equal(g.rounds.round, win.round + 1);
  assert.ok(g.runStats.timeAlive > win.timeAlive);
  assert.equal(ends.length, 0);

  g.health.takeDamage(g.stats.maxHealth);
  tick(Math.ceil(feel.death.resultsDelay / dt) + 1);
  assert.equal(g.state.over, true);
  assert.equal(ends.length, 1);
  assert.equal(g.death.summary, ends[0]);
  assert.equal(g.death.summary.won, true);
  assert.equal(g.death.summary.winTime, win.timeAlive);
  assert.equal(g.death.summary.winRound, win.round);
  assert.ok(hud.calls.some(([name, summary]) => name === 'showResults' && summary === ends[0]));
  assert.equal(career.snapshot().totals.runs, 1);
  assert.equal(career.snapshot().totals.wins, 1);
  assert.equal(career.snapshot().bests.fastestWin, win.timeAlive);

  g.resetRun();
  assert.equal(g.state.won, false);
  assert.equal(g.state.winPending, false);
  assert.equal(g.state.over, false);
  assert.equal(g.winSummary, null);
  assert.equal(g.death.summary, null);
  assert.equal(g.rounds.round, 0);
  assert.equal(g.closing.done, 0);
  assert.equal(g.wallet.points, economy.startingPoints);
  assert.deepEqual(g.gun.slots, ['stapleGun']);
});

test('a won run left from the menu in overtime is recorded once; a run that was never won is not', (t) => {
  const game = fixture(t);
  const { g, tick, press } = game;
  const career = createCareerStats({ storage: { getItem: () => null, setItem() {} } });
  const ends = [];
  g.events.on('runEnd', ({ summary }) => { ends.push(summary); career.recordRun(summary); });

  tick(30);
  assert.equal(g.leaveRun(), false, 'quitting a run that was never won records nothing');
  assert.equal(g.state.over, false);
  assert.deepEqual(ends, []);

  approachVan(game);
  readyToLeave(g);
  press('KeyF', holdTicks);
  const win = g.winSummary;
  assert.ok(g.stayForOvertime());
  tick(120);
  g.events.emit('kill', { zombie: { type: { id: 'shopper' }, position: g.player.position }, source: 'gun' });
  assert.equal(g.runStats.kills, win.kills + 1);

  // Quit to title / Restart run: main.js calls leaveRun() before resetRun().
  assert.equal(g.leaveRun(), true);
  assert.equal(ends.length, 1);
  assert.equal(ends[0].won, true);
  assert.equal(ends[0].winTime, win.timeAlive);
  assert.equal(ends[0].winRound, win.round);
  assert.equal(ends[0].kills, win.kills + 1, 'the win summary plus what overtime added');
  assert.ok(ends[0].timeAlive > win.timeAlive);
  assert.equal(g.state.over, true);
  assert.equal(g.leaveRun(), false, 'a second call records nothing');
  assert.equal(ends.length, 1);
  assert.equal(career.snapshot().totals.runs, 1);
  assert.equal(career.snapshot().totals.wins, 1);
  assert.equal(career.snapshot().bests.fastestWin, win.timeAlive);

  g.resetRun();
  assert.equal(g.leaveRun(), false);

  // While the receipt's choice is still pending, leaving records the win summary itself.
  approachVan(game);
  readyToLeave(g);
  press('KeyF', holdTicks);
  assert.ok(g.state.winPending);
  assert.equal(g.leaveRun(), true);
  assert.equal(ends[1], g.winSummary);
  assert.equal(g.clockOut(), false);
  assert.equal(career.snapshot().totals.wins, 2);

  // Every other ending still records exactly once: a death, then leaving, adds nothing.
  g.resetRun();
  tick();
  g.health.takeDamage(g.stats.maxHealth);
  assert.equal(ends.length, 3);
  assert.equal(g.leaveRun(), false);
  assert.equal(ends.length, 3);
  assert.equal(career.snapshot().totals.runs, 3);
});

test('career version 1 migrates old records and saves the fastest win by time at the van', () => {
  let saved = JSON.stringify({
    version: 1,
    totals: { runs: 3, kills: 27 },
    bests: { round: 7, accuracy: 0.5 },
    recentRuns: [{ round: 7, kills: 10, endedAt: '2026-11-10' }],
  });
  const storage = {
    getItem: (key) => key === CAREER_STATS_KEY ? saved : null,
    setItem: (key, value) => { assert.equal(key, CAREER_STATS_KEY); saved = value; },
  };
  const career = createCareerStats({ storage });
  const migrated = career.snapshot();
  assert.equal(migrated.version, CAREER_STATS_VERSION);
  assert.equal(migrated.totals.runs, 3);
  assert.equal(migrated.totals.kills, 27);
  assert.equal(migrated.totals.wins, 0);
  assert.equal(migrated.bests.round, 7);
  assert.equal(migrated.bests.accuracy, 0.5);
  assert.equal(migrated.bests.fastestWin, null);
  assert.equal(migrated.recentRuns[0].endedAt, '2026-11-10');
  assert.equal(migrated.recentRuns[0].won, false);

  career.recordRun({ timeAlive: 60, won: true, winTime: 50 });
  career.recordRun({ timeAlive: 90, won: true, winTime: 40 });
  career.recordRun({ timeAlive: 20, won: true, winTime: 20, assisted: true });
  const reloaded = createCareerStats({ storage }).snapshot();
  assert.equal(reloaded.totals.runs, 5);
  assert.equal(reloaded.totals.wins, 2);
  assert.equal(reloaded.bests.fastestWin, 40);
});

test('the PA introduces the checklist once per run, shortly after the opening line, through the quest PA listener', (t) => {
  const { g, tick, hud, sounds } = fixture(t);
  const briefings = [];
  g.events.on('closingBriefing', (event) => briefings.push(event));
  const said = () => hud.calls.filter(([name, notice]) => name === 'showAnnouncement' && notice.text === closingTime.pa.briefing.text);
  const wait = Math.ceil(closingTime.briefing.delaySeconds / dt);

  tick(wait - 10); // (the fixture already ran the tick that announced round 1)
  assert.deepEqual(briefings, []);
  sounds.length = 0;
  tick(12);
  assert.deepEqual(briefings, [{ pa: closingTime.pa.briefing }]);
  assert.match(briefings[0].pa.text, /cannot close until the closing checklist is done/);
  assert.match(briefings[0].pa.text, /carried by a member of staff/);
  assert.equal(said().length, 1);
  assert.equal(said()[0][1].priority, 1);
  assert.ok(sounds.includes('paChime'));

  g.rounds.jumpTo(1); // round 1 announced again in the same run: no second briefing
  tick(wait + 5);
  assert.equal(briefings.length, 1);

  g.resetRun();
  tick(wait + 5);
  assert.equal(briefings.length, 2, 'once per run');
});

test('line-opening and line-complete PA lines are marked to be kept by the PA queue; the others are not', (t) => {
  const { g, hud, standAt } = fixture(t);
  const at = new Vector3(2, 0, 12);
  g.events.emit('bossDefeated', { zombie: { type: { id: 'manager' }, position: at } });
  standAt(at.x, at.z);
  g.events.emit('ritualCollect', {});
  const said = Object.fromEntries(hud.calls.filter(([name]) => name === 'showAnnouncement').map(([, notice]) => [notice.text, notice]));
  const { key } = closingTime.lines.manager;
  assert.equal(said[closingTime.pa.openLastOrders(key).text].keep, true);
  assert.equal(said[closingTime.pa.completeLastOrders.text].keep, true);
  assert.equal(said[closingTime.pa.drop(key).text].keep, undefined);
  assert.equal(closingTime.pa.briefing.keep, undefined);
  for (const pa of [closingTime.pa.completeFountain, closingTime.pa.completeNightSafe, closingTime.pa.vanKeys('k'),
    closingTime.pa.openFountain('k', 1), closingTime.pa.openNightSafe('k', 1)]) assert.equal(pa.keep, true);
});

test('Statistics shows career wins, the fastest win (a dash when none) and marks won shifts', () => {
  const { document } = menuDom();
  const screens = createScreens();
  const career = createCareerStats({ storage: { getItem: () => null, setItem() {} } });
  const cards = (selector) => Object.fromEntries(document.querySelector(selector).children
    .map((card) => card.children.map((node) => node.textContent)));
  const { stats } = closingTime;

  career.recordRun({ round: 6, timeAlive: 300, kills: 40 });
  screens.show('stats', career.snapshot());
  assert.equal(cards('.stats-totals')[stats.wins], '0');
  assert.equal(cards('.stats-bests')[stats.fastestWin], stats.noWin);
  assert.equal(document.querySelectorAll('.stats-won').length, 0);

  career.recordRun({ round: 19, timeAlive: 1500, kills: 400, won: true, winTime: 1385 });
  career.recordRun({ round: 3, timeAlive: 90, kills: 9 });
  screens.show('stats', career.snapshot());
  assert.equal(cards('.stats-totals')[stats.wins], '1');
  assert.equal(cards('.stats-bests')[stats.fastestWin], '23:05');
  const rows = document.querySelectorAll('.stats-run'); // newest first
  assert.deepEqual(rows.map((row) => row.classList.contains('won')), [false, true, false]);
  assert.deepEqual(rows.map((row) => row.querySelectorAll('.stats-won').length), [0, 1, 0]);
  assert.equal(rows[1].querySelector('.stats-won').textContent, stats.wonMark);
});
test('Play again after win + overtime + death, and after Clock out, equals a fresh game including Closing Time state', (t) => {
  const untouched = headlessGame(); // (built before the fixture mocks Math.random)
  const fresh = snapshot(untouched.g);
  t.after(() => untouched.g.map.dispose());
  assert.deepEqual(fresh.closing, {
    checklist: bossIds.map((id) => [id, false, null]), keys: [], pickups: [], markers: [], validated: false, closingRound: null, lastCustomerDefeated: false, readyToLeave: false,
  });
  assert.deepEqual([fresh.won, fresh.winPending, fresh.winSummary, fresh.overtimeFrom], [false, false, null, null]);

  const game = fixture(t);
  const { g, tick, press } = game;
  const again = () => { g.resetRun(); return snapshot(g); };
  assert.deepEqual(again(), fresh);

  // A lost run with a key on the floor, a key held and a duty part done.
  tick();
  g.events.emit('bossDefeated', { zombie: { type: { id: 'guard' }, position: new Vector3(3, 0, 13) } });
  grantKeys(g, ['janitor']);
  g.events.emit('fountainKill', {});
  let now = snapshot(g);
  assert.deepEqual(now.closing.pickups, [['guard', 3, 0, 13]]);
  assert.deepEqual(now.closing.keys, ['janitor']);
  assert.deepEqual(now.closing.checklist[0], ['janitor', false, 1]);
  g.health.takeDamage(g.stats.maxHealth);
  assert.deepEqual(again(), fresh);

  // Win, stay for overtime, play on, die.
  tick();
  approachVan(game);
  readyToLeave(g);
  tick(Math.ceil(economy.rounds.firstRoundDelay / dt) + 1);
  press('KeyF', holdTicks);
  assert.ok(g.stayForOvertime());
  g.rounds.skipRound();
  tick(20);
  g.health.takeDamage(g.stats.maxHealth);
  tick(Math.ceil(feel.death.resultsDelay / dt) + 1);
  now = snapshot(g);
  assert.deepEqual([now.over, now.won, now.winPending, now.overtimeFrom], [true, true, false, 2]);
  assert.ok(now.winSummary && now.closing.checklist.every(([, done]) => done) && now.closing.keys.length === 4);
  assert.deepEqual(again(), fresh);

  // Win and Clock out.
  tick();
  approachVan(game);
  readyToLeave(g);
  press('KeyF', holdTicks);
  assert.ok(snapshot(g).winPending);
  assert.ok(g.clockOut());
  now = snapshot(g);
  assert.deepEqual([now.over, now.won, now.winPending, now.overtimeFrom], [true, true, false, null]);
  assert.equal(now.closing.checklist.filter(([, done]) => done).length, 4);
  assert.deepEqual(again(), fresh);

  // Win, overtime, then leaving from the menu (Quit to title / Restart run).
  tick();
  approachVan(game);
  readyToLeave(g);
  press('KeyF', holdTicks);
  assert.ok(g.stayForOvertime());
  tick(5);
  assert.ok(g.leaveRun());
  assert.deepEqual(again(), fresh);
});

test('the HUD draws the four boxes (tick, count) from the game checklist and points to a key on the floor', (t) => {
  const { g, standAt } = fixture(t);
  const { document } = menuDom();
  const hud = createHud();
  const boxes = document.querySelectorAll('.closing-box');
  const shownMarkers = () => document.querySelectorAll('.bag-marker').filter((node) => !node.hidden);
  const show = () => hud.setClosing(g.closing.checklist, g.closing.markers);
  assert.equal(boxes.length, 4);
  assert.equal(document.querySelector('.closing-boxes').getAttribute('aria-label'), closingTime.title);

  show();
  assert.deepEqual(boxes.map((box) => [box.textContent, box.getAttribute('aria-checked')]), Array(4).fill(['', 'false']));
  assert.deepEqual(shownMarkers(), []);

  // A key on the floor gets a marker with its name; picking it up removes the marker and opens the line's count.
  const { key, duty, needed } = closingTime.lines.janitor;
  g.events.emit('bossDefeated', { zombie: { type: { id: 'janitor' }, position: new Vector3(3, 0, 13) } });
  standAt(-3, 10);
  show();
  assert.equal(shownMarkers().length, 1);
  assert.ok(shownMarkers()[0].textContent.includes(key));
  assert.ok(shownMarkers()[0].textContent.includes(String(g.closing.markers.janitor.meters)));
  standAt(3, 13);
  show();
  assert.deepEqual(shownMarkers(), []);
  assert.equal(boxes[0].textContent, closingTime.lineProgress(0, needed));
  assert.equal(boxes[0].getAttribute('aria-label'), duty + ' ' + closingTime.lineProgress(0, needed));
  assert.ok(boxes[0].classList.contains('has-progress'));

  g.events.emit('fountainKill', {});
  show();
  assert.equal(boxes[0].textContent, closingTime.lineProgress(1, needed));
  finishDuties(g, ['janitor']);
  show();
  assert.equal(boxes[0].textContent, '✓ ' + closingTime.lineProgress(needed, needed));
  assert.equal(boxes[0].getAttribute('aria-checked'), 'true');
  assert.deepEqual(boxes.slice(1).map((box) => box.getAttribute('aria-checked')), ['false', 'false', 'false']);

  // The fourth box is the game's too: unticked with the Van Keys, ticked by the win.
  grantKeys(g, ['guard', 'manager', 'influencer']);
  finishDuties(g);
  show();
  assert.deepEqual(boxes.map((box) => box.getAttribute('aria-checked')), ['true', 'true', 'true', 'false']);
  validate(g);
  defeatCustomer(g);
  g.events.emit('escapeVanStart');
  show();
  assert.equal(boxes[3].getAttribute('aria-checked'), 'true');
  assert.equal(boxes[3].textContent, '✓');

  const tag = document.querySelector('.overtime-tag');
  assert.equal(tag.textContent, closingTime.overtimeTag);
  assert.equal(tag.hidden, true);
  hud.setOvertime(true);
  assert.equal(tag.hidden, false);
});

test('a career save from a newer version is left untouched: a blank ledger for the session, nothing written', () => {
  const newer = JSON.stringify({
    version: CAREER_STATS_VERSION + 1,
    totals: { runs: 40, wins: 6, kills: 9000, somethingNew: 3 },
    bests: { round: 31, fastestWin: 1200 },
    recentRuns: [{ round: 31, won: true, winTime: 1200, endedAt: '2027-01-02' }],
  });
  let stored = newer;
  const writes = [];
  const storage = {
    getItem: (key) => key === CAREER_STATS_KEY ? stored : null,
    setItem: (key, value) => { writes.push(key); stored = value; },
  };
  const career = createCareerStats({ storage });
  assert.equal(career.snapshot().totals.runs, 0, 'a blank ledger for this session');
  assert.equal(career.snapshot().bests.fastestWin, null);

  const result = career.recordRun({ round: 4, timeAlive: 120, kills: 12, won: true, winTime: 100 });
  assert.equal(result.saved, true);
  assert.equal(career.snapshot().totals.runs, 1, 'the session still counts its own runs');
  assert.equal(career.snapshot().totals.wins, 1);
  career.reset();
  assert.equal(career.snapshot().totals.runs, 0);
  assert.deepEqual(writes, []);
  assert.equal(stored, newer, 'the stored save is exactly as it was');

  // Unknown or corrupt OLDER data behaves as before: blank, and replaced at the next save.
  for (const old of [JSON.stringify({ version: 0, totals: { runs: 9 } }), '{not json', JSON.stringify({ totals: { runs: 9 } })]) {
    stored = old;
    writes.length = 0;
    const fresh = createCareerStats({ storage });
    assert.equal(fresh.snapshot().totals.runs, 0);
    fresh.recordRun({ round: 2, timeAlive: 30 });
    assert.equal(writes.length, 1);
    assert.equal(JSON.parse(stored).version, CAREER_STATS_VERSION);
    assert.equal(JSON.parse(stored).totals.runs, 1);
  }
});

// Line 4 belongs to the game: the win ticks it, with no browser code involved.
test('the Van Keys tick nothing; the win itself ticks line 4, so the game reads 3 before the van and 4 after', (t) => {
  const game = fixture(t);
  const { g, press, standAt, hud } = game;
  const keyNotices = [], ticked = [];
  g.events.on('closingKey', (event) => keyNotices.push(event));
  g.events.on('closingLine', (event) => ticked.push(event));
  const at = new Vector3(2, 0, 12);
  g.events.emit('bossDefeated', { zombie: { type: { id: 'influencer' }, position: at } });
  standAt(at.x, at.z);
  const { key } = closingTime.lines.influencer;
  assert.deepEqual(keyNotices, [{ bossId: 'influencer', pa: closingTime.pa.vanKeys(key) }]);
  assert.equal(keyNotices[0].pa.text, key + ' collected. Finish the duties, then validate parking at the ticket machine by the van.');
  assert.ok(hud.calls.some(([name, notice]) => name === 'showAnnouncement' && notice.text === keyNotices[0].pa.text));
  assert.deepEqual(ticked, []);

  approachVan(game);
  grantKeys(g, dutyIds);
  finishDuties(g);
  assert.deepEqual(g.closing.missingKeys, []);
  assert.equal(g.closing.done, 3);
  assert.deepEqual(g.closing.checklist.map(({ done }) => done), [true, true, true, false]);
  ticked.length = 0;
  validate(g);
  defeatCustomer(g);

  press('KeyF', holdTicks);
  assert.ok(g.state.won);
  assert.equal(g.closing.done, 4);
  assert.deepEqual(g.closing.checklist.map(({ done }) => done), [true, true, true, true]);
  assert.deepEqual(ticked, [{ line: 'influencer', done: 4, total: 4 }]);
  assert.equal(g.winSummary.closingDone, 4);
  assert.equal(Object.fromEntries(receiptLinesFor({ ...g.winSummary, shiftComplete: true }))[closingTime.title], '4 of 4');
  assert.equal(g.closing.completeLeaving(), false, 'line 4 is ticked once');
  assert.equal(ticked.length, 1);
});

test('win receipt offers both choices, then restores the death receipt for an overtime death', (t) => {
  const game = fixture(t);
  const { g, press } = game;
  approachVan(game);
  readyToLeave(g);
  press('KeyF', holdTicks);

  const { document } = menuDom();
  const screens = createScreens();
  const button = (action) => document.querySelector(`[data-action="${action}"]`);
  const heading = document.querySelector('.receipt-shift-heading');
  const incident = document.querySelector('.receipt-incident');
  const win = { ...g.winSummary, shiftComplete: true };
  const picks = [];
  screens.on('clockOut', () => picks.push('clockOut'));
  screens.on('overtime', ({ pad }) => { picks.push(pad); g.stayForOvertime(); });
  screens.show('results', win);
  assert.equal(heading.textContent, 'SHIFT COMPLETE');
  assert.equal(heading.hidden, false);
  assert.equal(incident.hidden, true);
  assert.equal(button('playAgain').hidden, true);
  assert.equal(document.activeElement, button('clockOut'));
  button('clockOut').click();
  const presses = new Set(['PadDown', 'PadA']);
  screens.padNav({ consumePress: (code) => presses.delete(code) });
  assert.deepEqual(picks, ['clockOut', true]);

  screens.show('results', { ...win, clockedOut: true });
  assert.equal(button('overtime').hidden, true);
  assert.equal(button('playAgain').hidden, false);
  assert.equal(heading.hidden, false);

  assert.equal(g.rounds.round, 1); // (won in round 1's opening break: round 1 is the first overtime round)
  g.rounds.skipRound(); // die in round 2: one overtime round survived
  g.health.takeDamage(g.stats.maxHealth);
  screens.show('results', g.death.summary);
  assert.equal(heading.hidden, true);
  assert.equal(incident.hidden, false);
  assert.equal(button('clockOut').hidden, true);
  assert.equal(button('playAgain').hidden, false);
  const lines = Object.fromEntries(receiptLinesFor(g.death.summary));
  assert.match(lines['CLOCKED OUT'], /Round 1/);
  assert.equal(lines['Overtime rounds survived'], 1);
  assert.equal(Object.fromEntries(receiptLinesFor(win))['CLOCKED OUT'], undefined);
  assert.equal(g.death.summary.overtimeRounds, 1);
  assert.equal(Object.fromEntries(receiptLinesFor({ ...g.death.summary, overtimeRounds: 0 }))['Overtime rounds survived'], 0);
});


// Phase 4: Line 1, the fountain
test('the fountain duty opens with the key, counts only its killing blows, ticks once and resets', (t) => {
  const { g, tick, hud } = fixture(t);
  const cfg = hazards.fountain;
  const { key, needed } = closingTime.lines.janitor;
  const at = new Vector3(cfg.center.x + cfg.innerRadius + 1, 0, cfg.center.z);
  const fountain = g.features.list.find(({ feature }) => feature.kind === 'fountainHazard').instance;
  const line = () => g.closing.checklist.find(({ bossId }) => bossId === 'janitor');
  const spawn = (id) => {
    const zombie = g.zombies.spawn(id, at, { gold: false });
    zombie.health = cfg.zombieDamage * cfg.maxHealthCap;
    return zombie;
  };
  const progress = [], completed = [], fountainKills = [];
  g.events.on('closingProgress', (event) => progress.push(event));
  g.events.on('closingLine', (event) => completed.push(event));
  g.events.on('fountainKill', ({ zombie }) => fountainKills.push(zombie));
  g.rounds.update = () => {};

  const beforeKey = spawn('shopper');
  assert.ok(fountain.trigger());
  assert.ok(!beforeKey.isAlive);
  assert.deepEqual(progress, []);
  assert.equal(line().count, undefined);

  grantKeys(g, ['janitor']);
  assert.equal(line().count, 0);
  assert.equal(line().done, false);
  assert.deepEqual(completed, []);

  const gunKill = spawn('shopper');
  gunKill.takeHit({ damage: gunKill.health, part: 'body', source: 'gun' });
  assert.ok(dealHazardDamage(spawn('shopper'), cfg.zombieDamage, cfg).killed);
  assert.deepEqual(progress, [], 'gun kills and generic hazard kills are ignored even during a fountain activation');

  const boss = g.bosses.summon('guard');
  assert.ok(boss);
  boss.position.copy(at);
  boss.health = boss.maxHealth * cfg.maxHealthCap / 2;
  const mascot = spawn('mascot');
  const pulseTicks = Math.ceil(cfg.pulseInterval / dt) + 1;
  tick(pulseTicks);
  assert.ok(fountainKills.includes(boss));
  assert.ok(fountainKills.includes(mascot));
  assert.equal(progress.length, 2);

  for (let i = progress.length; i < needed - 1; i++) spawn('shopper');
  tick(pulseTicks);
  assert.equal(line().count, needed - 1);
  assert.equal(line().done, false);

  spawn('shopper');
  tick(pulseTicks);
  assert.equal(line().done, true);
  assert.equal(g.closing.done, 1);
  assert.deepEqual(progress, Array.from({ length: needed }, (_, i) => ({ line: 'janitor', count: i + 1, needed })));
  assert.deepEqual(completed, [{ line: 'janitor', done: 1, total: bossIds.length, pa: closingTime.pa.completeFountain }]);
  const announcements = hud.calls.filter(([name]) => name === 'showAnnouncement').map(([, notice]) => notice.text);
  assert.equal(announcements.filter((text) => text === closingTime.pa.openFountain(key, needed).text).length, 1);
  assert.equal(announcements.filter((text) => text === closingTime.pa.completeFountain.text).length, 1);

  tick(Math.ceil((cfg.durationSeconds + cfg.cooldownSeconds) / dt));
  const extra = spawn('shopper');
  assert.ok(fountain.trigger(), 'the breaker still works after the box is checked');
  assert.ok(!extra.isAlive);
  assert.equal(progress.length, needed);
  assert.equal(completed.length, 1);

  g.resetRun();
  assert.equal(line().done, false);
  assert.equal(line().count, undefined);
  assert.ok(g.closing.missingKeys.includes(key));
  grantKeys(g, ['janitor']);
  assert.equal(line().count, 0);
  spawn('shopper');
  assert.ok(fountain.trigger());
  assert.equal(line().count, 1);

  g.health.takeDamage(g.stats.maxHealth);
  g.events.emit('fountainKill', { zombie: extra });
  assert.equal(line().count, 1, 'nothing more counts after death');
});


// Phase 5: Line 2, the night safe
function atNightSafe(t) {
  const game = fixture(t);
  const { g, tick, standAt } = game;
  g.rounds.update = () => {};
  g.zombies.clear();
  const safe = g.map.features.find(({ kind }) => kind === 'nightSafe');
  const approach = () => standAt(safe.position.x + 1.2, safe.position.z, 90);
  approach();
  assert.equal(g.interactions.prompt, null, 'requires the Main Hallway to be unlocked');
  g.map.areaUnlocks.unlock('hallway');
  tick();
  assert.equal(g.interactions.prompt?.id, 'nightSafe');
  return { ...game, safe, approach, line: () => g.closing.checklist.find(({ bossId }) => bossId === 'guard') };
}

test('the Night Safe and the three existing counters keep their own prompts', (t) => {
  const { g, safe, approach, standAt } = atNightSafe(t);
  const desk = g.map.features.find(({ kind }) => kind === 'upgradeDesk');
  const prize = g.map.features.find(({ kind }) => kind === 'prizeCounter').slots[0];
  for (const [spot, kind] of [[desk.position, 'tier'], [desk.meleePosition, 'melee'], [prize.position, 'prize']]) {
    standAt(spot.x, spot.z - 1.4, 180);
    assert.equal(g.interactions.prompt?.kind, kind);
  }
  approach();
  assert.equal(g.interactions.prompt?.id, safe.name);
});

test('the Night Safe refuses without the key or enough points', (t) => {
  const { g, press, line } = atNightSafe(t);
  const { key } = closingTime.lines.guard;
  const purchases = [], progress = [];
  g.events.on('purchase', (event) => purchases.push(event));
  g.events.on('closingProgress', (event) => progress.push(event));
  const price = g.pricing.priceOf('closing', 'nightSafe');
  g.wallet.earn(price);
  assert.ok(g.interactions.prompt.blocked.includes(key));
  const before = g.wallet.points;
  press('KeyF', holdTicks);
  assert.equal(g.wallet.points, before);
  assert.equal(line().count, undefined);

  grantKeys(g, ['guard']);
  assert.equal(line().count, 0);
  assert.equal(line().done, false);
  assert.ok(g.wallet.spend(g.wallet.points - price + 1));
  assert.equal(g.interactions.prompt.shortfall, 1);
  press('KeyF', holdTicks);
  assert.equal(g.wallet.points, price - 1);
  assert.equal(g.interactions.prompt.denied, true);
  assert.equal(line().count, 0);
  assert.deepEqual(purchases, []);
  assert.deepEqual(progress, []);
});

test('four priced deposits honor both discounts, tick the duty once and reset on Play again', (t) => {
  const { g, press, tick, line, approach, hud } = atNightSafe(t);
  const { key, needed } = closingTime.lines.guard;
  const purchases = [], progress = [], completed = [];
  g.events.on('purchase', (event) => purchases.push(event));
  g.events.on('closingProgress', (event) => progress.push(event));
  g.events.on('closingLine', (event) => completed.push(event));
  grantKeys(g, ['guard']);
  const base = g.pricing.priceOf('closing', 'nightSafe');
  assert.equal(base, economy.closing.nightSafe);
  assert.ok(economy.flashSales.groups.every(({ categories }) => !categories.includes('closing')));
  g.wallet.earn(base * needed);

  function deposit(count, hold = holdTicks) {
    const price = g.pricing.priceOf('closing', 'nightSafe');
    const before = g.wallet.points;
    assert.equal(g.interactions.prompt.cost, price);
    press('KeyF', hold);
    assert.equal(before - g.wallet.points, price);
    assert.deepEqual(purchases.at(-1), { kind: 'closing', id: 'nightSafe', label: closingTime.nightSafe.name, cost: price });
    assert.equal(line().count, count);
    assert.equal(line().done, count === needed);
  }

  deposit(1, holdTicks * 3); // Holding continuously still pays for one deposit.
  assert.ok(g.pricing.setVoucher(bossVouchers.discountCode));
  assert.ok(g.interactions.prompt.cost < base);
  deposit(2);
  assert.equal(g.pricing.voucher, null);
  assert.ok(g.powerUps.debugDrop('employeeDiscount'));
  tick();
  assert.ok(g.interactions.prompt.cost < base);
  deposit(3);
  assert.equal(g.interactions.prompt.cost, base, 'the Employee Discount was consumed');
  deposit(needed);
  assert.equal(g.closing.done, 1);
  assert.equal(g.interactions.prompt.priceLabel, 'Done');
  assert.equal(g.interactions.prompt.blocked, closingTime.lines.guard.duty);

  const remaining = g.wallet.points;
  press('KeyF', holdTicks);
  assert.equal(g.wallet.points, remaining);
  assert.equal(purchases.length, needed);
  assert.deepEqual(progress, Array.from({ length: needed }, (_, i) => ({ line: 'guard', count: i + 1, needed })));
  assert.deepEqual(completed, [{ line: 'guard', done: 1, total: bossIds.length, pa: closingTime.pa.completeNightSafe }]);
  const announcements = hud.calls.filter(([name]) => name === 'showAnnouncement').map(([, notice]) => notice.text);
  assert.equal(announcements.filter((text) => text === closingTime.pa.openNightSafe(key, needed).text).length, 1);
  assert.equal(announcements.filter((text) => text === closingTime.pa.completeNightSafe.text).length, 1);

  g.resetRun();
  assert.equal(line().count, undefined);
  assert.equal(line().done, false);
  assert.ok(g.closing.missingKeys.includes(key));
  g.map.areaUnlocks.unlock('hallway');
  approach();
  assert.ok(g.interactions.prompt.blocked.includes(key));
  grantKeys(g, ['guard']);
  assert.equal(line().count, 0);
  g.wallet.earn(base);
  deposit(1);
});


// Phase 6: Line 3, last orders
function atBuildABlaster(t, game = fixture(t)) {
  const { g, press, tick } = game;
  g.rounds.update = () => {};
  g.zombies.clear();
  g.map.areaUnlocks.openAll();
  const { feature: bench, instance: { ritual } } = g.features.list.find(({ feature }) => feature.kind === 'workshop');
  g.wallet.earn(g.pricing.priceOf('workshop', 'ritual') + g.pricing.priceOf('workshop', 'restuff'));

  function order(kind = 'ritual') {
    const { x, y, z } = bench.position;
    g.player.teleport({ position: new Vector3(x, y - 1, z - 1), yaw: Math.PI });
    tick();
    assert.equal(g.interactions.prompt?.id, 'orderForm');
    press('KeyF', holdTicks);
    tick();
    const points = g.wallet.points;
    const price = g.pricing.priceOf('workshop', kind);
    assert.equal(ritual.form.cost, price);
    press('KeyF');
    tick();
    assert.equal(ritual.phase, 'running');
    assert.equal(g.wallet.points, points - price);
  }

  function collect() {
    ritual.finishNow();
    tick(Math.ceil(workshopRitual.catchUpSeconds / dt) + 3);
    assert.equal(ritual.phase, 'idle');
  }

  return { ...game, order, collect };
}

test('a build collected before the Signature is ignored, then a Restuff ticks Last orders once and Play again resets it', (t) => {
  const { g, tick, standAt, order, collect, hud } = atBuildABlaster(t);
  const { key, needed } = closingTime.lines.manager;
  const { openLastOrders, completeLastOrders } = closingTime.pa;
  const collections = [], completed = [];
  g.events.on('ritualCollect', (event) => collections.push(event));
  g.events.on('closingLine', (event) => completed.push(event));

  order();
  collect();
  assert.equal(collections.length, 1);
  assert.equal(g.closing.isDone('manager'), false);

  const pickup = new Vector3(2, 0, 12);
  defeat(g, 'manager', pickup);
  standAt(pickup.x, pickup.z);
  assert.ok(g.closing.hasKey('manager'));
  assert.equal(g.closing.isDone('manager'), false);
  assert.deepEqual(completed, []);

  tick(30); // Let the returned gun finish switching before placing the Restuff.
  order('restuff');
  assert.equal(g.closing.isDone('manager'), false);
  const points = g.wallet.points;
  collect();
  assert.equal(g.wallet.points, points);
  assert.equal(collections.length, 2);
  assert.equal(collections[1].build.name, collections[0].build.name);
  assert.ok(g.closing.isDone('manager'));
  assert.equal(g.closing.checklist.find(({ bossId }) => bossId === 'manager').count, needed);

  g.events.emit('ritualCollect', collections[1]);
  assert.deepEqual(completed, [{ line: 'manager', done: 1, total: bossIds.length, pa: completeLastOrders }]);
  const announcements = hud.calls.filter(([name]) => name === 'showAnnouncement').map(([, notice]) => notice.text);
  assert.equal(announcements.filter((text) => text === openLastOrders(key).text).length, 1);
  assert.equal(announcements.filter((text) => text === completeLastOrders.text).length, 1);

  g.resetRun();
  assert.equal(g.closing.hasKey('manager'), false);
  assert.equal(g.closing.isDone('manager'), false);
  assert.equal(g.closing.checklist.find(({ bossId }) => bossId === 'manager').count, undefined);
  g.events.emit('ritualCollect', collections[1]);
  assert.equal(completed.length, 1);
  grantKeys(g, ['manager']);
  g.events.emit('ritualCollect', collections[1]);
  assert.equal(completed.length, 2);
});

test('an order already running at Signature pickup ticks Last orders when the build is collected', (t) => {
  const { g, order, collect } = atBuildABlaster(t);
  order();
  grantKeys(g, ['manager']);
  assert.equal(g.closing.isDone('manager'), false);
  collect();
  assert.ok(g.closing.isDone('manager'));
});

// Run modes: Directed (the default) and Classic (no checklist, key pointers or quest PA).
const closingNotices = (hud) => hud.calls.filter(([name, notice]) => name === 'showAnnouncement' && notice.kicker === 'Closing time');
const played = (sounds, id) => sounds.filter((sound) => sound === id).length;

test('a Classic run: short prompts that say what is true, key and duty sounds with no quest PA, and a win that needs the duties', (t) => {
  const game = fixture(t);
  const { g, standAt, press, tick, hud, sounds } = game;
  const { lines, classic } = closingTime;
  g.state.closingMode = 'classic';
  g.rounds.update = () => {};
  g.zombies.clear();
  const van = g.map.features.find(({ kind }) => kind === 'escapeVan');
  const atVan = () => { standAt(van.position.x + 1, van.position.z, 90); return g.interactions.prompt.blocked; };
  approachVan(game);
  assert.equal(g.interactions.prompt.blocked, "Needs Murray's Key Ring", 'the van names the first missing key');

  const safe = g.map.features.find(({ kind }) => kind === 'nightSafe');
  const approachSafe = () => standAt(safe.position.x + 1.2, safe.position.z, 90);
  approachSafe();
  assert.equal(g.interactions.prompt.id, 'nightSafe');
  assert.equal(g.interactions.prompt.blocked, "Needs Kettle's Safe Key");
  assert.equal(g.interactions.prompt.blocked, classic.needs + lines.guard.key);

  // The physical keys: each pickup plays the key sound; Classic shows no quest PA and plays no PA chime for it.
  hud.calls.length = sounds.length = 0;
  const at = new Vector3(2, 0, 12);
  for (const id of bossIds) {
    g.events.emit('bossDefeated', { zombie: { type: { id }, position: at } });
    assert.ok(game.props.getObjectByName(id).visible);
  }
  standAt(at.x, at.z);
  assert.deepEqual(g.closing.missingKeys, []);
  assert.equal(g.closing.pickups.length, 0);
  assert.equal(played(sounds, 'closingKey'), bossIds.length);
  assert.equal(played(sounds, 'paChime'), 0);
  assert.deepEqual(closingNotices(hud), []);

  // Every key held is not enough (A1): the van names an unfinished duty by its place, one at a time.
  assert.equal(atVan(), 'Unfinished: Fountain');
  assert.equal(atVan(), classic.unfinished + lines.janitor.place);
  press('KeyF', holdTicks);
  assert.equal(g.state.won, false);

  for (let i = 0; i < lines.janitor.needed; i++) g.events.emit('fountainKill', {});
  assert.equal(played(sounds, 'closingDuty'), 1, 'a finished duty plays its confirmation sound');
  assert.equal(atVan(), 'Unfinished: Night Safe');

  const deposit = g.pricing.priceOf('closing', 'nightSafe');
  g.wallet.earn(deposit * lines.guard.needed);
  approachSafe();
  assert.equal(g.interactions.prompt.blocked, null);
  const before = g.wallet.points;
  for (let i = 0; i < lines.guard.needed; i++) press('KeyF', holdTicks);
  assert.equal(before - g.wallet.points, deposit * lines.guard.needed);
  assert.equal(g.interactions.prompt.blocked, 'Done');
  assert.equal(played(sounds, 'closingDuty'), 2);
  assert.equal(atVan(), 'Unfinished: Build-A-Blaster');
  assert.deepEqual(closingNotices(hud), [], 'still no quest PA');
  assert.equal(played(sounds, 'paChime'), 0);

  const { order, collect } = atBuildABlaster(t, game);
  order();
  collect();
  assert.equal(played(sounds, 'closingDuty'), 3);
  assert.equal(g.closing.done, dutyIds.length, 'lines 1 to 3: the win ticks line 4');

  const career = createCareerStats({ storage: { getItem: () => null, setItem() {} } });
  g.events.on('runEnd', ({ summary }) => career.recordRun(summary));
  assert.equal(atVan(), classic.needs + closingTime.validation.missing);
  validate(g);
  defeatCustomer(g);
  assert.equal(atVan(), null);
  press('KeyF', holdTicks);
  assert.ok(g.winSummary?.won);
  assert.equal(g.closing.done, bossIds.length);
  assert.equal(played(sounds, 'closingDuty'), 4);
  assert.deepEqual(closingNotices(hud), []);
  assert.ok(g.stayForOvertime());
  assert.equal(g.rounds.round, g.winSummary.round, 'won in the opening break: overtime plays that round');
  g.health.takeDamage(g.stats.maxHealth);
  assert.equal(career.snapshot().totals.wins, 1);
  assert.equal(g.death.summary.won, true);
  g.resetRun(); // Restart run and Play again both use this reset.
  assert.equal(g.state.closingMode, 'classic');
  assert.deepEqual(g.closing.missingKeys, bossIds.map((id) => closingTime.lines[id].key));
  tick();
});

test('quest PA and chimes reach presentation only in Directed; the key and duty sounds, ordinary PA and quest events work in both', (t) => {
  const { g, hud, sounds, standAt, tick } = fixture(t);
  const pa = { kicker: 'Workshop', text: 'Your order is ready.' };
  const at = new Vector3(2, 0, 12);
  const messages = [], briefings = [];
  g.events.on('closingKeyDrop', ({ pa }) => messages.push(pa.text));
  g.events.on('closingBriefing', () => briefings.push(g.state.closingMode));

  for (const mode of ['directed', 'classic']) {
    g.resetRun();
    g.state.closingMode = mode;
    standAt(0, 12);
    hud.calls.length = sounds.length = 0;
    g.events.emit('bossDefeated', { zombie: { type: { id: 'manager' }, position: at } });
    standAt(at.x, at.z);
    g.events.emit('ritualCollect', { pa });
    const notices = hud.calls.filter(([name]) => name === 'showAnnouncement').map(([, notice]) => notice);
    assert.ok(notices.some((notice) => notice.text === pa.text));
    assert.equal(closingNotices(hud).length, mode === 'directed' ? 3 : 0);
    assert.equal(played(sounds, 'paChime'), mode === 'directed' ? 5 : 1); // (Directed: + the return label this duty issues)
    assert.equal(played(sounds, 'closingKey'), 1, mode + ': the key pickup sound');
    assert.equal(played(sounds, 'closingDuty'), 1, mode + ': the finished duty sound');

    // The once-per-run briefing is quest PA too: the event fires in both modes, the PA reads it only in Directed.
    hud.calls.length = 0;
    tick(Math.ceil(closingTime.briefing.delaySeconds / dt) + 2);
    assert.equal(closingNotices(hud).filter(([, notice]) => notice.text === closingTime.pa.briefing.text).length, mode === 'directed' ? 1 : 0);
  }
  assert.deepEqual(briefings, ['directed', 'classic']);
  assert.deepEqual(messages, Array(2).fill(closingTime.pa.drop(closingTime.lines.manager.key).text));
});

test('the fountain switch shows the count in its own prompt while the Key Ring is held and the line is open, in both modes', (t) => {
  const { g, tick, standAt } = fixture(t);
  const { needed, promptCount } = closingTime.lines.janitor;
  const { feature } = g.features.list.find(({ feature }) => feature.kind === 'fountainHazard');
  const note = (count) => promptCount(closingTime.lineProgress(count, needed));
  assert.equal(note(3), 'Shocked 3/12');
  const atSwitch = () => {
    const { x, z } = feature.position, n = feature.normal;
    standAt(x + n.x, z + n.z, Math.atan2(n.x, n.z) * 180 / Math.PI); // one step out from the wall, facing the switch
    assert.equal(g.interactions.prompt?.kind, 'hazard');
    return g.interactions.prompt.detail;
  };

  for (const mode of ['directed', 'classic']) {
    g.resetRun();
    g.state.closingMode = mode;
    g.rounds.update = () => {};
    tick();
    g.map.areaUnlocks.openAll();
    assert.equal(atSwitch(), hazards.fountain.detail, mode + ': no count before the key');
    grantKeys(g, ['janitor']);
    assert.equal(atSwitch(), hazards.fountain.detail + ' · ' + note(0), mode);
    for (let i = 0; i < 3; i++) g.events.emit('fountainKill', {});
    assert.equal(atSwitch(), hazards.fountain.detail + ' · ' + note(3), mode);
    finishDuties(g, ['janitor']);
    assert.equal(atSwitch(), hazards.fountain.detail, mode + ': no count once the line is ticked');
  }
});

test('a Classic receipt has no checklist line: closingDone null is the one value, set by the game for the death and win receipts', (t) => {
  const game = fixture(t);
  const { g, tick, press, hud } = game;
  const dieAndShow = () => {
    g.health.takeDamage(g.stats.maxHealth);
    tick(Math.ceil(feel.death.resultsDelay / dt) + 1);
    return hud.calls.filter(([name]) => name === 'showResults').at(-1)[1];
  };
  const checklistLine = (receipt) => Object.fromEntries(receiptLinesFor(receipt))[closingTime.title];

  // Directed: the receipt IS the summary, with its number.
  let shown = dieAndShow();
  assert.equal(shown, g.death.summary);
  assert.equal(shown.closingDone, 0);
  assert.equal(checklistLine(shown), '0 of 4');
  assert.equal(g.receiptFor(g.death.summary), g.death.summary);

  // Classic: the same summary (the number stays in it), shown with closingDone null.
  g.resetRun();
  g.state.closingMode = 'classic';
  tick();
  grantKeys(g, ['janitor']);
  finishDuties(g, ['janitor']);
  shown = dieAndShow();
  assert.equal(g.death.summary.closingDone, 1);
  assert.equal(shown.closingDone, null);
  assert.equal(checklistLine(shown), undefined);
  assert.deepEqual({ ...shown, closingDone: 1 }, { ...g.death.summary });

  // The win receipt goes through the same function (main.js showWin).
  g.resetRun();
  tick();
  approachVan(game);
  readyToLeave(g);
  press('KeyF', holdTicks);
  assert.equal(g.winSummary.closingDone, 4);
  assert.equal(g.receiptFor(g.winSummary).closingDone, null);
  assert.equal(checklistLine({ ...g.receiptFor(g.winSummary), shiftComplete: true }), undefined);
  g.state.closingMode = 'directed';
  assert.equal(checklistLine({ ...g.receiptFor(g.winSummary), shiftComplete: true }), '4 of 4');
});

test('the HUD and pause screen hide the checklist and key markers for a Classic shift, and the HUD keeps no receipt state', () => {
  const { document } = menuDom();
  const hud = createHud();
  const checklist = Object.values(closingTime.lines).map((line) => ({ ...line, done: false }));
  const key = closingTime.lines.janitor.key;
  const markers = { janitor: { name: key, meters: 4, bearing: 0 } };
  const receipt = { round: 1, pointsEarned: 0, kills: 0, timeAlive: 0, accuracy: 0, closingDone: 2 };
  const receiptStats = document.querySelector('.receipt-lines');

  hud.setClosing(checklist, markers);
  assert.equal(document.querySelector('.closing-boxes').hidden, false);
  assert.ok(document.querySelectorAll('.bag-marker').some((node) => !node.hidden && node.textContent.includes(key)));
  hud.screens.show('pause', { closing: checklist });
  assert.ok(document.querySelector('.closing-list').textContent.includes(key));
  hud.showResults(receipt);
  assert.ok(receiptStats.textContent.includes(closingTime.title));

  hud.setClosing(null, {});
  assert.equal(document.querySelector('.closing-boxes').hidden, true);
  assert.ok(document.querySelectorAll('.bag-marker').every((node) => node.hidden));
  hud.screens.show('pause', { closing: null });
  assert.equal(document.querySelector('.pause-closing').hidden, true);
  assert.equal(document.querySelector('.closing-list').textContent, '');
  hud.showResults({ ...receipt, closingDone: null });
  assert.ok(!receiptStats.textContent.includes(closingTime.title));
  // The receipt shows what it is given: nothing is remembered from the last one.
  hud.showResults(receipt);
  assert.ok(receiptStats.textContent.includes(closingTime.title));
  assert.equal(hud.setReceiptClosingDone, undefined);
});

// Phase 7: parking validation, part of the escapeVan feature.
function atValidation(t) {
  const game = fixture(t);
  const { g, standAt } = game;
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;
  const van = g.map.features.find(({ kind }) => kind === 'escapeVan');
  const approach = () => standAt(van.validation.position.x - 1, van.validation.position.z, -90);
  approach();
  assert.equal(g.interactions.prompt, null, 'parking must be unlocked');
  g.map.areaUnlocks.openAll();
  approach();
  assert.equal(g.interactions.prompt?.id, 'validation');
  return { ...game, van, approach };
}

for (const mode of ['directed', 'classic']) test(`parking validation names and refuses each missing requirement (${mode})`, (t) => {
  const { g, press, approach } = atValidation(t);
  const purchases = [], validated = [];
  g.events.on('purchase', (event) => { if (event.id === 'validation') purchases.push(event); });
  g.events.on('closingValidated', (event) => validated.push(event));
  const price = g.pricing.priceOf('closing', 'validation');
  // Isolate every key and every duty, so no other missing requirement can hide a refusal.
  for (const missing of [...bossIds, ...dutyIds.map((id) => 'duty:' + id)]) {
    g.resetRun();
    g.state.closingMode = mode;
    g.map.areaUnlocks.openAll();
    grantKeys(g, bossIds.filter((id) => id !== missing));
    finishDuties(g, dutyIds.filter((id) => id !== missing && 'duty:' + id !== missing));
    g.wallet.earn(price);
    approach();
    const line = closingTime.lines[missing.replace('duty:', '')];
    const reason = missing.startsWith('duty:') ? (mode === 'classic' ? line.place : line.duty) : line.key;
    assert.ok(g.interactions.prompt.blocked.includes(reason), missing + ': ' + g.interactions.prompt.blocked);
    const points = g.wallet.points;
    press('KeyF', holdTicks);
    assert.equal(g.wallet.points, points);
    assert.equal(g.closing.validated, false);
    assert.equal(g.state.won, false);
  }
  assert.deepEqual(purchases, []);
  assert.deepEqual(validated, []);
});

for (const mode of ['directed', 'classic']) test(`parking validation charges once, unlocks the van and resets (${mode})`, (t) => {
  const game = atValidation(t);
  const { g, press, approach, standAt, van, hud } = game;
  g.state.closingMode = mode;
  const validated = [], purchases = [];
  g.events.on('closingValidated', (event) => validated.push(event));
  g.events.on('purchase', (event) => { if (event.id === 'validation') purchases.push(event); });
  grantKeys(g);
  finishDuties(g);
  assert.equal(g.closing.readyToValidate, true);
  assert.equal(g.closing.readyToLeave, false);
  standAt(van.position.x + 1, van.position.z, 90);
  assert.ok(g.interactions.prompt.blocked.includes(closingTime.validation.missing));
  press('KeyF', holdTicks);
  g.events.emit('escapeVanStart');
  assert.equal(g.state.won, false);

  approach();
  const price = g.pricing.priceOf('closing', 'validation');
  assert.equal(price, economy.closing.validation);
  assert.equal(price, 5000);
  g.wallet.earn(price - g.wallet.points - 1);
  assert.equal(g.interactions.prompt.blocked, null);
  assert.equal(g.interactions.prompt.shortfall, 1);
  press('KeyF', holdTicks);
  assert.equal(g.interactions.prompt.denied, true);
  assert.equal(g.closing.validated, false);
  assert.deepEqual(validated, []);

  g.wallet.earn(1);
  const round = g.rounds.round;
  press('KeyF', holdTicks * 3);
  assert.equal(g.wallet.points, 0);
  assert.equal(g.closing.validated, true);
  assert.equal(g.closing.readyToLeave, false, 'the Last Customer must now be defeated');
  assert.equal(g.closing.done, dutyIds.length, 'validation does not tick line 4');
  assert.equal(g.state.won, false, 'validation only unlocks the van');
  assert.equal(g.rounds.round, round, 'no wave change in phase 7');
  assert.deepEqual(validated, [{ round, pa: closingTime.pa.validated }]);
  assert.match(validated[0].pa.text, /closing time is the next round/i);
  assert.equal(g.interactions.prompt.priceLabel, closingTime.validation.done);
  assert.equal(g.interactions.prompt.blocked, closingTime.validation.complete);
  press('KeyF', holdTicks);
  assert.equal(g.wallet.points, 0);
  assert.equal(purchases.length, 1);
  assert.deepEqual(purchases[0], { kind: 'closing', id: 'validation', label: closingTime.validation.name, cost: price });
  assert.equal(validated.length, 1);
  const notices = closingNotices(hud).filter(([, notice]) => notice.text === closingTime.pa.validated.text);
  assert.equal(notices.length, mode === 'directed' ? 1 : 0, 'Classic keeps the local confirmation but no quest PA');

  defeatCustomer(g);
  standAt(van.position.x + 1, van.position.z, 90);
  assert.equal(g.interactions.prompt?.id, van.name);
  assert.equal(g.interactions.prompt.blocked, null);
  press('KeyF', holdTicks);
  assert.equal(g.state.won, true);
  assert.equal(g.closing.done, bossIds.length);
  g.resetRun();
  assert.equal(g.closing.validated, false);
  assert.equal(g.closing.serialize().validated, false);
  assert.equal(g.closing.readyToLeave, false);
  g.map.areaUnlocks.openAll();
  approach();
  assert.equal(g.interactions.prompt.cost, price);
  assert.ok(g.interactions.prompt.blocked.includes(closingTime.lines.janitor.key));
});

test('a Discount Code and Employee Discount apply to the validation price and are spent only on payment', (t) => {
  const { g, tick, press, approach } = atValidation(t);
  const base = g.pricing.priceOf('closing', 'validation');
  const paid = [];
  g.events.on('purchase', (event) => paid.push(event));
  for (const discount of ['voucher', 'coupon']) {
    g.resetRun();
    g.map.areaUnlocks.openAll();
    if (discount === 'voucher') assert.ok(g.pricing.setVoucher(bossVouchers.discountCode));
    else { assert.ok(g.powerUps.debugDrop('employeeDiscount')); tick(); }
    const price = g.pricing.priceOf('closing', 'validation');
    assert.ok(price < base);
    if (discount === 'voucher') assert.equal(price, base - bossVouchers.discountCode.maxSaving);
    g.wallet.earn(price - g.wallet.points);
    approach();
    press('KeyF', holdTicks); // Refusal must preserve the voucher/coupon.
    assert.equal(g.pricing.priceOf('closing', 'validation'), price);
    grantKeys(g);
    finishDuties(g);
    assert.equal(g.interactions.prompt.cost, price);
    press('KeyF', holdTicks);
    assert.equal(g.wallet.points, 0);
    assert.equal(paid.at(-1).cost, price);
    assert.equal(g.pricing.priceOf('closing', 'validation'), base, 'discount consumed by the paid hold');
    assert.equal(g.closing.validated, true);
  }
});


test('the ticket machine fits the van bay without blocking combat lanes, spawns or either prompt', (t) => {
  const { g, van, approach, standAt } = atValidation(t);
  const vehicle = parkingLot.vehicles.find(({ id }) => id === 'abandoned');
  const bayMin = parkingLot.bays.fromX + vehicle.bay * parkingLot.bays.spacing;
  const bayMax = bayMin + parkingLot.bays.spacing;
  for (const { name } of closingTime.validation.parts) {
    const mesh = g.map.group.getObjectByName(name);
    assert.ok(mesh, name + ' rendered');
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox.clone().translate(mesh.position);
    assert.ok(bounds.min.x > bayMin && bounds.max.x < bayMax, name + ' inside the painted bay');
    assert.ok(bounds.min.z > vehicle.z - vehicle.length / 2 && bounds.max.z < vehicle.z + vehicle.length / 2,
      name + ' between the van ends, leaving the cross lanes clear');
    assert.ok(bounds.min.x > parkingLot.rect.minX + parkingLot.sidewalkWidth, 'exit approach clear');
    assert.ok(parkingLot.spawns.every(({ x, z }) => Math.hypot(x - mesh.position.x, z - mesh.position.z) > feel.interact.range),
      'well away from each fence spawn');
  }
  approach();
  assert.equal(g.interactions.prompt.id, 'validation');
  assertOnClearFloor(g, g.player.position, 'ticket machine approach');
  standAt(van.position.x + 1, van.position.z, 90);
  assert.equal(g.interactions.prompt.id, van.name, 'machine does not steal the van prompt');
  assertOnClearFloor(g, g.player.position, 'van start approach');
});

// Phase 8: the booked Last Customer, using the existing charge and quota-funded backup.
function validationRun(t, round = 15) {
  const game = fixture(t);
  const { g, standAt, press } = game;
  g.health.invulnerable = true;
  g.map.areaUnlocks.openAll();
  g.rounds.jumpTo(round);
  const van = g.map.features.find(({ kind }) => kind === 'escapeVan');
  standAt(van.validation.position.x - 1, van.validation.position.z, -90);
  grantKeys(g);
  finishDuties(g);
  const price = g.pricing.priceOf('closing', 'validation');
  g.wallet.earn(price);
  function pay() {
    assert.equal(g.interactions.prompt?.id, 'validation');
    press('KeyF', holdTicks);
    assert.equal(g.closing.validated, true);
  }
  return { ...game, van, pay };
}

// Spend the real wave quota on safe, immediately defeated shoppers. The normal round update announces the next break.
function endWave(game) {
  const { g, tick } = game;
  for (const zombie of g.zombies.zombies) if (zombie.isAlive) zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' });
  while (g.rounds.remainingToSpawn > 0) {
    const zombie = g.rounds.spawnBackup('shopper');
    assert.ok(zombie, 'safe shopper spawn to spend the wave quota');
    zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' });
  }
  // A debut already booked for the current wave still has to be served (e.g. Skylar in round 15).
  const round = g.rounds.round;
  for (let i = 0; i < 120 && g.rounds.round === round; i++) {
    for (const zombie of g.zombies.zombies) if (zombie.isAlive) zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' });
    tick();
  }
  assert.equal(g.rounds.state, 'break');
}

function startBookedBoss(game) {
  const { g, tick } = game;
  g.rounds.endBreak(0);
  tick();
  for (let i = 0; i < zombieCountForRound(g.rounds.round) && !g.bosses.active; i++) {
    const zombie = g.rounds.spawnBackup('shopper');
    assert.ok(zombie);
    zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' });
    tick();
  }
  assert.equal(g.bosses.active?.type.id, 'lastCustomer');
  return g.bosses.active;
}

test('the Last Customer has no random debut, retains the planned combat numbers and uses an existing sting', () => {
  const type = bossTypes.lastCustomer;
  assert.equal(Object.hasOwn(type, 'firstRounds'), false);
  for (const roll of [0, 0.12, 0.5, 0.99]) assert.ok(![...chooseBossSchedule(() => roll).values()].includes(type.id));
  assert.equal(type.healthMultiplier, 16);
  assert.equal(type.speed, 2.6);
  assert.equal(type.attack.damage, 60);
  assert.equal(economy.killValues.lastCustomer, 2500);
  assert.equal(type.barNotice, 'Returns accepted with receipt');
  assert.ok(Object.values(bossTypes).some((other) => other !== type && other.introSound === type.introSound));
  assert.deepEqual(getDeathReport({ type: 'zombie', boss: type.id }), deathReports.bosses.lastCustomer);
});

for (const round of [15, 17, 19]) test(`validation in round ${round} books exactly one boss for the next round, including encores`, (t) => {
  const game = validationRun(t, round);
  const { g, tick, pay, hud } = game;
  // A known Guard makes round 20 a real encore candidate, before the booking replaces its slot.
  if (round === 19) {
    const guard = g.bosses.summon('guard');
    assert.ok(guard);
    guard.takeHit({ damage: guard.health, part: 'body', source: 'hazard' });
    assert.ok(g.bosses.serialize().met.includes('guard'));
  }
  const spawns = [];
  g.events.on('bossSpawn', ({ zombie, round }) => spawns.push({ id: zombie.type.id, at: zombie.position.clone(), round }));
  pay();
  const next = round + 1;
  assert.equal(g.closing.closingRound, next);
  assert.equal(g.closing.readyToLeave, false);
  assert.equal(new Map(g.bosses.serialize().schedule).get(next), 'lastCustomer');
  g.events.emit('closingValidated', { round }); // duplicate delivery must not create another booking or boss
  endWave(game);
  assert.equal(g.rounds.round, next);
  assert.deepEqual(hud.calls.filter(([name]) => name === 'showRoundBanner').at(-1), ['showRoundBanner', next, closingTime.finale.banner]);
  const boss = startBookedBoss(game);
  const gate = g.map.spawnPoints.find(({ name }) => name === bossTypes.lastCustomer.spawnMarker);
  const closingSpawns = () => spawns.filter(({ round }) => round === next);
  assert.deepEqual(closingSpawns(), [{ id: 'lastCustomer', at: gate.position, round: next }]);
  assert.equal(boss.health, zombieHealthFor('lastCustomer', next));
  assert.equal(g.bosses.summon('janitor'), null, 'the one boss slot was used');
  tick(30);
  assert.equal(closingSpawns().length, 1);
  assert.ok(!g.bosses.serialize().met.includes('lastCustomer'));
  assert.ok(hud.calls.some(([name, notice]) => name === 'showAnnouncement' && notice.text === boss.type.introBanner.text));
});

test('the van refuses while the Last Customer is pending or alive; her accepted return unlocks a win, and overtime encores exclude her', (t) => {
  const game = validationRun(t, 19);
  const { g, pay, standAt, press, van } = game;
  const staff = g.bosses.summon('guard');
  assert.ok(staff);
  staff.takeHit({ damage: staff.health, part: 'body', source: 'hazard' });
  pay();
  const refuse = () => {
    standAt(van.position.x + 1, van.position.z, 90);
    for (const mode of ['directed', 'classic']) {
      g.state.closingMode = mode;
      assert.ok(g.interactions.prompt.blocked.includes(closingTime.finale.missing));
      press('KeyF', holdTicks);
      g.events.emit('escapeVanStart');
      assert.equal(g.state.won, false);
    }
  };
  refuse();
  endWave(game);
  const boss = startBookedBoss(game);
  refuse();
  assert.equal(g.closing.lastCustomerDefeated, false);
  const points = g.wallet.points;
  boss.takeHit({ damage: boss.health, part: 'body', source: 'hazard' });
  game.tick();
  assert.equal(boss.state, 'speechless');
  returnToSender(boss, { effects: g.effects, sound: { play() {} } });
  assert.equal(boss.isAlive, false, 'the accepted return finishes the encounter');
  assert.equal(g.wallet.points - points, economy.killValues.lastCustomer);
  assert.equal(g.closing.lastCustomerDefeated, true);
  assert.equal(g.closing.readyToLeave, true);
  assert.ok(g.rounds.spawnBackup('shopper'), 'regular zombies can remain at the win');
  press('KeyF', holdTicks);
  assert.equal(g.state.won, true);
  assert.ok(g.stayForOvertime());
  for (const round of [24, 28, 32]) {
    g.rounds.jumpTo(round);
    assert.equal(new Map(g.bosses.serialize().schedule).get(round), 'guard');
    assert.ok(!g.bosses.serialize().met.includes('lastCustomer'));
  }
  g.resetRun();
  assert.deepEqual([g.closing.validated, g.closing.closingRound, g.closing.lastCustomerDefeated], [false, null, false]);
  assert.deepEqual(g.bosses.serialize(), { schedule: null, met: [], lastBoss: null });
});

test('the Last Customer telegraphs a charge and crashes into each parking van, taking the shared crash damage bonus', (t) => {
  const { g, standAt, tick } = fixture(t);
  g.rounds.update = () => {};
  g.map.areaUnlocks.openAll();
  g.health.invulnerable = true;
  for (const van of parkingLot.vehicles) {
    g.zombies.clear();
    const end = van.z + van.length / 2;
    standAt(van.x, end + 0.8);
    const boss = g.zombies.spawn('lastCustomer', new Vector3(van.x, 0, end + 6));
    boss.setState('chasing');
    for (let i = 0; i < 120 && boss.state !== 'chargeTelegraph'; i++) tick();
    assert.equal(boss.state, 'chargeTelegraph', van.id + ': clear lane starts the telegraph');
    for (let i = 0; i < 120 && boss.state !== 'charging'; i++) tick();
    assert.equal(boss.state, 'charging');
    standAt(van.x + 2, end + 0.8); // sidestep after her direction locks; the van is now her stop
    for (let i = 0; i < 120 && boss.state === 'charging'; i++) tick();
    assert.equal(boss.state, 'crashed', van.id);
    assert.ok(boss.chargeLeft > 0 && boss.position.z > end, 'hit solid van before running out of charge');
    const before = boss.health;
    boss.takeHit({ damage: 100, part: 'body', source: 'gun' });
    assert.equal(before - boss.health, 100 * boss.type.charge.crashDamageTakenMultiplier);
  }
});

test('the Last Customer calls four quota-funded Mall Walkers at each threshold through safe parking markers, once per threshold', (t) => {
  const { g, standAt, tick } = fixture(t);
  g.health.invulnerable = true;
  g.map.areaUnlocks.openAll();
  g.rounds.jumpTo(16);
  g.rounds.update = () => {};
  standAt(25, 0);
  tick(120); // navigation refreshes after the cross-mall teleport before choosing the delivery gate
  const boss = g.bosses.summon('lastCustomer');
  assert.ok(boss);
  boss.setState('chasing');
  const spawned = [], phases = [];
  const spawn = g.zombies.spawn;
  t.mock.method(g.zombies, 'spawn', (id, at, options) => {
    const zombie = spawn(id, at, options);
    if (id === 'mallWalker' && zombie) spawned.push({ zombie, at: zombie.position.clone() });
    return zombie;
  });
  g.events.on('bossPhase', ({ phase }) => phases.push(phase));
  const cfg = boss.type.backup;
  const quota = g.rounds.remainingToSpawn;
  tick(2);
  assert.equal(spawned.length, 0);
  for (let i = 0; i < cfg.thresholds.length; i++) {
    boss.health = boss.maxHealth * cfg.thresholds[i];
    for (let n = 0; n < 600 && spawned.length < cfg.count * (i + 1); n++) tick();
    assert.equal(spawned.length, cfg.count * (i + 1));
    tick(30);
    assert.equal(spawned.length, cfg.count * (i + 1), 'no repeated request at the same threshold');
  }
  assert.deepEqual(phases, ['backup', 'backup']);
  assert.equal(quota - g.rounds.remainingToSpawn, cfg.count * cfg.thresholds.length);
  const markers = g.map.spawnPoints.filter(({ zone }) => zone === cfg.zone);
  assert.equal(markers.length, 4);
  for (const { zombie, at } of spawned) {
    assert.equal(zombie.type.id, 'mallWalker');
    assert.equal(zombie.noRewards, false, 'the regular wave budget funds these, as for Kettle');
    assert.ok(markers.some(({ position }) => position.equals(at)));
  }
});

test('the CLOSING TIME title uses the existing round banner and returns to the normal title afterwards', () => {
  const { document } = menuDom();
  const hud = createHud();
  hud.showRoundBanner(16, closingTime.finale.banner);
  assert.equal(document.querySelector('.round-banner').textContent, 'CLOSING TIME');
  hud.showRoundBanner(17);
  assert.equal(document.querySelector('.round-banner').textContent, 'Round 17');
});

// Phase 9: the return and the Returns Desk.
function returnEncounter(t, distance = 6) {
  const game = validationRun(t, 19);
  const { g, tick } = game;
  game.pay();
  endWave(game);
  const boss = startBookedBoss(game);
  g.rounds.update = () => {};
  for (const zombie of g.zombies.zombies) if (zombie !== boss && zombie.isAlive) zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' });
  g.player.teleport({ position: new Vector3(-17, 0, 0.5), yaw: -Math.PI / 2 });
  boss.position.set(-17 + distance, 0, 0.5);
  boss.prevPosition.copy(boss.position);
  boss.setState('chasing');
  boss.speed = 0;
  boss.attackCooldown = boss.chargeCooldown = 999;
  tick(2);
  function empty() {
    boss.takeHit({ damage: Infinity, part: 'body', source: 'hazard' });
    tick(2);
    assert.equal(boss.state, 'speechless');
    assert.equal(boss.health, boss.type.damageFloor);
  }
  return { ...game, boss, empty };
}

test('every damage source stops the Last Customer at one health; Speechless is announced once and ordinary damage cannot finish her', (t) => {
  const { g, boss, empty, tick } = returnEncounter(t);
  const phases = [], kills = [];
  g.events.on('bossPhase', ({ phase }) => phases.push(phase));
  g.events.on('kill', ({ zombie }) => { if (zombie === boss) kills.push(zombie); });
  empty();
  const at = boss.position.clone();
  for (const source of ['gun', 'melee', 'hazard', 'burn', 'build']) {
    assert.equal(boss.takeHit({ damage: Infinity, part: 'head', source }).killed, false);
    assert.equal(boss.health, 1);
  }
  tick(30);
  assert.ok(boss.isAlive);
  assert.deepEqual(boss.position, at, 'she cannot move or attack while Speechless');
  assert.equal(phases.filter(p => p === 'speechless').length, 1);
  assert.deepEqual(kills, []);
  assert.equal(isReturnable(boss), true);
  assert.equal(g.closing.readyToLeave, false);
});

test('missing the six-second return window restores a quarter of max health and removes the hand prompt; reset clears the encounter', (t) => {
  const { g, boss, empty, tick, standAt } = returnEncounter(t);
  standAt(boss.position.x - 1, boss.position.z, -90);
  assert.notEqual(g.interactions.prompt?.id, 'handReturn');
  empty();
  assert.equal(g.interactions.prompt?.id, 'handReturn');
  tick(Math.floor(boss.type.speechlessSeconds / dt) - 3);
  assert.equal(boss.state, 'speechless');
  tick(5);
  assert.equal(boss.state, 'chasing');
  assert.equal(boss.health, boss.maxHealth * 0.25);
  assert.equal(isReturnable(boss), false);
  assert.notEqual(g.interactions.prompt?.id, 'handReturn');
  empty();
  g.resetRun();
  assert.equal(g.bosses.active, null);
  assert.equal(g.closing.lastCustomerDefeated, false);
  assert.notEqual(g.interactions.prompt?.id, 'handReturn');
});

test('Return to Sender uses the Last Customer three-percent override until Speechless, then one beam returns her', () => {
  const type = bossTypes.lastCustomer;
  const target = { type, state: 'chasing', maxHealth: 20000 };
  const rts = weapons.returnToSender;
  const hit = { part: 'head', distance: 100 };
  const stats = { damageMultiplier: 1 };
  assert.equal(hitDamage(rts, hit, 0, stats, 1, target), target.maxHealth * 0.03);
  const platinum = resolveGun(rts, withTier(rts, [], 'platinum'));
  assert.equal(hitDamage(platinum, hit, 0, stats, 1, target), target.maxHealth * 0.03 * platinum.damage / rts.damage);
  assert.equal(hitDamage(rts, hit, 0, stats, 1, { type: bossTypes.guard, maxHealth: target.maxHealth }), target.maxHealth * rts.instantKill.bigFraction);
  target.state = 'speechless';
  assert.equal(hitDamage(rts, hit, 0, stats, 1, target), INSTANT_KILL_DAMAGE);
  assert.equal(isReturnable(target), true);
});

test('a real blast from out of hand reach returns the Speechless boss once through kill, carries skin credit and unlocks the van', (t) => {
  const { g, boss, empty, tick, press, standAt, van, sounds } = returnEncounter(t, weapons.returnToSender.cone.killRange - 1.5);
  g.gun.give(weapons.returnToSender);
  tick(60);
  g.player.pitch = Math.atan2(1.1 - g.player.eyeHeight, weapons.returnToSender.cone.killRange - 1.5);
  empty();
  assert.notEqual(g.interactions.prompt?.id, 'handReturn', 'out of hand range');
  const kills = [];
  g.events.on('kill', (event) => { if (event.zombie === boss) kills.push(event); });
  const before = sounds.filter(s => s === 'returnStamp').length;
  press('Mouse0');
  assert.equal(boss.isAlive, false);
  assert.equal(kills.length, 1);
  assert.equal(kills[0].weaponId, 'returnToSender');
  assert.equal(kills[0].source, 'gun');
  assert.ok(kills[0].distance > 5, 'returned from across the room, not by hand');
  assert.equal(sounds.filter(s => s === 'returnStamp').length - before, 1);
  assert.equal(g.closing.readyToLeave, true);
  standAt(van.position.x + 1, van.position.z, 90);
  press('KeyF', holdTicks);
  assert.equal(g.state.won, true);
});

test('the hand stamp takes a full hold, beats the nearer van prompt and a held reload, and gets Return to Sender kill credit', (t) => {
  const { g, boss, empty, tick, input, press, standAt, van, sounds } = returnEncounter(t);
  g.gun.give(weapons.rivetRifle);
  tick(60);
  g.gun.weapon.magazine = 1;
  let reloads = 0;
  g.events.on('reload', () => reloads++);
  input.held.add('KeyR'); input.pressed.add('KeyR'); tick();
  assert.equal(reloads, 1);
  empty();
  boss.position.set(van.position.x + 1.4, 0, van.position.z);
  boss.prevPosition.copy(boss.position);
  standAt(van.position.x + 0.6, van.position.z, 90); // van is nearer, both are within the facing-free radius
  assert.equal(g.interactions.prompt?.id, 'handReturn');
  const kills = [], purchases = [];
  g.events.on('kill', e => { if (e.zombie === boss) kills.push(e); });
  g.events.on('purchase', e => purchases.push(e));
  const before = sounds.filter(s => s === 'returnStamp').length;
  input.held.add('PadX'); input.pressed.add('PadX');
  tick(Math.floor(boss.type.handReturn.holdSeconds / dt) - 2);
  assert.ok(boss.isAlive, 'the normal quarter-second buy hold is insufficient');
  assert.ok(g.interactions.prompt.progress > 0.9);
  tick(4);
  input.held.delete('PadX'); input.held.delete('KeyR'); tick();
  assert.equal(boss.isAlive, false);
  assert.equal(kills.length, 1);
  assert.equal(kills[0].weaponId, 'returnToSender');
  assert.equal(kills[0].melee, false);
  assert.equal(reloads, 1, 'shared interact/reload did not become another reload tap');
  assert.deepEqual(purchases, [], 'the hand stamp is a free action');
  assert.equal(sounds.filter(s => s === 'returnStamp').length - before, 1);
  assert.equal(g.interactions.prompt?.id, van.name);
  press('KeyF', holdTicks);
  assert.equal(g.state.won, true);
});

function atReturnsDesk(t) {
  const game = fixture(t);
  const { g, standAt, tick } = game;
  g.rounds.update = () => {};
  g.zombies.clear();
  const desk = g.map.features.find(({ kind }) => kind === 'returnsDesk');
  const approach = () => standAt(desk.position.x + desk.normal.x * 1.2, desk.position.z + desk.normal.z * 1.2, Math.atan2(desk.normal.x, desk.normal.z) * 180 / Math.PI);
  approach();
  assert.equal(g.interactions.prompt, null);
  g.map.areaUnlocks.unlock('hallway'); tick(120); approach();
  assert.equal(g.interactions.prompt?.id, 'returnsDesk');
  return { ...game, desk, approach };
}

test('the Returns Desk no longer sells the gun or waits for the duties: finishing them changes nothing at the desk', (t) => {
  const { g, press, tick } = atReturnsDesk(t);
  const paid = [];
  g.events.on('purchase', event => { if (String(event.id).startsWith('returns')) paid.push(event); });
  g.wallet.earn(20000);
  const policy = g.interactions.prompt.blocked;
  assert.ok(policy, 'the quest has not started: the desk only states its policy (tests/returnQuest.test.js)');
  grantKeys(g, dutyIds); finishDuties(g);
  assert.equal(g.interactions.prompt.blocked, policy, 'the duties do not open the desk');
  for (const id of dutyIds) assert.ok(!policy.includes(closingTime.lines[id].duty));
  const points = g.wallet.points;
  press('KeyF', holdTicks); tick(60);
  assert.equal(g.wallet.points, points);
  assert.equal(g.gun.owns('returnToSender'), false);
  assert.deepEqual(paid, []);
});

test('the gun the quest issues is free, spends no Discount Code and replaces the held gun in a full two-slot loadout', (t) => {
  const { g, tick, press } = atReturnsDesk(t);
  g.gun.give(weapons.rivetRifle); tick(60);
  g.pricing.setVoucher(bossVouchers.discountCode);
  g.returnQuest.debug('called');
  assert.equal(g.interactions.prompt.blocked, null);
  const before = g.wallet.points;
  press('KeyF', Math.ceil(returnQuest.desk.holdSeconds / dt) + 2); tick(60);
  assert.equal(g.wallet.points, before);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'returnToSender']);
  assert.equal(g.gun.def.id, 'returnToSender');
  assert.equal(g.pricing.voucher, bossVouchers.discountCode, 'a free issue is not a purchase');
});

test('the Returns Desk sells half-rate ammo for twenty-five hundred without a checklist gate, refuses full ammo and resets', (t) => {
  const { g, tick, press, approach } = atReturnsDesk(t);
  g.gun.give(weapons.returnToSender); tick(60);
  g.gun.weapon.magazine = g.gun.weapon.reserve = 0;
  assert.equal(g.closing.done, 0);
  assert.equal(g.interactions.prompt.id, 'returnsAmmo');
  assert.equal(g.interactions.prompt.blocked, null);
  const price = g.pricing.priceOf('closing', 'returnsAmmo');
  assert.equal(price, 2500);
  g.wallet.earn(price);
  const before = g.wallet.points;
  press('KeyF', holdTicks);
  assert.equal(before - g.wallet.points, price);
  const def = weapons.returnToSender;
  assert.deepEqual([g.gun.weapon.magazine, g.gun.weapon.reserve], [def.magazineSize, Math.round(def.startingReserve * def.refillFraction)]);
  assert.equal(g.interactions.prompt.blocked, closingTime.returnsDesk.full);
  const points = g.wallet.points;
  press('KeyF', holdTicks);
  assert.equal(g.wallet.points, points);
  g.resetRun(); g.map.areaUnlocks.unlock('hallway'); tick(120); approach();
  assert.equal(g.gun.owns('returnToSender'), false);
  assert.equal(g.interactions.prompt.id, 'returnsDesk');
  assert.ok(g.interactions.prompt.blocked);
});

test('the Returns Desk, night safe, three service windows and Prize Counter keep their own prompts', (t) => {
  const { g, approach, standAt } = atReturnsDesk(t);
  const desk = g.map.features.find(({ kind }) => kind === 'upgradeDesk');
  const safe = g.map.features.find(({ kind }) => kind === 'nightSafe');
  const prize = g.map.features.find(({ kind }) => kind === 'prizeCounter').slots[0];
  for (const [spot, kind] of [[desk.position, 'tier'], [desk.meleePosition, 'melee'], [desk.secondChancePosition, 'secondChance'], [prize.position, 'prize']]) {
    standAt(spot.x, spot.z - 1.4, 180);
    assert.equal(g.interactions.prompt?.kind, kind);
  }
  standAt(safe.position.x + 1.2, safe.position.z, 90);
  assert.equal(g.interactions.prompt?.id, safe.name);
  approach();
  assert.equal(g.interactions.prompt.id, 'returnsDesk');
});
