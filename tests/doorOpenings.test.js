// Buying a door is a moment (game/doorOpenings.js): the bus announcements, the PA welcome rule, the light version for
// free connections, a load that replays nothing, and the doorway's collider leaving on exactly the tick it always did.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createShutter } from '../src/world/shutter.js';
import { shutters, shutterFinish } from '../src/config/shutters.js';
import { feel } from '../src/config/feel.js';
import { createAnnouncements } from '../src/ui/announcements.js';
import { createAnnouncer } from '../src/game/announcer.js';
import { createEvents } from '../src/game/events.js';

const { opening } = shutters;

function started(options) {
  const t = headlessGame(options);
  t.tick();
  t.g.rounds.update = () => {};
  t.g.zombies.clear();
  t.g.health.invulnerable = true;
  const log = [];
  for (const name of ['purchase', 'areaOpened', 'barrierOpening', 'barrierOpened']) t.g.events.on(name, (e) => log.push([name, e]));
  t.log = (name) => log.filter(([n]) => n === name).map(([, e]) => e);
  return t;
}

function buy(t, id, x, z, yaw = 0, y = 0) {
  t.g.player.teleport({ position: new THREE.Vector3(x, y, z), yaw: yaw * Math.PI / 180 });
  t.tick();
  assert.equal(t.g.interactions.prompt?.id, id, `prompt for ${id}`);
  t.press('KeyF', 30);
}

const welcomes = (t) => t.hud.calls.filter(([name, m]) => name === 'showAnnouncement' && m.kicker === opening.welcome.kicker);

function memoryStorage() {
  const items = new Map();
  return { items, getItem: (k) => (items.has(k) ? items.get(k) : null), setItem: (k, v) => { items.set(k, String(v)); }, removeItem: (k) => { items.delete(k); } };
}

test('the open event fires once per purchase with the right area; the bought barrier gets the full show', () => {
  const t = started(), { g } = t;
  g.wallet.earn(5000);
  const kicks = [];
  const addRecoil = g.player.addRecoil.bind(g.player);
  g.player.addRecoil = (...args) => { kicks.push(args); addRecoil(...args); };
  buy(t, 'startShutter', 0, 8.5);
  assert.deepEqual(t.log('areaOpened').map(e => [e.areaId, e.doorId, e.first]), [['hallway', 'startShutter', true]]);
  const [rolling] = t.log('barrierOpening');
  assert.equal(t.log('barrierOpening').length, 1);
  assert.equal(rolling.bought, true);
  assert.equal(rolling.profile, shutterFinish('startShutter').profile);
  const pa = t.log('areaOpened')[0].pa;
  assert.ok(opening.welcome.lines.hallway.includes(pa.text), 'a hallway welcome');
  assert.equal(pa.ifQuiet, true);
  assert.equal(welcomes(t).length, 1, 'the PA reads it');
  assert.equal(t.log('barrierOpened').length, 0, 'still rolling');
  t.tick(90);
  const [done] = t.log('barrierOpened');
  assert.equal(t.log('barrierOpened').length, 1);
  assert.equal(done.near, true);
  assert.deepEqual(kicks, [[opening.nudge.pitch, opening.nudge.roll]], 'one small nudge as it clunks home');
  assert.ok(g.map.doors.find(d => d.id === 'startShutter').barrier.isOpen);
  g.map.dispose();
});

