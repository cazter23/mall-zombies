// Browser peripheral: listens to gameplay events, never changes gameplay.
// Unsupported/blocked actuators are silent no-ops. No delayed rumble queue.
// Shots, hits and kills, getting hurt, pickups, blasts, bosses, jackpots, Doorbusters and bought doors come from the event bus (config/haptics.js);
// `charge` (optional, () => 0..1) is read each tick: a charge gun winding up hums, growing as it fills.
import { haptics as defaults } from '../config/haptics.js';

export function createHaptics({ gamepad, input, state, health, events, config = defaults, charge = null,
  now = () => performance.now(), page = globalThis.document, windowTarget = globalThis.window }) {
  let actuator = null;
  let padKey = null;
  let priority = 0;
  let until = 0;
  let playing = { strong: 0, weak: 0, accent: false }; // what the motors are doing until `until` (before strength)
  let focused = page?.hasFocus?.() ?? true;
  let nextCharge = 0; // when the charge hum may pulse again

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
    playing = { strong: 0, weak: 0, accent: false };
    padKey = null;
  }

  function eligible() {
    return config.strength > 0 && focused && !page?.hidden && state.running && !state.over
      && input.device === 'gamepad' && gamepad.connected && gamepad.pad?.connected;
  }

  function pulse(effect) {
    if (!eligible()) { stop(); return; }
    if (!effect) return;
    const busy = now() < until;
    // An accent (a hit, a kill) blends with what is playing, both ways (config/haptics.js hit); anything else replaces it.
    const blend = busy && (effect.accent || playing.accent);
    if (busy && !blend && effect.priority < priority) return;
    const pad = gamepad.pad;
    const candidates = [pad.vibrationActuator, ...(pad.hapticActuators ?? [])].filter(Boolean);
    const supportsDual = (a) => typeof a.playEffect === 'function' && (!a.effects || Array.from(a.effects).includes('dual-rumble'));
    const next = candidates.find(supportsDual) ?? candidates.find((a) => typeof a.pulse === 'function');
    if (!next) return;
    const key = `${pad.index}:${pad.id}`;
    if (padKey !== null && key !== padKey) stop();
    actuator = next;
    padKey = key;
    const duration = blend ? Math.max(effect.duration, until - now()) : effect.duration;
    const strong = blend ? Math.max(effect.strongMagnitude, playing.strong) : effect.strongMagnitude;
    const weak = blend ? Math.max(effect.weakMagnitude, playing.weak) : effect.weakMagnitude;
    if (blend && strong === playing.strong && weak === playing.weak && effect.duration <= until - now()) return; // (adds nothing: a second pellet)
    priority = blend ? Math.max(priority, effect.priority) : effect.priority;
    until = now() + duration;
    playing = { strong, weak, accent: blend || !!effect.accent };
    const strength = Math.max(0, Math.min(1, config.strength));
    const strongMagnitude = Math.max(0, Math.min(1, strong * strength));
    const weakMagnitude = Math.max(0, Math.min(1, weak * strength));
    safely(() => supportsDual(next)
      ? next.playEffect('dual-rumble', { startDelay: 0, duration, strongMagnitude, weakMagnitude })
      : next.pulse(Math.max(strongMagnitude, weakMagnitude), duration));
  }

  const off = [
    events.on('shot', ({ weaponId }) => pulse(config.shots[weaponId])),
    // Your gun or box cutter landed a hit (not hazards, equipment or burns: they don't announce 'hit').
    events.on('hit', ({ killed, headshot }) => {
      if (killed) pulse(config.kill);
      if (headshot) pulse(config.headshot);
      if (!killed && !headshot) pulse(config.hit);
    }),
    events.on('playerHit', ({ damage }) => {
      if (damage > 0 && !health.invulnerable && !health.isDead) pulse(config.damage);
    }),
    events.on('playerFall', () => { if (!health.invulnerable && !health.isDead) pulse(config.damage); }),
    events.on('powerUpCollect', () => pulse(config.pickup)),
    events.on('gunBlast', () => pulse(config.blast)),
    events.on('equipmentBurst', ({ id }) => { if (id !== 'glitterBomb') pulse(config.blast); }), // (glitter does no damage: no thump)
    events.on('airHornBlast', () => pulse(config.airHorn)),
    events.on('bossSpawn', () => pulse(config.bossSpawn)),
    events.on('bossDefeated', () => pulse(config.bossDefeated)),
    events.on('clawPrize', () => pulse(config.jackpot)),
    events.on('ticketsWon', () => pulse(config.jackpot)),
    events.on('mascotGold', () => pulse(config.jackpot)),
    events.on('flashSaleStart', ({ kind }) => { if (kind === 'doorbuster') pulse(config.doorbuster); }),
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
      if (!eligible() || (padKey !== null && `${pad?.index}:${pad?.id}` !== padKey)) {
        stop();
        return;
      }
      const amount = charge?.() ?? 0;
      const hum = config.charge;
      if (hum && amount > 0 && now() >= nextCharge) {
        nextCharge = now() + hum.everyMs;
        const mix = ([from, to]) => from + (to - from) * Math.min(1, amount);
        pulse({ duration: hum.duration, priority: hum.priority, strongMagnitude: mix(hum.strongMagnitude), weakMagnitude: mix(hum.weakMagnitude) });
      }
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
