// =============================================================================
// DOOR
// A buyable barrier between two zones (COD "door"). Wraps whatever physically
// blocks the way (for now a roll-up shutter, world/shutter.js) and the zone it
// unlocks. Opening it is permanent for the run; resetting closes it again.
// Maps create doors; the interaction system (step 4 part C) sells them.
// =============================================================================

/**
 * @param id         stable id, e.g. 'startShutter'
 * @param label      shown in prompts, e.g. 'Security Shutter'
 * @param price      points to open
 * @param opensZone  zone id unlocked when opened
 * @param zones      the map's zone table: { [zoneId]: { open: boolean } }
 * @param barrier    the thing that blocks the way; needs open(), close(), update(dt)
 * @param position   THREE.Vector3 where the player interacts with it
 */
export function createDoor({ id, label, price, opensZone, zones, barrier, position }) {
  let isOpen = false;

  return {
    id,
    label,
    price,
    opensZone,
    position,
    barrier,

    get isOpen() {
      return isOpen;
    },

    open() {
      if (isOpen) return;
      isOpen = true;
      zones[opensZone].open = true;
      barrier.open();
    },

    // Debug only (doors stay open once bought).
    toggle() {
      if (isOpen) this.reset();
      else this.open();
    },

    // Closed again, zone locked again (new run).
    reset() {
      isOpen = false;
      zones[opensZone].open = false;
      barrier.close();
    },

    update(dt) {
      barrier.update(dt);
    },
  };
}