test('free connections get the light version: no motor, no PA, no nudge, a quieter clunk', () => {
  const t = started(), { g } = t;
  g.wallet.earn(5000);
  buy(t, 'startShutter', 0, 8.5);
  buy(t, 'megaMart', 18.6, 2, -90);
  t.tick(90);
  const played = [];
  g.player.addRecoil = () => played.push('nudge');
  buy(t, 'foodCourt', 0, -.8);
  const opened = t.log('areaOpened');
  assert.equal(opened.length, 3, 'one per purchase');
  assert.deepEqual(opened.at(-1).openedDoorIds.sort(), ['foodCourt', 'foodCourtMegaMart']);
  const rolling = t.log('barrierOpening').filter(e => e.areaId === 'foodCourt');
  assert.deepEqual(rolling.map(e => [e.doorId, e.bought]), [['foodCourt', true], ['foodCourtMegaMart', false]]);
  // The shortcut's curtain rattles less: compare how far it is pushed sideways a few ticks in.
  const sideways = (id) => {
    const b = g.map.doors.find(d => d.id === id).barrier;
    const c = b.collider.getCenter(new THREE.Vector3());
    return Math.abs(b.mesh.position.x - c.x) + Math.abs(b.mesh.position.z - c.z);
  };
  let full = 0, light = 0;
  for (let i = 0; i < 12; i++) { t.tick(); full = Math.max(full, sideways('foodCourt')); light = Math.max(light, sideways('foodCourtMegaMart')); }
  assert.ok(full > 0 && light > 0 && light < full, `light rattle ${light} < full ${full}`);
  t.tick(90);
  assert.deepEqual(t.log('barrierOpened').filter(e => e.areaId === 'foodCourt').map(e => e.doorId).sort(), ['foodCourt', 'foodCourtMegaMart']);
  assert.equal(played.length, 1, 'only the bought door nudges the view');
  assert.equal(welcomes(t).length, 3, 'one welcome per area, none for the shortcut');
  for (const id of ['foodCourt', 'foodCourtMegaMart']) {
    const b = g.map.doors.find(d => d.id === id).barrier;
    assert.equal(b.mesh.position.x, b.collider.getCenter(new THREE.Vector3()).x, `${id} settles back on its centre`);
  }
  g.map.dispose();
});

test('the PA welcome is only for an area\'s first opening in a run; a new run welcomes again', () => {
  const t = started(), { g } = t;
  g.wallet.earn(5000);
  buy(t, 'startShutter', 0, 8.5);
  // (an area cannot be bought twice; a second announcement of the same area is not its first)
  g.events.emit('purchase', { kind: 'door', id: 'startShutter', areaId: 'hallway', openedDoorIds: [], cost: 0 });
  assert.deepEqual(t.log('areaOpened').map(e => [e.first, !!e.pa]), [[true, true], [false, false]]);
  assert.equal(welcomes(t).length, 1);
  g.resetRun(); t.tick();
  g.rounds.update = () => {}; g.zombies.clear(); g.wallet.earn(5000);
  buy(t, 'startShutter', 0, 8.5);
  assert.equal(t.log('areaOpened').at(-1).first, true, 'a new run');
  assert.equal(welcomes(t).length, 2);
  g.map.dispose();
});

test('Save & Quit: a load finds its doorways already open, with no show replayed and its areas already welcomed', (t) => {
  const storage = memoryStorage();
  const run = started({ saveStorage: storage });
  t.after(() => run.g.map.dispose());
  const { g } = run;
  g.wallet.earn(5000);
  buy(run, 'startShutter', 0, 8.5);
  buy(run, 'foodCourt', 0, -.8);
  run.tick(90);
  g.rounds.jumpTo(3);
  run.tick();
  assert.equal(g.saveGame.saveAndQuit(), true);

  const loaded = started({ saveStorage: storage });
  t.after(() => loaded.g.map.dispose());
  const before = loaded.sounds.length;
  assert.equal(loaded.g.saveGame.load(), true);
  for (const id of ['startShutter', 'foodCourt']) {
    const door = loaded.g.map.doors.find(d => d.id === id);
    assert.equal(door.barrier.state, 'open', `${id} is open at once, not rolling`);
    assert.equal(door.barrier.mesh.visible, false);
    assert.equal(loaded.g.colliders.includes(door.barrier.collider), false, `${id}: walk straight through`);
  }
  loaded.tick(120);
  for (const name of ['areaOpened', 'barrierOpening', 'barrierOpened']) assert.equal(loaded.log(name).length, 0, `no ${name} on a load`);
  const doorSounds = loaded.sounds.slice(before).filter(s => s.startsWith('shutter'));
  assert.deepEqual(doorSounds, [], 'no door sounds on a load');
  assert.equal(welcomes(loaded).length, 0);
  assert.deepEqual(loaded.g.doorOpenings.welcomed.sort(), ['foodCourt', 'hallway', 'startRoom']);
});

