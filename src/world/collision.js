// =============================================================================
// COLLISION
// The player is a vertical cylinder (radius + height, position = feet).
// The world is a list of axis-aligned boxes (THREE.Box3).
// No physics engine: we move, then push the player out of anything they overlap.
// Pushing out along the contact normal is what makes you slide along walls.
// =============================================================================

// The shared collider list can change while the game runs (a door's shutter adds or removes its box).
// Whatever changes it calls markCollidersChanged(); anything that caches work built from the list
// (the zombie navigation grid) compares colliderSignature() to know when to rebuild. The length alone
// isn't enough: one door opening and another closing in the same tick keeps the same length.
export function markCollidersChanged(colliders) {
  colliders.version = (colliders.version ?? 0) + 1;
}

export function colliderSignature(colliders) {
  return `${colliders.length}:${colliders.version ?? 0}`;
}

// RAMPS (walkable slopes: an escalator or stairs). The world is axis-aligned boxes, which can only make steps, and a body only
// walks over bumps under `stepTolerance`. A ramp is the one non-box thing: a SURFACE the feet follow, stored on the shared
// list as `colliders.ramps`. It is never a wall or a ceiling (put real boxes beside and under it for those); it only holds
// feet up. Its height depends on how far along `axis` you are:
//   ramp = { axis: 'x' | 'z', origin, dir (+1 | -1), minX, maxX, minZ, maxZ (the footprint),
//            points: [[s, y], ...] (the height at distance s along the axis from `origin`, in `dir`; linear between),
//            enabled (optional, default true) }
// A body is held up when its feet are within `rampStep` below the surface (it walks up on it) or `rampSnap` above it
// (it walks down on it instead of dropping), and only while not rising (jumps leave the surface).
export const ramps = { rampStep: 0.5, rampSnap: 0.4 };

export function addRamp(colliders, ramp) {
  (colliders.ramps ??= []).push(ramp);
  markCollidersChanged(colliders);
  return ramp;
}

export function removeRamp(colliders, ramp) {
  const i = colliders.ramps?.indexOf(ramp) ?? -1;
  if (i !== -1) {
    colliders.ramps.splice(i, 1);
    markCollidersChanged(colliders);
  }
}

