// =============================================================================
// BALLISTICS (the bouncing projectile: the Tennis Ball Launcher)
//
// Every other gun is hitscan: the shot lands the instant you pull the trigger. A ball is a real thing that flies. It is lobbed, gravity bends it, and it
// BOUNCES: off walls, off the floor, off a zombie (and a zombie it hits is hit for damage, each bounce a hit). It is DOM-free and ticked at the game's
// fixed 60 Hz by createGame.js, so it runs in the headless tests; the browser side only draws what `balls.list` holds (fx/ballView.js).
//
//   balls.launch({ position, direction, projectile, damageOf, onHit, onBounce, onEnd })   throw one ball
//     projectile (the gun's `projectile` block, config/weapons.js):
//       speed          m/s at the muzzle
//       gravity        m/s^2 (the lob)
//       restitution    how much speed a bounce keeps (0..1)
//       maxBounces     every bounce (wall, floor or zombie) counts; the ball is spent on the last
//       lifeSeconds    in the air at most this long
//       radius         m: how far off a surface it rests after a bounce
//       minSpeed       a ball that slows below this has stopped: it ends
//       rehitSeconds   the zombie it just hit is passed THROUGH for this long (no second hit, no bounce off it): the ball is sent on at the next zombie, which
//                      may be standing right behind this one, and must not hit this one again on its way out
//       seekRange      after a zombie, the ball is sent on at the nearest OTHER zombie this close and in view (0 = it only reflects)
//     damageOf({ part, distance }) -> damage of ONE hit on a zombie (the gun's own maths: weapons/gunStats.js hitDamage)
//     onHit({ target, part, point, normal, killed, direction, ball })     a zombie was hit
//     onBounce({ point, normal, target, ball })                          every bounce (target null = a surface)
//     onEnd({ ball, hits })                                              the ball is spent: all the hits it made
//   balls.update(dt)    advance every ball one tick
//   balls.list          the live balls: { position, previous, velocity, bounces, age, hits }   (previous = last tick's position, for drawing)
//   balls.clear()       Play again
//
// A target is anything shootable (see hitscan.js): { isAlive, hitboxes, takeHit }. Dead targets are skipped.
// =============================================================================

import * as THREE from 'three';
import { castShot } from './hitscan.js';

const move = new THREE.Vector3();
const toNext = new THREE.Vector3();
const chest = new THREE.Vector3();
const lineDir = new THREE.Vector3();

/** The middle of a target's body (where a ball is sent when it seeks the next zombie). */
function bodyCentre(target, out) {
  const box = (target.hitboxes?.find((h) => h.part === 'body') ?? target.hitboxes?.[0])?.box;
  return box ? box.getCenter(out) : null;
}

