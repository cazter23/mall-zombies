// The debug keys (config/debug.js `commands` -> game/debugCommands.js): one table of keys, run as plain functions on the
// real game. Checked: the table (unique keys, none clashing with gameplay, every id implemented), every command's effect
// in the real game/mall, god mode and the window state surviving Play again, and the debug window (ui/debugPanel.js).
// Also DEBUG MODE (game/debugMode.js): off for players, and the mall's light does not depend on the test range it builds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { menuDom } from './helpers/menuDom.js';
import { debug, keyLabel } from '../src/config/debug.js';
import { bindings } from '../src/config/controls.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { zombieTypes } from '../src/config/zombies.js';
import { upgrades } from '../src/config/upgrades.js';
import { createDebugCommands } from '../src/game/debugCommands.js';
import { createDebugPanel } from '../src/ui/debugPanel.js';
import { buildTestRange } from '../src/maps/testRange/testRange.js';
import { debugModeOn } from '../src/game/debugMode.js';
import * as THREE from 'three';

const WALL_GUNS = Object.keys(weapons).filter((id) => id !== 'stapleGun');

// A started game, no round logic running by itself, nobody around.
function fixture(options = {}) {
  const t = headlessGame(options);
  t.tick(1);
  t.g.rounds.update = () => {}; // (round numbers only change when a command says so)
  t.g.zombies.clear();
  return t;
}

test('the key table: every id is implemented once, keys are unique, and none clash with a gameplay binding', () => {
  const t = fixture();
  const ids = debug.commands.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  assert.deepEqual([...ids].sort(), [...t.g.debug.ids].sort(), 'every table entry has a function, and every function an entry');
  const combos = debug.commands.map((c) => `${c.shift ? 'Shift+' : ''}${c.key}`);
  assert.equal(new Set(combos).size, combos.length, 'unique key combinations');
  const gameplay = new Set(Object.values(bindings).flat());
  for (const c of debug.commands) {
    assert.ok(!gameplay.has(c.key), `${c.id}: ${c.key} is a gameplay key`);
    assert.ok(c.group && c.label, c.id);
  }
  assert.ok(ids.includes('panel'));
  assert.deepEqual(['KeyZ', 'Backquote', 'Quote', 'Digit5'].map(keyLabel), ['Z', '`', "'", '5']);
  assert.throws(() => t.g.debug.run('nope'), /unknown command/);
});

test('keys resolve to commands, with Shift as an exact match', () => {
  const t = fixture();
  const d = t.g.debug;
  assert.equal(d.resolve('KeyZ', false).id, 'spawn');
  assert.equal(d.resolve('KeyZ', true).id, 'cycleZombie');
  assert.equal(d.resolve('KeyN', false).id, 'nextRound');
  assert.equal(d.resolve('KeyN', true).id, 'jumpRounds');
  assert.equal(d.resolve('Backquote', false).id, 'panel');
  assert.equal(d.resolve('KeyO', true), null, 'Shift+O is nothing');
  assert.equal(d.resolve('KeyJ', false).id, 'summonBoss');
});

