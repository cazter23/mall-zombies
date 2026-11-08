// BUILD-A-BLASTER PLAYTEST: the REAL game, headless, with a bot that fights a pack of shoppers walking down the main hallway at it.
// It stands still aiming down sights at the nearest one (head some of the time, real spread, real reloads) until the pack is dead, and compares:
//   a plain gun, Extended Warranty tiers, and Build-A-Blaster builds (the quality's gun power-up AND the stuffing + Heart).
// The bot never moves, so slows are undervalued, and it lands headshots more often than most players: trust the ORDER and the size of the gaps, not the percentages.
//
//   npm run balance:bab                     Nail Gun, rounds 8, 12, 16
//   node tools/babReport.mjs rivetRifle 8,12 14 3      gun, rounds, pack size, runs each
//   ALL=1 node tools/babReport.mjs          every stuffing x Heart pair (slow)
//   ONLY="fryer|Deluxe" node tools/babReport.mjs       only the rows whose name matches (plain is always run)
//
// Targets (docs/history.md, the BAB power pass): a Regular build clears a wave clearly faster than Deluxe; every stuffing helps (faster, or far less damage taken).
import { headlessGame } from '../tests/helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { withTier, buildModifiers } from '../src/weapons/upgrades.js';
import { zombieHealthFor, economy } from '../src/config/economy.js';
import { workshopRitual, workshopStuffings, workshopHearts } from '../src/config/workshop.js';

const GUN = process.argv[2] ?? 'nailGun';
const ROUNDS = (process.argv[3] ?? '8,12,16').split(',').map(Number);
const PACK = Number(process.argv[4] ?? 14);
const SEEDS = Number(process.argv[5] ?? 3);
const HEAD_CHANCE = 0.35; // how often the bot goes for the head
const LIMIT_S = 120;

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run({ round, tier = 'standard', build = null, seed }) {
  const t = headlessGame(), { g, input } = t;
  t.tick();
  Math.random = mulberry(seed * 7919 + round); // (after the map is built: see CLAUDE.md)
  g.rounds.update = () => {};
  g.powerUps.update = () => {}; // no drops: an Insta-Kill would swamp the comparison
  g.zombies.clear();
  g.map.areaUnlocks.openAll();
  let taken = 0;
  g.health.takeDamage = (amount) => { taken += amount; }; // counted, never dies
  g.gun.give(weapons[GUN]); t.tick(50);
  const id = g.gun.def.id;
  let mods = withTier(weapons[GUN], [], tier);
  if (build) {
    const quality = workshopRitual.qualities.find((q) => q.id === build.quality);
    mods = [...mods, { id: 'build', build: { ...build, kills: 0 }, modifiers: buildModifiers(weapons[GUN], workshopStuffings[build.stuffing].color, quality.gun) }];
  }
  g.gun.setMods(id, mods);
  g.gun.weapon.refill();
  t.tick(30);
  t.standAt(-14, 2, -90); // the west end of the hallway, looking east
  const pack = [];
  for (let i = 0; i < PACK; i++) {
    const z = g.zombies.spawn('shopper', g.player.position.clone().set(14 + (i % 4) * 1.4, 0, 0.2 + Math.floor(i / 4) * 1.3));
    z.health = z.maxHealth = zombieHealthFor('shopper', round);
    pack.push(z);
  }
  const eye = g.player.position.clone(), point = g.player.position.clone();
  let target = null, aimHead = false, reroll = 0, tick = 0, procs = 0;
  g.events.on('buildFired', () => { procs++; });
  while (pack.some((z) => z.isAlive) && tick < LIMIT_S * 60) {
    tick++;
    g.gun.weapon.reserve = 999;
    if (!target?.isAlive || --reroll <= 0) {
      const alive = pack.filter((z) => z.isAlive && z.state !== 'spawning');
      target = alive.sort((a, b) => a.position.distanceToSquared(g.player.position) - b.position.distanceToSquared(g.player.position))[0] ?? null;
      aimHead = Math.random() < HEAD_CHANCE;
      reroll = 30;
    }
    if (target) {
      const box = target.hitboxes.find((h) => h.part === (aimHead ? 'head' : 'body')) ?? target.hitboxes[0];
      box.box.getCenter(point);
      eye.copy(g.player.position); eye.y += g.player.eyeHeight;
      const dx = point.x - eye.x, dy = point.y - eye.y, dz = point.z - eye.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      input.held.add('Mouse2');
      if (tick % 2) { input.pressed.add('Mouse0'); input.held.add('Mouse0'); } else input.held.delete('Mouse0'); // (semi-autos fire on presses)
    } else input.held.delete('Mouse0');
    if (g.gun.weapon.magazine === 0 && !g.gun.weapon.isReloading) input.pressed.add('KeyR');
    g.update(1 / 60);
  }
  const result = { seconds: tick / 60, cleared: !pack.some((z) => z.isAlive), taken, procs };
  g.map.dispose?.();
  return result;
}