export function createBalls({ colliders, shootables }) {
  const list = [];

  /** The nearest other living zombie within `range` of `from` with nothing solid between: where the ball goes next. */
  function nextTarget(from, except, range) {
    let best = null;
    let bestDistance = range;
    for (const target of shootables) {
      if (target === except || !target.isAlive || !bodyCentre(target, chest)) continue;
      const distance = chest.distanceTo(from);
      if (distance >= bestDistance || distance < 1e-3) continue;
      lineDir.copy(chest).sub(from).divideScalar(distance);
      if (castShot(from, lineDir, distance, colliders, []).worldHit) continue; // a wall in the way
      best = target;
      bestDistance = distance;
    }
    return best;
  }

  function reflect(velocity, normal, restitution) {
    const along = velocity.dot(normal);
    if (along < 0) velocity.addScaledVector(normal, -2 * along);
    velocity.multiplyScalar(restitution);
  }

  function end(ball) {
    ball.alive = false;
    ball.onEnd?.({ ball, hits: ball.hits });
  }

  function step(ball, dt) {
    const p = ball.projectile;
    ball.previous.copy(ball.position);
    ball.age += dt;
    ball.sinceHit += dt;
    ball.velocity.y -= p.gravity * dt;
    const speed = ball.velocity.length();
    if (ball.age >= p.lifeSeconds || speed < p.minSpeed || ball.position.y < -20) { end(ball); return; }
    const distance = speed * dt;
    const direction = move.copy(ball.velocity).divideScalar(speed);
    // (the zombie it just hit is not in the way for a moment: it passes through, on towards the next)
    const targets = ball.lastTarget && ball.sinceHit < p.rehitSeconds ? shootables.filter((t) => t !== ball.lastTarget) : shootables;
    const result = castShot(ball.position, direction, distance + p.radius, colliders, targets, 1);
    if (result.target && ball.alive) {
      hitZombie(ball, result, direction);
    } else if (result.worldHit) {
      bounceOffSurface(ball, result);
    } else {
      ball.position.addScaledVector(direction, distance);
    }
  }

  function bounceOffSurface(ball, result) {
    const p = ball.projectile;
    ball.position.copy(result.point).addScaledVector(result.normal, p.radius * 1.05);
    reflect(ball.velocity, result.normal, p.restitution);
    ball.bounces += 1;
    ball.onBounce?.({ point: result.point.clone(), normal: result.normal.clone(), target: null, ball });
    if (ball.bounces >= p.maxBounces) end(ball);
  }

  function hitZombie(ball, result, direction) {
    const p = ball.projectile;
    const target = result.target;
    const point = result.point.clone();
    const normal = result.normal.clone();
    ball.position.copy(point).addScaledVector(normal, p.radius * 1.05);
    const damage = ball.damageOf({ part: result.part, distance: ball.travelled });
    const { killed } = target.takeHit({ damage, part: result.part, point, direction: direction.clone(), impact: ball.impact });
    ball.hits.push({ target, part: result.part, point, normal, distance: ball.travelled, killed });
    ball.lastTarget = target;
    ball.sinceHit = 0;
    ball.onHit?.({ target, part: result.part, point, normal, killed, direction: direction.clone(), ball });
    // Where to next: on at the nearest other zombie in view (a lob up and across), else it just bounces off this one.
    const next = p.seekRange > 0 ? nextTarget(ball.position, target, p.seekRange) : null;
    const speed = ball.velocity.length() * p.restitution;
    if (next) {
      bodyCentre(next, chest);
      toNext.copy(chest).sub(ball.position);
      const flight = Math.max(0.12, toNext.length() / Math.max(speed, 1));
      // Aim where gravity will not drop it short: lift the aim by the fall it will have over the flight.
      toNext.y += 0.5 * p.gravity * flight * flight;
      ball.velocity.copy(toNext).normalize().multiplyScalar(speed);
    } else {
      reflect(ball.velocity, normal, p.restitution);
    }
    ball.bounces += 1;
    ball.onBounce?.({ point, normal, target, ball });
    if (ball.bounces >= p.maxBounces) end(ball);
  }

  return {
    list,

    launch({ position, direction, projectile, damageOf, impact = null, onHit = null, onBounce = null, onEnd = null }) {
      const ball = {
        alive: true,
        position: position.clone(),
        previous: position.clone(),
        velocity: direction.clone().normalize().multiplyScalar(projectile.speed),
        projectile, damageOf, impact, onHit, onBounce, onEnd,
        bounces: 0, age: 0, sinceHit: Infinity, travelled: 0, lastTarget: null, hits: [],
      };
      list.push(ball);
      return ball;
    },

    update(dt) {
      for (let i = 0; i < list.length; i++) {
        const ball = list[i];
        const before = ball.position.clone();
        if (ball.alive) step(ball, dt);
        ball.travelled += before.distanceTo(ball.position);
      }
      for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive) list.splice(i, 1);
    },

    /** Play again: every ball in the air is gone (nothing is paid or counted for it). */
    clear() {
      list.length = 0;
    },
  };
}
