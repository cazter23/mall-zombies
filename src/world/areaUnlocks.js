// Area ownership controls purchases; barriers only control physical connections.
// Opening a connection never grants ownership of its other endpoint.
export function createAreaUnlocks({ zones, doors, connections }) {
  const initiallyOpen = new Set(Object.keys(zones).filter(id => zones[id].open));
  for (const door of doors) {
    const endpoints = connections[door.id];
    if (!endpoints || endpoints.length !== 2 || endpoints.some(id => !Object.hasOwn(zones, id))) {
      throw new Error(`Invalid area connection: ${door.id}`);
    }
    door.connectsZones = endpoints;
  }

  function destination(door) {
    if (door.isOpen) return null;
    const [a, b] = door.connectsZones;
    if (zones[a].open === zones[b].open) return null;
    return zones[a].open ? b : a;
  }

  // instant: every barrier snaps open (a loaded save). bought: the id of the door the player paid at; every OTHER
  // barrier this opens is a free connection and gets the light show (world/shutter.js).
  function unlock(id, { instant = false, bought = null } = {}) {
    if (!Object.hasOwn(zones, id)) throw new Error(`Unknown area: ${id}`);
    zones[id].open = true;
    const opened = [];
    for (const door of doors) {
      if (!door.isOpen && door.connectsZones.every(area => zones[area].open)) {
        door.open({ instant, light: bought !== null && door.id !== bought });
        opened.push(door.id);
      }
    }
    return opened;
  }

  const controller = {
    destination,
    unlock,
    openAll() {
      for (const id of Object.keys(zones)) unlock(id);
    },
    reset() {
      for (const door of doors) door.reset();
      for (const [id, zone] of Object.entries(zones)) zone.open = initiallyOpen.has(id);
    },
  };
  for (const door of doors) door.areaUnlocks = controller;
  return controller;
}
