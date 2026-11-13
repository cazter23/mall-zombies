// =============================================================================
// THE STAFF SURVIVAL GUIDE: a permanent log of every zombie type and boss, opened from the title (ui/guide.js).
// A page appears when its subject is first seen, and fills in by KILLS across all shifts (game/guide.js counts them,
// game/guideSave.js keeps them): the memo at once, the field notes at `notesAt` kills, the tip at `tipAt`.
// TWO VOICES: the memo is the company's printed page; the notes and the tip are a survivor's handwriting on top of it
// (first person, in pen, then a sticky note). Keep them apart when adding a page.
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
const { shopper, shoplifter, mallWalker, cartPusher, mannequin } = zombieTypes;
const theft = shoplifter.theft;
const mascot = zombieTypes.mascot.mascot;
const { janitor, guard, manager, influencer, lastCustomer } = bossTypes;
const rewardName = (id) => bossVouchers[id]?.name ?? powerUps.types?.[id]?.name ?? null;
const titleCase = (text) => text.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

// One costume's page. `twist` = its field note beyond the shared Mascot beats.
function mascotPage(variant, { memo, afterPop = `then it RUNS at ${mascot.exposedSpeed} m/s`, twist, tip, notesAt = 3, tipAt = 12 }) {
  return {
    id: variant, section: 'customers', type: mascotTypes[variant], name: mascotVariants[variant].name, title: 'Mascot',
    health: mix.mascot.healthMultiplier, firstSeen: `Round ${mascotVariants[variant].unlockRound}`, notesAt, tipAt, memo,
    notes: [
      `Slow (${mascotTypes[variant].speed} m/s) and padded. At ${pct(mascot.healthFraction)} health the helmet pops off, it shakes for a moment, ${afterPop}. I walk at ${feel.movement.walkSpeed}.`,
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
    firstSeen: type.firstRounds ? `Round ${rounds(type.firstRounds)}` : 'Closing Time', notesAt: 1, tipAt: 3, ...page,
    notes: [...page.notes, reward ? `Left behind when I got them: ${titleCase(reward)}.` : null].filter(Boolean),
  };
}

const lock = guard.lockdown, meet = manager.meeting, report = manager.report;
const fol = influencer.followers, fans = influencer.fans, flash = influencer.flash;
const reclaim = mascotVariants.captainCoupon.reclaim, pop = mascotVariants.poppyCorn.popBlast, salt = mascotVariants.twisty.saltPatch;

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
      `They walk straight at me and swing when they get close. ${shopper.attack.damage} damage a hit.`,
      'Later on some of them jog, then run. They all swing sooner too.',
    ],
    tip: 'A headshot does more than a body shot with most guns, twice as much or more on some. Let them bunch up in a doorway and aim high.',
  },
  {
    id: 'shoplifter', section: 'customers', type: shoplifter, name: 'Shoplifter', title: 'Unpaid customer',
    health: mix.shoplifter.healthMultiplier, firstSeen: `Round ${mix.shoplifter.fromRound}`, notesAt: 25, tipAt: 100,
    memo: 'Hood up, bag open, never once at a register. Loss Prevention has a file on every one of them. The file is also missing.',
    notes: [
      `It jogs at ${shoplifter.speed} m/s, slower than I back away. Its hit is only ${shoplifter.attack.damage}, but it takes ${pct(theft.fraction)} of my points with it (at least ${theft.min}, at most ${theft.max}).`,
      `Then it runs for it at ${theft.fleeSpeed} m/s with a gold coin over its head. I sprint faster. After ${theft.fleeSeconds} seconds it is gone, and so are my points.`,
    ],
    tip: 'Shoot it first. If it does get a hand in the till, sprint after it: drop it before it gets away and every point comes back.',
  },
  {
    id: 'mallWalker', section: 'customers', type: mallWalker, name: 'Mall Walker', title: 'Fitness enthusiast',
    health: mix.mallWalker.healthMultiplier, firstSeen: 'Boss backup', notesAt: 25, tipAt: 150,
    memo: 'Has completed eleven thousand laps of the upper level. Stops for nothing, except, briefly, their own lungs.',
    notes: [
      `FAST. ${mallWalker.speed} m/s. I walk at ${feel.movement.walkSpeed} and sprint at ${feel.movement.sprintSpeed}, so backing away doesn't work.`,
      `After every swing, hit or miss, it stops to pant for ${mallWalker.winded.standSeconds} seconds, then follows at ${pct(mallWalker.winded.slowSpeedFraction)} speed for a moment.`,
    ],
    tip: 'Let it swing at you and step out of reach, then shoot while it has its hands on its knees.',
  },
  {
    id: 'cartPusher', section: 'customers', type: cartPusher, name: 'Cart Pusher', title: 'Trolley operator',
    health: mix.cartPusher.healthMultiplier, firstSeen: `Round ${mix.cartPusher.fromRound}`, notesAt: 15, tipAt: 75,
    memo: 'Customer and trolley have been inseparable since the incident in the adhesives aisle.',
    notes: [
      `Give it a clear lane from ${cartPusher.charge.minRange} to ${cartPusher.charge.maxRange} metres and it stops, rattles the cart for ${cartPusher.charge.telegraphSeconds} seconds, then charges dead straight. ${cartPusher.charge.damage} damage.`,
      "It picks its direction when the rattle ends. It won't charge through furniture.",
    ],
    tip: `Sidestep the charge. A miss leaves it slumped over the cart for ${cartPusher.charge.crashSeconds} seconds, taking ${extra(cartPusher.charge.crashDamageTakenMultiplier)} more damage.`,
  },
  {
    id: 'mannequin', section: 'customers', type: mannequin, name: 'Mannequin', title: 'Window display',
    health: mix.mannequin.healthMultiplier, firstSeen: `Round ${mix.mannequin.fromRound}`, notesAt: 10, tipAt: 40,
    memo: 'Was not in that position yesterday. Was not on that floor yesterday. Visual Merchandising deny all knowledge.',
    notes: [
      `Can't move while I'm looking at it. Does ${mannequin.speed} m/s when I'm not. That's faster than I walk.`,
      `Never seen more than ${mix.mannequin.maxAlive} at once.`,
    ],
    tip: 'Kill it first, or keep it on screen while you deal with the rest. The click you hear is one coming unstuck.',
  },
  mascotPage('sirWaffles', {
    memo: 'The Food Court\'s breakfast knight. The costume was rented by the hour. The hour has been going on for some time.',
    twist: `Never more than ${mix.mascot.maxAlive} Mascots at once, whatever they're wearing.`,
    tip: 'Do the first half of the damage from a distance, and have somewhere to run before the helmet comes off.',
  }),
  mascotPage('captainCoupon', {
    memo: 'Mega Mart\'s discount superhero. His coupons expired some time ago. Legal would like it noted that so did he.',
    afterPop: 'then he goes back for it instead of running',
    twist: `After the helmet pops he hurries back and puts it on again. That puts him back at ${pct(reclaim.reclaimHealthFraction)} health. He only manages it once.`,
    tip: `Shoot him while he is bent over the helmet: his head is bare. Or stand within ${reclaim.guardRadius} metres of it yourself and he gives up and rushes you.`,
  }),
  mascotPage('poppyCorn', {
    memo: 'The Sunset Cinema\'s usher. Patrons are reminded to silence their phones, their children and their screaming.',
    twist: `Her helmet goes off like a bomb. Zombies within ${pop.zombieRadius} metres get flung and stunned for ${pop.stunSeconds} seconds. Within ${pop.playerRadius} metres I get shoved too. Nobody takes damage from it.`,
    tip: 'Pop her from range while she is standing in a crowd, and the blast does your crowd control for you.',
  }),
  mascotPage('scoops', {
    memo: 'The Atrium\'s soda-fountain mascot, currently melting. Please mind the floor. It is mostly strawberry.',
    twist: "Leaves a trail of melt puddles that slow me down. Drips twice as fast once the cone's off.",
    tip: 'Never retreat along the path he arrived by. Lead him somewhere you do not plan to stand.',
  }),
  mascotPage('twisty', {
    memo: "The Food Court pretzel stand's ambassador, still shedding rock salt from the warmer. Housekeeping filed a complaint six months ago.",
    twist: `Drops a patch of coarse salt crystals for ${salt.lifeSeconds} seconds when his helmet pops. Won't hurt or slow me. Anything walking through it crunches, him included, so a crunch I didn't make means he's close.`,
    tip: 'When you hear salt crunch underfoot and cannot see him, check behind you: his helmet is already off and he is sprinting.',
  }),
  {
    id: 'employeeOfTheMonth', section: 'customers', type: mascotGoldTypes.sirWaffles, name: 'Employee of the Month', title: 'Gold Mascot',
    health: mix.mascot.healthMultiplier * mascotGold.healthMultiplier, firstSeen: `Round ${mascotGold.fromRound}`, notesAt: 1, tipAt: 3,
    memo: 'Twelve consecutive months. Nobody else was nominated. Nobody else was available.',
    notes: [
      `From round ${mascotGold.fromRound} any Mascot can turn up in gold (${pct(mascotGold.chance)} of the time). ${extra(mascotGold.healthMultiplier)} tougher, same costume underneath. Never two at once.`,
      'Always drops a power-up where it falls.',
    ],
    tip: 'Worth dropping everything for. Kill it somewhere you can reach the body.',
  },

  bossPage(janitor, {
    memo: 'Thirty-one years of service. Has never once been thanked. Has noticed.',
    notes: [
      `Chases and swings like a Shopper with a mop. ${janitor.attack.damage} damage a hit.`,
      `Leaves wet patches behind him, up to ${janitor.wetFloor.maxPatches} at once, ${janitor.wetFloor.seconds} seconds each. Standing in one cuts me to ${pct(janitor.wetFloor.speedFraction)} speed.`,
    ],
    tip: 'Fight him in a big room and back away in a wide circle, not a straight line: his puddles are always where he has just been.',
  }),
  bossPage(guard, {
    memo: 'Has apprehended four shoplifters and one very surprised delivery driver. Considers survival to be suspicious behaviour.',
    notes: [
      `Charges from ${guard.charge.minRange} to ${guard.charge.maxRange} metres like a Cart Pusher, after a chime. ${guard.charge.damage} damage, and the taser slows me to ${pct(guard.taserSlow.speed)} speed for ${guard.taserSlow.seconds} second.`,
      `At ${lock.thresholds.map(pct).join(' and ')} health he calls a lockdown. ${lock.alarmSeconds} second alarm, then the shutters round whatever area I'm standing in close for ${lock.seconds} seconds and ${lock.backup} ${lock.backupType === 'mallWalker' ? 'Mall Walkers' : 'zombies'} join in.`,
    ],
    tip: `${lock.headshots} headshots during the alarm or the lockdown break his radio: the shutters open and he can never call another. Dodge a charge and he is stunned for ${guard.charge.crashSeconds} seconds, taking ${extra(guard.charge.crashDamageTakenMultiplier)} more damage.`,
  }),
  bossPage(manager, {
    memo: 'Would like a quick word. Please budget the rest of your life. His door is always open; that is how they got in.',
    notes: [
      `Every ${report.interval} seconds he picks up to ${report.maxTargets} zombies near him and makes them ${extra(report.speed)} faster for ${report.seconds} seconds.`,
      `At ${meet.thresholds.map(pct).join(' and ')} health he calls a Staff Meeting. He and the zombies near him stand still for ${meet.seconds} seconds and he takes ${extra(meet.damageTaken)} more damage. If it finishes, every zombie in the mall is ${extra(meet.speed)} faster and hits ${extra(meet.damage)} harder for ${meet.buffSeconds} seconds.`,
    ],
    tip: `Take ${pct(meet.cancelFraction)} of his health off during a meeting and it is cancelled: no bonus for them, and he is stunned for ${meet.stunSeconds} seconds. Save a full magazine for it.`,
  }),
  bossPage(influencer, {
    memo: 'Is filming. Was always filming. Engagement is up eleven per cent since the incident, which she describes as "a rebrand".',
    notes: [
      `Never attacks. Aims for a spot ${influencer.filming.minRange} to ${influencer.filming.maxRange} metres away and shifts every ${influencer.filming.relocateSeconds} seconds.`,
      `Her follower count climbs on its own and every hit knocks it back, a headshot most. At ${fol.thresholds.join(', ')} per cent, ${fans.perThreshold} fans arrive; at ${fol.viral} she goes viral and ${fans.viralCount} more do. Fans are weak Mall Walkers and pay nothing.`,
      `Within ${flash.range} metres she charges her phone flash for ${flash.windupSeconds} seconds. It only blinds me if I'm facing her.`,
    ],
    tip: 'Ignore the fans and keep shooting her: steady hits hold the count down, and the fans leave when she does. Turn away when the flash warning appears.',
  }),
  bossPage(lastCustomer, {
    memo: 'Has a receipt. Has been waiting since before closing, and would like that noted. Associates are reminded that the customer is always right, and in this case also always there.',
    notes: [
      `Turns up in Customer Parking the round after I validate parking. Charges like a Cart Pusher, ${lastCustomer.charge.damage} damage, and swings for ${lastCustomer.attack.damage} up close.`,
      `At ${lastCustomer.backup.thresholds.map(pct).join(' and ')} health, ${lastCustomer.backup.count} Mall Walkers arrive to back her up.`,
      `Shooting her does NOT finish her. At the end of her health she goes Speechless for ${lastCustomer.speechlessSeconds} seconds. Miss that and she's back at ${pct(lastCustomer.recoverHealthFraction)}.`,
    ],
    tip: `While she is Speechless, return her: one shot from Return to Sender, or walk up and hold use for ${lastCustomer.handReturn.holdSeconds} seconds to stamp her by hand. Clear the Mall Walkers first so you can reach her. Dodge a charge and she is stunned for ${lastCustomer.charge.crashSeconds} seconds, taking ${extra(lastCustomer.charge.crashDamageTakenMultiplier)} more damage.`,
  }),
];

