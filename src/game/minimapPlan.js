// =============================================================================
// MINIMAP PLAN: the mall directory's floor plan, worked out once from the map (DOM-free, so tests read it headless), and
// what changes during a run (which areas are bought, which shutters are shut and what they cost, where Kevin's cart is,
// where a dropped key lies). ui/minimap.js draws it; config/minimap.js says what goes on it.
// Everything comes from map data: the rooms are the culling rooms (map.cullAreas) listed per floor in the map's `minimap`,
// shutters are drawn as their doorway's culling portal, escalators and stairs are the walkable ramps, and the places are
// map.features by kind. A new area, door or feature shows up on the map without touching this file.
// Never on it: zombies, bosses, lost property, quest steps (config/minimap.js).
// =============================================================================

import { minimap as config } from '../config/minimap.js';
import { weapons } from '../config/weapons.js';
import { zoneForRoom } from '../maps/areaBarriers.js';
import { collectSaleSpots } from './flashSales.js';

const rect = ({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ });
const area = (r) => (r.maxX - r.minX) * (r.maxZ - r.minZ);

/** The fixed floor plan, or null for a map without a `minimap`. */
export function buildMinimapPlan(map, colliders = []) {
  const spec = map.minimap;
  if (!spec) return null;
  const culling = new Map((map.cullAreas ?? []).map((room) => [room.id, room]));

  // Which floor a height is on: the first floor whose `below` it is under (the last floor has none).
  const floorAt = (y) => {
    const i = spec.floors.findIndex((floor) => floor.below === undefined || y < floor.below);
    return i < 0 ? spec.floors.length - 1 : i;
  };

  const floors = spec.floors.map((floor, index) => {
    const rooms = floor.rooms.map((id) => {
      const shape = spec.shapes?.[id] ?? culling.get(id);
      if (!shape) throw new Error(`minimap: floor "${floor.id}" lists room "${id}", which is not a culling room`);
      return { id, zone: zoneForRoom(id), ...rect(shape) };
    });
    const bounds = rooms.reduce((b, r) => ({
      minX: Math.min(b.minX, r.minX), maxX: Math.max(b.maxX, r.maxX), minZ: Math.min(b.minZ, r.minZ), maxZ: Math.max(b.maxZ, r.maxZ),
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    // One name per area per floor, on its biggest room.
    const labels = [];
    for (const zone of new Set(rooms.map((r) => r.zone))) {
      const biggest = rooms.filter((r) => r.zone === zone).sort((a, b) => area(b) - area(a))[0];
      labels.push({ zone, text: map.zones[zone]?.label ?? zone, x: (biggest.minX + biggest.maxX) / 2, z: (biggest.minZ + biggest.maxZ) / 2,
        width: biggest.maxX - biggest.minX });
    }
    return {
      id: floor.id, label: floor.label, index, rooms, bounds, labels,
      voids: (spec.voids ?? []).filter((v) => v.floor === floor.id).map(rect),
      // Escalators and stairs join the floors, so each is drawn on every floor it touches.
      ramps: (colliders.ramps ?? []).filter((ramp) => {
        const heights = ramp.points.map(([, y]) => y);
        return floorAt(Math.min(...heights)) <= index && index <= floorAt(Math.max(...heights));
      }).map((ramp) => ({ ...rect(ramp), axis: ramp.axis, dir: ramp.dir, ramp })),
    };
  });

  // Shutters: drawn as their doorway (its culling portal, or a small square at the door if it has none).
  const portals = new Map((map.cullPortals ?? []).filter((p) => p.door).map((p) => [p.door, p]));
  const shutters = map.doors.filter((door) => door.barrier?.kind === 'shutter').map((door) => {
    const portal = portals.get(door.id);
    const p = door.position;
    const shape = portal ? rect(portal) : { minX: p.x - 0.8, maxX: p.x + 0.8, minZ: p.z - 0.8, maxZ: p.z + 0.8 };
    return { id: door.id, door, floor: floorAt(portal ? portal.minY + 0.5 : p.y - 1.5), x: (shape.minX + shape.maxX) / 2, z: (shape.minZ + shape.maxZ) / 2, ...shape };
  });

  // Doorways (culling portals that are gaps in a wall, not holes in a floor): the floor plan's walls are broken there.
  const zoneOfRoom = (id) => zoneForRoom(id);
  const openings = (map.cullPortals ?? []).filter((p) => Math.min(p.maxX - p.minX, p.maxZ - p.minZ) < 1.2).map((p) => ({
    ...rect(p), floor: floorAt(p.minY + 0.5), door: p.door ?? null, zones: [zoneOfRoom(p.a), zoneOfRoom(p.b)],
    across: p.maxX - p.minX < p.maxZ - p.minZ ? 'x' : 'z', // (the thin axis: the wall's thickness)
  }));

  // Places: map features of the kinds config/minimap.js lists. Kevin's carts are one feature with five sites (shown live).
  // Each gets a number in the store index; places of one kind with the same name in the same area share it (the eight
  // attachment counters are one entry).
  const zoneLabel = (zone) => map.zones[zone]?.label ?? zone;
  const places = [];
  for (const feature of map.features ?? []) {
    const look = config.places[feature.kind];
    if (!look || feature.kind === 'kiosk') continue;
    const p = feature.position;
    const gun = look.label === 'weapon' ? weapons[feature.weapon]?.name ?? null : null;
    places.push({
      kind: feature.kind, x: p.x, z: p.z, floor: floorAt(p.y), zone: feature.zone, area: zoneLabel(feature.zone),
      label: gun, name: gun ?? look.name ?? look.legend,
    });
  }
  const groups = [];
  for (const [i, group] of config.index.entries()) {
    const members = places.filter((place) => group.kinds.includes(place.kind))
      .sort((a, b) => a.floor - b.floor || a.x - b.x || a.z - b.z);
    const entries = [];
    for (const place of members) {
      let entry = entries.find((e) => e.kind === place.kind && e.name === place.name && e.zone === place.zone);
      if (!entry) entries.push(entry = { kind: place.kind, name: place.name, zone: place.zone, area: place.area, floor: place.floor, count: 0 });
      entry.count++;
      place.entry = entry;
    }
    if (entries.length) groups.push({ id: group.id ?? `group${i}`, title: group.title, entries });
  }
  let n = 0;
  for (const group of groups) for (const entry of group.entries) entry.n = ++n;
  for (const place of places) place.n = place.entry?.n ?? null;
  return { floors, shutters, openings, places, index: groups, floorAt, zoneLabel };
}

/**
 * What the board shows right now. `g` = the game (createGame), `guidance` = the run shows Closing Time help (Directed).
 * Returns { you: { x, z, yaw, floor, area }, open: Set of bought zones, shutters: [{ ...shutter, price }] (shut ones only),
 *           kevin: { x, z, floor, area } | null, keys: [{ x, z, floor }] }.
 */
export function minimapState(plan, g, { guidance = false } = {}) {
  const { map, player } = g;
  const open = new Set(Object.keys(map.zones).filter((id) => map.zones[id].open));
  const shutters = [];
  for (const shutter of plan.shutters) {
    if (shutter.door.isOpen) continue;
    const destination = map.areaUnlocks?.destination(shutter.door) ?? null; // (null: neither side bought, or both)
    shutters.push({ ...shutter, price: destination ? g.pricing.priceOf('door', destination) : null });
  }
  const kiosk = g.features?.instanceOf('kiosk');
  const cart = kiosk?.status.open ? kiosk.site.cart.position : null;
  const activeSale = g.flashSales?.active ?? (g.flashSales?.pending ? { ...g.flashSales.pending, soon: true } : null);
  const sales = activeSale
    ? collectSaleSpots({
      map,
      features: g.features,
      gun: g.gun,
      warranty: g.warranty,
      wardrobe: g.wardrobe,
      equipment: g.equipment,
      health: g.health,
    }, activeSale).map((spot) => ({
      x: spot.x,
      z: spot.z,
      floor: plan.floorAt(spot.y + 0.1),
      category: spot.category,
      id: spot.id,
      zone: spot.zone,
      doorbuster: spot.doorbuster,
      soon: spot.soon,
    }))
    : [];
  return {
    you: {
      x: player.position.x, z: player.position.z, yaw: player.yaw, floor: plan.floorAt(player.position.y + 0.1),
      area: (() => { const zone = map.areaAt?.(player.position); return zone ? plan.zoneLabel(zone) : null; })(),
    },
    open,
    shutters,
    sales,
    kevin: cart && { x: cart.x, z: cart.z, floor: plan.floorAt(cart.y), area: plan.zoneLabel(kiosk.site.zone) },
    keys: guidance ? (g.closing?.pickups ?? []).map(({ position }) => ({ x: position.x, z: position.z, floor: plan.floorAt(position.y) })) : [],
  };
}
