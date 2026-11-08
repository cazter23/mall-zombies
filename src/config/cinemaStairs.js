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
  // Set dressing on the flight's west wall (maps/mall/cinemaStairs.js dressCinemaStairs): two wayfinding stripes that follow
  // the stairs (heights above the treads), a level mark on each landing's end wall, and notices kept clear above the stripes.
  dressing: {
    stripes: [{ color: 0x2ec4b6, low: 1.42, high: 1.54 }, { color: 0xff6f91, low: 1.6, high: 1.66 }],
    posterClearance: 1.85, // a poster's lowest corner at least this far above the treads under it
    levels: [
      { text: 'LEVEL 2 · CINEMA', wall: 'south', height: 1.75, width: 2.6 },
      { text: 'LEVEL 1 · SERVICE', wall: 'north', height: 1.75, width: 2.6 },
    ],
    posters: [
      { kind: 'notice', z: .6, width: 1.1, height: .82,
        options: { title: 'Stairwell rules', body: 'No loitering. No running. No leaving. Hold the rail: it is all we have.', header: '#2ec4b6', typeface: 'utility' } },
      { kind: 'employee', z: 3.9, width: 1.2, height: .8, options: { months: ['AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN'] } },
    ],
  },
  // Painted light follows Neon glow, without adding real lights to the pool
  // or changing the horror director's existing lamp-death schedule.
  lightPools: [
    { x: -45.97, y: 5.5, z: .7, width: 4, height: 3, facing: 'x+', color: '#f3d9b0', opacity: .12 },
    { x: -32.5, y: .015, z: 8.6, width: 16, height: 2.7, facing: 'floor', color: '#a9d5cb', opacity: .12 },
    { x: -32.5, y: 2, z: 10.06, width: 16, height: 1.8, facing: -1, color: '#a9d5cb', opacity: .10 },
  ],
};
