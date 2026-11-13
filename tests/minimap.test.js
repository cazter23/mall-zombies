import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { menuDom } from './helpers/menuDom.js';
import { buildMinimapPlan, minimapState } from '../src/game/minimapPlan.js';
import { minimap as config } from '../src/config/minimap.js';
import { bindings, controlsHelp } from '../src/config/controls.js';
import { settingDefs } from '../src/config/settings.js';

// The fixed plan from the real mall, built once (the map is the slow part).
const t = headlessGame();
const g = t.g;
const plan = buildMinimapPlan(g.map, g.colliders);

test('the plan has both floors, every area on one of them, and each floor only the rooms the map lists for it', () => {
  assert.deepEqual(plan.floors.map((f) => f.id), ['ground', 'upper']);
  const zones = new Set(plan.floors.flatMap((f) => f.rooms.map((r) => r.zone)));
  for (const zone of Object.keys(g.map.zones)) assert.ok(zones.has(zone), `${zone} is on no floor`);
  for (const floor of plan.floors) {
    assert.ok(floor.bounds.maxX > floor.bounds.minX && floor.bounds.maxZ > floor.bounds.minZ);
    assert.equal(new Set(floor.labels.map((l) => l.zone)).size, floor.labels.length, `${floor.id}: one name per area`);
  }
  assert.ok(plan.floors[1].voids.length >= 3, 'the balcony voids and the atrium court are holes upstairs');
  assert.equal(plan.floors[0].voids.length, 0);
});

test('heights map to the right floor; escalators and stairs show on both floors', () => {
  assert.equal(plan.floorAt(0), 0);
  assert.equal(plan.floorAt(3), 0);
  assert.equal(plan.floorAt(6.3), 1);
  assert.ok(g.colliders.ramps.length >= 3);
  for (const floor of plan.floors) assert.equal(floor.ramps.length, g.colliders.ramps.length, `${floor.id}: every ramp joins the floors`);
});

test('every shutter is on the board, on the floor of its doorway', () => {
  const shutters = g.map.doors.filter((d) => d.barrier?.kind === 'shutter');
  assert.equal(plan.shutters.length, shutters.length);
  const upstairs = plan.shutters.filter((s) => s.floor === 1).map((s) => s.id).sort();
  assert.deepEqual(upstairs, ['atriumPromenade', 'cinema']);
});

test('places: only the kinds config/minimap.js lists, never lost property or quest signs; wall buys carry their gun', () => {
  const mapKinds = new Set(g.map.features.map((f) => f.kind));
  for (const kind of Object.keys(config.places)) assert.ok(mapKinds.has(kind), `${kind} is not a feature kind in the mall`);
  const placed = new Set(plan.places.map((p) => p.kind));
  for (const hidden of ['lostProperty', 'refundSign', 'horror', 'wardrobeRack', 'kiosk']) assert.ok(!placed.has(hidden), `${hidden} must not be placed`);
  const wallBuys = plan.places.filter((p) => p.kind === 'wallBuy');
  assert.equal(wallBuys.length, g.map.features.filter((f) => f.kind === 'wallBuy').length);
  for (const p of wallBuys) assert.ok(p.label, 'a wall buy names its gun');
  assert.equal(plan.places.find((p) => p.kind === 'workshop').floor, 1, 'Build-A-Blaster is upstairs');
});

test('state: you, the bought areas, shut shutters priced only where one side is yours, and no zombies', () => {
  t.reset?.();
  g.player.position.set(0, 0, 12);
  g.player.yaw = 1.2;
  const state = minimapState(plan, g);
  assert.deepEqual(state.you, { x: 0, z: 12, yaw: 1.2, floor: 0, area: 'Start Room' });
  assert.deepEqual([...state.open], ['startRoom']);
  const start = state.shutters.find((s) => s.id === 'startShutter');
  assert.equal(start.price, g.pricing.priceOf('door', 'hallway'));
  assert.equal(state.shutters.find((s) => s.id === 'megaMart').price, null, 'neither side bought: no price');
  assert.deepEqual(Object.keys(state).sort(), ['kevin', 'keys', 'open', 'sales', 'shutters', 'you'], 'nothing about zombies or bosses');

  g.map.areaUnlocks.unlock('hallway');
  const after = minimapState(plan, g);
  assert.ok(!after.shutters.some((s) => s.id === 'startShutter'), 'an open shutter leaves the board');
  assert.equal(after.shutters.find((s) => s.id === 'megaMart').price, g.pricing.priceOf('door', 'megaMart'));
});

