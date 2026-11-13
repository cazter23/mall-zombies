// =============================================================================
// MENU FOCUS: the controller cursor of a DOM menu, the same on every screen (with core/menuNav.js, which reads the pad).
//   const focus = createFocusList({ items: () => [...buttons], onFocus })
//   focus.move(dx, dy)   to the nearest item that way on screen (core/menuNav.js spatialStep), then shown
//   focus.show()         the cursor: class 'focused', real DOM focus (no page jump) and scrolled into view; onFocus(element)
//   focus.hide()         no cursor drawn (the mouse is in charge); focus.index / focus.current / focus.set(i)
//   menuNav              the one navigator every DOM menu reads (only one menu reads per tick: main.js routes the pad)
//   scrollPage(node, px) scrolls a long page by the navigator's `scroll` (the right stick or a held trigger)
// =============================================================================

import { createMenuNav, spatialStep } from '../core/menuNav.js';
import { feel } from '../config/feel.js';

export const menuNav = createMenuNav();
export const TICK = 1 / feel.simulation.tickRate; // padNav runs on the fixed tick

const rectOf = (node) => node.getBoundingClientRect?.() ?? null;

export function createFocusList({ items, onFocus = null, focusClass = 'focused' }) {
  let index = 0;
  let shown = false;
  const list = () => items().filter(Boolean);
  const clamp = (all) => Math.max(0, Math.min(index, all.length - 1));

  function mark(all) {
    all.forEach((node, i) => node.classList.toggle(focusClass, shown && i === index));
  }

  const api = {
    get index() { return index; },
    get current() { const all = list(); return all[clamp(all)] ?? null; },
    get shown() { return shown; },
    set(i, { show = shown, scroll = true } = {}) {
      index = Math.max(0, i);
      shown = show;
      if (shown) api.show({ scroll });
      else mark(list());
    },
    move(dx, dy) {
      const all = list();
      if (!all.length) return;
      index = spatialStep(all.map(rectOf), clamp(all), dx, dy);
      api.show();
    },
    show({ scroll = true } = {}) {
      const all = list();
      if (!all.length) return;
      index = clamp(all);
      shown = true;
      mark(all);
      const node = all[index];
      node.focus?.({ preventScroll: true });
      if (scroll) node.scrollIntoView?.({ block: 'nearest' });
      onFocus?.(node);
    },
    hide() {
      shown = false;
      mark(list());
    },
  };
  return api;
}

// The three "book" screens (ui/locker.js, ui/guide.js, ui/challengeBoard.js) share this padNav: they keep their own
// focus (a mouse or the arrow keys move it too), so they hand over how to read and set it.
//   list()     their buttons, in order          at()        the focused one's index
//   focusAt(i) focus that one (and show it)     back()      B
//   tab(dir)   LB / RB (optional)               scrollHost  what the right stick / triggers scroll
export function padBook(input, { list, at, focusAt, back, tab = null, scrollHost = null }) {
  const nav = menuNav.read(input, TICK);
  if (nav.back) return back();
  const all = list();
  if ((nav.x || nav.y) && all.length) focusAt(spatialStep(all.map(rectOf), at(), nav.x, nav.y));
  if (nav.tab && tab) tab(nav.tab);
  scrollPage(scrollHost, nav.scroll);
  if (nav.confirm) list()[at()]?.click();
}

export function scrollPage(node, pixels) {
  if (!pixels || !node) return;
  if (typeof node.scrollBy === 'function') node.scrollBy({ top: pixels, behavior: 'instant' });
  else node.scrollTop = (node.scrollTop ?? 0) + pixels;
}
