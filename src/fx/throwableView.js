// =============================================================================
// THROWABLE VIEW (browser side: draws Kiosk Kevin's thrown equipment)
// Reads `equipment.live` (game/equipment.js; the game runs without this): each thrown thing still out, in the air, sitting on
// the floor waiting for its fuse, or (the Sparkler Cake) spraying where it landed. Drawn between its last tick's position and
// this tick's (the render's `alpha`). The models are the same as on Kevin's counter (world/kioskProducts.js), by `look.model`:
//   bottle  the Soda Bomb: a stubby two-litre that tumbles while it flies and shakes harder as the fuse runs out
//   cake    the Sparkler Cake: a short iced cake with three sparklers; it spins in the air and sits upright, jittering, while it sprays
//   card    the Glitter Bomb: a greeting card in its envelope, flipping end over end (it opens the moment it lands)
//   sentry  the SPIN-O-MATIC Sentry: a display stand with a staple gun taped on; it tumbles in the air, then springs up where it
//           lands, its head turning to item.yaw (spinning while it hunts, facing what it shoots), kicking back with each shot,
//           the spinner on top whirring; in its last seconds the batteries go and it sputters and sags
// One small pool of meshes per model, built as needed; a mesh is hidden when its item is gone (burst, death, Play again).
// dispose() frees it all.
// =============================================================================

import * as THREE from 'three';
import { buildProductModel } from '../world/kioskProducts.js';

const MODEL_IDS = { bottle: 'sodaBomb', cake: 'sparklerCake', card: 'glitterBomb', sentry: 'sentry' };
const SPUTTER_SECONDS = 3; // the Sentry's last seconds: its batteries going

export function createThrowableView(scene, equipment) {
  const materials = new Map();
  const mat = (color, options = {}) => {
    const key = `${color}|${JSON.stringify(options)}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, ...options }));
    return materials.get(key);
  };
  const pools = Object.fromEntries(Object.keys(MODEL_IDS).map((model) => [model, []]));
  const group = new THREE.Group();
  group.name = 'throwables';
  scene.add(group);

  function make(model) {
    const root = new THREE.Group();
    const body = buildProductModel(MODEL_IDS[model], mat); // (spun around its middle; a Sentry's origin is its foot)
    if (model === 'bottle') body.position.y = -0.02;
    root.add(body);
    root.userData.body = body;
    root.visible = false;
    group.add(root);
    return root;
  }

  function pose(root, item, alpha, dt) {
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
    } else if (model === 'sentry') {
      const { head, spinner } = body.userData;
      if (item.flying || !item.deployed) {
        body.rotation.x += 0.3; // (it tumbles)
        body.scale.set(1, 1, 1);
        return;
      }
      const { turret } = item.product;
      const up = turret.lifeSeconds - item.lifeLeft; // seconds since it landed
      const dying = Math.max(0, 1 - item.lifeLeft / SPUTTER_SECONDS); // 0 until its last seconds, then up to 1
      // It springs up out of a squash as it lands (over its warm-up), then stands; dying, it sags and wobbles.
      const t = Math.min(1, up / turret.warmupSeconds);
      const spring = 1 - Math.exp(-6 * t) * Math.cos(9 * t);
      body.scale.set(1 + (1 - spring) * 0.3, Math.max(0.2, spring) * (1 - dying * 0.12), 1 + (1 - spring) * 0.3);
      const wobble = dying * 0.18 * Math.sin(up * 23);
      body.rotation.set(wobble, 0, dying * 0.12 + wobble * 0.5);
      // Its head turns to item.yaw; while dying it lags and jerks (stuck, then catching up).
      if (!dying) head.rotation.y = item.yaw;
      else if (Math.sin(up * 9) < 0.4 - dying) head.rotation.y += (item.yaw - head.rotation.y) * 0.25;
      // A shot kicks the gun back (lastShot changes with every shot).
      if (item.lastShot && item.lastShot !== root.userData.lastShot) {
        root.userData.lastShot = item.lastShot;
        root.userData.kick = 1;
      }
      root.userData.kick = Math.max(0, (root.userData.kick ?? 0) - dt * 12);
      head.rotation.x = -(root.userData.kick ?? 0) * 0.25;
      // The spinner on top whirrs (faster while it hunts), and stutters as the batteries go.
      const whirr = (item.hunting ? 26 : 14) * (1 - dying * 0.8);
      if (!dying || Math.sin(up * 13) > -0.2) spinner.rotation.y += whirr * dt;
    } else {
      body.rotation.x += 0.4; // (a card flips end over end)
    }
  }

  return {
    group,
    update(alpha = 1, dt = 1 / 60) {
      const used = Object.fromEntries(Object.keys(pools).map((model) => [model, 0]));
      for (const item of equipment.live) {
        const model = item.product.look?.model ?? 'bottle';
        const pool = pools[model];
        if (used[model] === pool.length) pool.push(make(model));
        const root = pool[used[model]++];
        root.visible = true;
        pose(root, item, alpha, dt);
      }
      for (const [model, pool] of Object.entries(pools)) for (let i = used[model]; i < pool.length; i++) pool[i].visible = false;
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [o.material].flat().forEach((m) => m.dispose()); // (baked ones too; disposing twice is harmless)
      });
      for (const material of materials.values()) material.dispose();
      for (const pool of Object.values(pools)) pool.length = 0;
    },
  };
}
