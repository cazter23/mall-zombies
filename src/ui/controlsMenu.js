// =============================================================================
// CONTROLS MENU
// Lists every control for the keyboard + mouse and for a controller (tabs).
// The text comes from `controlsHelp` in config/controls.js. Debug-key hints
// show at the bottom only while the matching debug flags are on.
// =============================================================================

import { controlsHelp } from '../config/controls.js';
import { debug } from '../config/debug.js';
import { buildControlsDiagram } from './controlsDiagram.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const TABS = [
  ['keyboard', 'Keyboard & mouse'],
  ['gamepad', 'Controller'],
];

export function createControlsMenu() {
  const root = el('div', 'settings hidden');
  const card = el('div', 'settings-card controls-card');
  const tabBar = el('div', 'settings-tabs');
  const viewBar = el('div', 'controls-view');
  const view = el('div', 'controls-body');
  const footer = el('div', 'settings-footer');
  const backButton = el('button', 'play', 'Back');
  footer.append(el('span'), backButton);
  card.append(el('h2', 'settings-title', 'Controls'), tabBar, viewBar, view);

  // Debug hints (only for the debug features that are switched on).
  const hints = [];
  if (debug.allowShutterToggle) hints.push('O opens the shutter');
  if (debug.testArena) hints.push('T teleports to the movement test range');
  if (debug.zombieKeys) hints.push('Z spawns a Shopper (Shift+Z: a Mall Walker), X clears them');
  if (debug.cheatKeys) hints.push("N next round, P +5000 points, ' points to 0");
  if (hints.length) card.append(el('p', 'controls-debug', `Debug: ${hints.join(' · ')}`));
  card.append(footer, el('p', 'pad-hint settings-hint', 'Controller: LB/RB switch device · Y diagram or list · B back'));
  root.append(card);
  document.body.append(root);

  let tab = TABS[0][0];
  let mode = 'diagram'; // 'diagram' | 'list'
  const tabButtons = new Map();
  const modeButtons = new Map();

  // Redraw the current device in the current view.
  function render() {
    for (const [key, button] of tabButtons) button.classList.toggle('active', key === tab);
    for (const [key, button] of modeButtons) button.classList.toggle('active', key === mode);
    view.replaceChildren();
    if (mode === 'diagram') {
      view.append(buildControlsDiagram(tab, controlsHelp[tab]));
      return;
    }
    const list = el('ul', 'controls-list');
    for (const { keys, text } of controlsHelp[tab]) {
      const row = el('li');
      row.append(el('kbd', null, keys), el('span', null, text));
      list.append(row);
    }
    view.append(list);
  }
  const showTab = (id) => { tab = id; render(); };

  for (const [id, name] of [['diagram', 'Diagram'], ['list', 'List']]) {
    const button = el('button', 'settings-tab', name);
    button.addEventListener('click', () => { mode = id; render(); });
    viewBar.append(button);
    modeButtons.set(id, button);
  }

  for (const [id, name] of TABS) {
    const button = el('button', 'settings-tab', name);
    button.addEventListener('click', () => showTab(id));
    tabBar.append(button);
    tabButtons.set(id, button);
  }

  function close() {
    root.classList.add('hidden');
  }
  backButton.addEventListener('click', close);
  window.addEventListener('keydown', (event) => {
    if (!root.classList.contains('hidden') && event.code === 'Escape') close();
  });
  render();

  return {
    get isOpen() { return !root.classList.contains('hidden'); },
    open() { root.classList.remove('hidden'); },
    close,
    // Controller: B / Start close, bumpers switch tab.
    padNav(input) {
      if (input.consumePress('PadB') || input.consumePress('PadStart')) return close();
      if (input.consumePress('PadY')) { mode = mode === 'diagram' ? 'list' : 'diagram'; render(); }
      if (input.consumePress('PadRB') || input.consumePress('PadLB')) showTab(tab === 'keyboard' ? 'gamepad' : 'keyboard');
    },
  };
}
