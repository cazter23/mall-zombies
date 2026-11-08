// Ritual mode (game/features/workshopSpectacle.js) and the room's moving parts: what shows, what plays, and that all of it goes back.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { weapons } from '../src/config/weapons.js';
import { workshopRitual as cfg, workshopStuffings } from '../src/config/workshop.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { buildModifiers } from '../src/weapons/upgrades.js';
import { audio } from '../src/config/audio.js';
import { collectPointLights } from '../src/fx/lightPool.js';
import { batchStatic } from '../src/world/staticBatch.js';

const Y = LAYOUT.hallway.height + .3;

function fixture() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.map.areaUnlocks.openAll();
  g.health.invulnerable = true;
  g.wallet.earn(50000);
  const instance = g.features.list.find(f => f.feature.kind === 'workshop').instance;
  const bench = g.map.features.find(f => f.kind === 'workshop');
  const { ritual } = instance;
  const stand = (x, z, yaw) => { g.player.teleport({ position: new THREE.Vector3(x, Y, z), yaw }); g.player.pitch = 0; t.tick(); };
  const order = (stuffing = 'fryerOil') => { ritual.choose(stuffing, 'headshot'); stand(0, bench.position.z - 1, Math.PI); t.press('KeyF', 20); t.press('KeyF'); t.tick(); };
  const lever = () => { ritual.finishNow(); t.tick(); }; // (the order finishing, as time running out would)
  const collect = () => { t.tick(Math.ceil(cfg.catchUpSeconds * 60) + 30); }; // it comes back by itself
  const hall = bench.stations.rooms[1];
  const killInRoom = () => {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(hall.maxX - 2, 0, hall.minZ + 1));
    zombie.position.y = Y; zombie.setState('chasing');
    zombie.takeHit({ damage: zombie.health + 1, part: 'body', source: 'hazard' });
    return zombie;
  };
  return { ...t, ritual, bench, st: bench.stations, order, lever, collect, killInRoom, stand };
}

test('every moving part of the room is out of static batching, and the tank starts empty', () => {
  const t = fixture(), { g, st } = t;
  const flagged = (o) => { for (let p = o; p; p = p.parent) if (p.userData.dynamic) return true; return false; };
  for (const part of [st.tank.fill, st.tank.fluff, st.arm.group, st.arm.claw, st.leverHandle, st.flap, st.bulbs]) assert.ok(flagged(part), part.name);
  g.map.group.traverse(o => { if (o.name === 'workshop_belt') assert.ok(flagged(o), 'the belt'); });
  assert.equal(st.tank.fluff.count, 0);
  assert.ok(st.tank.fill.scale.y < .1);
  const before = new Set();
  g.map.group.traverse(o => before.add(o));
  batchStatic(g.map.group);
  for (const part of [st.tank.fill, st.arm.group, st.leverHandle, st.flap]) assert.ok(part.parent, 'still in the scene');
  g.map.dispose();
});

test('ritual mode adds no lights: it recolours the hall\'s two lamps and puts them back', () => {
  const t = fixture(), { g, st, tick } = t;
  const count = collectPointLights(g.map.group).length;
  assert.equal(st.lamps.length, 2);
  const home = st.lamps.map(l => l.color.getHex());
  t.order();
  tick(120);
  assert.equal(collectPointLights(g.map.group).length, count);
  assert.ok(st.lamps.some((l, i) => l.color.getHex() !== home[i]), 'party colours');
  const seen = new Set();
  for (let i = 0; i < 300; i++) { tick(); seen.add(st.lamps[0].color.getHex()); }
  assert.ok(seen.size >= 3, `the lamps cycle: ${seen.size} colours`);
  t.lever();
  assert.deepEqual(st.lamps.map(l => l.color.getHex()), home, 'back to normal once the ritual ends');
  g.map.dispose();
});

test('the tank fills with the stuffing\'s colour as the gauge climbs, and empties at collection', () => {
  const t = fixture(), { g, st, tick } = t;
  t.order('neonTube');
  assert.equal(st.tank.fill.material.color.getHex(), workshopStuffings.neonTube.color);
  const empty = st.tank.fill.scale.y;
  for (let i = 0; i < 8; i++) t.killInRoom();
  tick(120);
  const part = st.tank.fill.scale.y;
  assert.ok(part > empty * 2, `${empty} -> ${part}`);
  assert.ok(st.tank.fluff.count > 0, 'and fluff with it');
  for (let i = 0; i < 12; i++) t.killInRoom();
  tick(120);
  assert.ok(st.tank.fill.scale.y > part);
  assert.ok(st.tank.fill.scale.y <= st.tank.height + 1e-6, 'never past the top of the glass');
  t.lever(); t.collect();
  assert.equal(st.tank.fluff.count, 0);
  assert.ok(st.tank.fill.scale.y < .1);
  g.map.dispose();
});

