import * as THREE from 'three';
import { lastCustomerLook } from '../../config/lastCustomerLook.js';

// Lorraine Pruitt's twinset, perm and glasses on the shared skeleton (her trolley is the Cart Pusher's cart model with
// her heap of returns: type.cart). The parent model batches these pieces by material and disposes them.
export function dressLastCustomer({ upper, neck, arms, mat, block, ownedGeometry }) {
  const cfg = lastCustomerLook;
  const bones = {
    upper, head: neck, leftArm: arms[0].shoulder, rightArm: arms[1].shoulder,
    leftForearm: arms[0].elbow, rightForearm: arms[1].elbow,
  };
  const sphere = new THREE.SphereGeometry(...cfg.primitives.sphere);
  ownedGeometry.push(sphere);
  for (const part of cfg.parts) {
    const mesh = block(mat(cfg.colors[part.color]), ...part.size, ...part.at, bones[part.bone], part.shape === 'sphere' ? sphere : undefined);
    if (part.rotation) mesh.rotation.set(...part.rotation);
  }
  // The agape mouth has a colour of its own, so batching leaves it a mesh of its own to show and hide.
  const { color, size, at } = cfg.mouth;
  const mouth = block(mat(cfg.colors[color]), ...size, ...at, neck);
  mouth.name = 'lorraineMouth';
  mouth.visible = false;
  return { mouth, speechless: 0 };
}

const ease = (t) => t * t * (3 - 2 * t);

// Called every frame while she is alive and not mid-swing, after the trolley pose has put her hands on the handle.
// Speechless eases in (hand to her pearls, the other raised, chin up, trembling) and back out when she recovers.
export function poseLastCustomer(zombie, rig, { upper, neck, arms }, frameTime) {
  const cfg = lastCustomerLook.speechless;
  const target = zombie.state === 'speechless' ? 1 : 0;
  const step = frameTime / cfg.easeSeconds;
  rig.speechless = target ? Math.min(1, rig.speechless + step) : Math.max(0, rig.speechless - step);
  rig.mouth.visible = rig.speechless > 0.5;
  const w = ease(rig.speechless);
  if (w === 0) return;
  const lerp = THREE.MathUtils.lerp;
  for (const [arm, pose, elbow] of [[arms[0], cfg.leftArm, cfg.leftElbow], [arms[1], cfg.rightArm, cfg.rightElbow]]) {
    arm.shoulder.rotation.set(
      lerp(arm.shoulder.rotation.x, pose[0], w), lerp(arm.shoulder.rotation.y, pose[1], w), lerp(arm.shoulder.rotation.z, pose[2], w));
    arm.elbow.rotation.x = lerp(arm.elbow.rotation.x, elbow, w);
  }
  neck.rotation.x = lerp(neck.rotation.x, -cfg.chinUp, w);
  upper.rotation.z += Math.sin(zombie.stateTime * cfg.trembleRate) * cfg.tremble * w;
}
