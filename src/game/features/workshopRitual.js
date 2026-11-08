// =============================================================================
// THE BUILD-A-BLASTER RITUAL (built by game/features/workshop.js, never by createGame).
// Pack-a-Punch is a wait; this is a job. The player hands a gun over at the bench and fights for it:
//   idle     hold interact at the bench: the order form opens, already filled in (game/features/workshopOrderForm.js). Confirm and
//            the gun in your hand leaves the loadout; your other gun, or the Courtesy Loaner, comes up.
//   running  the gun rides the conveyor. Kills in the room fill the gauge AND take secondsPerKill off the clock; maxSeconds ends it.
//   ready    the gantry carries it to the Naming Booth, then it comes back to your hand by itself with its build. It only waits at
//            the booth (collect it there) when taking it would cost you a gun: you bought a second gun meanwhile.
// Doors stay open. Kills only count inside the room, and only there are spawns steered to the Returns Chute. The chute comes
// out of the round's normal budget (zombies.steerSpawns changes WHERE, rounds still decides how many), so the room can't be
// farmed and rounds still end.
//
// DOM-free: it listens and announces on g.events (game/events.js lists the 'ritual*' events), and main.js reads .status for
// the HUD. Its only runtime objects are the gun on the conveyor and the steered spawns: reset() clears both.
//
// The form offers today's stuffings: each round reopens todayCount bins, at random, from what is stocked (owning an area stocks its
// stuffing); the bins in the shop light up to match. A gun that already has a build can be re-stuffed for the lower price.
//
//   stations (from the map feature): { rooms: [rects], lever, booth, chute: [spawn markers], path: [Vector3...], bins: [{ id, position, lamp }], hearts: [{ id, position }] }
// =============================================================================

import { buildWeaponDisplay } from '../../weapons/models/index.js';
import { buildModifiers } from '../../weapons/upgrades.js';
import { weapons } from '../../config/weapons.js';
import { workshopRitual as cfg, workshopStuffings, workshopHearts, workshopNames, todayCount, buildOf, comboName, qualityFor, nextQualityFor, stageFor, paLine } from '../../config/workshop.js';
import * as THREE from 'three';
import { createOrderForm } from './workshopOrderForm.js';

const asLoaner = (def, name) => ({ ...def, name, loaner: true }); // (loaner: the gun model shows the security tag)
const scratch = new THREE.Vector3();

/** The point `fraction` of the way along a polyline ({ points, lengths, total }). */
function pointAlong({ points, lengths, total }, fraction, out) {
  let left = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]) return out.lerpVectors(points[i], points[i + 1], lengths[i] > 0 ? left / lengths[i] : 0);
    left -= lengths[i];
  }
  return out.copy(points[points.length - 1]);
}

function measured(points) {
  const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]));
  return { points, lengths, total: lengths.reduce((a, b) => a + b, 0) };
}

