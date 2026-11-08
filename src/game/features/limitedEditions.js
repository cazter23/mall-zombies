// =============================================================================
// LIMITED EDITIONS: Party Trap and Clearance Rack can't be bought. A zombie carrying a shopping bag sometimes drops one for a gun you
// have with you (built by game/features/workshop.js). The bag sits on the floor for a while: walk over it and it fits itself to that gun,
// free, alongside its tier, attachments and any finished build. One bag at a time, and only one that would be of use, so a drop is never wasted.
// DOM-free. reset() takes the bag away.
//
//   const drops = createLimitedEditionDrops({ events, gun, player, scene, rounds, state, sound })
//   drops.update(dt) / drops.reset()
//   drops.bag               null, or { id, position, remaining }
//   drops.status            for the HUD: null, or { name, seconds, meters, bearing (radians, 0 = dead ahead, + = to your right), floor ('upstairs' or null) }
//   drops.debugDrop(id, at) put a bag down now (browser console: for trying it out)
// =============================================================================

import * as THREE from 'three';
import { limitedEditionDrops as cfg, paLine, workshopBuilds, workshopModOf } from '../../config/workshop.js';
import { weapons } from '../../config/weapons.js';

export function createLimitedEditionDrops({ events, gun, player, scene, rounds, state, sound }) {
  let bag = null;
  let spin = 0;

  const root = new THREE.Group();
  root.name = 'limitedEditionBag';
  root.visible = false;
  const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6, emissive: 0xffffff, emissiveIntensity: cfg.glow });
  const trim = new THREE.MeshStandardMaterial({ color: 0xfff3d4, roughness: .7 });
  const part = (w, h, d, y, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.y = y;
    root.add(mesh);
  };
  part(.34, .42, .18, .21, paper);
  part(.35, .07, .19, .36, trim);
  part(.2, .03, .03, .5, trim); // the handle
  scene.add(root);

  // Limited Editions a carried gun doesn't have yet.
  const wanted = () => Object.keys(workshopBuilds).filter((id) => {
    const { weapon } = workshopBuilds[id];
    return gun.owns(weapon) && workshopModOf(gun.modsFor(weapon)) !== id;
  });

  function put(id, position) {
    bag = { id, position: position.clone(), remaining: cfg.lifetimeSeconds };
    root.position.copy(bag.position);
    paper.color.setHex(workshopBuilds[id].color);
    paper.emissive.setHex(workshopBuilds[id].color);
    root.visible = true;
    events.emit('limitedEditionDrop', { id, position: bag.position.clone(), pa: paLine(cfg.pa.drop, { name: workshopBuilds[id].name }) });
  }

  function take() {
    root.visible = false;
    bag = null;
  }

  function fit({ id }) {
    const build = workshopBuilds[id];
    const mods = gun.modsFor(build.weapon).filter((m) => m.id !== 'workshop');
    gun.setMods(build.weapon, [...mods, { id: 'workshop', workshop: id }]);
    take();
    sound?.play('incentiveRestock');
    const pa = paLine(cfg.pa.fitted, { name: build.name, gun: weapons[build.weapon].name, instructions: build.instructions });
    events.emit('limitedEditionFitted', { id, weapon: build.weapon, pa });
  }

  events.on('kill', ({ zombie }) => {
    if (state.over || zombie.noRewards || bag || !zombie.model?.hasBag || rounds.round < cfg.fromRound) return;
    if (Math.random() >= cfg.dropChance) return;
    const options = wanted();
    if (options.length) put(options[Math.floor(Math.random() * options.length)], zombie.position);
  });

  return {
    get bag() { return bag; },
    get status() {
      if (!bag) return null;
      const dx = bag.position.x - player.position.x, dz = bag.position.z - player.position.z, dy = bag.position.y - player.position.y;
      const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
      const ahead = -dx * sin - dz * cos, right = dx * cos - dz * sin;
      const { floorGap, up, down } = cfg.marker;
      return {
        name: workshopBuilds[bag.id].name,
        seconds: Math.ceil(bag.remaining),
        meters: Math.round(Math.hypot(dx, dz)),
        bearing: Math.atan2(right, ahead),
        floor: dy > floorGap ? up : dy < -floorGap ? down : null,
      };
    },
    debugDrop(id, at = player.position) { put(id, at); },

    update(dt) {
      if (!bag) return;
      bag.remaining -= dt;
      if (bag.remaining <= 0) {
        take();
        return;
      }
      spin += cfg.spinSpeed * dt;
      root.rotation.y = spin;
      const reached = Math.hypot(player.position.x - bag.position.x, player.position.z - bag.position.z) <= cfg.pickupRadius
        && Math.abs(player.position.y - bag.position.y) <= cfg.pickupHeight;
      // (If you've swapped the gun away it just waits for you, until it runs out.)
      if (reached && wanted().includes(bag.id)) fit(bag);
    },

    reset() {
      take();
      spin = 0;
    },
  };
}
