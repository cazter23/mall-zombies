// =============================================================================
// SETTINGS MENU
// Builds the options screen from the list in config/settings.js (tabs on top,
// one row per setting). Works with the mouse, the keyboard (Esc closes) and a
// controller (padNav: D-pad, A, B, LB/RB for tabs).
// =============================================================================

import { settingsTabs, settingPresets } from '../config/settings.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createSettingsMenu(settings) {
  const root = el('div', 'settings hidden');
  const card = el('div', 'settings-card');
  const title = el('h2', 'settings-title', 'Settings');
  const tabBar = el('div', 'settings-tabs');
  const list = el('div', 'settings-list');
  const footer = el('div', 'settings-footer');
  const resetButton = el('button', 'settings-reset', 'Reset this tab');
  const resetAllButton = el('button', 'settings-reset', 'Reset everything');
  const backButton = el('button', 'play', 'Back');
  const hint = el('p', 'pad-hint settings-hint', 'Controller: D-pad to move and change · A to toggle · LB/RB tabs · B back');
  const resets = el('div', 'settings-resets');
  resets.append(resetButton, resetAllButton);
  footer.append(resets, backButton);
  card.append(title, tabBar, list, footer, hint);
  root.append(card);
  document.body.append(root);

  let tab = settingsTabs[0];
  let focus = 0; // controller cursor: index into the current tab's rows
  let rows = []; // { def, node, refresh() }
  let closeHandler = null;

  const tabButtons = new Map();
  for (const name of settingsTabs) {
    const button = el('button', 'settings-tab', name);
    button.addEventListener('click', () => showTab(name));
    tabBar.append(button);
    tabButtons.set(name, button);
  }

  // --- One row per setting, with the control for its type ---
  function buildRow(def) {
    const node = el('div', 'settings-row');
    const label = el('span', 'settings-label', def.label);
    const control = el('div', 'settings-control');
    node.append(label, control);
    const show = (v) => (def.format ? def.format(v) : String(v));
    let refresh;

    if (def.type === 'toggle') {
      const box = el('input');
      box.type = 'checkbox';
      box.addEventListener('change', () => settings.set(def.id, box.checked));
      control.append(box);
      refresh = () => { box.checked = settings.get(def.id); };
    } else if (def.type === 'slider') {
      const slider = el('input');
      slider.type = 'range';
      slider.min = def.min;
      slider.max = def.max;
      slider.step = def.step;
      const readout = el('span', 'settings-value');
      slider.addEventListener('input', () => settings.set(def.id, Number(slider.value)));
      control.append(slider, readout);
      refresh = () => {
        slider.value = settings.get(def.id);
        readout.textContent = show(settings.get(def.id));
      };
    } else {
      const select = el('select');
      for (const option of def.options) {
        const o = el('option', null, option.label);
        o.value = String(option.value);
        select.append(o);
      }
      select.addEventListener('change', () => {
        const picked = def.options.find((o) => String(o.value) === select.value);
        if (picked) settings.set(def.id, picked.value);
      });
      control.append(select);
      refresh = () => { select.value = String(settings.get(def.id)); };
    }
    refresh();
    return { def, node, refresh };
  }

  // A tab's presets (config/settings.js settingPresets): one row of buttons that set several settings at once.
  // Controller: Left/Right on this row applies the previous/next preset.
  function buildPresetRow(presets) {
    const node = el('div', 'settings-row settings-presets');
    node.append(el('span', 'settings-label', 'Quick preset'));
    const control = el('div', 'settings-control');
    const buttons = presets.map((preset) => {
      const button = el('button', 'settings-preset', preset.label);
      button.type = 'button';
      button.addEventListener('click', () => apply(preset));
      control.append(button);
      return button;
    });
    node.append(control);
    const matches = (preset) => Object.entries(preset.values).every(([id, v]) => settings.get(id) === v);
    function apply(preset) {
      for (const [id, value] of Object.entries(preset.values)) settings.set(id, value);
    }
    const refresh = () => presets.forEach((preset, i) => buttons[i].classList.toggle('active', matches(preset)));
    const step = (dir) => {
      const now = presets.findIndex(matches);
      apply(presets[(now + dir + presets.length) % presets.length]);
    };
    refresh();
    return { def: { type: 'preset' }, node, refresh, step };
  }

  function markFocus(show = true) {
    rows.forEach((r, i) => r.node.classList.toggle('focused', show && i === focus));
  }

  function showTab(name) {
    tab = name;
    focus = 0;
    for (const [n, button] of tabButtons) button.classList.toggle('active', n === name);
    list.replaceChildren();
    rows = settings.defs.filter((d) => d.tab === name).map(buildRow);
    if (settingPresets[name]) rows.unshift(buildPresetRow(settingPresets[name]));
    for (const r of rows) list.append(r.node);
    markFocus(false);
  }

  const refreshAll = () => rows.forEach((r) => r.refresh());
  settings.onChange(refreshAll);
  resetButton.addEventListener('click', () => settings.reset(tab));
  // Everything at once asks twice (it undoes every tab).
  let resetAllTimer = null;
  resetAllButton.addEventListener('click', () => {
    if (!resetAllTimer) {
      resetAllButton.textContent = 'Sure? Click again';
      resetAllTimer = setTimeout(() => {
        resetAllButton.textContent = 'Reset everything';
        resetAllTimer = null;
      }, 3000);
      return;
    }
    clearTimeout(resetAllTimer);
    resetAllTimer = null;
    resetAllButton.textContent = 'Reset everything';
    settings.reset();
  });

  function close() {
    root.classList.add('hidden');
    if (closeHandler) closeHandler();
  }
  backButton.addEventListener('click', close);
  window.addEventListener('keydown', (event) => {
    if (!root.classList.contains('hidden') && event.code === 'Escape') close();
  });
  showTab(tab);

  return {
    get isOpen() { return !root.classList.contains('hidden'); },
    onClose(fn) { closeHandler = fn; },
    open() {
      root.classList.remove('hidden');
      refreshAll();
    },
    close,

    // Controller navigation. Called each tick while the menu is open.
    padNav(input) {
      const tabIndex = settingsTabs.indexOf(tab);
      if (input.consumePress('PadB') || input.consumePress('PadStart')) return close();
      if (input.consumePress('PadRB')) showTab(settingsTabs[(tabIndex + 1) % settingsTabs.length]);
      if (input.consumePress('PadLB')) showTab(settingsTabs[(tabIndex - 1 + settingsTabs.length) % settingsTabs.length]);
      if (!rows.length) return;
      const step = (input.consumePress('PadDown') ? 1 : 0) - (input.consumePress('PadUp') ? 1 : 0);
      if (step) {
        focus = (focus + step + rows.length) % rows.length;
        rows[focus].node.scrollIntoView({ block: 'nearest' });
      }
      markFocus();
      const def = rows[focus].def;
      const dir = (input.consumePress('PadRight') ? 1 : 0) - (input.consumePress('PadLeft') ? 1 : 0);
      const press = input.consumePress('PadA');
      if (def.type === 'preset') {
        if (dir || press) rows[focus].step(dir || 1);
      } else if (def.type === 'toggle' && (press || dir)) settings.set(def.id, !settings.get(def.id));
      else if (def.type === 'slider' && dir) {
        settings.set(def.id, settings.get(def.id) + dir * Math.max(def.step, (def.max - def.min) / 20));
      } else if (def.type === 'select' && dir) {
        const i = def.options.findIndex((o) => o.value === settings.get(def.id));
        settings.set(def.id, def.options[(i + dir + def.options.length) % def.options.length].value);
      }
    },
  };
}
