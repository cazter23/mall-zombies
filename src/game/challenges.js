// Event-driven counters. A new kind supplies one factory with events and optional finish/update/reset/snapshot.
// finish handlers run only at named lifecycle boundaries; a runEnd can finalize a feat after state.over is set.
import { skins, gunSkin, skinNotices, challengeDebug } from '../config/skins.js';
import { weapons } from '../config/weapons.js';

const COUNTERS = {
  kills({ gunId, advance }) {
    return {
      events: {
        kill({ weaponId, zombie }) {
          if (weaponId === gunId && !zombie?.noRewards) advance(1);
        },
      },
    };
  },
};

export function createChallenges({ events, state, save }) {
  function advance(gunId, skin, amount, persist = false) {
    const needed = skin.challenge.count;
    const before = save.progress(gunId, skin.id);
    const count = Math.max(before, Math.min(needed, before + amount));
    const unlock = !save.unlocked(gunId, skin.id) && count >= needed;
    save.record(gunId, skin.id, count, unlock);
    if (unlock || persist) save.flush();
    if (count !== before) events.emit('challengeProgress', { gunId, skinId: skin.id, count, needed });
    if (unlock) events.emit('skinUnlocked', {
      gunId, skinId: skin.id, pa: skinNotices.pa(weapons[gunId].name, skin.name),
    });
    return count;
  }

  const counters = [];
  const lifecycle = new Map();
  for (const [gunId, entries] of Object.entries(skins)) {
    for (const skin of entries) {
      const factory = COUNTERS[skin.challenge?.kind];
      if (!factory) continue;
      const counter = factory({ gunId, skin, advance: amount => advance(gunId, skin, amount) });
      counters.push({ gunId, skinId: skin.id, counter });
      for (const [event, handler] of Object.entries(counter.events ?? {})) {
        events.on(event, payload => { if (!state.assisted && !state.over) handler(payload); });
      }
      for (const [event, handler] of Object.entries(counter.finish ?? {})) {
        if (!lifecycle.has(event)) lifecycle.set(event, []);
        lifecycle.get(event).push(handler);
      }
    }
  }
  for (const [event, handlers] of lifecycle) events.on(event, payload => {
    if (state.assisted || (state.over && event !== 'runEnd')) return;
    for (const handler of handlers) handler(payload);
  });
  // Always flush prior eligible progress, including when the rest of the run became assisted.
  events.on('runEnd', () => save.flush());

  return {
    snapshot() {
      return {
        ...save.snapshot(),
        run: Object.fromEntries(counters.filter(({ counter }) => counter.snapshot)
          .map(({ gunId, skinId, counter }) => [`${gunId}/${skinId}`, counter.snapshot()])),
      };
    },
    update(dt) {
      if (state.assisted || state.over) return;
      for (const { counter } of counters) counter.update?.(dt);
    },
    reset() {
      for (const { counter } of counters) counter.reset?.();
    },
    debug(gunId, skinId, action, amount = 1) {
      const skin = gunSkin(gunId, skinId);
      if (!skin?.challenge || !COUNTERS[skin.challenge.kind]) return challengeDebug.unknownChallenge;
      if (action === 'clear') {
        save.clear(gunId, skinId);
        events.emit('challengeProgress', { gunId, skinId, count: 0, needed: skin.challenge.count });
        return challengeDebug.cleared(skin.name);
      }
      if (action !== 'add' && action !== 'complete') return challengeDebug.usage;
      if (action === 'add' && (!Number.isSafeInteger(amount) || amount <= 0)) return challengeDebug.invalidAmount;
      const count = advance(gunId, skin, action === 'complete' ? skin.challenge.count : amount, true);
      return challengeDebug.changed(skin.name, count, skin.challenge.count);
    },
  };
}
