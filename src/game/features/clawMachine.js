// =============================================================================
// GRAB-A-GUN, the claw machine (map feature kind 'clawMachine'; numbers in config/clawMachine.js; the plan:
// docs/archive/claw-machine-plan.md). The mystery box, but you work it:
//   idle      hold interact to pay (g.pricing 'claw' 'grab'). Three capsules fall into the pit, one per lane, each named on
//             the screen and the ticket.
//   sweeping  the claw travels across the lanes and back. PRESS interact once (an `instant` item: a timed press can't wait
//             for a hold) and it drops on the lane it's over. Nothing pressed after autoDropSeconds: it drops by itself.
//             The capsule under it at that moment IS the prize: nothing after the press changes it.
//   lifting   liftSeconds of claw going down, up and over to the chute (for show).
//   ready     the gun sits in the chute for takeSeconds: hold interact to take it, or it's gone.
//   closed    after a plush or the site's last grab: out of service until the next 'roundStart' (see below).
// Then it's idle again. You keep moving and shooting the whole time; walking away never hangs it (it drops and times out).
//
// THE RELOCATION RULE: each site has cfg.stock grabs. From the third, a plush (Sunny) may take one lane (cfg.plushChance by
// grab number). Land on him: the grab's ACTUAL charge comes back (wallet.refund: not income) and it closes, with the next
// site picked right then. Sell out: it closes once that last prize is taken or gone. At the next 'roundStart' it reopens at
// that site (a random OTHER site whose zone is open, for a sell-out), or restocks where it stands if no other site is open.
// It never moves during a grab and never into a locked area. Every run starts at the first site, which waits for its zone.
// No cabinet ever moves: every site's cabinet is always there, dust-sheeted while the machine is elsewhere.
//
// The prize pool: the wall guns (never the Staple Gun: the Courtesy Loaner relies on it never being bought again). A gun you
// CARRY comes up REFURBISHED, named with a free attachment for one of its empty slots ("Nail Gun + Grip Tape"): taking it refills
// that gun and fits the attachment, in hand or not, and the attachment counts as owned for the run (free refits). A carried gun
// with no empty slot that fits, and a gun away at Build-A-Blaster, are left out of that grab. Things can change between the roll
// and the take, so the take checks again (takeOutcome): a gun bought meanwhile becomes a refill (plus its spare attachment if that
// slot is free), a Refurbished gun no longer carried (replaced, or handed to Build-A-Blaster) comes as a plain copy. A Refurbished
// take never replaces a fitted attachment, and waits while the gun in hand is switching, reloading, bursting or charging.
//
// THE SHOW (cfg.show, all visual or sound, never the prize): the prongs open on the way down and close on the capsule, which swings
// on the way up (it nearly slips; it never does), the chute flap swings as the prize lands, a tick as the claw crosses into each
// lane (it helps with timing), the motor, a jingle, a fanfare, Sunny's slide whistle, and a hum from the live machine (an emitter
// it adds to map.ambience that follows it, silent while it's closed). Its own sounds fade with distance. The idle screen cycles
// attract lines; the PA picks one line of each list.
//
// DOM-free: it announces on g.events ('clawGrab', 'clawDrop', 'clawPrize', 'clawClosed', 'clawMoved'), main.js reads .status.
// Its only runtime objects are the capsules and claw (each cabinet's rig) and the won gun's display in the chute; reset()
// clears them and puts the machine back at the first site.
//
// feature: { kind: 'clawMachine', name, zone, position, normal, sites: [{ id, zone, cabinet: { position, normal, screen, rig } }] }
//   (zone/position/normal: the first site's, where every run starts)
//
//   rollCapsules(pool, plushChance, random) -> one entry per lane: a pool entry, PLUSH, or null if the pool ran dry
//   sweepPosition(t, period) -> 0..1 across the lanes;  laneAt(position) -> lane index;  sweepSeconds(grabNumber) -> period
//   plushChanceFor(grabNumber), prizePool(gun) -> [{ id, weight, capsule, attachments?, spares }], describeCarried(def, mods)
//   takeOutcome(gun, prize) -> { kind: 'new' | 'refill' | 'refurbish', attachment }
// =============================================================================