test('a kill in the room flies into the tank and is gone; a kill elsewhere stays a corpse', () => {
  const t = fixture(), { g, st, tick } = t;
  t.order();
  const inRoom = t.killInRoom();
  const elsewhere = g.zombies.spawn('shopper', new THREE.Vector3(12, 0, 2));
  elsewhere.setState('chasing');
  elsewhere.takeHit({ damage: elsewhere.health + 1, part: 'body', source: 'hazard' });
  const start = inRoom.position.clone();
  tick(20);
  g.zombies.render(0, 1);
  const root = inRoom.model.root;
  assert.ok(root.position.distanceTo(st.tank.mouth) < start.distanceTo(st.tank.mouth), 'on its way');
  assert.ok(root.scale.x < 1, 'shrinking');
  tick(Math.ceil(cfg.spectacle.tankDeathSeconds * 60));
  assert.ok(!g.zombies.zombies.includes(inRoom), 'gone');
  assert.ok(g.zombies.zombies.includes(elsewhere), 'a normal corpse elsewhere');
  assert.ok(t.sounds.includes('tankGulp'));
  g.map.dispose();
});

test('a kill flying into the tank pays once and cleans up on Play again', () => {
  const t = fixture(), { g, tick } = t;
  t.order();
  const before = g.wallet.points, kills = g.runStats.kills;
  t.killInRoom();
  tick(60);
  assert.equal(g.runStats.kills - kills, 1);
  assert.ok(g.wallet.points > before);
  t.killInRoom();
  g.resetRun(); tick();
  assert.equal(g.zombies.zombies.length, 0);
  g.map.dispose();
});

test('a return falls out of the chute, the flap swings, and it lands like any zombie', () => {
  const t = fixture(), { g, st, ritual, tick } = t;
  t.order();
  t.stand(2, 24, 0);
  tick(40);
  assert.equal(ritual.steering, true);
  assert.ok(st.flap.rotation.x > .4, `flap open: ${st.flap.rotation.x}`);
  const zombie = g.zombies.spawn();
  assert.equal(zombie.dropHeight, cfg.chuteDropHeight);
  assert.ok(t.sounds.includes('chuteThunk'));
  g.zombies.render(0, 1);
  const body = zombie.model.root.children.find(c => c.isGroup);
  assert.ok(Math.abs(body.rotation.x) > 1, 'it tumbles as it falls');
  const high = zombie.hitboxes[1].box.min.y;
  assert.ok(high > Y + .5, 'its body starts up by the hatch');
  tick(Math.ceil(zombie.type.spawnSeconds * 60) + 2);
  assert.equal(zombie.state, 'chasing');
  assert.ok(Math.abs(zombie.hitboxes[1].box.min.y - Y) < .05, 'on the floor');
  t.lever();
  tick(60);
  assert.ok(st.flap.rotation.x < .05, 'the flap shuts when the ritual ends');
  g.map.dispose();
});

test('the lever drops by itself when the order is done, and is back up for the next one', () => {
  const t = fixture(), { g, st, tick } = t;
  const up = st.leverHandle.rotation.z;
  t.order();
  t.lever();
  tick(60);
  assert.ok(Math.abs(st.leverHandle.rotation.z - st.leverAngles.down) < .05);
  assert.ok(t.sounds.includes('leverClunk'));
  t.collect();
  tick(60);
  assert.ok(Math.abs(st.leverHandle.rotation.z - up) < .05);
  g.map.dispose();
});

test('running out of time drops the lever too: it marks the order done however it ends', () => {
  const t = fixture(), { g, st, tick } = t;
  t.order();
  tick(Math.ceil(cfg.maxSeconds * 60) + 2);
  assert.equal(t.ritual.phase, 'ready');
  tick(90); // (the lever eases down)
  assert.ok(Math.abs(st.leverHandle.rotation.z - st.leverAngles.down) < .05);
  assert.ok(t.sounds.includes('leverClunk'));
  g.map.dispose();
});