test('zombies: cycle through every type, spawn the selected one, kill them for points, clear them', () => {
  const t = fixture();
  const d = t.g.debug;
  const types = Object.keys(zombieTypes);
  d.run('doors'); // (every zone open: plenty of spawn points far from the start room)
  t.tick(30); // (the zombies' route field is rebuilt for the open doors)
  assert.equal(d.status().zombieType, 'Shopper');
  const seen = [];
  for (let i = 0; i < types.length; i++) {
    let message = d.run('spawn');
    for (let tries = 0; tries < 20 && !message.startsWith('Spawned'); tries++) { t.tick(20); message = d.run('spawn'); } // (a marker may be cooling down)
    assert.match(message, /^Spawned /);
    const spawned = t.g.zombies.zombies.at(-1);
    seen.push(spawned.type.id);
    d.run('cycleZombie');
  }
  assert.deepEqual(seen, types, 'one of each type, in order');
  assert.equal(d.status().zombieType, 'Shopper', 'and it wraps round');

  const before = t.g.wallet.points;
  const alive = t.g.zombies.aliveCount;
  assert.equal(alive, types.length);
  t.g.health.invulnerable = true; // (they are walking at the player while the test runs)
  assert.equal(d.run('killZombies'), `Killed ${alive} zombies`);
  assert.equal(t.g.zombies.aliveCount, 0);
  assert.equal(t.g.runStats.kills, alive, 'counted as kills');
  const expected = Object.values(zombieTypes).reduce((sum, type) => sum + economy.killValues[type.id], 0);
  assert.equal(t.g.wallet.points - before, expected, 'a hazard kill pays the kill value of each zombie');

  t.g.zombies.clear();
  for (let tries = 0; tries < 20 && !d.run('spawn').startsWith('Spawned'); tries++) t.tick(20);
  assert.equal(d.run('clearZombies'), 'Removed 1 zombie');
  assert.equal(t.g.zombies.aliveCount, 0);
  assert.equal(t.g.wallet.points - before, expected, 'clearing pays nothing');
});

test('rounds: next round, jump ahead 5 (also before round 1 has started), flash sale now', () => {
  const t = fixture();
  const d = t.g.debug;
  const round = t.g.rounds.round;
  assert.equal(d.run('nextRound'), `Round ${round + 1}`);
  assert.equal(t.g.rounds.round, round + 1);
  d.run('jumpRounds');
  assert.equal(t.g.rounds.round, round + 1 + debug.jumpRounds);
  assert.equal(t.g.zombies.aliveCount, 0);

  const fresh = headlessGame();
  assert.equal(fresh.g.rounds.started, false);
  fresh.g.debug.run('jumpRounds');
  assert.equal(fresh.g.rounds.round, 1 + debug.jumpRounds, 'from round 0 it lands on round 6');
  assert.equal(fresh.g.rounds.started, true);

  const g = t.g;
  assert.equal(g.flashSales.active, null);
  const message = d.run('flashSale');
  assert.match(message, /^Flash Sale: /);
  assert.ok(g.flashSales.active);
  assert.ok(g.flashSales.active.categories.some((c) => g.pricing.discountOf(c) > 0), 'the discount applies');
  assert.equal(d.run('flashSale'), 'A Flash Sale is already running');
  assert.match(d.status().sale, /-\d+%$/);
  g.resetRun();
  assert.equal(g.flashSales.active, null, 'a new run ends it');
});

test('points: +5000 and back to 0', () => {
  const t = fixture();
  const d = t.g.debug;
  const before = t.g.wallet.points;
  assert.equal(d.run('addPoints'), '+5000 points');
  assert.equal(t.g.wallet.points, before + debug.addPointsAmount);
  d.run('zeroPoints');
  assert.equal(t.g.wallet.points, 0);
});

test('god mode: no damage from any hit while on; off again takes damage; stays on through Play again', () => {
  const t = fixture();
  const { g } = t;
  const hp = () => g.stats.health;
  const full = hp();
  assert.equal(g.debug.run('god'), 'God mode on');
  g.events.emit('playerHit', { damage: 40, zombie: null });
  g.events.emit('playerHit', { damage: 1000, zombie: null });
  assert.equal(hp(), full);
  assert.equal(g.health.isDead, false);
  assert.equal(g.debug.status().god, true);
  g.resetRun();
  assert.equal(g.health.invulnerable, true, 'a debug setting, not part of a run');
  g.events.emit('playerHit', { damage: 40, zombie: null });
  assert.equal(hp(), full);
  assert.equal(g.debug.run('god'), 'God mode off');
  g.events.emit('playerHit', { damage: 40, zombie: null });
  assert.equal(hp(), full - 40);
});