import * as THREE from 'three';
import { clawMachine as cfg } from '../../config/clawMachine.js';
import { weapons } from '../../config/weapons.js';
import { buildWeaponDisplay } from '../../weapons/models/index.js';
import { attachmentById, attachmentFits, attachmentsOf, tierById, tierOf, withAttachment } from '../../weapons/upgrades.js';
import { upgrades } from '../../config/upgrades.js';
import { buildOf, paLine } from '../../config/workshop.js';
import { unlockAttachment } from './attachmentCounter.js';
import { createClawSunny } from './clawSunny.js';

/** The plush's capsule. */
export const PLUSH = Object.freeze({ plush: true, id: null, capsule: 'plush' });

/**
 * Draw one capsule per lane by weight from `pool` ([{ id, weight, ... }]), with no repeats in one grab. With chance
 * `plushChance` one random lane holds the plush instead. `random` is Math.random or a seeded stand-in. A lane the pool
 * can't fill (fewer guns than lanes) stays null. A drawn gun gets its attachment now (nothing after the press is random):
 * `refurbished` (a carried gun: one of its free-slot attachments) and `spare` (any that fits: used if you buy the gun meanwhile).
 */
export function rollCapsules(pool, plushChance = 0, random = Math.random, lanes = cfg.lanes) {
  const plushLane = plushChance > 0 && random() < plushChance ? Math.floor(random() * lanes) : -1;
  const left = pool.filter((p) => p.weight > 0);
  const out = [];
  for (let lane = 0; lane < lanes; lane++) {
    if (lane === plushLane) { out.push(PLUSH); continue; }
    const total = left.reduce((sum, p) => sum + p.weight, 0);
    if (!(total > 0)) { out.push(null); continue; }
    let roll = random() * total;
    let index = 0;
    while (index < left.length - 1 && roll >= left[index].weight) roll -= left[index++].weight;
    const { attachments = null, spares = [], ...entry } = left[index];
    const pick = (list) => (list?.length ? list[Math.floor(random() * list.length)] : null);
    out.push({ ...entry, refurbished: pick(attachments), spare: pick(spares) });
    left.splice(index, 1);
  }
  return out;
}

