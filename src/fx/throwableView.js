// =============================================================================
// THROWABLE VIEW (browser side: draws Kiosk Kevin's thrown equipment)
// Reads `equipment.live` (game/equipment.js; the game runs without this): each thrown thing still out, in the air, sitting on
// the floor waiting for its fuse, or (the Sparkler Cake) spraying where it landed. Drawn between its last tick's position and
// this tick's (the render's `alpha`). Each product names its model in config/kiosk.js `look.model`:
//   bottle  the Soda Bomb: a stubby two-litre that tumbles while it flies and shakes harder as the fuse runs out
//   cake    the Sparkler Cake: a short iced cake with three sparklers; it spins in the air and sits upright, jittering, while it sprays
//   card    the Glitter Bomb: a greeting card in its envelope, flipping end over end (it opens the moment it lands)
// One small pool of meshes per model, built as needed; a mesh is hidden when its item is gone (burst, death, Play again).
// dispose() frees it all.
// =============================================================================

import * as THREE from 'three';
import { kiosk } from '../config/kiosk.js';

export function createThrowableView(scene, equipment) {
  const { sodaBomb, sparklerCake, glitterBomb } = kiosk.products;
  const geometries = {
    body: new THREE.CylinderGeometry(0.075, 0.085, 0.24, 8),
    neck: new THREE.CylinderGeometry(0.025, 0.07, 0.09, 8),
    cap: new THREE.CylinderGeometry(0.028, 0.028, 0.03, 8),
    label: new THREE.CylinderGeometry(0.087, 0.087, 0.09, 8, 1, true),
    cake: new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10),
    icing: new THREE.CylinderGeometry(0.135, 0.135, 0.025, 10),
    wick: new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4),
    card: new THREE.BoxGeometry(0.17, 0.008, 0.12),
  };
  const materials = {
    bottle: new THREE.MeshStandardMaterial({ color: sodaBomb.look.bottle, roughness: 0.25, transparent: true, opacity: 0.88 }),
    label: new THREE.MeshStandardMaterial({ color: sodaBomb.look.label, roughness: 0.6, side: THREE.DoubleSide }),
    cap: new THREE.MeshStandardMaterial({ color: sodaBomb.look.cap, roughness: 0.5 }),
    cake: new THREE.MeshStandardMaterial({ color: sparklerCake.look.cake, roughness: 0.8 }),
    icing: new THREE.MeshStandardMaterial({ color: sparklerCake.look.icing, roughness: 0.5 }),
    wick: new THREE.MeshStandardMaterial({ color: sparklerCake.look.wick, roughness: 0.4, metalness: 0.5 }),
    card: new THREE.MeshStandardMaterial({ color: glitterBomb.look.envelope, roughness: 0.4, metalness: 0.3 }),
  };
  const mesh = (geometry, material, y = 0) => {
    const m = new THREE.Mesh(geometries[geometry], materials[material]);
    m.position.y = y;
    return m;
  };
  const builders = {
    bottle: (body) => body.add(mesh('body', 'bottle'), mesh('label', 'label'), mesh('neck', 'bottle', 0.165), mesh('cap', 'cap', 0.225)),
    cake: (body) => {
      body.add(mesh('cake', 'cake'), mesh('icing', 'icing', 0.05));
      for (let i = 0; i < 3; i++) {
        const wick = mesh('wick', 'wick', 0.12);
        wick.position.x = Math.cos(i * 2.1) * 0.06;
        wick.position.z = Math.sin(i * 2.1) * 0.06;
        body.add(wick);
      }
    },
    card: (body) => body.add(mesh('card', 'card')),
  };
  const pools = Object.fromEntries(Object.keys(builders).map((model) => [model, []]));
  const group = new THREE.Group();
  group.name = 'throwables';
  scene.add(group);

  function make(model) {
    const root = new THREE.Group();
    const body = new THREE.Group(); // (spun around its middle)
    builders[model](body);
    if (model === 'bottle') body.position.y = -0.02;
    root.add(body);
    root.userData.body = body;
    root.visible = false;
    group.add(root);
    return root;
  }

  function pose(root, item, alpha) {
    root.position.lerpVectors(item.previous, item.position, alpha);
    const body = root.userData.body;
    const model = item.product.look.model;
    if (model === 'bottle') {
      const left = Math.max(0, 1 - item.age / item.product.fuseSeconds);
      if (item.flying) {
        body.rotation.x += 0.35; // (it tumbles end over end)
        body.rotation.z += 0.12;
      } else {
        // On the floor: lying on its side, rattling harder as the fuse runs out.
        const shake = (1 - left) * 0.25;
        body.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * shake, body.rotation.y, (Math.random() - 0.5) * shake);
      }
      root.scale.setScalar(1 + (1 - left) * 0.18); // (the pressure builds)
    } else if (model === 'cake') {
      if (item.flying) {
        body.rotation.y += 0.3;
        body.rotation.z = 0.25;
      } else {
        body.rotation.set((Math.random() - 0.5) * 0.06, body.rotation.y + 0.08, (Math.random() - 0.5) * 0.06); // (the sparklers make it jitter)
      }
    } else {
      body.rotation.x += 0.4; // (a card flips end over end)
    }
  }

  return {
    group,
    update(alpha = 1) {
      const used = Object.fromEntries(Object.keys(pools).map((model) => [model, 0]));
      for (const item of equipment.live) {
        const model = item.product.look?.model ?? 'bottle';
        const pool = pools[model];
        if (used[model] === pool.length) pool.push(make(model));
        const root = pool[used[model]++];
        root.visible = true;
        pose(root, item, alpha);
      }
      for (const [model, pool] of Object.entries(pools)) for (let i = used[model]; i < pool.length; i++) pool[i].visible = false;
    },
    dispose() {
      scene.remove(group);
      for (const geometry of Object.values(geometries)) geometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
      for (const pool of Object.values(pools)) pool.length = 0;
    },
  };
}
