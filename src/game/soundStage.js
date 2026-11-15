// =============================================================================
// SOUND STAGE: where every zombie sound comes from (config/spatialAudio.js; docs/spatial-audio.md). DOM-free, so the
// headless tests run it; audio/sound.js does the Web Audio side.
//   stage.play(name, { emitter, def, volume })   a zombie's sound (emitter = the zombie, or anything with a .position;
//                                                def = its config/zombies.js entry: profile, maxDistance). Placed at the
//                                                emitter and re-placed every frame while it plays (it follows the zombie).
//                                                No emitter: a plain, non-positional play.
//   stage.update(dt, active)                     once a tick: which areas you can hear into (the open portals), and the
//                                                crowd bed (sound.setCrowd) for the whole horde
//   stage.place(point, profile, out)             { x, y, z (listener space), gain, cutoffHz, level, room, surface, sendScale }
//   stage.levelAt(point)                         'clear' | 'neighbour' | 'far' | 'closed' (walls and floors)
// Walls and floors are the room-culling areas and portals (map.cullAreas / cullPortals, fx/roomCulling.js): the same area
// is clear; the next area through an OPEN portal is a little muffled (or clear when the line to it runs through the
// opening); further away is muffled; reachable only through a closed shutter (or not at all) is muffled the most; and a
// zombie on the other floor in another area is at least muffled. No raycasts against the colliders.
// The listener is the player's eye (position + eyeHeight, yaw), exactly what the camera shows.
// =============================================================================

import { audio } from '../config/audio.js';
import { spatialAudio } from '../config/spatialAudio.js';
import { gradeZoneAt } from '../fx/zoneGrading.js';
import { toListener, distanceGain, occlusionOf, worseLevel, segmentHitsBox } from '../audio/spatial.js';

const STEP_PROFILES = new Set(['step', 'heavy']); // (from the feet, and coloured by the floor underfoot)

