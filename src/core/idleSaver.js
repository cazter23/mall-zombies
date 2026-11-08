// =============================================================================
// IDLE SAVER: the browser half of the idle mode (the decisions are core/idleGovernor.js; the numbers are config/idle.js).
// Browser side only (main.js builds one); `win`, `doc`, the clock and the timers can be replaced so a test can drive it.
//
//   dim     loop.setMaxFps(config.dimFps)
//   asleep  loop.pause() and, if config.muteWhenAsleep, sound.setSleeping(true)
//   awake   the cap lifted, the loop and the audio resumed
// What counts as activity: keys, clicks, mouse / pen / touch movement and the wheel over the focused window, and controller
// buttons or sticks (a controller makes no browser events, so a timer looks at navigator.getGamepads every pollSeconds).
// A hidden tab or an unfocused window counts as nobody being there. The browser already stops a hidden tab's frames
// itself; this covers the tab that is visible but not the one you are using (the case that costs power).
//
//   const idleSaver = createIdleSaver({ loop, sound, eligible: () => !game.running })
//   idleSaver.stage, idleSaver.tick(), idleSaver.dispose()
// =============================================================================

import { idle } from '../config/idle.js';
import { createIdleGovernor } from './idleGovernor.js';

const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel'];

export function createIdleSaver({
  loop,
  sound = null,
  eligible = () => true,
  config = idle,
  win = window,
  doc = document,
  now = () => performance.now() / 1000,
  getPads = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []),
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = (id) => clearInterval(id),
} = {}) {
  const governor = createIdleGovernor({ config, eligible, onChange: apply });

  function apply(stage, previous) {
    loop.setMaxFps(stage === 'dim' ? config.dimFps : null);
    if (stage === 'asleep') {
      loop.pause();
      if (config.muteWhenAsleep) sound?.setSleeping?.(true);
    } else if (previous === 'asleep') {
      loop.resume();
      sound?.setSleeping?.(false);
    }
  }

  // Is any controller button down or stick pushed?
  function padActive() {
    for (const pad of getPads() ?? []) {
      if (!pad?.connected) continue;
      if (pad.buttons.some((b) => b.pressed)) return true;
      if (pad.axes.some((a) => Math.abs(a) >= config.padThreshold)) return true;
    }
    return false;
  }

  function poke() {
    const t = now();
    governor.touch(t);
    if (governor.stage !== 'awake') governor.update(t); // asleep or dim: wake now, not at the next timer
  }

  function setFocus(value) {
    const t = now();
    governor.setFocused(value, t);
    governor.update(t);
  }
  const hasFocus = () => doc.visibilityState !== 'hidden' && (doc.hasFocus ? doc.hasFocus() : true);

  const onFocus = () => setFocus(hasFocus());
  const onBlur = () => setFocus(false);
  for (const type of ACTIVITY_EVENTS) win.addEventListener(type, poke, { passive: true });
  win.addEventListener('focus', onFocus);
  win.addEventListener('blur', onBlur);
  doc.addEventListener('visibilitychange', onFocus);
  governor.setFocused(hasFocus(), now());

  function tick() {
    const t = now();
    if (padActive()) governor.touch(t);
    governor.update(t);
  }
  const timer = setTimer(tick, config.pollSeconds * 1000);

  return {
    governor,
    get stage() { return governor.stage; },
    tick,
    dispose() {
      clearTimer(timer);
      for (const type of ACTIVITY_EVENTS) win.removeEventListener(type, poke);
      win.removeEventListener('focus', onFocus);
      win.removeEventListener('blur', onBlur);
      doc.removeEventListener('visibilitychange', onFocus);
      if (governor.stage === 'asleep') {
        loop.setMaxFps(null);
        loop.resume();
        sound?.setSleeping?.(false);
      }
    },
  };
}
