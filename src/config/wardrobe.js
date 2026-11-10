// Per-run apparel. Locations are [x, z] on the zone's floor, facing into the aisle.
// An item is DATA: `factors` multiply the player's stats while it is worn (game/wardrobe.js, the only code that applies them).
// `ticket` is the joke line on the shelf ticket. WORDS ONLY (config/effectWords.js): the player never sees a factor. What the item does is the
// `lines` next to it, one short line per upside or downside, `effect` = the factor whose size fills {size}; an upside or a downside is worked out
// from the factor's direction and `statBetter` below.
// `color` (the item's signature colour) and `icon` (an id the HUD draws in SVG, ui/outfitIcons.js) are for the outfit rail and the showpieces.
// `pulse` names the trigger that makes the item's tag on the outfit rail swing and flash (game/outfitRail.js `triggers` has one entry per name).
export const wardrobeSlots = { head: 'Head', torso: 'Torso', feet: 'Feet', accessory: 'Accessory' };

export const wardrobeItems = {
  paperHat: {
    slot: 'head', name: 'Burger Barn Paper Hat', shortName: 'Paper Hat',
    factors: { regenDelay: 0.8, reloadSpeed: 0.92 }, ticket: 'You smell like a shift you survived.',
    color: 0xf2542d, icon: 'hat', pulse: 'regenStart',
    lines: [{ effect: 'regenDelay', text: 'Healing starts {size} sooner' }, { effect: 'reloadSpeed', text: 'Reloads {size} slower' }],
    zone: 'foodCourt', at: [-5.75, -13], facing: 1,
    // Showpiece (maps/mall/wardrobeShowpieces/): its mall PA line when bought, and the audio.js sound it hums while unsold.
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Burger Barn Paper Hat. Burger Barn would like the hat back.' },
    motif: 'motifPaperHat',
  },
  aviators: {
    slot: 'head', name: 'Mirrored Aviators', shortName: 'Aviators',
    factors: { adsTimeMultiplier: 0.7, aimAssistMultiplier: 1.2, switchSpeed: 0.85 }, ticket: 'Too cool to hurry.',
    color: 0xbfd4e6, icon: 'aviators', pulse: 'aimStart',
    lines: [{ effect: 'adsTimeMultiplier', text: 'Aims {size} faster' }, { effect: 'aimAssistMultiplier', text: 'Aim assist {size} stronger' }, { effect: 'switchSpeed', text: 'Swaps weapons {size} slower' }],
    zone: 'atrium', at: [25.65, 14.52], facing: 'x-',
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Mirrored Aviators. Please aim those things away from the skylight.' },
    motif: 'motifAviators',
  },
  glasses: {
    slot: 'head', name: '3D Glasses', shortName: '3D Glasses',
    factors: { headshotDamageMultiplier: 1.25, adsMoveSpeed: 0.85 }, ticket: 'The floor is closer than it appears.',
    color: 0x29c4f0, icon: 'glasses3d', pulse: 'headshot',
    lines: [{ effect: 'headshotDamageMultiplier', text: '{Size} more headshot damage' }, { effect: 'adsMoveSpeed', text: 'Moves {size} slower while aiming' }],
    zone: 'cinema', at: [-40.9, 0.5], facing: 'x+',
  },
  cardigan: {
    slot: 'torso', name: "Hoffman's Heirloom Cardigan", shortName: 'Cardigan',
    factors: { maxHealth: 1.25, sprintDuration: 0.8 }, ticket: 'Some are still warm.',
    color: 0xa8553a, icon: 'cardigan', pulse: 'hitCushioned',
    lines: [{ effect: 'maxHealth', text: '{Size} more health' }, { effect: 'sprintDuration', text: 'Sprints {size} shorter' }],
    zone: 'departmentStore', at: [-15.5, 11.48], facing: -1,
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Heirloom Cardigan. Some are still warm.' },
    motif: 'motifCardigan',
  },
  sandwichBoard: {
    slot: 'torso', name: 'EVERYTHING MUST GO Sandwich Board', shortName: 'Sandwich Board',
    factors: { damageTakenMultiplier: 0.8, knockbackMultiplier: 0.5, strafeSpeed: 0.85 },
    ticket: 'Covers the front and back. The sides are your problem.',
    color: 0xff3ea5, icon: 'board', pulse: 'playerHit',
    lines: [{ effect: 'damageTakenMultiplier', text: 'Zombie hits hurt {size} less' }, { effect: 'knockbackMultiplier', text: 'Shoved {size} less' }, { effect: 'strafeSpeed', text: 'Strafes {size} slower' }],
    zone: 'megaMart', at: [24.13, 2.75], facing: 'x-',
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Sandwich Board. Please advertise responsibly.' },
    motif: 'motifSandwichBoard',
  },
  hiVisVest: {
    slot: 'torso', name: 'Hi-Vis Vest', shortName: 'Hi-Vis Vest',
    factors: { reloadSpeed: 1.25, damageTakenMultiplier: 1.25 }, ticket: 'Nobody questions a vest. Everybody can see one.',
    color: 0xd7ff2f, icon: 'vest', pulse: 'playerHit',
    lines: [{ effect: 'reloadSpeed', text: 'Reloads {size} faster' }, { effect: 'damageTakenMultiplier', text: 'Zombie hits hurt {size} more' }],
    zone: 'serviceCorridor', at: [-22.84, -8.46], facing: 'x+',
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Hi-Vis Vest. Management can see you now.' },
    motif: 'motifHiVisVest',
  },
  lightUpSneakers: {
    slot: 'feet', name: 'Light-Up Sneakers', shortName: 'Light-Ups',
    factors: { sprintSpeed: 1.1, sprintDuration: 0.9 }, ticket: "Every step says you're here.",
    color: 0xb44dff, icon: 'sneaker', pulse: 'sprintStart',
    lines: [{ effect: 'sprintSpeed', text: 'Sprints {size} faster' }, { effect: 'sprintDuration', text: 'Sprints {size} shorter' }],
    zone: 'upstairs', at: [-10, 8.5], facing: 'x+',
  },
  orthopedicWalkers: {
    slot: 'feet', name: 'Orthopedic Mall Walkers', shortName: 'Orthopedics', // (not "Mall Walkers": that is a zombie)
    factors: { sprintDuration: 1.35, sprintRefillDelay: 0.7, sprintSpeed: 0.95 },
    ticket: 'Recommended by the people chasing you.',
    color: 0xd8cbb0, icon: 'walker', pulse: 'sprintStart',
    lines: [{ effect: 'sprintDuration', text: 'Sprints {size} longer' }, { effect: 'sprintRefillDelay', text: 'Sprint recovers {size} sooner' }, { effect: 'sprintSpeed', text: 'Sprints {size} slower' }],
    zone: 'upstairs', at: [-4, 8.5], facing: 'x-',
  },
  wheelieSneakers: {
    slot: 'feet', name: 'Wheelie Sneakers', shortName: 'Wheelies',
    factors: { slideSpeed: 1.15, slideCooldown: 0.7, backpedalSpeed: 0.85 },
    ticket: 'Stopping sold separately.',
    color: 0xff8a1f, icon: 'wheelie', pulse: 'slideStart',
    lines: [{ effect: 'slideSpeed', text: 'Slides {size} faster' }, { effect: 'slideCooldown', text: 'Slides again {size} sooner' }, { effect: 'backpedalSpeed', text: 'Backs up {size} slower' }],
    zone: 'foodCourt', at: [-10.1, -12], facing: 1, // (the court floor in front of Good Sports' east window: the old spot was inside the shop)
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Wheelie Sneakers. Walking is now optional. Stopping is not offered.' },
    motif: 'motifWheelie',
  },
  fannyPack: {
    slot: 'accessory', name: 'Fanny Pack', shortName: 'Fanny Pack',
    factors: { reserveMultiplier: 1.25, switchSpeed: 0.9 }, ticket: "Fashion's last line of defence.",
    color: 0x19c9a3, icon: 'pack', pulse: 'ammoRefill',
    lines: [{ effect: 'reserveMultiplier', text: '{Size} more reserve ammo' }, { effect: 'switchSpeed', text: 'Swaps weapons {size} slower' }],
    zone: 'megaMart', at: [23.93, -3.16], facing: 'x-',
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Fanny Pack. More pockets, fewer excuses.' },
    motif: 'motifFannyPack',
  },
  foamFinger: {
    slot: 'accessory', name: 'Giant Foam Finger', shortName: 'Foam Finger',
    factors: { meleeDamageMultiplier: 1.5, reloadSpeed: 0.9 }, ticket: "You're number one. Your hand is unavailable.",
    color: 0x2f6bff, icon: 'finger', pulse: 'meleeHit',
    lines: [{ effect: 'meleeDamageMultiplier', text: '{Size} more melee damage' }, { effect: 'reloadSpeed', text: 'Reloads {size} slower' }],
    zone: 'foodCourt', at: [-15, -9.6], facing: 1, // (open court floor NW of the pillar at (-13, -11.3) that hides Good Sports' west half from the entrance; 5.7 m from the Wheelies)
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Giant Foam Finger. We are number one. Please stop pointing.' },
    motif: 'motifFoamFinger',
  },
  goldCard: {
    slot: 'accessory', name: 'Galleria Gold Card', shortName: 'Gold Card',
    factors: { killPayMultiplier: 1.1, regenDelay: 1.2 }, ticket: 'Earn points. Lose sleep.',
    color: 0xffc61a, icon: 'card', pulse: 'payingKill',
    lines: [{ effect: 'killPayMultiplier', text: '{Size} more points per kill' }, { effect: 'regenDelay', text: 'Healing starts {size} later' }],
    zone: 'hallway', at: [4.06, 5.04], facing: 'x-',
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Galleria Gold Card. Please keep earning points. We insist.' },
    motif: 'motifGoldCard',
  },
};

