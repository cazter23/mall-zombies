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
//   stations (from the map feature): { rooms: [rects], lever, booth, chute: [spawn markers], path: [Vector3...] }
// =============================================================================

import { buildWeaponDisplay } from '../../weapons/models/index.js';
import { weapons } from '../../config/weapons.js';
import { workshopRitual as cfg, qualityFor, nextQualityFor, stageFor } from '../../config/workshop.js';
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

export function createWorkshopRitual({ bench, map, gun, pricing, interactions, events, player, zombies, scene }) {
  const { stations } = bench;
  const path = measured(stations.path);
  let phase = 'idle'; // 'idle' | 'running' | 'ready'
  let order = null; // { gunId, gunName, restuff, elapsed, kills, stage, reason, quality }
  let riding = 0; // how far along the belt the gun is drawn (0..1)
  let display = null; // the gun on the conveyor
  let steering = false;

  const inside = (p) => stations.rooms.some((r) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ
    && p.y >= r.minY && p.y <= r.maxY);

  function steer(on) {
    if (on === steering) return;
    steering = on;
    zombies.steerSpawns(on ? stations.chute : null);
  }

  function showGun(def) {
    display = buildWeaponDisplay(def);
    display.name = 'ritualGun';
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

  function start() {
    const def = gun.def;
    const restuff = false;
    order = { gunId: def.id, gunName: def.name, restuff, elapsed: 0, kills: 0, stage: cfg.stages[0], reason: null, quality: null };
    const loaner = gun.slots.length === 1;
    gun.handOver(copyWithName(weapons[cfg.loaner.weapon], cfg.loaner.name));
    phase = 'running';
    showGun(def);
    events.emit('ritualStart', { gunId: def.id, gunName: def.name, loaner, restuff, pa: cfg.pa.start });
  }

  function finish(reason) {
    phase = 'ready';
    order.reason = reason;
    order.quality = qualityFor(order.kills);
    steer(false);
    events.emit('ritualReady', { gunId: order.gunId, kills: order.kills, quality: order.quality, reason, pa: cfg.pa.ready });
  }

  function collect() {
    const build = { quality: order.quality.id, kills: order.kills };
    gun.collect((mods) => [...mods.filter((m) => m.id !== 'build'), { id: 'build', build }]);
    hideGun();
    const { gunId } = order;
    phase = 'idle';
    order = null;
    events.emit('ritualCollect', { gunId, build, pa: cfg.pa.collect });
  }

  interactions.add({
    get label() { return `${gun.def.name} handed over`; },
    get title() { return `Build-A-Blaster: ${gun.def.name}`; },
    detail: 'Hand it over. Fight in the room to fill the tank. Collect it at the Naming Booth.',
    kind: 'workshop',
    id: 'ritual',
    verb: 'stuff',
    get cost() { return pricing.priceOf('workshop', 'ritual'); },
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

  events.on('kill', ({ zombie }) => {
    if (phase !== 'running' || !inside(zombie.position)) return;
    order.kills += 1;
    events.emit('ritualKill', { zombie, kills: order.kills, quality: qualityFor(order.kills) });
  });

  return {
    get phase() { return phase; },
    /** For the HUD: null when idle. */
    get status() {
      if (phase === 'idle') return null;
      return {
        phase,
        gunName: order.gunName,
        stage: order.stage.label,
        kills: order.kills,
        quality: order.quality ?? qualityFor(order.kills),
        next: nextQualityFor(order.kills),
        secondsLeft: Math.max(0, cfg.maxSeconds - order.elapsed),
      };
    },

    update(dt) {
      if (phase === 'idle') return;
      if (phase === 'running') {
        steer(inside(player.position)); // run from the room and the zombies go back to finding you the normal way
        order.elapsed += dt;
        const fraction = Math.min(1, order.elapsed / cfg.maxSeconds);
        const stage = stageFor(fraction);
        if (stage !== order.stage) {
          order.stage = stage;
          events.emit('ritualStage', { stage });
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
      steer(false);
      hideGun();
    },
  };
}
