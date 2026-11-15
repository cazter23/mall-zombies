// =============================================================================
// SHOPPING BAGS: a zombie carrying a shopping bag sometimes drops it, with one thing from Kiosk Kevin's cart inside (numbers:
// config/kiosk.js bagDrops). A charge of a product goes in its pocket (game/equipment.js); Bubble Wrap is one more layer (player/health.js).
// The bag sits on the floor for a while: walk over it to take it. Only something you have ROOM for is ever in a bag, so it never
// replaces what you carry; if you no longer have room when you get there (you bought something else), it waits until it runs out.
// One bag at a time. Built and ticked by game/createGame.js (g.bagDrops); DOM-free. reset() takes the bag away.
// (This replaced the Party Trap and Clearance Rack Limited Editions on 15 November 2026: docs/balance-review.md.)
//
//   const bags = createBagDrops({ events, equipment, health, player, scene, getRound, state, sound })
//   bags.update(dt) / bags.reset()
//   bags.bag                 null, or { id, position, remaining }   (id: a product id, or 'bubbleWrap')
//   bags.status              for the HUD: null, or { name, seconds, meters, bearing (radians, 0 = dead ahead, + = to your right), floor }
//   bags.debugDrop(id, at)   put a bag down now (browser console: for trying it out)
// =============================================================================

import * as THREE from 'three';
import { kiosk, productOf } from '../config/kiosk.js';
import { pickupDirection } from './floorPickups.js';

const cfg = kiosk.bagDrops;
const nameOf = (id) => productOf(id)?.name ?? kiosk.bubbleWrap.name;
const fill = (line, values) => ({ ...line, text: line.text.replace(/\{(\w+)\}/g, (_, key) => values[key]) });

export function createBagDrops({ events, equipment, health, player, scene, getRound, state, sound }) {
  let bag = null;
  let spin = 0;

  const root = new THREE.Group();
  root.name = 'shoppingBagDrop';
  root.visible = false;
  const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: cfg.glow });
  const trim = new THREE.MeshStandardMaterial({ color: 0xfff3d4, roughness: 0.7 });
  const part = (w, h, d, y, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.y = y;
    root.add(mesh);
  };
  part(0.34, 0.42, 0.18, 0.21, paper);
  part(0.35, 0.07, 0.19, 0.36, trim);
  part(0.2, 0.03, 0.03, 0.5, trim); // the handle
  scene?.add(root);

  // Room for one more of this? (A pocket that is empty or holds the same product below a full pocket; Bubble Wrap below the most layers.)
  function hasRoom(id) {
    const product = productOf(id);
    if (!product) return health.armour.length < health.maxArmourLayers;
    const pocket = equipment.pockets[product.pocket];
    return !pocket.id || pocket.count <= 0 || (pocket.id === id && pocket.count < product.charges);
  }

  // A weighted pick among what you have room for (null: nothing).
  function pickContents() {
    const options = Object.entries(cfg.contents).filter(([id]) => hasRoom(id));
    const total = options.reduce((sum, [, c]) => sum + c.weight, 0);
    let roll = Math.random() * total;
    for (const [id, c] of options) {
      roll -= c.weight;
      if (roll < 0) return id;
    }
    return null;
  }

  function put(id, position) {
    bag = { id, position: position.clone(), remaining: cfg.lifetimeSeconds };
    root.position.copy(bag.position);
    const color = cfg.contents[id]?.color ?? 0xffffff;
    paper.color.setHex(color);
    paper.emissive.setHex(color);
    root.visible = true;
    events.emit('bagDrop', { id, position: bag.position.clone(), pa: fill(cfg.pa.drop, { name: nameOf(id) }) });
  }

  function remove() {
    root.visible = false;
    bag = null;
  }

  function take({ id }) {
    if (productOf(id)) equipment.give(id, 1);
    else health.addArmour(1);
    remove();
    sound?.play('incentiveRestock');
    events.emit('bagTaken', { id, pa: fill(productOf(id) ? cfg.pa.taken : cfg.pa.wrapped, { name: nameOf(id) }) });
  }

  events.on('kill', ({ zombie }) => {
    if (state.over || zombie.noRewards || bag || !zombie.model?.hasBag || getRound() < cfg.fromRound) return;
    if (Math.random() >= cfg.dropChance) return;
    const id = pickContents();
    if (id) put(id, zombie.position);
  });

  return {
    get bag() { return bag; },
    get status() {
      if (!bag) return null;
      return { name: nameOf(bag.id), seconds: Math.ceil(bag.remaining), ...pickupDirection(player, bag.position, cfg.marker) };
    },
    debugDrop(id, at = player.position) { put(id, at); },

    update(dt) {
      if (!bag) return;
      bag.remaining -= dt;
      if (bag.remaining <= 0) {
        remove();
        return;
      }
      spin += cfg.spinSpeed * dt;
      root.rotation.y = spin;
      const reached = Math.hypot(player.position.x - bag.position.x, player.position.z - bag.position.z) <= cfg.pickupRadius
        && Math.abs(player.position.y - bag.position.y) <= cfg.pickupHeight;
      if (reached && !state.over && hasRoom(bag.id)) take(bag);
    },

    reset() {
      remove();
      spin = 0;
    },
  };
}
