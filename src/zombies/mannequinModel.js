import * as THREE from 'three';

// Separate plastic display body; the same root/update/dispose contract as shoppers.
export function createMannequinModel(type) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  root.name = 'mannequin';
  const plastic = new THREE.MeshStandardMaterial({ color: type.plastic.color, roughness: type.plastic.roughness, flatShading: true });
  const joint = new THREE.MeshStandardMaterial({ color: type.plastic.jointColor, roughness: .65 });
  const tag = new THREE.MeshStandardMaterial({ color: type.plastic.tagColor });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  function block(parent, mat, size, at) {
    const m = new THREE.Mesh(geometry, mat); m.scale.set(...size); m.position.set(...at); parent.add(m); return m;
  }
  block(body, plastic, [.45, .55, .25], [0, 1.12, 0]);
  block(body, joint, [.31, .035, .22], [0, .84, 0]);
  block(body, plastic, [.34, .13, .24], [0, .76, 0]);
  block(body, joint, [.1, .09, .1], [0, 1.43, 0]);
  const head = block(body, plastic, [.28, .29, .27], [0, 1.61, 0]); head.name = 'head';
  block(body, joint, [.21, .012, .012], [0, 1.61, .138]); // mould seam on back of faceless head
  block(body, tag, [.11, .14, .02], [.13, 1.25, -.14]);
  for (let i = 0; i < 4; i++) block(body, joint, [.008, .07, .012], [.096 + i * .02, 1.25, -.156]);
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .105, .72, 0); body.add(leg); legs.push(leg);
    block(leg, plastic, [.15, .31, .16], [0, -.16, 0]);
    block(leg, joint, [.13, .035, .14], [0, -.335, 0]);
    block(leg, plastic, [.12, .29, .13], [0, -.50, 0]);
    block(leg, plastic, [.14, .065, .25], [0, -.685, -.045]);
    const arm = new THREE.Group(); arm.position.set(side * .285, 1.33, 0); body.add(arm); arms.push(arm);
    block(arm, joint, [.09, .09, .09], [0, 0, 0]);
    block(arm, plastic, [.12, .25, .13], [0, -.16, 0]);
    block(arm, joint, [.10, .035, .10], [0, -.30, 0]);
    block(arm, plastic, [.10, .23, .11], [0, -.435, 0]);
    block(arm, plastic, [.10, .12, .06], [0, -.61, -.02]);
    for (let i = 0; i < 3; i++) block(arm, plastic, [.022, .08, .04], [-.032 + i * .032, -.70, -.02]);
  }
  let phase = 0;
  return {
    root,
    update(dt, z, alpha) {
      root.position.lerpVectors(z.prevPosition, z.position, alpha);
      root.rotation.y = z.prevYaw + Math.atan2(Math.sin(z.yaw - z.prevYaw), Math.cos(z.yaw - z.prevYaw)) * alpha;
      // Preserve the exact limb pose when watched. Death always animates.
      if (!z.frozen || !z.isAlive) {
        phase += z.horizontalSpeed * dt * 4;
        const stride = Math.sin(phase) * Math.min(1, z.horizontalSpeed / type.speed);
        legs[0].rotation.x = stride * .65; legs[1].rotation.x = -stride * .65;
        arms[0].rotation.x = -stride * .55; arms[1].rotation.x = stride * .55;
        if (z.state === 'windup') for (const arm of arms) arm.rotation.x = Math.PI * Math.min(1, z.stateTime / z.windupSeconds);
        if (z.state === 'swing') for (const arm of arms) arm.rotation.x = 1.3;
      }
      body.rotation.z = z.isAlive ? 0 : Math.min(1, z.stateTime / type.fallSeconds) * Math.PI / 2;
      body.position.y = 0;
      if (z.state === 'spawning') body.position.y = -type.height * (1 - Math.min(1, z.stateTime / type.spawnSeconds));
      if (!z.isAlive) body.position.y = -Math.max(0, z.stateTime - type.fallSeconds - type.corpseSeconds) / type.sinkSeconds * type.height;
      plastic.emissive.setHex(z.flinchTimer > 0 ? 0x444444 : 0);
    },
    dispose() { root.removeFromParent(); geometry.dispose(); plastic.dispose(); joint.dispose(); tag.dispose(); },
  };
}
