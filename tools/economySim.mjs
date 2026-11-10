// =============================================================================
// ECONOMY REPORT:  npm run sim:economy        (docs/economy-report.md is written from its tables)
// How many points a run pays, round by round, and what a sensible buyer can afford when. It PLAYS the real game headless with a bot
// (tools/economyBot.js: read its header for what the bot is not) following a buy order (tools/economyPlans.js), many seeds in parallel,
// and sets the maths beside it (tools/economyModel.js). It can also play under a PROPOSAL: config numbers changed in memory only, so a
// before/after table is measured without touching src/config.
//
//   npm run sim:economy                      every run set, every table (about an hour and a half the first time: a run to round 30 is slow;
//                                            finished runs are kept in scratch/economy-sim/ and reused until the game's code or that plan changes)
//   npm run sim:economy -- --quick           2 seeds to round 10 and 4 mortal seeds: every table in a few minutes, too noisy to quote
//   npm run sim:economy -- --set=baseline    only some run sets (baseline, survival, cheap, nobab, claw, after), comma separated
//   npm run sim:economy -- --seeds=8 --mortal-seeds=40 --rounds=30 --workers=10
//   npm run sim:economy -- --fresh           play everything again
//   npm run sim:economy -- --tables          no bot: only the tables that are pure maths (guns, the upgrade ladder, the proposals' config side)
// Progress goes to stderr and the tables (markdown) to stdout:  npm run --silent sim:economy > scratch/economy-tables.md
// A new buyable: a step type in the bot, steps in a plan. A new idea to price: an entry in PROPOSALS.
// =============================================================================

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { economy, zombieHealthForRound, zombieCountForRound } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { PLANS, PROPOSALS, applyOverrides, withProposal } from './economyPlans.js';
import { loadoutGun, gunDps, roundIncome, pointsPerZombie, upgradeLadder, healthGrowth } from './economyModel.js';
import { sustainedDps, shotsToKill } from './balance.js';

const here = fileURLToPath(import.meta.url);
const root = resolve(dirname(here), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback = null) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : fallback; };

