import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';
import { createModal } from '../src/ui/modal.js';

menuDom(); // config/settings reads the display density once when imported
const { createSettingsMenu } = await import('../src/ui/settingsMenu.js');
const { settingDefs, settingPresets } = await import('../src/config/settings.js');

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
    pad: (code) => menu.padNav({ consumePress: (key) => key === code }),
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
    const presets = settingPresets.Video;
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
  assert.deepEqual(t.resets, ['Video']);
  t.pad('PadDown');
  t.pad('PadA');
  assert.deepEqual(t.resets, ['Video'], 'first press only asks');
  t.menu.close();
  t.menu.open();
  t.pad('PadA');
  assert.deepEqual(t.resets, ['Video'], 'old confirmation was cancelled');
  t.pad('PadA');
  assert.deepEqual(t.resets, ['Video', 'all']);
  t.pad('PadDown');
  assert.equal(t.root.querySelector('.focused').textContent, 'Back');
  t.pad('PadA');
  assert.equal(t.menu.isOpen, false);
});

test('equal-valued presets still advance on controller and never highlight two buttons', () => {
  const medium = settingPresets.Video[1].values;
  const saved = medium.renderScale;
  medium.renderScale = settingPresets.Video[2].values.renderScale;
  const t = settingsMenu();
  try {
    t.pad('PadRight'); // Medium -> High (equal value, distinct selection)
    const active = t.root.querySelectorAll('.settings-preset').filter((node) => node.classList.contains('active'));
    assert.deepEqual(active.map((node) => node.textContent), ['High']);
    t.pad('PadRight'); // High -> Low; the old findIndex implementation got stuck at High
    assert.equal(t.settings.get('renderScale'), settingPresets.Video[0].values.renderScale);
  } finally {
    t.menu.close();
    medium.renderScale = saved;
  }
});

test('Video reports native percentage and both pixel sizes, while preserving saved pixel-ratio semantics', () => {
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
