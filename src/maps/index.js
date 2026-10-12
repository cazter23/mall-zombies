// =============================================================================
// MAPS
// Every playable map is a folder under src/maps/ with a build function that
// returns the MAP INTERFACE below. main.js only ever talks to that interface,
// so adding a map = adding a folder + one line in `maps`.
//
// Map interface (what build(scene, colliders) returns):
//   id            'mall'
//   group         THREE.Group holding EVERYTHING the map added (meshes, lights,
//                 debug markers), so removing it unloads the map's visuals
//   zones         { [zoneId]: { label, open } }   the starting zone is open
//   doors         [door]   buyable barriers that open zones (world/door.js)
//   spawnPoints   [{ name, zone, position }]      zombie spawns, tagged by zone
//   wallBuys      [{ name, zone, position, normal, weapon }]  weapon id per spot
//   playerSpawn   { position, yaw }
//   update(dt)    animate doors etc.
//   reset()       new run: close doors, lock zones
//   dispose()     remove the map from the scene
// Its solid boxes are pushed into the shared `colliders` array passed in (the
// player, zombies and bullets all use that one list).
// =============================================================================

import { buildMall } from './mall/mall.js';

export const maps = {
  mall: buildMall,
};

export function loadMap(id, scene, colliders) {
  const build = maps[id];
  if (!build) throw new Error(`Unknown map "${id}". Known maps: ${Object.keys(maps).join(', ')}`);
  return build(scene, colliders);
}
