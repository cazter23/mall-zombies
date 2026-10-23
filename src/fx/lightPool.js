// =============================================================================
// LIGHT POOL: a fixed number of real point lights shared out among the map's lamps.
// Every real light in a scene costs on every lit surface drawn (and the number of lights is baked into the shaders), so
// on weak computers the map's lamps become SOURCES: they stay in the scene as data but are hidden, and a pool of `size`
// real lights is moved to whichever sources are nearest the camera. A slot fades out before it moves and fades in after,
// so lamps never pop. Each pool light copies its source's colour / intensity / range every frame, so flickering and
// dimming lamps (atmosphere.js, emergency lights) keep animating.
//
//   const pool = createLightPool({ scene, sources })   sources: the map's PointLights (collectPointLights(group))
//   pool.setSize(n)          n real lights, or Infinity / 'all' = no pool (every lamp is a real light, as built)
//   pool.update(position, dt)  each rendered frame (the camera's position)
//   pool.dispose()
// The number of lit lights only changes in setSize (a shader rebuild happens then, once), never in update.
// =============================================================================

import * as THREE from 'three';

/** Every PointLight under these groups (the map's lamps). */
export function collectPointLights(...groups) {
  const lights = [];
  for (const group of groups) group?.traverse((o) => { if (o.isPointLight) lights.push(o); });
  return lights;
}

export function createLightPool({ scene, sources, fadeSeconds = 0.25, reselectSeconds = 0.2 }) {
  const world = new THREE.Vector3();
  const slots = []; // { light, source, weight }
  let size = Infinity;
  let reselect = 0;

  function sourcePosition(source) {
    return source.getWorldPosition(world);
  }

  // How much a source deserves a real light: near the camera first; lamps that are switched off get nothing.
  function score(source, position) {
    if (source.intensity <= 0) return Infinity;
    return sourcePosition(source).distanceTo(position) - (source.distance || 0) * 0.25;
  }

  function clearSlots() {
    for (const slot of slots) slot.light.removeFromParent();
    slots.length = 0;
  }

  function setSize(n) {
    const next = n === 'all' ? Infinity : Math.max(0, Math.floor(n));
    if (next === size && (next === Infinity || slots.length === next)) return;
    size = next;
    clearSlots();
    if (size === Infinity || size >= sources.length) { // no pool: the lamps light the scene themselves
      for (const s of sources) s.visible = true;
      return;
    }
    for (const s of sources) s.visible = false;
    for (let i = 0; i < size; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      light.name = `lightPool_${i}`;
      scene.add(light);
      slots.push({ light, source: null, weight: 0 });
    }
    reselect = 0;
  }

  function update(position, dt) {
    if (!slots.length) return;
    reselect -= dt;
    let wanted = null;
    if (reselect <= 0) {
      reselect = reselectSeconds;
      wanted = sources
        .map((s) => ({ s, d: score(s, position) }))
        .filter((e) => Number.isFinite(e.d))
        .sort((a, b) => a.d - b.d)
        .slice(0, slots.length)
        .map((e) => e.s);
    }
    const fade = fadeSeconds > 0 ? dt / fadeSeconds : 1;
    if (wanted) {
      const kept = new Set(slots.map((slot) => slot.source).filter((s) => wanted.includes(s)));
      const free = wanted.filter((s) => !kept.has(s));
      for (const slot of slots) {
        if (slot.source && wanted.includes(slot.source)) continue;
        slot.leaving = true; // fade out, then take a wanted lamp
        slot.next = free.shift() ?? null;
      }
    }
    for (const slot of slots) {
      if (slot.leaving) {
        slot.weight = Math.max(0, slot.weight - fade);
        if (slot.weight === 0) {
          slot.source = slot.next ?? null;
          slot.leaving = false;
          slot.next = null;
        }
      } else if (slot.source) {
        slot.weight = Math.min(1, slot.weight + fade);
      }
      const { light, source } = slot;
      if (!source) { light.intensity = 0; continue; }
      light.position.copy(sourcePosition(source));
      light.color.copy(source.color);
      light.distance = source.distance;
      light.decay = source.decay;
      light.intensity = source.intensity * slot.weight;
    }
  }

  return {
    setSize,
    update,
    get size() { return size; },
    get slots() { return slots; },
    dispose() {
      clearSlots();
      for (const s of sources) s.visible = true;
    },
  };
}
