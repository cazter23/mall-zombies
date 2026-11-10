// =============================================================================
// SUNNY RUNS AWAY (built by game/features/clawMachine.js; numbers in config/clawMachine.js sunny; his model: world/sunnyModel.js).
// When a grab lands on the plush, the machine refunds and closes as always, with its next site already picked. Then Sunny:
//   out    climbs out of the chute and down to the floor in front
//   look   looks left and right
//   walk   waddles to the next site's front along the zombies' grid (g.zombies.nav.pathTo: only through open areas, ramps
//          included), at cfg.speed. No other site open: he walks a lap round the front of his own machine instead.
//   in     climbs into that cabinet, and it shakes once (its moving parts and dust sheet; the collider never moves)
// If the round starts before he arrives, the machine opens there anyway and he finishes his walk. A new plush while he's still
// walking sends the old one straight in.
//
// SHOOT OR SLASH HIM and he pops in stuffing and confetti: popSunny tickets, and the machine's next site is picked again (never the
// one he was walking to, if another is open). He is a shootable (gun and box cutter find him) but NOT a zombie: no 'kill', no
// +10 (pointsForHit pays only zombies), no power-up or Heart credit (those read zombies), and he carries ignoreAimAssist and
// ignoreVault, which aim assist and the vault's body check skip. No collider: you and the zombies walk through him.
//
//   const sunny = createClawSunny({ scene, nav, shootables, effects, tickets, sound, events })
//   sunny.start({ from, to, floorOf, onArrive, onPop })   from / to: claw sites ({ id, cabinet }); to === from (or null) = a lap
//   sunny.update(dt), sunny.reset(), sunny.active (null or { phase, from, to, position }), sunny.target (his shootable)
// =============================================================================

import * as THREE from 'three';
import { clawMachine } from '../../config/clawMachine.js';
import { buildSunnyModel, disposeSunnyModel } from '../../world/sunnyModel.js';

const cfg = clawMachine.sunny;
const UP = new THREE.Vector3(0, 1, 0);
const stuffing = Object.assign([...cfg.stuffing], { foam: true }); // (a palette flagged foam: never turned into blood)