// Which direction of each stat is GOOD for the player ('higher' | 'lower'): a factor that moves it that way is an upside (green), the other a downside (red).
// (Every factor an item uses needs an entry: tested.)
export const statBetter = {
  maxHealth: 'higher', regenDelay: 'lower', sprintDuration: 'higher', sprintSpeed: 'higher', sprintRefillDelay: 'lower',
  slideSpeed: 'higher', slideCooldown: 'lower', reloadSpeed: 'higher', switchSpeed: 'higher', adsTimeMultiplier: 'lower',
  aimAssistMultiplier: 'higher', headshotDamageMultiplier: 'higher', adsMoveSpeed: 'higher', damageTakenMultiplier: 'lower',
  knockbackMultiplier: 'lower', strafeSpeed: 'higher', backpedalSpeed: 'higher', reserveMultiplier: 'higher',
  meleeDamageMultiplier: 'higher', killPayMultiplier: 'higher',
};

export const fittingRooms = {
  hoffmans: { zone: 'departmentStore', at: [-17.1, 23.6], facing: -1 },
  shoePerSale: { zone: 'upstairs', at: [-7, 10.73], facing: -1 },
  staffLockers: { zone: 'serviceCorridor', at: [-22.85, -10], facing: 'x+' },
};

export const wardrobeAnchor = { heightAboveFloor: 1.4, standOff: 0.03 };

