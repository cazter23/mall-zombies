// =============================================================================
// MENU NAVIGATION: one controller model for every menu (DOM-free, so it runs headless in tests).
//   D-pad or left stick moves: one step per push, and held it repeats after a moment (config/controls.js menuNav).
//   A confirms, B backs, LB / RB switch tabs, the right stick or a held trigger scrolls a long page, Y / X / Start are a
//   screen's shortcuts. Every read is an ACTION (config/controls.js bindings):
//     UI_ACTIONS        the menus around a run (ui/: title, pause, results, Settings, Controls, locker, Survival Guide...).
//                       Controller-only actions: on a keyboard those screens are plain web pages.
//     GAME_MENU_ACTIONS the in-run menus (game/features: the order form, the fitting room), which keys drive too.
//
//   const nav = createMenuNav({ actions })
//   nav.read(input, dt) -> { x, y, confirm, back, tab, option, option2, start, scroll }   call ONCE per tick: it consumes
//       x / y: -1, 0 or 1 this tick (x +1 = right, y +1 = DOWN the screen); tab: -1 / 0 / 1 (LB / RB);
//       scroll: pixels to scroll this tick (+ = down); the rest true on the tick of the press.
//   nav.prime(input)   counts a stick or button already held as used up (a menu opened with the stick pushed doesn't step)
//   spatialStep(rects, from, dx, dy)   the item a move lands on: the nearest one that way, else the next in order (wrapping)
// =============================================================================

import { menuNav as defaults } from '../config/controls.js';

export const UI_ACTIONS = {
  up: 'uiUp', down: 'uiDown', left: 'uiLeft', right: 'uiRight', confirm: 'uiConfirm', back: 'uiBack',
  tabPrev: 'uiTabPrev', tabNext: 'uiTabNext', scrollUp: 'uiScrollUp', scrollDown: 'uiScrollDown',
  option: 'uiOption', option2: 'uiOption2', start: 'uiStart',
};
export const GAME_MENU_ACTIONS = {
  up: 'menuUp', down: 'menuDown', left: 'menuLeft', right: 'menuRight', confirm: 'menuConfirm', back: 'menuBack',
};

const STILL = { x: 0, y: 0 };

export function createMenuNav({ actions = UI_ACTIONS, settings = defaults } = {}) {
  // Per axis: the direction stepped last (0 = nothing held), the repeat clock, the stick's latched direction, and
  // `locked`: held since before the menu opened (prime), so it never repeats until it's let go.
  const axes = { x: { last: 0, timer: 0, stick: 0, locked: false }, y: { last: 0, timer: 0, stick: 0, locked: false } };

  // Presses are consumed (every action read, no short-circuit, so none is left for the next tick).
  const consume = (input, key) => (actions[key] && input.consumeAction ? input.consumeAction(actions[key]) : false);
  const down = (input, key) => Boolean(actions[key] && input.actionDown?.(actions[key]));

  // The stick, with hysteresis: past stickOn it points; back under stickOff it's centred; in between it stays as it was.
  function latch(axis, value) {
    const dir = value > settings.stickOn ? 1 : value < -settings.stickOn ? -1 : Math.abs(value) < settings.stickOff ? 0 : axis.stick;
    axis.stick = dir;
    return dir;
  }

  function step(axis, pressed, held, stick, dt) {
    const fromStick = latch(axis, stick); // (always: the latch must follow the stick even while the D-pad is held)
    const dir = pressed || held || fromStick;
    if (!dir) {
      axis.last = 0;
      axis.locked = false;
      return 0;
    }
    if (pressed || dir !== axis.last) { // a fresh press or push (or a turn the other way): one step now, the repeat waits
      axis.last = dir;
      axis.locked = false;
      axis.timer = settings.repeatDelay;
      return dir;
    }
    if (axis.locked) return 0;
    axis.timer -= dt;
    if (axis.timer > 0) return 0;
    axis.timer += settings.repeatEvery;
    return dir;
  }

  const sticks = (input) => ({ move: input.padMove ?? STILL, look: input.padLook ?? STILL });

  return {
    read(input, dt) {
      const { move, look } = sticks(input);
      const pressedX = Number(consume(input, 'right')) - Number(consume(input, 'left'));
      const pressedY = Number(consume(input, 'down')) - Number(consume(input, 'up'));
      const heldX = Number(down(input, 'right')) - Number(down(input, 'left'));
      const heldY = Number(down(input, 'down')) - Number(down(input, 'up'));
      const tab = Number(consume(input, 'tabNext')) - Number(consume(input, 'tabPrev'));
      // The right stick's y is up-positive; the page scrolls down when it's pulled down. Triggers: held = full speed.
      const scrollRate = -look.y + Number(down(input, 'scrollDown')) - Number(down(input, 'scrollUp'));
      return {
        x: step(axes.x, pressedX, heldX, move.x, dt),
        y: step(axes.y, pressedY, heldY, -move.y, dt), // (the left stick's y is forward-positive too)
        confirm: consume(input, 'confirm'),
        back: consume(input, 'back'),
        tab,
        option: consume(input, 'option'),
        option2: consume(input, 'option2'),
        start: consume(input, 'start'),
        scroll: Math.max(-1, Math.min(1, scrollRate)) * settings.scrollPixelsPerSecond * dt,
      };
    },

    prime(input) {
      const { move } = sticks(input);
      axes.x.last = latch(axes.x, move.x) || (Number(down(input, 'right')) - Number(down(input, 'left')));
      axes.y.last = latch(axes.y, -move.y) || (Number(down(input, 'down')) - Number(down(input, 'up')));
      for (const axis of [axes.x, axes.y]) {
        axis.locked = axis.last !== 0;
        axis.timer = settings.repeatDelay;
      }
    },
  };
}

// Where a move from item `from` lands, given every item's screen box ({ left, top, width, height }, as
// getBoundingClientRect gives). The nearest item whose centre lies that way (straight ahead counts more than off to the
// side); with none that way (the end of a list, or items that have no boxes yet) the next one in order, wrapping round.
export function spatialStep(rects, from, dx, dy) {
  const n = rects.length;
  if (!n) return -1;
  if (from < 0 || from >= n) return 0;
  const centre = (r) => ({ x: (r?.left ?? 0) + (r?.width ?? 0) / 2, y: (r?.top ?? 0) + (r?.height ?? 0) / 2 });
  const here = centre(rects[from]);
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < n; i++) {
    if (i === from) continue;
    const there = centre(rects[i]);
    const ox = there.x - here.x;
    const oy = there.y - here.y;
    const along = ox * dx + oy * dy;
    if (along <= 1) continue; // (not that way: behind, or level with it)
    const across = Math.abs(ox * dy) + Math.abs(oy * dx);
    const score = along + across * 2;
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best >= 0) return best;
  return (from + (dx + dy > 0 ? 1 : -1) + n) % n;
}
