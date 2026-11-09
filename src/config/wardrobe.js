// Per-run apparel. Locations are [x, z] on the zone's floor, facing into the aisle.
export const wardrobeSlots = { head: 'Head', torso: 'Torso', feet: 'Feet', accessory: 'Accessory' };

export const wardrobeItems = {
  paperHat: {
    slot: 'head', name: 'Burger Barn Paper Hat', shortName: 'Paper Hat',
    factors: { regenDelay: 0.8, reloadSpeed: 0.92 }, tradeoff: 'Recover sooner · Reload slower',
    zone: 'foodCourt', at: [-5.75, -13], facing: 1,
  },
  aviators: {
    slot: 'head', name: 'Mirrored Aviators', shortName: 'Aviators',
    factors: { adsTimeMultiplier: 0.8, switchSpeed: 0.85 }, tradeoff: 'Aim down sights faster · Switch weapons slower',
    zone: 'atrium', at: [26.5, 14.5], facing: 'x-',
  },
  glasses: {
    slot: 'head', name: '3D Glasses', shortName: '3D Glasses',
    factors: { headshotDamageMultiplier: 1.1, adsMoveSpeed: 0.85 }, tradeoff: 'Stronger gun headshots · Move slower while aiming',
    zone: 'cinema', at: [-40.9, 0.5], facing: 'x+',
  },
  cardigan: {
    slot: 'torso', name: "Hoffman's Heirloom Cardigan", shortName: 'Cardigan',
    factors: { maxHealth: 1.25, sprintDuration: 0.8 }, tradeoff: 'More max health · Shorter sprints',
    zone: 'departmentStore', at: [-12.6, 17.6], facing: -1,
  },
  sandwichBoard: {
    slot: 'torso', name: 'EVERYTHING MUST GO Sandwich Board', shortName: 'Sandwich Board',
    factors: { damageTakenMultiplier: 0.9, knockbackMultiplier: 0.5, strafeSpeed: 0.85 },
    tradeoff: 'Take less damage and knockback · Strafe slower',
    zone: 'megaMart', at: [24.4, 3.5], facing: 'x-',
  },
  hiVisVest: {
    slot: 'torso', name: 'Hi-Vis Vest', shortName: 'Hi-Vis Vest',
    factors: { reloadSpeed: 1.15, damageTakenMultiplier: 1.1 }, tradeoff: 'Reload faster · Take more damage',
    zone: 'serviceCorridor', at: [-23.3, -8], facing: 'x+',
  },
  lightUpSneakers: {
    slot: 'feet', name: 'Light-Up Sneakers', shortName: 'Light-Ups',
    factors: { sprintSpeed: 1.08, sprintDuration: 0.85 }, tradeoff: 'Sprint faster · Shorter sprints',
    zone: 'upstairs', at: [-10, 8.5], facing: 'x+',
  },
  orthopedicWalkers: {
    slot: 'feet', name: 'Orthopedic Mall Walkers', shortName: 'Mall Walkers',
    factors: { sprintDuration: 1.35, sprintRefillDelay: 0.7, sprintSpeed: 0.95 },
    tradeoff: 'Sprint longer and recover sooner · Sprint slower',
    zone: 'upstairs', at: [-4, 8.5], facing: 'x-',
  },
  wheelieSneakers: {
    slot: 'feet', name: 'Wheelie Sneakers', shortName: 'Wheelies',
    factors: { slideSpeed: 1.15, slideCooldown: 0.7, backpedalSpeed: 0.85 },
    tradeoff: 'Slide faster and more often · Backpedal slower',
    zone: 'foodCourt', at: [-9, -16.4], facing: 'x-',
  },
  fannyPack: {
    slot: 'accessory', name: 'Fanny Pack', shortName: 'Fanny Pack',
    factors: { reserveMultiplier: 1.25, switchSpeed: 0.9 }, tradeoff: 'More reserve ammo capacity · Switch weapons slower',
    zone: 'megaMart', at: [23.9, -4], facing: 'x-',
  },
  foamFinger: {
    slot: 'accessory', name: 'Giant Foam Finger', shortName: 'Foam Finger',
    factors: { meleeDamageMultiplier: 1.5, reloadSpeed: 0.9 }, tradeoff: 'Stronger melee · Reload slower',
    zone: 'foodCourt', at: [-9, -15], facing: 'x-',
  },
  goldCard: {
    slot: 'accessory', name: 'Galleria Gold Card', shortName: 'Gold Card',
    factors: { killPayMultiplier: 1.1, regenDelay: 1.2 }, tradeoff: 'More points per kill · Recover health later',
    zone: 'hallway', at: [4.7, 5.1], facing: -1,
  },
};

export const fittingRooms = {
  hoffmans: { zone: 'departmentStore', at: [-17.1, 23.6], facing: -1 },
  shoePerSale: { zone: 'upstairs', at: [-7, 10.73], facing: -1 },
  staffLockers: { zone: 'serviceCorridor', at: [-22.85, -10], facing: 'x+' },
};

export const wardrobeAnchor = { heightAboveFloor: 1.4, standOff: 0.03 };
