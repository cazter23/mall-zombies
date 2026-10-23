// =============================================================================
// CART PUSHER POSE -> HITBOXES. The Cart Pusher leans into its cart (hunched while pushing, crouched over the handle
// on the telegraph, flat out on the charge, slumped over it after a crash), and the model shows that (zombieModel.js
// poseCart). Its hitboxes must follow what you SEE, or you shoot the slumped head / the tipped cart and the bullets
// sail through the empty space where a standing zombie would be ("invincible after a miss"). Both read cartLean here.
//
//   cartLean(zombie, type)          the body's forward lean in radians right now (the model and the hitboxes share it)
//   applyCartHitboxes(zombie, y0)   moves the head box and widens the body box with the lean, and while the zombie is
//                                   crashed turns the third box into the tipped cart (a hit on it counts as a body hit)
// Numbers: zombieTypes.cartPusher.cartAnimation (the pose) and .cartHitbox (the boxes).
// =============================================================================

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function cartLean(zombie, type) {
  const ca = type.cartAnimation;
  const t = zombie.stateTime;
  let lean = ca.hunch;
  if (zombie.state === 'chargeTelegraph') lean += ca.telegraphCrouch * ease(clamp01(t / type.charge.telegraphSeconds));
  else if (zombie.state === 'charging') lean += ca.chargeLean;
  else if (zombie.state === 'crashed') {
    const r = ease(clamp01(t / 0.2)) * (1 - ease(clamp01((t - type.charge.crashSeconds + 0.3) / 0.3)));
    lean += ca.crashSlump * r;
  }
  return lean;
}

export function applyCartHitboxes(zombie, y0) {
  const type = zombie.type;
  const hb = type.hitbox;
  const cfg = type.cartHitbox;
  const [head, body, cart] = zombie.hitboxes;
  const p = zombie.position;
  const fx = -Math.sin(zombie.yaw); // the way it faces (and leans)
  const fz = -Math.cos(zombie.yaw);
  const lean = cartLean(zombie, type);
  const rest = type.cartAnimation.hunch; // the standing boxes in the config already include this much lean
  const forward = cfg.headReach * (Math.sin(lean) - Math.sin(rest));
  const drop = cfg.headReach * (Math.cos(lean) - Math.cos(rest));

  // Head: the standing box, moved to where the leaned head is.
  const hx = p.x + fx * forward;
  const hz = p.z + fz * forward;
  head.box.min.set(hx - hb.headHalfSize, y0 + hb.headBottom + drop, hz - hb.headHalfSize);
  head.box.max.set(hx + hb.headHalfSize, y0 + hb.headTop + drop, hz + hb.headHalfSize);

  // Body: the standing box plus the leaned torso (halfway to the head).
  const bx = p.x + fx * forward * cfg.torsoShare;
  const bz = p.z + fz * forward * cfg.torsoShare;
  body.box.min.set(Math.min(p.x, bx) - hb.bodyHalfWidth, y0, Math.min(p.z, bz) - hb.bodyHalfWidth);
  body.box.max.set(Math.max(p.x, bx) + hb.bodyHalfWidth, y0 + hb.bodyTop + drop, Math.max(p.z, bz) + hb.bodyHalfWidth); // (tops out where the head box starts)

  // Cart: only a target while it's crashed (tipped over and stunned). Otherwise this box just repeats the body box
  // (an empty or missing box would trip code that walks every hitbox).
  if (zombie.state !== 'crashed') {
    cart.box.copy(body.box);
    return;
  }
  const rx = Math.cos(zombie.yaw); // across it
  const rz = -Math.sin(zombie.yaw);
  cart.box.makeEmpty();
  for (const along of [cfg.cartFrom, cfg.cartTo]) {
    for (const across of [-cfg.cartHalfWidth, cfg.cartHalfWidth]) {
      cart.box.expandByPoint({ x: p.x + fx * along + rx * across, y: y0 + cfg.cartBottom, z: p.z + fz * along + rz * across });
      cart.box.expandByPoint({ x: p.x + fx * along + rx * across, y: y0 + cfg.cartTop, z: p.z + fz * along + rz * across });
    }
  }
}