// ---------------------------------------------------------------------------------------------------------------------------------
// ONE RUN (a child process: `--job=<base64 json>`). The proposal's numbers go in before the game is built.
// ---------------------------------------------------------------------------------------------------------------------------------
if (option('job')) {
  const job = JSON.parse(Buffer.from(option('job'), 'base64url').toString());
  const { runBot } = await import('./economyBot.js');
  applyOverrides(PROPOSALS[job.proposal].overrides);
  const result = runBot({ seed: job.seed, skill: job.skill, plan: PLANS[job.plan], maxRound: job.rounds, immortal: !job.mortal });
  result.rounds = result.rounds.filter((r) => r.round <= job.rounds); // (the round it stopped in has only just begun)
  writeFileSync(job.out, JSON.stringify({ job, ...result }));
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// THE RUN SETS
// ---------------------------------------------------------------------------------------------------------------------------------
const QUICK = flag('quick');
const ROUNDS = Number(option('rounds', QUICK ? 10 : 30));
const SEEDS = Number(option('seeds', QUICK ? 2 : 8)); // immortal runs of the baseline
const FEW = Math.max(2, Math.round(SEEDS / 2)); // immortal runs of each variant and proposal
const MORTAL_SEEDS = Number(option('mortal-seeds', QUICK ? 4 : 40)); // (20 was too few: one-life runs are that noisy)
const CLAW_ROUNDS = Math.min(ROUNDS, 15); // the claw is an early-game question
const WORKERS = Number(option('workers', Math.max(1, Math.min(10, cpus().length - 2))));
const AFTER = ['priceGun', 'bab', 'babPrice', 'warranty', 'claw', 'all']; // the proposals that get played
const MORTAL_ONLY = ['priceGun62', 'bab3000']; // ...and those played for survival only (no runs to round 30)

const group = (set, plan, skill, mortal, rounds, proposal, seeds) => ({ set, plan, skill, mortal, rounds, proposal, seeds });
const GROUPS = [
  group('baseline', 'SENSIBLE', 'good', false, ROUNDS, 'none', SEEDS),
  group('baseline', 'SENSIBLE', 'average', false, ROUNDS, 'none', SEEDS),
  group('survival', 'SENSIBLE', 'good', true, 30, 'none', MORTAL_SEEDS),
  group('survival', 'SENSIBLE', 'average', true, 30, 'none', MORTAL_SEEDS),
  group('cheap', 'PRICE_GUN_ONLY', 'good', false, ROUNDS, 'none', FEW),
  group('nobab', 'NO_BAB', 'good', false, ROUNDS, 'none', FEW),
  group('nobab', 'NO_BAB', 'good', true, 30, 'none', MORTAL_SEEDS),
  group('claw', 'CLAW_FIRST', 'good', false, CLAW_ROUNDS, 'none', SEEDS),
  group('claw', 'SENSIBLE', 'good', false, CLAW_ROUNDS, 'none', SEEDS),
  group('claw', 'CLAW_FIRST', 'good', true, 30, 'none', MORTAL_SEEDS),
  ...MORTAL_ONLY.map((id) => group('after', PROPOSALS[id].plan ?? 'SENSIBLE', 'good', true, 30, id, MORTAL_SEEDS)),
  group('after', PROPOSALS.all.plan, 'average', true, 30, 'all', MORTAL_SEEDS),
  ...AFTER.flatMap((id) => {
    const plan = PROPOSALS[id].plan ?? 'SENSIBLE';
    const rounds = id === 'claw' ? CLAW_ROUNDS : ROUNDS;
    return [group('after', plan, 'good', false, rounds, id, id === 'claw' ? SEEDS : FEW), group('after', plan, 'good', true, 30, id, MORTAL_SEEDS)];
  }),
];
const wantedSets = option('set')?.split(',') ?? null;
const groups = GROUPS.filter((g) => !wantedSets || wantedSets.includes(g.set));

// A finished run is reused while nothing it depends on has changed: the game, the bot, and that group's plan and proposal.
function codeHash() {
  const hash = createHash('sha1');
  const files = readdirSync(join(root, 'src'), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js')).map((e) => join(e.parentPath, e.name)).sort();
  for (const file of [...files, join(root, 'tools/economyBot.js'), join(root, 'tools/balance.js'), join(root, 'tests/helpers/headlessGame.js')]) hash.update(readFileSync(file));
  return hash.digest('hex');
}
const CODE = flag('tables') ? 'none' : codeHash();
const outDir = join(root, 'scratch', 'economy-sim');
const keyOf = (g) => {
  const what = createHash('sha1').update(CODE + JSON.stringify(PLANS[g.plan]) + JSON.stringify(PROPOSALS[g.proposal].overrides)).digest('hex').slice(0, 10);
  return `${g.plan}-${g.skill}-${g.mortal ? 'mortal' : 'immortal'}-r${g.rounds}-${g.proposal}-${what}`;
};
const jobsOf = (g) => Array.from({ length: g.seeds }, (_, i) => ({
  plan: g.plan, skill: g.skill, mortal: g.mortal, rounds: g.rounds, proposal: g.proposal, seed: i + 1, out: join(outDir, `${keyOf(g)}-s${i + 1}.json`),
}));

async function playAll() {
  mkdirSync(outDir, { recursive: true });
  const seen = new Set();
  const pending = groups.flatMap(jobsOf).filter((j) => (flag('fresh') || !existsSync(j.out)) && !seen.has(j.out) && seen.add(j.out));
  // the long runs first, so the last workers aren't left with one 5-minute run each
  pending.sort((a, b) => (b.mortal ? 8 : b.rounds) - (a.mortal ? 8 : a.rounds));
  const total = pending.length;
  if (!total) return;
  process.stderr.write(`economy sim: ${total} runs to play on ${WORKERS} workers\n`);
  let done = 0;
  const started = Date.now();
  const worker = async () => {
    while (pending.length) {
      const job = pending.shift();
      const encoded = Buffer.from(JSON.stringify(job)).toString('base64url');
      const { code, err } = await new Promise((res) => {
        const child = spawn(process.execPath, [here, `--job=${encoded}`], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
        let text = '';
        child.stderr.on('data', (d) => { text += d; });
        child.on('close', (c) => res({ code: c, err: text }));
      });
      done++;
      const name = `${job.plan} ${job.skill} ${job.mortal ? 'mortal' : 'immortal'} ${job.proposal} seed ${job.seed}`;
      process.stderr.write(`  [${done}/${total}] ${code === 0 ? 'ok  ' : 'FAIL'} ${name} (${Math.round((Date.now() - started) / 1000)} s)\n`);
      if (code !== 0) process.stderr.write(`${err.split('\n').slice(0, 6).join('\n')}\n`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKERS, total) }, worker));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// READING THE RUNS
// ---------------------------------------------------------------------------------------------------------------------------------
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sorted = (a) => [...a].sort((x, y) => x - y);
const quantile = (a, q) => { const s = sorted(a); if (!s.length) return NaN; const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo); };
const n0 = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '-');
const n1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const n2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '-');
const span = (a, f = n0) => (a.length ? `${f(Math.min(...a))} to ${f(Math.max(...a))}` : '-');
const meanSpan = (a, f = n0) => (a.length ? `${f(mean(a))} (${span(a, f)})` : '-');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const out = (text = '') => process.stdout.write(`${text}\n`);

/** A group's finished runs, each with running totals by round: cum[r] = everything up to and including round r. */
function load(g) {
  const runs = [];
  for (const job of jobsOf(g)) {
    if (!existsSync(job.out)) continue;
    const run = JSON.parse(readFileSync(job.out, 'utf8'));
    const ammoByRound = {};
    for (const p of run.purchases) if (p.label.startsWith('ammo:')) ammoByRound[p.round] = (ammoByRound[p.round] ?? 0) + p.cost;
    run.byRound = {};
    run.cum = { 0: { earned: 0, spent: 0, seconds: 0, deaths: 0, ammo: 0 } };
    let c = run.cum[0];
    for (const r of run.rounds) {
      r.ammo = ammoByRound[r.round] ?? 0;
      run.byRound[r.round] = r;
      c = { earned: c.earned + r.earned, spent: c.spent + r.spent, seconds: c.seconds + r.seconds, deaths: c.deaths + r.deaths, ammo: c.ammo + r.ammo };
      run.cum[r.round] = c;
    }
    // What a round was FOUGHT with: the bot records its loadout as the round number flips, before that break's shopping, so the guns it
    // fought round N with are the ones recorded as round N + 1 began (the last round: what it ended with).
    run.rounds.forEach((r, i) => { r.fought = run.rounds[i + 1]?.loadout ?? run.loadout; });
    runs.push(run);
  }
  const usable = runs.filter((r) => (g.mortal ? r.outcome === 'died' || r.outcome === 'maxRound' : r.outcome === 'maxRound'));
  usable.broken = runs.length - usable.length; // stuck or timed out: left out, and said so
  usable.group = g;
  return usable;
}
const find = (set, plan, skill, mortal, proposal = 'none') => groups.find((g) => g.set === set && g.plan === plan && g.skill === skill && g.mortal === mortal && g.proposal === proposal);
const runsOf = (...spec) => { const g = find(...spec); return g ? load(g) : Object.assign([], { broken: 0, group: null }); };
const at = (runs, round, fn) => runs.filter((r) => r.byRound[round]).map((r) => fn(r.byRound[round], r));
const cumAt = (runs, round, field) => runs.filter((r) => r.cum[round]).map((r) => r.cum[round][field]);
const noteBroken = (runs) => (runs.broken ? ` (${runs.broken} run${runs.broken > 1 ? 's' : ''} got stuck and ${runs.broken > 1 ? 'are' : 'is'} left out)` : '');

