// Quest policy layered on the economy report's real-game combat/shopping bot.
// Like that bot, journeys and pickups are teleports. Holds, prices, hazards,
// ritual time, damage, return windows and the van are real game operations.
import * as THREE from 'three';
import { runBot, stepLabel } from './economyBot.js';
import { SENSIBLE } from './economyPlans.js';
import { closingTimeSim as cfg } from '../src/config/closingTimeSim.js';
import { hazards } from '../src/config/hazards.js';

// Keep the established early loadout, including an early build; do a paid
// Restuff after collecting the Signature. Save for duties before Renewals.
export const QUEST_PLAN = [
  ...SENSIBLE.slice(0, SENSIBLE.findIndex(s => s.area === 'cinema')),
  { type: 'door', area: 'megaMart' }, { type: 'door', area: 'parkingLot' },
];

export function runClosingBot({ mode = 'directed', buyReturns = false, overtime = cfg.overtimeRounds, ...options } = {}) {
  return runBot({ ...options, plan: QUEST_PLAN, maxRound: options.maxRound ?? cfg.maxRound,
    maxSeconds: options.maxSeconds ?? cfg.maxSeconds,
    driver: api => questDriver(api, { mode, buyReturns, overtime, immortal: options.immortal }),
  });
}

export function questDriver({ g, input, t, interactAt, holdGun, tryStep, bought }, { mode, buyReturns, overtime, immortal }) {
  g.state.closingMode = mode;
  const feature = kind => g.map.features.find(f => f.kind === kind);
  const fountain = g.features.list.find(({ feature: f }) => f.kind === 'fountainHazard').instance;
  const ritual = g.features.list.find(({ feature: f }) => f.kind === 'workshop').instance.ritual;
  const log = [], deaths = [], overtimeRows = [];
  const overtimePlan = SENSIBLE.slice(SENSIBLE.findIndex(s => s.area === 'cinema'))
    .filter(s => !buyReturns || s.type === 'tier' && s.gun === 'rivetRifle').map(s => ({ ...s }));
  let win = null, finale = null, nextPoll = 0, fountainStart = null, fountainEnd = null, returningByHand = false;
  let round0 = null;
  const now = () => ({ round: g.rounds.round, seconds: g.runStats.timeAlive });
  const fountainNeeded = () => g.closing.hasKey('janitor') && !g.closing.isDone('janitor');
  const location = () => ({ position: g.player.position.toArray(), boss: g.bosses.active?.type.id ?? null,
    zone: g.map.cullAreas.find(a => g.player.position.x >= a.minX && g.player.position.x <= a.maxX &&
      g.player.position.y >= a.minY && g.player.position.y <= a.maxY &&
      g.player.position.z >= a.minZ && g.player.position.z <= a.maxZ)?.id ?? 'unmapped',
    stage: g.state.won ? 'overtime' : finale && !g.closing.lastCustomerDefeated ? 'finale' : fountainNeeded() ? 'fountain' : 'wave' });
  const death = ({ source = g.health.killedBy } = {}) => deaths.push({ ...now(), ...location(), cause: source?.type?.id ?? source?.id ?? source?.type ?? 'unknown' });
  g.events.on('playerDeath', death);
  for (const name of ['closingKey', 'closingLine', 'closingValidated', 'ritualStart', 'ritualCollect', 'purchase', 'bossPhase']) {
    g.events.on(name, e => {
      if (name === 'bossPhase' && e.zombie.type.id !== 'lastCustomer') return;
      log.push({ ...now(), name, id: e.id ?? e.line ?? e.bossId ?? e.gunId ?? e.phase, cost: e.cost ?? 0 });
      if (name === 'closingLine' && e.line === 'janitor') fountainEnd = g.runStats.timeAlive;
    });
  }
  g.events.on('bossSpawn', ({ zombie }) => {
    if (zombie.type.id === 'lastCustomer') finale = { ...now(), health: zombie.maxHealth };
  });
  g.events.on('bossDefeated', ({ zombie }) => {
    if (zombie.type.id === 'lastCustomer') Object.assign(finale, { end: g.runStats.timeAlive, finisher: returningByHand ? 'hand' : 'beam' });
  });
  g.events.on('runWon', () => {
    const paid = log.filter(e => e.name === 'purchase' && ['nightSafe', 'validation', 'fountain'].includes(e.id));
    // A build collected after the Signature is a required cost; the earlier
    // build belongs to the loadout. ritualStart is not a purchase event.
    const questBuilds = log.filter(e => e.name === 'questBuild');
    const required = [...paid, ...questBuilds].reduce((s, e) => s + e.cost, 0);
    const optional = log.filter(e => e.name === 'purchase' && ['returnsDesk', 'returnsAmmo'].includes(e.id)).reduce((s, e) => s + e.cost, 0);
    win = { ...now(), points: g.wallet.points, earned: g.wallet.totalEarned, spent: g.wallet.totalSpent,
      required, optional, share: required / g.wallet.totalEarned, shareWithReturns: (required + optional) / g.wallet.totalEarned };
  });
  function finishRound() {
    if (!round0) return;
    overtimeRows.push({ round: round0.round, index: round0.round - g.overtimeFrom + 1,
      earned: g.wallet.totalEarned - round0.earned, spent: g.wallet.totalSpent - round0.spent,
      banked: g.wallet.points - round0.points, points: g.wallet.points,
      ammo: log.filter(e => e.name === 'purchase' && e.id === 'returnsAmmo' && e.round === round0.round).reduce((s, e) => s + e.cost, 0),
      seconds: g.runStats.timeAlive - round0.seconds });
    round0 = null;
  }
  g.events.on('roundStart', ({ round }) => {
    if (process.env.CLOSING_PROGRESS) process.stderr.write(`round ${round}: ${g.runStats.timeAlive.toFixed(0)}s, ${g.closing.done} duties, ${g.wallet.points} points\n`);
    if (g.overtimeFrom == null || round < g.overtimeFrom) return;
    finishRound();
    round0 = { round, seconds: g.runStats.timeAlive, earned: g.wallet.totalEarned, spent: g.wallet.totalSpent, points: g.wallet.points };
  });
  // The game publishes roundStart during startOvertime, before overtimeFrom
  // is assigned. Start the first row at overtimeStart so OT 1 is not lost.
  g.events.on('overtimeStart', ({ round }) => {
    round0 = { round, seconds: g.runStats.timeAlive, earned: g.wallet.totalEarned, spent: g.wallet.totalSpent, points: g.wallet.points };
  });
  const go = position => {
    input.held.clear(); input.padMove.x = input.padMove.y = 0;
    g.player.teleport({ position: new THREE.Vector3(position.x, position.y, position.z), yaw: g.player.yaw });
  };
  function payAt(target, id, success = null) {
    const r = interactAt(target, { id, success, ticks: id === 'handReturn' ? cfg.handInteractionTicks : cfg.interactionTicks });
    if (r.ok && r.cost) bought(`quest:${id}`, r.cost);
    return r.ok;
  }
  function shop() {
    for (const pickup of g.closing.pickups) { go(pickup.position); t.tick(cfg.pickupTicks); }
    if (g.closing.hasKey('guard')) {
      // The duty count, rather than a duplicate number in this tool, bounds deposits.
      for (const _ of Array.from({ length: g.closing.checklist.find(l => l.bossId === 'guard').needed })) {
        if (g.closing.isDone('guard') || !payAt(feature('nightSafe').position, 'nightSafe')) break;
      }
    }
    if (g.closing.hasKey('manager') && !g.closing.isDone('manager') && ritual.phase === 'idle') {
      const r = tryStep({ type: 'bab', gun: 'rivetRifle' });
      if (r.ok) { bought('quest:build', r.cost); log.push({ ...now(), name: 'questBuild', cost: r.cost }); }
    }
    if (buyReturns && !g.gun.owns('returnToSender') && !g.closing.missingDuties.length) {
      holdGun('priceGun');
      payAt(feature('returnsDesk').position, 'returnsDesk');
    }
    if (g.closing.readyToValidate && !g.closing.validated && (!buyReturns || g.gun.owns('returnToSender'))) {
      payAt(feature('escapeVan').validation.position, 'validation');
    }
    if (g.state.won) {
      for (let i = 0; i < cfg.shopSteps; i++) {
        const step = overtimePlan.find(s => !s.done);
        if (!step) break;
        const r = tryStep(step);
        if (r.ok) bought(stepLabel(step), r.cost);
        if (r.done) step.done = true;
        else break;
      }
    }
    // Always use the rifle until RTS is bought. Restuff temporarily leaves the
    // Price Gun in hand; the ritual hands the rifle back normally.
    holdGun(g.gun.owns('returnToSender') ? 'returnToSender' : 'rivetRifle');
  }
  function base() {
    if (g.closing.validated) return cfg.arena;
    if (fountainNeeded()) return { x: hazards.fountain.center.x, y: 0, z: hazards.fountain.center.z - cfg.fountainOrbit };
    return null;
  }
  // The optional gun must not eat the money for the required validation.
  // Use the backup rifle until both that reserve and a refill are affordable.
  const reserve = () => g.gun.owns('returnToSender') && !g.closing.validated ? g.pricing.priceOf('closing', 'validation') : 0;
  return {
    shop, base, reserve, lethal: death,
    defer: () => fountainNeeded(), // reserve the next activation before another upgrade
    target: visible => visible.find(z => z.type.id === 'lastCustomer' && z.state === 'speechless'),
    beforeTick(tick) {
      if (g.state.winPending) {
        if (!immortal || !overtime) return true;
        g.stayForOvertime();
      }
      const boss = g.bosses.active;
      const returnGun = g.gun.weaponFor('returnToSender'), rifle = g.gun.weaponFor('rivetRifle');
      if (boss?.type.id === 'lastCustomer' && boss.state !== 'speechless' && returnGun &&
          returnGun.magazine + returnGun.reserve <= cfg.finisherBeams && rifle && rifle.magazine + rifle.reserve > 0) holdGun('rivetRifle');
      if (boss?.type.id === 'lastCustomer' && boss.state === 'speechless') {
        const beam = g.gun.weaponFor('returnToSender');
        if (beam && beam.magazine + beam.reserve > 0) holdGun('returnToSender');
        else {
          returningByHand = true;
          payAt(new THREE.Vector3(boss.position.x, boss.position.y + boss.type.handReturn.height, boss.position.z), 'handReturn', () => !boss.isAlive);
          returningByHand = false;
          return true;
        }
      }
      if (tick < nextPoll) return false;
      nextPoll = tick + cfg.pollTicks;
      const beam = g.gun.weaponFor('returnToSender');
      if (beam && beam.magazine + beam.reserve === 0 && g.wallet.points >= g.pricing.priceOf('closing', 'returnsAmmo') + reserve()) {
        const here = g.player.position.clone();
        holdGun('returnToSender');
        payAt(feature('returnsDesk').position, 'returnsAmmo');
        go(here);
      }
      if (g.closing.readyToLeave && !g.state.won) { payAt(feature('escapeVan').position, feature('escapeVan').name, () => g.state.won); return true; }
      if (fountainNeeded()) {
        if (fountainStart == null) {
          fountainStart = g.runStats.timeAlive;
          go(base()); // one journey to this duty, like the economy bot's shops
        }
        const near = g.zombies.zombies.filter(z => z.isAlive && Math.abs(z.position.y) < cfg.fountainFloorTolerance &&
          Math.hypot(z.position.x - hazards.fountain.center.x, z.position.z - hazards.fountain.center.z) <= hazards.fountain.radius).length;
        if (fountain.ready && near >= Math.min(cfg.fountainCrowd, g.rounds.remainingInWave) && near > 0) {
          const pos = g.player.position.clone();
          payAt(feature('fountainHazard').position, 'fountain');
          go(pos);
        }
      }
      return false;
    },
    afterAct() {
      const center = hazards.fountain.center, player = g.player.position;
      const fromCenter = Math.hypot(player.x - center.x, player.z - center.z);
      // Crowds can shove the bot into the wet ring, including just after the
      // duty ticks. Get out before resuming normal combat or the lure route.
      if (fountain.active && fromCenter < cfg.fountainOrbit && fromCenter > 0) {
        g.player.yaw = Math.atan2(-(player.x - center.x), -(player.z - center.z));
        input.padMove.x = 0; input.padMove.y = 1;
        input.held.add('ShiftLeft'); input.held.delete('Mouse0'); input.pressed.delete('Mouse0');
        return;
      }
      if (!fountainNeeded()) return;
      if (g.wallet.points < g.pricing.priceOf('hazard', 'fountain') && fountain.ready) return;
      if (g.rounds.lastShoppers && !fountain.active) return;
      // Walk around the basin, drawing real wave zombies through the ring.
      // Do not shoot the very targets the paid trap needs to finish.
      const c = hazards.fountain.center, p = g.player.position;
      const angle = Math.atan2(p.z - c.z, p.x - c.x) + cfg.fountainAimAhead;
      const dx = c.x + Math.cos(angle) * cfg.fountainOrbit - p.x;
      const dz = c.z + Math.sin(angle) * cfg.fountainOrbit - p.z;
      if (!g.zombies.nav.isWalkableAt(p.x + dx, p.z + dz, p.y) ||
          !g.zombies.nav.clearLine(p.x, p.z, p.x + dx, p.z + dz, p.y)) return;
      const d = Math.hypot(dx, dz);
      if (d) {
        // Look along the lure route, letting Mannequins follow rather than
        // freezing one outside the ring by aiming at it without shooting.
        g.player.yaw = Math.atan2(-dx, -dz);
        input.padMove.x = 0; input.padMove.y = 1;
        g.player.pitch = 0;
      }
      input.held.delete('Mouse0'); input.pressed.delete('Mouse0');
    },
    stop: () => !!win && (!immortal || !overtime || overtimeRows.length >= overtime),
    result: () => ({ mode, buyReturns, win, finale, deaths, log, overtime: overtimeRows.slice(0, overtime),
      fountainSeconds: fountainEnd == null ? null : fountainEnd - fountainStart,
      checklist: g.closing.checklist.map(({ bossId, done, count }) => ({ bossId, done, count })) }),
  };
}
