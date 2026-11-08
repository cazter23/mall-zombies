// =============================================================================
// MASCOT COSTUME TWISTS that reach past the zombie itself (createGame builds this; a twist that is only the zombie's
// own behaviour, like Captain Coupon going back for his helmet, lives in zombies/zombie.js). Tuning: the costume's
// block in config/zombies.js mascotVariants, read as zombie.type.mascot.<block>.
//   Poppy Corn (popBlast)  the pop is a blast: zombies close by are flung and stunned (no damage, so nothing is paid),
//                          the player close by is shoved away and buttered (the HUD shows the splat). Announces
//                          'mascotPopBlast' { zombie, position, butter, butterSeconds, flung }.
// Listens on the event bus only.
// =============================================================================

import * as THREE from 'three';
import { castShot } from '../weapons/hitscan.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createMascotCostumes({ events, zombies, player, colliders, effects, state }) {
  const head = new THREE.Vector3();
  const target = new THREE.Vector3();
  const direction = new THREE.Vector3();

  // Nothing solid between the popping head and a body (the blast doesn't go through walls).
  function clearLine(from, to) {
    direction.subVectors(to, from);
    const distance = direction.length();
    return distance < 1e-3 || !castShot(from, direction.normalize(), distance, colliders, []).worldHit;
  }

  function popBlast(zombie) {
    const { mascot } = zombie.type;
    const blast = mascot.popBlast;
    head.copy(zombie.position).setY(zombie.position.y + mascot.hipY + mascot.helmet.at[1]);

    let flung = 0;
    for (const other of zombies.zombies) {
      if (other === zombie || !other.isAlive) continue;
      if (Math.abs(other.position.y - zombie.position.y) > blast.floorTolerance) continue;
      if (Math.hypot(other.position.x - zombie.position.x, other.position.z - zombie.position.z) > blast.zombieRadius) continue;
      if (!clearLine(head, target.copy(other.position).setY(other.position.y + blast.chestHeight))) continue;
      // The Security Sweep's stagger: knocked away from the blast, no attacks for a moment, no damage.
      if (other.staggerAway(zombie.position, { seconds: blast.stunSeconds, knockback: blast.knockback, drag: blast.drag })) flung += 1;
    }

    let butter = false;
    const p = player.position;
    const dx = p.x - zombie.position.x;
    const dz = p.z - zombie.position.z;
    const d = Math.hypot(dx, dz);
    if (!state.over && d <= blast.playerRadius && Math.abs(p.y - zombie.position.y) <= blast.floorTolerance
        && clearLine(head, target.copy(p).setY(p.y + blast.chestHeight))) {
      // Shoved straight away from it (along its facing if you're right on top of it), like a Cart Pusher's charge.
      const nx = d > 1e-4 ? dx / d : -Math.sin(zombie.yaw);
      const nz = d > 1e-4 ? dz / d : -Math.cos(zombie.yaw);
      player.velocity.x += nx * blast.playerShove;
      player.velocity.z += nz * blast.playerShove;
      butter = true;
    }

    effects.splat(head, UP, blast.burst.colors, blast.burst.count); // a cartoon puff of popcorn
    events.emit('mascotPopBlast', { zombie, position: head.clone(), butter, butterSeconds: blast.butterSeconds, flung });
  }

  const off = [
    events.on('mascotHeadPop', ({ zombie }) => {
      if (zombie.type.mascot?.popBlast) popBlast(zombie);
    }),
  ];

  return {
    update() {},
    reset() {},
    dispose() {
      for (const unsubscribe of off) unsubscribe();
    },
  };
}
