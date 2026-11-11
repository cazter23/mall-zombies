// The challenge tracker: the pinned challenges (game/challengePins.js), under the round counter, for a few seconds whenever one of them moves.
// Off unless the player turns it on (Settings › Comfort, 'challengeTracker'). A feat's lost attempt is struck through with "Failed" and a
// soft sound, then drops off until its next attempt starts. Numbers and words: config/challengeBoard.js tracker.
//   createChallengeTracker()    the view (ui/hud.js puts its element in the left stack): show(lines, { changed, failed }), clear(),
//                               setEnabled(on). Timers are its own (setTimeout), like the HUD's other toasts.
//   connectChallengeTracker({ events, tracker, pins, save, challenges, sound })   main.js: which events move which line (DOM-free logic)
import { challengeBoard } from '../config/challengeBoard.js';
import { catalogEntry, skinPinId } from '../game/challengeCatalog.js';

const cfg = challengeBoard.tracker;

export function createChallengeTracker({ setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const element = document.createElement('div');
  element.className = 'challenge-tracker';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-label', cfg.label);
  element.hidden = true;
  let enabled = false;
  let timer = null;
  const hide = () => { clearTimer(timer); timer = null; element.hidden = true; element.replaceChildren(); };

  return {
    element,
    get enabled() { return enabled; },
    get visible() { return !element.hidden; },
    setEnabled(on) { enabled = !!on; if (!enabled) hide(); },
    /** lines: [{ id, title, value, done }]; changed = the id that moved (flashed), failed = the id whose attempt was just lost. */
    show(lines, { changed = null, failed = null } = {}) {
      if (!enabled || !lines.length) return;
      element.replaceChildren(...lines.map(line => {
        const row = document.createElement('div');
        row.className = `challenge-track${line.id === changed ? ' changed' : ''}${line.id === failed ? ' failed' : ''}${line.done ? ' done' : ''}`;
        row.setAttribute('data-challenge', line.id);
        const title = document.createElement('b');
        title.textContent = line.title;
        const value = document.createElement('span');
        value.textContent = line.id === failed ? `${line.value} · ${cfg.failed}` : line.value;
        row.append(title, value);
        return row;
      }));
      element.hidden = false;
      clearTimer(timer);
      timer = setTimer(hide, (failed ? Math.max(cfg.showSeconds, cfg.failedSeconds) : cfg.showSeconds) * 1000);
    },
    clear: hide,
  };
}

export function connectChallengeTracker({ events, tracker, pins, save, challenges, sound = null }) {
  const dropped = new Set(); // pinned feats whose attempt was lost: off the tracker until the next attempt starts
  const lines = (failed = null) => pins.ids.map(catalogEntry).filter(Boolean)
    .filter(entry => entry.id === failed || !dropped.has(entry.id))
    .map(entry => entry.track({ save, challenges }));

  const offs = [
    events.on('challengeProgress', ({ gunId, skinId }) => {
      const id = skinPinId(gunId, skinId);
      if (pins.has(id) && !dropped.has(id)) tracker.show(lines(), { changed: id });
    }),
    events.on('challengeLive', ({ gunId, skinId, failed }) => {
      const id = skinPinId(gunId, skinId);
      if (!pins.has(id)) return;
      if (failed) {
        dropped.add(id);
        tracker.show(lines(id), { changed: id, failed: id });
        if (tracker.enabled) sound?.play(cfg.failSound.name, { volume: cfg.failSound.volume });
      } else {
        dropped.delete(id);
        tracker.show(lines(), { changed: id });
      }
    }),
  ];
  const reset = () => { dropped.clear(); tracker.clear(); };
  offs.push(events.on('runReset', reset), events.on('runLoaded', reset));
  return { dispose: () => offs.forEach(off => off()) };
}