test('give the next wall gun (and refill it), then upgrade the gun in hand one free tier at a time', () => {
  const t = fixture();
  const { g } = t;
  const d = g.debug;
  assert.deepEqual(g.gun.slots, ['stapleGun']);
  for (const id of WALL_GUNS) {
    assert.equal(d.run('giveGun'), `Gave the ${weapons[id].name}`);
    t.tick(60); // let the switch finish
    assert.equal(g.gun.def.id, id, 'the new gun is in hand');
    assert.ok(g.gun.owns(id));
  }
  assert.equal(g.gun.slots.length, 2, 'two slots: a full loadout replaces the gun in hand');
  const first = WALL_GUNS[0];
  g.gun.weapon.magazine = 0;
  const lastIsOwned = g.gun.owns(first);
  assert.match(d.run('giveGun'), lastIsOwned ? /^Refilled/ : /^Gave/, 'a second lap');

  // Upgrades: the staple gun through every tier, then nothing further.
  const staple = headlessGame();
  const sd = staple.g.debug;
  const sg = staple.g;
  const base = sg.gun.def.damage;
  const names = upgrades.tiers.slice(1).map((tier) => tier.name);
  let last = base;
  for (const name of names) {
    assert.equal(sd.run('upgradeGun'), `${sg.gun.def.name}: ${name}`);
    assert.ok(sg.gun.def.damage > last, `${name} hits harder`);
    last = sg.gun.def.damage;
  }
  assert.match(sd.run('upgradeGun'), /already Platinum$/);
  assert.equal(sg.gun.def.damage, last, 'nothing past Platinum');
  sg.resetRun();
  assert.equal(sg.gun.def.damage, base, 'Play again drops the upgrades');
});

test('map: every door open and closed again, the test range there and back', () => {
  const t = fixture({ buildTestRange });
  const { g } = t;
  const d = g.debug;
  assert.equal(d.run('doors'), 'Every door open');
  assert.ok(g.map.doors.every((door) => door.isOpen));
  assert.equal(d.run('doors'), 'Doors closed');
  assert.ok(g.map.doors.every((door) => !door.isOpen));

  assert.ok(g.arena, 'the test range is built when debug.testArena is on (main.js passes it)');
  assert.equal(d.run('arena'), 'In the test range');
  assert.ok(g.arena.contains(g.player.position));
  assert.equal(d.run('arena'), 'Back in the mall');
  assert.ok(!g.arena.contains(g.player.position));

  const bare = createDebugCommands({ ...g, map: g.map, arena: null, zombies: g.zombies, rounds: g.rounds, wallet: g.wallet, gun: g.gun, health: g.health, player: g.player, flashSales: g.flashSales });
  assert.match(bare.run('arena'), /switched off/);
});

