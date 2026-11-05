// One workshop build per carried gun, separate from tiers and attachments.
export const workshopBuilds = {
  partyTrap: {
    weapon: 'confettiCannon', name: 'Party Trap', color: 0xff59a9,
    instructions: 'Aim down sights and shoot the floor to plant a charge.',
    aimAmount: 0.8, placementRange: 6, armSeconds: 0.5, lifetimeSeconds: 35,
    maxActive: 2, triggerRadius: 0.7, blastRadius: 2.3, damage: 650, maxTargets: 5,
    footTolerance: 0.5, blastHeight: 0.16,
    pop: { delaySeconds: .36, ribbonSeconds: .52, pullMeters: .46, liftMeters: .27, count: 54, speed: 5.6, size: .083,
      colors: [0xff4e92, 0xffcf51, 0x54e4cd, 0x8b79fd, 0xfff3d4] },
  },
  clearanceRack: {
    weapon: 'priceGun', name: 'Clearance Rack', color: 0xff6b36,
    instructions: 'Tag up to three zombies with body shots. Headshot a tagged zombie to pop all tags.',
    maxTags: 3, damageMultiplier: 3,
    pop: { count: 16, speed: 3.1, size: .059, colors: [0xff5933, 0xffd657, 0xfff2ca] },
  },
};

export const workshopModOf = (mods) => mods?.find(m => m.id === 'workshop')?.workshop;

// THE RITUAL (game/features/workshopRitual.js): hand a gun over, fight for it, collect it at the Naming Booth.
export const workshopRitual = {
  maxSeconds: 45, // the longest a ritual runs; the lever ends it sooner
  // The gauge: kills in the room set the quality. Listed lowest first; the last one reached wins.
  qualities: [
    { id: 'understuffed', name: 'Understuffed', minKills: 0, power: 1 },
    { id: 'regular', name: 'Regular', minKills: 4, power: 1.35 },
    { id: 'extraStuffed', name: 'Extra Stuffed', minKills: 9, power: 1.7 },
    { id: 'overstuffed', name: 'Overstuffed', minKills: 15, power: 1.7, bulge: true },
  ],
  // Where your gun is along the conveyor (fraction of maxSeconds).
  stages: [
    { id: 'intake', at: 0, label: 'On the conveyor' },
    { id: 'stuffing', at: .2, label: 'Being stuffed' },
    { id: 'heart', at: .55, label: 'Getting its heart' },
    { id: 'stitching', at: .8, label: 'Being stitched up' },
  ],
  catchUpSeconds: 2.5, // how long the gun takes to run to the end of the belt when the lever is pulled
  // Lent to a player who hands over their only gun, taken back at collection. Plain: no upgrades can be bought for it.
  loaner: { weapon: 'stapleGun', name: 'Courtesy Loaner' },
  pa: {
    start: { kicker: 'Build-A-Blaster', text: 'Your order is on the conveyor. Please keep the room busy.' },
    ready: { kicker: 'Build-A-Blaster', text: 'Your order is ready at the Naming Booth.' },
    collect: { kicker: 'Build-A-Blaster', text: 'Thank you for building with us.' },
  },
};

export const qualityFor = (kills) =>
  workshopRitual.qualities.reduce((best, q) => (kills >= q.minKills ? q : best), workshopRitual.qualities[0]);
export const nextQualityFor = (kills) => workshopRitual.qualities.find(q => q.minKills > kills) ?? null;
export const stageFor = (fraction) =>
  workshopRitual.stages.reduce((best, stage) => (fraction >= stage.at ? stage : best), workshopRitual.stages[0]);

// A finished ritual lives on the gun as a mod: { id: 'build', build: { quality, kills, ... } }. It stacks with tiers and attachments.
export const buildOf = (mods) => mods?.find(m => m.id === 'build')?.build ?? null;
