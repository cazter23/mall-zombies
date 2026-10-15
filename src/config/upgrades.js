// =============================================================================
// GUN UPGRADES CONFIG: Extended Warranty tiers + store attachments (prices: economy.js `upgrades`).
// Separate from Build-A-Blaster (the one special mod per gun, later). Upgrades belong to the CARRIED gun:
// they stay through ammo buys and go when the gun is replaced or the run ends.
//
// Both are described with EFFECTS (multipliers on what the gun does), not raw stat paths, because guns
// store the same idea differently (the Confetti Cannon reloads shell by shell, the Nail Gun has no
// falloff...). weapons/upgrades.js turns effects into the exact stat changes for one gun.
//
// EFFECTS (all multipliers; 1 = unchanged):
//   damage        damage per hit (per pellet / dart / nail)
//   magazine      magazine size (rounded to a whole number; burst guns to whole bursts)
//   reload        reload time (shell-by-shell: every phase)
//   falloffRange  where damage starts and stops falling off (> 1 = carries further); needs a gun with falloff
//   hipSpread     hip-fire cone (bloom, movement, air, and a pellet gun's cone) WITHOUT changing aimed accuracy
//   adsSpread     accuracy while aiming down sights (< 1 = tighter)
//   adsTime       time to aim in/out
//   zoom          camera FOV while aimed (< 1 = more zoom)
//   recoil        camera kick + gun-model kick
// =============================================================================

export const upgrades = {
  // EXTENDED WARRANTY: bought one tier at a time at the Customer Service desk, for the gun in your hand.
  // Each tier lets a gun kill in the same number of shots as a plain gun does at round 8, up to
  // `holdsUntilRound` (tests/upgrades.test.js checks that against economy's zombie health).
  tiers: [
    { id: 'standard', name: 'Standard', color: 0x5fd068, effects: {}, holdsUntilRound: 8 }, // every gun starts here
    { id: 'deluxe', name: 'Deluxe', color: 0x4aa3ff, effects: { damage: 1.4, magazine: 1.15 }, holdsUntilRound: 12 },
    { id: 'premium', name: 'Premium', color: 0xb36bff, effects: { damage: 2.1, magazine: 1.15, reload: 0.9 }, holdsUntilRound: 17 },
    { id: 'platinum', name: 'Platinum', color: 0xffc83d, effects: { damage: 3.5, magazine: 1.3, reload: 0.8 }, holdsUntilRound: 24 },
  ],

  // STORE ATTACHMENTS: one per slot, each sold at its store's counter. A small upside with a small
  // downside; buying another one for the same slot replaces it. `fits` is worked out per gun (an
  // attachment that would do nothing on a gun isn't offered for it).
  attachmentSlots: {
    barrel: { name: 'Barrel', store: 'Mega Mart hardware' },
    sight: { name: 'Sight', store: 'Byte Me Electronics' },
    grip: { name: 'Grip', store: 'Good Sports' },
    magazine: { name: 'Magazine', store: 'Play Time Toys' },
  },
  attachments: {
    extendedNozzle: {
      slot: 'barrel', name: 'Extended Nozzle', blurb: 'Hits hard further out; slower to aim',
      effects: { falloffRange: 1.4, adsTime: 1.15 },
    },
    sawnOff: {
      slot: 'barrel', name: 'Sawn-Off', blurb: 'More damage up close; drops off sooner',
      effects: { damage: 1.12, falloffRange: 0.7 },
      // On a gun with no falloff (the Nail Gun) it adds this one instead.
      falloffIfNone: { start: 12, end: 30, minMultiplier: 0.7 },
    },
    laserPointer: {
      slot: 'sight', name: 'Laser Pointer', blurb: 'Tighter hip fire; looser when aimed',
      effects: { hipSpread: 0.75, adsSpread: 1.25 },
    },
    zoomLens: {
      slot: 'sight', name: 'Zoom Lens', blurb: 'More zoom, tighter aim; slower to aim',
      effects: { zoom: 0.9, adsSpread: 0.8, adsTime: 1.2 },
    },
    gripTape: {
      slot: 'grip', name: 'Grip Tape', blurb: 'Less recoil; slower to aim',
      effects: { recoil: 0.75, adsTime: 1.1 },
    },
    wristband: {
      slot: 'grip', name: 'Wristband', blurb: 'Faster to aim; more recoil',
      effects: { adsTime: 0.8, recoil: 1.2 },
    },
    jumboPack: {
      slot: 'magazine', name: 'Jumbo Pack', blurb: 'Bigger magazine; slower reload',
      effects: { magazine: 1.3, reload: 1.15 },
    },
    speedLoader: {
      slot: 'magazine', name: 'Speed Loader', blurb: 'Faster reload; smaller magazine',
      effects: { reload: 0.75, magazine: 0.8 },
    },
  },
};
