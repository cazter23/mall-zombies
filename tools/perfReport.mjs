// =============================================================================
// PERFORMANCE REPORT (npm run perf): how long one game tick takes at the worst moments.
// The real game, headless (tests/helpers/headlessGame.js): a late round with a full crowd, Mascots, a boss, a Flash Sale,
// every hazard firing, a Sentry, Soda Bombs and a held trigger, at several spots in the mall. It times g.update (the 60 Hz
// logic) and the per-frame CPU work the browser also does headless-safely (zombies.render, effects.update, contact shadows).
//
//   npm run perf                 the tick-time table per spot (avg / p95 / p99 / worst, in ms)
//   npm run perf -- --profile    also the functions the time went on (runs itself under node --cpu-prof)
//   npm run perf -- --seconds 30 --round 28
//   npm run perf -- --no-grid    collision the old way (every box read for every body), to compare
//   npm run perf -- --root ../../..   time ANOTHER checkout's game with this script (main, to compare a branch with it)
//
// It measures THIS PC, so compare numbers only with a run on the same machine. A 60 Hz tick has 16.7 ms; the logic should
// use a small fraction of it so a weak laptop (4-6 times slower) still keeps up.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};
// The checkout whose game is timed: this one, or --root <folder> (the path of another worktree or the main folder).
const rootArg = args.indexOf('--root');
const root = rootArg === -1 ? fileURLToPath(new URL('..', import.meta.url)) : join(process.cwd(), args[rootArg + 1], '/');

// ---- --profile: run this file again under the V8 profiler, then summarise what it wrote ---------------------------
if (flag('profile') && !process.env.PERF_CHILD) {
  const dir = mkdtempSync(join(tmpdir(), 'mall-perf-'));
  const child = spawnSync(process.execPath, ['--cpu-prof', `--cpu-prof-dir=${dir}`, fileURLToPath(import.meta.url), ...args.filter((a) => a !== '--profile')], {
    stdio: 'inherit', env: { ...process.env, PERF_CHILD: '1' },
  });
  const file = readdirSync(dir).find((f) => f.endsWith('.cpuprofile'));
  if (file) summariseProfile(JSON.parse(readFileSync(join(dir, file), 'utf8')));
  rmSync(dir, { recursive: true, force: true });
  process.exit(child.status ?? 0);
}

/** Self time per function and per file, from a .cpuprofile (only the samples taken inside the measured ticks count roughly:
 *  the build of the map is listed too, under its own functions, so read the top of the list with that in mind). */
function summariseProfile(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const deltas = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    self.set(id, (self.get(id) ?? 0) + (deltas[i] ?? 0));
  }
  // Only what ran under the measured loop: nodes with `measure` (this file) among their ancestors.
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const underLoop = (id) => {
    for (let at = id; at !== undefined; at = parent.get(at)) if (byId.get(at).callFrame.functionName === 'measure') return true;
    return false;
  };
  const fn = new Map(), files = new Map();
  let total = 0;
  for (const [id, micros] of self) {
    if (!underLoop(id)) continue;
    const { functionName, url, lineNumber } = byId.get(id).callFrame;
    const file = url.startsWith('file:') ? relative(root, fileURLToPath(url)).replaceAll('\\', '/') : url || '(native)';
    const key = `${functionName || '(anonymous)'}  ${file}:${lineNumber + 1}`;
    fn.set(key, (fn.get(key) ?? 0) + micros);
    files.set(file, (files.get(file) ?? 0) + micros);
    total += micros;
  }
  const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
  const pct = (v) => `${((v / total) * 100).toFixed(1).padStart(5)}%`;
  console.log(`\nWhere the measured time went (self time, ${(total / 1000).toFixed(0)} ms sampled inside the measured loop)`);
  console.log('\nBy file:');
  for (const [file, v] of top(files, 18)) console.log(`  ${pct(v)}  ${file}`);
  console.log('\nBy function:');
  for (const [key, v] of top(fn, 35)) console.log(`  ${pct(v)}  ${key}`);
}

// ---- The measured scenario -----------------------------------------------------------------------------------------
const { headlessGame, dt } = await import(pathToFileURL(join(root, 'tests/helpers/headlessGame.js')).href);
const { weapons } = await import(pathToFileURL(join(root, 'src/config/weapons.js')).href);

const seconds = option('seconds', 20);
const round = option('round', 28);

