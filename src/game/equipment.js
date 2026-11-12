// =============================================================================
// EQUIPMENT: Kiosk Kevin's products in your two pockets (docs/kiosk-kevin-plan.md; numbers: config/kiosk.js).
// A player system like melee, built and ticked by createGame.js (DOM-free, so it runs in the headless tests): g.equipment.
//
//   Two pockets, 'lethal' (the `lethal` action: G / RB) and 'tactical' (`tactical`: middle mouse / D-pad right). Each holds ONE
//   kind of product with a number of charges. A product's pocket comes from its config entry.
//   Tap the button: that pocket's item is thrown along the view with a lob. One throw at a time (either pocket); a throw blocks
//   the gun for kiosk.throw.blockSeconds (createGame passes isBusy into gun.update's `blocked`) and cancels a reload, like a
//   box-cutter swing. Refused while switching guns, vaulting, swinging, in a menu (state.menu) or dead.
//   Thrown things fly on `throwables` (weapons/ballistics.js with zombies: 'bounce': they bounce off zombies without hurting
//   them) and do their job when their fuse runs out (the Soda Bomb: a blast, game/equipment/equipmentDamage.js) or when they
//   land (product.opens: 'touch' = the first thing it touches, 'floor' = the first floor; or wherever it stops, or after
//   product.landSeconds): the Glitter Bomb opens (game/equipment/glitterBomb.js), the Sparkler Cake sits and sprays for a
//   while (game/equipment/sparklerCake.js), the SPIN-O-MATIC Sentry stands up and shoots for its lifetime
//   (game/equipment/sentry.js; one out at a time: a second can't be thrown while one is out). The Air Horn isn't thrown: it
//   sounds at once. Nothing thrown is ever saved (Save & Quit keeps only the pockets, as of the round's start).
//   Equipment damage goes through zombie.takeHit({ source: 'equipment' }), so a kill pays through 'kill' like any other. It
//   never emits 'hit' (no +10, no boss onHit reactions) and skips anything that isn't a zombie (no `type`) or pays nothing
//   (`noRewards`: Sunny, fans).
//
//   const equipment = createEquipment({ input, player, gun, melee, health, state, shootables, colliders, effects, sound, events,
//                                       throwables, getRound })
//   equipment.give(id, count)   put `count` charges of product `id` in its pocket: the same kind adds, another kind replaces it
//   equipment.fill()            every pocket that has a product to sell, full (the 'pockets' debug command)
//   equipment.update(dt, { inMenu })   the buttons and the throw timer (before the gun; in a menu the buttons aren't read,
//                                      so the menu keeps D-pad right)
//   equipment.updateThrown(dt)  fuses and bursts (after throwables.update, so it bursts where the bottle is now)
//   equipment.detonate(id, position)   a product does its job there now, as if it had landed there (tests): a Soda Bomb bursts,
//                                      a Glitter Bomb opens, a Sparkler Cake starts spraying, a Sentry is deployed
//   equipment.sentry            the Sentry that is out (a live item, deployed or still in the air), or null
//   equipment.clearThrown()     every thrown thing gone (death; Play again)
//   equipment.live              thrown things still out: { id, position, previous, age, flying, settled, spraying, removed }
//                               (fx/throwableView.js draws them; a Sparkler Cake stays in it while it sprays)
//   equipment.pockets           { lethal: { id, count }, tactical: { id, count } } (id null = empty)
//   equipment.status            for the HUD: { busy, lethal: { id, name, count }, tactical: { ... } }
//   equipment.isBusy            mid-throw (the gun and the box cutter wait)
//   equipment.reset()           Play again: empty pockets, nothing in the air
// =============================================================================

import * as THREE from 'three';
import { kiosk, productOf } from '../config/kiosk.js';
import { castShot } from '../weapons/hitscan.js';
import { blastDamage } from './equipment/equipmentDamage.js';
import { openGlitterBomb } from './equipment/glitterBomb.js';
import { pulseSparklerCake } from './equipment/sparklerCake.js';
import { sentryTarget, fireSentry } from './equipment/sentry.js';

const DEG_TO_RAD = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const emptyPocket = () => ({ id: null, count: 0 });

