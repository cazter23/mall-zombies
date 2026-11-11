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
//   them) and do their job when their fuse runs out (the Soda Bomb: a blast, game/equipment/equipmentDamage.js).
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
//   equipment.detonate(id, position)   burst a product there now (tests)
//   equipment.clearThrown()     every thrown thing gone (death; Play again)
//   equipment.live              thrown things still out: { id, position, previous, age, flying, removed } (fx/throwableView.js draws them)
//   equipment.pockets           { lethal: { id, count }, tactical: { id, count } } (id null = empty)
//   equipment.status            for the HUD: { busy, lethal: { id, name, count }, tactical: { ... } }
//   equipment.isBusy            mid-throw (the gun and the box cutter wait)
//   equipment.reset()           Play again: empty pockets, nothing in the air
// =============================================================================

import * as THREE from 'three';
import { kiosk, productOf } from '../config/kiosk.js';
import { castShot } from '../weapons/hitscan.js';
import { blastDamage } from './equipment/equipmentDamage.js';

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
    const item = { id, product, position: start.clone(), previous: start.clone(), age: 0, flying: true, removed: false, ball: null };
    item.ball = throwables.launch({
      position: start,
      direction: aim,
      projectile: product.projectile,
      onBounce: ({ ball }) => { if (ball.velocity.length() > 3) sound?.play(product.sounds.bounce, { volume: 0.6 }); },
    });
    live.push(item);
    sound?.play(product.sounds.throw);
    events.emit('equipmentThrown', { id, pocket: pocketId, left: pocket.count });
    return true;
  }

  function blastHorn(horn) {
    const origin = player.position;
    player.getAim(eye, aim);
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
    }
    sound?.play(horn.sound);
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
        item.previous.copy(item.position);
        if (item.ball?.alive) item.position.copy(item.ball.position);
        else item.flying = false; // (stopped rolling: it sits there until its fuse)
        item.age += dt;
        if (item.age >= item.product.fuseSeconds) {
          remove(item);
          burst(item);
        }
      }
      for (let i = live.length - 1; i >= 0; i--) if (live[i].removed) live.splice(i, 1);
    },

    /** Burst a product at a point right now, as if its fuse ran out there (tests; nothing is taken from a pocket). */
    detonate(id, position) {
      const product = productOf(id);
      if (!product?.blast) throw new Error(`equipment: "${id}" doesn't burst`);
      burst({ id, product, position: position.clone() });
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