// Showpieces (maps/mall/wardrobeShowpieces/, driven by game/features/wardrobeFixtures.js): the big themed fixtures an item is sold from.
export const showpieces = {
  groundFloorIdle: { glint: 2.1, chase: 6, bounce: 2.4, beacon: 4, turn: 0.75, spin: 1.3 },
  motifRange: 8, // metres: an unsold showpiece hums its motif (config/audio.js) while you are this close...
  motifSeconds: 6, // ...once every this many seconds
  motifVolume: 0.5,
  poseSeconds: 1.1, // the buying moment: the idle motion snaps to a pose and a spotlight cone flashes for this long
  soldGlow: 0.12, // an owned item's showpiece keeps this share of its glow...
  soldSign: 0.35, // ...and of its signs' brightness
  soldTint: 0.45, // ...and its moving pieces' colours are greyed to this share
};

// The fitting-room picker (game/features/fittingRoomPicker.js): it closes by itself once you are this far from the mirror (metres).
export const fittingRoomPicker = { closeDistance: 3 };

// The outfit rail (HUD, pause screen, death receipt; game/outfitRail.js decides when a tag pulses, ui/outfitRail.js draws it).
export const outfitRail = {
  pulseSeconds: 0.9, // a tag swings and flashes this long after its item does its job
  emptyLabels: { head: 'HEAD', torso: 'TORSO', feet: 'FEET', accessory: 'EXTRA' }, // what an empty slot's dashed silhouette says
  diedWearing: 'DIED WEARING:', // the results receipt's heading
};
