// ARENA SURVIVAL (config/arenas.js, maps/mall/arenas.js, g.setArena; the plan: docs/arena-modes-plan.md): a run locked in one
// part of the mall. Each arena starts in the right place, its exits never open, zombies spawn only there and reach you, its
// fixtures work, Save & Quit keeps the arena, and a whole-mall run is exactly what it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { arenas, ARENA_IDS } from '../src/config/arenas.js';
import { featuresOf } from '../src/game/features/index.js';
import * as THREE from 'three';
import { createNavigation } from '../src/zombies/navigation.js';
import { zombieTypes } from '../src/config/zombies.js';
import { overlapsSolid } from '../src/world/collision.js';
import { weapons } from '../src/config/weapons.js';
import { clawMachine as clawCfg } from '../src/config/clawMachine.js';

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
  colliders: g.colliders.map((b) => [...b.min.toArray(), ...b.max.toArray()].map((n) => n.toFixed(3)).join(',')).join('|'),
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

// --- The arenas' fixtures ------------------------------------------------------------------------------------------------

const floorOf = (p) => (p.y > 4 ? 6.3 : 0);
// Stand in front of a buy spot (on its floor, `out` metres along its normal), facing it.
function standBefore(run, { position, normal }, out = 0.9) {
  run.g.player.teleport({
    position: new THREE.Vector3(position.x + normal.x * out, floorOf(position), position.z + normal.z * out),
    yaw: Math.atan2(normal.x, normal.z),
  });
  run.g.player.pitch = 0;
  run.tick(2);
}
// The buy spots an arena fixture offers: { position, normal, kind (the prompt kind expected there) }.
function spotsOf(feature) {
  if (feature.kind === 'upgradeDesk') {
    return [[feature.position, 'tier'], [feature.meleePosition, 'melee'], [feature.secondChancePosition, 'secondChance']]
      .map(([position, kind]) => ({ position, normal: feature.normal, kind }));
  }
  if (feature.kind === 'ammoCache') return [{ position: feature.position, normal: feature.normal, kind: 'ammoCache' }];
  return [{ position: feature.position, normal: feature.normal, kind: 'weapon' }];
}
const meshBoxes = (root, skip) => {
  const out = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || skip(o)) return;
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    if (Math.max(size.x, size.y, size.z) > 40) return; // (the sky dome and the ground plane hold everything)
    if (size.y < 0.03 && [0, 6.3].some((y) => Math.abs(box.min.y - y) < 0.06)) return; // (paint and wear lying flat on a floor)
    out.push({ name: o.name || o.parent?.name || '?', box });
  });
  return out;
};
const underArenas = (o) => { for (let p = o; p; p = p.parent) if (p.name === 'arenas') return true; return false; };

