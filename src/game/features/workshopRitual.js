// =============================================================================
// THE BUILD-A-BLASTER RITUAL (built by game/features/workshop.js, never by createGame).
// Pack-a-Punch is a wait; this is a job. The player hands a gun over at the bench and fights for it:
//   idle     the bench takes the gun in your hand. It leaves the loadout; your other gun, or the Courtesy Loaner, comes up.
//   running  the gun rides the conveyor. Kills in the room fill the gauge. The lever ends it early; maxSeconds ends it anyway.
//   ready    the gun waits at the Naming Booth for as long as it takes. Collecting it fits the build and goes back to idle.
// Doors stay open. Kills only count inside the room, and only there are spawns steered to the Returns Chute. The chute comes
// out of the round's normal budget (zombies.steerSpawns changes WHERE, rounds still decides how many), so the room can't be
// farmed and rounds still end.
//
// DOM-free: it listens and announces on g.events (game/events.js lists the 'ritual*' events), and main.js reads .status for
// the HUD. Its only runtime objects are the gun on the conveyor and the steered spawns: reset() clears both.
//
// Before the bench: pick a Stuffing from today's bins and a Heart from the wall. Each round reopens todayCount bins, at random, from what
// is stocked (owning an area stocks its stuffing). A gun that already has a build can be re-stuffed for the lower price.
//
//   stations (from the map feature): { rooms: [rects], lever, booth, chute: [spawn markers], path: [Vector3...], bins: [{ id, position, lamp }], hearts: [{ id, position }] }
// =============================================================================

import { buildWeaponDisplay } from '../../weapons/models/index.js';
import { buildModifiers } from '../../weapons/upgrades.js';
import { weapons } from '../../config/weapons.js';
import { workshopRitual as cfg, workshopStuffings, workshopHearts, workshopNames, todayCount, buildOf, qualityFor, nextQualityFor, stageFor, paLine } from '../../config/workshop.js';
import * as THREE from 'three';

const copyWithName = (def, name) => ({ ...def, name });
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