/** Where the claw is across the lanes at `t` seconds into a sweep: 0 (first lane's edge) .. 1 (last lane's edge) and back. */
export function sweepPosition(t, period) {
  const phase = ((t % period) + period) % period / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/** The lane under the claw at a sweep position (each lane is an equal share of the travel). */
export const laneAt = (position, lanes = cfg.lanes) => Math.min(lanes - 1, Math.max(0, Math.floor(position * lanes)));

/** One trip there and back, on this site's `grabNumber`-th grab (1 = the first): quicker each grab, down to minSeconds. */
export function sweepSeconds(grabNumber) {
  const { firstSeconds, stepSeconds, minSeconds } = cfg.sweep;
  return Math.max(minSeconds, firstSeconds - stepSeconds * (grabNumber - 1));
}

/** The chance a plush is in the pit on this site's `grabNumber`-th grab. */
export const plushChanceFor = (grabNumber) => cfg.plushChance[Math.min(cfg.plushChance.length, grabNumber) - 1] ?? 0;

const ATTACHMENT_IDS = Object.keys(upgrades.attachments);
/** The attachments that fit this gun (by its config entry), and of those, the ones whose slot is empty in `mods`. */
const fitting = (id) => ATTACHMENT_IDS.filter((a) => attachmentFits(weapons[id], a));
const freeFor = (id, mods) => fitting(id).filter((a) => !attachmentsOf(mods)[attachmentById(a).slot]);

/**
 * The guns a grab can offer you right now: every prize gun, never the Staple Gun or one at Build-A-Blaster. A gun you carry is
 * offered Refurbished (`attachments`: the ones it could come with), or not at all if no empty slot fits. `spares`: every
 * attachment that fits the gun (a late change at the take may need one).
 */
export function prizePool(gun) {
  const pool = [];
  for (const [id, prize] of Object.entries(cfg.prizes)) {
    if (!weapons[id] || id === 'stapleGun' || gun.away?.def.id === id) continue;
    const entry = { id, weight: prize.weight, capsule: prize.capsule, spares: fitting(id) };
    if (gun.owns(id)) {
      const free = freeFor(id, gun.modsFor(id));
      if (!free.length) continue; // carried with nothing that fits: not offered this grab
      entry.attachments = free;
    }
    pool.push(entry);
  }
  return pool;
}

/**
 * What taking `prize` gives you NOW (the loadout may have changed since the roll):
 *   'new'        not carried (any more): the gun, a plain copy (gun.give: a free slot, or it replaces the gun in hand)
 *   'refurbish'  carried, and the attachment's slot is still empty: a full refill plus that attachment
 *   'refill'     carried with that slot filled meanwhile (never replaced), or nothing to fit: a full refill
 */
export function takeOutcome(gun, prize) {
  const { id } = prize;
  if (!gun.owns(id)) return { kind: 'new', attachment: null };
  const free = freeFor(id, gun.modsFor(id));
  const attachment = prize.refurbished ?? prize.spare; // (rolled Refurbished: only its own; a gun bought meanwhile: its spare)
  return attachment && free.includes(attachment) ? { kind: 'refurbish', attachment } : { kind: 'refill', attachment: null };
}

/** "Platinum Rivet Rifle with 2 attachments", '"Gerald" (Nail Gun)': what taking a prize would cost you. */
export function describeCarried(def, mods = []) {
  const tier = tierOf(mods);
  const name = `${tier === 'standard' ? '' : `${tierById(tier).name} `}${def.name}`;
  const fitted = Object.keys(attachmentsOf(mods)).length;
  const build = buildOf(mods)?.name;
  const withParts = fitted ? `${name} with ${fitted} attachment${fitted === 1 ? '' : 's'}` : name;
  return build ? `"${build}" (${withParts})` : withParts;
}

const capsuleColor = (capsule) => (!capsule ? null : capsule.plush ? cfg.plush.color : cfg.capsules[capsule.capsule].color);
const prizeName = (capsule) => (!capsule ? 'Empty' : capsule.plush ? cfg.plush.name
  : capsule.refurbished ? `${weapons[capsule.id].name} + ${attachmentById(capsule.refurbished).name}` : weapons[capsule.id].name);

const pick = (list) => (Array.isArray(list) ? list[Math.floor(Math.random() * list.length)] : list);

export function buildClawMachine(feature, { scene, map, events, pricing, interactions, gun, wallet, state, sound, player, tickets = null,
  zombies = null, shootables = [], effects = null }) {
  const sites = feature.sites;
  let site = sites[0];
  let phase = 'idle'; // 'idle' | 'sweeping' | 'lifting' | 'ready' | 'closed'
  let grab = null; // { number, capsules, paid, t, period, lane, prize, timer }
  let grabsHere = 0; // grabs paid for at this site (sweep speed and plush odds)
  let stock = cfg.stock; // grabs left at this site
  let closedReason = null; // 'plush' | 'soldOut' while closed
  let nextSite = null; // after a plush: where it reopens (picked when he lands)
  let forcePlush = false; // debug: the next grab has a plush in it
  let display = null; // the won gun, in the chute
  let flapTimer = Infinity; // seconds since the prize landed (the flap swings for cfg.show.flapSeconds)
  let lastLane = null; // the lane the claw was over last tick (a tick sound on each change)
  let attract = 0; // seconds on the idle screen (its lines take turns)
  const show = cfg.show;

  // The machine's own sounds, quieter with distance (a sweep you walked away from shouldn't tick in your ear).
  function play(name) {
    if (!sound) return;
    const d = player ? player.position.distanceTo(cabinet().position) : 0;
    const volume = Math.max(0, 1 - d / show.soundRange);
    if (volume > 0) sound.play(name, { volume });
  }

  // The live machine hums: an ambience emitter that follows it (game/ambience.js mixes it by distance and walls). Closed or not yet
  // reachable, its zone is none, so it's silent.
  const hum = {
    id: 'claw_hum', kind: 'clawHum', range: show.hum.range, gain: show.hum.gain,
    get zone() { return phase === 'closed' ? null : site.zone; },
    get position() { const p = cabinet().position; return [p.x, p.y, p.z]; },
  };
  if (Array.isArray(map.ambience)) map.ambience.push(hum);

  const cabinet = () => site.cabinet;
  const zoneOpen = (s = site) => map.zones[s.zone].open;
  const lanePosition = () => sweepPosition(grab.t, grab.period);
  const currentLane = () => laneAt(lanePosition());
  const laneU = (position) => {
    const { laneU: us } = cabinet().rig;
    const first = us[0] - (us[1] - us[0]) / 2; // the travel runs from the first lane's outer edge to the last's
    const last = us[us.length - 1] + (us[1] - us[0]) / 2;
    return first + (last - first) * position;
  };

  function showDisplay(id) {
    const { chute } = cabinet().rig;
    const holder = new THREE.Group();
    holder.name = 'clawPrize';
    holder.position.copy(chute.position);
    holder.lookAt(chute.position.x + chute.normal.x, chute.position.y, chute.position.z + chute.normal.z);
    const model = buildWeaponDisplay(weapons[id]);
    model.rotation.y = Math.PI / 2; // lying along the tray, its side to you
    model.scale.setScalar(cfg.cabinet.prizeScale);
    holder.add(model);
    scene.add(holder);
    display = holder;
  }

  function hideDisplay() {
    if (!display) return;
    display.removeFromParent();
    display.traverse((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
      else o.material?.dispose?.();
    });
    display = null;
  }

  // Another site whose zone is open, at random (null: none). Uniform: easier to reason about and to test.
  function pickSite() {
    const options = sites.filter((s) => s !== site && zoneOpen(s));
    return options.length ? options[Math.floor(Math.random() * options.length)] : null;
  }

  // Live at `target` (or restocked where it stands), full stock, ready to pay. Only ever called while not mid-grab.
  function reopen(target) {
    const moved = !!target && target !== site;
    if (moved) {
      cabinet().rig.setLive(false);
      cabinet().screen.show({ title: cfg.name, lines: ['', cfg.screen.away, ''], highlight: 1, note: '' });
      site = target;
      cabinet().rig.setLive(true);
    }
    cabinet().rig.reset();
    stock = cfg.stock;
    grabsHere = 0;
    closedReason = null;
    nextSite = null;
    phase = 'idle';
    const area = map.zones[site.zone].label;
    events.emit('clawMoved', { siteId: site.id, area, moved, pa: paLine(pick(moved ? cfg.pa.moved : cfg.pa.restocked), { area }) });
  }

  function close(reason) {
    phase = 'closed';
    closedReason = reason;
    nextSite = reason === 'plush' ? pickSite() : null; // (after a plush the next site is known now: Sunny will walk there)
    events.emit('clawClosed', { reason, siteId: site.id, nextSiteId: nextSite?.id ?? null, pa: pick(cfg.pa[reason]) });
  }

  function pay(purchase) {
    grabsHere += 1;
    stock -= 1;
    const capsules = rollCapsules(prizePool(gun), forcePlush ? 1 : plushChanceFor(grabsHere));
    forcePlush = false;
    // Prize Counter tokens (game/tickets.js): a free grab was already priced at 0 (see the pay item); a Slow Claw slows this sweep.
    if (purchase?.cost === 0) tickets?.use('freeGrab');
    const slow = tickets?.use('slowClaw') ? cfg.slowClawFactor : 1;
    grab = { number: grabsHere, capsules, paid: purchase?.cost ?? 0, t: 0, period: sweepSeconds(grabsHere) * slow, slow: slow > 1, lane: null, prize: null, timer: 0 };
    phase = 'sweeping';
    capsules.forEach((capsule, lane) => cabinet().rig.setCapsule(lane, capsuleColor(capsule)));
    lastLane = null;
    play('clawJingle');
    events.emit('clawGrab', { siteId: site.id, stock, capsules: capsules.map((c) => (!c ? null : c.plush ? { plush: true } : { gunId: c.id, capsule: c.capsule, refurbished: c.refurbished })) });
  }

  function drop(reason) {
    grab.lane = currentLane();
    grab.prize = grab.capsules[grab.lane];
    grab.timer = 0;
    phase = 'lifting';
    play('clawMotorDown');
    events.emit('clawDrop', { lane: grab.lane, gunId: grab.prize?.id ?? null, plush: !!grab.prize?.plush, reason });
  }

  // The grab is over (prize taken, timed out, or none): ready for the next, or closed once the site is sold out.
  function finish() {
    hideDisplay();
    cabinet().rig.reset();
    grab = null;
    if (stock <= 0) close('soldOut');
    else phase = 'idle';
  }

  // A Refurbished take changes a carried gun's mods (setMods cancels a reload or burst), so like the attachment counter it waits
  // while the gun in hand is switching, reloading, bursting or charging.
  const busy = (id) => gun.isSwitching || (gun.def.id === id && (gun.weapon.isReloading || gun.weapon.isBursting || gun.weapon.isCharging));

  function take() {
    const { id } = grab.prize;
    const outcome = takeOutcome(gun, grab.prize); // (checked again now: see the header)
    if (outcome.kind === 'new') {
      gun.give(weapons[id]); // (the base gun: a free slot = added, else it replaces the gun in hand; never the loaner rule's Staple Gun)
    } else {
      if (outcome.kind === 'refurbish') {
        gun.setMods(id, withAttachment(gun.defOf(id).base, gun.modsFor(id), outcome.attachment)); // (other mods, a build included, stay)
        unlockAttachment(gun, outcome.attachment); // owned for the run: refits are free, like a bought one
      }
      gun.weaponFor(id).refill(); // (after the attachment: a Jumbo Pack's bigger magazine comes full)
    }
    sound?.play('purchase');
    tickets?.add(cfg.tickets.capsules[grab.prize.capsule] ?? 0, 'prize'); // (a bad grab prints more)
    events.emit('clawPrize', { gunId: id, refurbished: outcome.attachment, outcome: outcome.kind });
    finish();
  }

  // Sunny: the money back (exactly what this grab charged, never the shelf price), and out of service.
  function landPlush() {
    if (!state.over) wallet.refund(grab.paid);
    tickets?.add(cfg.tickets.plush, 'plush');
    play('clawPlush');
    hideDisplay();
    cabinet().rig.reset();
    grab = null;
    close('plush');
    // ...and Sunny makes a run for the next site (picked just now), or walks a lap if there's nowhere else to go.
    sunny.start({ from: site, to: nextSite ?? site, floorOf, onPop: repick });
  }

  // SUNNY (game/features/clawSunny.js): he walks to where the machine will reopen. Popping him re-picks that site, among the other
  // open sites besides his (if there are any), as long as the machine hasn't reopened there already.
  const floorOf = (s) => cfg.sites.find((x) => x.id === s.id)?.floorY ?? 0;
  function repick(walkingTo) {
    if (phase !== 'closed' || nextSite !== walkingTo) return;
    const options = sites.filter((s) => s !== site && s !== walkingTo && zoneOpen(s));
    if (options.length) nextSite = options[Math.floor(Math.random() * options.length)];
  }
  const sunny = createClawSunny({ scene, nav: zombies?.nav ?? null, shootables, effects, tickets, sound, events });

  // The lift, for show: down with the prongs open, grip, up with the capsule swinging, over to the chute, let go.
  function updateLift(dt) {
    const before = grab.timer / cfg.liftSeconds;
    grab.timer += dt;
    const f = Math.min(1, grab.timer / cfg.liftSeconds);
    const { down, grip, up } = show.lift;
    const { rig } = cabinet();
    const over = rig.laneU[grab.lane];
    const crossed = (at) => before < at && f >= at;
    if (f < down) rig.setClaw(over, f / down, 0.3 + 0.7 * (f / down));
    else if (f < grip) {
      const closing = (f - down) / (grip - down);
      if (crossed(down)) play('clawGrab');
      if (closing >= 0.5 && grab.prize) rig.carry(grab.lane);
      rig.setClaw(over, 1, 1 - closing);
    } else {
      if (crossed(grip)) play('clawMotorUp');
      // The swing: grows to its worst just past `scare`, then settles over the chute.
      const t = grab.timer;
      const fear = Math.max(0, 1 - Math.abs(f - show.wobble.scare) / 0.25);
      const sway = grab.prize ? show.wobble.amplitude * (0.35 + fear) * Math.sin(t * show.wobble.hz * Math.PI * 2) * (1 - f) * 2 : 0;
      if (f < up) rig.setClaw(over, 1 - (f - grip) / (up - grip), 0, sway);
      else rig.setClaw(over + (rig.chuteU - over) * ((f - up) / (1 - up)), 0, 0, sway);
    }
    if (f < 1) return;
    if (!grab.prize) { finish(); return; }
    if (grab.prize.plush) { landPlush(); return; }
    rig.reset();
    phase = 'ready';
    grab.timer = 0;
    showDisplay(grab.prize.id);
    flapTimer = 0;
    play('chuteThunk');
    play('clawWin');
  }

  // --- The screen ---
  function screenText() {
    const text = cfg.screen;
    if (!zoneOpen()) return { title: cfg.name, lines: ['', 'CLOSED', ''], note: map.zones[site.zone].label.toUpperCase() };
    if (phase === 'closed') {
      const soldOut = closedReason === 'soldOut';
      return { title: cfg.name, lines: ['', soldOut ? text.soldOut : text.closed, ''], highlight: 1,
        note: soldOut ? text.soldOutNote : text.closedNote, tone: '#ff6b6b' };
    }
    if (phase === 'idle') {
      const price = pricing.priceOf('claw', 'grab');
      const lines = text.attract[Math.floor(attract / show.attractSeconds) % text.attract.length].map((l) => l.replace('{price}', price));
      return { title: cfg.name, lines, highlight: lines.findIndex((l) => l.endsWith(' PTS')), note: `${stock} LEFT · ${text.idle}`,
        tone: pricing.discountOf('claw') > 0 ? '#ffd23f' : '#ff7ac4' };
    }
    const lines = grab.capsules.map((c) => prizeName(c).toUpperCase());
    const dots = grab.capsules.map(capsuleColor);
    if (phase === 'sweeping') {
      return { title: text.sweeping, lines, dots, highlight: currentLane(), note: `${Math.ceil(Math.max(0, cfg.autoDropSeconds - grab.t))}`, tone: '#7dffb0' };
    }
    if (phase === 'lifting') return { title: text.lifting, lines, dots, highlight: grab.lane, note: '...', tone: '#ffd23f' };
    return { title: text.prize, lines: ['', prizeName(grab.prize).toUpperCase(), ''], dots: [null, capsuleColor(grab.prize), null], highlight: 1,
      note: `${Math.ceil(Math.max(0, cfg.takeSeconds - grab.timer))}`, tone: '#7dffb0' };
  }
  const refreshScreen = () => cabinet().screen.show(screenText());

  // --- The three interactions, one per step (only one is ever available, all at the glass front) ---
  const replaces = () => {
    if (!grab?.prize || gun.owns(grab.prize.id)) return null;
    if (gun.slots.length < 2) return null; // a free slot (with the Courtesy Loaner in hand too, like a wall buy)
    return describeCarried(gun.def, gun.modsFor(gun.def.id));
  };
  interactions.add({
    label: cfg.name,
    title: `${cfg.name} · Win a gun`,
    get detail() {
      if (phase === 'closed') return '';
      const tokens = [tickets?.has('freeGrab') && 'Free grab token', tickets?.has('slowClaw') && 'Slow Claw'].filter(Boolean);
      return `Three capsules · You choose when to drop · ${stock} left here${tokens.length ? ` · Using: ${tokens.join(', ')}` : ''}`;
    },
    get priceLabel() { return tickets?.has('freeGrab') ? 'Free grab' : null; }, // (a Prize Counter token: this grab costs nothing)
    get blocked() { return phase === 'closed' ? 'Out of service · Back next round' : null; },
    verb: 'play',
    kind: 'claw', // (the only claw step with a price: the drop and the take are free 'clawAction's)
    id: 'grab',
    get cost() { return tickets?.has('freeGrab') ? 0 : pricing.priceOf('claw', 'grab'); },
    get position() { return cabinet().position; },
    available: () => (phase === 'idle' || phase === 'closed') && zoneOpen(),
    use: pay,
  });
  interactions.add({
    get label() { return `Drop the claw · ${prizeName(grab.capsules[currentLane()])}`; },
    get title() { return this.label; },
    get detail() { return grab.capsules.map((c, lane) => `${lane === currentLane() ? '▸ ' : ''}${prizeName(c)}`).join(' · '); },
    verb: 'drop',
    kind: 'clawAction',
    id: 'drop',
    cost: 0,
    priceLabel: '',
    instant: true, // the press IS the drop: no hold
    quiet: true, // (not a purchase)
    get position() { return cabinet().position; },
    available: () => phase === 'sweeping',
    use: () => drop('press'),
  });
  // The take ticket says what you'd get NOW (takeOutcome), not what was rolled.
  const outcomeName = () => {
    const { kind, attachment } = takeOutcome(gun, grab.prize);
    return kind === 'refurbish' ? `${weapons[grab.prize.id].name} + ${attachmentById(attachment).name}` : weapons[grab.prize.id].name;
  };
  interactions.add({
    get label() { return `${outcomeName()} won`; },
    get title() { return `Take the ${outcomeName()}`; },
    get detail() {
      const { kind, attachment } = takeOutcome(gun, grab.prize);
      if (kind === 'refurbish') return `Refurbished · Refills your ${weapons[grab.prize.id].name} · Fits ${attachmentById(attachment).name} free · Free refits this run`;
      if (kind === 'refill') return 'You have one · Refills it';
      const lost = replaces();
      return lost ? `Replaces your ${lost}` : 'Fills your free slot';
    },
    get blocked() { return takeOutcome(gun, grab.prize).kind === 'refurbish' && busy(grab.prize.id) ? 'Busy · Finish reloading first' : null; },
    verb: 'take',
    kind: 'clawAction',
    id: 'take',
    cost: 0,
    priceLabel: 'Free',
    quiet: true,
    get position() { return cabinet().position; },
    available: () => phase === 'ready',
    use: take,
  });

  // A closed machine reopens with the round (never mid-grab: it only closes once a grab is over).
  events.on('roundStart', () => {
    if (state.over || phase !== 'closed') return;
    reopen(nextSite ?? pickSite());
  });

  function setUp() {
    sunny.reset();
    hideDisplay();
    flapTimer = Infinity;
    lastLane = null;
    attract = 0;
    for (const s of sites) {
      s.cabinet.rig.reset();
      s.cabinet.rig.setLive(s === sites[0]);
      if (s !== sites[0]) s.cabinet.screen.show({ title: cfg.name, lines: ['', cfg.screen.away, ''], highlight: 1, note: '' });
    }
    site = sites[0];
    phase = 'idle';
    grab = null;
    grabsHere = 0;
    stock = cfg.stock;
    closedReason = null;
    nextSite = null;
    forcePlush = false;
    refreshScreen();
  }
  setUp();

  return {
    get phase() { return phase; },
    get site() { return site; },
    get grab() { return grab; },
    get stock() { return stock; },
    get nextSite() { return nextSite; },
    get display() { return display; },
    sites,
    /** The lane under the claw right now (null unless sweeping). */
    get lane() { return phase === 'sweeping' ? currentLane() : null; },
    /** For the HUD: where the machine is and what it's doing (open = you can play it now or soon). */
    get status() {
      return { siteId: site.id, zone: site.zone, area: map.zones[site.zone].label, open: zoneOpen() && phase !== 'closed', phase, stock };
    },

    /** Sunny (game/features/clawSunny.js): .active, .target (his shootable), .shaking. */
    sunny,
    /** Debug: the next grab has a plush in one lane. */
    forcePlush() { forcePlush = true; },
    /**
     * Debug: move it now (to `siteId`, or a random other open site), restocked. Refused mid-grab (it never moves during one).
     * Returns the new site, or null.
     */
    moveNow(siteId = null) {
      if (phase !== 'idle' && phase !== 'closed') return null;
      const target = siteId ? sites.find((s) => s.id === siteId) : pickSite();
      if (!target || !zoneOpen(target)) return null;
      reopen(target);
      return site;
    },

    // (features only tick while playing and alive: a grab freezes with the game, and death can't pay anyone)
    update(dt) {
      if (state.over) return;
      sunny.update(dt);
      if (phase === 'idle') attract += dt;
      if (phase === 'sweeping') {
        grab.t += dt;
        cabinet().rig.setClaw(laneU(lanePosition()), 0, 0.3);
        const lane = currentLane();
        if (lane !== lastLane) { if (lastLane !== null) play('clawTick'); lastLane = lane; } // a tick into each lane: something to time against
        if (grab.t >= cfg.autoDropSeconds) drop('time');
      } else if (phase === 'lifting') {
        updateLift(dt);
      } else if (phase === 'ready') {
        grab.timer += dt;
        if (grab.timer >= cfg.takeSeconds) finish(); // (no refund: you won it and walked away)
      }
      if (flapTimer < show.flapSeconds) { // the flap swings out as the prize lands, and back
        flapTimer += dt;
        cabinet().rig.setFlap(flapTimer >= show.flapSeconds ? 0 : Math.sin(Math.PI * flapTimer / show.flapSeconds)); // (exactly shut at the end)
      }
      refreshScreen();
    },

    // Save & Quit (game/saveGame.js): where the machine stands and how much stock it has left. (A closed machine reopens at
    // 'roundStart', before the save is taken, so a save never holds a closed one; a grab under way is not kept.)
    serialize() {
      return { siteId: site.id, grabsHere, stock };
    },
    restore(data) {
      setUp();
      const target = sites.find((s) => s.id === data.siteId);
      if (target && target !== site) {
        cabinet().rig.setLive(false);
        cabinet().screen.show({ title: cfg.name, lines: ['', cfg.screen.away, ''], highlight: 1, note: '' });
        site = target;
        cabinet().rig.setLive(true);
      }
      grabsHere = data.grabsHere;
      stock = data.stock;
      refreshScreen();
    },

    reset: setUp,
  };
}