test("Kevin's cart shows only while it is open, where it stands this round", () => {
  g.map.areaUnlocks.unlock('hallway');
  g.rounds.jumpTo(1);
  assert.equal(minimapState(plan, g).kevin, null, 'shut in round 1');
  g.rounds.jumpTo(2);
  const kevin = minimapState(plan, g).kevin;
  const site = g.features.list.find(({ feature }) => feature.kind === 'kiosk').instance.site;
  assert.deepEqual(kevin, { x: site.cart.position.x, z: site.cart.position.z, floor: 0, area: g.map.zones[site.zone].label });
});

test('a dropped key shows only on a run with guidance (Directed)', () => {
  const position = new THREE.Vector3(3, 6.3, 1);
  const withKey = { ...g, map: g.map, player: g.player, pricing: g.pricing, features: g.features, closing: { pickups: [{ bossId: 'murray', position }] } };
  assert.deepEqual(minimapState(plan, withKey, { guidance: false }).keys, []);
  assert.deepEqual(minimapState(plan, withKey, { guidance: true }).keys, [{ x: 3, z: 1, floor: 1 }]);
});

test('the store index numbers every place once; places of one kind and name in one area share a number', () => {
  const entries = plan.index.flatMap((group) => group.entries);
  assert.deepEqual(entries.map((e) => e.n), entries.map((_, i) => i + 1));
  for (const place of plan.places) assert.ok(entries.some((e) => e.n === place.n), `${place.kind} has no index entry`);
  const attachments = plan.places.filter((p) => p.kind === 'attachmentCounter');
  assert.equal(new Set(attachments.map((p) => p.n)).size, 1, 'the attachment counters are one entry');
  assert.equal(entries.find((e) => e.n === attachments[0].n).count, attachments.length);
  const indexed = new Set(config.index.flatMap((g) => g.kinds));
  for (const kind of Object.keys(config.places)) if (kind !== 'kiosk') assert.ok(indexed.has(kind), `${kind} is in no index group`);
});

test('every area has its colour, every place a pictogram, and every shutter a doorway in the walls', async () => {
  menuDom();
  const { pictogramNames } = await import('../src/ui/minimap.js');
  for (const zone of Object.keys(g.map.zones)) assert.ok(config.areas[zone], `${zone} has no colour`);
  for (const look of [...Object.values(config.places), config.key]) assert.ok(pictogramNames.includes(look.picto), `no pictogram "${look.picto}"`);
  for (const shutter of plan.shutters) assert.ok(plan.openings.some((o) => o.door === shutter.id), `${shutter.id} has no doorway`);
  for (const o of plan.openings) assert.ok(Math.min(o.maxX - o.minX, o.maxZ - o.minZ) < 1.2, 'doorways are gaps in walls, not holes in floors');
});

test('the corner map names the area you are in', () => {
  g.player.position.set(0, 0, 12);
  assert.equal(minimapState(plan, g).you.area, g.map.zones.startRoom.label);
});

test('Tab and the controller Back button are the minimap, shared with nothing, and listed on the Controls screen', () => {
  assert.deepEqual(bindings.minimap, ['Tab', 'PadBack']);
  for (const [action, codes] of Object.entries(bindings)) {
    if (action === 'minimap') continue;
    assert.ok(!codes.includes('Tab') && !codes.includes('PadBack'), `${action} also uses the minimap button`);
  }
  assert.ok(controlsHelp.keyboard.some((e) => e.anchors.includes('Tab')));
  assert.ok(controlsHelp.gamepad.some((e) => e.anchors.includes('back')));
  const setting = settingDefs.find((d) => d.id === 'minimap');
  assert.equal(setting.default, false, 'hidden until asked for');
  assert.equal(setting.tab, null);
});

// ---- The board (ui/minimap.js), on the fake DOM with a canvas that records what it writes ----

async function board() {
  const dom = menuDom();
  dom.document.documentElement = dom.document.createElement('html');
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.getBoundingClientRect = () => ({ width: 300, height: 300 });
  const texts = [];
  const make = dom.document.createElement;
  dom.document.createElement = (tag) => {
    const node = make(tag);
    if (tag === 'canvas') {
      const ctx = new Proxy({}, {
        get: (target, key) => {
          if (key === 'fillText') return (text) => texts.push(String(text));
          if (key === 'measureText') return (text) => ({ width: String(text).length * 6 });
          return key in target ? target[key] : (target[key] = () => ctx);
        },
        set: (target, key, value) => { target[key] = value; return true; },
      });
      node.getContext = () => ctx;
    }
    return node;
  };
  const { createMinimap } = await import('../src/ui/minimap.js');
  const changes = [];
  const view = createMinimap({ onCornerChange: (on) => changes.push(on) });
  const host = dom.document.createElement('div');
  host.className = 'hud';
  host.append(view.element);
  const [corner, full] = view.element.children;
  return { view, corner, full, host, texts, changes };
}