export function createEquipment({
  input, player, gun, melee, health, state, shootables, colliders, effects, sound, events, throwables, getRound,
}) {
  const pockets = Object.fromEntries(kiosk.pockets.map((p) => [p, emptyPocket()]));
  const live = [];
  let busyTimer = 0;

  const eye = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const toTarget = new THREE.Vector3();

  function canThrow() {
    return !state.over && !health.isDead && !state.menu && busyTimer <= 0
      && !gun.isSwitching && !player.vault.active && !melee.isBusy;
  }

  /** The view direction lifted by the lob angle (straight up at most). */
  function throwDirection(out) {
    player.getAim(eye, out);
    const pitch = Math.min(89 * DEG_TO_RAD, Math.asin(Math.max(-1, Math.min(1, out.y))) + kiosk.throw.lobDegrees * DEG_TO_RAD);
    const flat = Math.hypot(out.x, out.z) || 1;
    const cos = Math.cos(pitch);
    return out.set((out.x / flat) * cos, Math.sin(pitch), (out.z / flat) * cos);
  }

  function useFrom(pocketId) {
    const pocket = pockets[pocketId];
    const product = productOf(pocket.id);
    if (!product || pocket.count <= 0 || !canThrow()) return false;
    if (product.turret && sentryOut()) return false; // (one Sentry at a time: the charge stays in the pocket)
    pocket.count -= 1;
    const id = pocket.id;
    if (pocket.count === 0) pocket.id = null;
    busyTimer = kiosk.throw.blockSeconds;
    gun.weapon.cancelReload(); // (like a box-cutter swing)
    if (product.horn) {
      blastHorn(product.horn);
      return true;
    }
    throwDirection(aim);
    const start = eye.clone().addScaledVector(aim, kiosk.throw.startOffset);
    start.y -= kiosk.throw.startDrop;
    const item = newItem(id, product, start);
    item.ball = throwables.launch({
      position: start,
      direction: aim,
      projectile: product.projectile,
      onBounce: ({ ball, normal, target }) => {
        if (ball.velocity.length() > 3) sound?.play(product.sounds.bounce, { volume: 0.6 });
        // It lands: on anything ('touch'), or on a floor ('floor': a surface facing up, not a wall or a zombie).
        if (product.opens === 'touch' || (product.opens === 'floor' && !target && normal.y > 0.5)) item.landed = true;
      },
    });
    live.push(item);
    sound?.play(product.sounds.throw);
    events.emit('equipmentThrown', { id, pocket: pocketId, left: pocket.count });
    return true;
  }

  const newItem = (id, product, position) => ({
    id, product, position: position.clone(), previous: position.clone(), age: 0, flying: true, removed: false, ball: null,
    landed: false, settled: false, spraying: false, sprayLeft: 0, pulseTimer: 0,
    deployed: false, lifeLeft: 0, fireTimer: 0, muzzle: null, yaw: 0, hunting: true, lastShot: null, // (a Sentry)
  });

  // Zombies whose nearest hitbox is within `radius` of `point`, on its floor and in sight of it, nearest first (a snapshot:
  // a kill listener can change the list of targets). "On its floor": the point is no further than floorTolerance below a
  // zombie's feet or above its head (a card that opens on a zombie's chest is on that zombie's floor; one floor up is not).
  function targetsNear(point, radius, floorTolerance) {
    const found = [];
    for (const target of shootables) {
      if (!target.isAlive || !target.type || target.noRewards) continue; // (only zombies: never Sunny, fans or dummies)
      const above = point.y - target.position.y;
      if (above < -floorTolerance || above > (target.type.height ?? 2) + floorTolerance) continue;
      const distance = distanceTo(target, point);
      if (distance > radius || !inView(point, target)) continue;
      found.push({ target, distance });
    }
    return found.sort((a, b) => a.distance - b.distance).map((entry) => entry.target);
  }

  // A thrown thing that opens on landing has landed (or stopped, or run out of time): it stays where it is and does its job.
  function settle(item) {
    item.settled = true;
    item.flying = false;
    if (item.ball) item.ball.alive = false;
    item.ball = null;
    const { product } = item;
    if (product.confuse) {
      const { radius, floorTolerance } = product.confuse;
      const confused = openGlitterBomb({ product, point: item.position, targets: targetsNear(item.position, radius, floorTolerance),
        round: getRound(), effects, sound });
      remove(item);
      events.emit('equipmentBurst', { id: item.id, position: item.position.clone(), radius,
        hit: confused.map((target) => ({ target, damage: 0, killed: false })) });
    } else if (product.spray) {
      item.spraying = true;
      item.sprayLeft = product.spray.seconds;
      item.pulseTimer = 0; // (the first pulse is right away)
      sound?.play(product.sounds.spray);
    } else if (product.turret) {
      const floorY = item.position.y - (product.projectile?.radius ?? 0);
      item.deployed = true;
      item.lifeLeft = product.turret.lifeSeconds;
      item.fireTimer = product.turret.warmupSeconds;
      item.muzzle = item.position.clone().setY(floorY + product.turret.muzzleHeight);
      item.position.y = floorY; // (it stands on the floor)
      item.previous.copy(item.position);
      item.yaw = 0;
      sound?.play(product.sounds.deploy);
      events.emit('sentryDeployed', { position: item.position.clone() });
    }
  }

  const sentryOut = () => live.find((item) => item.product.turret && !item.removed) ?? null;

  // One tick of a deployed Sentry: it looks for a target only when it's ready to fire (a few times a second, so the line-of-sight
  // rays stay cheap), turns to it and shoots; otherwise it spins. Spent after its lifetime.
  function runTurret(item, dt) {
    const { turret } = item.product;
    item.lifeLeft -= dt;
    item.fireTimer -= dt;
    if (item.fireTimer <= 1e-9) {
      const target = sentryTarget({ muzzle: item.muzzle, turret, shootables, colliders });
      if (target) {
        item.yaw = Math.atan2(target.position.x - item.muzzle.x, target.position.z - item.muzzle.z);
        item.lastShot = fireSentry({ muzzle: item.muzzle, turret, target, shootables, colliders, round: getRound(), effects, sound,
          fireSound: item.product.sounds.fire, look: item.product.look });
        item.fireTimer += turret.fireSeconds;
      } else {
        item.fireTimer = 0; // (nothing in sight: it looks again next tick)
      }
      item.hunting = !target;
    }
    if (item.hunting) item.yaw += turret.spinSpeed * Math.PI * 2 * dt;
    if (item.lifeLeft <= 1e-9) {
      remove(item);
      events.emit('sentryExpired', { position: item.position.clone() });
    }
  }

  // One tick of a Sparkler Cake on the floor: a pulse every pulseSeconds, then it's spent.
  function spray(item, dt) {
    const cfg = item.product.spray;
    if (item.pulseTimer <= 1e-9) {
      item.pulseTimer += cfg.pulseSeconds;
      pulseSparklerCake({ product: item.product, point: item.position, targets: targetsNear(item.position, cfg.radius, cfg.floorTolerance),
        round: getRound(), effects });
    }
    item.pulseTimer -= dt;
    item.sprayLeft -= dt;
    if (item.sprayLeft <= 1e-9) remove(item);
  }

  function blastHorn(horn) {
    const origin = player.position;
    player.getAim(eye, aim);
    let pushed = 0;
    for (const target of shootables) {
      if (!target.isAlive || !target.type || target.noRewards || target.type.boss) continue;
      const { x, y, z } = target.position;
      if (Math.abs(y - origin.y) > horn.floorTolerance || Math.hypot(x - origin.x, z - origin.z) > horn.radius) continue;
      toTarget.set(x, y + horn.chestHeight, z).sub(eye);
      const distance = toTarget.length();
      if (distance > 1e-3 && castShot(eye, toTarget.divideScalar(distance), distance, colliders, []).worldHit) continue;
      const mascot = target.type.mascot;
      const weight = mascot && !target.mascotHeadOff ? mascot.hitKnockbackScale : 1;
      target.staggerAway(origin, { ...horn.stagger, knockback: horn.stagger.knockback * weight });
      pushed++;
    }
    sound?.play(horn.sound);
    events.emit('airHornBlast', { position: origin.clone(), radius: horn.radius, pushed }); // (the blast ring: fx/kioskSpectacle.js)
  }

  /** Distance from `point` to a target's nearest hitbox (0 = touching it). */
  function distanceTo(target, point) {
    let best = Infinity;
    for (const hitbox of target.hitboxes ?? []) {
      hitbox.box.clampPoint(point, closest);
      const d = closest.distanceTo(point);
      if (d < best) best = d;
    }
    return best;
  }

  /** Nothing solid between the blast and the target (a wall shields it). */
  function inView(point, target) {
    const box = (target.hitboxes.find((h) => h.part === 'body') ?? target.hitboxes[0]).box;
    box.getCenter(toTarget);
    const distance = toTarget.distanceTo(point);
    if (distance < 1e-3) return true;
    toTarget.sub(point).divideScalar(distance);
    const result = castShot(point, toTarget, distance, colliders, []);
    return !result.worldHit;
  }

  // The Soda Bomb's blast: every zombie within the radius (and in view of it) takes the falloff damage.
  function burst(item) {
    const { product } = item;
    const blast = product.blast;
    const centre = item.position;
    const round = getRound();
    // Snapshot first: a kill listener can change the list of targets.
    const inRange = [];
    for (const target of shootables) {
      if (!target.isAlive || !target.type || target.noRewards) continue; // (only zombies: never Sunny, fans or dummies)
      const distance = distanceTo(target, centre);
      if (distance > blast.radius || !inView(centre, target)) continue;
      inRange.push({ target, distance });
    }
    const hit = [];
    for (const { target, distance } of inRange) {
      if (!target.isAlive) continue; // (killed by an earlier kill's listener: no hits on corpses)
      const damage = blastDamage(target, distance, blast, round);
      if (damage <= 0) continue;
      const away = new THREE.Vector3(target.position.x - centre.x, 0, target.position.z - centre.z);
      if (away.lengthSq() < 1e-6) away.set(0, 0, 1);
      away.normalize();
      const { killed } = target.takeHit({ damage, part: 'body', source: 'equipment', direction: away, impact: product.impact });
      hit.push({ target, damage, killed });
      effects.splat(target.position.clone().setY(centre.y + 0.6), away, target.splatColors, 8, { flesh: true, direction: away });
    }
    effects.splat(centre, UP, product.look.splat, product.look.splatCount, { speedScale: 1.5 });
    sound?.play(product.sounds.burst);
    events.emit('equipmentBurst', { id: item.id, position: centre.clone(), radius: blast.radius, hit });
  }

  function remove(item) {
    item.removed = true;
    if (item.ball) item.ball.alive = false; // (ballistics drops it on its next update)
    item.ball = null;
  }

  return {
    pockets,
    live,

    get sentry() {
      return sentryOut();
    },

    get isBusy() {
      return busyTimer > 0;
    },

    get status() {
      const view = (pocketId) => {
        const { id, count } = pockets[pocketId];
        return { id, name: productOf(id)?.name ?? null, count };
      };
      return { busy: busyTimer > 0, lethal: view('lethal'), tactical: view('tactical') };
    },

    give(id, count) {
      const product = productOf(id);
      if (!product) throw new Error(`equipment: unknown product "${id}"`);
      const pocket = pockets[product.pocket];
      const amount = count ?? product.charges;
      const replaced = pocket.id && pocket.id !== id && pocket.count > 0 ? { id: pocket.id, count: pocket.count } : null;
      pocket.count = pocket.id === id ? pocket.count + amount : amount;
      pocket.id = pocket.count > 0 ? id : null;
      return { pocket: product.pocket, count: pocket.count, replaced };
    },

    refill(id, count) {
      const product = productOf(id);
      if (!product?.pocket) throw new Error(`equipment: unknown product "${id}"`);
      const pocket = pockets[product.pocket];
      if (pocket.id === id) pocket.count = Math.max(pocket.count, count);
      else this.give(id, count);
    },

    fill() {
      const filled = [];
      for (const pocketId of kiosk.pockets) {
        const product = Object.values(kiosk.products).find((p) => p.pocket === pocketId);
        if (!product) continue;
        pockets[pocketId].id = product.id;
        pockets[pocketId].count = product.charges;
        filled.push(product);
      }
      return filled;
    },

    update(dt, { inMenu = false } = {}) {
      busyTimer = Math.max(0, busyTimer - dt);
      if (inMenu) return; // (the menu reads D-pad right as menuRight)
      // Always consumed, so presses don't queue up; lethal first if both arrive on one tick (one throw at a time).
      const lethal = input.consumeAction('lethal');
      const tactical = input.consumeAction('tactical');
      if (lethal) useFrom('lethal');
      if (tactical) useFrom('tactical');
    },

    updateThrown(dt) {
      for (const item of live) {
        if (item.removed) continue;
        item.previous.copy(item.position);
        if (item.ball?.alive) item.position.copy(item.ball.position);
        else item.flying = false; // (stopped rolling: it sits there until its fuse)
        item.age += dt;
        const { product } = item;
        if (product.blast) {
          if (item.age >= product.fuseSeconds) {
            remove(item);
            burst(item);
          }
          continue;
        }
        if (!item.settled && (item.landed || !item.flying || item.age >= product.landSeconds)) settle(item);
        if (item.spraying && !item.removed) spray(item, dt);
        if (item.deployed && !item.removed) runTurret(item, dt);
      }
      for (let i = live.length - 1; i >= 0; i--) if (live[i].removed) live.splice(i, 1);
    },

    /** A product does its job at a point right now, as if it had landed there (tests; nothing is taken from a pocket). */
    detonate(id, position) {
      const product = productOf(id);
      if (product?.blast) return burst({ id, product, position: position.clone() });
      if (!product?.opens) throw new Error(`equipment: "${id}" isn't thrown`);
      const item = newItem(id, product, position);
      live.push(item);
      settle(item); // (a Glitter Bomb opens now; a Sparkler Cake sprays its first pulse on the next tick)
      for (let i = live.length - 1; i >= 0; i--) if (live[i].removed) live.splice(i, 1);
    },

    clearThrown() {
      for (const item of live) remove(item);
      live.length = 0;
      throwables.clear();
    },

    // Save & Quit (game/saveGame.js): what is in each pocket.
    serialize() {
      return { pockets: Object.fromEntries(kiosk.pockets.map((p) => [p, { ...pockets[p] }])) };
    },
    restore(data) {
      for (const pocketId of kiosk.pockets) Object.assign(pockets[pocketId], emptyPocket(), data.pockets[pocketId]);
    },

    reset() {
      for (const pocketId of kiosk.pockets) Object.assign(pockets[pocketId], emptyPocket());
      busyTimer = 0;
      this.clearThrown();
    },
  };
}
