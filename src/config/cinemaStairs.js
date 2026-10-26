// Cinema's west exit -> a service stairwell -> the Service Corridor's north end.
// Heights are absolute. The flight uses the existing ramp/navigation system.
export const cinemaStairs = {
  shaft: { minX: -46, maxX: -42.3, minZ: -8.8, maxZ: 10.1 },
  upperLandingEnd: -5.6,
  lowerLandingStart: 7.1,
  landingRun: .8,
  wallThickness: .3,
  corridorHeight: 3.5,
  treadCount: 36,
  supportClearance: .4,
  returnHall: { minX: -42.3, maxX: -23.3, minZ: 7.1, maxZ: 10.1 },
  connector: { minX: -23.3, maxX: -20.3, minZ: 3.5, maxZ: 10.1 },
  serviceDoor: { from: -23.1, to: -20.5, at: 3.5, top: 2.8, runAt: 1.5 },
  sharedHallwayWallEnd: 6.3,
  colors: { wall: 0xa4a7a3, base: 0x68666d, step: 0x9a9690, edge: 0xc5a36c, exit: 0x87c3ad },
  ambience: [{ id: 'cinema_service_fan', kind: 'ventilation', zone: 'cinema', position: [-33, 3, 8.6], range: 13 }],
  // Painted light follows Neon glow, without adding real lights to the pool
  // or changing the horror director's existing lamp-death schedule.
  lightPools: [
    { x: -45.97, y: 5.5, z: .7, width: 4, height: 3, facing: 'x+', color: '#f3d9b0', opacity: .12 },
    { x: -32.5, y: .015, z: 8.6, width: 16, height: 2.7, facing: 'floor', color: '#a9d5cb', opacity: .12 },
    { x: -32.5, y: 2, z: 10.06, width: 16, height: 1.8, facing: -1, color: '#a9d5cb', opacity: .10 },
  ],
};
