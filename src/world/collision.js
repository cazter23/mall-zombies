// =============================================================================
// COLLISION
// The player is a vertical cylinder (radius + height, position = feet).
// The world is a list of axis-aligned boxes (THREE.Box3).
// No physics engine: we move, then push the player out of anything they overlap.
// Pushing out along the contact normal is what makes you slide along walls.
// =============================================================================

// Distance-squared from point (x, z) to a box's footprint on the ground plane.
function distSqToBoxXZ(x, z, box) {
  const cx = Math.max(box.min.x, Math.min(x, box.max.x));
  const cz = Math.max(box.min.z, Math.min(z, box.max.z));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz;
}

// Push the player sideways out of any box their body overlaps.
function pushOutHorizontal(pos, radius, height, colliders, stepTolerance) {
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
      } else {
        // Center is inside the box: exit through the nearest side.
        const toMinX = pos.x - box.min.x;
        const toMaxX = box.max.x - pos.x;
        const toMinZ = pos.z - box.min.z;
        const toMaxZ = box.max.z - pos.z;
        const nearest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
        if (nearest === toMinX) pos.x = box.min.x - radius;
        else if (nearest === toMaxX) pos.x = box.max.x + radius;
        else if (nearest === toMinZ) pos.z = box.min.z - radius;
        else pos.z = box.max.z + radius;
      }
      moved = true;
    }

    if (!moved) break;
  }
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
  pushOutHorizontal(pos, radius, height, colliders, stepTolerance);

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