export function createClawSunny({ scene, nav, shootables, effects, tickets, sound, events }) {
  let active = null;
  const shakes = []; // { group, timer, along: Vector3 }
  const scratch = new THREE.Vector3();

  // The spot on the floor in front of a site's cabinet.
  const frontOf = (site, floorY, out = new THREE.Vector3()) => {
    const { position, normal } = site.cabinet;
    return out.set(position.x + normal.x * cfg.standOff, floorY, position.z + normal.z * cfg.standOff);
  };

  // His shootable: one body box that follows him. takeHit pops him (any damage at all).
  const target = {
    isSunny: true,
    ignoreAimAssist: true, // (aim assist never pulls toward him)
    ignoreVault: true, // (he never blocks a vault's path or landing)
    noRewards: true, // (nothing pays for him but his tickets)
    isAlive: false,
    position: new THREE.Vector3(),
    hitboxes: [{ part: 'body', box: new THREE.Box3() }],
    splatColors: stuffing,
    takeHit() {
      if (!target.isAlive) return { killed: false };
      pop();
      return { killed: true };
    },
  };

  function placeHitbox() {
    const p = target.position;
    target.hitboxes[0].box.min.set(p.x - cfg.hitbox.radius, p.y, p.z - cfg.hitbox.radius);
    target.hitboxes[0].box.max.set(p.x + cfg.hitbox.radius, p.y + cfg.hitbox.height, p.z + cfg.hitbox.radius);
  }

  function face(dx, dz) {
    if (Math.hypot(dx, dz) > 1e-6) active.yaw = Math.atan2(-dx, -dz); // (the model faces -Z)
  }

  function remove() {
    if (!active) return;
    disposeSunnyModel(active.model.root);
    const i = shootables.indexOf(target);
    if (i !== -1) shootables.splice(i, 1);
    target.isAlive = false;
    active = null;
  }

  function shake(site) {
    shakes.push({ group: site.cabinet.rig.group, timer: 0, along: new THREE.Vector3(-site.cabinet.normal.z, 0, site.cabinet.normal.x) });
  }

  function arrive() {
    const { to, onArrive } = active;
    remove();
    shake(to);
    sound?.play('chuteThunk');
    events?.emit('sunnyArrived', { siteId: to.id });
    onArrive?.(to);
  }

  function pop() {
    const { onPop, to } = active;
    const at = scratch.copy(target.position).addScaledVector(UP, cfg.size * 0.55);
    effects?.confetti(at, UP, cfg.pop);
    effects?.splat(at, UP, stuffing, 24);
    sound?.play('sunnyPop');
    remove();
    tickets?.add(clawMachine.tickets.popSunny, 'sunny');
    events?.emit('sunnyPopped', { siteId: to.id });
    onPop?.(to);
  }

  function start({ from, to, floorOf, onArrive = null, onPop = null }) {
    if (active) arrive(); // (a new plush while he's still out: the old one goes straight in)
    const lap = !to || to === from;
    const destination = lap ? from : to;
    const fromFloor = floorOf(from), toFloor = floorOf(destination);
    const startAt = frontOf(from, fromFloor);
    let path;
    if (lap) {
      const n = from.cabinet.normal;
      const side = new THREE.Vector3(-n.z, 0, n.x);
      path = [
        startAt.clone().addScaledVector(side, cfg.lap),
        startAt.clone().addScaledVector(n, cfg.lap * 0.8),
        startAt.clone().addScaledVector(side, -cfg.lap),
        startAt.clone(),
      ];
    } else {
      const route = nav?.pathTo(startAt, frontOf(destination, toFloor));
      path = (route ?? []).map((p) => new THREE.Vector3(p.x, p.y, p.z));
      path.push(frontOf(destination, toFloor)); // (always ends at the cabinet's front, even without a route)
    }
    const model = buildSunnyModel(cfg.size);
    scene.add(model.root);
    active = {
      from, to: destination, lap, onArrive, onPop, model, path, index: 0, phase: 'out', timer: 0, yaw: 0, walked: 0,
      chute: from.cabinet.rig.chute.position.clone(), startAt, endChute: destination.cabinet.rig.chute.position.clone(),
    };
    face(from.cabinet.normal.x, from.cabinet.normal.z);
    target.position.copy(active.chute);
    target.isAlive = true;
    shootables.push(target);
    placeHitbox();
    pose();
    events?.emit('sunnyEscape', { fromId: from.id, toId: destination.id, lap });
  }

  // Put the model where he is, waddling if he's walking.
  function pose() {
    const { model } = active;
    const walking = active.phase === 'walk';
    const t = active.walked;
    model.root.position.copy(target.position);
    model.root.position.y += walking ? Math.abs(Math.sin(t * cfg.waddle.hz * Math.PI)) * cfg.waddle.bob : 0;
    model.root.rotation.set(0, active.yaw, walking ? Math.sin(t * cfg.waddle.hz * Math.PI) * cfg.waddle.sway : 0);
    model.legs[0].rotation.x = walking ? Math.sin(t * cfg.waddle.hz * Math.PI * 2) * 0.6 : 0;
    model.legs[1].rotation.x = -model.legs[0].rotation.x;
  }

  function updateActive(dt) {
    active.timer += dt;
    const a = active;
    if (a.phase === 'out') {
      const f = Math.min(1, a.timer / cfg.climbOutSeconds);
      target.position.lerpVectors(a.chute, a.startAt, f);
      target.position.y += Math.sin(f * Math.PI) * 0.35; // a little hop out
      if (f >= 1) { a.phase = 'look'; a.timer = 0; }
    } else if (a.phase === 'look') {
      const f = Math.min(1, a.timer / cfg.lookSeconds);
      a.yaw = Math.atan2(-a.from.cabinet.normal.x, -a.from.cabinet.normal.z) + Math.sin(f * Math.PI * 2) * 0.8;
      if (f >= 1) { a.phase = 'walk'; a.timer = 0; }
    } else if (a.phase === 'walk') {
      let step = cfg.speed * dt;
      a.walked += dt;
      while (step > 0 && a.index < a.path.length) {
        const goal = a.path[a.index];
        const to = scratch.subVectors(goal, target.position);
        const distance = to.length();
        if (distance <= step) {
          target.position.copy(goal);
          step -= distance;
          a.index += 1;
        } else {
          face(to.x, to.z);
          target.position.addScaledVector(to, step / distance);
          step = 0;
        }
      }
      if (a.index >= a.path.length) { a.phase = 'in'; a.timer = 0; a.inFrom = target.position.clone(); }
    } else if (a.phase === 'in') {
      const f = Math.min(1, a.timer / cfg.climbInSeconds);
      target.position.lerpVectors(a.inFrom, a.endChute, f);
      a.model.root.scale.setScalar(1 - 0.6 * f);
      face(a.endChute.x - a.inFrom.x, a.endChute.z - a.inFrom.z);
      if (f >= 1) { arrive(); return; }
    }
    placeHitbox();
    pose();
  }

  function updateShakes(dt) {
    for (let i = shakes.length - 1; i >= 0; i--) {
      const s = shakes[i];
      s.timer += dt;
      if (s.timer >= cfg.shake.seconds) {
        s.group.position.set(0, 0, 0);
        shakes.splice(i, 1);
        continue;
      }
      const fade = 1 - s.timer / cfg.shake.seconds;
      s.group.position.copy(s.along).multiplyScalar(Math.sin(s.timer * cfg.shake.hz * Math.PI * 2) * cfg.shake.metres * fade);
    }
  }

  return {
    target,
    get active() { return active ? { phase: active.phase, from: active.from, to: active.to, lap: active.lap, position: target.position, path: active.path } : null; },
    get shaking() { return shakes.length > 0; },
    start,
    update(dt) {
      if (active) updateActive(dt);
      updateShakes(dt);
    },
    reset() {
      remove();
      for (const s of shakes) s.group.position.set(0, 0, 0);
      shakes.length = 0;
    },
  };
}
