// =============================================================================
// ARENAS (Extra Modes: config/arenas.js; the plan: docs/archive/arena-modes-plan.md): what each arena adds to the mall, and the switch
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
import { upgrades } from '../../config/upgrades.js';
import { createMallProps } from './props.js';
import { buildRestockMachine } from './restockMachine.js';
import { buildWardrobeMachine } from './wardrobeMachine.js';

const v3 = (a) => new THREE.Vector3(...a);

// --- The fixtures, by kind (each returns map features; the arena's id and zone are added by buildArenas) -------------------

/** An arena-only RESTOCK-O-MATIC (mall/restockMachine.js) on a wall along X. */
function restock(kit, arena) {
  const r = arena.restock;
  const machine = buildRestockMachine({ kit, center: r.x, wallAt: r.wallZ, facing: r.facing, floorY: r.floorY });
  return [{ kind: 'ammoCache', name: `ammocache_arena_${arena.id}`, position: machine.position, normal: machine.normal, screen: machine.screen }];
}

/** An arena-only WEAR-O-MATIC (mall/wardrobeMachine.js: every Wardrobe item, plus a convenience fee) on a wall along X. */
function wardrobeMachine(kit, arena) {
  const w = arena.wardrobeMachine;
  const machine = buildWardrobeMachine({ kit, center: w.x, wallAt: w.wallZ, facing: w.facing, floorY: w.floorY });
  return [{ kind: 'wardrobeMachine', name: `wardrobemachine_arena_${arena.id}`, position: machine.position, normal: machine.normal }];
}

/** An arena-only Customer Service booth (mall/props.js serviceDesk: one solid collider, three windows). */
function desk(kit, arena) {
  const { floorY, ...spot } = arena.desk;
  if (floorY) throw new Error(`arena "${arena.id}": the Customer Service booth is built on the ground floor only`);
  const booth = createMallProps(kit).serviceDesk({ ...spot, tierColors: upgrades.tiers.map((t) => t.color) });
  return [{ kind: 'upgradeDesk', name: `upgradedesk_arena_${arena.id}`, ...booth }];
}

/**
 * Customer Service at an existing counter facing +Z (Last Showing: the Box Office): the desk's three buy spots along its front,
 * a CUSTOMER SERVICE board hung from the ceiling above the counter's own header, and a label over each window. No collider.
 */
function boxOffice(kit, arena) {
  const b = arena.boxOffice;
  const Y = b.floorY;
  const at = (x) => new THREE.Vector3(x, Y + b.promptHeight, b.front + b.promptOut);
  const board = b.board;
  const boardZ = b.front + board.proud; // its back face
  const boardMat = kit.mat(0x1f1a24);
  kit.box(b.center - board.width / 2, Y + board.y - board.height / 2, boardZ, b.center + board.width / 2, Y + board.y + board.height / 2, boardZ + 0.04,
    boardMat, { collide: false, name: 'arena_boxoffice_board' });
  for (const dx of [-board.width / 2 + 0.3, board.width / 2 - 0.3]) {
    kit.box(b.center + dx - 0.006, Y + board.y + board.height / 2, boardZ + 0.014, b.center + dx + 0.006, Y + b.ceiling, boardZ + 0.026,
      kit.mat(0x5d636b), { collide: false, name: 'arena_boxoffice_wire' });
  }
  kit.sign('CUSTOMER SERVICE', { x: b.center, y: Y + board.y, z: boardZ + 0.06, width: board.width - 0.1, height: board.height - 0.08,
    facing: 1, background: '#1f1a24', color: '#7fe3e8', font: 'marquee' }).name = 'arena_boxoffice_sign';
  const L = b.labels;
  const label = (text, x, width, color, font) => {
    kit.sign(text, { x, y: Y + L.y, z: b.front + L.proud, width, height: L.height, facing: 1, background: '#1d1626', color, font }).name = 'arena_boxoffice_label';
  };
  label('SHARPENING', b.center + b.windowOffset, 0.9, '#ffd23f', 'industrial');
  label('WARRANTIES', b.center, 0.9, '#7fe3e8', 'cinemaBody');
  label('SECOND CHANCE', b.center - b.windowOffset, 0.95, '#a4f3c4', 'dinerScript');
  return [{
    kind: 'upgradeDesk', name: `upgradedesk_arena_${arena.id}`, position: at(b.center), normal: new THREE.Vector3(0, 0, 1),
    meleePosition: at(b.center + b.windowOffset), secondChancePosition: at(b.center - b.windowOffset),
  }];
}

/** Arena-only wall guns; on a fence, each gets a plywood board to hang on (the gun's outline sits 2 cm proud of it). */
function wallBuys(kit, arena) {
  return arena.wallBuys.map((w) => {
    const position = v3(w.at);
    const normal = v3(w.normal);
    if (w.board) {
      const { half: [along, up], depth, gap } = w.board;
      const front = position.clone().addScaledVector(normal, -gap); // the board's front face
      const back = front.clone().addScaledVector(normal, -depth);
      const alongX = normal.z !== 0;
      const [x0, x1] = alongX ? [position.x - along, position.x + along] : [Math.min(front.x, back.x), Math.max(front.x, back.x)];
      const [z0, z1] = alongX ? [Math.min(front.z, back.z), Math.max(front.z, back.z)] : [position.z - along, position.z + along];
      kit.box(x0, position.y - up, z0, x1, position.y + up, z1, kit.mat(0xc8a46e), { collide: false, name: 'arena_wallbuy_board' });
    }
    return { kind: 'wallBuy', name: `wallbuy_arena_${arena.id}_${w.id}`, weapon: w.weapon, position, normal };
  });
}

/** What an arena adds, from its config entry (each part only when the entry has it). */
function buildFixtures(kit, arena) {
  return [
    ...(arena.restock ? restock(kit, arena) : []),
    ...(arena.desk ? desk(kit, arena) : []),
    ...(arena.boxOffice ? boxOffice(kit, arena) : []),
    ...(arena.wallBuys?.length ? wallBuys(kit, arena) : []),
    ...(arena.wardrobeMachine ? wardrobeMachine(kit, arena) : []),
  ];
}

export function buildArenas({ group, colliders, zones, areaUnlocks, spawnPoints, features, build = buildFixtures }) {
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
    // The fixtures: an arena-only RESTOCK-O-MATIC, Customer Service, wall guns, a WEAR-O-MATIC (each only where config/arenas.js has one).
    const built = build(kit, arena);
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