// Where the player stands (x, z, floor height is found by the game), and what is special about the spot.
const spots = [
  { name: 'Main Hallway (the hub)', x: 0, z: 2 },
  { name: 'Grand Atrium, ground floor', x: 20, z: 18 },
  { name: 'Food Court', x: 0, z: -8 },
  { name: 'Customer Parking', x: 48, z: -9 },
];

const stats = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    avg: list.reduce((a, b) => a + b, 0) / list.length, p95: at(0.95), p99: at(0.99), worst: sorted[sorted.length - 1],
  };
};
const ms = (v) => v.toFixed(3).padStart(8);

function measure(t, spot, ticks) {
  const { g, input } = t;
  const tickMs = [], frameMs = [];
  let peakAlive = 0;
  for (let i = 0; i < ticks; i++) {
    // The player: trigger held, turning slowly on the spot, a throw now and then, pockets and magazine kept full.
    input.held.add('Mouse0');
    if (i % 6 === 0) input.pressed.add('Mouse0'); // (semi-auto guns need fresh presses)
    g.player.yaw += 0.01;
    if (i % 240 === 30) { g.debug.run('pockets'); input.pressed.add('KeyG'); input.held.add('KeyG'); }
    if (i % 240 === 60) input.held.delete('KeyG');
    if (i % 240 === 120) { input.pressed.add('Mouse1'); input.held.add('Mouse1'); }
    if (i % 240 === 150) input.held.delete('Mouse1');
    if (i % 300 === 0) g.gun.give(weapons[g.gun.def.id]); // (a refill)
    // The mall: a boss, Mascots, a Flash Sale and every hazard, again whenever they are over.
    if (i % 600 === 10) {
      g.debug.run('summonBoss');
      g.debug.run('spawnMascot');
      g.debug.run('spawnMascot');
      g.debug.run('flashSale');
      for (const { instance } of g.features.list) if (instance?.trigger && instance.ready) instance.trigger();
    }
    const t0 = performance.now();
    g.update(dt);
    const t1 = performance.now();
    // The per-frame CPU work main.js does besides drawing (one frame per tick here).
    g.zombies.render(dt, 1);
    g.contactShadows.update(g.zombies.zombies, 1);
    g.effects.update(dt);
    const t2 = performance.now();
    tickMs.push(t1 - t0);
    frameMs.push(t2 - t1);
    peakAlive = Math.max(peakAlive, g.zombies.aliveCount);
  }
  return { spot: spot.name, tick: stats(tickMs), frame: stats(frameMs), peakAlive };
}

const t = headlessGame();
const { g } = t;
g.debug.run('god');
t.tick(2);
g.map.areaUnlocks?.unlockAll?.();
for (const id of Object.keys(g.map.zones)) if (!g.map.zones[id].open) g.map.areaUnlocks?.unlock(id, { instant: true });
for (const door of g.map.doors) if (!door.isOpen) door.open({ instant: true });
if (flag("no-grid")) g.colliders.noGrid = true; // (the plain loop over every box, to compare: world/colliderGrid.js)
g.rounds.jumpTo(round);
g.gun.give(weapons.nailGun);
const heapBefore = process.memoryUsage().heapUsed;

const rows = [];
for (const spot of spots) {
  t.standAt(spot.x, spot.z);
  t.tick(600); // (the crowd arrives before the clock starts)
  rows.push(measure(t, spot, Math.round(seconds * 60)));
}

console.log(`\nGame logic per tick, round ${round}, ${seconds} s per spot (ms; a 60 Hz tick has 16.7 ms)${rootArg === -1 ? '' : `, the game in ${root}`}`);
console.log(`${'spot'.padEnd(30)} ${'avg'.padStart(8)} ${'p95'.padStart(8)} ${'p99'.padStart(8)} ${'worst'.padStart(8)}   zombies`);
for (const r of rows) console.log(`${r.spot.padEnd(30)} ${ms(r.tick.avg)} ${ms(r.tick.p95)} ${ms(r.tick.p99)} ${ms(r.tick.worst)}   ${r.peakAlive}`);
console.log('\nPer-frame CPU besides drawing (zombie poses, contact shadows, effects)');
for (const r of rows) console.log(`${r.spot.padEnd(30)} ${ms(r.frame.avg)} ${ms(r.frame.p95)} ${ms(r.frame.p99)} ${ms(r.frame.worst)}`);
console.log(`\nHeap: ${(heapBefore / 1e6).toFixed(0)} MB before, ${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB after ${(spots.length * (seconds + 10)).toFixed(0)} s of play`);
