// =============================================================================
// THE STAFF SURVIVAL GUIDE: a permanent log of every zombie type and boss, opened from the title (ui/guide.js).
// A page appears when its subject is first seen, and fills in by KILLS across all shifts (game/guide.js counts them,
// game/guideSave.js keeps them): the memo at once, the field notes at `notesAt` kills, the tip at `tipAt`.
// Every number a page quotes is read from the config it describes, so a balance change can't leave the guide lying.
// No page pays anything: the guide is a record, not a perk.
// =============================================================================
import { zombieTypes, mascotTypes, mascotGoldTypes, mascotVariants, mascotGold } from './zombies.js';
import { bossTypes, bossVouchers } from './bosses.js';
import { powerUps } from './powerUps.js';
import { economy } from './economy.js';
import { feel } from './feel.js';

export const guideStorage = { key: 'sunsetGalleria.guide', version: 1 };

const pct = (fraction) => Math.round(fraction * 100) + '%';
const extra = (multiplier) => pct(multiplier - 1); // 1.5 -> "50%" (more)
const rounds = (list) => list.length > 2 ? `${list.slice(0, -1).join(', ')} or ${list.at(-1)}` : list.join(' or ');
const mix = economy.zombieMix;
const { shopper, mallWalker, cartPusher, mannequin } = zombieTypes;
const mascot = zombieTypes.mascot.mascot;
const { janitor, guard, manager, influencer } = bossTypes;
const rewardName = (id) => bossVouchers[id]?.name ?? powerUps.types?.[id]?.name ?? null;
const titleCase = (text) => text.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

// One costume's page. `twist` = its field note beyond the shared Mascot beats.
function mascotPage(variant, { memo, twist, tip, notesAt = 3, tipAt = 12 }) {
  return {
    id: variant, section: 'customers', type: mascotTypes[variant], name: mascotVariants[variant].name, title: 'Mascot',
    health: mix.mascot.healthMultiplier, firstSeen: `Round ${mascotVariants[variant].unlockRound}`, notesAt, tipAt, memo,
    notes: [
      `Slow (${mascotTypes[variant].speed} m/s) and padded. At ${pct(mascot.healthFraction)} health the helmet pops off; it shakes for a moment, then rushes at ${mascot.exposedSpeed} m/s. You walk at ${feel.movement.walkSpeed}.`,
      twist,
    ].filter(Boolean),
    tip,
  };
}

// One boss's page.
function bossPage(type, page) {
  const reward = rewardName(type.reward);
  return {
    id: type.id, section: 'management', type, name: type.name, title: type.title, health: type.healthMultiplier,
    firstSeen: `Round ${rounds(type.firstRounds)}`, notesAt: 1, tipAt: 3, ...page,
    notes: [...page.notes, reward ? `Leaves behind: ${titleCase(reward)}.` : null].filter(Boolean),
  };
}

const lock = guard.lockdown, meet = manager.meeting, report = manager.report;
const fol = influencer.followers, fans = influencer.fans, flash = influencer.flash;
const reclaim = mascotVariants.captainCoupon.reclaim, pop = mascotVariants.poppyCorn.popBlast;

/**
 * Every page, in book order. { id, section, type (the zombie type its model is built from), name, title,
 * health (x a Shopper's), firstSeen, notesAt / tipAt (kills), memo, notes[], tip, alwaysSeen? }
 * A zombie's page is found by guideEntryId(zombie.type), below.
 */
