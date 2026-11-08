// Limited Editions: one per carried gun, separate from tiers, attachments and finished builds. They can't be bought: bag-carrying zombies drop them.
export const workshopBuilds = {
  partyTrap: {
    weapon: 'confettiCannon', name: 'Party Trap', color: 0xff59a9,
    instructions: 'Aim down sights and shoot the floor to plant a charge.',
    aimAmount: 0.8, placementRange: 6, armSeconds: 0.5, lifetimeSeconds: 35,
    maxActive: 2, triggerRadius: 0.7, blastRadius: 2.3, damage: 650, maxTargets: 5,
    footTolerance: 0.5, blastHeight: 0.16, soundRange: 12,
    // The charge on the floor: a flat puck, dim until it is armed.
    marker: { topRadius: 0.15, bottomRadius: 0.19, height: 0.065, segments: 8, lift: 0.05, glowIdle: 0.2, glowArmed: 0.85 },
    blastPop: { count: 24, speed: 3.4 }, // the charge itself going off (a kill adds `pop`)
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

// game/features/limitedEditions.js
export const limitedEditionDrops = {
  fromRound: 3,
  marker: { floorGap: 2, up: 'upstairs', down: 'downstairs' }, // the HUD says which floor once the bag is this many metres above or below you
  dropChance: .15, // per kill of a zombie carrying a shopping bag
  lifetimeSeconds: 30, // how long a bag waits on the floor
  pickupRadius: 1.1, pickupHeight: 1.2,
  spinSpeed: 1.8, glow: .5,
  pa: {
    drop: { kicker: 'Limited Edition', text: 'A customer has dropped a {name}. Finders keepers.' },
    fitted: { kicker: 'Limited Edition', text: '{name} fitted to your {gun}. {instructions}' },
  },
};

// THE RITUAL (game/features/workshopRitual.js): hand a gun over, fight for it, collect it at the Naming Booth.
export const workshopRitual = {
  maxSeconds: 30, // how long a ritual runs with nobody fighting
  secondsPerKill: 1, // each kill in the room takes this much off the clock (it still fills the gauge)
  // The gauge: kills in the room set the quality. Listed lowest first; the last one reached wins.
  qualities: [
    { id: 'understuffed', name: 'Understuffed', minKills: 0, power: 1 },
    { id: 'regular', name: 'Regular', minKills: 4, power: 1.35 },
    { id: 'extraStuffed', name: 'Extra Stuffed', minKills: 9, power: 1.7 },
    { id: 'overstuffed', name: 'Overstuffed', minKills: 15, power: 2.1, heartCooldown: .5, bulge: true }, // heartCooldown: x the Heart's cooldown
  ],
  // Where your gun is along the conveyor (fraction of maxSeconds).
  stages: [
    { id: 'intake', at: 0, label: 'On the conveyor' },
    { id: 'stuffing', at: .2, label: 'Being stuffed' },
    { id: 'heart', at: .55, label: 'Getting its heart' },
    { id: 'stitching', at: .8, label: 'Being stitched up' },
  ],
  catchUpSeconds: 2.5, // once it's done: how long the gun takes from the belt to the Naming Booth (then it comes back to you)
  gunScale: 1.6, // the gun on the conveyor
  // RITUAL MODE (game/features/workshopSpectacle.js). Party colours go on the hall's two existing lamps, so it adds no lights.
  spectacle: {
    partyColors: [0xff4e92, 0x54e4cd, 0xffcf51, 0x8b79fd],
    partySeconds: .9, // how long the lamps hold each colour
    bulbSeconds: .22, // how often the bulb string steps along
    jingleSeconds: 6, // the jingle repeats over the fighting
    jingleRange: 26, // metres from the tank at which it fades out
    beltSpeed: 1.4, // slats per second
    fillSeconds: .5, // how fast the tank catches up with the gauge
    fluffTurnSpeed: .5, // radians per second
    flapOpenAngle: .9, flapSeconds: .35, // the chute's flap, and how fast it moves
    leverSeconds: .25,
    tankDeathSeconds: .85, // a kill in the room flying into the tank
    tankDeathSpin: 7, // radians over the flight
    tankDeathArc: 1.1, // metres above the straight line
  },
  // Lent to a player who hands over their only gun, taken back at collection. Plain: no upgrades can be bought for it.
  loaner: { weapon: 'stapleGun', name: 'Courtesy Loaner' },
  // Printed on the Birth Certificate when the Loaner was lent.
  loanerNotes: {
    returned: 'Courtesy Loaner returned. Late fee waived, this once.',
    lost: 'Courtesy Loaner not returned. Late fee: everything you own.',
  },
  chuteDropHeight: 1.5, // a return falls this far out of the hatch (replaces rising from the floor)
  // PA lines. {gun} and {name} are filled in by the ritual. A quality's line plays when the gauge first reaches it.
  pa: {
    start: { kicker: 'Build-A-Blaster', text: 'One {gun} on the conveyor. Please keep the room busy.' },
    restuff: { kicker: 'Build-A-Blaster', text: '{name} is back in for alterations. Please keep the room busy.' },
    qualities: {
      regular: { kicker: 'Build-A-Blaster', text: 'The tank is coming along nicely. Regular.' },
      extraStuffed: { kicker: 'Build-A-Blaster', text: 'Extra Stuffed. A staff member has been told to stand back.' },
      overstuffed: { kicker: 'Build-A-Blaster', text: 'Overstuffed. We cannot be held responsible.' },
    },
    stages: {
      stuffing: { kicker: 'Build-A-Blaster', text: 'Now adding the stuffing. Do not be alarmed by the noise.' },
      heart: { kicker: 'Build-A-Blaster', text: 'Fitting the heart. Everyone make a wish.' },
      stitching: { kicker: 'Build-A-Blaster', text: 'Stitching up. Nearly there.' },
    },
    ready: { kicker: 'Build-A-Blaster', text: 'Your {gun} is done. Coming back to you now.' },
    readyAgain: { kicker: 'Build-A-Blaster', text: '{name} is done. Coming back to you now.' },
    waiting: { kicker: 'Build-A-Blaster', text: 'Your order is waiting at the Naming Booth. Collecting it would replace your {gun}.' },
    collect: { kicker: 'Build-A-Blaster', text: 'Please welcome {name} to the family.' },
    collectAgain: { kicker: 'Build-A-Blaster', text: '{name} has been altered. Please do not tell them.' },
  },
  // What the Birth Certificate says under the details.
  remarks: {
    understuffed: 'A little light. We love them anyway.',
    regular: 'Healthy, loud and ready to go home.',
    extraStuffed: 'A big one. Mind the seams.',
    overstuffed: 'The doctors are concerned.',
  },
};

// The order form at the bench (game/features/workshopOrderForm.js, ui/orderForm.js).
export const orderForm = {
  deniedSeconds: .6, // how long "not enough points" shows
};

// Where a stuffing goes off, in metres (game/features/workshopStuffings.js).
export const workshopReach = {
  chestHeight: 1.1, // above a zombie's feet: its line of sight, and where its pops appear
  missOffset: .15, // out from a wall, for a Last Round that missed
  floorSearch: 5, // below a spot, for the floor under a puddle
};

// STUFFINGS: what a build does. Each round the bins offer todayCount of what is stocked. stockedBy = the zone that has to be owned (null = always).
// gunSeconds = damage as seconds of the gun's own fire (weapons/gunStats.js gunPower), scaled again by the build's power.
export const workshopStuffings = {
  smoothie: {
    name: 'Smoothie', stockedBy: null, defaultHeart: 'headshot', color: 0xff7fb2, sound: 'stuffingSmoothie', blurb: 'Slows everything round the hit',
    slow: { seconds: 3, fraction: .55, radius: 2.5 },
    pop: { colors: [0xff7fb2, 0xffd1e3, 0xfff3d4], count: 8, speed: 1.6, size: .05 },
  },
  fryerOil: {
    name: 'Fryer Oil', stockedBy: 'foodCourt', defaultHeart: 'lastRound', color: 0xf0a020, sound: 'stuffingFryer', blurb: 'Sets the target burning',
    burn: { gunSeconds: .35, seconds: 3, tickSeconds: .5, radius: 1.2, emberSeconds: .25,
      ember: { colors: [0xff8a1f, 0xffd24a], count: 3, speed: 1.1, size: .035 } },
    pop: { colors: [0xff8a1f, 0xffd24a, 0xff4d1f], count: 8, speed: 2, size: .05 },
  },
  neonTube: {
    name: 'Neon Tube', stockedBy: 'megaMart', defaultHeart: 'headshot', color: 0x4fe0ff, sound: 'stuffingNeon', blurb: 'Arcs to nearby zombies',
    chain: { gunSeconds: .08, jumps: 2, maxJumps: 5, range: 5, falloff: .8 },
    pop: { colors: [0x4fe0ff, 0xc9f5ff, 0xff4fd8], count: 8, speed: 2.4, size: .045 },
  },
  popcornButter: {
    name: 'Popcorn Butter', stockedBy: 'cinema', defaultHeart: 'reload', color: 0xffd24a, sound: 'stuffingButter', blurb: 'Leaves a slippery puddle',
    // Spill Cleanup's zone, per proc: anything on it keeps being slowed while it stands there.
    puddle: { radius: 1.8, seconds: 6, slowFraction: .35, slowSeconds: .2, maxPuddles: 3, lift: .03, opacity: .55 },
    pop: { colors: [0xffd24a, 0xfff1a8, 0xe0a526], count: 8, speed: 1.4, size: .05 },
  },
  antifreeze: {
    name: 'Antifreeze', stockedBy: 'parkingLot', defaultHeart: 'headshot', color: 0x7dff9a, sound: 'stuffingFreeze', blurb: 'Chills zombies, then shatters the chilled',
    // A slowed zombie (by anything) shatters and loses the slow; one that isn't slowed is chilled.
    chill: { seconds: 3, fraction: .5, radius: 2.2 },
    shatter: { gunSeconds: .12, maxTargets: 3 },
    pop: { colors: [0x7dff9a, 0xd7ffe6, 0x49c9ff], count: 10, speed: 2.8, size: .05 },
  },
  glitter: {
    name: 'Glitter', stockedBy: 'departmentStore', defaultHeart: 'lastRound', color: 0xe08bff, sound: 'stuffingGlitter', blurb: 'Confused zombies fight each other',
    // gunSeconds = how hard a confused zombie hits. Its behaviour is zombies/confusion.js (numbers: config/zombies.js zombieConfusion).
    confuse: { seconds: 3, maxSeconds: 6, radius: 2.2, maxTargets: 3, gunSeconds: .06, sparkleSeconds: .3,
      sparkle: { colors: [0xe08bff, 0xfff3d4, 0x8bd8ff], count: 3, speed: .9, size: .03 } },
    pop: { colors: [0xe08bff, 0xff8bd8, 0xfff3d4, 0x8bd8ff], count: 14, speed: 2.2, size: .04 },
  },
};
export const todayCount = 3; // bins open per round

// HEARTS: when a build fires. strength multiplies the stuffing; cooldownSeconds stops a fast gun firing it every shot.
export const workshopHearts = {
  headshot: { name: 'Headshot', blurb: 'Fires on a headshot', strength: 1, cooldownSeconds: .75 },
  lastRound: { name: 'Last Round', blurb: 'Fires on the last round in the magazine', strength: 1.5, cooldownSeconds: 0 },
  reload: { name: 'Reload', blurb: 'Fires a blast around you when you reload', strength: 1, cooldownSeconds: 4 },
  everyTenth: { name: 'Every 10th', blurb: 'Fires on every 10th kill with this gun', strength: 2, cooldownSeconds: 0, everyKills: 10 },
};

// Every finished gun gets a name at the Naming Booth, and keeps it through a re-stuff. A run uses each name once while any are left.
export const workshopNames = ['Gerald', 'Doris', 'Mavis', 'Todd', 'Nigel', 'Beverly', 'Clive', 'Agnes', 'Stanley', 'Rhonda', 'Gus', 'Mildred',
  'Dale', 'Phyllis', 'Norman', 'Bernice', 'Wendell', 'Trudy', 'Earl', 'Hortense', 'Steve', 'Lorraine', 'Vern', 'Gladys'];

// What a Stuffing and Heart make together: the model name on the Birth Certificate and the receipt.
export const workshopComboNames = {
  smoothie: { headshot: 'Brain Freeze', lastRound: 'Last Sip', reload: 'Free Refill', everyTenth: 'Punch Card' },
  fryerOil: { headshot: 'Hot Head', lastRound: 'Final Fry', reload: 'Grease Fire', everyTenth: 'Combo Meal' },
  neonTube: { headshot: 'Bright Idea', lastRound: 'Closing Time', reload: 'Power Surge', everyTenth: 'Vacancy' },
  popcornButter: { headshot: 'Extra Butter', lastRound: 'End Credits', reload: 'Bottomless Tub', everyTenth: 'Matinee Special' },
  antifreeze: { headshot: 'Cold Call', lastRound: 'Deep Freeze', reload: 'Cold Snap', everyTenth: 'Frequent Freezer' },
  glitter: { headshot: 'Razzle Dazzle', lastRound: 'Grand Finale', reload: 'Glitter Bomb', everyTenth: 'Party Favor' },
};
export const comboName = ({ stuffing, heart }) => workshopComboNames[stuffing][heart];

/** A named gun on the death receipt: "Gerald (Grand Finale), 212 confirmed". */
export const survivorLine = ({ name, combo, confirmed }) => `${name} (${combo}), ${confirmed} confirmed`;

export const qualityFor = (kills) =>
  workshopRitual.qualities.reduce((best, q) => (kills >= q.minKills ? q : best), workshopRitual.qualities[0]);
export const qualityById = (id) => workshopRitual.qualities.find(q => q.id === id);
export const nextQualityFor = (kills) => workshopRitual.qualities.find(q => q.minKills > kills) ?? null;
export const stageFor = (fraction) =>
  workshopRitual.stages.reduce((best, stage) => (fraction >= stage.at ? stage : best), workshopRitual.stages[0]);

// A finished ritual lives on the gun as a mod: { id: 'build', build: { name, stuffing, heart, quality, kills, confirmed } }. kills = what filled the tank,
// confirmed = the gun's kills since it was named, kept through a re-stuff. It stacks with tiers and attachments.
export const buildOf = (mods) => mods?.find(m => m.id === 'build')?.build ?? null;

/** What a gun is called on the HUD: "Gerald · Nail Gun" once it has been named. `def` is a resolved gun. */
export const gunLabel = (def) => {
  const build = buildOf(def.modList);
  return build?.name ? `${build.name} · ${def.name}` : def.name;
};

/** The Birth Certificate's description: "a Regular Nail Gun", "an Extra Stuffed Nail Gun". */
export const certificateSubtitle = (quality, gunName) => `${/^[aeiou]/i.test(quality) ? 'an' : 'a'} ${quality} ${gunName}`;

/** Fill a PA line's {gun} and {name}. */
export const paLine = (line, values) => ({ ...line, text: line.text.replace(/\{(\w+)\}/g, (_, key) => values[key]) });