// The best gun a run carries in a round, upgrades applied (resolved once per distinct loadout entry and proposal).
const gunMemo = new Map();
let memoTag = 'none';
const gunFor = (entry) => {
  const key = `${memoTag}|${entry.id}|${entry.tier}|${entry.renewals}|${entry.build}`;
  if (!gunMemo.has(key)) gunMemo.set(key, loadoutGun(entry));
  return gunMemo.get(key);
};
const bestGun = (loadout) => loadout.map(gunFor).sort((a, b) => gunDps(b) - gunDps(a))[0];
/** Run `fn` with a proposal's numbers in place (its tables read config). */
const under = (proposal, fn) => withProposal(proposal, () => { memoTag = proposal; try { return fn(); } finally { memoTag = 'none'; } });

// ---------------------------------------------------------------------------------------------------------------------------------
// WHAT THINGS ARE CALLED AND WHAT THEY COST (shelf prices, read now: a proposal in place changes them)
// ---------------------------------------------------------------------------------------------------------------------------------
const AREA_NAMES = { hallway: 'Start shutter', atrium: 'Grand Atrium', upstairs: 'Promenade', departmentStore: "HOFFMAN'S", foodCourt: 'Food Court',
  cinema: 'Cinema', megaMart: 'Mega Mart', serviceCorridor: 'Service Corridor', parkingLot: 'Customer Parking' };
const TIERS = upgrades.tiers.slice(1);
/** [{ name, price }] for a plan, in order. The n-th 'tier' step for a gun is its n-th warranty tier, then its Renewals. */
function describePlan(plan) {
  const tierCount = {}, babCount = {};
  let melee = 0;
  return plan.map((step) => {
    if (step.type === 'door') return { name: `Door: ${AREA_NAMES[step.area] ?? step.area}`, price: economy.doors[step.area] };
    if (step.type === 'gun') return { name: weapons[step.id].name, price: economy.wallBuys[step.id].weapon };
    if (step.type === 'tier') {
      const n = tierCount[step.gun] = (tierCount[step.gun] ?? 0) + 1;
      const tier = TIERS[n - 1];
      return tier ? { name: `${weapons[step.gun].name}: ${tier.name}`, price: economy.upgrades.tiers[tier.id], tier: tier.id, gun: step.gun }
        : { name: `${weapons[step.gun].name}: Renewal ${n - TIERS.length}`, price: economy.upgrades.renewals[n - TIERS.length - 1], renewal: n - TIERS.length, gun: step.gun };
    }
    if (step.type === 'bab') {
      const again = babCount[step.gun] = (babCount[step.gun] ?? 0) + 1;
      return { name: `${weapons[step.gun].name}: Build-A-Blaster`, price: economy.upgrades.workshop[again > 1 ? 'restuff' : 'ritual'], build: true, gun: step.gun };
    }
    if (step.type === 'melee') { const tier = upgrades.melee[melee++]; return { name: tier.name, price: economy.upgrades.melee[tier.id] }; }
    if (step.type === 'wardrobe') return { name: `Apparel: ${step.id}`, price: economy.wardrobe[step.id] };
    if (step.type === 'attachment') return { name: `Attachment: ${step.id}`, price: economy.upgrades.attachments[step.id] };
    if (step.type === 'claw') return { name: `GRAB-A-GUN x${step.grabs ?? 1}`, price: (step.grabs ?? 1) * economy.claw.grab };
    return { name: step.type, price: 0 };
  });
}