export const guideSections = [
  { id: 'customers', name: 'Customers', blurb: 'Persons on the premises after closing.' },
  { id: 'management', name: 'Management', blurb: 'Colleagues. Approach with a prepared statement.' },
  // (no guideEntries here: derived directly from config/powerUps.js types)
  { id: 'incentives', name: 'Incentives', blurb: 'Perks, vouchers and jackpots dropped onto the floor.' },
  // (no guideEntries here: its pages are the items of config/lostFound.js and the summary they unlock)
  { id: 'lostFound', name: 'Lost & Found', blurb: 'Property handed in. Owners have not come forward.' },
];

export const incentiveEntries = Object.entries(powerUps.types).map(([id, def], index) => ({
  id,
  incentiveId: id,
  section: 'incentives',
  number: index + 1,
  name: def.name,
  tier: def.tier,
  tierLabel: def.tier === 'jackpot' ? 'Jackpot drop' : 'Common incentive',
  color: def.color,
  icon: def.icon ?? 'ticket',
  summary: def.summary ?? def.hint ?? '',
  paText: def.pa?.text ?? '',
  paKicker: def.pa?.kicker ?? 'Employee incentive',
}));
const incentiveById = new Map(incentiveEntries.map((entry) => [entry.id, entry]));
export const incentiveEntry = (id) => incentiveById.get(id) ?? null;

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

