import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';
import { createModal } from '../src/ui/modal.js';
import { padInput } from './helpers/padInput.js';

menuDom(); // config/settings reads the display density once when imported
const { createScreens } = await import('../src/ui/screens.js');
const { createSettingsMenu } = await import('../src/ui/settingsMenu.js');
const { settingDefs, settingPresets, settingsTabs } = await import('../src/config/settings.js');
const { createSettings } = await import('../src/game/settings.js');
const { createRunStart } = await import('../src/ui/runStart.js');
const { closingTime } = await import('../src/config/closingTime.js');
const { headlessGame } = await import('./helpers/headlessGame.js');

function settingsMenu() {
  const dom = menuDom();
  const values = Object.fromEntries(settingDefs.map((def) => [def.id, def.default]));
  const changes = [];
  const resets = [];
  const settings = {
    defs: settingDefs,
    get: (id) => values[id],
    set(id, value) { values[id] = value; changes.forEach((fn) => fn()); },
    reset(tab) {
      resets.push(tab ?? 'all');
      for (const def of settingDefs) if (!tab || def.tab === tab) values[def.id] = def.default;
      changes.forEach((fn) => fn());
    },
    onChange: (fn) => changes.push(fn),
  };
  const menu = createSettingsMenu(settings);
  menu.open();
  const root = document.body.children.at(-1);
  return { ...dom, menu, root, settings, resets,
    pad: (code) => menu.padNav(padInput(code)),
  };
}

test('a modal isolates background menus, traps Tab in both directions, and restores focus/inert on close', () => {
  const { document, key } = menuDom();
  const background = document.createElement('div');
  const quit = document.createElement('button');
  background.append(quit);
  const alreadyInert = document.createElement('div');
  alreadyInert.inert = true;
  const root = document.createElement('div');
  root.className = 'hidden';
  const first = document.createElement('button');
  const last = document.createElement('input');
  root.append(first, last);
  document.body.append(background, alreadyInert, root);
  quit.focus();
  const modal = createModal(root, () => modal.close());
  modal.open();
  modal.open(); // idempotent: don't replace the saved background state
  assert.equal(background.inert, true);
  assert.equal(document.activeElement, first);
  quit.focus();
  assert.equal(document.activeElement, first, 'background quit cannot take focus');
  key('Tab', true);
  assert.equal(document.activeElement, last);
  key('Tab');
  assert.equal(document.activeElement, first);
  assert.equal(key('Escape').defaultPrevented, true);
  assert.equal(background.inert, false);
  assert.equal(alreadyInert.inert, true);
  assert.equal(document.activeElement, quit);
});

test('controller preset navigation wraps; custom values choose an endpoint; only one preset is highlighted', () => {
  const t = settingsMenu();
  try {
    const presets = settingPresets.Graphics;
    t.settings.set('renderScale', presets.at(-1).values.renderScale);
    t.pad('PadRight');
    assert.equal(t.settings.get('renderScale'), presets[0].values.renderScale);
    t.pad('PadRight');
    assert.equal(t.settings.get('renderScale'), presets[1].values.renderScale);
    t.pad('PadRight');
    assert.equal(t.settings.get('renderScale'), presets[2].values.renderScale);
    assert.equal(t.root.querySelectorAll('.settings-preset').filter((node) => node.classList.contains('active')).length, 1);
    t.settings.set('renderScale', 1.3);
    t.pad('PadLeft');
    assert.equal(t.settings.get('renderScale'), presets.at(-1).values.renderScale);
    t.settings.set('renderScale', 1.3);
    t.pad('PadRight');
    assert.equal(t.settings.get('renderScale'), presets[0].values.renderScale);
  } finally { t.menu.close(); }
});

test('controller reaches Reset tab, Reset everything (twice), and Back; closing cancels reset confirmation', () => {
  const t = settingsMenu();
  const rowCount = t.root.querySelectorAll('.settings-row').length;
  for (let i = 0; i < rowCount; i++) t.pad('PadDown');
  assert.equal(t.root.querySelector('.focused').textContent, 'Reset this tab');
  t.pad('PadA');
  assert.deepEqual(t.resets, ['Graphics']);
  t.pad('PadDown');
  t.pad('PadA');
  assert.deepEqual(t.resets, ['Graphics'], 'first press only asks');
  t.menu.close();
  t.menu.open();
  t.pad('PadA');
  assert.deepEqual(t.resets, ['Graphics'], 'old confirmation was cancelled');
  t.pad('PadA');
  assert.deepEqual(t.resets, ['Graphics', 'all']);
  t.pad('PadDown');
  assert.equal(t.root.querySelector('.focused').textContent, 'Back');
  t.pad('PadA');
  assert.equal(t.menu.isOpen, false);
});

