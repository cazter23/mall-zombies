// Per-run apparel. Locations are [x, z] on the zone's floor, facing into the aisle.
// An item is DATA: `factors` multiply the player's stats while it is worn (game/wardrobe.js, the only code that applies them).
// `ticket` is the joke line on the shelf ticket; the stat lines under it are generated from `factors` and `statLabels` below.
// `color` (the item's signature colour) and `icon` (an id the HUD draws in SVG, ui/outfitIcons.js) are for the outfit rail and the showpieces.
// `pulse` names the trigger that makes the item's tag on the outfit rail swing and flash (game/outfitRail.js `triggers` has one entry per name).
export const wardrobeSlots = { head: 'Head', torso: 'Torso', feet: 'Feet', accessory: 'Accessory' };

export const wardrobeItems = {
  paperHat: {
    slot: 'head', name: 'Burger Barn Paper Hat', shortName: 'Paper Hat',
    factors: { regenDelay: 0.8, reloadSpeed: 0.92 }, ticket: 'You smell like a shift you survived.',
    color: 0xf2542d, icon: 'hat', pulse: 'regenStart',
    zone: 'foodCourt', at: [-5.75, -13], facing: 1,
    // Showpiece (maps/mall/wardrobeShowpieces/): its mall PA line when bought, and the audio.js sound it hums while unsold.
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Burger Barn Paper Hat. Burger Barn would like the hat back.' },
    motif: 'motifPaperHat',
  },
  aviators: {
    slot: 'head', name: 'Mirrored Aviators', shortName: 'Aviators',
    factors: { adsTimeMultiplier: 0.7, aimAssistMultiplier: 1.2, switchSpeed: 0.85 }, ticket: 'Too cool to hurry.',
    color: 0xbfd4e6, icon: 'aviators', pulse: 'aimStart',
    zone: 'atrium', at: [26.5, 14.5], facing: 'x-',
  },
  glasses: {
    slot: 'head', name: '3D Glasses', shortName: '3D Glasses',
    factors: { headshotDamageMultiplier: 1.25, adsMoveSpeed: 0.85 }, ticket: 'The floor is closer than it appears.',
    color: 0x29c4f0, icon: 'glasses3d', pulse: 'headshot',
    zone: 'cinema', at: [-40.9, 0.5], facing: 'x+',
  },
  cardigan: {
    slot: 'torso', name: "Hoffman's Heirloom Cardigan", shortName: 'Cardigan',
    factors: { maxHealth: 1.25, sprintDuration: 0.8 }, ticket: 'Some are still warm.',
    color: 0xa8553a, icon: 'cardigan', pulse: 'hitCushioned',
    zone: 'departmentStore', at: [-12.6, 17.6], facing: -1,
  },
  sandwichBoard: {
    slot: 'torso', name: 'EVERYTHING MUST GO Sandwich Board', shortName: 'Sandwich Board',
    factors: { damageTakenMultiplier: 0.8, knockbackMultiplier: 0.5, strafeSpeed: 0.85 },
    ticket: 'Covers the front and back. The sides are your problem.',
    color: 0xff3ea5, icon: 'board', pulse: 'playerHit',
    zone: 'megaMart', at: [24.4, 3.5], facing: 'x-',
  },
  hiVisVest: {
    slot: 'torso', name: 'Hi-Vis Vest', shortName: 'Hi-Vis Vest',
    factors: { reloadSpeed: 1.25, damageTakenMultiplier: 1.25 }, ticket: 'Nobody questions a vest. Everybody can see one.',
    color: 0xd7ff2f, icon: 'vest', pulse: 'playerHit',
    zone: 'serviceCorridor', at: [-23.3, -8], facing: 'x+',
  },
  lightUpSneakers: {
    slot: 'feet', name: 'Light-Up Sneakers', shortName: 'Light-Ups',
    factors: { sprintSpeed: 1.1, sprintDuration: 0.9 }, ticket: "Every step says you're here.",
    color: 0xb44dff, icon: 'sneaker', pulse: 'sprintStart',
    zone: 'upstairs', at: [-10, 8.5], facing: 'x+',
  },
  orthopedicWalkers: {
    slot: 'feet', name: 'Orthopedic Mall Walkers', shortName: 'Orthopedics', // (not "Mall Walkers": that is a zombie)
    factors: { sprintDuration: 1.35, sprintRefillDelay: 0.7, sprintSpeed: 0.95 },
    ticket: 'Recommended by the people chasing you.',
    color: 0xd8cbb0, icon: 'walker', pulse: 'sprintStart',
    zone: 'upstairs', at: [-4, 8.5], facing: 'x-',
  },
  wheelieSneakers: {
    slot: 'feet', name: 'Wheelie Sneakers', shortName: 'Wheelies',
    factors: { slideSpeed: 1.15, slideCooldown: 0.7, backpedalSpeed: 0.85 },
    ticket: 'Stopping sold separately.',
    color: 0xff8a1f, icon: 'wheelie', pulse: 'slideStart',
    zone: 'foodCourt', at: [-10.1, -12], facing: 1, // (the court floor in front of Good Sports' east window: the old spot was inside the shop)
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Wheelie Sneakers. Walking is now optional. Stopping is not offered.' },
    motif: 'motifWheelie',
  },
  fannyPack: {
    slot: 'accessory', name: 'Fanny Pack', shortName: 'Fanny Pack',
    factors: { reserveMultiplier: 1.25, switchSpeed: 0.9 }, ticket: "Fashion's last line of defence.",
    color: 0x19c9a3, icon: 'pack', pulse: 'ammoRefill',
    zone: 'megaMart', at: [23.9, -4], facing: 'x-',
  },
  foamFinger: {
    slot: 'accessory', name: 'Giant Foam Finger', shortName: 'Foam Finger',
    factors: { meleeDamageMultiplier: 1.5, reloadSpeed: 0.9 }, ticket: "You're number one. Your hand is unavailable.",
    color: 0x2f6bff, icon: 'finger', pulse: 'meleeHit',
    zone: 'foodCourt', at: [-15, -9.6], facing: 1, // (open court floor NW of the pillar at (-13, -11.3) that hides Good Sports' west half from the entrance; 5.7 m from the Wheelies)
    pa: { kicker: 'Attention shoppers', text: 'Someone just bought the Giant Foam Finger. We are number one. Please stop pointing.' },
    motif: 'motifFoamFinger',
  },
  goldCard: {
    slot: 'accessory', name: 'Galleria Gold Card', shortName: 'Gold Card',
    factors: { killPayMultiplier: 1.1, regenDelay: 1.2 }, ticket: 'Earn points. Lose sleep.',
    color: 0xffc61a, icon: 'card', pulse: 'payingKill',
    zone: 'hallway', at: [4.7, 5.1], facing: -1,
  },
};