// The screen (ui/guide.js). It looks like nothing else in the menus on purpose: a vinyl ring binder holding the company's
// printed handbook, with a survivor's pen, sticky notes and rubber stamps on top. Colours: `theme` (CSS variables
// --guide-<name>); the layout is in ui/retail.css.
export const guide = {
  title: 'Staff Survival Guide', menu: 'Survival guide', kicker: 'Property of Human Resources · Do not remove from the break room',
  back: 'Close the binder',
  hint: 'Arrow keys / D-pad to turn pages · Escape / B to close',
  previewLabel: 'Subject, turning slowly',
  // One printed sheet per section: its heading, its form number, and (Management) an extra line on file.
  sheets: {
    customers: { heading: 'Customer incident report', form: 'SG / LOSS PREVENTION · FORM 109-C' },
    management: { heading: 'Personnel file', form: 'SG / HUMAN RESOURCES · FORM 22-P', status: ['Employment status', 'Ongoing, regrettably'] },
    incentives: { heading: 'Associate benefit memo', form: 'SG / PAYROLL & PERKS · FORM 44-B' },
    lostFound: { heading: 'Lost property log', form: 'SG / CUSTOMER SERVICE · FORM 7-L' },
  },
  incentives: {
    unknownName: '???',
    itemOf: (number, total) => `Employee incentive · ${number} of ${total}`,
    unknownTitle: 'Program not yet claimed',
    unknownBody: 'Pick up this incentive during a shift to file its benefit terms and PA notice.',
    blankFields: ['Program', 'Tier', 'Terms'],
    tierLabel: 'Classification',
    firstRoundLabel: 'Earliest round',
    effectHeading: 'What it does',
    paHeading: 'PA announcement',
    exhibit: (number) => `PERK ${String(number).padStart(2, '0')}`,
    stamps: ['Unclaimed', 'Issued'],
    sectionCount: (done, total) => `${done}/${total} incentives found`,
  },
  // The Lost & Found pages. No hints, on purpose: an item not yet found shows only its number.
  lost: {
    unknownName: '— not recovered —', itemOf: (number, total) => `Lost property · item ${number} of ${total}`,
    unknownBody: 'Not yet handed in. It is somewhere in the mall. No description is on file.',
    blankFields: ['Item', 'Found in', 'Handed in by'],
    facts: { area: 'Found in', owner: 'Claimed by' }, noOwner: 'Nobody, to date',
    tagHeading: 'Property tag',
    stamps: ['Not recovered', 'Logged'], reportStamps: ['Sealed', 'Case closed'],
    exhibit: (number) => number ? `EXHIBIT ${String(number).padStart(2, '0')}` : '',
    sealedName: '— sealed —', sealedTitle: 'Incident summary · restricted',
    sealedBody: (found, total) => `This file opens when all ${total} items of lost property have been logged. ${found} of ${total} so far.`,
    sectionCount: (done, total) => `${done} / ${total} recovered`,
  },
  letterhead: 'Sunset Galleria · Associate Handbook',
  pageOf: (page, total) => `Page ${page} of ${total}`,
  cctv: (camera) => `CAM ${String(camera).padStart(2, '0')} ● REC`,
  // The rubber stamp on a page, by stage (0 = not seen).
  stamps: ['No report filed', 'Sighted', 'Documented', 'Resolved'],
  rowStatus: (stage) => ['', '✓', '✓✓', '✓✓✓'][stage],
  unknownName: '— no report —', unknownTitle: 'Subject not yet encountered',
  unknownBody: 'No associate has returned with a description. If you are the first, please complete this form in block capitals.',
  blankFields: ['Name of subject', 'Description', 'Last seen', 'Risk to staff'],
  memoHeading: 'Staff memo', factsHeading: 'On file',
  notesHeading: "what I've seen —", tipHeading: 'How to survive it',
  health: (multiplier) => multiplier === 1 ? 'The baseline' : `${Number(multiplier.toFixed(2))}× a Shopper`,
  facts: { health: 'Health', firstSeen: 'First appears', kills: 'Cleared by you' },
  // Pencilled where the handwriting will go, until there are enough kills to write it.
  lockedNotes: (left) => `(${left} more and I'll know what I'm looking at)`,
  lockedTip: (left) => `(${left} more before I'd give anyone advice)`,
  // Tally marks in the margin: up to tallyMax strokes, then just the number.
  tallyMax: 25, tallyTotal: (kills) => `= ${kills}`,
  sectionCount: (done, total) => `${done} / ${total} complete`,
  turnSound: 'pageTurn',
  theme: {
    binder: '#3b2a3d', binderEdge: '#241826', binderStitch: '#7d6480', label: '#f4ead7',
    paper: '#f7f0df', paperEdge: '#cbbd9f', rule: '#d9ccb0', ink: '#2c272c', faint: '#7b7168',
    stamp: '#9a3f53', selected: '#e8d9c1', tab: '#d8c7a6', tabInk: '#3a3136',
    biro: '#1f3f8f', pencil: '#8a857c', marker: '#b3262b', sticky: '#ffe66e', stickyEdge: '#e2c63c',
    stampSighted: '#3c5f8a', stampDocumented: '#3f7a4d', stampResolved: '#b3262b', stampNone: '#8a857c',
    polaroid: '#fbf8f0', tape: 'rgba(238, 222, 160, .78)',
  },
  preview: {
    width: 250, height: 290, pixelRatio: 1.5, background: 0x1b1f24,
    fov: 30, near: 0.05, far: 40, framing: 1.25, propFraming: 1.5, rotationSpeed: 0.5,
    initialYaw: 2.6, camera: [0, 0.18, 1],
    sky: 0xfff0d8, ground: 0x655474, ambientIntensity: 2,
    key: 0xffffff, keyIntensity: 3, keyPosition: [2, 3, 2],
  },
};
