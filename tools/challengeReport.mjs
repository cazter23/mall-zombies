// =============================================================================
// CHALLENGE REPORT:  npm run sim:challenges        (weapon skins phase 8; docs/weapon-skins-plan.md "Measure and tune")
// How much of each weapon skin challenge a run gives, and so how many runs it takes. It PLAYS the real game headless with the economy bot
// (tools/economyBot.js: read its header for what the bot is not), once per gun the bot can use, that gun bought early and carried as its
// main gun, and reads the game's OWN challenge counters (game/challenges.js). In the process that plays, every challenge's target is lifted
// out of reach (in memory only), so a counter shows its raw value: a running total, or a feat's best attempt (a round's kills, a streak,
// the bosses in a run). Nothing in src/config changes.
//
//   npm run sim:challenges                       3 seeds per gun to round 20, 3 at a time (about 15 to 25 minutes)
//   npm run sim:challenges -- --quick            1 seed per gun to round 12 (a few minutes; too noisy to tune from)
//   npm run sim:challenges -- --seeds=4 --rounds=25 --workers=2 --skill=average
//   npm run sim:challenges -- --skill=sharp --guns=rivetRifle,foamDartBlaster   the good bot aiming every shot at the head (headshot feats)
// Progress goes to stderr and the tables (markdown) to stdout.
//
// What it cannot see (say so wherever its numbers are quoted):
//   - The bot only fires hitscan guns without pellets or a charge (no Confetti Cannon, Barcode Scanner, Leaf Blower, Tennis Ball Launcher,
//     Return to Sender), and never aims for range, bank shots or full-health targets on purpose: those challenges are listed unmeasured.
//   - Its runs are IMMORTAL (a lethal hit refills health), so "survive" feats (reach a round on one gun, a round unhurt) mean nothing here;
//     the round of the bot's first death is shown as a rough guide to how far that plan gets in one life.
//   - A real player chooses a challenge and plays for it; the bot plays the same way every time. Read the numbers as "a run that ignores
//     the challenge": how far it gets by accident, the floor of what a run gives.
// =============================================================================

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skins, challengeText } from '../src/config/skins.js';
import { weapons } from '../src/config/weapons.js';

const here = fileURLToPath(import.meta.url);
const root = resolve(dirname(here), '..');
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = (name, fallback = null) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : fallback; };
const LIFTED = 1e9; // every challenge's target, in the playing process: nothing unlocks and no best attempt is capped

// ---------------------------------------------------------------------------------------------------------------------------------
// THE PLANS: per gun the bot can use, a buy order that makes it the main gun (its wall's area, the gun, then its warranty all the way).
// ---------------------------------------------------------------------------------------------------------------------------------
const tiers = (gun, n) => Array.from({ length: n }, () => ({ type: 'tier', gun }));
const door = area => ({ type: 'door', area });
function plansFor() {
  return {
    stapleGun: [door('hallway'), ...tiers('stapleGun', 8)],
    priceGun: [{ type: 'gun', id: 'priceGun' }, door('hallway'), ...tiers('priceGun', 8)],
    nailGun: [door('hallway'), { type: 'gun', id: 'nailGun', replace: 'stapleGun' }, ...tiers('nailGun', 8)],
    foamDartBlaster: [door('hallway'), door('megaMart'), { type: 'gun', id: 'foamDartBlaster', replace: 'stapleGun' }, ...tiers('foamDartBlaster', 8)],
    rivetRifle: [door('hallway'), door('atrium'), { type: 'gun', id: 'rivetRifle', replace: 'stapleGun' }, ...tiers('rivetRifle', 8)],
    coilNailer: [{ type: 'gun', id: 'priceGun' }, door('hallway'), door('upstairs'), door('cinema'), { type: 'gun', id: 'coilNailer', replace: 'stapleGun' }, ...tiers('coilNailer', 8)],
  };
}
const PLANS = plansFor();
// ---------------------------------------------------------------------------------------------------------------------------------
// ONE RUN (a child process: --job=<base64 json>): progress at the start of every round (= after the round before it), and at the end.
// ---------------------------------------------------------------------------------------------------------------------------------
if (option('job')) {
  const job = JSON.parse(Buffer.from(option('job'), 'base64url').toString());
  for (const list of Object.values(skins)) for (const skin of list) skin.challenge.count = LIFTED;
  const { runBot, SKILLS } = await import('./economyBot.js');
  const skill = job.skill === 'sharp' ? { ...SKILLS.good, head: 1 } : job.skill;
  const byRound = [];
  const result = runBot({
    seed: job.seed, skill, plan: PLANS[job.gun], maxRound: job.rounds + 1, immortal: true,
    onGame(g) {
      g.events.on('roundStart', ({ round }) => byRound.push({ round, progress: structuredClone(g.challenges.snapshot().progress) }));
    },
  });
  const firstDeath = result.rounds.find(r => r.deaths > 0)?.round ?? null;
  writeFileSync(job.out, JSON.stringify({ job, byRound, outcome: result.outcome, reached: result.round, firstDeath, deaths: result.rounds.reduce((n, r) => n + r.deaths, 0) }));
  process.exit(0);
}

const UNMEASURED = Object.keys(skins).filter(gunId => !PLANS[gunId]);

