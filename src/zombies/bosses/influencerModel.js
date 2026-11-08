import * as THREE from 'three';

// Shares the normal zombie skeleton and material batching. Hair, clothes and
// equipment are costume geometry, owned by the parent model's disposal path.
export function dressInfluencer(type, { upper, neck, arms, legs, mat, block, ownedGeometry }) {
  const cfg = type.appearance;
  const ponytail = new THREE.Group();
  ponytail.name = 'skylarPonytail';
  ponytail.position.set(...cfg.mounts.ponytail);
  neck.add(ponytail);
  const phoneRig = new THREE.Group();
  phoneRig.name = 'skylarPhoneRig';
  phoneRig.position.set(...cfg.mounts.phoneRig);
  arms[1].elbow.add(phoneRig);
  const bones = {
    upper, head: neck, ponytail, phoneRig,
    leftArm: arms[0].shoulder, rightArm: arms[1].shoulder,
    leftForearm: arms[0].elbow, rightForearm: arms[1].elbow,
    leftLeg: legs[0], rightLeg: legs[1],
  };
  const sphere = new THREE.SphereGeometry(...cfg.primitives.sphere);
  ownedGeometry.push(sphere);
  for (const part of cfg.parts) {
    const mesh = block(mat(cfg.colors[part.color]), ...part.size, ...part.at, bones[part.bone], part.shape === 'sphere' ? sphere : undefined);
    if (part.rotation) mesh.rotation.set(...part.rotation);
  }
  for (const ring of cfg.rings) {
    const geometry = new THREE.TorusGeometry(...ring.args);
    ownedGeometry.push(geometry);
    block(mat(cfg.colors[ring.color]), 1, 1, 1, ...ring.at, bones[ring.bone], geometry);
  }
  return { ponytail, phoneRig };
}

export function poseInfluencer(type, zombie, rig, { upper, neck, arms }, walkPhase) {
  const cfg = type.appearance.pose;
  const moving = Math.min(1, zombie.horizontalSpeed / type.speed);
  const idle = 1 - moving;
  const flash = zombie.phoneFlashWindup === null || zombie.phoneFlashWindup === undefined
    ? 0 : 1 - THREE.MathUtils.clamp(zombie.phoneFlashWindup / type.flash.windupSeconds, 0, 1);
  const glance = Math.sin(zombie.stateTime * cfg.glanceRate) * idle;
  upper.rotation.z += cfg.hipLean * idle;
  upper.rotation.y += cfg.shoulderTwist * idle;
  neck.rotation.y += glance * cfg.glanceAmount;
  neck.rotation.z += cfg.idleHeadTilt * idle;
  arms[0].shoulder.rotation.set(...cfg.leftArm);
  arms[0].elbow.rotation.x = cfg.leftElbow;
  const filming = cfg.filmingArm, aimed = cfg.flashArm;
  arms[1].shoulder.rotation.set(
    THREE.MathUtils.lerp(filming[0], aimed[0], flash),
    THREE.MathUtils.lerp(filming[1], aimed[1], flash),
    THREE.MathUtils.lerp(filming[2], aimed[2], flash),
  );
  arms[1].elbow.rotation.x = THREE.MathUtils.lerp(cfg.filmingElbow, cfg.flashElbow, flash);
  rig.phoneRig.rotation.set(
    THREE.MathUtils.lerp(cfg.phoneTilt[0], cfg.flashTilt[0], flash),
    THREE.MathUtils.lerp(cfg.phoneTilt[1], cfg.flashTilt[1], flash),
    THREE.MathUtils.lerp(cfg.phoneTilt[2], cfg.flashTilt[2], flash),
  );
  rig.ponytail.rotation.set(Math.sin(walkPhase) * cfg.tailSwing * moving, 0, glance * cfg.tailSway);
}
