// =============================================================================
// DAMAGE DIRECTION INDICATOR
// Computes the relative angle between the player's camera yaw and incoming
// attacks (zombie swings, cart charges, boss attacks, hazards) so the HUD can
// show COD Zombies-style red neon directional arcs around the crosshair.
// 0° = front, 90° = right, 180° = behind, 270° = left.
// =============================================================================

/**
 * Computes the relative angle in degrees [0, 360) from the player's camera to the attack source.
 * 0° = directly in front, 90° = right, 180° = behind, 270° = left.
 *
 * @param {number} cameraYaw - Player camera yaw in radians (down -Z at 0)
 * @param {{ x: number, z: number }} playerPosition - Player world position
 * @param {{ hitDirection?: { x: number, z: number }, attackerPosition?: { x: number, z: number }, zombie?: { position: { x: number, z: number } } }} hit - Damage event payload
 * @returns {number|null} Relative angle in degrees, or null if direction cannot be determined
 */
export function computeDamageAngle(cameraYaw, playerPosition, hit) {
  let dx = null;
  let dz = null;

  if (hit?.hitDirection && typeof hit.hitDirection.x === 'number' && typeof hit.hitDirection.z === 'number') {
    dx = hit.hitDirection.x;
    dz = hit.hitDirection.z;
  } else {
    const pos = hit?.attackerPosition || (hit?.zombie?.position ? { x: hit.zombie.position.x, z: hit.zombie.position.z } : null);
    if (pos && playerPosition) {
      dx = pos.x - playerPosition.x;
      dz = pos.z - playerPosition.z;
    }
  }

  if (dx === null || dz === null) return null;

  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return null;

  dx /= len;
  dz /= len;

  // In Three.js with yaw 0 looking down -Z:
  // forward = (-sin, -cos), right = (cos, -sin)
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  const ahead = -dx * sin - dz * cos;
  const right = dx * cos - dz * sin;

  const bearing = Math.atan2(right, ahead);
  let deg = (bearing * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;

  return Math.round(deg * 10) / 10;
}

/**
 * Creates a queue that listens to 'playerHit' events and flushes them to the HUD
 * during the render loop using the latest camera yaw and player position.
 */
export function createDamageIndicatorQueue({ events, hud, getCameraYaw, getPlayerPosition }) {
  const queue = [];

  if (events?.on) {
    events.on('playerHit', (hit) => {
      queue.push(hit);
    });
    events.on('runReset', () => {
      queue.length = 0;
    });
    events.on('playerDeath', () => {
      queue.length = 0;
    });
  }

  return {
    queue,
    flush() {
      if (queue.length === 0) return;
      const yaw = typeof getCameraYaw === 'function' ? getCameraYaw() : (getCameraYaw ?? 0);
      const pos = typeof getPlayerPosition === 'function' ? getPlayerPosition() : getPlayerPosition;
      for (const hit of queue) {
        const angle = computeDamageAngle(yaw, pos, hit);
        if (angle !== null) {
          hud?.showDamageDirection?.(angle);
        }
      }
      queue.length = 0;
    },
    clear() {
      queue.length = 0;
    },
  };
}
