// =============================================================================
// DOOR
// A barrier between zones (COD "door"). Wraps whatever physically
// blocks the way (for now a roll-up shutter, world/shutter.js) and the zone(s) it
// unlocks. Opening is permanent for the run. Mall purchases are coordinated by
// areaUnlocks.js, which opens a barrier only after both endpoints are owned.
//
// Several doors may open the SAME zone (e.g. a food court reachable from two
// sides): for low-level geometry/debug callers, the zone counts as open while at
// least one of its doors is open, and only locks again when all are closed.
// =============================================================================

// zone object -> Set of the door ids currently holding it open. Kept outside the zone
// objects so the map's zone table stays a plain { label, open } per zone.
const openedBy = new WeakMap();

// Debug group toggle: a partly bought map opens completely; only an entirely open map closes.
// Toggling doors individually would close purchased entrances and lock their shops.
export function toggleDoors(doors) {
  const shouldOpen = doors.some((door) => !door.isOpen);
  const areas = doors[0]?.areaUnlocks;
  if (areas) {
    if (shouldOpen) areas.openAll();
    else areas.reset();
    return;
  }
  for (const door of doors) {
    if (shouldOpen) door.open();
    else door.reset();
  }
}

function holders(zone) {
  if (!openedBy.has(zone)) openedBy.set(zone, new Set());
  return openedBy.get(zone);
}

/**
 * @param id         stable id, e.g. 'startShutter' (unique per map)
 * @param label      shown in prompts, e.g. 'Security Shutter'
 * @param price      points to open
 * @param opensZone  legacy single zone id unlocked when opened
 * @param opensZones optional zone ids unlocked together (takes precedence)
 * @param zones      the map's zone table: { [zoneId]: { open: boolean } }
 * @param barrier    the thing that blocks the way; needs open(), close(), update(dt), and `collider` (the buy prompt sees through it)
 * @param verb       what buying it is called in the prompt (default 'open'; the escalator says 'repair')
 * @param position   THREE.Vector3 where the player interacts with it
 */
export function createDoor({ id, label, price, opensZone, opensZones, zones, barrier, position, verb = 'open' }) {
  const zoneIds = [...new Set(opensZones ?? [opensZone])];
  if (!zoneIds.length) throw new Error(`Door "${id}" must open at least one zone`);
  const openedZones = zoneIds.map((zoneId) => {
    if (!Object.hasOwn(zones, zoneId)) throw new Error(`Door "${id}" opens unknown zone "${zoneId}"`);
    return zones[zoneId];
  });
  let isOpen = false;

  return {
    id,
    label,
    price,
    opensZone,
    opensZones: zoneIds,
    position,
    barrier,
    verb,

    get isOpen() {
      return isOpen;
    },

    open() {
      if (isOpen) return;
      isOpen = true;
      for (const zone of openedZones) {
        holders(zone).add(id);
        zone.open = true;
      }
      barrier.open();
    },

    // Debug only (doors stay open once bought).
    toggle() {
      if (isOpen) this.reset();
      else this.open();
    },

    // New run/debug close: each zone locks unless another door still holds it open.
    reset() {
      isOpen = false;
      for (const zone of openedZones) {
        const held = holders(zone);
        held.delete(id);
        zone.open = held.size > 0;
      }
      barrier.close();
    },

    update(dt) {
      barrier.update(dt);
    },
  };
}
