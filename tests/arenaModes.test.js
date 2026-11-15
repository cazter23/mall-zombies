// ARENA SURVIVAL (config/arenas.js, maps/mall/arenas.js, g.setArena; the plan: docs/arena-modes-plan.md): a run locked in one
// part of the mall. Each arena starts in the right place, its exits never open, zombies spawn only there and reach you, its
// fixtures work, Save & Quit keeps the arena, and a whole-mall run is exactly what it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { arenas, ARENA_IDS } from '../src/config/arenas.js';
import { colliderSignature } from '../src/world/collision.js';
import { featuresOf } from '../src/game/features/index.js';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
  };
}

// One game for a test (the map is built before anything random is seeded: CLAUDE.md).
function game(t, options = {}) {
  const run = headlessGame(options);
  t.after(() => run.g.map.dispose());
  return run;
}

const openZones = (g) => Object.keys(g.map.zones).filter((id) => g.map.zones[id].open).sort();
// Everything a whole-mall run's map is made of that an arena could change.
const mallShape = (g) => ({
  colliders: colliderSignature(g.colliders),
  count: g.colliders.length,
  spawns: g.map.spawnPoints.map((s) => s.name),
  features: g.map.features.map((f) => f.name),
  zones: openZones(g),
  doors: g.map.doors.map((d) => [d.id, d.isOpen]),
  sealed: g.map.areaUnlocks.sealed,
});

test('the arena list: three arenas, each with real zones, a name and a line', (t) => {
  const { g } = game(t);
  assert.deepEqual(ARENA_IDS, ['startRoom', 'cinema', 'parkingLot']);
  for (const arena of arenas.list) {
    assert.ok(arena.name && arena.description && arena.pa?.text, `${arena.id} has its words`);
    for (const zone of arena.zones) assert.ok(Object.hasOwn(g.map.zones, zone), `${arena.id}: zone ${zone}`);
    assert.ok(g.map.arenas[arena.id], `the map builds ${arena.id}`);
  }
});

test('a whole-mall run is unchanged: no arena colliders, spawns or features, and the same map after an arena run', (t) => {
  const { g } = game(t);
  const fresh = mallShape(g);
  assert.equal(g.state.arena, null);
  assert.equal(g.map.arena, null);
  assert.equal(fresh.sealed, false);
  assert.deepEqual(fresh.zones, ['startRoom']);
  assert.ok(!fresh.spawns.some((name) => name.startsWith('spawn_arena_')), 'no arena spawn markers');
  assert.ok(!g.map.features.some((f) => f.arena), 'no arena features in map.features');
  for (const id of ARENA_IDS) {
    for (const box of g.map.arenas[id].colliders) assert.ok(!g.colliders.includes(box), `${id}'s colliders are not in the world`);
    assert.equal(g.map.arenas[id].group.visible, false, `${id}'s fixtures are hidden`);
  }
  for (const id of ARENA_IDS) {
    g.setArena(id);
    g.update(1 / 60);
    g.setArena(null);
    assert.deepEqual(mallShape(g), fresh, `after ${id}, Play again in the whole mall is the same map`);
  }
});

