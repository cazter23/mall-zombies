// Spatial queries belong to the map interface. Ownership stays in areaUnlocks;
// temporary encounters receive the physical shutters only (never escalator gates).
export const zoneForRoom = id => ['level2', 'shoePer', 'workshop', 'workshopHall'].includes(id) ? 'upstairs'
  : id.startsWith('cinema') ? 'cinema' : id;

export function createAreaQueries(map) {
  function areaAt(point) {
    const rooms = (map.cullAreas ?? []).filter(r => point.x >= r.minX && point.x <= r.maxX
      && point.z >= r.minZ && point.z <= r.maxZ && point.y >= (r.minY ?? -Infinity) && point.y <= (r.maxY ?? Infinity)
      && map.zones[zoneForRoom(r.id)]?.open);
    // Upper-storey rooms win over a tall ground-floor room with overlapping bounds.
    rooms.sort((a, b) => (b.minY ?? -Infinity) - (a.minY ?? -Infinity)
      || (a.maxX-a.minX)*(a.maxZ-a.minZ) - (b.maxX-b.minX)*(b.maxZ-b.minZ));
    if (rooms.length) return zoneForRoom(rooms[0].id);
    return map.spawnPoints.filter(p => map.zones[p.zone]?.open)
      .sort((a,b) => a.position.distanceToSquared(point) - b.position.distanceToSquared(point))[0]?.zone ?? null;
  }
  return {
    areaAt,
    barriersAround(areaOrPoint) {
      const area = typeof areaOrPoint === 'string' ? areaOrPoint : areaAt(areaOrPoint);
      return map.doors.filter(d => d.barrier.kind === 'shutter' && d.connectsZones?.includes(area));
    },
  };
}
