// =============================================================================
// SETTINGS STORE
// Holds the current value of every setting in config/settings.js, saves them in
// the browser (localStorage) and applies them to the game. The menu talks to this.
// =============================================================================

import { settingDefs } from '../config/settings.js';

const STORAGE_KEY = 'mallZombies.settings';

// Make a loaded/typed value safe for its setting (wrong type, out of range, unknown option).
function sanitize(def, value) {
  if (def.type === 'toggle') return typeof value === 'boolean' ? value : def.default;
  if (def.type === 'slider') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return def.default;
    return Math.min(def.max, Math.max(def.min, value));
  }
  if (def.type === 'select') return def.options.some((o) => o.value === value) ? value : def.default;
  return def.default;
}

/** Has this browser saved settings before? (false on the very first launch: game/autoGraphics.js then picks a preset) */
export function hasSavedSettings() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // no storage: don't guess, keep the defaults
  }
}

/** One saved setting as it was last saved, before the settings are created (debug mode is decided first: game/debugMode.js). */
export function readSavedSetting(id) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))?.[id];
  } catch {
    return undefined; // no storage / corrupt data
  }
}

export function createSettings(ctx) {
  const values = {};
  const listeners = [];

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    saved = {}; // no storage / corrupt data: just use the defaults
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      /* storage blocked: settings still work for this session */
    }
  }

  function applyOne(def) {
    def.apply(values[def.id], ctx);
  }

  for (const def of settingDefs) {
    values[def.id] = sanitize(def, saved[def.id]);
    applyOne(def);
  }

  return {
    defs: settingDefs,
    get: (id) => values[id],

    set(id, value) {
      const def = settingDefs.find((d) => d.id === id);
      if (!def) return;
      values[id] = sanitize(def, value);
      applyOne(def);
      save();
      for (const fn of listeners) fn(id, values[id]);
    },

    // Put every setting (or just one tab's) back to its default.
    reset(tab = null) {
      for (const def of settingDefs) {
        if (!def.tab || (tab && def.tab !== tab)) continue; // (a remembered choice with no tab is not a menu setting: kept)
        values[def.id] = def.default;
        applyOne(def);
      }
      save();
      for (const fn of listeners) fn(null, null);
    },

    onChange(fn) {
      listeners.push(fn);
    },
  };
}