export function createSoundStage({ map, player, sound, zombies = () => [], cfg = spatialAudio }) {
  const areas = map.cullAreas ?? [];
  const portals = map.cullPortals ?? [];
  const doorById = new Map((map.doors ?? []).map((d) => [d.id, d]));
  const isOpen = (portal) => !portal.door || (doorById.get(portal.door)?.isOpen ?? true);
  const portalsOf = new Map(areas.map((a) => [a.id, []]));
  for (const p of portals) { portalsOf.get(p.a)?.push(p); portalsOf.get(p.b)?.push(p); }

  const inside = (box, p, pad) => p.x >= box.minX - pad && p.x <= box.maxX + pad && p.y >= box.minY - pad && p.y <= box.maxY + pad
    && p.z >= box.minZ - pad && p.z <= box.maxZ + pad;
  /** The areas a point is in: its own, or both sides of an opening it stands in. [] = outside the map (the test range). */
  function areasNear(p) {
    const out = [];
    for (const a of areas) if (inside(a, p, 0.05)) out.push(a.id);
    if (out.length) return out;
    for (const portal of portals) if (inside(portal, p, cfg.occlusion.doorwayPadding)) out.push(portal.a, portal.b);
    return out;
  }

  // The listener, and what it can hear into: hops through open portals, and what is reachable at all (through closed ones).
  const listener = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  function readListener() {
    listener.x = player.position.x;
    listener.y = player.position.y + (player.eyeHeight ?? 1.6);
    listener.z = player.position.z;
    listener.yaw = player.yaw ?? 0;
    listener.pitch = player.pitch ?? 0;
    return listener;
  }
  let here = [];
  const hops = new Map();
  const reach = new Set();
  function walkGraph() {
    readListener();
    here = areasNear(listener);
    hops.clear(); reach.clear();
    let frontier = [...here];
    for (const id of here) { hops.set(id, 0); reach.add(id); }
    for (let depth = 1; frontier.length; depth++) {
      const next = [];
      for (const id of frontier) for (const p of portalsOf.get(id) ?? []) {
        if (!isOpen(p)) continue;
        const other = p.a === id ? p.b : p.a;
        if (!hops.has(other)) { hops.set(other, depth); reach.add(other); next.push(other); }
      }
      frontier = next;
    }
    // (through closed shutters too: somewhere you could open your way to)
    frontier = [...reach];
    while (frontier.length) {
      const next = [];
      for (const id of frontier) for (const p of portalsOf.get(id) ?? []) {
        const other = p.a === id ? p.b : p.a;
        if (!reach.has(other)) { reach.add(other); next.push(other); }
      }
      frontier = next;
    }
  }

  function levelAt(point) {
    if (!here.length) return 'clear'; // (you are outside the map: nothing to muffle by)
    const there = areasNear(point);
    if (!there.length || there.some((id) => here.includes(id))) return 'clear';
    let best = Infinity;
    for (const id of there) best = Math.min(best, hops.get(id) ?? Infinity);
    let level;
    if (best === 1) {
      // Straight through an open opening between the two (a doorway, the escalator well): you hear it as it is.
      const seen = portals.some((p) => isOpen(p) && ((here.includes(p.a) && there.includes(p.b)) || (here.includes(p.b) && there.includes(p.a)))
        && segmentHitsBox(listener, point, p, 0.1));
      level = seen ? 'clear' : 'neighbour';
    } else if (best < Infinity) level = 'far';
    else level = 'closed';
    if (level !== 'clear' && Math.abs(point.y - listener.y) > cfg.occlusion.floorGapMeters) level = worseLevel(level, 'far');
    return level;
  }

  const zoneAt = (point) => gradeZoneAt(map.gradeZones ?? [], point);
  const roomAt = (zone) => audio.roomOf[zone] ?? audio.reverb.defaultRoom;
  const surfaceAt = (zone) => cfg.surfaceOf[zone] ?? 'tile';

  /** Where a point sounds from, for a profile: listener-space position, level after distance and walls, muffle, room. */
  function place(point, profile, out = {}, { volume = 1, surface = null } = {}) {
    toListener(listener, point, out, cfg);
    const d = Math.hypot(point.x - listener.x, point.y - listener.y, point.z - listener.z);
    const dg = distanceGain(d, profile);
    const level = levelAt(point);
    const occ = occlusionOf(level, cfg);
    const zone = zoneAt(point);
    const surf = surface ? cfg.surfaces[surface] ?? cfg.surfaces.tile : null;
    out.distance = d;
    out.level = level;
    out.gain = dg * occ.gain * volume * (surf?.gain ?? 1);
    out.cutoffHz = Math.min(occ.cutoffHz, surf?.cutoffHz ?? 20000);
    out.sendScale = occ.gain * dg ** cfg.sendDistanceExponent;
    out.room = roomAt(zone);
    out.surface = surface;
    return out;
  }

  // A sound's distances: its profile, with the config entry's own maxDistance (tuned per sound) as the far edge.
  const merged = new WeakMap();
  function profileFor(def) {
    const base = cfg.profiles[def?.profile] ?? cfg.profiles.body;
    if (!def?.maxDistance) return base;
    let p = merged.get(def);
    if (!p) merged.set(def, (p = { ...base, max: def.maxDistance }));
    return p;
  }
  /** The point a zombie's sound comes from: its feet for steps, about its mouth for the rest. */
  function sourcePoint(emitter, profileId, out) {
    const p = emitter.position;
    const height = emitter.type?.height ?? 1.6;
    out.x = p.x; out.z = p.z;
    out.y = p.y + (STEP_PROFILES.has(profileId) ? 0.1 : height * 0.82);
    return out;
  }

  function play(name, { emitter = null, def = null, volume = 1 } = {}) {
    if (!emitter?.position) return sound.play(name, { volume });
    readListener();
    const profileId = cfg.profiles[def?.profile] ? def.profile : 'body';
    const profile = profileFor(def);
    const point = sourcePoint(emitter, profileId, {});
    if (Math.hypot(point.x - listener.x, point.y - listener.y, point.z - listener.z) >= profile.max) return null;
    let recipe = name, pitch = 1, surface = null;
    if (STEP_PROFILES.has(profileId)) {
      surface = surfaceAt(zoneAt(point));
      if (audio.sounds[`${name}@${surface}`]) recipe = `${name}@${surface}`;
      pitch = cfg.surfaces[surface]?.pitch ?? 1;
    }
    const opts = { volume, surface };
    const spatial = {
      priority: profile.priority,
      place: (out) => { readListener(); return place(sourcePoint(emitter, profileId, point), profile, out, opts); },
    };
    return sound.play(recipe, { pitch, spatial });
  }

  // ---- The crowd bed: the whole horde as one murmur, where the horde is ----------------------------------------
  const crowd = { gain: 0, x: 0, y: 0, z: -1, cutoffHz: 20000, count: 0 };
  const scratch = {}, point = {};
  let crowdClock = 0;
  function updateCrowd(active) {
    const c = cfg.crowd, voice = { ...cfg.profiles.voice, max: c.range, minGain: 0 };
    let weight = 0, count = 0, vx = 0, vy = 0, vz = 0, cut = 0;
    if (active) for (const z of zombies()) {
      if (!z.isAlive || z.removed) continue;
      sourcePoint(z, 'voice', point);
      const d = Math.hypot(point.x - listener.x, point.y - listener.y, point.z - listener.z);
      if (d > c.range) continue;
      const occ = occlusionOf(levelAt(point), cfg);
      const w = distanceGain(d, voice) * occ.gain;
      if (!(w > 0)) continue;
      toListener(listener, point, scratch, cfg);
      const len = Math.hypot(scratch.x, scratch.y, scratch.z) || 1;
      vx += (scratch.x / len) * w; vy += (scratch.y / len) * w; vz += (scratch.z / len) * w;
      cut += occ.cutoffHz * w; weight += w; count++;
    }
    crowd.count = count;
    crowd.gain = count >= c.minZombies ? c.maxGain * (1 - Math.exp(-weight / c.knee)) : 0;
    const len = weight > 0 ? Math.hypot(vx, vy, vz) / weight : 0;
    if (len > 0.15) { const k = c.distance / (len * weight); crowd.x = vx * k; crowd.y = vy * k; crowd.z = vz * k; }
    else { crowd.x = 0; crowd.y = 0; crowd.z = -c.distance; } // (all round you: in front, everywhere at once)
    crowd.cutoffHz = weight > 0 ? cut / weight : 20000;
    sound.setCrowd?.(crowd);
  }

  return {
    play,
    place: (pointIn, profile = cfg.profiles.body, out = {}, opts) => { readListener(); return place(pointIn, profile, out, opts); },
    levelAt,
    get listener() { return listener; },
    get crowd() { return crowd; },
    /** The areas you are in now (after the last update). */
    get areas() { return here; },
    update(dt, active = true) {
      walkGraph();
      crowdClock -= dt;
      if (crowdClock <= 0) { crowdClock = cfg.crowd.updateSeconds; updateCrowd(active); }
    },
    reset() {
      crowdClock = 0;
      crowd.gain = 0; crowd.count = 0;
      sound.setCrowd?.(crowd);
    },
  };
}