const frame = 1 / 60;
function play(view, state, { held, frames = 1, active = true, guidance = false }) {
  for (let i = 0; i < frames; i++) view.update({ plan, state, held, active, dt: frame, guidance });
}

test('a tap shows or hides the corner map (and says so, to be remembered); a hold shows the directory while held', async () => {
  const { view, corner, full, host, texts, changes } = await board();
  g.player.position.set(0, 0, 12);
  const state = minimapState(plan, g);
  play(view, state, { held: false });
  assert.ok(corner.hidden && full.hidden, 'hidden until asked for');

  play(view, state, { held: true, frames: 3 });
  play(view, state, { held: false });
  assert.equal(view.cornerOn, true);
  assert.deepEqual(changes, [true]);
  assert.ok(!corner.hidden && full.hidden);
  assert.ok(host.classList.contains('minimap-on'), 'the right-hand notices move down under it');
  assert.ok(texts.length === 0 || !texts.some((s) => /YOU ARE HERE/.test(s)), 'the corner map has no titles');

  texts.length = 0;
  play(view, state, { held: true, frames: Math.ceil(config.holdSeconds / frame) + 2 });
  assert.ok(!full.hidden && corner.hidden, 'held: the whole directory, in place of the corner map');
  assert.ok(texts.some((s) => s.includes('YOU ARE HERE')));
  assert.ok(texts.includes(g.pricing.priceOf('door', 'megaMart').toLocaleString('en-US')), 'shutters show their price');
  const indexText = full.children[1].children[1].textContent;
  assert.ok(indexText.includes('Price Gun') && indexText.includes('Wall guns'), 'the store index names the wall guns');
  assert.ok(indexText.includes(config.words.kevinClosed) || indexText.includes('This round'), "the index says where Kevin's cart is");
  play(view, state, { held: false });
  assert.equal(view.cornerOn, true, 'letting go of a hold does not toggle');
  assert.ok(full.hidden && !corner.hidden);

  play(view, state, { held: true, frames: 2 });
  play(view, state, { held: false });
  assert.equal(view.cornerOn, false);
  assert.deepEqual(changes, [true, false]);
  assert.ok(!host.classList.contains('minimap-on'));
});

test('nothing shows in a menu or after death, and a press carried out of a menu does nothing', async () => {
  const { view, corner, full } = await board();
  const state = minimapState(plan, g);
  view.setCornerOn(true);
  play(view, state, { held: false, active: false });
  assert.ok(corner.hidden && full.hidden);
  play(view, state, { held: true, active: false, frames: 5 }); // (pressed on the pause screen)
  play(view, state, { held: true, frames: 40 }); // (still held as the run resumes)
  assert.ok(full.hidden, 'no directory for a press that began in a menu');
  play(view, state, { held: false });
  assert.equal(view.cornerOn, true, 'and letting go of it is not a tap');
  assert.ok(!corner.hidden);
});

test('minimapState and directory draw markers during a teaser, live sale, and Doorbuster across open/adjacent items only', async () => {
  const { view, texts } = await board();
  g.resetRun();
  g.player.position.set(0, 0, 12);
  g.player.yaw = 0;

  assert.equal(minimapState(plan, g).sales.length, 0, 'no sale markers when idle');

  // Teaser for doors marks reachable adjacent shutter(s) as `soon: true`.
  const groups = g.flashSales ? (await import('../src/config/economy.js')).economy.flashSales.groups : [];
  const origGroups = groups.slice();
  const { economy } = await import('../src/config/economy.js');
  economy.flashSales.groups = origGroups.filter((grp) => grp.id === 'doors');
  try {
    assert.equal(g.flashSales.teaseNow('category'), true);
    const soonState = minimapState(plan, g);
    assert.ok(soonState.sales.some((s) => s.category === 'door' && s.soon && s.floor === 0 && !s.doorbuster));
    play(view, soonState, { held: true, frames: 30 });
    assert.ok(texts.includes('%'), 'corner/full directory draws sale badge during teaser');
  } finally {
    economy.flashSales.groups = origGroups;
    g.resetRun();
  }

  // Doorbuster marks only that one open/reachable target with `doorbuster: true`, and removes it once bought.
  g.wallet.earn(10_000);
  g.gun.give((await import('../src/config/weapons.js')).weapons.stapleGun);
  assert.equal(g.flashSales.startNow('doorbuster'), true);
  const dbState = minimapState(plan, g);
  assert.ok(dbState.sales.length >= 1);
  assert.ok(dbState.sales.every((s) => s.doorbuster && !s.soon));
  play(view, dbState, { held: true, frames: 30 });
  assert.ok(texts.includes('!'), 'directory draws Doorbuster badge');
  g.resetRun();
});
