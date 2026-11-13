// =============================================================================
// RUNG UP VIEW (browser side: the Barcode Scanner's mark, game/rungUp.js)
// A red price tag, with its punched hole and a bit of string, floats, spins and bobs over the head of every zombie that is RUNG UP
// (zombie.isRungUp). It shrinks away over the mark's last half second. One small pool of tags, built once; the game runs without this.
// Its size and colours are config/weapons.js barcodeScanner.rungUp.tag.
// =============================================================================

import * as THREE from 'three';
import { weapons } from '../config/weapons.js';

export function createRungUpView(scene, zombies) {
  const tag = weapons.barcodeScanner.rungUp.tag;
  const tagMat = new THREE.MeshBasicMaterial({ color: tag.color }); // (unlit: it reads in the darkest corner, like a marker should)
  const holeMat = new THREE.MeshBasicMaterial({ color: tag.holeColor });
  const card = new THREE.BoxGeometry(tag.width, tag.height, tag.depth);
  const hole = new THREE.CylinderGeometry(tag.hole, tag.hole, tag.depth * 1.6, 10).rotateX(Math.PI / 2);
  const string = new THREE.BoxGeometry(0.006, tag.height * 0.9, 0.006);
  const group = new THREE.Group();
  group.name = 'rungUpTags';
  scene.add(group);
  const pool = [];

  function make() {
    const root = new THREE.Group();
    const body = new THREE.Mesh(card, tagMat);
    const punched = new THREE.Mesh(hole, holeMat);
    punched.position.set(-tag.width / 2 + tag.hole * 2.2, 0, 0); // the hole at the tag's narrow end
    const tie = new THREE.Mesh(string, holeMat);
    tie.position.set(-tag.width / 2 + tag.hole * 2.2, tag.height * 0.5, 0);
    root.add(body, punched, tie);
    root.visible = false;
    group.add(root);
    return root;
  }

  let clock = 0;
  return {
    group,
    update(dt) {
      clock += dt;
      const marked = zombies.zombies.filter((z) => z.isRungUp);
      while (pool.length < marked.length) pool.push(make());
      for (let i = 0; i < pool.length; i++) {
        const mesh = pool[i];
        const zombie = marked[i];
        mesh.visible = !!zombie;
        if (!zombie) continue;
        const phase = i * 1.7;
        mesh.position.copy(zombie.position);
        mesh.position.y += (zombie.type.height ?? 1.8) + tag.above + Math.sin(clock * 3 + phase) * tag.bob;
        mesh.rotation.y = clock * tag.spin + phase;
        mesh.rotation.z = 0.25; // (hung a little askew, like a real tag)
        mesh.scale.setScalar(Math.min(1, zombie.rungUpTimer / 0.5)); // shrinks away over the last half second
      }
    },
    dispose() {
      scene.remove(group);
      for (const resource of [tagMat, holeMat, card, hole, string]) resource.dispose();
    },
  };
}
