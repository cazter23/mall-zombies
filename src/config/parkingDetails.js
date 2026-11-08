// Authored dressing, in metres. Scenes live behind the RV row, leaving the front
// fighting lane, the two main gaps and every perimeter spawn approach open.
export const parkingDetails = {
  seed: 861026, textureSize: 1024,
  wear: {
    cracks: 23, skidMarks: [[39.5, -5.8, 4.2, .12], [56.8, -18.3, 3.4, -.15]],
    patches: [[38.8, -10, 1.4, 2.1], [59, -17.4, 2.2, 1.5], [46.8, -5, 2.6, 1.2]],
    puddles: [[38.8, -18, 1.5, .7], [60.4, -12.3, .7, 1.5], [51, -16.8, 1.4, .55]],
    drains: [[37.8, -21.6], [60.6, -19.8]],
    weeds: [[37.4, -23.3], [41, -23.5], [58, -23.5], [61.6, -17], [61.6, -10], [61.6, 3.8]],
  },
  scenes: {
    shopping: { x: 42.5, z: -15.2, width: 1.2, depth: 1.5 },
    delivery: { x: 48.1, z: -15.7, width: 1.3, depth: 1.2 },
    waiting: { x: 56.1, z: -15.7, width: 1.5, depth: 1.5 },
  },
  // What makes it a real mall car park (maps/mall/parkingDetails.js realism): the accessible bay nearest the door, a cart
  // corral with two strays, row letters and campaign banners on the light poles, a planted kerb island at the row's end,
  // and a glass entrance vestibule round the Mega Mart door (side walls solid, the front open).
  realism: {
    accessibleBay: 1, // bay index (0 = the westmost); painted at y
    accessibleY: .004,
    // (bay 5: the empty east bay; the gaps between the vans are combat lanes, tests/parkingLot.test.js)
    corral: { bay: 5, length: 2.8, width: 1.1, height: 1.0, carts: [[58.6, -10.4, Math.PI], [57.5, -13.4, 2.6]] },
    rowLetters: ['C', 'A'], // on the two light poles, in order
    poleBanner: { width: .55, height: 1.25, y: 4.1, out: .18 },
    island: { minX: 37.6, maxX: 39.3, minZ: -14.9, maxZ: -7.2, kerb: .15, tree: [38.45, -11] },
    vestibule: { minX: 34.45, maxX: 36.25, minZ: .3, maxZ: 4.7, height: 2.8, roof: .15 },
  },
  facade: {
    downpipes: [-22.6, -6.5, 5.4],
    vents: [{ z: -18.8, y: 3, width: 1.2, height: .6 }, { z: -4.5, y: 2.6, width: .8, height: .5 }],
    cabinet: { x: 34.7, z: -20.6, width: .32, depth: .75, height: 2.2 },
    cameras: [{ z: -1.2, y: 3.8 }, { z: -21.3, y: 4.2 }],
    notices: [{ z: -17, text: 'DELIVERIES 06:00–08:00', sub: 'DRIVERS MUST SIGN IN' },
      { z: -.2, text: 'CCTV IN OPERATION', sub: 'MANAGEMENT IS ALWAYS WATCHING' }],
    roofUnits: [[34.65, 5.8, -19.4], [34.65, 5.8, -14.2]],
    // A faded painted advert from opening year, between the vents and the downpipe. Posters are unlit, so these are the
    // wall's colour AT DUSK (as rendered), barely lighter: paint that has nearly gone, not a lit billboard.
    ghostSign: { z: -11.4, y: 2.45, width: 8, height: 2, text: 'SUNSET GALLERIA', sub: 'GRAND OPENING · FALL 1986',
      wall: '#806b5e', ink: '#a08878' },
  },
  vehicle: {
    plates: ['SUN-086', 'SAME-DAY', 'RV-4EVER'],
    stickers: ['LAKE SUNSET', 'GALLERIA REWARDS', 'WE WERE HERE'],
    curtain: [0xceb994, 0xaaa2a1, 0xc39aaa],
  },
  street: {
    busStop: { x: 68.4, z: 17, width: 1.7, length: 4.2, height: 2.6 },
    bins: [[67.8, 20], [83, -10], [83, 12]],
    roadworks: { x: 76.8, z: -39.8, width: 2.5, length: 4 },
    stoppedCar: { x: 74, z: -25, yaw: -.17 },
    streetNames: { x: 69, z: -26.5 },
  },
  atmosphere: {
    lampPoolOpacity: .16, coolPoolOpacity: .10,
    haze: [{ x: 106, z: -5, width: 130, height: 9, opacity: .12 },
      { x: 117, z: -5, width: 130, height: 12, opacity: .16 }],
    sign: { x: 62.1, y: 2.5, z: -18.3, radians: .025, period: 8 },
  },
  ambience: [
    { id: 'parking_traffic', kind: 'distantTraffic', zone: 'parkingLot', position: [76, 2, -10], range: 65,
      gain: .25, pulse: { period: 19, depth: .65 } },
    { id: 'parking_tree_rustle', kind: 'treeRustle', zone: 'parkingLot', position: [64.5, 3, -5], range: 20,
      gain: .45, pulse: { period: 11, depth: .35 } },
    { id: 'parking_exit_speaker', kind: 'music', zone: 'parkingLot', position: [34.15, 2.6, 2.5], range: 12, gain: .7 },
    { id: 'parking_power_box', kind: 'fluorescentBuzz', zone: 'parkingLot', position: [35, 1.5, -20.6], range: 8, gain: .4 },
  ],
  ambientEvents: [
    { id: 'parking_loose_sign', sound: 'looseSignRattle', zone: 'parkingLot', position: [62, 2.5, -18.3], range: 23,
      minSeconds: 18, maxSeconds: 32, gain: .45 },
    { id: 'parking_muffled_pa', sound: 'distantPa', zone: 'parkingLot', position: [34.15, 2.6, 2.5], range: 16,
      minSeconds: 24, maxSeconds: 48, gain: .4 },
    { id: 'parking_distant_car', sound: 'distantTrafficPass', zone: 'parkingLot', position: [76, 1.5, -20], range: 65,
      minSeconds: 35, maxSeconds: 62, gain: .2 },
  ],
};
