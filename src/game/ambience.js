import * as THREE from 'three';
import { atmosphere } from '../config/environment.js';
import { seededRandom } from '../world/textures.js';

/** Spatial mix only: the browser sound service owns Web Audio nodes. */
export function createAmbience({ map, player, sound, colliders, random = seededRandom(809) }) {
  const cfg = atmosphere.ambience, origin = new THREE.Vector3(), target = new THREE.Vector3();
  const ray = new THREE.Ray(), hit = new THREE.Vector3();
  let rattle = cfg.rattleMinSeconds + random() * (cfg.rattleMaxSeconds - cfg.rattleMinSeconds);
  let elapsed = 0;
  const nextEvent = event => event.minSeconds + random() * (event.maxSeconds - event.minSeconds);
  const events = (map.ambientEvents ?? []).map(event => ({ event, remaining: nextEvent(event) }));
  function silence() { sound.setAmbience?.([]); }
  function spatialMix(position, range) {
    target.copy(position);
    const distance = origin.distanceTo(target);
    if (distance >= range) return null;
    ray.origin.copy(origin); ray.direction.subVectors(target, origin).normalize();
    const blocked = colliders.some(b => !b.ignoreShots && !b.containsPoint(origin)
      && ray.intersectBox(b, hit) && hit.distanceTo(origin) < distance - cfg.occlusionMargin);
    const gain = (1 - distance / range) ** 2 * (blocked ? cfg.occludedGain : 1);
    const dx = target.x - origin.x, dz = target.z - origin.z;
    const pan = (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / Math.max(1, Math.hypot(dx, dz));
    return { gain, pan };
  }
  return {
    update(dt, active) {
      if (!active) { silence(); return; }
      elapsed += dt;
      origin.copy(player.position); origin.y += player.height * cfg.listenerHeightFraction;
      const voices = [];
      for (const emitter of map.ambience ?? []) {
        if (!map.zones[emitter.zone]?.open) continue;
        target.fromArray(emitter.position);
        const mix = spatialMix(target, emitter.range);
        if (mix) {
          const pulse = emitter.pulse;
          const motion = pulse ? 1 - pulse.depth * (.5 + .5 * Math.sin(elapsed * Math.PI * 2 / pulse.period)) : 1;
          voices.push({ id: emitter.id, kind: emitter.kind, ...mix, gain: mix.gain * (emitter.gain ?? 1) * motion });
        }
      }
      voices.sort((a, b) => b.gain - a.gain);
      // Hear only the nearest/loudest speaker for the shared soundtrack, leaving room for HVAC.
      let hasMusic = false;
      const selected = voices.filter(v => {
        if (v.kind !== 'music') return true;
        if (hasMusic) return false;
        hasMusic = true; return true;
      }).slice(0, cfg.maxVoices);
      sound.setAmbience?.(selected);
      // Local one-shots wait for an audible, unlocked area. Pause/death freeze them,
      // and a single update never releases a backlog of sounds after a long frame.
      for (const state of events) {
        const e = state.event;
        if (!map.zones[e.zone]?.open) continue;
        target.fromArray(e.position);
        const mix = spatialMix(target, e.range);
        if (!mix) continue;
        state.remaining -= dt;
        if (state.remaining <= 0) {
          sound.playAmbient?.(e.sound, { volume: mix.gain * (e.gain ?? 1), pan: mix.pan });
          state.remaining = nextEvent(e);
        }
      }
      rattle -= dt;
      if (rattle <= 0) {
        // Rattles come from a real closed shutter, rather than the nearest HVAC/music emitter.
        let loudest = null;
        for (const door of map.doors ?? []) {
          if (door.isOpen) continue;
          const mix = spatialMix(door.position, cfg.rattleRange);
          if (mix && (!loudest || mix.gain > loudest.gain)) loudest = mix;
        }
        if (loudest) sound.playAmbient?.('shutterRattle', { volume: loudest.gain, pan: loudest.pan });
        rattle = cfg.rattleMinSeconds + random() * (cfg.rattleMaxSeconds - cfg.rattleMinSeconds);
      }
    },
    silence,
    reset() {
      silence(); sound.resetMusic?.(); elapsed = 0;
      rattle = cfg.rattleMinSeconds + random() * (cfg.rattleMaxSeconds - cfg.rattleMinSeconds);
      for (const state of events) state.remaining = nextEvent(state.event);
    },
  };
}