for (const arena of arenas.list) {
  test(`${arena.name}: starts in its arena, only its zones open, every exit sealed for the run`, (t) => {
    const { g, tick } = game(t);
    assert.equal(g.setArena(arena.id), true);
    assert.equal(g.setArena(arena.id), false, 'the same arena again resets nothing');
    assert.equal(g.state.arena, arena.id);
    assert.equal(g.map.arena, arena.id);
    assert.deepEqual(openZones(g), [...arena.zones].sort());
    assert.deepEqual(g.player.position.toArray(), arena.playerSpawn.at);
    assert.equal(g.map.areaUnlocks.sealed, true);
    assert.equal(g.state.closingQuest, false);
    assert.equal(g.state.showClosingGuidance, false, 'no checklist, markers or Closing Time objective');
    // No door has anything to sell, and nothing can open one.
    for (const door of g.map.doors) assert.equal(g.map.areaUnlocks.destination(door), null, `${door.id} offers nothing`);
    assert.deepEqual(g.map.areaUnlocks.unlock('hallway'), []);
    g.map.areaUnlocks.openAll();
    g.wallet.earn(50000);
    tick(5);
    assert.ok(!g.map.doors.some((d) => d.isOpen), 'every door still shut');
    assert.deepEqual(openZones(g), [...arena.zones].sort());
    assert.equal(g.interactions.prompt?.kind === 'door', false);
  });

  test(`${arena.name}: zombies spawn only at its markers and every marker reaches the player`, (t) => {
    const { g, tick } = game(t);
    g.setArena(arena.id);
    tick(2); // (round 1 starts; the nav field settles)
    const usable = g.map.spawnPoints.filter((p) => arena.zones.includes(p.zone));
    assert.ok(usable.length >= 4, `${arena.id} has at least four spawn markers (${usable.length})`);
    for (const p of usable) {
      const cost = g.zombies.nav.distanceToTarget(p.position.x, p.position.z, p.position.y);
      assert.ok(Number.isFinite(cost), `${p.name} reaches the player`);
    }
    for (let i = 0; i < 12; i++) {
      const z = g.zombies.spawn('shopper');
      if (!z) continue;
      const near = usable.some((p) => Math.hypot(p.position.x - z.position.x, p.position.z - z.position.z) < 1);
      assert.ok(near, `a zombie rose at (${z.position.x.toFixed(1)}, ${z.position.z.toFixed(1)}), on one of ${arena.id}'s markers`);
    }
  });

  test(`${arena.name}: no Closing Time (no key drops, no van) but bosses come as usual`, (t) => {
    const { g } = game(t);
    g.setArena(arena.id);
    g.update(1 / 60);
    assert.equal(g.closing.nextStep === null || g.state.showClosingGuidance === false, true);
    // A key a boss would drop is refused.
    g.events.emit('bossVanished', { zombie: { type: { id: 'janitor' } } });
    assert.equal(g.closing.pickups.length, 0, 'no key on the floor');
    assert.ok(!g.interactions.buyables().some((item) => item.kind === 'closing'), 'nothing of Closing Time is for sale');
  });

  test(`${arena.name}: Save & Quit keeps the arena, and Continue resumes in it`, (t) => {
    const storage = memoryStorage();
    const { g, tick } = game(t, { saveStorage: storage });
    g.setArena(arena.id);
    tick(1);
    g.rounds.jumpTo(3);
    tick(1);
    assert.equal(g.saveGame.saveAndQuit(), true);
    assert.equal(g.saveGame.peek().arena, arena.id);
    // The title: the whole mall again.
    g.state.arena = null;
    g.resetRun();
    assert.equal(g.map.arena, null);
    assert.equal(g.saveGame.load(), true);
    assert.equal(g.state.arena, arena.id);
    assert.equal(g.map.arena, arena.id);
    assert.equal(g.rounds.round, 3);
    assert.deepEqual(openZones(g), [...arena.zones].sort());
    assert.equal(g.map.areaUnlocks.sealed, true);
  });
}

test('a save written before arenas existed (no arena step) loads as a whole-mall run', (t) => {
  const storage = memoryStorage();
  const { g, tick } = game(t, { saveStorage: storage });
  tick(1);
  g.rounds.jumpTo(2);
  tick(1);
  g.saveGame.saveAndQuit();
  const saved = JSON.parse(storage.getItem('sunsetGalleria.save'));
  delete saved.data.arena;
  storage.setItem('sunsetGalleria.save', JSON.stringify(saved));
  g.setArena('cinema'); // (whatever the title was last showing)
  assert.equal(g.saveGame.load(), true);
  assert.equal(g.state.arena, null);
  assert.deepEqual(openZones(g), ['startRoom']);
});

test('the run summary names the arena', (t) => {
  const { g, tick } = game(t);
  g.setArena('parkingLot');
  tick(1);
  g.health.takeDamage(10000, { type: 'fall', fall: true });
  assert.equal(g.death.summary.arena, 'parkingLot');
  assert.equal(g.receiptFor(g.death.summary).closingDone, null, 'no checklist line on an arena receipt');
});

test('featuresOf sees an arena feature only while its arena is on', (t) => {
  const { g } = game(t);
  const names = () => g.map.features.filter((f) => f.arena).map((f) => f.name);
  assert.deepEqual(names(), []);
  for (const id of ARENA_IDS) {
    g.setArena(id);
    assert.deepEqual(names(), g.map.arenas[id].features.map((f) => f.name));
    for (const f of g.map.arenas[id].features) assert.ok(featuresOf(g.map, f.kind).includes(f));
  }
});

test('Lot Full: the escape van and its validation machine offer nothing', (t) => {
  const { g, standAt } = game(t);
  g.setArena('parkingLot');
  g.wallet.earn(10000);
  standAt(57.3, -11.05, 90); // (east of the mauve van, facing it)
  assert.equal(g.interactions.prompt, null, 'no "Start the van" prompt');
  standAt(53.0, -11.05, -90); // (west of it, at the ticket machine)
  assert.equal(g.interactions.prompt, null, 'no Parking Validation prompt');
});
