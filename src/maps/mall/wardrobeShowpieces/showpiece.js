// =============================================================================
// SHOWPIECE BASE: what every Wardrobe showpiece (the big themed fixture an item is sold from) shares.
// A builder (foodCourt.js has the first three) makes the SHAPES with the helpers below and gets back a handle that
// game/features/wardrobeFixtures.js drives:
//
//   handle.update(dt)     one fixed tick: idle motion, the glow, the buying pose
//   handle.setSold(bool)  the player owns the item: after the buying pose the motion stops, the glow and signs dim and
//                         the card reads SOLD OUT · IN YOUR SIZE (false again on Play again)
//   handle.pose()         the buying moment: the motion snaps to its pose and a spotlight cone flashes on the buyer
//   handle.reset()        a new run: unsold, clock and pose cleared
//   handle.soldOut / handle.dimmed / handle.posing   (read by tests)
//
// Layout of one showpiece (a Group named after the map feature, so the room-culling and tests find it):
//   still   never moves, plain cached materials: the static batcher merges it into the room's few draw calls
//   live    userData.dynamic: everything that moves, glows or changes with the sold state (own materials, so dimming one
//           showpiece never touches another's)
// Local frame: origin on the floor under the buy prompt, +Z toward the aisle (the buyer stands at +Z), +X to the buyer's right.
// Decoration only: the one solid base each builder adds (its own addCollider call) is the only collision.
// =============================================================================
import * as THREE from 'three';
import { makeSignTexture } from '../../../world/textures.js';
import { showpieces as cfg, wardrobeItems } from '../../../config/wardrobe.js';

export function createShowpiece({ kit, name, color, position, yaw }) {
  const root = new THREE.Group();
  root.name = name;
  root.position.copy(position);
  root.rotation.y = yaw;
  kit.group.add(root);
  const still = new THREE.Group();
  still.name = `${name}_still`;
  const live = new THREE.Group();
  live.name = `${name}_live`;
  live.userData.dynamic = true;
  root.add(still, live);

  const glows = []; // { material, base, pulse? }   emissive parts: dim when sold, flare during the buying pose
  const signs = []; // MeshBasicMaterial of every sign: dims when sold
  const cards = { open: [], sold: [] }; // sign meshes shown while unsold / once owned
  const tints = []; // { material, base } of every opaque moving piece: greyed when sold
  const anims = []; // (t, pose) each tick; t = the idle clock, pose = 0..1 envelope of the buying moment
  let clock = 0;
  let poseLeft = 0;
  let soldOut = false;
  let dimmed = false;
  let settled = false; // sold, pose over, drawn at rest: nothing left to update

  const ownMaterial = (options) => new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true, ...options });
  const place = (mesh, [x, y, z], [rx, ry, rz] = [0, 0, 0]) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
  };

  // A plain solid piece (cached material, merged by the static batcher).
  function solid(geometry, hex, at, rot, parent = still, materialOptions = {}) {
    const mesh = place(new THREE.Mesh(geometry, kit.mat(hex, materialOptions)), at, rot);
    parent.add(mesh);
    return mesh;
  }
  // A glowing piece (own emissive material): in the live group unless a moving parent is given.
  function glow(geometry, hex, at, rot, { parent = live, intensity = 0.9, pulse = null, base = null } = {}) {
    const material = ownMaterial({ color: base ?? hex, emissive: hex, emissiveIntensity: intensity });
    const mesh = place(new THREE.Mesh(geometry, material), at, rot);
    parent.add(mesh);
    glows.push({ material, base: intensity, pulse });
    return mesh;
  }
  // A piece that moves or fades but doesn't glow (own material, so a fade never leaks to another).
  function moving(geometry, hex, at, rot, { parent = live, ...options } = {}) {
    const mesh = place(new THREE.Mesh(geometry, ownMaterial({ color: hex, ...options })), at, rot);
    parent.add(mesh);
    if (!options.transparent) tints.push({ material: mesh.material, base: mesh.material.color.clone() });
    return mesh;
  }
  // A flat sign facing +Z (of its parent). Dims with the showpiece when sold.
  function sign(text, width, height, at, { background = '#2b1a12', textColor = '#ffedca', parent = live, style } = {}) {
    const texture = makeSignTexture(text, { background, color: textColor, aspect: width / height, style });
    const mesh = place(new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture })), at);
    parent.add(mesh);
    signs.push(mesh.material);
    return mesh;
  }
  // The item's card: `open` while unsold, `soldText` (SOLD OUT · IN YOUR SIZE) once owned. Two signs, one visible.
  function card(open, soldText, width, height, at, options = {}) {
    const a = sign(open, width, height, at, options);
    const b = sign(soldText, width, height, at, { ...options, background: '#3a2f3d', textColor: '#d9c9a8' });
    b.visible = false;
    signs.splice(signs.indexOf(b.material), 1); // (the sold card stays bright: it is the news)
    cards.open.push(a);
    cards.sold.push(b);
    return [a, b];
  }
  // A SOLD OUT banner, only there once the item is owned: readable from across the court, so you can see what you still lack.
  function banner(width, height, at, options = {}) {
    const mesh = sign('SOLD OUT', width, height, at, { background: '#a61e2a', textColor: '#ffffff', ...options });
    mesh.visible = false;
    signs.splice(signs.indexOf(mesh.material), 1);
    cards.sold.push(mesh);
    return mesh;
  }
  // A neon frame (four glowing bars) around a rectangle in the XY plane at `z`.
  function neonFrame(width, height, [x, y, z], { thickness = 0.04, parent = live } = {}) {
    for (const [w, h, dx, dy] of [[width, thickness, 0, height / 2], [width, thickness, 0, -height / 2], [thickness, height, -width / 2, 0], [thickness, height, width / 2, 0]]) {
      glow(new THREE.BoxGeometry(w, h, thickness), color, [x + dx, y + dy, z], undefined, { parent, intensity: 1.1, pulse: (t) => 0.8 + 0.2 * Math.sin(t * 3) });
    }
  }

  // The buying moment's spotlight: a translucent cone of light on the spot the buyer stands.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 3.4, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff1bf, transparent: true, opacity: 0, depthWrite: false }), // (front faces only: the buyer stands inside the cone and must not get a white veil)
  );
  cone.position.set(0, 1.7, 0.9);
  cone.visible = false;
  live.add(cone);

  const rest = () => { for (const anim of anims) anim(0, 0); };

  function applyGlow(pose) {
    const level = dimmed ? cfg.soldGlow : 1 + 0.8 * pose;
    for (const g of glows) g.material.emissiveIntensity = g.base * level * (dimmed || !g.pulse ? 1 : g.pulse(clock));
  }
  function applyDim(next) {
    dimmed = next;
    const shade = dimmed ? cfg.soldSign : 1;
    for (const material of signs) material.color.setScalar(shade);
    for (const t of tints) t.material.color.copy(t.base).multiplyScalar(dimmed ? cfg.soldTint : 1);
    for (const mesh of cards.open) mesh.visible = !soldOut;
    for (const mesh of cards.sold) mesh.visible = soldOut;
  }

  const handle = {
    name,
    root,
    get soldOut() { return soldOut; },
    get dimmed() { return dimmed; },
    get posing() { return poseLeft > 0; },
    get clock() { return clock; },

    update(dt) {
      if (settled) return;
      if (poseLeft > 0) poseLeft = Math.max(0, poseLeft - dt);
      const pose = poseLeft > 0 ? Math.sin(Math.PI * (1 - poseLeft / cfg.poseSeconds)) : 0;
      const wantDim = soldOut && poseLeft <= 0;
      if (wantDim !== dimmed) applyDim(wantDim);
      if (!dimmed) clock += dt * (1 + 2 * pose); // (the motion races while posing)
      for (const anim of anims) anim(dimmed ? 0 : clock, pose);
      applyGlow(pose);
      cone.visible = poseLeft > 0;
      cone.material.opacity = 0.32 * pose;
      if (dimmed) settled = true; // sold, pose over, resting and dim: nothing more to do until reset
    },

    setSold(value) {
      if (value === soldOut) return;
      soldOut = value;
      settled = false;
      if (!soldOut) { applyDim(false); poseLeft = 0; }
      else for (const mesh of cards.open) mesh.visible = true; // (the cards swap when the pose ends)
    },

    pose() {
      poseLeft = cfg.poseSeconds;
      settled = false;
    },

    reset() {
      soldOut = false;
      poseLeft = 0;
      clock = 0;
      settled = false;
      applyDim(false);
      rest();
      applyGlow(0);
      cone.visible = false;
    },
  };

  return { root, still, live, handle, solid, glow, moving, sign, card, banner, neonFrame, place, animate: (fn) => anims.push(fn) };
}

