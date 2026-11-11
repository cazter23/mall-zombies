// One piece of lost property (config/lostFound.js; the map lists one feature per item, `item` = its id).
// A small model on the floor wearing a pulsing yellow property tag, a quiet cue sound while you are near and have not
// logged it, and a hold-to-log prompt. Logging is permanent (game/lostFound.js): an item you already have stays where
// it was, faded, with a still tag and no prompt, so the mall never looks emptier for having been searched.
import * as THREE from 'three';
import { lostFound, lostItem } from '../../config/lostFound.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.SphereGeometry(1, 10, 8);

/** The item's model: its parts, then the tag. Returns { group, materials, tagMaterial } (the builder owns the materials). */
export function buildLostPropertyModel(item) {
  const look = lostFound.look;
  const group = new THREE.Group();
  group.name = 'lost_' + item.id;
  const materials = [];
  const material = (color, glow = false) => {
    const made = new THREE.MeshStandardMaterial({ color, roughness: look.roughness, flatShading: true, emissive: glow ? color : 0x000000, emissiveIntensity: glow ? 0.9 : 0 });
    materials.push(made);
    return made;
  };
  let top = 0;
  for (const part of item.parts) {
    const mesh = new THREE.Mesh(part.ball ? ball : box, material(part.color, part.glow));
    if (part.ball) mesh.scale.setScalar(part.ball);
    else mesh.scale.fromArray(part.size);
    mesh.position.fromArray(part.at);
    if (part.tilt) mesh.rotation.x = part.tilt;
    group.add(mesh);
    top = Math.max(top, part.at[1] + (part.ball ?? part.size[1] / 2));
  }
  // The property tag: a yellow card standing over the item on a short string.
  const tag = look.tag;
  const tagMaterial = new THREE.MeshStandardMaterial({ color: tag.color, roughness: 0.6, emissive: tag.glow, emissiveIntensity: tag.pulseMax });
  materials.push(tagMaterial);
  const card = new THREE.Mesh(box, tagMaterial);
  card.name = 'lostTag';
  card.scale.fromArray(tag.size);
  card.position.set(0.06, top + tag.lift, 0);
  card.rotation.z = -0.25;
  const string = new THREE.Mesh(box, material(tag.string));
  string.scale.set(0.006, tag.lift, 0.006);
  string.position.set(0.03, top + tag.lift / 2, 0);
  string.rotation.z = -0.4;
  group.add(card, string);
  group.scale.setScalar(look.scale);
  return { group, materials, tagMaterial };
}

export function buildLostProperty(feature, { scene, map, interactions, player, state, sound, lostFound: log }) {
  const item = lostItem(feature.item);
  if (!item) throw new Error(`lostProperty "${feature.name}": no item "${feature.item}" in config/lostFound.js`);
  const { look, cue, pickup } = lostFound;
  const { group, materials, tagMaterial } = buildLostPropertyModel(item);
  group.position.copy(feature.position);
  group.rotation.y = item.facing ?? 0;
  group.userData.dynamic = true; // (its look changes when it is logged: keep it out of the static batch)
  scene.add(group);

  const prompt = new THREE.Vector3(feature.position.x, feature.position.y + pickup.promptHeight, feature.position.z);
  // A hanging item (the balloon) is taken where it hangs; a floor item a little above the floor.
  if (item.parts.some((part) => part.at[1] < -0.5)) prompt.y = feature.position.y;
  let shownLogged = null, clock = 0, cueIn = cue.everySeconds * Math.random();

  function showLogged(logged) {
    if (shownLogged === logged) return;
    shownLogged = logged;
    for (const material of materials) {
      material.transparent = logged;
      material.opacity = logged ? look.logged.opacity : 1;
      material.needsUpdate = true;
    }
    if (logged) tagMaterial.emissiveIntensity = look.logged.tagGlow;
  }

  interactions.add({
    id: feature.name,
    kind: 'lostProperty',
    label: item.name,
    verb: pickup.verb,
    cost: 0,
    priceLabel: pickup.priceLabel,
    quiet: true, // not a purchase: no till sound, no 'purchase' event
    holdSeconds: pickup.holdSeconds,
    position: prompt,
    available: () => map.zones[feature.zone].open && !state.over && !log.found(item.id),
    get blocked() { return log.blocked; },
    use() {
      if (!log.pickUp(item.id)) return;
      sound?.play(pickup.sound);
      showLogged(true);
    },
  });

  showLogged(log.found(item.id));
  return {
    item,
    group,
    prompt,
    update(dt) {
      const logged = log.found(item.id);
      showLogged(logged); // (the debug shortcut, or another tab, may have changed it)
      if (logged) return;
      clock += dt;
      const tag = look.tag;
      tagMaterial.emissiveIntensity = tag.pulseMin + (tag.pulseMax - tag.pulseMin) * (0.5 + 0.5 * Math.sin(clock * tag.pulseRate));
      // The cue: only while its area is open, you are on its floor and close, and the run is live.
      cueIn -= dt;
      if (cueIn > 0) return;
      cueIn = cue.everySeconds;
      if (state.over || !map.zones[feature.zone].open) return;
      const p = player.position;
      if (Math.abs(p.y - feature.position.y) > cue.levelTolerance) return;
      const distance = Math.hypot(p.x - feature.position.x, p.z - feature.position.z);
      if (distance > cue.radius) return;
      sound?.play(item.cue, { volume: cue.minVolume + (cue.maxVolume - cue.minVolume) * (1 - distance / cue.radius) });
    },
  };
}
