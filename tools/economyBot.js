// =============================================================================
// ECONOMY BOT (tools/economySim.mjs runs it: npm run sim:economy; tests/economySim.test.js guards it).
// The REAL game, headless (tests/helpers/headlessGame.js), played from round 1 by a bot that
//   - aims with a turn-speed limit and a wandering error (a player, not an aimbot), fires when on target, reloads, swaps guns, knifes up close;
//   - kites: stands and shoots while the crowd is far, steers away through walkable space when they are near, sprints out of a pinch;
//   - SHOPS in the break from a buy order (tools/economyPlans.js), strictly in order: it saves for the next thing on the list.
// It measures the ECONOMY: points earned per round and where they came from, what was bought when, what is carried each round.
//
// WHAT IT IS NOT (say so wherever its numbers are quoted):
//   - Shopping is a TELEPORT to the buy spot and a held F on the real prompt at the real price: no walking time, no risk on the way.
//   - `immortal` runs never die: a lethal hit is counted (`deaths`), health is refilled, and the run carries on. That is the only way to
//     see rounds 15 to 30 (mortal bots die around round 6 to 8), so late-round income is "what the game pays if you get there".
//   - Its skill is two fixed settings (SKILLS). Trust the shape of a curve and the gap between two set-ups, not a single number.
//
//   runBot({ seed, skill, plan, maxRound, immortal }) -> { outcome, round, earned, spent, rounds: [per round], purchases, ... }
// Ported from the review bot of 9 November 2026 (docs/history.md); the claw step and the income split are new.
// =============================================================================

import * as THREE from 'three';
import { headlessGame } from '../tests/helpers/headlessGame.js';
import { tierOf, renewalsOf } from '../src/weapons/upgrades.js';
import { buildOf } from '../src/config/workshop.js';
import { weapons } from '../src/config/weapons.js';
import { sustainedDps } from './balance.js';
import { closingTimeSim } from '../src/config/closingTimeSim.js';

const DEG = Math.PI / 180;
const UPPER_Y = 6.3; // the upper floor (docs/map.md)
const TICKS_PER_SECOND = 60;

// The bot's hands and eyes. sigma: wandering aim error (degrees); slew: how fast the view turns (deg/s); head: share of targets aimed
// at the head; stand: stand and shoot while the nearest zombie is further than this (m); panic: sprint away when one is this close;
// fireCone: how close to the aim point (degrees) before it pulls the trigger.
export const SKILLS = closingTimeSim.skills;
// The claw: a press aimed at the middle of the wanted lane's window, off by a normal error of this many seconds (tools/clawOdds.js "timed").
const CLAW_PRESS_ERROR_SECONDS = 0.12;
// Ammo: refill a gun when its reserve is under this share of its cap; a round counts as stalled after this many seconds.
const REFILL_BELOW = 0.35;
const STALL_SECONDS = 300;
const GIVE_UP_SECONDS = 1500; // one round has taken this long: the run is stuck (outcome 'stuck'), not slow

// What a gun is worth TO THE BOT: its sustained damage per second (tools/balance.js), or nothing if the bot can't use it. It taps or holds a
// trigger at whatever is nearest, so it has no use for a charge-up gun, a shotgun's range, a pushing cone or a bouncing ball. The claw
// step aims for the best of these and leaves anything else in the chute.
const worth = new Map();
export function gunWorth(gunId) {
  if (!worth.has(gunId)) {
    const def = weapons[gunId];
    const usable = def && !def.cone && !def.projectile && !def.pellets && def.fireMode !== 'charge';
    worth.set(gunId, !usable ? 0 : def.instantKill ? Infinity : sustainedDps(def, 5, { ads: true }));
  }
  return worth.get(gunId);
}

/** A seeded random (mulberry32): the same seed plays the same run. */
export function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const floorOf = (y) => (y > 5 ? UPPER_Y : 0);