for (const arena of arenas.list) {
  test(`${arena.name}: every arena fixture stands clear of the map: no solid, spawn marker or decoration inside it`, (t) => {
    const { g } = game(t);
    const own = g.map.arenas[arena.id];
    // Its colliders (1 cm in) against every map collider and every spawn marker's body.
    const shrink = (b) => b.clone().expandByScalar(-0.01);
    for (const box of own.colliders) {
      const tall = box.max.y - box.min.y;
      assert.ok(tall >= 2.1 || tall <= 0.35 || (box.vaultable && tall <= 1.1), `${arena.id}: a ${tall.toFixed(2)} m solid is standable`);
      for (const other of g.colliders) assert.ok(!shrink(box).intersectsBox(other), `${arena.id}: a fixture collider overlaps a map solid`);
      for (const p of [...g.map.spawnPoints, ...own.spawnPoints]) {
        const body = new THREE.Box3().setFromCenterAndSize(p.position.clone().setY(p.position.y + 1), new THREE.Vector3(1.4, 2, 1.4));
        assert.ok(!shrink(box).intersectsBox(body), `${arena.id}: a fixture is within 0.7 m of ${p.name}`);
      }
    }
    // Its meshes (1 cm in) against every other mesh of the map (walls and floors it touches stay outside the shrunk box).
    const mine = meshBoxes(own.group, () => false);
    const others = meshBoxes(g.map.group, underArenas);
    for (const m of mine) {
      const inner = m.box.clone().expandByScalar(-0.01);
      if (inner.isEmpty()) continue;
      const hit = others.find((o) => inner.intersectsBox(o.box));
      assert.equal(hit?.name, undefined, `${arena.id}: ${m.name} runs into ${hit?.name}`);
    }
  });

  test(`${arena.name}: every fixture's buy spot is reachable from the start and takes focus there; its zombie routes stay short`, (t) => {
    const run = game(t);
    const { g } = run;
    g.setArena(arena.id);
    run.tick(1);
    g.zombies.clear();
    g.wallet.earn(50000);
    const own = g.map.arenas[arena.id];
    const start = own.playerSpawn.position;
    const nav = createNavigation(g.colliders, zombieTypes.shopper, g.map.navigation);
    nav.update(1 / 60, start);
    for (const feature of own.features) {
      for (const spot of spotsOf(feature)) {
        const stand = new THREE.Vector3(spot.position.x + spot.normal.x * 0.9, floorOf(spot.position), spot.position.z + spot.normal.z * 0.9);
        assert.equal(overlapsSolid(stand, 0.35, 1.8, g.colliders, 0.3), false, `${feature.name}: a clear place to stand`);
        assert.ok(Number.isFinite(nav.distanceToTarget(stand.x, stand.z, stand.y)), `${feature.name}: reachable from the start`);
        g.gun.weapon.magazine = 0; // (a refill machine only offers a refill to a gun that needs one)
        standBefore(run, spot);
        g.zombies.clear();
        const prompt = g.interactions.prompt;
        const kinds = spot.kind === 'weapon' ? ['weapon', 'ammo'] : [spot.kind];
        assert.ok(kinds.includes(prompt?.kind), `${feature.name}: ${spot.kind} takes focus (got ${prompt?.kind})`);
      }
    }
    // Zombie routes inside the arena with its fixtures in, against without them: never cut off, at most 3 m longer.
    const without = Object.assign(g.colliders.filter((b) => !own.colliders.includes(b)), { ramps: g.colliders.ramps });
    const routes = (colliders) => {
      const n = createNavigation(colliders, zombieTypes.shopper, g.map.navigation);
      n.update(1 / 60, start);
      return g.map.spawnPoints.filter((p) => arena.zones.includes(p.zone)).map((p) => n.distanceToTarget(p.position.x, p.position.z, p.position.y));
    };
    const before = routes(without), after = routes(g.colliders);
    after.forEach((d, i) => {
      assert.ok(Number.isFinite(d), `route ${i} reaches the start`);
      assert.ok(d - before[i] <= 3, `route ${i}: ${before[i].toFixed(1)} -> ${d.toFixed(1)} m`);
    });
  });

  test(`${arena.name}: the fixtures work (a warranty, the refill, a wall gun) and sell nothing in a whole-mall run`, (t) => {
    const run = game(t);
    const { g } = run;
    g.setArena(arena.id);
    run.tick(1);
    g.wallet.earn(50000);
    const own = g.map.arenas[arena.id];
    for (const feature of own.features) {
      g.zombies.clear();
      if (feature.kind === 'wallBuy') {
        standBefore(run, feature);
        run.press('KeyF', 20);
        assert.ok(g.gun.owns(feature.weapon), `${feature.name} sold the ${weapons[feature.weapon].name}`);
      } else if (feature.kind === 'ammoCache') {
        g.gun.weapon.magazine = 0;
        standBefore(run, feature);
        const before = g.wallet.points;
        run.press('KeyF', 20);
        assert.ok(g.gun.weapon.isFull, `${feature.name} refilled the gun in hand`);
        assert.equal(before - g.wallet.points, g.pricing.priceOf('ammoCache'));
      } else if (feature.kind === 'upgradeDesk') {
        const modsBefore = g.gun.modsFor(g.gun.def.id).length;
        standBefore(run, feature);
        run.press('KeyF', 20);
        assert.ok(g.gun.modsFor(g.gun.def.id).length > modsBefore, `${feature.name} sold an Extended Warranty`);
      }
    }
    // The whole mall, everything open: the same spots sell nothing.
    g.setArena(null);
    run.tick(1);
    g.map.areaUnlocks.openAll();
    run.tick(120);
    for (const feature of own.features) {
      for (const spot of spotsOf(feature)) {
        standBefore(run, spot);
        const prompt = g.interactions.prompt;
        if (feature.kind === 'wallBuy') assert.notEqual(prompt?.id, feature.weapon, `${feature.name}: not for sale in a whole-mall run`);
        else assert.notEqual(prompt?.kind, spot.kind, `${feature.name}: no ${spot.kind} prompt in a whole-mall run`);
      }
    }
  });
}