test('equal-valued presets still advance on controller and never highlight two buttons', () => {
  const medium = settingPresets.Graphics.find((p) => p.label === 'Medium').values;
  const saved = { ...medium };
  Object.assign(medium, settingPresets.Graphics.find((p) => p.label === 'High').values); // (every value equal, not just the resolution)
  const t = settingsMenu();
  try {
    t.pad('PadRight'); // Medium -> High (equal value, distinct selection)
    const active = t.root.querySelectorAll('.settings-preset').filter((node) => node.classList.contains('active'));
    assert.deepEqual(active.map((node) => node.textContent), ['High']);
    t.pad('PadRight'); // High -> Potato (wraps); the old findIndex implementation got stuck at High
    assert.equal(t.settings.get('renderScale'), settingPresets.Graphics[0].values.renderScale);
  } finally {
    t.menu.close();
    Object.assign(medium, saved);
  }
});

test('Graphics reports native percentage and both pixel sizes, while preserving saved pixel-ratio semantics', () => {
  const t = settingsMenu();
  try {
    t.window.devicePixelRatio = 1.25;
    t.settings.set('renderScale', 1);
    const def = settingDefs.find((entry) => entry.id === 'renderScale');
    assert.equal(def.format(1), '80% native', 'old 100% undersampled a 125%-scaled display');
    assert.match(t.root.querySelector('.settings-resolution').textContent, /3D: 1280 × 720 · Display: 1600 × 900/);
    t.settings.set('renderScale', 1.25);
    assert.equal(def.format(1.25), '100% native');
    assert.match(t.root.querySelector('.settings-resolution').textContent, /3D: 1600 × 900 · Display: 1600 × 900/);
    let ratio;
    def.apply(1.25, { renderer: { setPixelRatio: (value) => { ratio = value; } } });
    assert.equal(ratio, 1.25, 'existing stored values keep their original resolution');
  } finally { t.menu.close(); }
});

test('Play opens the mode chooser: Directed is listed and focused first, then the remembered mode; Back leaves the run unselected', () => {
  const { document, key } = menuDom();
  const screens = createScreens();
  const choices = [];
  const button = (action) => document.querySelector('[data-action="' + action + '"]');
  const pad = (code) => screens.padNav(padInput(code));
  screens.on('startRun', (choice) => { choices.push(choice); screens.show(null); });
  screens.show('title');

  button('play').click();
  assert.equal(screens.current, 'runMode');
  assert.equal(screens.showsFlyover, true);
  const listed = button('directed').parentElement.querySelectorAll('[data-action]').map((node) => node.dataset.action);
  assert.deepEqual(listed, [...closingTime.modes.list.map(({ id }) => id), 'modeBack']);
  assert.deepEqual(listed, ['directed', 'classic', 'modeBack'], 'Directed is listed first');
  assert.equal(closingTime.modes.default, 'directed');
  assert.equal(document.activeElement, button('directed'), 'and focused first');
  assert.ok(button('directed').classList.contains('primary') && !button('classic').classList.contains('primary'));
  assert.equal(key('Escape').defaultPrevented, true);
  assert.equal(screens.current, 'title');
  assert.equal(document.activeElement, button('play'));

  pad('PadStart');
  pad('PadDown');
  assert.equal(document.activeElement, button('classic'));
  pad('PadB');
  assert.equal(screens.current, 'title');
  button('play').click();
  button('modeBack').click();
  assert.equal(screens.current, 'title');
  assert.deepEqual(choices, []);

  pad('PadStart');
  assert.equal(document.activeElement, button('directed'));
  pad('PadA');
  assert.deepEqual(choices, [{ mode: 'directed', pad: true }]);

  // The mode chosen last time is the one focused (and drawn as the primary button). An unknown id is ignored.
  screens.setRunMode('classic');
  screens.setRunMode('speedrun');
  screens.show('title');
  button('play').click();
  assert.equal(document.activeElement, button('classic'));
  assert.ok(button('classic').classList.contains('primary') && !button('directed').classList.contains('primary'));
  pad('PadA');
  assert.deepEqual(choices.at(-1), { mode: 'classic', pad: true });

  screens.show('title');
  button('play').click();
  button('directed').click();
  assert.deepEqual(choices.at(-1), { mode: 'directed', pad: false });
});

// A browser's localStorage for game/settings.js, and a settings context whose every part accepts anything.
function withStorage(t) {
  const stored = new Map();
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)) },
  });
  t.after(() => (before ? Object.defineProperty(globalThis, 'localStorage', before) : delete globalThis.localStorage));
  const anything = new Proxy(function () {}, { get: () => anything, apply: () => anything, set: () => true });
  return { stored, ctx: anything };
}

