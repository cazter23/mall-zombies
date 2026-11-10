import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { dt, headlessGame, snapshot } from './helpers/headlessGame.js';
import { bossVouchers } from '../src/config/bosses.js';
import { closingTime } from '../src/config/closingTime.js';
import { CAREER_STATS_KEY, CAREER_STATS_VERSION, createCareerStats } from '../src/game/careerStats.js';
import { economy, zombieCountForRound } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { hazards } from '../src/config/hazards.js';
import { dealHazardDamage } from '../src/game/features/hazards.js';
import { weapons } from '../src/config/weapons.js';
import { workshopRitual } from '../src/config/workshop.js';
import { powerUps as pickupConfig } from '../src/config/powerUps.js';
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

// Everything the van asks for: the four keys and lines 1 to 3.
function readyToLeave(g) {
  grantKeys(g);
  finishDuties(g);
  assert.ok(g.closing.readyToLeave);
}

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
  assert.equal(g.interactions.prompt.blocked, van.blockedPrefix + bossIds.map((id) => lines[id].key).join(', '));

  // Keys first, then the duty whose key is held but which is not done.
  grantKeys(g, ['janitor']);
  assert.equal(g.interactions.prompt.blocked,
    van.blockedPrefix + [lines.guard.key, lines.manager.key, lines.influencer.key, lines.janitor.duty].join(', '));

  grantKeys(g, ['guard', 'manager']);
  assert.match(g.interactions.prompt.blocked, /Skylar's Van Keys/);
  press('KeyF', holdTicks);
  assert.equal(g.state.won, false);

  // Four keys are not enough: the van refuses and names each unfinished duty.
  grantKeys(g, ['influencer']);
  assert.deepEqual(g.closing.missingKeys, []);
  assert.equal(g.interactions.prompt.blocked, van.blockedPrefix + dutyIds.map((id) => lines[id].duty).join(', '));
  finishDuties(g, ['janitor', 'guard']);
  assert.equal(g.interactions.prompt.blocked, van.blockedPrefix + lines.manager.duty);
  press('KeyF', holdTicks);
  g.events.emit('escapeVanStart');
  assert.equal(g.state.won, false, 'four keys and an unfinished duty do not start the van');
  assert.equal(wins.length, 0);

  finishDuties(g, ['manager']);
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
    checklist: bossIds.map((id) => [id, false, null]), keys: [], pickups: [], markers: [], readyToLeave: false,
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
  assert.equal(keyNotices[0].pa.text, key + ' collected. Start the van to finish closing.');
  assert.ok(hud.calls.some(([name, notice]) => name === 'showAnnouncement' && notice.text === keyNotices[0].pa.text));
  assert.deepEqual(ticked, []);

  approachVan(game);
  grantKeys(g, dutyIds);
  finishDuties(g);
  assert.deepEqual(g.closing.missingKeys, []);
  assert.equal(g.closing.done, 3);
  assert.deepEqual(g.closing.checklist.map(({ done }) => done), [true, true, true, false]);
  ticked.length = 0;

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
function atBuildABlaster(t) {
  const game = fixture(t);
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