/** The ramp's surface height at (x, z), or null if that point is off the ramp. */
export function rampHeightAt(ramp, x, z) {
  if (ramp.enabled === false || x < ramp.minX || x > ramp.maxX || z < ramp.minZ || z > ramp.maxZ) return null;
  const along = ramp.axis === 'x' ? x : z;
  const s = (along - ramp.origin) * ramp.dir;
  const pts = ramp.points;
  if (s <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (s <= pts[i][0]) {
      const [s0, y0] = pts[i - 1];
      const [s1, y1] = pts[i];
      return y0 + ((s - s0) / (s1 - s0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

// Distance-squared from point (x, z) to a box's footprint on the ground plane.
function distSqToBoxXZ(x, z, box) {
  const cx = Math.max(box.min.x, Math.min(x, box.max.x));
  const cz = Math.max(box.min.z, Math.min(z, box.max.z));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz;
}

// A wall with outward normal (nx, nz) was hit: drop the part of the velocity going into it, so the
// mover slides along the wall and its velocity says how fast it's REALLY moving (pinned = 0).
function blockVelocity(vel, nx, nz) {
  const into = vel.x * nx + vel.z * nz;
  if (into >= 0) return;
  vel.x -= into * nx;
  vel.z -= into * nz;
}

// Push the player sideways out of any box their body overlaps (and stop velocity into it).
function pushOutHorizontal(pos, vel, radius, height, colliders, stepTolerance) {
  // A few passes handle corners where two boxes push at once.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;

    for (const box of colliders) {
      // Only boxes that overlap the body vertically can block sideways movement.
      // Boxes whose top is at (or barely above) our feet are floors, not walls.
      if (box.max.y <= pos.y + stepTolerance || box.min.y >= pos.y + height) continue;

      const cx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
      const cz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;

      if (distSq > 1e-10) {
        // Normal case: push away from the closest point on the box.
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
        blockVelocity(vel, dx / dist, dz / dist);
      } else {
        // Center is inside the box: exit through the nearest side.
        const toMinX = pos.x - box.min.x;
        const toMaxX = box.max.x - pos.x;
        const toMinZ = pos.z - box.min.z;
        const toMaxZ = box.max.z - pos.z;
        const nearest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
        if (nearest === toMinX) {
          pos.x = box.min.x - radius;
          blockVelocity(vel, -1, 0);
        } else if (nearest === toMaxX) {
          pos.x = box.max.x + radius;
          blockVelocity(vel, 1, 0);
        } else if (nearest === toMinZ) {
          pos.z = box.min.z - radius;
          blockVelocity(vel, 0, -1);
        } else {
          pos.z = box.max.z + radius;
          blockVelocity(vel, 0, 1);
        }
      }
      moved = true;
    }

    if (!moved) break;
  }
}

/**
 * Would a cylinder (feet at pos) overlap anything solid sideways? Floors (boxes whose top is
 * within stepTolerance of the feet) don't count. Used to make sure crowd shoves never push the
 * player or a zombie into a wall. `margin` shrinks the radius a little so touching isn't overlap.
 */
export function overlapsSolid(pos, radius, height, colliders, stepTolerance, margin = 0.02) {
  const r = radius - margin;
  for (const box of colliders) {
    if (box.max.y <= pos.y + stepTolerance || box.min.y >= pos.y + height) continue;
    if (distSqToBoxXZ(pos.x, pos.z, box) < r * r) return true;
  }
  return false;
}

/**
 * Is there room to stand up? True if nothing solid sits in the extra space between
 * the crouched height and the standing height above the player's feet.
 * `margin` shrinks the radius so a wall merely touching the player doesn't count.
 */
export function hasHeadroom(pos, radius, crouchHeight, standHeight, colliders, margin) {
  const r = radius - margin;
  for (const box of colliders) {
    if (box.max.y <= pos.y + crouchHeight || box.min.y >= pos.y + standHeight) continue;
    if (distSqToBoxXZ(pos.x, pos.z, box) < r * r) return false;
  }
  return true;
}

/**
 * Moves the player by velocity * dt and resolves collisions.
 * Mutates `pos` and `vel`. Returns { grounded }.
 */
export function moveAndCollide(pos, vel, dt, radius, height, colliders, stepTolerance) {
  const prevY = pos.y;

  // 1) Horizontal movement, then slide out of walls/obstacles.
  pos.x += vel.x * dt;
  pos.z += vel.z * dt;
  pushOutHorizontal(pos, vel, radius, height, colliders, stepTolerance);

  // 2) Vertical movement, then land on floors / bonk on ceilings.
  pos.y += vel.y * dt;

  // Slightly smaller radius so walls we're merely touching don't count as floors.
  const footRadiusSq = (radius - 0.02) * (radius - 0.02);
  let landingY = -Infinity;
  let ceilingY = Infinity;

  for (const box of colliders) {
    if (distSqToBoxXZ(pos.x, pos.z, box) >= footRadiusSq) continue;

    // Falling (or standing): were our feet above this box's top last tick?
    if (vel.y <= 0 && prevY >= box.max.y - stepTolerance && pos.y < box.max.y) {
      landingY = Math.max(landingY, box.max.y);
    }
    // Rising: was our head below this box's bottom last tick?
    else if (vel.y > 0 && prevY + height <= box.min.y + 1e-4 && pos.y + height > box.min.y) {
      ceilingY = Math.min(ceilingY, box.min.y);
    }
  }

  // Ramps: stand on the surface under the body's center.
  if (vel.y <= 0 && colliders.ramps) {
    for (const ramp of colliders.ramps) {
      const h = rampHeightAt(ramp, pos.x, pos.z);
      if (h !== null && prevY >= h - ramps.rampStep && pos.y <= h + ramps.rampSnap) landingY = Math.max(landingY, h);
    }
  }

  let grounded = false;
  if (landingY > -Infinity) {
    pos.y = landingY;
    vel.y = 0;
    grounded = true;
  } else if (ceilingY < Infinity) {
    pos.y = ceilingY - height;
    vel.y = 0;
  }

  return { grounded };
}