// Where the bot goes to fight after shopping: the hallway once it is open (a player does not stay in the 10 m start room).
export const defaultBase = (g) => (g.map.zones.hallway.open ? { x: 0, y: 0, z: 2 } : null);

/** What a plan step is called in the tables: "tier:rivetRifle", "door:atrium". */
export const stepLabel = (step) => `${step.type}:${step.id ?? step.area ?? step.gun ?? ''}`;

export function runBot(options = {}) {
  const originalRandom = Math.random;
  let seeded = null;
  // Construction still uses unseeded randomness. Systems which capture this
  // function as a default argument switch to the seed after map construction.
  Math.random = () => (seeded ?? originalRandom)();
  try { return playBot(options, rand => { seeded = rand; }); }
  finally { Math.random = originalRandom; }
}

function playBot({ seed = 1, skill = 'average', plan = [], maxRound = 30, immortal = false, maxSeconds = 2 * 3600, base = defaultBase, driver: makeDriver = null }, seedRandom) {
  const S = typeof skill === 'string' ? SKILLS[skill] : skill;
  const silent = new Proxy({}, { get: () => () => {} });
  const t = headlessGame(makeDriver ? { hud: silent, sound: { play() {}, unlock() {} } } : {}), { g, input } = t;
  const rand = mulberry(seed * 7919 + 13);
  seedRandom(rand); // (after the map is built: CLAUDE.md)
  g.resetRun(); // reseed per-run choices, including captured RNG defaults
  t.tick(1);
  const gauss = () => { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };
  const nav = g.zombies.nav;
  const P = g.player;
  const feature = (pred) => g.map.features.find(pred);
  const claw = g.features.list.find(({ feature: f }) => f.kind === 'clawMachine')?.instance ?? null;

  // ---------------- bookkeeping ----------------
  const rounds = []; // one record per round
  const purchases = []; // { round, label, cost } in the order they happened (ammo included)
  let cur = null;
  let tick = 0, lastHitTick = -9999;
  const loadout = () => g.gun.slots.map((id) => {
    const mods = g.gun.modsFor(id);
    return { id, tier: tierOf(mods), renewals: renewalsOf(mods), build: buildOf(mods)?.quality ?? null };
  });
  const startRound = (round) => {
    if (cur) cur.seconds = g.runStats.timeAlive - cur.t0;
    cur = {
      round, t0: g.runStats.timeAlive, seconds: 0, earned0: g.wallet.totalEarned, spent0: g.wallet.totalSpent, earned: 0, spent: 0,
      bank: g.wallet.points, // points in hand as the round begins (before its break's shopping)
      income: { hits: 0, kills: 0, bosses: 0, other: 0 }, // where the round's points came from
      kills: 0, headshotKills: 0, meleeKills: 0, damage: 0, hitsTaken: 0, deaths: 0, dry: 0,
      shots0: g.runStats.shotsFired, hit0: g.runStats.shotsHit, bought: [], loadout: loadout(), inHand: g.gun.def.id,
    };
    rounds.push(cur);
  };
  g.events.on('roundStart', ({ round }) => startRound(round));
  startRound(Math.max(1, g.rounds.round));

  // Income by source. Every point comes through wallet.earn; the 'hit' and 'kill' listeners below run right after createGame's own (they
  // were added later), so whatever was earned since the last claim belongs to that hit or kill. Anything nobody claims (a voucher paid
  // out as points, a helmet pop) is "other".
  let unclaimed = 0;
  const realEarn = g.wallet.earn.bind(g.wallet);
  const claim = (bucket) => { if (cur) cur.income[bucket] += unclaimed; unclaimed = 0; };
  g.wallet.earn = (amount, style) => { claim('other'); if (amount > 0) unclaimed += amount; realEarn(amount, style); };
  g.events.on('hit', (hit) => { if (!hit.killed) claim('hits'); });
  g.events.on('kill', ({ zombie, headshot, melee }) => {
    claim(zombie?.type?.boss ? 'bosses' : 'kills');
    if (!cur) return;
    cur.kills++;
    if (headshot) cur.headshotKills++;
    if (melee) cur.meleeKills++;
  });
  g.events.on('playerHit', ({ damage }) => { if (cur) { cur.damage += damage; cur.hitsTaken++; } lastHitTick = tick; });
  const events = [];
  let bossesDefeated = 0;
  g.events.on('bossDefeated', () => { bossesDefeated++; });
  for (const name of ['bossSpawn', 'bossDefeated', 'powerUpCollect', 'flashSaleStart', 'ritualStart', 'ritualCollect', 'limitedEditionFitted', 'warrantyClaim', 'clawPrize', 'clawClosed'])
    g.events.on(name, (e) => events.push({ t: Math.round(g.runStats.timeAlive), round: g.rounds.round, name, id: e?.zombie?.type?.id ?? e?.gunId ?? e?.id ?? e?.reason ?? '' }));
  if (immortal) {
    const real = g.health.takeDamage.bind(g.health);
    g.health.takeDamage = (amount, source) => {
      if (amount >= g.stats.health) { if (cur) cur.deaths++; driver?.lethal({ amount, source }); g.stats.health = g.stats.maxHealth; return; }
      real(amount, source);
    };
  }
  const bought = (label, cost) => { purchases.push({ round: g.rounds.round, label, cost }); if (cur) cur.bought.push(`${label}(${cost})`); };

  // ---------------- buying (teleport + hold F on the real prompt) ----------------
  function interactAt(target, { id = null, kind = null, ticks = 50, success = null } = {}) {
    const fy = floorOf(target.y);
    const before = { spent: g.wallet.totalSpent, menu: g.state.menu };
    for (const r of [1.0, 1.4, 0.7, 1.8]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = target.x + Math.sin(a) * r, z = target.z + Math.cos(a) * r;
        if (!nav.isWalkableAt(x, z, fy)) continue;
        const yaw = Math.atan2(-(target.x - x), -(target.z - z));
        P.teleport({ position: new THREE.Vector3(x, fy, z), yaw });
        P.pitch = Math.atan2(target.y - (fy + 1.6), r);
        input.held.clear(); input.padMove.x = input.padMove.y = 0;
        t.tick(2);
        const p = g.interactions.prompt;
        if (!p || (id && p.id !== id) || (kind && p.kind !== kind)) continue;
        if (!p.canAfford || p.blocked) return { ok: false, reason: p.blocked ? 'blocked' : 'poor', cost: p.cost };
        input.pressed.add('KeyF'); input.held.add('KeyF');
        t.tick(p.instant ? 2 : ticks);
        input.held.delete('KeyF');
        t.tick(2);
        if (success?.() || g.wallet.totalSpent !== before.spent || g.state.menu !== before.menu) return { ok: true, cost: g.wallet.totalSpent - before.spent };
      }
    }
    return { ok: false, reason: 'noPrompt' };
  }
  function holdGun(gunId) {
    if (g.gun.def.id === gunId) return true;
    const slot = g.gun.slots.indexOf(gunId);
    if (slot < 0) return false;
    input.pressed.add(slot === 0 ? 'Digit1' : 'Digit2');
    t.tick(90);
    return g.gun.def.id === gunId;
  }

  // GRAB-A-GUN: pay, press over the dearest capsule (never the plush) with a timing error, take what comes out. Before paying it holds
  // the gun it would rather lose (the Staple Gun, else the cheaper one), since a new prize replaces the gun in hand.
  function playClaw() {
    if (!claw || claw.phase !== 'idle' || !claw.status.open) return { ok: false, reason: 'closed' };
    const worst = [...g.gun.slots].sort((a, b) => gunWorth(a) - gunWorth(b))[0];
    if (g.gun.slots.length === 2) holdGun(worst);
    const spentBefore = g.wallet.totalSpent;
    const paid = interactAt(claw.site.cabinet.position, { kind: 'claw' });
    if (!paid.ok || claw.phase !== 'sweeping') return { ok: false, reason: paid.reason ?? 'noGrab', cost: paid.cost };
    const capsules = claw.grab.capsules;
    let want = 0, best = -1;
    capsules.forEach((c, lane) => { const v = c && !c.plush ? gunWorth(c.id) : -1; if (v > best) { best = v; want = lane; } });
    // The claw is over the middle of lane 0 at t = 0 and again a whole sweep later, over the last lane at half a sweep.
    const lanes = capsules.length, period = claw.grab.period;
    const centre = want === 0 ? period : want === lanes - 1 ? period / 2 : (period * want) / (2 * (lanes - 1));
    const pressAt = Math.max(0.2, centre + gauss() * CLAW_PRESS_ERROR_SECONDS);
    for (let i = 0; i < 8 * TICKS_PER_SECOND && claw.phase === 'sweeping'; i++) {
      if (claw.grab.t >= pressAt) input.pressed.add('KeyF');
      t.tick(1);
    }
    for (let i = 0; i < 4 * TICKS_PER_SECOND && claw.phase === 'lifting'; i++) t.tick(1);
    let prize = 'plush', taken = false;
    if (claw.phase === 'ready') {
      prize = claw.grab.prize.id;
      // Take it if it is a gun it carries (a free refill, maybe an attachment), fills a free slot, or beats the gun it would replace.
      taken = g.gun.owns(prize) ? gunWorth(prize) > 0 : gunWorth(prize) > (g.gun.slots.length < 2 ? 0 : gunWorth(worst));
      if (taken) {
        input.pressed.add('KeyF'); input.held.add('KeyF');
        for (let i = 0; i < 2 * TICKS_PER_SECOND && claw.phase === 'ready'; i++) t.tick(1);
        input.held.delete('KeyF');
        t.tick(2);
      }
    }
    return { ok: true, cost: g.wallet.totalSpent - spentBefore, prize, taken };
  }

  // One plan step -> { ok, done } (done: never try again).
  function tryStep(step) {
    if (step.fromRound && g.rounds.round < step.fromRound) return { ok: false };
    if (step.afterBosses && bossesDefeated < step.afterBosses) return { ok: false }; // (a gate the game doesn't have yet: tools/economyPlans.js)
    switch (step.type) {
      case 'door': {
        if (g.map.zones[step.area].open) return { done: true };
        const door = g.map.doors.find((d) => g.map.areaUnlocks.destination(d) === step.area);
        if (!door) return { ok: false };
        const r = interactAt(door.position, { kind: 'door' });
        return { ...r, done: r.ok };
      }
      case 'gun': {
        if (g.gun.owns(step.id)) return { done: true };
        const wb = feature((f) => f.kind === 'wallBuy' && f.weapon === step.id);
        if (!g.map.zones[wb.zone].open) return { ok: false };
        if (step.replace && g.gun.slots.length === 2) holdGun(step.replace);
        const r = interactAt(wb.position, { kind: 'weapon' });
        return { ...r, done: r.ok };
      }
      case 'tier': { // the next warranty tier (or Renewal) for a named gun
        if (!holdGun(step.gun)) return { ok: false };
        const desk = feature((f) => f.kind === 'upgradeDesk');
        const r = interactAt(desk.position, { kind: 'tier' });
        return { ...r, done: r.ok };
      }
      case 'melee': { // the next box cutter tier
        const desk = feature((f) => f.kind === 'upgradeDesk');
        if (!desk.meleePosition) return { done: true };
        const r = interactAt(desk.meleePosition, {});
        return { ...r, done: r.ok };
      }
      case 'wardrobe': {
        if (g.wardrobe.owns(step.id)) return { done: true };
        const rack = feature((f) => f.kind === 'wardrobeRack' && f.item === step.id);
        if (!rack) return { done: true };
        if (!g.map.zones[rack.zone].open) return { ok: false };
        const r = interactAt(rack.position, {});
        return { ...r, done: r.ok };
      }
      case 'attachment': {
        if (!holdGun(step.gun)) return { ok: false };
        const c = feature((f) => f.kind === 'attachmentCounter' && f.attachment === step.id);
        if (!g.map.zones[c.zone].open) return { ok: false };
        const r = interactAt(c.position, {});
        return { ...r, done: r.ok };
      }
      case 'bab': { // Build-A-Blaster: the order form is pre-filled; F orders. (Only with two guns: it never plays on the Courtesy Loaner.)
        if (!g.map.zones.upstairs.open || g.gun.slots.length < 2) return { ok: false };
        if (!holdGun(step.gun)) return { ok: false };
        const bench = feature((f) => f.kind === 'workshop');
        const price = g.pricing.priceOf('workshop', 'ritual');
        if (g.wallet.points < price) return { ok: false, reason: 'poor', cost: price };
        const r = interactAt(bench.position, {});
        if (!g.state.menu) return { ok: false, reason: r.reason ?? 'noMenu' };
        const spent = g.wallet.totalSpent;
        input.pressed.add('KeyF'); input.held.add('KeyF'); t.tick(3); input.held.delete('KeyF'); t.tick(3);
        if (g.state.menu) { input.pressed.add('KeyQ'); t.tick(3); }
        const ok = g.wallet.totalSpent > spent;
        return { ok, done: ok, cost: g.wallet.totalSpent - spent };
      }
      case 'claw': { // one grab per break while any of `grabs` are left; the step is done after the last
        step.left ??= step.grabs ?? 1;
        const r = playClaw();
        if (!r.ok) return { ok: false };
        step.left -= 1;
        step.cost = (step.cost ?? 0) + r.cost;
        bought(`claw:${r.prize}${r.taken || r.prize === 'plush' ? '' : ' (left)'}`, r.cost);
        return { ok: false, done: step.left <= 0, logged: true };
      }
    }
    return { done: true };
  }

  const todo = plan.map((s) => ({ ...s }));
  let home = null;
  function refillAmmo() { // a carried gun is low: its wall, or a RESTOCK-O-MATIC, whichever is cheaper and open
    for (const gunId of [...g.gun.slots]) {
      const w = g.gun.weaponFor(gunId);
      if (!w || w.def.loaner || w.reserve > w.reserveCap * REFILL_BELOW || (gunId === 'stapleGun' && g.gun.slots.length > 1 && g.rounds.round > 3)) continue;
      if (!holdGun(gunId)) continue;
      if (gunId === 'returnToSender') {
        if (g.wallet.points < g.pricing.priceOf('closing', 'returnsAmmo') + (driver?.reserve() ?? 0)) continue;
        const desk = feature((f) => f.kind === 'returnsDesk');
        const r = interactAt(desk.position, { id: 'returnsAmmo' });
        if (r.ok) bought(`ammo:${gunId}`, r.cost);
        continue;
      }
      const cache = feature((f) => f.kind === 'ammoCache' && g.map.zones[f.zone].open);
      const wb = feature((f) => f.kind === 'wallBuy' && f.weapon === gunId && g.map.zones[f.zone].open);
      const cachePrice = g.pricing.priceOf('ammoCache', 'ammoCache');
      const wallPrice = wb ? g.pricing.priceOf('ammo', gunId) : Infinity;
      const spot = cache && cachePrice <= wallPrice ? cache : wb ?? cache;
      if (!spot) continue;
      const r = interactAt(spot.position, {});
      if (r.ok) bought(`ammo:${gunId}`, r.cost);
    }
  }
  function shop() {
    home ??= P.position.clone();
    const back = home.clone(), yaw = P.yaw;
    refillAmmo();
    driver?.shop();
    for (let guard = 0; guard < 12; guard++) {
      const step = todo.find((s) => !s.done);
      if (!step) break;
      if (driver?.defer(step)) break;
      const r = tryStep(step);
      if (r.ok && !r.logged) step.cost = r.cost;
      if (r.done) { step.done = true; step.round = g.rounds.round; if (r.ok && !r.logged) bought(stepLabel(step), r.cost); if (step.type !== 'claw') continue; }
      break; // strict order: save for the next thing on the list
    }
    const b = driver?.base() ?? base(g);
    if (b) back.set(b.x, b.y, b.z);
    P.teleport({ position: back, yaw });
    home = null;
  }

  const driver = makeDriver?.({ g, input, t, interactAt, holdGun, tryStep, bought, refillAmmo });
  // ---------------- combat ----------------
  let target = null, targetPart = 'body', retarget = 0;
  let errYaw = 0, errPitch = 0, errTimer = 0;
  let moveDir = { x: 0, z: 0 }, panicUntil = 0, steerTimer = 0;
  const point = new THREE.Vector3();
  const liveThreats = () => g.zombies.zombies.filter((z) => z.isAlive && !z.noRewards);

  // The best of 16 directions: away from zombies, into open floor, roughly the way it was already going.
  function steer(threats, fy) {
    let best = null, bestScore = -Infinity;
    const px = P.position.x, pz = P.position.z;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      if (!nav.isWalkableAt(px + dx, pz + dz, fy) || !nav.clearLine(px, pz, px + dx, pz + dz, fy)) continue;
      let open = 1;
      for (let d = 2; d <= 9; d++) { if (nav.isWalkableAt(px + dx * d, pz + dz * d, fy) && nav.clearLine(px, pz, px + dx * d, pz + dz * d, fy)) open = d; else break; }
      const reach = Math.min(open, 3);
      const cx = px + dx * reach, cz = pz + dz * reach;
      let minD = 99, blocked = false;
      for (const z of threats) {
        const d = Math.hypot(z.position.x - cx, z.position.z - cz);
        if (d < minD) minD = d;
        const rx = z.position.x - px, rz = z.position.z - pz, along = rx * dx + rz * dz; // a zombie standing in the way of this direction
        if (along > 0 && along < 4 && Math.abs(rx * dz - rz * dx) < 1.3) blocked = true;
      }
      const score = Math.min(minD, 10) + open * 0.35 + (dx * moveDir.x + dz * moveDir.z) * 1.2 - (blocked ? 8 : 0);
      if (score > bestScore) { bestScore = score; best = { x: dx, z: dz }; }
    }
    return best;
  }

  function act() {
    const fy = floorOf(P.position.y + 0.5);
    const threats = liveThreats().filter((z) => Math.abs(z.position.y - P.position.y) < 2.5);
    let nearest = null, nearestD = 99;
    for (const z of threats) {
      if (z.state === 'spawning') continue;
      const d = Math.hypot(z.position.x - P.position.x, z.position.z - P.position.z);
      if (d < nearestD) { nearestD = d; nearest = z; }
    }
    // --- target: the nearest zombie in sight ---
    if (!target?.isAlive || --retarget <= 0) {
      const visible = threats.filter((z) => z.state !== 'spawning' && nav.clearLine(P.position.x, P.position.z, z.position.x, z.position.z, fy));
      visible.sort((a, b) => a.position.distanceToSquared(P.position) - b.position.distanceToSquared(P.position));
      const next = driver?.target(visible) ?? visible[0] ?? null;
      if (next !== target) targetPart = rand() < S.head ? 'head' : 'body';
      target = next; retarget = 20;
    }
    // --- move ---
    const panicking = tick < panicUntil;
    let wantMove = false;
    if (nearest && (nearestD < S.stand || tick - lastHitTick < 90)) wantMove = true;
    if (nearest && nearestD < S.panic && !panicking && P.sprintFraction > 0.3) panicUntil = tick + 45;
    if (--steerTimer <= 0) {
      steerTimer = 6;
      if (wantMove || panicking) moveDir = steer(threats, fy) ?? moveDir;
    }
    input.held.delete('ShiftLeft'); input.held.delete('Mouse0'); input.held.delete('Mouse2');
    const gunW = g.gun.weapon;
    if (tick < panicUntil && (moveDir.x || moveDir.z)) {
      // run: look where you go, sprint, no shooting
      const want = Math.atan2(-moveDir.x, -moveDir.z);
      P.yaw += Math.max(-S.slew * DEG / 60 * 2, Math.min(S.slew * DEG / 60 * 2, wrap(want - P.yaw)));
      P.pitch *= 0.8;
      input.padMove.x = 0; input.padMove.y = 1;
      input.held.add('ShiftLeft');
      if (gunW.magazine === 0 && !gunW.isReloading && gunW.reserve > 0) input.pressed.add('KeyR');
      return;
    }
    // --- aim ---
    let onTarget = false, dist = 0;
    if (target) {
      const box = target.hitboxes.find((h) => h.part === targetPart) ?? target.hitboxes[0];
      box.box.getCenter(point);
      const ex = P.position.x, ey = P.position.y + P.eyeHeight, ez = P.position.z;
      const dx = point.x - ex, dy = point.y - ey, dz = point.z - ez;
      dist = Math.hypot(dx, dz);
      if (--errTimer <= 0) { errTimer = 14; errYaw = gauss() * S.sigma * DEG; errPitch = gauss() * S.sigma * DEG * 0.7; }
      const wantYaw = Math.atan2(-dx, -dz) + errYaw, wantPitch = Math.atan2(dy, dist) + errPitch;
      const step = S.slew * DEG / 60;
      P.yaw += Math.max(-step, Math.min(step, wrap(wantYaw - P.yaw)));
      P.pitch += Math.max(-step, Math.min(step, wantPitch - P.pitch));
      onTarget = Math.abs(wrap(wantYaw - P.yaw)) < S.fireCone * DEG && Math.abs(wantPitch - P.pitch) < S.fireCone * DEG;
    }
    // --- walk (world direction -> stick, relative to where it looks) ---
    if (wantMove && (moveDir.x || moveDir.z)) {
      const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
      input.padMove.y = -sin * moveDir.x - cos * moveDir.z;
      input.padMove.x = cos * moveDir.x - sin * moveDir.z;
    } else { input.padMove.x = input.padMove.y = 0; }
    // --- hands ---
    if (target && dist < 1.9 && (g.rounds.round <= 2 || gunW.magazine === 0 || gunW.isReloading)) { input.pressed.add('KeyV'); return; }
    if (gunW.magazine === 0 && !gunW.isReloading) {
      if (gunW.reserve > 0) input.pressed.add('KeyR');
      else {
        const other = g.gun.slots.find((id) => id !== g.gun.def.id && (g.gun.weaponFor(id).magazine > 0 || g.gun.weaponFor(id).reserve > 0));
        if (other && !g.gun.isSwitching) input.pressed.add(g.gun.slots.indexOf(other) === 0 ? 'Digit1' : 'Digit2');
        else if (!other) { if (cur) cur.dry++; if (target && dist < 2.2) input.pressed.add('KeyV'); }
      }
      return;
    }
    if (!target && !gunW.isReloading && gunW.magazine < gunW.def.magazineSize * 0.5 && gunW.reserve > 0 && nearestD > 6) input.pressed.add('KeyR');
    if (target && onTarget && !gunW.isReloading) {
      if (!wantMove && dist > 5) input.held.add('Mouse2');
      if (tick % 2) { input.pressed.add('Mouse0'); input.held.add('Mouse0'); }
    }
  }

  // ---------------- run ----------------
  let shopped = -1, dryTicks = 0, stuck = 0, lastSeenTick = 0, unstick = 0;
  const lastPos = P.position.clone();
  let outcome = 'timeout';
  const stalls = [];
  while (g.runStats.timeAlive < maxSeconds) {
    tick++;
    if (g.state.over) { outcome = 'died'; break; }
    if (driver?.stop()) { outcome = 'won'; break; }
    if (g.rounds.round > maxRound) { outcome = 'maxRound'; break; }
    if (g.state.menu) input.pressed.add('KeyQ');
    // shop once per break (and once at the very start, before any zombie is up)
    if ((g.rounds.inBreak || (g.rounds.round === 1 && shopped < 0)) && shopped !== g.rounds.round && liveThreats().length === 0) {
      shopped = g.rounds.round;
      shop();
    }
    // completely dry mid-round with zombies up: a real player runs to a wall; the bot teleports there (counted in `dry`)
    if (g.gun.slots.every((id) => { const x = g.gun.weaponFor(id); return x.magazine === 0 && x.reserve === 0; })) {
      if (++dryTicks > 180) { dryTicks = 0; const here = P.position.clone(), yaw = P.yaw; refillAmmo(); P.teleport({ position: here, yaw }); }
    } else dryTicks = 0;
    // nothing in sight for 45 s with zombies alive: move to another spot in the hallway (counted in `unstick`)
    if (target) lastSeenTick = tick;
    if (tick - lastSeenTick > 60 * 45 && liveThreats().length > 0) {
      lastSeenTick = tick; unstick++;
      const spots = [[0, 0, 2], [-12, 0, 2], [12, 0, 2], [0, 0, 12]].filter(([x, , z]) => nav.isWalkableAt(x, z, 0));
      const [x, y, z] = spots[unstick % spots.length];
      P.teleport({ position: new THREE.Vector3(x, y, z), yaw: P.yaw });
    }
    if (!driver?.beforeTick(tick)) { act(); driver?.afterAct(); }
    g.update(1 / TICKS_PER_SECOND);
    if (tick % 120 === 0) { // not moving while wanting to: nudge the steering
      if (P.position.distanceTo(lastPos) < 0.2 && (input.padMove.x || input.padMove.y)) { stuck++; moveDir = { x: Math.sin(rand() * 6.28), z: Math.cos(rand() * 6.28) }; }
      lastPos.copy(P.position);
    }
    if (cur && g.runStats.timeAlive - cur.t0 > GIVE_UP_SECONDS) { outcome = 'stuck'; break; }
    if (cur && !cur.stall && g.runStats.timeAlive - cur.t0 > STALL_SECONDS) {
      cur.stall = true;
      stalls.push({ round: cur.round, state: g.rounds.state, alive: g.zombies.aliveCount, boss: g.bosses.active?.type?.id ?? null });
    }
  }
  claim('other');
  if (cur) cur.seconds = g.runStats.timeAlive - cur.t0;
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i], n = rounds[i + 1];
    r.earned = (n ? n.earned0 : g.wallet.totalEarned) - r.earned0;
    r.spent = (n ? n.spent0 : g.wallet.totalSpent) - r.spent0;
    r.shots = (n ? n.shots0 : g.runStats.shotsFired) - r.shots0;
    r.accuracy = r.shots ? ((n ? n.hit0 : g.runStats.shotsHit) - r.hit0) / r.shots : 0;
  }
  const result = {
    quest: driver?.result(),
    outcome, round: g.rounds.round, seconds: g.runStats.timeAlive, earned: g.wallet.totalEarned, spent: g.wallet.totalSpent, points: g.wallet.points,
    kills: g.runStats.kills, accuracy: g.runStats.accuracy, killedBy: g.health.killedBy?.id ?? null, stalls, unstick, stuck,
    rounds, purchases, events, loadout: loadout(), wearing: g.wardrobe.status,
    steps: todo.map((s) => ({ label: stepLabel(s), round: s.done ? s.round : null, cost: s.cost ?? null })), // the round each plan step was bought (null: never) and what it cost
  };
  g.map.dispose?.();
  return result;
}
