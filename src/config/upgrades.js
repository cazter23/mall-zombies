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
  // EXTENDED WARRANTY: bought one tier at a time at the Customer Service desk, for the gun in your hand. The SUPPORT upgrade: a Build-A-Blaster build
  // (config/workshop.js qualities) is the big one, so a warranty keeps any gun relevant and stacks with a build.
  // Each tier lets a gun kill in the same number of shots as a plain gun does at round 8, up to
  // `holdsUntilRound` (tests/upgrades.test.js checks that against economy's zombie health).
  // Each tier has a JOB: Deluxe is handling (a bigger magazine and a quicker reload), Premium is damage, Platinum is more damage plus a claim.
  // `claim`: once per round, a gun that runs completely dry gets its ammo replaced for free (game/warranty.js).
  tiers: [
    { id: 'standard', name: 'Standard', color: 0x6b7280, effects: {}, holdsUntilRound: 8 }, // every gun starts here
    { id: 'deluxe', name: 'Deluxe', job: 'Handling', color: 0xb9bec6, effects: { damage: 1.1, magazine: 1.25, reload: 0.85 }, holdsUntilRound: 9 },
    { id: 'premium', name: 'Premium', job: 'Damage', color: 0xdf9f1f, effects: { damage: 1.45, magazine: 1.1 }, holdsUntilRound: 12 },
    { id: 'platinum', name: 'Platinum', job: 'Damage and claims', color: 0xf2eefc, effects: { damage: 1.65, magazine: 1.15, reload: 0.9 }, holdsUntilRound: 14, claim: true },
  ],

  // WARRANTY RENEWALS: past Platinum, bought again and again at the Customer Service desk (prices: economy.js upgrades.renewals). Each one multiplies
  // the gun's damage and magazine a little more, so points still matter late in a run.
  renewals: { max: 5, effects: { damage: 1.06, magazine: 1.03 }, color: 0xd9885a },

  // TRANSFER: a warranty left behind by a gun you replaced stays on file; the desk moves it onto the gun in hand for this share of that tier's price.
  transfer: { feeFraction: 0.25 },

  // What the warranty says (PA lines; {gun} is the gun's name).
  claimPa: { kicker: 'Customer Service', text: 'Warranty claim approved for your {gun}. Ammunition has been replaced. Terms apply.' },

  // STORE ATTACHMENTS: one per slot. First purchase unlocks free fitting at that store for the run;
  // fitting another attachment in the same slot replaces it. `fits` is worked out per gun (an
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
      effects: { falloffRange: 1.6, adsTime: 1.1 },
    },
    sawnOff: {
      slot: 'barrel', name: 'Sawn-Off', blurb: 'More damage up close; drops off sooner',
      effects: { damage: 1.2, falloffRange: 0.65 },
      // On a gun with no falloff (the Nail Gun) it adds this one instead.
      falloffIfNone: { start: 8, end: 22, minMultiplier: 0.65 },
    },
    laserPointer: {
      slot: 'sight', name: 'Laser Pointer', blurb: 'Tighter hip fire; aimed accuracy unchanged',
      effects: { hipSpread: 0.65 },
    },
    zoomLens: {
      slot: 'sight', name: 'Zoom Lens', blurb: 'More zoom, tighter aim; slower to aim',
      effects: { zoom: 0.9, adsSpread: 0.65, adsTime: 1.1 },
    },
    gripTape: {
      slot: 'grip', name: 'Grip Tape', blurb: 'Less recoil for controlled sustained fire',
      effects: { recoil: 0.65 },
    },
    wristband: {
      slot: 'grip', name: 'Wristband', blurb: 'Faster to aim; more recoil',
      effects: { adsTime: 0.7, recoil: 1.1 },
    },
    jumboPack: {
      slot: 'magazine', name: 'Jumbo Pack', blurb: 'Bigger magazine; slower reload',
      effects: { magazine: 1.5, reload: 1.2 },
    },
    speedLoader: {
      slot: 'magazine', name: 'Speed Loader', blurb: 'Faster reload; smaller magazine',
      effects: { reload: 0.65, magazine: 0.9 },
    },
  },
};