test('the arm lifts the gun off the belt and carries it over the lane to the booth\'s counter', () => {
  const t = fixture(), { g, st, tick, ritual } = t;
  t.order();
  t.lever();
  tick(Math.ceil(cfg.catchUpSeconds * 60) - 3); // (just before it lands: then it comes back to you)
  const last = st.path.at(-1);
  assert.ok(Math.abs(ritual.gunPosition.x - last.x) < .05 && Math.abs(ritual.gunPosition.z - last.z) < .05, 'over the counter');
  assert.ok(ritual.gunPosition.y < st.path.at(-2).y, 'and being lowered onto it');
  assert.ok(Math.abs(st.arm.group.position.x - st.arm.maxX) < .3, 'the arm followed it');
  const lane = st.path.at(-2);
  assert.ok(lane.y - Y > 2.2, 'above anyone walking the lane');
  g.map.dispose();
});

test('the jingle plays over the ritual, quieter from further off, and stops when it ends', () => {
  const t = fixture(), { g, tick } = t;
  const plays = [];
  g.features.context.sound.play = (name, options) => { if (name === 'ritualJingle') plays.push(options.volume); };
  t.order();
  t.stand(2, 14, 0);
  tick(Math.ceil(cfg.spectacle.jingleSeconds * 60) * 2 + 4);
  assert.ok(plays.length >= 2, `${plays.length} plays`);
  assert.ok(plays.every(v => v > 0 && v <= 1));
  const count = plays.length;
  t.lever();
  tick(Math.ceil(cfg.spectacle.jingleSeconds * 60) * 2);
  assert.equal(plays.length, count);
  g.map.dispose();
});

test('the conveyor runs only during a ritual', () => {
  const t = fixture(), { g, st, tick } = t;
  tick(30);
  assert.equal(st.belt.offset.x, 0);
  t.order();
  tick(30);
  assert.notEqual(st.belt.offset.x, 0);
  t.lever();
  const moved = st.belt.offset.x;
  tick(30);
  assert.equal(st.belt.offset.x, moved, 'it stops with the ritual');
  g.map.dispose();
});

test('PA narration follows the conveyor at a lower priority than the order lines', () => {
  const t = fixture(), { hud, tick } = t;
  t.order();
  tick(Math.ceil(cfg.maxSeconds * 60) + 2);
  const said = hud.calls.filter(c => c[0] === 'showAnnouncement').map(c => c[1]);
  const narration = said.filter(line => line.priority === 0);
  assert.deepEqual(narration.map(l => l.text), cfg.stages.slice(1).map(s => cfg.pa.stages[s.id].text));
  t.g.map.dispose();
});

test('a built gun\'s shots streak in its stuffing\'s colour, and pellet guns get it too', () => {
  const t = fixture(), { g, ritual, st } = t;
  g.gun.give(weapons.nailGun); t.tick(50);
  t.order('neonTube'); t.tick(30);
  t.lever(); t.collect();
  assert.equal(g.gun.def.id, 'nailGun');
  assert.equal(g.gun.def.tracerColor, workshopStuffings.neonTube.color);
  assert.equal(weapons.nailGun.tracerColor === workshopStuffings.neonTube.color, false, 'the config entry is untouched');
  const cannon = resolveGun(weapons.confettiCannon, [{ id: 'build', modifiers: buildModifiers(weapons.confettiCannon, 0x123456) }]);
  assert.equal(cannon.pellets.tracerColors[0], 0x123456);
  assert.equal(ritual.phase, 'idle');
  assert.ok(st.lamps);
  g.map.dispose();
});

test('every sound the room asks for exists', () => {
  const ids = [...Object.values(workshopStuffings).map(s => s.sound), 'ritualJingle', 'tankGulp', 'chuteThunk', 'leverClunk'];
  for (const id of ids) assert.ok(audio.sounds[id]?.layers?.length, id);
});

test('Play again mid-ritual puts every part of the room back', () => {
  const t = fixture(), { g, st, tick } = t;
  const home = st.lamps.map(l => l.color.getHex());
  const leverAngle = st.leverHandle.rotation.z;
  t.order();
  t.stand(2, 24, 0);
  t.killInRoom();
  tick(120);
  t.lever();
  tick(30);
  g.resetRun(); tick();
  assert.deepEqual(st.lamps.map(l => l.color.getHex()), home);
  assert.equal(st.tank.fluff.count, 0);
  assert.ok(st.tank.fill.scale.y < .1);
  assert.equal(st.flap.rotation.x, 0);
  assert.equal(st.leverHandle.rotation.z, leverAngle);
  assert.equal(st.belt.offset.x, 0);
  g.map.dispose();
});