// How each stat reads on a ticket (game/wardrobe.js statLines). Every stat an item's `factors` touch needs an entry (tested).
//   kind 'value':   "<label> <before><unit> → <after><unit>", from the player's stats right now (so incentives and other items count)
//   kind 'percent': the `up` / `down` sentence with {pct} = how far the stat moves from where it is now
//   better: which direction is good for the player ('higher' | 'lower'): green or red on the ticket
export const statLabels = {
  maxHealth: { kind: 'value', label: 'Max health', unit: '', decimals: 0, better: 'higher' },
  regenDelay: { kind: 'value', label: 'Healing starts after', unit: ' s', decimals: 1, better: 'lower' },
  sprintDuration: { kind: 'value', label: 'Sprint', unit: ' s', decimals: 1, better: 'higher' },
  sprintSpeed: { kind: 'value', label: 'Sprint speed', unit: ' m/s', decimals: 1, better: 'higher' },
  sprintRefillDelay: { kind: 'value', label: 'Sprint recovers after', unit: ' s', decimals: 1, better: 'lower' },
  slideSpeed: { kind: 'value', label: 'Slide speed', unit: ' m/s', decimals: 1, better: 'higher' },
  slideCooldown: { kind: 'value', label: 'Slide cooldown', unit: ' s', decimals: 2, better: 'lower' },
  reloadSpeed: { kind: 'percent', up: 'Reload {pct}% faster', down: 'Reload {pct}% slower', better: 'higher' },
  switchSpeed: { kind: 'percent', up: 'Weapon swap {pct}% faster', down: 'Weapon swap {pct}% slower', better: 'higher' },
  adsTimeMultiplier: { kind: 'percent', up: 'Aim time {pct}% longer', down: 'Aim time {pct}% shorter', better: 'lower' },
  aimAssistMultiplier: { kind: 'percent', up: 'Aim assist {pct}% stronger', down: 'Aim assist {pct}% weaker', better: 'higher' },
  headshotDamageMultiplier: { kind: 'percent', up: 'Gun headshots {pct}% stronger', down: 'Gun headshots {pct}% weaker', better: 'higher' },
  adsMoveSpeed: { kind: 'percent', up: 'Moving while aiming {pct}% faster', down: 'Moving while aiming {pct}% slower', better: 'higher' },
  damageTakenMultiplier: { kind: 'percent', up: 'Zombie hits hurt {pct}% more', down: 'Zombie hits hurt {pct}% less', better: 'lower' },
  knockbackMultiplier: { kind: 'percent', up: 'Knockback {pct}% stronger', down: 'Knockback {pct}% weaker', better: 'lower' },
  strafeSpeed: { kind: 'percent', up: 'Strafing {pct}% faster', down: 'Strafing {pct}% slower', better: 'higher' },
  backpedalSpeed: { kind: 'percent', up: 'Backpedalling {pct}% faster', down: 'Backpedalling {pct}% slower', better: 'higher' },
  reserveMultiplier: { kind: 'percent', up: 'Reserve ammo {pct}% larger', down: 'Reserve ammo {pct}% smaller', better: 'higher' },
  meleeDamageMultiplier: { kind: 'percent', up: 'Melee damage {pct}% higher', down: 'Melee damage {pct}% lower', better: 'higher' },
  killPayMultiplier: { kind: 'percent', up: 'Kill points {pct}% higher', down: 'Kill points {pct}% lower', better: 'higher' },
};

export const fittingRooms = {
  hoffmans: { zone: 'departmentStore', at: [-17.1, 23.6], facing: -1 },
  shoePerSale: { zone: 'upstairs', at: [-7, 10.73], facing: -1 },
  staffLockers: { zone: 'serviceCorridor', at: [-22.85, -10], facing: 'x+' },
};

export const wardrobeAnchor = { heightAboveFloor: 1.4, standOff: 0.03 };

// Showpieces (maps/mall/wardrobeShowpieces/, driven by game/features/wardrobeFixtures.js): the big themed fixtures an item is sold from.
export const showpieces = {
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
