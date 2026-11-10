import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { dt, headlessGame } from './helpers/headlessGame.js';
import { closingTime } from '../src/config/closingTime.js';
import { CAREER_STATS_KEY, CAREER_STATS_VERSION, createCareerStats } from '../src/game/careerStats.js';
import { economy, zombieCountForRound } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { weapons } from '../src/config/weapons.js';
import { receiptLinesFor } from '../src/ui/screens.js';

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
    assert.equal(g.closing.done, 1);
  });
}

test('two keys stay through round changes and cleanup; collecting one checks off just its line', (t) => {
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

  standAt(ring.x, ring.z);
  assert.equal(g.closing.done, 1);
  assert.deepEqual(g.closing.checklist.filter(({ done }) => done).map(({ bossId }) => bossId), ['janitor']);
  assert.deepEqual(g.closing.pickups, [{ bossId: 'guard', position: safe }]);
  assert.ok(!props.getObjectByName('janitor').visible);
  assert.ok(props.getObjectByName('guard').visible);
  assert.equal(g.closing.markers.janitor, undefined);
  const { key, duty } = closingTime.lines.janitor;
  const pa = closingTime.pa.collect(key, duty);
  assert.deepEqual(notices, [
    ['closingKey', { bossId: 'janitor', pa }],
    ['closingLine', { line: 'janitor', done: 1, total: bossIds.length, pa }],
  ]);
  const announcements = hud.calls.filter(([name]) => name === 'showAnnouncement').map(([, notice]) => notice.text);
  assert.ok(announcements.includes(closingTime.pa.drop(key).text));
  assert.ok(announcements.includes(pa.text));
});

test('death freezes checklist progress and Play again clears the held and floor keys', (t) => {
  const { g, standAt, props } = fixture(t);
  assert.ok(g.debug.keylessIds.includes('closing'));
  assert.ok(!g.debug.commands.some(({ id }) => id === 'closing'));
  assert.match(g.debug.run('closing', 'grant', 'janitor'), /Granted/);
  assert.match(g.debug.run('closing', 'drop', 'guard', new Vector3(2, 0, 12)), /Dropped/);
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
  assert.equal(g.closing.done, 1);
  assert.ok(receiptLinesFor(g.death.summary).some(([label, value]) => label === 'Closing checklist' && value === '1 of 4'));

  g.resetRun();
  assert.equal(g.closing.done, 0);
  assert.equal(g.closing.checklist.length, 4);
  assert.ok(g.closing.checklist.every(({ done }) => !done));
  assert.deepEqual(g.closing.pickups, []);
  assert.deepEqual(g.closing.markers, {});
  assert.ok(props.children.every((prop) => !prop.visible));
});

test('a vanished boss drops its key at the player through the director', (t) => {
  const { g, tick } = fixture(t);
  assert.ok(g.bosses.summon('influencer'));
  const feet = g.player.position.clone();
  g.zombies.clear();
  tick();
  assert.equal(g.bosses.active, null);
  assert.deepEqual(g.closing.pickups, [{ bossId: 'influencer', position: feet }]);
  assert.equal(g.closing.done, 0);
  tick();
  assert.equal(g.closing.done, 1);
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

test('the van explains missing keys, then a hold wins once and Clock out freezes the run', (t) => {
  const game = fixture(t);
  const { g, tick, press, hud } = game;
  const wins = [], ends = [];
  let deaths = 0;
  const career = createCareerStats();
  g.events.on('runWon', ({ summary }) => wins.push(summary));
  g.events.on('runEnd', ({ summary }) => { ends.push(summary); career.recordRun(summary); });
  g.events.on('playerDeath', () => deaths++);
  approachVan(game);

  grantKeys(g, bossIds.slice(0, -1));
  assert.match(g.interactions.prompt.blocked, /Skylar's Van Keys/);
  press('KeyF', holdTicks);
  assert.equal(g.state.won, false);

  grantKeys(g, bossIds.slice(-1));
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
  grantKeys(g);
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