for (const id of ['cinema', 'parkingLot']) {
  test(`${arenas.list.find((a) => a.id === id).name}: GRAB-A-GUN starts at the arena's own site and a grab works`, (t) => {
    const run = game(t);
    const { g } = run;
    g.setArena(id);
    run.tick(1);
    g.zombies.clear();
    g.wallet.earn(50000);
    const claw = g.features.instanceOf('clawMachine');
    assert.equal(claw.site.zone, id, 'live in the arena');
    assert.ok(claw.site.cabinet.rig.live, 'uncovered');
    assert.equal(claw.status.open, true);
    const { position, normal } = claw.site.cabinet;
    const floorY = clawCfg.sites.find((s) => s.id === claw.site.id).floorY;
    g.player.teleport({ position: new THREE.Vector3(position.x + normal.x * 1.3, floorY, position.z + normal.z * 1.3), yaw: Math.atan2(normal.x, normal.z) });
    g.player.pitch = 0;
    run.tick(2);
    assert.equal(g.interactions.prompt?.kind, 'claw');
    const before = g.wallet.points;
    run.press('KeyF', 20);
    assert.equal(before - g.wallet.points, g.pricing.priceOf('claw', 'grab'));
    assert.equal(claw.phase, 'sweeping');
    // A whole-mall run starts back at the first site.
    g.setArena(null);
    assert.equal(claw.site.id, clawCfg.sites[0].id);
  });
}

test('Lot Full: Kiosk Kevin opens at his parking site', (t) => {
  const run = game(t);
  const { g } = run;
  g.setArena('parkingLot');
  run.tick(1);
  const kiosk = g.features.instanceOf('kiosk');
  assert.equal(kiosk.site.zone, 'parkingLot');
  g.setArena(null);
  assert.equal(kiosk.site.id, kiosk.sites[0].id, 'a whole-mall run starts him at the first site again');
});

// --- Best rounds (game/careerStats.js) -------------------------------------------------------------------------------------

test('an arena death files its best round under its arena, counts in the totals, and leaves the whole mall\'s bests alone', async (t) => {
  const { createCareerStats } = await import('../src/game/careerStats.js');
  const storage = memoryStorage();
  const career = createCareerStats({ storage });
  const run = game(t);
  const { g } = run;
  g.events.on('runEnd', ({ summary }) => { run.result = career.recordRun(summary); });
  g.setArena('cinema');
  run.tick(1);
  g.rounds.jumpTo(9);
  run.tick(1);
  g.health.takeDamage(10000, { type: 'fall', fall: true });
  assert.equal(run.result.saved, true);
  assert.deepEqual(run.result.newRecords, [arenas.newRecord('Last Showing')]);
  let record = career.snapshot();
  assert.deepEqual(record.arenas.cinema, { best: 9, runs: 1 });
  assert.equal(record.bests.round, 0, 'the whole mall\'s Highest round is untouched');
  assert.equal(record.totals.runs, 1, 'a shift worked');
  assert.equal(record.recentRuns[0].arena, 'cinema');
  // A worse arena run: counted, no record.
  g.setArena(null);
  g.setArena('cinema');
  run.tick(1);
  g.rounds.jumpTo(4);
  run.tick(1);
  g.health.takeDamage(10000, { type: 'fall', fall: true });
  assert.deepEqual(run.result.newRecords, []);
  // A whole-mall run: its own bests, the arenas untouched.
  g.state.arena = null;
  g.resetRun();
  run.tick(1);
  g.rounds.jumpTo(3);
  run.tick(1);
  g.health.takeDamage(10000, { type: 'fall', fall: true });
  record = career.snapshot();
  assert.deepEqual(record.arenas.cinema, { best: 9, runs: 2 });
  assert.deepEqual(record.arenas.parkingLot, { best: 0, runs: 0 });
  assert.equal(record.bests.round, 3);
  assert.equal(record.totals.runs, 3);
  assert.equal(record.recentRuns[0].arena, null);
  // Read back by a new session.
  assert.deepEqual(createCareerStats({ storage }).snapshot().arenas.cinema, { best: 9, runs: 2 });
});
