// =============================================================================
// WEAPONS CONFIG
// Stats for every weapon. Logic in src/weapons/ reads these; never hardcode
// weapon numbers anywhere else. Player-side multipliers (perks, wardrobe) live
// in the stats object (src/player/stats.js), not here.
// =============================================================================

export const weapons = {
  // Starting pistol. Hitscan: the shot lands instantly where the crosshair points.
  stapleGun: {
    id: 'stapleGun',
    name: 'Staple Gun',
    damage: 40, // per body hit. Round-1 zombie (150 HP): 4 body shots or 2 headshots
    headshotMultiplier: 3,
    magazineSize: 12,
    startingReserve: 60, // spare staples you start with
    fireInterval: 0.12, // seconds between shots; semi-auto, one shot per click
    fireBuffer: 0.1, // seconds a click is remembered if it comes slightly too early
    reloadTime: 1.5, // seconds
    range: 100, // meters
    viewKickDegrees: 1.2, // camera kicks up this much per shot, then recovers

    // Visuals
    tracerColor: 0xe8eef5, // silver staple streak
    viewmodel: {
      bodyColor: 0xd62839, // classic red staple gun
      metalColor: 0x9aa0a8,
      gripColor: 0x2b2b2b,
      sightColor: 0xffd23f,
    },
  },
};

// Defaults for the player-side weapon multipliers in the stats object.
export const weaponStatDefaults = {
  damageMultiplier: 1, // all weapon damage is multiplied by this
  reloadSpeed: 1, // reload time is divided by this (2 = twice as fast)
};
