// =============================================================================
// CONFUSION (Build-A-Blaster's Glitter): a confused zombie forgets the player, walks at the nearest other zombie on its floor and hits it.
// While it lasts the zombie's own update hands over to updateConfusion below, so it can't swing at the player or charge. It uses the same
// windup and swing states as a normal attack, so the model plays the normal animation. Its hits go through takeHit with source 'build': a kill
// pays once on the 'kill' event, and no Heart counts it.
// Numbers: config/zombies.js zombieConfusion. How long and how hard come from the stuffing (zombie.applyConfusion).
// =============================================================================

import { feel } from '../config/feel.js';
import { zombieConfusion as cfg } from '../config/zombies.js';
import { moveAndCollide } from '../world/collision.js';

const body = { position: null, height: 0 }; // (a zombie, as canHit and wallBetween expect to be told about a target)
const asTarget = (zombie) => {
  body.position = zombie.position;
  body.height = zombie.type.height;
  return body;
};

function nearestZombie(zombie, zombies) {
  let best = null, bestDistance = cfg.rangeMeters;
  for (const other of zombies) {
    if (other === zombie || !other.isAlive || other.state === 'spawning') continue;
    if (Math.abs(other.position.y - zombie.position.y) > cfg.floorTolerance) continue;
    const distance = zombie.distanceTo(other);
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

function walkTo(zombie, target, dt, colliders) {
  const dx = target.position.x - zombie.position.x, dz = target.position.z - zombie.position.z;
  const length = Math.hypot(dx, dz) || 1;
  const speed = zombie.speed * cfg.speedFraction * zombie.slowFraction;
  zombie.velocity.x = (dx / length) * speed;
  zombie.velocity.z = (dz / length) * speed;
  zombie.velocity.y = Math.max(zombie.velocity.y - feel.movement.gravity * dt, -feel.movement.maxFallSpeed);
  moveAndCollide(zombie.position, zombie.velocity, dt, zombie.type.radius, zombie.type.height, colliders, feel.movement.stepTolerance);
}

/** One tick of a confused zombie, in place of its normal behaviour. */
export function updateConfusion(zombie, dt, ctx) {
  const state = zombie.confusion, attack = zombie.type.attack;
  state.retarget -= dt;
  if (!state.target?.isAlive || state.retarget <= 0) {
    state.target = nearestZombie(zombie, ctx.zombies);
    state.retarget = cfg.retargetSeconds;
  }
  const { target } = state;

  // A swing already under way finishes, whatever became of its target.
  if (zombie.state === 'windup') {
    zombie.standStill(dt, ctx);
    if (target) zombie.faceToward(target.position, dt, attack.turnSpeed);
    if (zombie.stateTime >= zombie.windupSeconds) {
      zombie.setState('swing');
      if (target && zombie.canHit(asTarget(target)) && !zombie.wallBetween(asTarget(target), ctx.colliders)) {
        target.takeHit({ damage: state.damage, part: 'body', source: 'build' });
      }
    }
    return;
  }
  if (zombie.state === 'swing') {
    zombie.standStill(dt, ctx);
    if (zombie.stateTime >= attack.swingSeconds) {
      zombie.setState('chasing');
      zombie.attackCooldown = attack.recoverSeconds;
    }
    return;
  }

  if (!target) { // nobody to fight: it just stands there, dazzled
    zombie.standStill(dt, ctx);
    return;
  }
  zombie.faceToward(target.position, dt);
  if (zombie.distanceTo(target) > attack.startRange) {
    walkTo(zombie, target, dt, ctx.colliders);
    return;
  }
  zombie.standStill(dt, ctx);
  if (zombie.attackCooldown <= 0 && !zombie.wallBetween(asTarget(target), ctx.colliders)) zombie.setState('windup');
}
