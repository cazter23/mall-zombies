// =============================================================================
// MAPS
// Every playable map is a folder under src/maps/ with a build function that
// returns the MAP INTERFACE below. The game (game/createGame.js) only ever talks to that interface,
// so adding a map = adding a folder + one line in `maps`.
//
// Map interface (what build(scene, colliders) returns):
//   id            'mall'
//   group         THREE.Group holding EVERYTHING the map added (meshes, lights,
//                 debug markers), so removing it unloads the map's visuals
//   zones         { [zoneId]: { label, open } }   the starting zone is open
//   doors         [door]   buyable barriers that open zones (world/door.js); several doors
//                 may open the same zone (it's open while any of them is); opensZones
//                 lets a shortcut open both adjoining areas (opensZone still works)
//   spawnPoints   [{ name, zone, position }]      zombie spawns, tagged by zone
//   features      [{ kind, name, zone, position, normal, ...that kind's fields }]  everything (besides doors)
//                 the player interacts with; built by kind in game/features/ (an unknown kind is an error).
//                 Kinds now: 'wallBuy' (+ weapon: a config/weapons.js id), 'ammoCache'
//   playerSpawn   { position, yaw }
//   update(dt)    animate doors etc.
//   reset()       new run: close doors, lock zones
//   dispose()     unload: remove its colliders from the shared list, free its GPU memory
//                 (geometries, materials, textures) and take its group out of the scene
// Its solid boxes are pushed into the shared `colliders` array passed in (the
// player, zombies and bullets all use that one list). Maps build with the map kit
// (world/mapKit.js: boxes, walls with doorways, shutter doors, signs, markers).
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
