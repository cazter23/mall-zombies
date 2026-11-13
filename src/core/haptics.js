// Browser peripheral: listens to gameplay events, never changes gameplay.
// Unsupported/blocked actuators are silent no-ops. No delayed rumble queue.
import { haptics as defaults } from '../config/haptics.js';

export function createHaptics({ gamepad, input, state, health, events, config = defaults,
  now = () => performance.now(), page = globalThis.document, windowTarget = globalThis.window }) {
  let actuator = null;
  let padKey = null;
  let priority = 0;
  let until = 0;
  let focused = page?.hasFocus?.() ?? true;

  function safely(call) {
    try { Promise.resolve(call()).catch(() => {}); } catch { /* hardware may disappear between polls */ }
  }

  function stop() {
    if (actuator) {
      const old = actuator;
      actuator = null;
      safely(() => old.reset ? old.reset() : old.pulse?.(0, 0));
    }
    priority = 0;
    until = 0;
    padKey = null;
  }

  function eligible() {
    return config.strength > 0 && focused && !page?.hidden && state.running && !state.over
      && input.device === 'gamepad' && gamepad.connected && gamepad.pad?.connected;
  }

  function pulse(effect) {
    if (!eligible()) { stop(); return; }
    if (!effect || (now() < until && effect.priority < priority)) return;
    const pad = gamepad.pad;
    const candidates = [pad.vibrationActuator, ...(pad.hapticActuators ?? [])].filter(Boolean);
    const supportsDual = (a) => typeof a.playEffect === 'function' && (!a.effects || Array.from(a.effects).includes('dual-rumble'));
    const next = candidates.find(supportsDual) ?? candidates.find((a) => typeof a.pulse === 'function');
    if (!next) return;
    const key = `${pad.index}:${pad.id}`;
    if (padKey !== null && key !== padKey) stop();
    actuator = next;
    padKey = key;
    priority = effect.priority;
    until = now() + effect.duration;
    const strength = Math.max(0, Math.min(1, config.strength));
    const strongMagnitude = Math.max(0, Math.min(1, effect.strongMagnitude * strength));
    const weakMagnitude = Math.max(0, Math.min(1, effect.weakMagnitude * strength));
    safely(() => supportsDual(next)
      ? next.playEffect('dual-rumble', { startDelay: 0, duration: effect.duration, strongMagnitude, weakMagnitude })
      : next.pulse(Math.max(strongMagnitude, weakMagnitude), effect.duration));
  }

  const off = [
    events.on('shot', ({ weaponId }) => pulse(config.shots[weaponId])),
    events.on('playerHit', ({ damage }) => {
      if (damage > 0 && !health.invulnerable && !health.isDead) pulse(config.damage);
    }),
    events.on('playerFall', () => { if (!health.invulnerable && !health.isDead) pulse(config.damage); }),
    events.on('powerUpCollect', () => pulse(config.pickup)),
    // A bought door (game/doorOpenings.js): a tick as it unlocks, a thump when it clunks home near you.
    events.on('barrierOpening', ({ bought }) => { if (bought) pulse(config.doorUnlock); }),
    events.on('barrierOpened', ({ bought, near }) => { if (bought && near) pulse(config.doorClunk); }),
    events.on('playerDeath', stop),
    events.on('runReset', stop),
  ];
  const blur = () => { focused = false; stop(); };
  const focus = () => { focused = true; };
  const visibility = () => { if (page.hidden) stop(); };
  windowTarget?.addEventListener('blur', blur);
  windowTarget?.addEventListener('focus', focus);
  windowTarget?.addEventListener('pagehide', stop);
  page?.addEventListener('visibilitychange', visibility);

  return {
    stop,
    update() {
      const pad = gamepad.pad;
      if (!eligible() || (padKey !== null && `${pad?.index}:${pad?.id}` !== padKey)) stop();
    },
    setStrength(value) {
      config.strength = Math.max(0, Math.min(1, value));
      if (config.strength === 0) stop();
    },
    dispose() {
      stop();
      off.forEach((unsubscribe) => unsubscribe());
      windowTarget?.removeEventListener('blur', blur);
      windowTarget?.removeEventListener('focus', focus);
      windowTarget?.removeEventListener('pagehide', stop);
      page?.removeEventListener('visibilitychange', visibility);
    },
  };
}
