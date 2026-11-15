// ARENA SURVIVAL's menus (ui/screens.js 'runMode' -> 'arenaMode', ui/runStart.js, the 'arenaChoice' setting): Extra Modes on the
// run-mode screen opens the arena list; keyboard, mouse and controller work; Back returns a level; the choice is remembered;
// each arena shows its best round; starting one locks the run in it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';
import { padInput } from './helpers/padInput.js';

menuDom(); // config/settings reads the display density once when imported
const { createScreens, receiptLinesFor } = await import('../src/ui/screens.js');
const { settingDefs } = await import('../src/config/settings.js');
const { createSettings } = await import('../src/game/settings.js');
const { createRunStart } = await import('../src/ui/runStart.js');
const { arenas } = await import('../src/config/arenas.js');
const { headlessGame } = await import('./helpers/headlessGame.js');

function withStorage(t) {
  const stored = new Map();
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)) },
  });
  t.after(() => (before ? Object.defineProperty(globalThis, 'localStorage', before) : delete globalThis.localStorage));
  const anything = new Proxy(function () {}, { get: () => anything, apply: () => anything, set: () => true });
  return { ctx: anything };
}

test('Extra Modes: listed after Classic, opens the arena list (each with its line and best round), Back returns a level', () => {
  const { document, key } = menuDom();
  const screens = createScreens();
  const choices = [];
  const button = (action) => document.querySelector('[data-action="' + action + '"]');
  const arenaButton = (id) => document.querySelector('[data-arena="' + id + '"]');
  const pad = (code) => screens.padNav(padInput(code));
  screens.on('startRun', (choice) => { choices.push(choice); screens.show(null); });
  screens.show('title');

  button('play').click();
  button('extraModes').click();
  assert.equal(screens.current, 'arenaMode');
  assert.equal(screens.showsFlyover, true, 'over the title flyover, like the chooser');
  const listed = arenaButton('cinema').parentElement.querySelectorAll('[data-action]')
    .map((node) => node.dataset.arena ?? node.dataset.action);
  assert.deepEqual(listed, [...arenas.list.map(({ id }) => id), 'arenaBack']);
  for (const arena of arenas.list) assert.equal(arenaButton(arena.id).textContent, arena.name);
  assert.equal(document.activeElement, arenaButton('startRoom'), 'the first arena is focused the first time');
  const best = (id) => document.querySelector('[data-arena-best="' + id + '"]').textContent;
  assert.equal(best('cinema'), arenas.menu.noBest);
  screens.setArenaBests({ cinema: 12 });
  assert.equal(best('cinema'), arenas.menu.best(12));
  assert.equal(best('parkingLot'), arenas.menu.noBest);

  // Back by button, Escape and the controller: one level, the cursor on Extra Modes.
  button('arenaBack').click();
  assert.equal(screens.current, 'runMode');
  assert.equal(document.activeElement, button('extraModes'));
  button('extraModes').click();
  assert.equal(key('Escape').defaultPrevented, true);
  assert.equal(screens.current, 'runMode');
  button('extraModes').click();
  pad('PadB');
  assert.equal(screens.current, 'runMode');
  assert.equal(document.activeElement, button('extraModes'));
  pad('PadB');
  assert.equal(screens.current, 'title');
  assert.deepEqual(choices, []);

  // The controller walks down to an arena and picks it.
  pad('PadStart');
  pad('PadDown');
  pad('PadDown');
  assert.equal(document.activeElement, button('extraModes'));
  pad('PadA');
  assert.equal(screens.current, 'arenaMode');
  pad('PadDown');
  assert.equal(document.activeElement, arenaButton('cinema'));
  pad('PadA');
  assert.deepEqual(choices, [{ mode: null, arena: 'cinema', pad: true }]);

  // The arena chosen last: Extra Modes is focused (and primary), and that arena inside it.
  screens.setArenaChoice('parkingLot');
  screens.show('title');
  button('play').click();
  assert.equal(document.activeElement, button('extraModes'));
  assert.ok(button('extraModes').classList.contains('primary') && !button('directed').classList.contains('primary'));
  button('extraModes').click();
  assert.equal(document.activeElement, arenaButton('parkingLot'));
  arenaButton('parkingLot').click();
  assert.deepEqual(choices.at(-1), { mode: null, arena: 'parkingLot', pad: false });
  screens.setArenaChoice('nonsense');
  assert.equal(screens.arenaChoice, null, 'an unknown id is no arena');
});

test('starting an arena locks the run in it and is remembered; a mode afterwards goes back to the whole mall', (t) => {
  menuDom();
  const { ctx } = withStorage(t);
  const { g } = headlessGame();
  t.after(() => g.map.dispose());
  const def = settingDefs.find(({ id }) => id === 'arenaChoice');
  assert.equal(def.tab, null, 'not on any Settings tab');
  assert.deepEqual(def.options.map(({ value }) => value), ['none', ...arenas.list.map(({ id }) => id)]);
  const settings = createSettings(ctx);
  const screens = createScreens();
  const plays = [];
  const runStart = createRunStart({ game: g.state, screens, settings, play: (how) => { plays.push(how); screens.show(null); }, setArena: g.setArena });
  const button = (action) => globalThis.document.querySelector('[data-action="' + action + '"]');
  const arenaButton = (id) => globalThis.document.querySelector('[data-arena="' + id + '"]');

  screens.show('title');
  button('play').click();
  button('extraModes').click();
  assert.equal(runStart.acceptsLock(), false, 'opening the list asked for nothing');
  arenaButton('cinema').click();
  assert.equal(g.state.arena, 'cinema');
  assert.equal(g.map.arena, 'cinema');
  assert.equal(settings.get('arenaChoice'), 'cinema');
  assert.equal(settings.get('closingMode'), 'directed', 'the run mode is left as it was');
  assert.deepEqual(plays, [{ pad: false }]);

  screens.show('title');
  button('play').click();
  button('classic').click();
  assert.equal(g.state.arena, null);
  assert.equal(g.map.arena, null);
  assert.equal(settings.get('arenaChoice'), 'none');
  assert.equal(g.state.closingMode, 'classic');

  // A new session: the arena chosen last is focused.
  settings.set('arenaChoice', 'startRoom');
  menuDom();
  const later = createScreens();
  createRunStart({ game: {}, screens: later, settings: createSettings(ctx), play() {} });
  later.show('title');
  globalThis.document.querySelector('[data-action="play"]').click();
  assert.equal(globalThis.document.activeElement, globalThis.document.querySelector('[data-action="extraModes"]'));
});

test('the receipt and the title name the arena', () => {
  menuDom();
  const lines = receiptLinesFor({ timeAlive: 60, round: 4, kills: 10, headshotKills: 2, meleeKills: 1, accuracy: 0.5, arena: 'parkingLot', closingDone: null });
  assert.deepEqual(lines[0], [arenas.receiptLabel, 'Lot Full']);
  const plain = receiptLinesFor({ timeAlive: 60, round: 4, kills: 10, headshotKills: 2, meleeKills: 1, accuracy: 0.5, closingDone: null });
  assert.ok(!plain.some(([label]) => label === arenas.receiptLabel), 'a whole-mall receipt has no arena line');
  const screens = createScreens();
  screens.setContinue({ round: 7, arena: 'cinema' });
  assert.equal(globalThis.document.querySelector('[data-action="continue"]').textContent, 'Continue · Round 7 · Last Showing');
  screens.setContinue({ round: 7, arena: null });
  assert.equal(globalThis.document.querySelector('[data-action="continue"]').textContent, 'Continue · Round 7');
});