export const guideEntries = [
  {
    id: 'shopper', section: 'customers', type: shopper, name: 'Shopper', title: 'Regular customer', alwaysSeen: true,
    health: 1, firstSeen: 'Round 1', notesAt: 50, tipAt: 500,
    memo: 'Arrived for the sale. Did not leave. Nobody has told them the sale is over, and staff are advised not to volunteer.',
    notes: [
      `Shambles straight at you and swings when close: ${shopper.attack.damage} damage a hit.`,
      'In later rounds some of them jog, then run, and all of them wind up their swing sooner.',
    ],
    tip: 'A headshot does more than a body shot with every gun, and twice as much with some. Let them bunch up in a doorway and aim high.',
  },
  {
    id: 'mallWalker', section: 'customers', type: mallWalker, name: 'Mall Walker', title: 'Fitness enthusiast',
    health: mix.mallWalker.healthMultiplier, firstSeen: `Round ${mix.mallWalker.fromRound}`, notesAt: 25, tipAt: 150,
    memo: 'Has completed eleven thousand laps of the upper level. Stops for nothing, except, briefly, their own lungs.',
    notes: [
      `Fast: ${mallWalker.speed} m/s. You walk at ${feel.movement.walkSpeed} and sprint at ${feel.movement.sprintSpeed}, so backing away does not work.`,
      `After every swing, hit or miss, it stands panting for ${mallWalker.winded.standSeconds} seconds, then follows at ${pct(mallWalker.winded.slowSpeedFraction)} speed for a moment.`,
    ],
    tip: 'Let it swing at you and step out of reach, then shoot while it has its hands on its knees.',
  },
  {
    id: 'cartPusher', section: 'customers', type: cartPusher, name: 'Cart Pusher', title: 'Trolley operator',
    health: mix.cartPusher.healthMultiplier, firstSeen: `Round ${mix.cartPusher.fromRound}`, notesAt: 15, tipAt: 75,
    memo: 'Customer and trolley have been inseparable since the incident in the adhesives aisle.',
    notes: [
      `With a clear lane to you from ${cartPusher.charge.minRange} to ${cartPusher.charge.maxRange} metres away it stops, rattles the cart for ${cartPusher.charge.telegraphSeconds} seconds, then charges in a straight line for ${cartPusher.charge.damage} damage.`,
      'The direction locks when the rattle ends. Furniture in the lane stops it charging at all.',
    ],
    tip: `Sidestep the charge. A miss leaves it slumped over the cart for ${cartPusher.charge.crashSeconds} seconds, taking ${extra(cartPusher.charge.crashDamageTakenMultiplier)} more damage.`,
  },
  {
    id: 'mannequin', section: 'customers', type: mannequin, name: 'Mannequin', title: 'Window display',
    health: mix.mannequin.healthMultiplier, firstSeen: `Round ${mix.mannequin.fromRound}`, notesAt: 10, tipAt: 40,
    memo: 'Was not in that position yesterday. Was not on that floor yesterday. Visual Merchandising deny all knowledge.',
    notes: [
      `Cannot move while you are looking at it. Moves at ${mannequin.speed} m/s when you are not, faster than you walk.`,
      `Never more than ${mix.mannequin.maxAlive} in the mall at once.`,
    ],
    tip: 'Kill it first, or keep it on screen while you deal with the rest. The click you hear is one coming unstuck.',
  },
  mascotPage('sirWaffles', {
    memo: 'The Food Court\'s breakfast knight. The costume was rented by the hour. The hour has been going on for some time.',
    twist: `Never more than ${mix.mascot.maxAlive} Mascots at once, whatever they are wearing.`,
    tip: 'Do the first half of the damage from a distance, and have somewhere to run before the helmet comes off.',
  }),
  mascotPage('captainCoupon', {
    memo: 'Mega Mart\'s discount superhero. His coupons expired some time ago. Legal would like it noted that so did he.',
    twist: `After the helmet pops he hurries back to it and puts it on again, which returns him to ${pct(reclaim.reclaimHealthFraction)} health. He manages it once.`,
    tip: `Shoot him while he is bent over the helmet: his head is bare. Or stand within ${reclaim.guardRadius} metres of it yourself and he gives up and rushes you.`,
  }),
  mascotPage('poppyCorn', {
    memo: 'The Sunset Cinema\'s usher. Patrons are reminded to silence their phones, their children and their screaming.',
    twist: `Her helmet pops with a blast: zombies within ${pop.zombieRadius} metres are flung and stunned for ${pop.stunSeconds} seconds, and within ${pop.playerRadius} metres you are shoved away too. It does no damage to anyone.`,
    tip: 'Pop her from range while she is standing in a crowd, and the blast does your crowd control for you.',
  }),
  mascotPage('scoops', {
    memo: 'The Atrium\'s soda-fountain mascot, currently melting. Please mind the floor. It is mostly strawberry.',
    twist: 'Leaves a trail of melt puddles that slow you down, and drips twice as fast once his cone is off.',
    tip: 'Never retreat along the path he arrived by. Lead him somewhere you do not plan to stand.',
  }),
  {
    id: 'employeeOfTheMonth', section: 'customers', type: mascotGoldTypes.sirWaffles, name: 'Employee of the Month', title: 'Gold Mascot',
    health: mix.mascot.healthMultiplier * mascotGold.healthMultiplier, firstSeen: `Round ${mascotGold.fromRound}`, notesAt: 1, tipAt: 3,
    memo: 'Twelve consecutive months. Nobody else was nominated. Nobody else was available.',
    notes: [
      `From round ${mascotGold.fromRound} any Mascot may arrive in gold (${pct(mascotGold.chance)} of the time), ${extra(mascotGold.healthMultiplier)} tougher, in whichever costume it would have worn. Never two at once.`,
      'Always drops a power-up where it falls.',
    ],
    tip: 'Worth dropping everything for. Kill it somewhere you can reach the body.',
  },

  bossPage(janitor, {
    memo: 'Thirty-one years of service. Has never once been thanked. Has noticed.',
    notes: [
      `Chases and swings like a Shopper with a mop: ${janitor.attack.damage} damage a hit.`,
      `Leaves wet patches behind him, up to ${janitor.wetFloor.maxPatches} at a time, each lasting ${janitor.wetFloor.seconds} seconds. Standing in one cuts your speed to ${pct(janitor.wetFloor.speedFraction)}.`,
    ],
    tip: 'Fight him in a big room and back away in a wide circle, not a straight line: his puddles are always where he has just been.',
  }),
  bossPage(guard, {
    memo: 'Has apprehended four shoplifters and one very surprised delivery driver. Considers survival to be suspicious behaviour.',
    notes: [
      `Charges from ${guard.charge.minRange} to ${guard.charge.maxRange} metres like a Cart Pusher, after a chime. It does ${guard.charge.damage} damage and the taser slows you to ${pct(guard.taserSlow.speed)} speed for ${guard.taserSlow.seconds} second.`,
      `At ${lock.thresholds.map(pct).join(' and ')} health he calls a lockdown: after a ${lock.alarmSeconds} second alarm the shutters around the area you are standing in close for ${lock.seconds} seconds and ${lock.backup} ${lock.backupType === 'mallWalker' ? 'Mall Walkers' : 'zombies'} join in.`,
    ],
    tip: `${lock.headshots} headshots during the alarm or the lockdown break his radio: the shutters open and he can never call another. Dodge a charge and he is stunned for ${guard.charge.crashSeconds} seconds, taking ${extra(guard.charge.crashDamageTakenMultiplier)} more damage.`,
  }),
  bossPage(manager, {
    memo: 'Would like a quick word. Please budget the rest of your life. His door is always open; that is how they got in.',
    notes: [
      `Every ${report.interval} seconds he picks up to ${report.maxTargets} zombies near him and makes them ${extra(report.speed)} faster for ${report.seconds} seconds.`,
      `At ${meet.thresholds.map(pct).join(' and ')} health he calls a Staff Meeting: he and the zombies near him stand still for ${meet.seconds} seconds, and he takes ${extra(meet.damageTaken)} more damage. If it finishes, every zombie in the mall is ${extra(meet.speed)} faster and hits ${extra(meet.damage)} harder for ${meet.buffSeconds} seconds.`,
    ],
    tip: `Take ${pct(meet.cancelFraction)} of his health off during a meeting and it is cancelled: no bonus for them, and he is stunned for ${meet.stunSeconds} seconds. Save a full magazine for it.`,
  }),
  bossPage(influencer, {
    memo: 'Is filming. Was always filming. Engagement is up eleven per cent since the incident, which she describes as "a rebrand".',
    notes: [
      `Never attacks. She films you from ${influencer.filming.minRange} to ${influencer.filming.maxRange} metres away and moves when you close in.`,
      `Her follower count climbs on its own and every hit knocks it back, a headshot most. At ${fol.thresholds.join(', ')} per cent, ${fans.perThreshold} fans arrive; at ${fol.viral} she goes viral and ${fans.viralCount} more do. Fans are weak Mall Walkers and pay nothing.`,
      `Within ${flash.range} metres she charges her phone flash for ${flash.windupSeconds} seconds. It only blinds you if you are facing her.`,
    ],
    tip: 'Ignore the fans and keep shooting her: steady hits hold the count down, and the fans leave when she does. Turn away when the flash warning appears.',
  }),
];

