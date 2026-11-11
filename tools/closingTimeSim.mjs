// npm run sim:closing -- --seeds=20 --workers=4
// Bounded child-process queue and content-addressed results, as in economySim.
// Each job plays independently; failures are fatal, never silently omitted.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closingTimeSim as cfg } from '../src/config/closingTimeSim.js';
import { economy } from '../src/config/economy.js';

const here = fileURLToPath(import.meta.url), root = resolve(dirname(here), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const positive = (name, fallback) => {
  const n = Number(option(name, fallback));
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a positive integer`);
  return n;
};
if (option('job')) {
  const job = JSON.parse(Buffer.from(option('job'), 'base64url'));
  const { runClosingBot } = await import('./closingTimeBot.js');
  const result = runClosingBot(job);
  if (Math.abs(result.points - (economy.startingPoints + result.earned - result.spent)) > Number.EPSILON)
    throw new Error('quest bot wallet does not balance');
  if (result.spent !== result.purchases.reduce((s, p) => s + p.cost, 0))
    throw new Error('quest bot has unlogged spending');
  if (result.quest.win && !result.quest.checklist.every(l => l.done))
    throw new Error('quest bot claims a win without the checklist');
  if (result.outcome === 'won' && job.immortal && result.quest.overtime.length !== job.overtime)
    throw new Error('quest bot stopped before finishing overtime');
  writeFileSync(job.out, JSON.stringify({ job, ...result }));
  process.exit(0);
}
const seeds = positive('seeds', cfg.seeds), workers = Math.min(cfg.workers, positive('workers', cfg.workers));
const hash = createHash('sha256');
for (const dir of ['src', 'tools']) {
  for (const file of readdirSync(join(root, dir), { recursive: true }).filter(f => /\.(js|mjs)$/.test(f)).sort()) {
    hash.update(file).update(readFileSync(join(root, dir, file)));
  }
}
hash.update(readFileSync(join(root, 'tests/helpers/headlessGame.js')));
const fingerprint = hash.digest('hex');
const output = resolve(root, option('out', 'scratch/closing-time-sim'));
mkdirSync(output, { recursive: true });
const groups = [];
for (const mode of option('modes', 'classic,directed').split(','))
  for (const immortal of [false, true])
    for (const skill of ['good', 'average'])
      for (const buyReturns of [false, true]) {
        if (!['classic', 'directed'].includes(mode)) throw new Error('unknown mode');
        if (option('life') && option('life') !== (immortal ? 'immortal' : 'mortal')) continue;
        if (option('skill') && option('skill') !== skill) continue;
        if (option('returns') && option('returns') !== (buyReturns ? 'yes' : 'no')) continue;
        groups.push({ mode, immortal, skill, buyReturns });
      }
const jobs = groups.flatMap(g => Array.from({ length: seeds }, (_, i) => {
  const key = `${g.mode}-${g.immortal ? 'immortal' : 'mortal'}-${g.skill}-${g.buyReturns ? 'returns' : 'hand'}-s${i + 1}`;
  return { ...g, seed: i + 1, overtime: cfg.overtimeRounds, maxRound: positive('rounds', cfg.maxRound),
    maxSeconds: positive('seconds', cfg.maxSeconds), out: join(output, `${key}.json`), fingerprint };
}));
const pending = jobs.filter(j => {
  if (!existsSync(j.out) || args.includes('--fresh')) return true;
  const old = JSON.parse(readFileSync(j.out));
  return JSON.stringify(old.job) !== JSON.stringify(j);
});
pending.sort((a, b) => Number(a.immortal) - Number(b.immortal));
let completed = jobs.length - pending.length;
const started = Date.now();
const children = new Set();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const child of children) child.kill();
  process.exit(1);
});
async function worker() {
  while (pending.length) {
    const job = pending.shift();
    await new Promise((res, reject) => {
      const child = spawn(process.execPath, [here, `--job=${Buffer.from(JSON.stringify(job)).toString('base64url')}`], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
      children.add(child);
      let err = '';
      child.stderr.on('data', d => { err += d; if (process.env.CLOSING_PROGRESS) process.stderr.write(d); });
      child.on('error', reject);
      child.on('close', code => { children.delete(child); code === 0 ? res() : reject(new Error(`${job.out}: ${err}`)); });
    });
    const run = JSON.parse(readFileSync(job.out));
    process.stderr.write(`[${++completed}/${jobs.length}] ${job.mode} ${job.skill} ${job.immortal ? 'immortal' : 'mortal'} ${job.buyReturns ? 'RTS' : 'hand'} s${job.seed}: ${run.outcome} r${run.round}, win ${run.quest.win?.round ?? '-'} (${Math.round((Date.now() - started) / 1000)}s elapsed)\n`);
  }
}
try { await Promise.all(Array.from({ length: Math.min(workers, pending.length) }, worker)); }
catch (error) { for (const child of children) child.kill(); throw error; }
const runs = jobs.map(j => JSON.parse(readFileSync(j.out)));
const report = closingReport(runs, fingerprint);
writeFileSync(join(output, 'report.md'), report);
writeFileSync(join(output, 'runs.json'), JSON.stringify(runs));
process.stdout.write(report);

function closingReport(runs, fingerprint) {
  const mean = values => values.length ? values.reduce((s, x) => s + x, 0) / values.length : null;
  const avg = (values, digits = 0) => mean(values)?.toFixed(digits) ?? '—';
  const counts = values => Object.entries(values.reduce((out, v) => { out[v] = (out[v] ?? 0) + 1; return out; }, {})).map(([k, n]) => `${k}: ${n}`).join(', ') || '—';
  const lines = [`# Closing Time measurements`, '', `Code fingerprint: ${fingerprint}. ${runs.length} independent runs; at most ${workers} workers.`, '',
    'Means among wins only; — means no wins. Quest share excludes area unlocks and optional RTS; the next column includes the RTS gun and its pre-win ammo. Starting points are not income.', '',
    '| Mode | Life | Skill | RTS | Wins / runs | Min to win | Win round | Points at win | Quest % income | Including RTS % | Finale entered | Finale deaths / entrants | Other outcomes |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const group of groups) {
    const rs = runs.filter(r => Object.entries(group).every(([k, v]) => r.job[k] === v));
    const wins = rs.filter(r => r.quest.win), entrants = rs.filter(r => r.quest.finale);
    const deaths = rs.filter(r => r.outcome === 'died' && r.quest.deaths.at(-1)?.stage === 'finale');
    lines.push(`| ${group.mode} | ${group.immortal ? 'immortal' : 'mortal'} | ${group.skill} | ${group.buyReturns ? 'yes' : 'no'} | ${wins.length}/${rs.length} | ${avg(wins.map(r => r.quest.win.seconds / 60), 1)} | ${avg(wins.map(r => r.quest.win.round), 1)} | ${avg(wins.map(r => r.quest.win.points))} | ${avg(wins.map(r => r.quest.win.share * 100), 1)} | ${avg(wins.map(r => r.quest.win.shareWithReturns * 100), 1)} | ${entrants.length} | ${deaths.length}/${entrants.length} | ${counts(rs.filter(r => r.outcome !== 'won').map(r => r.outcome))} |`);
  }
  lines.push('', '## Deaths and counterfactual lethal hits', '', '| Mode / life / skill / RTS | Death rounds | Causes | Stages | Finale lethal hits / exposed runs | Fountain seconds | Activations | Finale seconds |', '|---|---|---|---|---|---|---|---|');
  for (const group of groups) {
    const rs = runs.filter(r => Object.entries(group).every(([k, v]) => r.job[k] === v));
    const ds = rs.flatMap(r => r.quest.deaths), fs = rs.filter(r => r.quest.finale);
    lines.push(`| ${group.mode} / ${group.immortal ? 'immortal' : 'mortal'} / ${group.skill} / ${group.buyReturns ? 'yes' : 'no'} | ${counts(ds.map(d => d.round))} | ${counts(ds.map(d => d.cause))} | ${counts(ds.map(d => d.stage))} | ${ds.filter(d => d.stage === 'finale').length} / ${fs.filter(r => r.quest.deaths.some(d => d.stage === 'finale')).length} | ${avg(rs.filter(r => r.quest.fountainSeconds != null).map(r => r.quest.fountainSeconds), 1)} | ${avg(rs.filter(r => r.quest.fountainSeconds != null).map(r => r.quest.log.filter(e => e.name === 'purchase' && e.id === 'fountain').length), 1)} | ${avg(fs.filter(r => r.quest.finale.end).map(r => r.quest.finale.end - r.quest.finale.seconds), 1)} |`);
  }
  lines.push('', '## Overtime (completed rounds only)', '', '| Mode / skill / RTS | OT round | Samples | Income | Total spending | RTS ammo paid | Net banked | Bank at end |', '|---|---|---|---|---|---|---|---|');
  for (const group of groups.filter(g => g.immortal)) {
    const rs = runs.filter(r => Object.entries(group).every(([k, v]) => r.job[k] === v));
    for (let i = 1; i <= cfg.overtimeRounds; i++) {
      const rows = rs.flatMap(r => r.quest.overtime).filter(r => r.index === i);
      lines.push(`| ${group.mode} / ${group.skill} / ${group.buyReturns ? 'yes' : 'no'} | ${i} | ${rows.length} | ${avg(rows.map(r => r.earned))} | ${avg(rows.map(r => r.spent))} | ${avg(rows.map(r => r.ammo))} | ${avg(rows.map(r => r.banked))} | ${avg(rows.map(r => r.points))} |`);
    }
  }
  return lines.join('\n') + '\n';
}
