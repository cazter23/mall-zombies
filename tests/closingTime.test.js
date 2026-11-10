import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { closingTime } from '../src/config/closingTime.js';
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