// ---------------------------------------------------------------------------------------------------------------------------------
// THE RUNS
// ---------------------------------------------------------------------------------------------------------------------------------
const QUICK = flag('quick');
const SEEDS = Number(option('seeds', QUICK ? 1 : 3));
const ROUNDS = Number(option('rounds', QUICK ? 12 : 20));
const WORKERS = Number(option('workers', QUICK ? 2 : 3));
const SKILL = option('skill', 'good');
const scratch = join(root, 'scratch', 'challenge-report');
mkdirSync(scratch, { recursive: true });

const GUNS = option('guns', null)?.split(',') ?? Object.keys(PLANS);
const jobs = GUNS.flatMap(gun => Array.from({ length: SEEDS }, (_, i) => ({
  gun, seed: i + 1, skill: SKILL, rounds: ROUNDS, out: join(scratch, `${gun}-${SKILL}-${i + 1}-r${ROUNDS}.json`),
})));

function play(job) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [here, `--job=${Buffer.from(JSON.stringify(job)).toString('base64url')}`], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
    child.on('exit', code => (code === 0 ? done(JSON.parse(readFileSync(job.out, 'utf8'))) : fail(new Error(`${job.gun} seed ${job.seed}: exit ${code}`))));
  });
}

const started = Date.now();
const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    results.push(await play(job));
    process.stderr.write(`  ${results.length}/${jobs.length} ${job.gun} seed ${job.seed} (${Math.round((Date.now() - started) / 1000)} s)\n`);
  }
}));

// ---------------------------------------------------------------------------------------------------------------------------------
// THE TABLES
// ---------------------------------------------------------------------------------------------------------------------------------
const CHECKPOINTS = [10, 15, 20, 25, 30].filter(r => r <= ROUNDS);
// Progress after clearing round r: the snapshot taken as round r + 1 began.
const after = (run, r, gunId, skinId) => { const at = run.byRound.find(entry => entry.round === r + 1); return at ? at.progress?.[gunId]?.[skinId] ?? 0 : null; };
const mean = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const fmt = (x, digits = 1) => (x === null ? '-' : Number.isInteger(x) ? String(x) : x.toFixed(digits));
const out = [];
const line = text => out.push(text);

line(`# Weapon skin challenges: what a run gives (${SKILL} bot, ${SEEDS} seed${SEEDS > 1 ? 's' : ''} per gun, immortal, to round ${ROUNDS})`);
line('');
line('Each gun is the bot\'s main gun from its first break (tools/challengeReport.mjs PLANS). A running total shows what a run to that round adds;');
line('a feat shows the best attempt the run made by then. "Runs" = runs to that round needed to complete it (a feat: done in that run or not).');
line('');
line(`| Gun | Slot | Skin | Challenge | Target | ${CHECKPOINTS.map(r => `R${r}`).join(' | ')} | Runs (R15) | Runs (R20) |`);
line(`|---|---|---|---|---|${CHECKPOINTS.map(() => '---|').join('')}---|---|`);
for (const gunId of GUNS) {
  const runs = results.filter(r => r.job.gun === gunId);
  for (const skin of skins[gunId]) {
    const original = skin.challenge.count; // (this process never lifted it)
    const feat = skin.slot === 3;
    const at = r => mean(runs.map(run => after(run, r, gunId, skin.id)).filter(v => v !== null));
    const runsTo = r => {
      const v = at(r);
      if (v === null) return '-';
      if (feat) return v >= original ? '1' : 'never';
      return v > 0 ? fmt(original / v) : 'never';
    };
    line(`| ${weapons[gunId].name} | ${skin.slot} | ${skin.name} | ${challengeText({ ...skin.challenge, count: original }, weapons[gunId].name)} | ${original} | ${CHECKPOINTS.map(r => fmt(at(r))).join(' | ')} | ${runsTo(15)} | ${runsTo(20)} |`);
  }
}
line('');
line('Met by accident: a challenge of a gun the bot did NOT choose as its main gun, completed or advanced anyway (it still fires its starting Staple Gun, and a few plans carry the Price Gun).');
line('');
line('| Played as | Challenge | Best value by the last round |');
line('|---|---|---|');
for (const gunId of Object.keys(PLANS)) {
  const runs = results.filter(r => r.job.gun === gunId);
  for (const [otherId, list] of Object.entries(skins)) {
    if (otherId === gunId) continue;
    for (const skin of list) {
      const best = Math.max(0, ...runs.map(run => run.byRound.at(-1)?.progress?.[otherId]?.[skin.id] ?? 0));
      if (best > 0) line(`| ${weapons[gunId].name} | ${weapons[otherId].name} · ${skin.name} | ${fmt(best)} (target ${skin.challenge.count}) |`);
    }
  }
}
line('');
line('| Played as | Rounds reached | Bot\'s first death (round), per seed | Deaths in the run |');
line('|---|---|---|---|');
for (const gunId of Object.keys(PLANS)) {
  const runs = results.filter(r => r.job.gun === gunId);
  line(`| ${weapons[gunId].name} | ${runs.map(r => r.reached).join(', ')} | ${runs.map(r => r.firstDeath ?? 'none').join(', ')} | ${runs.map(r => r.deaths).join(', ')} |`);
}
line('');
line(`Not measured (the bot cannot use them): ${UNMEASURED.map(id => weapons[id].name).join(', ')}.`);
process.stdout.write(out.join('\n') + '\n');
process.stderr.write(`done in ${Math.round((Date.now() - started) / 1000)} s\n`);