export function createWorkshopRitual({ bench, map, gun, pricing, interactions, events, player, zombies, rounds, scene, state, input, wallet, sound }) {
  const { stations } = bench;
  const path = measured(stations.path);
  // While it runs the gun only rides the belt (the path's first, level stretch); the gantry trip to the booth comes after.
  const beltSegments = path.lengths.findIndex((_, i) => stations.path[i + 1].y !== stations.path[0].y);
  const beltShare = path.lengths.slice(0, beltSegments < 0 ? path.lengths.length : beltSegments).reduce((a, b) => a + b, 0) / path.total;
  let phase = 'idle'; // 'idle' | 'running' | 'ready'
  let order = null; // { gunId, gunName, restuff, elapsed, kills, stage, reason, quality }
  let riding = 0; // how far along the belt the gun is drawn (0..1)
  let catchFrom = 0; // where it was when the order finished
  let display = null; // the gun on the conveyor
  let steering = false;
  let pick = { stuffing: null, heart: null }; // the last order, which the form opens with
  let today = []; // the stuffing ids in the bins this round
  const namesUsed = new Set(); // this run's names: no two guns share one until the list runs out

  function newName() {
    const free = workshopNames.filter((name) => !namesUsed.has(name));
    const pool = free.length ? free : workshopNames;
    const name = pool[Math.floor(Math.random() * pool.length)];
    namesUsed.add(name);
    return name;
  }

  const stocked = () => Object.keys(workshopStuffings).filter((id) => {
    const zone = workshopStuffings[id].stockedBy;
    return zone === null || map.zones[zone].open;
  });

  function setToday(ids) {
    today = ids;
    for (const bin of stations.bins) bin.lamp.visible = today.includes(bin.id);
  }

  function rollToday() {
    const pool = stocked();
    const chosen = [];
    while (chosen.length < todayCount && pool.length) chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    setToday(chosen);
  }

  // A newly stocked stuffing doesn't wait for the next round if a bin is still empty.
  function fillEmptyBins() {
    if (today.length >= todayCount) return;
    const extra = stocked().filter((id) => !today.includes(id));
    if (extra.length) setToday([...today, ...extra.slice(0, todayCount - today.length)]);
  }

  const inside = (p) => stations.rooms.some((r) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ
    && p.y >= r.minY && p.y <= r.maxY);

  function steer(on) {
    if (on === steering) return;
    steering = on;
    zombies.steerSpawns(on ? stations.chute : null, { dropHeight: cfg.chuteDropHeight, onDrop: () => events.emit('chuteDrop') });
  }

  function showGun(def) {
    display = buildWeaponDisplay(def);
    display.name = 'ritualGun';
    display.scale.setScalar(cfg.gunScale);
    riding = 0;
    pointAlong(path, 0, display.position);
    scene.add(display);
  }

  function hideGun() {
    if (!display) return;
    display.removeFromParent();
    display.traverse((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
      else o.material?.dispose?.();
    });
    display = null;
  }

  const hasBuild = () => buildOf(gun.modsFor(gun.def.id)) !== null;

  function start() {
    const def = gun.def;
    const restuff = hasBuild();
    const name = buildOf(gun.modsFor(def.id))?.name ?? null; // a re-stuffed gun keeps its name
    order = { gunId: def.id, gunName: def.name, name, restuff, stuffing: pick.stuffing, heart: pick.heart,
      elapsed: 0, kills: 0, stage: cfg.stages[0], reason: null, quality: null };
    pick = { stuffing: order.stuffing, heart: order.heart }; // next time the form opens with this
    const loaner = gun.slots.length === 1;
    gun.handOver(asLoaner(weapons[cfg.loaner.weapon], cfg.loaner.name));
    order.loaner = loaner;
    phase = 'running';
    showGun(def);
    const pa = paLine(restuff ? cfg.pa.restuff : cfg.pa.start, { gun: def.name, name });
    events.emit('ritualStart', { gunId: def.id, gunName: def.name, loaner, restuff, pa });
  }

  function finish(reason) {
    phase = 'ready';
    catchFrom = riding;
    order.reason = reason;
    order.quality = qualityFor(order.kills);
    steer(false);
    const pa = paLine(order.name ? cfg.pa.readyAgain : cfg.pa.ready, { gun: order.gunName, name: order.name });
    events.emit('ritualReady', { gunId: order.gunId, kills: order.kills, quality: order.quality, reason, pa });
  }

  function collect() {
    const name = order.name ?? newName();
    const confirmed = buildOf(gun.away.mods)?.confirmed ?? 0; // a re-stuffed gun keeps its record
    const build = { name, stuffing: order.stuffing, heart: order.heart, quality: order.quality.id, kills: order.kills, confirmed };
    const note = !order.loaner ? '' : gun.hasLoaner ? cfg.loanerNotes.returned : cfg.loanerNotes.lost;
    const modifiers = buildModifiers(gun.away.def.base, workshopStuffings[order.stuffing].color); // its shots streak in the stuffing's colour
    gun.collect((mods) => [...mods.filter((m) => m.id !== 'build'), { id: 'build', build, modifiers }]);
    hideGun();
    const certificate = {
      name, gunName: order.gunName, combo: comboName(build), stuffing: workshopStuffings[order.stuffing].name, heart: workshopHearts[order.heart].name,
      quality: order.quality.name, kills: order.kills, round: rounds.round, remark: cfg.remarks[order.quality.id], note,
    };
    const pa = paLine(order.name ? cfg.pa.collectAgain : cfg.pa.collect, { gun: order.gunName, name });
    const { gunId } = order;
    phase = 'idle';
    order = null;
    waitingSaid = false;
    events.emit('ritualCollect', { gunId, build, certificate, pa });
  }

  // The order form: everything on one sheet at the bench.
  const stockNote = (id) => {
    const zone = workshopStuffings[id].stockedBy;
    return zone && !map.zones[zone].open ? `Stocked once ${map.zones[zone].label} is open` : 'Not in today\'s bins';
  };
  const form = createOrderForm({
    input, state, wallet, events, sound,
    label: () => `${hasBuild() ? 'Re-stuff' : 'Stuff'} your ${gun.def.name}`,
    price: () => pricing.priceOf('workshop', hasBuild() ? 'restuff' : 'ritual'),
    options: () => {
      const ids = Object.keys(workshopStuffings);
      const listed = [...ids.filter((id) => today.includes(id)), ...ids.filter((id) => !today.includes(id))];
      return {
        stuffings: listed.map((id) => ({ id, available: today.includes(id), note: today.includes(id) ? null : stockNote(id) })),
        hearts: Object.keys(workshopHearts),
      };
    },
    defaults: () => {
      const stuffing = today.includes(pick.stuffing) ? pick.stuffing : today[0];
      return { stuffing, heart: pick.heart ?? workshopStuffings[stuffing]?.defaultHeart ?? Object.keys(workshopHearts)[0] };
    },
    onOrder: (stuffing, heart) => {
      pick = { stuffing, heart };
      start();
    },
  });
  const benchReady = () => phase === 'idle' && map.zones[bench.zone].open && !gun.isSwitching && !gun.isLoaner
    && !gun.weapon.isReloading && !gun.weapon.isBursting && !gun.weapon.isCharging;

  interactions.add({
    get label() { return `${hasBuild() ? 'Re-stuff' : 'Stuff'} your ${gun.def.name}`; },
    get title() { return this.label; },
    detail: 'Opens the order form',
    kind: 'ritual',
    id: 'orderForm',
    verb: 'order',
    cost: 0,
    get priceLabel() { return pricing.priceOf('workshop', hasBuild() ? 'restuff' : 'ritual').toLocaleString('en-US'); },
    quiet: true,
    position: bench.position,
    available: benchReady,
    use: () => form.open(),
  });

  // Done, and back at the booth: it comes back to you by itself, unless taking it would cost you a gun.
  const arrived = () => phase === 'ready' && riding >= 1;
  const canHandBack = () => !gun.collectReplaces && !gun.isSwitching && !gun.weapon.isReloading && !gun.weapon.isBursting && !gun.weapon.isCharging;
  let waitingSaid = false;
  interactions.add({
    get label() { return `${order.gunName} collected`; },
    get title() { return `Collect your ${order.gunName}`; },
    get detail() { return `${order.quality.name} · Replaces your ${gun.collectReplaces}`; },
    kind: 'ritual',
    id: 'collect',
    verb: 'collect',
    cost: 0,
    priceLabel: 'Free',
    position: stations.booth,
    available: () => arrived() && !!gun.collectReplaces,
    use: collect,
  });

  rollToday();
  events.on('roundStart', rollToday);
  events.on('playerDeath', () => form.close());
  events.on('kill', ({ zombie }) => {
    if (state.over || zombie.noRewards || phase !== 'running' || !inside(zombie.position)) return; // (a burn can outlive the player)
    const before = qualityFor(order.kills);
    order.kills += 1;
    order.elapsed += cfg.secondsPerKill; // a busy room finishes it sooner
    const quality = qualityFor(order.kills);
    events.emit('ritualKill', { zombie, kills: order.kills, quality });
    if (quality !== before) events.emit('ritualQuality', { quality, pa: cfg.pa.qualities[quality.id] });
  });

  return {
    get phase() { return phase; },
    get gunPosition() { return display?.position ?? null; }, // the gun on the conveyor (the arm follows it)
    get stuffingColor() { return order ? workshopStuffings[order.stuffing].color : null; },
    get steering() { return steering; },
    get today() { return today; },
    get pick() { return pick; },
    /** Fill the next order form with this (tests and debugging; the form itself remembers your last order). */
    choose(stuffing, heart) { pick = { stuffing, heart }; },
    /** The order form's state for ui/orderForm.js (null while closed), and the form itself. */
    get form() { return form.view; },
    orderForm: form,
    /** End the running ritual now, as if the clock ran out (tests and debugging). */
    finishNow() { if (phase === 'running') finish('time'); },

    /** For the HUD: null with nothing on order. */
    get status() {
      if (phase === 'idle') return null;
      return {
        progress: phase === 'running' ? Math.min(1, order.elapsed / cfg.maxSeconds) : 1,
        waiting: arrived() && gun.collectReplaces ? gun.collectReplaces : null,
        phase,
        stuffingName: workshopStuffings[order.stuffing].name,
        heartName: workshopHearts[order.heart].name,
        gunName: order.gunName,
        stage: order.stage.label,
        kills: order.kills,
        quality: order.quality ?? qualityFor(order.kills),
        next: nextQualityFor(order.kills),
        secondsLeft: Math.max(0, cfg.maxSeconds - order.elapsed),
      };
    },

      update(dt) {
      fillEmptyBins();
      form.update(dt);
      if (phase === 'idle') return;
      if (phase === 'running') {
        steer(inside(player.position)); // run from the room and the zombies go back to finding you the normal way
        order.elapsed += dt;
        const fraction = Math.min(1, order.elapsed / cfg.maxSeconds);
        const stage = stageFor(fraction);
        if (stage !== order.stage) {
          order.stage = stage;
          events.emit('ritualStage', { stage, pa: cfg.pa.stages[stage.id] });
        }
        riding = fraction * beltShare;
        if (order.elapsed >= cfg.maxSeconds) finish('time');
      } else {
        riding = Math.min(1, riding + (dt * (1 - catchFrom)) / cfg.catchUpSeconds); // (from wherever it was: always catchUpSeconds to the booth)
      }
      pointAlong(path, riding, scratch);
      display.position.copy(scratch);
      if (arrived()) {
        if (canHandBack()) collect();
        else if (gun.collectReplaces && !waitingSaid) {
          waitingSaid = true;
          events.emit('ritualWaiting', { gunId: order.gunId, pa: paLine(cfg.pa.waiting, { gun: gun.collectReplaces }) });
        }
      }
    },

    reset() {
      phase = 'idle';
      order = null;
      riding = 0;
      pick = { stuffing: null, heart: null };
      waitingSaid = false;
      form.reset();
      namesUsed.clear();
      rollToday();
      steer(false);
      hideGun();
    },
  };
}
