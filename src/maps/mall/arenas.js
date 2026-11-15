// =============================================================================
// ARENAS (Extra Modes: config/arenas.js; the plan: docs/arena-modes-plan.md): what each arena adds to the mall, and the switch
// that turns one on. Nothing here is there in a normal run.
//
// Each arena's own fixtures are built into ITS OWN hidden group (userData.dynamic: the static batcher and freezer leave it
// alone) with its own collider list, so a normal run's map, colliders, spawns and features are exactly what they were.
//
//   const arenas = buildArenas({ group, colliders, zones, areaUnlocks, spawnPoints, features })
//   arenas.list         { [id]: { id, zones, playerSpawn, spawnPoints, features, group, colliders } }
//   arenas.features     every arena's features (each tagged `arena`), for game/features/ to build once with the rest
//   arenas.current      the arena that is on (an id), or null
//   arenas.set(id)      call right after map.reset(): hides the last arena's things and shows this one's (its colliders into the
//                       shared list, its spawn markers into spawnPoints, its features into features), opens exactly its zones
//                       and seals the area system (no door can be bought or opened). set(null) = a normal run.
//   arenas.dispose()
// =============================================================================

import * as THREE from 'three';
import { createMapKit } from '../../world/mapKit.js';
import { markCollidersChanged } from '../../world/collision.js';
import { arenas as config } from '../../config/arenas.js';

export function buildArenas({ group, colliders, zones, areaUnlocks, spawnPoints, features, build = {} }) {
  const root = new THREE.Group();
  root.name = 'arenas';
  root.userData.dynamic = true; // (shown and hidden at runtime: never batched or frozen)
  group.add(root);
  const list = {};
  const kits = [];
  for (const arena of config.list) {
    for (const zone of arena.zones) if (!Object.hasOwn(zones, zone)) throw new Error(`arena "${arena.id}": unknown zone "${zone}"`);
    const arenaGroup = new THREE.Group();
    arenaGroup.name = `arena_${arena.id}`;
    arenaGroup.visible = false;
    root.add(arenaGroup);
    const own = []; // this arena's colliders: in the shared list only while it is on
    const kit = createMapKit(arenaGroup, own);
    kits.push(kit);
    const entry = {
      id: arena.id,
      zones: [...arena.zones],
      playerSpawn: { position: new THREE.Vector3(...arena.playerSpawn.at), yaw: arena.playerSpawn.yaw },
      spawnPoints: arena.spawns.map((s) => ({
        name: `spawn_arena_${arena.id}_${s.id}`, zone: arena.zones[0], arena: arena.id, position: new THREE.Vector3(...s.at),
      })),
      features: [],
      group: arenaGroup,
      colliders: own,
      kit,
    };
    // The fixtures (maps/mall/mall.js passes the builders that need the mall's own pieces: restock, desk...).
    const built = build[arena.id]?.({ kit, arena, group: arenaGroup }) ?? [];
    for (const feature of built) entry.features.push({ ...feature, arena: arena.id, zone: feature.zone ?? arena.zones[0] });
    list[arena.id] = entry;
  }

  let current = null;
  function set(id) {
    if (id !== null && !Object.hasOwn(list, id)) throw new Error(`Unknown arena "${id}"`);
    let changed = false;
    if (current) {
      const was = list[current];
      for (const box of was.colliders) {
        const i = colliders.indexOf(box);
        if (i !== -1) { colliders.splice(i, 1); changed = true; }
      }
      for (const s of was.spawnPoints) { const i = spawnPoints.indexOf(s); if (i !== -1) spawnPoints.splice(i, 1); }
      for (const f of was.features) { const i = features.indexOf(f); if (i !== -1) features.splice(i, 1); }
      was.group.visible = false;
    }
    current = id;
    if (areaUnlocks) areaUnlocks.sealed = id !== null;
    if (id !== null) {
      const now = list[id];
      for (const box of now.colliders) { colliders.push(box); changed = true; }
      spawnPoints.push(...now.spawnPoints);
      features.push(...now.features);
      now.group.visible = true;
      for (const [zoneId, zone] of Object.entries(zones)) zone.open = now.zones.includes(zoneId);
    }
    if (changed) markCollidersChanged(colliders);
  }

  return {
    list,
    features: Object.values(list).flatMap((a) => a.features),
    get current() { return current; },
    set,
    dispose() {
      set(null);
      for (const kit of kits) kit.dispose();
      root.removeFromParent();
    },
  };
}
