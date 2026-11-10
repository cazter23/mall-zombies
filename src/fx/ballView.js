// =============================================================================
// BALL VIEW (browser side: draws the Tennis Ball Launcher's balls)
// Reads `balls.list` (weapons/ballistics.js; the game runs without this) and shows each ball as a fuzzy yellow-green sphere with a seam stripe, between its last
// tick's position and this tick's (the render's `alpha`), so a fast ball moves smoothly at any frame rate. One small pool of meshes, built once; a mesh is hidden when
// its ball is gone. The ball's look is config/weapons.js tennisBallLauncher.projectile.look.
// =============================================================================

import * as THREE from 'three';
import { weapons } from '../config/weapons.js';

export function createBallView(scene, balls) {
  const look = weapons.tennisBallLauncher.projectile.look;
  const geometry = new THREE.SphereGeometry(1, 12, 8);
  const fuzz = new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.95, flatShading: true });
  const seam = new THREE.MeshStandardMaterial({ color: look.seamColor, roughness: 0.6, flatShading: true });
  const pool = [];
  const group = new THREE.Group();
  group.name = 'balls';
  scene.add(group);

  function make() {
    const ball = new THREE.Group();
    const body = new THREE.Mesh(geometry, fuzz);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.07, 4, 14), seam); // the curved seam, a ring round the middle
    stripe.rotation.y = Math.PI / 2;
    ball.add(body, stripe);
    ball.visible = false;
    group.add(ball);
    return ball;
  }

  return {
    group,
    update(alpha = 1) {
      const live = balls.list;
      while (pool.length < live.length) pool.push(make());
      for (let i = 0; i < pool.length; i++) {
        const mesh = pool[i];
        const ball = live[i];
        mesh.visible = !!ball;
        if (!ball) continue;
        mesh.position.lerpVectors(ball.previous, ball.position, alpha);
        mesh.scale.setScalar(ball.projectile.radius);
        mesh.rotation.x += 0.4; // (it tumbles)
        mesh.rotation.z += 0.25;
      }
    },
    dispose() {
      scene.remove(group);
      geometry.dispose();
      fuzz.dispose();
      seam.dispose();
    },
  };
}