const stuffingIds = Object.keys(workshopStuffings), heartIds = Object.keys(workshopHearts);
const CONFIGS = [
  { label: 'plain', cost: 0 },
  ...['deluxe', 'premium', 'platinum'].map((tier) => ({ label: tier, tier, cost: Object.entries(economy.upgrades.tiers).filter(([k]) => ['deluxe', 'premium', 'platinum'].indexOf(k) <= ['deluxe', 'premium', 'platinum'].indexOf(tier)).reduce((s, [, v]) => s + v, 0) })),
  ...(process.env.ALL
    ? stuffingIds.flatMap((stuffing) => heartIds.map((heart) => ({ label: `${stuffing}+${heart}`, build: { stuffing, heart, quality: 'regular' }, cost: economy.upgrades.workshop.ritual })))
    : stuffingIds.map((stuffing) => ({ label: `${stuffing}+${workshopStuffings[stuffing].defaultHeart}`, build: { stuffing, heart: workshopStuffings[stuffing].defaultHeart, quality: 'regular' }, cost: economy.upgrades.workshop.ritual }))),
  { label: 'fryerOil+headshot Understuffed', build: { stuffing: 'fryerOil', heart: 'headshot', quality: 'understuffed' }, cost: economy.upgrades.workshop.ritual },
  { label: 'fryerOil+headshot Overstuffed', build: { stuffing: 'fryerOil', heart: 'headshot', quality: 'overstuffed' }, cost: economy.upgrades.workshop.ritual },
  { label: 'Deluxe + fryerOil+headshot', tier: 'deluxe', build: { stuffing: 'fryerOil', heart: 'headshot', quality: 'regular' }, cost: economy.upgrades.tiers.deluxe + economy.upgrades.workshop.ritual },
];

const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
console.log(`${weapons[GUN].name}: ${PACK} shoppers, ${SEEDS} runs each, the bot goes for the head ${HEAD_CHANCE * 100}% of the time`);
for (const round of ROUNDS) {
  const rows = [];
  let base = null;
  for (const c of CONFIGS) {
    if (only && !only.test(c.label) && c.label !== 'plain') continue;
    const runs = Array.from({ length: SEEDS }, (_, i) => run({ ...c, round, seed: i + 1 }));
    const avg = (k) => runs.reduce((s, r) => s + r[k], 0) / runs.length;
    const seconds = avg('seconds'), taken = avg('taken');
    if (!base) base = { seconds, taken };
    rows.push({
      config: c.label, cost: c.cost, 'clear s': seconds.toFixed(1), faster: `${Math.round((base.seconds / seconds - 1) * 100)}%`,
      'dmg taken': Math.round(taken), procs: Math.round(avg('procs')), uncleared: runs.filter((r) => !r.cleared).length,
    });
  }
  console.log(`\nROUND ${round} (shopper hp ${zombieHealthFor('shopper', round)})`);
  console.table(rows);
}