test('the run mode is remembered between sessions through the settings store; no tab, no preset, and Reset everything keeps it', (t) => {
  menuDom();
  const { ctx } = withStorage(t);
  const def = settingDefs.find(({ id }) => id === 'closingMode');
  assert.equal(def.tab, null, 'not shown on any tab of the Settings menu');
  assert.ok(!settingsTabs.includes(def.tab));
  assert.equal(def.default, 'directed');
  assert.deepEqual(def.options.map(({ value }) => value), ['directed', 'classic']);
  for (const presets of Object.values(settingPresets)) {
    for (const preset of presets) assert.ok(!('closingMode' in preset.values), preset.label + ' does not set the run mode');
  }

  const first = createSettings(ctx);
  assert.equal(first.get('closingMode'), 'directed');
  first.set('closingMode', 'classic');
  assert.equal(createSettings(ctx).get('closingMode'), 'classic', 'a new session reads it back');

  const next = createSettings(ctx);
  next.set('fov', 100);
  next.reset('Graphics');
  next.reset();
  assert.equal(next.get('fov'), settingDefs.find(({ id }) => id === 'fov').default);
  assert.equal(next.get('closingMode'), 'classic', 'Reset everything is about the menu\u2019s settings');
  next.set('closingMode', 'nonsense');
  assert.equal(next.get('closingMode'), 'directed', 'an unknown value falls back to the default');
});

test('starting from the chooser stores the mode and plays once: no reset, no Fresh shift screen, and the chooser stays until play starts', (t) => {
  const { document } = menuDom();
  const { ctx } = withStorage(t);
  const { g } = headlessGame();
  t.after(() => g.map.dispose());
  const settings = createSettings(ctx);
  const screens = createScreens();
  const button = (action) => document.querySelector('[data-action="' + action + '"]');
  const hidden = (name) => document.querySelector('.' + name).classList.contains('hidden');
  let resets = 0;
  g.events.on('runReset', () => resets++);
  const plays = [];
  let lockGranted = false; // the stand-in for main.js's play(): the pad plays at once, the mouse waits for its lock
  const play = (how) => { plays.push(how); if (how.pad || lockGranted) screens.show(null); };
  const runStart = createRunStart({ game: g.state, screens, settings, play });

  // main.js goToTitle: one reset, then the title.
  g.resetRun();
  screens.show('title');
  assert.equal(resets, 1);
  assert.equal(runStart.acceptsLock(), false, 'nothing on the title asked for the mouse');

  button('play').click();
  assert.equal(runStart.acceptsLock(), false, 'nor did opening the chooser');
  button('classic').click(); // the browser refuses the mouse lock
  assert.equal(g.state.closingMode, 'classic');
  assert.equal(settings.get('closingMode'), 'classic');
  assert.deepEqual(plays, [{ pad: false }]);
  assert.equal(resets, 1, 'reset once, not twice');
  assert.equal(screens.current, 'runMode', 'still on the chooser');
  assert.ok(hidden('pause-screen'), 'no Fresh shift pause screen');
  assert.equal(screens.startRequested, true);
  assert.equal(runStart.acceptsLock(), true, 'the lock this click asked for starts play when it comes');

  // Changing one's mind while waiting: the other mode, asked again.
  button('directed').click();
  assert.equal(g.state.closingMode, 'directed');
  assert.deepEqual(plays, [{ pad: false }, { pad: false }]);
  assert.equal(screens.current, 'runMode');
  assert.equal(resets, 1);

  // Back: a lock that arrives late is given back, also after returning to the chooser without choosing.
  button('modeBack').click();
  assert.equal(screens.current, 'title');
  assert.equal(runStart.acceptsLock(), false);
  button('play').click();
  assert.equal(screens.startRequested, false);
  assert.equal(runStart.acceptsLock(), false);
  assert.equal(document.activeElement, button('directed'), 'the mode chosen last is focused');

  // The lock is granted this time: play starts, straight from the chooser.
  lockGranted = true;
  button('classic').click();
  assert.equal(screens.current, null);
  assert.equal(g.state.closingMode, 'classic');
  assert.equal(resets, 1);
  assert.equal(runStart.acceptsLock(), true, 'in play (a resume after Esc) the lock is the game\u2019s');

  // A controller starts at once.
  lockGranted = false;
  screens.show('title');
  screens.padNav(padInput('PadStart'));
  assert.equal(document.activeElement, button('classic'));
  screens.padNav(padInput('PadA'));
  assert.deepEqual(plays.at(-1), { pad: true });
  assert.equal(screens.current, null);

  // The next session: the remembered mode is focused on a new chooser.
  menuDom();
  const later = createScreens();
  createRunStart({ game: {}, screens: later, settings: createSettings(ctx), play() {} });
  later.show('title');
  globalThis.document.querySelector('[data-action="play"]').click();
  assert.equal(globalThis.document.activeElement, globalThis.document.querySelector('[data-action="classic"]'));
});