export const guideSections = [
  { id: 'customers', name: 'Customers', blurb: 'Persons on the premises after closing.' },
  { id: 'management', name: 'Management', blurb: 'Colleagues. Approach with a prepared statement.' },
];

const byId = new Map(guideEntries.map((entry) => [entry.id, entry]));
export const guideEntry = (id) => byId.get(id) ?? null;

/** Which page a zombie belongs on: a boss by its id, a gold Mascot on its own page, a Mascot by its costume. */
export function guideEntryId(type) {
  if (!type) return null;
  const id = type.boss ? type.id : type.gold ? 'employeeOfTheMonth' : type.variant ?? type.id;
  return byId.has(id) ? id : null;
}

/** 0 = not seen, 1 = the memo, 2 = field notes, 3 = the tip (the page is complete). */
export function guideStage(entry, { seen, kills }) {
  if (!seen && !entry.alwaysSeen && kills <= 0) return 0;
  return kills >= entry.tipAt ? 3 : kills >= entry.notesAt ? 2 : 1;
}

export const guideNotices = {
  // (stage 2 or 3 reached during a shift: the PA says the book has a new paragraph)
  pa: (name, stage) => ({
    kicker: 'Staff Survival Guide',
    text: stage >= 3 ? `${name}: page complete. You are now considered the expert. Our condolences.` : `${name}: field notes added. Thank you for your research.`,
  }),
};

