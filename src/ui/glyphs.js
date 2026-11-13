// =============================================================================
// GLYPHS: which buttons the prompts name, for the device used last (keyboard + mouse, an Xbox-style pad, a PlayStation pad).
//   promptDevice(input, gamepad)   'keyboard' | 'xbox' | 'playstation' (input.device, and the pad's type from core/gamepad.js)
//   buttonLabel(action, device)    the button's name in prompts (config/controls.js buttonLabels), or undefined
//   hintHtml(id, device)           a menu's hint line (config/controls.js menuHints) as HTML, button names in <kbd>
//   glyphHtml(action, device)      one keycap in running text (How to play): <kbd data-glyph="action">F</kbd>
//   setPromptDevice(device, doc)   main.js calls it every frame: when the device changes, <body data-input="...">, every
//                                  [data-hint] line and every [data-glyph] keycap on the page are rewritten (menus built
//                                  later read currentDevice())
// DOM-free apart from setPromptDevice (tests/controllerMenus.test.js).
// =============================================================================

import { buttonLabels, menuHints } from '../config/controls.js';

let current = 'keyboard';

export const currentDevice = () => current;

export function promptDevice(input, gamepad) {
  if (input?.device !== 'gamepad') return 'keyboard';
  return buttonLabels[gamepad?.type] ? gamepad.type : 'xbox';
}

export function buttonLabel(action, device = current) {
  return buttonLabels[device]?.[action];
}

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The hint line's pieces: { prefix, parts: [[button, what it does]] }, or { text } for a keyboard line of its own. */
export function hintParts(id, device = current) {
  const spec = menuHints[id];
  if (!spec) return { text: '' };
  if (device === 'keyboard' && spec.keyboard) return { text: spec.keyboard };
  const labels = device === 'keyboard' ? 'xbox' : device; // (no line of its own: advertise the controller, Xbox names)
  const parts = spec.pad.map(([key, does]) => [buttonLabel(key, labels), does]).filter(([button]) => button);
  return { prefix: device === 'keyboard' ? 'Controller: ' : '', parts };
}

export function hintHtml(id, device = current) {
  const { text, prefix = '', parts } = hintParts(id, device);
  if (text !== undefined) return escape(text);
  return escape(prefix) + parts.map(([button, does]) => `<kbd>${escape(button)}</kbd> ${escape(does)}`).join(' · ');
}

export function glyphHtml(action, device = current) {
  return `<kbd data-glyph="${action}">${escape(buttonLabel(action, device) ?? '')}</kbd>`;
}

export function setPromptDevice(device, doc = globalThis.document) {
  if (device === current) return false;
  current = device;
  if (doc?.body) {
    doc.body.dataset.input = device;
    for (const node of doc.querySelectorAll('[data-hint]')) node.innerHTML = hintHtml(node.dataset.hint, device);
    for (const node of doc.querySelectorAll('[data-glyph]')) node.textContent = buttonLabel(node.dataset.glyph, device) ?? '';
  }
  return true;
}
