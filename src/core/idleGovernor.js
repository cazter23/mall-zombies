// =============================================================================
// IDLE GOVERNOR: the decision half of the idle saver (core/idleSaver.js does the browser half). Pure: no timers, no DOM.
// It is told what happened ("an input", "the window lost focus") and the time, and says which stage the game should be in:
//   'awake' | 'dim' | 'asleep'    (thresholds: config/idle.js, read live so the settings menu takes effect at once)
//
//   const idleGovernor = createIdleGovernor({ config, eligible: () => bool, onChange: (stage, previous) => {} })
//   touch(now)             an input happened (ignored while the window is not focused: hovering over it is not playing it)
//   setFocused(bool, now)  the window / tab gained or lost focus; either counts as activity at that moment
//   update(now)            call regularly; returns the stage and calls onChange when it changes
// While `eligible()` is false (a run is live, a benchmark is running...) it is always awake and the clock keeps restarting,
// so the countdown begins the moment the game stops running.
// =============================================================================

export function createIdleGovernor({ config, eligible = () => true, onChange = null }) {
  let stage = 'awake';
  let lastActivity = 0;
  let focused = true;

  const delays = () => config.delays[config.delay] ?? config.delays.normal;

  return {
    get stage() { return stage; },
    get focused() { return focused; },
    /** Seconds since the last activity. */
    idleSeconds(now) { return now - lastActivity; },

    touch(now) {
      if (focused) lastActivity = now;
    },

    setFocused(value, now) {
      if (value === focused) return;
      focused = value;
      lastActivity = now;
    },

    update(now) {
      let next = 'awake';
      if (config.enabled && eligible()) {
        const idleFor = now - lastActivity;
        const { dim, sleep } = delays();
        next = idleFor >= sleep ? 'asleep' : idleFor >= dim ? 'dim' : 'awake';
      } else {
        lastActivity = now;
      }
      if (next !== stage) {
        const previous = stage;
        stage = next;
        onChange?.(next, previous);
      }
      return stage;
    },
  };
}
