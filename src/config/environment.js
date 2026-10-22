// Decorative lighting only; fixed lights, no flicker or gameplay effects.
export const startRoomLighting = [
  { name: 'checkout_warm', color: 0xffce8c, intensity: 9, distance: 8, x: -2.9, y: 2.5, z: 7.2 },
  { name: 'shutter_cool', color: 0xbddcff, intensity: 7, distance: 7, x: 1, y: 2.7, z: 1.8 },
];

// Replaces the Mart's two existing lamps; no additional lights, shadows or flashing.
export const megaMartLighting = [
  { name: 'mart_checkout_light', color: 0xffead0, intensity: 8, distance: 15, x: 27.5, y: 3, z: 0 },
  { name: 'mart_aisle_light', color: 0xdcecff, intensity: 8, distance: 18, x: 27.5, y: 3, z: -15 },
];
