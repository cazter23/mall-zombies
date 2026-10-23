import * as THREE from 'three';
import { atmosphere } from '../config/environment.js';
import { seededRandom } from '../world/textures.js';

/** Spatial mix only: the browser sound service owns Web Audio nodes. */
export function createAmbience({ map, player, sound, colliders, random = seededRandom(809) }) {
  const cfg = atmosphere.ambience, origin = new THREE.Vector3(), target = new THREE.Vector3();
  const ray = new THREE.Ray(), hit = new THREE.Vector3();
  let rattle = cfg.rattleMinSeconds + random() * (cfg.rattleMaxSeconds - cfg.rattleMinSeconds);
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
      origin.copy(player.position); origin.y += player.height * cfg.listenerHeightFraction;
      const voices = [];
      for (const emitter of map.ambience ?? []) {
        if (!map.zones[emitter.zone]?.open) continue;
        target.fromArray(emitter.position);
        const mix = spatialMix(target, emitter.range);
        if (mix) voices.push({ id: emitter.id, kind: emitter.kind, ...mix });
      }
      voices.sort((a, b) => b.gain - a.gain);
      const selected = voices.slice(0, cfg.maxVoices);
      sound.setAmbience?.(selected);
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
    reset() { silence(); rattle = cfg.rattleMinSeconds + random() * (cfg.rattleMaxSeconds - cfg.rattleMinSeconds); },
  };
}