export function createWorkshopRitual({ bench, map, gun, pricing, interactions, events, player, zombies, rounds, scene, state }) {
  const { stations } = bench;
  const path = measured(stations.path);
  let phase = 'idle'; // 'idle' | 'running' | 'ready'
  let order = null; // { gunId, gunName, restuff, elapsed, kills, stage, reason, quality }
  let riding = 0; // how far along the belt the gun is drawn (0..1)
  let display = null; // the gun on the conveyor
  let steering = false;
  let pick = { stuffing: null, heart: null }; // what the next order will be
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
    if (pick.stuffing && !today.includes(pick.stuffing)) pick.stuffing = null;
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
    pick = { stuffing: null, heart: null };
    const loaner = gun.slots.length === 1;
    gun.handOver(copyWithName(weapons[cfg.loaner.weapon], cfg.loaner.name));
    phase = 'running';
    showGun(def);
    const pa = paLine(restuff ? cfg.pa.restuff : cfg.pa.start, { gun: def.name, name });
    events.emit('ritualStart', { gunId: def.id, gunName: def.name, loaner, restuff, pa });
  }

  function finish(reason) {
    phase = 'ready';
    order.reason = reason;
    order.quality = qualityFor(order.kills);
    steer(false);
    const pa = paLine(order.name ? cfg.pa.readyAgain : cfg.pa.ready, { gun: order.gunName, name: order.name });
    events.emit('ritualReady', { gunId: order.gunId, kills: order.kills, quality: order.quality, reason, pa });
  }

  function collect() {
    const name = order.name ?? newName();
    const build = { name, stuffing: order.stuffing, heart: order.heart, quality: order.quality.id, kills: order.kills };
    const modifiers = buildModifiers(gun.away.def.base, workshopStuffings[order.stuffing].color); // its shots streak in the stuffing's colour
    gun.collect((mods) => [...mods.filter((m) => m.id !== 'build'), { id: 'build', build, modifiers }]);
    hideGun();
    const certificate = {
      name, gunName: order.gunName, stuffing: workshopStuffings[order.stuffing].name, heart: workshopHearts[order.heart].name,
      quality: order.quality.name, kills: order.kills, round: rounds.round, remark: cfg.remarks[order.quality.id],
    };
    const pa = paLine(order.name ? cfg.pa.collectAgain : cfg.pa.collect, { gun: order.gunName, name });
    const { gunId } = order;
    phase = 'idle';
    order = null;
    events.emit('ritualCollect', { gunId, build, certificate, pa });
  }

  for (const bin of stations.bins) {
    const stuffing = workshopStuffings[bin.id];
    interactions.add({
      label: `${stuffing.name} picked`,
      title: stuffing.name,
      detail: stuffing.blurb,
      kind: 'ritual',
      id: `stuffing:${bin.id}`,
      verb: 'pick',
      cost: 0,
      priceLabel: 'Free',
      position: bin.position,
      available: () => phase === 'idle' && map.zones[bench.zone].open && today.includes(bin.id) && pick.stuffing !== bin.id,
      use: () => { pick.stuffing = bin.id; },
    });
  }
  for (const spot of stations.hearts) {
    const heart = workshopHearts[spot.id];
    interactions.add({
      label: `${heart.name} heart picked`,
      title: `${heart.name} heart`,
      detail: heart.blurb,
      kind: 'ritual',
      id: `heart:${spot.id}`,
      verb: 'pick',
      cost: 0,
      priceLabel: 'Free',
      position: spot.position,
      available: () => phase === 'idle' && map.zones[bench.zone].open && pick.heart !== spot.id,
      use: () => { pick.heart = spot.id; },
    });
  }

  interactions.add({
    get label() { return `${gun.def.name} handed over`; },
    get title() { return `${hasBuild() ? 'Re-stuff' : 'Stuff'} your ${gun.def.name}`; },
    get detail() {
      if (!pick.stuffing || !pick.heart) return 'Pick a Stuffing from the bins and a Heart from the wall.';
      return `${workshopStuffings[pick.stuffing].name} · ${workshopHearts[pick.heart].name} heart. Fight in the room to fill the tank.`;
    },
    get blocked() {
      return !pick.stuffing ? 'Pick a Stuffing' : !pick.heart ? 'Pick a Heart' : null;
    },
    kind: 'workshop',
    get id() { return hasBuild() ? 'restuff' : 'ritual'; },
    verb: 'stuff',
    get cost() { return pricing.priceOf('workshop', this.id); },
    position: bench.position,
    available: () => phase === 'idle' && map.zones[bench.zone].open && !gun.isSwitching && !gun.isLoaner
      && !gun.weapon.isReloading && !gun.weapon.isBursting && !gun.weapon.isCharging,
    use: start,
  });
  interactions.add({
    label: 'Lever pulled',
    title: 'Finish early',
    get detail() { return `${order.quality?.name ?? qualityFor(order.kills).name} so far`; },
    kind: 'ritual',
    id: 'lever',
    verb: 'pull',
    cost: 0,
    priceLabel: 'Free',
    position: stations.lever,
    available: () => phase === 'running',
    use: () => finish('lever'),
  });
  interactions.add({
    get label() { return `${order.gunName} collected`; },
    get title() { return `Collect your ${order.gunName}`; },
    get detail() {
      const replaces = gun.collectReplaces;
      return replaces ? `${order.quality.name} · Replaces your ${replaces}` : order.quality.name;
    },
    kind: 'ritual',
    id: 'collect',
    verb: 'collect',
    cost: 0,
    priceLabel: 'Free',
    position: stations.booth,
    available: () => phase === 'ready',
    use: collect,
  });

  rollToday();
  events.on('roundStart', rollToday);
  events.on('kill', ({ zombie }) => {
    if (state.over || phase !== 'running' || !inside(zombie.position)) return; // (a burn can outlive the player)
    const before = qualityFor(order.kills);
    order.kills += 1;
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
    /** Pick for the next order, as the bins and Heart wall do (for tests and debugging). */
    choose(stuffing, heart) { pick = { stuffing, heart }; },

    /** For the HUD: null with nothing on order. */
    get status() {
      if (phase === 'idle') {
        if (!pick.stuffing && !pick.heart) return null;
        return { phase: 'picking', stuffing: workshopStuffings[pick.stuffing]?.name ?? null, heart: workshopHearts[pick.heart]?.name ?? null };
      }
      return {
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
        riding = fraction;
        if (order.elapsed >= cfg.maxSeconds) finish('time');
      } else {
        riding = Math.min(1, riding + dt / cfg.catchUpSeconds);
      }
      pointAlong(path, riding, scratch);
      display.position.copy(scratch);
    },

    reset() {
      phase = 'idle';
      order = null;
      riding = 0;
      pick = { stuffing: null, heart: null };
      namesUsed.clear();
      rollToday();
      steer(false);
      hideGun();
    },
  };
}