export function createFloorShowpiece(kit, spot, floorY) {
  const { color } = wardrobeItems[spot.item];
  const position = spot.position.clone().setY(floorY);
  const yaw = Math.atan2(spot.normal.x, spot.normal.z);
  const s = createShowpiece({ kit, name: spot.name, color, position, yaw });
  const { root } = s;
  return {
    ...s,
    color,
    // Match the one plain solid to the display's base, even when the fixture faces across an aisle.
    base(width, height, depth, hex, z = -depth / 2) {
      const base = s.solid(new THREE.BoxGeometry(width, height, depth), hex, [0, height / 2, z]);
      base.name = `${spot.name}_base`;
      root.updateWorldMatrix(true, true);
      const { min, max } = new THREE.Box3().setFromObject(base);
      kit.addCollider(min.x, min.y, min.z, max.x, max.y, max.z).vaultable = height > 0.35 && height <= 1.1;
      return base;
    },
    group(y, z) {
      const group = new THREE.Group();
      group.position.set(0, y, z);
      s.live.add(group);
      return group;
    },
    header(text, width, y, z, x = 0, yaw = 0) {
      s.glow(new THREE.BoxGeometry(width, 0.3, 0.055), color, [x, y, z], [0, yaw, 0], { intensity: 0.95 });
      const signs = s.card(text, 'SOLD OUT', width - 0.08, 0.235, [x + 0.052 * Math.sin(yaw), y, z + 0.052 * Math.cos(yaw)]);
      for (const sign of signs) sign.rotation.y = yaw;
      signs[0].name = `${spot.name}_header`;
    },
    ticket(text, y, z, width = 0.76) {
      s.card(text, 'SOLD OUT · IN YOUR SIZE', width, 0.155, [0, y, z]);
    },
  };
}