export const guideDebug = {
  usage: "Use g.guide.debug(entryId, 'add', amount), 'see', 'complete', or 'clear'",
  unknown: 'No such page in the Survival Guide',
  invalidAmount: 'Kills must be a positive whole number',
  changed: (name, kills, stage) => `${name}: ${kills} kills, stage ${stage} of 3`,
  cleared: (name) => `${name}: page torn out`,
};

export const guide = {
  title: 'Staff Survival Guide', menu: 'Survival guide', kicker: 'Human Resources · Read before your shift, if there is time',
  form: 'SG / TRAINING · HANDBOOK 4-B', back: 'Back',
  hint: 'Arrow keys / D-pad to browse · Escape / B to return',
  previewLabel: 'Subject, turning slowly',
  unknownName: '???', unknownTitle: 'Not yet encountered', unknownBody: 'No associate has returned with a description.',
  memoHeading: 'Staff memo', notesHeading: 'Field notes', tipHeading: 'How to survive it', factsHeading: 'On file',
  health: (multiplier) => multiplier === 1 ? 'The baseline' : `${Number(multiplier.toFixed(2))}× a Shopper`,
  facts: { health: 'Health', firstSeen: 'First appears', kills: 'Cleared by you' },
  locked: (heading, left) => `${heading}: ${left} more to clear`,
  rowStatus: (stage) => ['', '★', '★★', '★★★'][stage],
  sectionCount: (done, total) => `${done} / ${total} complete`,
  theme: { ink: '#302b30', paper: '#f4ead7', edge: '#b8a98e', stamp: '#9a3f53', selected: '#e8d9c1', highlight: '#93556a', lockedPaper: '#dedbd4', lockedInk: '#625e59' },
  preview: {
    width: 360, height: 420, pixelRatio: 1.5, background: 0x211c2b,
    fov: 30, near: 0.05, far: 40, framing: 1.25, rotationSpeed: 0.5,
    initialYaw: 2.6, camera: [0, 0.18, 1],
    sky: 0xfff0d8, ground: 0x655474, ambientIntensity: 2,
    key: 0xffffff, keyIntensity: 3, keyPosition: [2, 3, 2],
  },
};
