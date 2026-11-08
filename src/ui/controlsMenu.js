// =============================================================================
// CONTROLS MENU
// Lists every control for the keyboard + mouse and for a controller (tabs).
// The text comes from `controlsHelp` in config/controls.js. Debug-key hints
// show at the bottom only while the matching debug flags are on.
// =============================================================================

import { controlsHelp } from '../config/controls.js';
import { debug, keyLabel } from '../config/debug.js';
import { buildControlsDiagram } from './controlsDiagram.js';
import { createModal } from './modal.js';

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
  view.tabIndex = 0;
  view.setAttribute('aria-label', 'Control bindings');
  const footer = el('div', 'settings-footer');
  const backButton = el('button', 'play', 'Back');
  footer.append(el('span'), backButton);
  card.append(el('div', 'form-number', 'EMPLOYEE HANDBOOK · EQUIPMENT OPERATION'), el('h2', 'settings-title', 'Controls'), tabBar, viewBar, view);

  // Debug hints (only for the debug features that are switched on).
  // The debug keys are a table (config/debug.js) listed in the debug window (ui/debugPanel.js): just point at it.
  if (debug.enabled) {
    const hint = `${keyLabel('Backquote')} shows the debug window listing every debug key`;
    card.append(el('p', 'controls-debug', `Debug: ${hint}`));
  }
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
    // SVG text scales with the entire drawing. Fall back to the list when its
    // labels would become fine print, including when text size is increased.
    const minimum = typeof getComputedStyle === 'function' ? 900 * parseFloat(getComputedStyle(view).fontSize) / 16 : 900;
    const useList = mode === 'list' || (view.clientWidth > 0 && view.clientWidth < minimum);
    if (!useList) {
      view.append(buildControlsDiagram(tab, controlsHelp[tab]));
      return;
    }
    if (mode === 'diagram') view.append(el('p', 'controls-auto-note', 'List view keeps the controls readable at this size.'));
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
    modal.close();
  }
  const modal = createModal(root, close);
  root.setAttribute('aria-label', 'Controls');
  backButton.addEventListener('click', close);
  render();
  let layoutKey = '';
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    const key = `${view.clientWidth}|${getComputedStyle(view).fontSize}`;
    if (layoutKey !== key) { layoutKey = key; render(); }
  }) : null;
  resize?.observe(view);

  return {
    get isOpen() { return !root.classList.contains('hidden'); },
    open() { modal.open(); render(); },
    close,
    // Controller: B / Start close, bumpers switch tab.
    padNav(input) {
      if (input.consumePress('PadB') || input.consumePress('PadStart')) return close();
      if (input.consumePress('PadY')) { mode = mode === 'diagram' ? 'list' : 'diagram'; render(); }
      if (input.consumePress('PadRB') || input.consumePress('PadLB')) showTab(tab === 'keyboard' ? 'gamepad' : 'keyboard');
      const step = (input.consumePress('PadDown') ? 1 : 0) - (input.consumePress('PadUp') ? 1 : 0);
      if (step) view.scrollBy({ top: step * view.clientHeight * .6, behavior: 'instant' });
    },
  };
}