test('collision opens on exactly the tick it always did; the curtain is never drawn below the real roll', () => {
  const dt = 1 / feel.simulation.tickRate, height = 3.4;
  // The roll before the open sequence: linear, the collider goes once there is head room.
  let raised = 0, expected = 0;
  const speed = height / feel.world.shutterOpenSeconds;
  while (raised < feel.player.height + 0.1) { raised = Math.min(height, raised + speed * dt); expected++; }
  for (const finish of Object.values(shutters.finishes)) for (const light of [false, true]) {
    const colliders = [];
    const s = createShutter({ name: 'x', minX: -2, maxX: 2, minZ: 0, maxZ: .3, height, finish,
      material: new THREE.MeshStandardMaterial(), colliders });
    s.open({ light });
    let ticks = 0;
    while (colliders.includes(s.collider)) {
      s.update(dt); ticks++;
      assert.ok(s.drawnRaise >= s.raised - 1e-9, 'drawn at or above the real roll');
    }
    assert.equal(ticks, expected, `${finish.profile}${light ? ' (light)' : ''}: collider leaves on tick ${expected}`);
    assert.ok(s.drawnRaise >= feel.player.height + 0.1, 'the doorway LOOKS open when it is');
    while (!s.isOpen) { s.update(dt); ticks++; }
    assert.ok(ticks * dt < 2, 'fully up in under two seconds');
  }
  // instant (a load): open, unblocked and hidden in the same call
  const colliders = [];
  const s = createShutter({ name: 'y', minX: -2, maxX: 2, minZ: 0, maxZ: .3, height, material: new THREE.MeshStandardMaterial(), colliders });
  s.open({ instant: true });
  assert.equal(s.state, 'open');
  assert.equal(colliders.includes(s.collider), false);
  assert.equal(s.mesh.visible, false);
});

test('an ifQuiet line never stacks: dropped (and not chimed) while another PA line is up, shown when quiet', () => {
  const shown = [];
  const board = createAnnouncements({ show: (m) => shown.push(m.text), hide() {}, schedule: () => 1, cancel() {} });
  assert.equal(board.push({ text: 'Welcome.', ifQuiet: true }), true, 'quiet: shown');
  board.clear();
  board.push({ text: 'A Flash Sale.' });
  assert.equal(board.push({ text: 'Welcome.', ifQuiet: true }), false, 'busy: dropped');
  assert.deepEqual(shown, ['Welcome.', 'A Flash Sale.']);

  const events = createEvents(), sounds = [];
  const hud = { showAnnouncement: () => false };
  createAnnouncer({ events, hud, sound: { play: (n) => sounds.push(n) }, state: {} }).runAndFeatures();
  events.emit('areaOpened', { pa: { kicker: 'Now open', text: 'x', ifQuiet: true } });
  assert.deepEqual(sounds, [], 'a dropped line plays no chime');
});

test('every area has a welcome in the PA voice; every finish has a known opening profile', () => {
  const { g } = headlessGame();
  for (const id of Object.keys(g.map.zones).filter(id => !g.map.zones[id].open)) {
    const lines = opening.welcome.lines[id];
    assert.ok(lines?.length, `${id} has a welcome`);
    for (const line of lines) {
      assert.ok(!line.includes('!'), `no exclamation marks: ${line}`);
      assert.ok(line.split(/\s+/).length <= 16, `short enough for the banner: ${line}`);
    }
  }
  for (const [name, finish] of Object.entries(shutters.finishes)) assert.ok(opening.profiles[finish.profile], `${name}: profile`);
  for (const door of g.map.doors) {
    const profile = door.barrier.finish?.profile ?? opening.otherBarrier;
    assert.ok(opening.profiles[profile], `${door.id}: ${profile}`);
  }
  g.map.dispose();
});