test('the debug window lists every key by group, shows/hides with the game state, and refreshes its numbers', () => {
  const t = fixture();
  const dom = menuDom();
  const d = t.g.debug;
  const panel = createDebugPanel({ status: () => d.status() });
  dom.document?.body?.append?.(panel.element);
  const text = () => panel.element.textContent;

  assert.equal(panel.visible, false);
  assert.equal(panel.element.getAttribute('aria-hidden'), 'true');
  panel.update(1 / 60);
  assert.equal(panel.element.classList.contains('show'), debug.panel.startOpen);
  if (debug.panel.startOpen) d.run('panel'); // start from hidden

  d.run('panel');
  panel.update(1 / 60);
  assert.equal(panel.visible, true);
  assert.equal(panel.element.getAttribute('aria-hidden'), 'false');
  assert.ok(panel.element.classList.contains('show'));
  const rows = panel.element.querySelectorAll('.debug-row');
  assert.equal(rows.length, debug.commands.length, 'one row per command');
  for (const c of debug.commands) {
    assert.ok(text().includes(c.label), c.label);
    assert.ok(text().includes((c.shift ? 'Shift+' : '') + keyLabel(c.key)), c.id);
  }
  for (const group of new Set(debug.commands.map((c) => c.group))) assert.ok(text().includes(group), group);
  // The status headings name the keys the table actually binds (god mode once said G after it moved to B).
  const godKey = keyLabel(debug.commands.find((c) => c.id === 'god').key);
  const headings = panel.element.querySelectorAll('.debug-selection').map((field) => field.children[0].textContent);
  assert.ok(headings.includes(`${godKey} toggles god mode`), headings.join(' | '));
  for (const heading of headings) assert.ok(!/^G toggles/.test(heading) || godKey === 'G', 'no stale G heading');
  assert.ok(text().includes(`Round ${t.g.rounds.round}`), 'live numbers');
  assert.equal(panel.element.querySelectorAll('section').length, new Set(debug.commands.map(c => c.group)).size);
  assert.ok(text().includes(d.status().nextGun), 'the next gun is visible before pressing H');
  const previousGun = d.status().nextGun;
  d.run('giveGun');
  panel.update(debug.panel.refreshSeconds);
  assert.notEqual(d.status().nextGun, previousGun);
  assert.ok(text().includes(d.status().nextGun));
  d.run('summonBoss');
  panel.update(debug.panel.refreshSeconds);
  assert.ok(text().includes(t.g.bosses.active.type.name), 'an active boss is named');

  d.run('addPoints');
  d.run('god');
  panel.update(debug.panel.refreshSeconds * 0.4);
  assert.ok(!text().includes('GOD'), 'refreshes a few times a second, not every frame');
  panel.update(debug.panel.refreshSeconds);
  assert.ok(text().includes('GOD'));
  assert.ok(text().includes('God mode on'), 'the last result is shown');
  assert.ok(text().includes(`${t.g.wallet.points} pts`));

  d.run('panel');
  panel.update(1 / 60);
  assert.equal(panel.visible, false);
  assert.equal(panel.element.getAttribute('aria-hidden'), 'true');
  assert.ok(!panel.element.classList.contains('show'));
});

test('debug mode is off for players: on only for the dev server, an address with ?debug, or the saved Settings switch', () => {
  assert.equal(debugModeOn(), false, 'a player opening the game');
  assert.equal(debugModeOn({ dev: false, search: '?nowarmup', saved: false }), false, 'other address flags are not it');
  assert.equal(debugModeOn({ dev: true }), debug.mode.inDev, 'the dev server');
  assert.equal(debugModeOn({ search: `?${debug.mode.urlFlag}` }), true, '?debug');
  assert.equal(debugModeOn({ search: `?nowarmup&${debug.mode.urlFlag}` }), true, 'with other flags');
  assert.equal(debugModeOn({ saved: true }), true, 'the Settings switch');
  assert.equal(debugModeOn({ saved: 'yes' }), false, 'only a real saved true');
});

test('the mall is lit the same with or without the test range: the sky lights are the mall\'s, the range lamp stops short', () => {
  const withRange = headlessGame({ buildTestRange }); // (as main.js does in debug mode)
  const without = headlessGame(); // (debug mode off: no range)
  const skyLights = (root) => { const out = []; root.traverse((o) => { if (o.isHemisphereLight) out.push(o); }); return out; };
  assert.equal(skyLights(without.g.map.group).length, 2, 'the mall carries both sky lights itself (its sky and the steady fill)');
  assert.equal(skyLights(withRange.g.arena.group).length, 0, 'the range adds no sky light of its own');
  assert.equal(without.g.arena, null);
  // The range's lamps reach only the range: none gets to the nearest of the mall's walls and floors (its solid boxes; the
  // ground plane round the parking lot reaches out under the range, and its far corner can catch the lamp's edge: it always could).
  withRange.g.arena.group.traverse((o) => {
    if (!o.isPointLight) return;
    const at = o.getWorldPosition(new THREE.Vector3());
    const nearest = Math.min(...without.g.colliders.map((box) => box.distanceToPoint(at)));
    assert.ok(o.distance > 0, 'a range lamp has a reach');
    assert.ok(nearest > o.distance, `the range lamp stops ${(nearest - o.distance).toFixed(1)} m short of the mall`);
  });
  withRange.g.map.dispose();
  without.g.map.dispose();
});