/** Points a buyer could have spent on the list by round R's break: the start, plus everything earned before it, less the ammo bought. */
const disposable = (runs, round) => economy.startingPoints + mean(cumAt(runs, round - 1, 'earned')) - mean(cumAt(runs, round, 'ammo'));
/** The first round whose break can pay `cost` in total, on a group's average income (null: not by the last round played). */
function affordRound(runs, cost, lastRound) {
  for (let round = 1; round <= lastRound; round++) if (disposable(runs, round) >= cost) return round;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// THE TABLES
// ---------------------------------------------------------------------------------------------------------------------------------
function incomeTable(good, average, rounds) {
  out(`### Income by round (SENSIBLE plan, immortal; ${good.length} good-skill runs, ${average.length} average-skill runs)${noteBroken(good)}${noteBroken(average)}`);
  out('Earned = points paid in that round. Min to max is across seeds. Model = the wave killed with the best gun carried, by the maths (no bosses, no power-ups, no knife).');
  out();
  const rows = [];
  for (let round = 1; round <= rounds; round++) {
    const model = at(good, round, (r) => {
      const def = bestGun(r.fought);
      return roundIncome(def, round, { headShare: r.kills ? r.headshotKills / r.kills : 0 }).points;
    });
    rows.push([
      round, zombieCountForRound(round), n0(zombieHealthForRound(round)),
      meanSpan(at(good, round, (r) => r.earned)), n0(mean(cumAt(good, round, 'earned'))),
      n0(mean(at(good, round, (r) => r.earned))) === '-' ? '-' : n0(mean(model)),
      n0(mean(at(good, round, (r) => r.seconds))), n0(mean(at(good, round, (r) => (r.seconds ? (r.earned / r.seconds) * 60 : 0)))),
      meanSpan(at(average, round, (r) => r.earned)), n0(mean(cumAt(average, round, 'earned'))), n0(mean(at(average, round, (r) => r.seconds))),
    ]);
  }
  out(table(['Round', 'Zombies', 'Shopper hp', 'Good: earned (min to max)', 'Good: total so far', 'Model', 'Good: seconds', 'Good: points a minute',
    'Average: earned (min to max)', 'Average: total so far', 'Average: seconds'], rows));
  out();
}

function sourcesTable(runs, rounds) {
  out(`### Where the points come from (good skill, ${runs.length} runs)`);
  out('Hits = +10 for each hit that does not kill. Kills = kill values and their headshot or box cutter bonuses. Other = helmet pops and vouchers paid out as points.');
  out();
  const rows = [];
  for (let from = 1; from <= rounds; from += 5) {
    const to = Math.min(rounds, from + 4);
    const sum = { hits: 0, kills: 0, bosses: 0, other: 0, earned: 0, killCount: 0, head: 0, melee: 0, shots: 0, hitsLanded: 0 };
    for (const run of runs) for (let r = from; r <= to; r++) {
      const x = run.byRound[r];
      if (!x) continue;
      for (const k of ['hits', 'kills', 'bosses', 'other']) sum[k] += x.income[k];
      sum.earned += x.earned; sum.killCount += x.kills; sum.head += x.headshotKills; sum.melee += x.meleeKills;
    }
    rows.push([`${from} to ${to}`, n0(sum.earned / runs.length), pct(sum.hits / sum.earned), pct(sum.kills / sum.earned), pct(sum.bosses / sum.earned), pct(sum.other / sum.earned),
      n0(sum.earned / sum.killCount), pct(sum.head / sum.killCount), pct(sum.melee / sum.killCount)]);
  }
  out(table(['Rounds', 'Points (a run)', 'Hits', 'Kills', 'Bosses', 'Other', 'Points a kill', 'Headshot kills', 'Box cutter kills'], rows));
  out();
}

function buyerTable(good, average, plan, rounds) {
  out(`### What the sensible buyer owns when (strict buy order; the round whose break it was bought in)`);
  out('Curve = the first round whose break could pay for everything down to that line on the average income (start + earned before - ammo). Bought = when the bot did. "-" = not by the last round.');
  out();
  const steps = describePlan(plan);
  let total = 0;
  const rows = steps.map((step, i) => {
    total += step.price;
    const roundsOf = (runs) => runs.map((r) => r.steps[i]?.round).filter((x) => x !== null && x !== undefined);
    const got = (runs) => { const a = roundsOf(runs); return a.length ? `${n1(mean(a))} (${span(a)})${a.length < runs.length ? ` in ${a.length}/${runs.length}` : ''}` : '-'; };
    return [i + 1, step.name, n0(step.price), n0(total), affordRound(good, total, rounds) ?? '-', got(good),
      ...(average.length ? [affordRound(average, total, rounds) ?? '-', got(average)] : [])];
  });
  out(table(['#', 'Purchase', 'Price', 'Total so far', 'Good: curve', 'Good: bought (min to max)', ...(average.length ? ['Average: curve', 'Average: bought (min to max)'] : [])], rows));
  out();
}

function budgetTable(good, average, rounds) {
  out('### What a buyer has had to spend by each round');
  out('Spendable so far = the start, plus everything earned in earlier rounds, less the ammo bought: what a whole shopping list could have cost by the break of that round. Use it to place a new price: a thing costing X on top of a list is affordable in the first round where the list + X fits.');
  out();
  const rows = [];
  for (let round = 1; round <= rounds; round++) {
    rows.push([round, n0(disposable(good, round)), round > 1 ? n0(mean(at(good, round - 1, (r) => r.earned))) : '-',
      n0(disposable(average, round)), round > 1 ? n0(mean(at(average, round - 1, (r) => r.earned))) : '-']);
  }
  out(table(['Round (its break)', 'Good: spendable so far', 'Good: the round before paid', 'Average: spendable so far', 'Average: the round before paid'], rows));
  out();
}

function bankTable(runs, rounds) {
  out(`### Spending and the bank (good skill, ${runs.length} runs)`);
  out('Bank = points in hand as the round number flips, before that break\'s shopping. Ammo is part of Spent.');
  out();
  const rows = [];
  for (let round = 1; round <= rounds; round++) {
    rows.push([round, n0(mean(at(runs, round, (r) => r.earned))), n0(mean(at(runs, round, (r) => r.spent))), n0(mean(at(runs, round, (r) => r.ammo))),
      n0(mean(at(runs, round, (r) => r.bank))), n0(mean(cumAt(runs, round, 'earned'))), n0(mean(cumAt(runs, round, 'spent')))]);
  }
  out(table(['Round', 'Earned', 'Spent', 'of it ammo', 'Bank at the start', 'Earned so far', 'Spent so far'], rows));
  const done = runs.map((r) => Math.max(0, ...r.steps.map((s) => s.round ?? 0)));
  const unfinished = runs.filter((r) => r.steps.some((s) => s.round === null)).length;
  out();
  out(`Last purchase on the list: round ${meanSpan(done, n1)}${unfinished ? `; ${unfinished} of ${runs.length} runs never finished the list` : ''}.`);
  const last = Math.max(...done);
  if (last < rounds) {
    const earned = runs.map((r) => r.cum[rounds].earned - r.cum[last].earned), spent = runs.map((r) => r.cum[rounds].spent - r.cum[last].spent);
    out(`Rounds ${last + 1} to ${rounds}, after the last run finished its list: earned ${n0(mean(earned))}, spent ${n0(mean(spent))} (ammo). Unspent at the end: ${n0(mean(runs.map((r) => r.points)))}.`);
  }
  out();
}

function powerTable(runs, rounds, title = 'The power curve') {
  out(`### ${title} (good skill, ${runs.length} runs)`);
  out('Best gun = the strongest gun the round was fought with (bought in its break or earlier), with its warranty, Renewals and build (not a build\'s stuffing effect). Seconds a Shopper = its health / that gun\'s sustained dps: one target, nothing missed. Deaths = lethal hits an immortal bot took.');
  out();
  const base = gunDps(loadoutGun({ id: 'stapleGun' }));
  const rows = [];
  for (let round = 1; round <= rounds; round++) {
    const guns = at(runs, round, (r) => bestGun(r.fought));
    const dps = guns.map(gunDps);
    const names = at(runs, round, (r) => {
      const e = [...r.fought].sort((a, b) => gunDps(gunFor(b)) - gunDps(gunFor(a)))[0];
      return `${weapons[e.id].name}${e.tier !== 'standard' ? `, ${upgrades.tiers.find((t) => t.id === e.tier).name}` : ''}${e.renewals ? ` +${e.renewals}` : ''}${e.build ? ', built' : ''}`;
    });
    const counts = {};
    for (const name of names) counts[name] = (counts[name] ?? 0) + 1;
    const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const hp = zombieHealthForRound(round);
    rows.push([round, n0(hp), n1(hp / zombieHealthForRound(1)), common ? `${common[0]}${common[1] < names.length ? ` (${common[1]}/${names.length})` : ''}` : '-',
      n0(mean(dps)), n1(mean(dps) / base), n2(hp / mean(dps)), n0(mean(at(runs, round, (r) => r.seconds))), n1(mean(at(runs, round, (r) => r.deaths)))]);
  }
  out(table(['Round', 'Shopper hp', 'x round 1', 'Best gun (most runs)', 'Its dps', 'x Staple Gun', 'Seconds a Shopper', 'Round seconds', 'Deaths'], rows));
  out();
}

function gunsTable() {
  out('### Wall guns: what the route costs and what it buys');
  out('Route = the cheapest doors from the start room plus the gun. Sustained dps at 5 m, aimed (pellet guns from the hip), from tools/balance.js.');
  out();
  const ROUTES = { priceGun: [], nailGun: ['hallway'], foamDartBlaster: ['hallway', 'megaMart'], confettiCannon: ['hallway', 'serviceCorridor'],
    rivetRifle: ['hallway', 'atrium'], coilNailer: ['hallway', 'serviceCorridor', 'cinema'], barcodeScanner: ['departmentStore'] };
  const style = (d) => ({ ads: !d.pellets });
  const price = sustainedDps(weapons.priceGun, 5, style(weapons.priceGun));
  const rows = [['Staple Gun', 'start', '-', n0(sustainedDps(weapons.stapleGun, 5, { ads: true })), n2(sustainedDps(weapons.stapleGun, 5, { ads: true }) / price), '-', '-']];
  for (const [id, doors] of Object.entries(ROUTES)) {
    const d = weapons[id];
    const route = doors.reduce((s, a) => s + economy.doors[a], 0) + economy.wallBuys[id].weapon;
    const dps = sustainedDps(d, 5, style(d));
    rows.push([d.name, n0(economy.wallBuys[id].weapon), n0(route), n0(dps), n2(dps / price), n0(sustainedDps(d, 15, style(d))), n0(dps / (route / 1000))]);
  }
  out(table(['Gun', 'Price', 'Route', 'dps at 5 m', 'x Price Gun', 'dps at 15 m', 'dps per 1,000 of route'], rows));
  out();
}

function ladderRows() {
  return upgradeLadder().map((r) => [r.name, n0(r.cost), n0(r.spent), `x${n2(r.total)}`, `+${Math.round((r.step - 1) * 100)}%`, n0(r.pointsPerPercent), n1(r.rounds)]);
}
const LADDER_HEAD = ['Purchase', 'Price', 'Spent on this line', 'Damage in total', 'This step adds', 'Points per +1% damage', 'Rounds of zombie health it buys back'];
function ladderTable() {
  out('### Power upgrades: what a point buys');
  out(`"This step adds" is over the step before it on its own line (a build's is over no build). Zombie health grows x${healthGrowth()} a round from round ${economy.waves.health.linearUntilRound + 1}, so that many "rounds" is how long a step keeps a gun where it was. Warranty and build multiply together. A build also carries its stuffing effect, not counted here.`);
  out();
  out(table(LADDER_HEAD, ladderRows()));
  out();
}

function survivalTable(rows) {
  out('### Where mortal runs end');
  out('One life, the same bot. Reached = the share of runs that began that round. Owned a build = runs that had one when they died.');
  out();
  out(table(['Set-up', 'Runs', 'Died in round: mean', 'Median', 'Quarter to three-quarter', 'Min to max', 'Reached 8', 'Reached 10', 'Owned a build', 'Killed by (most often)'],
    rows.filter(([, runs]) => runs.length).map(([label, runs]) => {
      const died = runs.map((r) => r.round);
      const built = runs.filter((r) => r.loadout.some((g) => g.build)).length;
      const killers = {};
      for (const r of runs) killers[r.killedBy ?? 'nothing'] = (killers[r.killedBy ?? 'nothing'] ?? 0) + 1;
      const [killer, times] = Object.entries(killers).sort((a, b) => b[1] - a[1])[0];
      return [label, runs.length, n1(mean(died)), n1(quantile(died, 0.5)), `${n1(quantile(died, 0.25))} to ${n1(quantile(died, 0.75))}`, span(died),
        ...[8, 10].map((r) => pct(died.filter((d) => d >= r).length / died.length)), `${built}/${runs.length}`, `${killer} (${times})`];
    })));
  out();
}

/** One line per set-up at a third, two thirds and the end of its run: income, time, deaths. */
function momentsTable(title, note, rows, rounds) {
  const marks = [Math.round(rounds / 3), Math.round((rounds * 2) / 3), rounds];
  out(`### ${title}`);
  out(note);
  out();
  const head = ['Set-up', 'Runs', ...marks.map((m) => `Earned by round ${m}`), ...marks.map((m) => `Minutes to clear ${m}`),
    ...marks.map((m, i) => `Deaths, rounds ${(marks[i - 1] ?? 0) + 1} to ${m}`), 'Unspent at the end'];
  out(table(head, rows.filter(([, runs]) => runs.length).map(([label, runs]) => [
    label, `${runs.length}${runs.broken ? ` (+${runs.broken} stuck)` : ''}`,
    ...marks.map((m) => n0(mean(cumAt(runs, m, 'earned')))), ...marks.map((m) => n1(mean(cumAt(runs, m, 'seconds')) / 60)),
    ...marks.map((m, i) => n1(mean(runs.map((r) => r.cum[m].deaths - r.cum[marks[i - 1] ?? 0].deaths)))), n0(mean(runs.map((r) => r.points))),
  ])));
  out();
}

/** When a group reached each milestone of its own plan: the round whose break it was bought in, mean (min to max). */
function milestones(runs, planId) {
  const steps = describePlan(PLANS[planId]);
  const first = (pred) => steps.findIndex(pred);
  const lastTier = steps.reduce((acc, s, i) => (s.renewal ? i : acc), -1);
  const picks = { 'First build': first((s) => s.build), 'First Premium': first((s) => s.tier === 'premium'), 'First Platinum': first((s) => s.tier === 'platinum'),
    'Second gun built': steps.findIndex((s, i) => s.build && i > first((x) => x.build)), 'Last Renewal': lastTier };
  const cells = {};
  for (const [name, index] of Object.entries(picks)) {
    const got = index < 0 ? [] : runs.map((r) => r.steps[index]?.round).filter((x) => x !== null && x !== undefined);
    cells[name] = got.length ? `${n1(mean(got))} (${span(got)})${got.length < runs.length ? ` in ${got.length}/${runs.length}` : ''}` : '-';
  }
  return cells;
}
// --- The proposals' config side (pure maths) ---
const PRICE_GUN_DAMAGES = [70, 62, 58, 56, 52];
const PRICE_GUN_NOW = weapons.priceGun.damage;
function priceGunTable() {
  out('### A. Price Gun damage: candidates');
  out('Sustained dps aimed at a still Shopper (tools/balance.js). Body shots to kill at 5 m. Points a Shopper = +10 a non-lethal hit and the 60 kill value, body shots only.');
  out();
  const rows = PRICE_GUN_DAMAGES.map((damage) => {
    const restore = applyOverrides({ 'weapons.priceGun.damage': damage });
    try {
      const d = weapons.priceGun, dps = (g, m) => sustainedDps(g, m, { ads: true });
      const p5 = dps(d, 5);
      return [damage === PRICE_GUN_NOW ? `${damage} (today)` : damage, n0(p5), n0(dps(d, 15)), n0(dps(d, 30)), n2(p5 / dps(weapons.stapleGun, 5)), n2(dps(weapons.nailGun, 5) / p5),
        n2(dps(weapons.foamDartBlaster, 5) / p5), n2(dps(weapons.rivetRifle, 5) / p5), n2(dps(weapons.coilNailer, 5) / p5),
        ...[1, 5, 8, 10].map((round) => shotsToKill(d, zombieHealthForRound(round), 5, { ads: true })),
        ...[5, 10].map((round) => n0(pointsPerZombie(resolveBase(d), 'shopper', round)))];
    } finally { restore(); }
  });
  out(table(['Damage', 'dps 5 m', 'dps 15 m', 'dps 30 m', 'x Staple Gun', 'Nail Gun / it', 'Foam / it', 'Rivet / it', 'Coil / it',
    'Shots, round 1', 'round 5', 'round 8', 'round 10', 'Points a Shopper, round 5', 'round 10'], rows));
  out();
}
const resolveBase = (def) => loadoutGun({ id: def.id }); // (a fresh resolved copy: the model caches per object, and the damage just changed)

const BUILD_PRICES = [1500, 3000, 4000, 5000, 6000];
function buildPriceTable(good, average, rounds) {
  out('### B. Build-A-Blaster price: candidates');
  out('"Curve" = the first round whose break could pay for the whole list down to the first build on today\'s average income. Build first = the SENSIBLE order (Rivet Rifle, Deluxe, build); Premium first = the build after that gun\'s Premium. Rush = nothing but the Price Gun, the start shutter, the Promenade and the build (plus the Price Gun\'s Deluxe and Premium where a build needs Premium). Regular = the quality four kills in the room give.');
  out();
  const upTo = (planId) => { const steps = describePlan(PLANS[planId]); const i = steps.findIndex((s) => s.build); return steps.slice(0, i + 1).reduce((s, x) => s + x.price, 0); };
  const regular = upgradeLadder().find((r) => r.name.includes('Regular'));
  const premium = upgradeLadder().find((r) => r.name === 'Premium');
  const rows = BUILD_PRICES.map((price) => {
    const restore = applyOverrides({ 'economy.upgrades.workshop.ritual': price });
    try {
      const a = upTo('SENSIBLE'), b = upTo('BAB_AFTER_PREMIUM');
      const rush = economy.wallBuys.priceGun.weapon + economy.doors.hallway + economy.doors.upstairs + price, gated = rush + premium.spent;
      const when = (total) => [n0(total), affordRound(good, total, rounds) ?? '-', affordRound(average, total, rounds) ?? '-'];
      return [price === 1500 ? '1,500 (today)' : n0(price), n0(price / ((regular.total - 1) * 100)), n0(premium.spent / ((premium.total - 1) * 100)),
        ...when(a), ...when(b), ...when(rush), ...when(gated)];
    } finally { restore(); }
  });
  out(table(['Build price', 'Points per +1% (Regular build)', 'Points per +1% (Deluxe + Premium)', 'Build first: list total', 'Good: curve', 'Average: curve',
    'Premium first: list total', 'Good: curve', 'Average: curve', 'Rush: list total', 'Good: curve', 'Average: curve',
    'Rush, Premium needed: total', 'Good: curve', 'Average: curve'], rows));
  out();
}

function warrantyTable() {
  out('### C. Platinum and Renewals: today and proposed');
  out();
  out('Today:');
  out();
  out(table(LADDER_HEAD, ladderRows().filter((r) => !r[0].startsWith('Build'))));
  out();
  out(`Proposed (${PROPOSALS.warranty.label}):`);
  out();
  under('warranty', () => out(table(LADDER_HEAD, ladderRows().filter((r) => !r[0].startsWith('Build')))));
  out();
}

async function clawTable() {
  const { MODES, simulate, clawCostPerGun, wallRouteCost, POOL, CLAW_ENTRY } = await import('./clawOdds.js');
  const GRABS = QUICK ? 40_000 : 200_000;
  out('### D. Claw price: candidates');
  out(`From tools/clawOdds.js (${GRABS.toLocaleString('en-US')} simulated grabs per timing, nothing carried, shelf price). Value = the wall price of the gun won (a claw-only gun's nominal value). 3-in-4 = the wanted lane three times in four; timed = a press 0.12 s off on average.`);
  out();
  const runs = Object.fromEntries(MODES.map((mode) => [mode, simulate({ mode, grabs: GRABS, price: 1000 })]));
  const first = (m) => runs[m].firstGrab.valueSum / runs[m].firstGrab.grabs;
  const rows = [1000, 1250, 1500, 1750].map((price) => [
    price === economy.claw.grab ? `${n0(price)} (today)` : n0(price), n2(first('3-in-4') / price), n2(first('timed') / price), n2(first('random') / price),
    n2((runs['3-in-4'].valueSum / runs['3-in-4'].netSpent) * (1000 / price)), n0(CLAW_ENTRY + price),
    n2(Math.min(...POOL.filter((g) => !weapons[g.id]?.clawOnly).map((g) => (clawCostPerGun(g.id, { mode: 'perfect', grabs: GRABS / 4, price }) + CLAW_ENTRY) / wallRouteCost(g.id)))),
  ]);
  out(table(['Grab price', 'First grab: value / price (3-in-4)', '(timed)', '(random lane)', 'Whole site: value per point (3-in-4)', 'Start shutter + one grab',
    'Closest gun: claw (perfect) / its wall route'], rows));
  out();
}

function clawBotTable(rows) {
  out('### D. What the bot won from the claw (two grabs, straight after the start shutter)');
  out('The bot aims for the gun with the most dps it can use and leaves a prize that is no better than what it would replace.');
  out();
  out(table(['Set-up', 'Runs', 'First grab: round', 'Prizes (both grabs, all runs)', 'Spent on grabs (a run)', 'Carrying a Rivet Rifle or better by round 5', 'Rivet Rifle bought off the wall: round'],
    rows.filter(([, runs]) => runs.length).map(([label, runs]) => {
      const grabs = runs.flatMap((r) => r.purchases.filter((p) => p.label.startsWith('claw:')));
      const prizes = {};
      for (const g of grabs) prizes[g.label.slice(5)] = (prizes[g.label.slice(5)] ?? 0) + 1;
      const firstRound = runs.map((r) => r.purchases.find((p) => p.label.startsWith('claw:'))?.round).filter(Boolean);
      const strong = runs.filter((r) => r.byRound[5]?.fought.some((e) => gunDps(gunFor(e)) >= gunDps(gunFor({ id: 'rivetRifle', tier: 'standard', renewals: 0, build: null })))).length;
      const wall = runs.map((r) => r.purchases.find((p) => p.label === 'gun:rivetRifle')?.round).filter(Boolean);
      return [label, runs.length, firstRound.length ? meanSpan(firstRound, n1) : '-',
        Object.entries(prizes).sort((a, b) => b[1] - a[1]).map(([id, count]) => `${weapons[id.replace(' (left)', '')]?.name ?? 'Sunny (refund)'}${id.endsWith('(left)') ? ' (left)' : ''} ${count}`).join(', ') || '-',
        n0(mean(runs.map((r) => r.purchases.filter((p) => p.label.startsWith('claw:')).reduce((s, p) => s + p.cost, 0)))), `${strong}/${runs.length}`,
        wall.length ? `${n1(mean(wall))} in ${wall.length}/${runs.length}` : 'never'];
    })));
  out();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------------------------------------------------------------
if (!flag('tables')) await playAll();

out(`# Economy sim tables`);
out(`${QUICK ? 'QUICK RUN (too few seeds to quote). ' : ''}Immortal runs to round ${ROUNDS}: ${SEEDS} seeds a skill for the baseline, ${FEW} for each variant; ${MORTAL_SEEDS} mortal seeds a set-up. Start ${economy.startingPoints} points.`);
out();
gunsTable();
ladderTable();

const has = (set) => !flag('tables') && groups.some((g) => g.set === set);
const good = has('baseline') ? runsOf('baseline', 'SENSIBLE', 'good', false) : [];
const average = has('baseline') ? runsOf('baseline', 'SENSIBLE', 'average', false) : [];
if (good.length) {
  out('## Baseline');
  out();
  incomeTable(good, average, ROUNDS);
  sourcesTable(good, ROUNDS);
  buyerTable(good, average, PLANS.SENSIBLE, ROUNDS);
  budgetTable(good, average, ROUNDS);
  bankTable(good, ROUNDS);
  powerTable(good, ROUNDS);
}
const mortalRows = [];
if (has('survival')) mortalRows.push(['SENSIBLE, good skill', runsOf('survival', 'SENSIBLE', 'good', true)], ['SENSIBLE, average skill', runsOf('survival', 'SENSIBLE', 'average', true)]);
if (has('nobab')) mortalRows.push(['No build, good skill', runsOf('nobab', 'NO_BAB', 'good', true)]);
if (has('claw')) mortalRows.push(['Claw first, 1,000 a grab (today), good skill', runsOf('claw', 'CLAW_FIRST', 'good', true)]);
if (has('after')) for (const id of ['priceGun', 'priceGun62', 'bab3000', 'bab', 'babPrice', 'warranty', 'claw', 'all']) mortalRows.push([`${PROPOSALS[id].label}, good skill${PROPOSALS[id].plan === 'CLAW_FIRST' ? ' (claw-first buy order)' : ''}`, runsOf('after', PROPOSALS[id].plan ?? 'SENSIBLE', 'good', true, id)]);
if (has('after')) mortalRows.push([`${PROPOSALS.all.label}, average skill`, runsOf('after', PROPOSALS.all.plan, 'average', true, 'all')]);
if (mortalRows.some(([, runs]) => runs.length)) survivalTable(mortalRows);

if (good.length && (has('cheap') || has('nobab'))) {
  out('## Other buy orders (today\'s numbers)');
  out();
  const rows = [['SENSIBLE', good, 'SENSIBLE'], ['Price Gun and its warranty only', runsOf('cheap', 'PRICE_GUN_ONLY', 'good', false), 'PRICE_GUN_ONLY'], ['SENSIBLE without builds', runsOf('nobab', 'NO_BAB', 'good', false), 'NO_BAB']];
  momentsTable('Income, time and deaths by buy order', 'Good skill, immortal. Deaths = lethal hits taken (the difficulty a mortal player would not have survived).', rows, ROUNDS);
  const cheap = rows[1][1];
  if (cheap.length) powerTable(cheap, ROUNDS, 'The power curve on the Price Gun alone');
}

out('## Proposals: the config side');
out();
priceGunTable();
if (good.length) buildPriceTable(good, average, ROUNDS);
warrantyTable();
await clawTable();

if (has('after') && good.length) {
  out('## Proposals: played');
  out();
  const played = AFTER.filter((id) => id !== 'claw').map((id) => [PROPOSALS[id].label, runsOf('after', PROPOSALS[id].plan ?? 'SENSIBLE', 'good', false, id), PROPOSALS[id].plan ?? 'SENSIBLE', id]);
  momentsTable('Income, time and deaths under each proposal', 'Good skill, immortal. "Today" is the baseline above.', [['Today', good], ...played], ROUNDS);
  // milestone rounds read each proposal's own prices and plan
  out('### When the power purchases land under each proposal');
  out('The round whose break each was bought in: mean (min to max) over the runs. "-" = never, by the last round played.');
  out();
  const cells = [['Today', milestones(good, 'SENSIBLE')], ...played.filter(([, runs]) => runs.length).map(([label, runs, planId, id]) => [label, under(id, () => milestones(runs, planId))])];
  const names = Object.keys(cells[0][1]);
  out(table(['Set-up', ...names], cells.map(([label, c]) => [label, ...names.map((n) => c[n])])));
  out();
  const all = played.find(([, , , id]) => id === 'all');
  if (all?.[1].length) {
    under('all', () => {
      buyerTable(all[1], [], PLANS[all[2]], ROUNDS);
      bankTable(all[1], ROUNDS);
      powerTable(all[1], ROUNDS, 'The power curve with every proposal in');
    });
  }
}
if (has('claw')) {
  const today = runsOf('claw', 'CLAW_FIRST', 'good', false), wall = runsOf('claw', 'SENSIBLE', 'good', false);
  const dearer = has('after') ? runsOf('after', 'CLAW_FIRST', 'good', false, 'claw') : [];
  if (today.length) {
    out('## The claw, played');
    out();
    clawBotTable([['Claw first, 1,000 a grab (today)', today], [`Claw first, ${PROPOSALS.claw.label}`, dearer]]);
    momentsTable('The early game with and without the claw', 'Good skill, immortal, the same seeds.', [['No claw (SENSIBLE)', wall], ['Claw first, today', today], ['Claw first, dearer grab', dearer]], CLAW_ROUNDS);
  }
}
