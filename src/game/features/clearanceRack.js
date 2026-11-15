import * as THREE from 'three';
import { workshopBuilds, workshopModOf } from '../../config/workshop.js';
import { makeClearanceSticker } from './clearanceSticker.js';

export function createClearanceRack({ gun, zombies, effects, sound }) {
  const cfg = workshopBuilds.clearanceRack;
  const tags = new Map();
  const up = new THREE.Vector3(0, 1, 0), point = new THREE.Vector3();
  let owner = null, geometry = null, material = null;

  function untag(zombie) {
    tags.get(zombie).removeFromParent();
    tags.delete(zombie);
    if (owner) owner.clearanceTagCount = tags.size;
    if (!tags.size) {
      geometry.dispose(); material.map.dispose(); material.dispose();
      geometry = material = null;
    }
  }

  function reset() {
    for (const zombie of tags.keys()) untag(zombie);
    owner = null;
  }

  function mark(zombie) {
    if (tags.has(zombie)) return;
    if (tags.size === cfg.maxTags) untag(tags.keys().next().value);
    if (!geometry) {
      geometry = new THREE.PlaneGeometry(.34, .17);
      material = new THREE.MeshBasicMaterial({
        map: makeClearanceSticker(), alphaTest: .45, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2,
      });
    }
    const stickers = new THREE.Group();
    stickers.name = 'clearanceSticker';
    for (const side of [-1, 1]) {
      const sticker = new THREE.Mesh(geometry, material);
      sticker.position.set(.025, zombie.type.hitbox.bodyTop * .79, side * .27);
      sticker.rotation.set(0, side === -1 ? Math.PI : 0, side * .14);
      stickers.add(sticker);
    }
    zombie.model.root.add(stickers);
    tags.set(zombie, stickers);
    owner.clearanceTagCount = tags.size;
  }

  return {
    // A body shot tags; a headshot on a tagged zombie, or any shot that KILLS one, pops every tag (docs/balance-review.md, G11: an average
    // player rarely lands a headshot with an automatic, so a headshot-only pop hardly ever paid).
    hit({ hit, headshot, killed, weapon, baseDamage }, weaponId) {
      const zombie = hit.target;
      if (!zombies.zombies.includes(zombie)) return;
      if (owner !== weapon) { reset(); owner = weapon; }
      const pops = tags.has(zombie) && (headshot || killed);
      if (!headshot && !pops) {
        if (zombie.isAlive) mark(zombie);
        return;
      }
      if (!pops) return;
      // Snapshot first: a kill listener can also change the set of live zombies.
      const marked = [...tags.keys()];
      for (const target of marked) untag(target);
      sound?.play('clearanceStamp');
      for (const target of marked) {
        point.copy(target.position); point.y += target.type.hitbox.bodyTop * .79;
        effects.confetti(point, up, cfg.pop);
        if (target.isAlive) target.takeHit({ damage: baseDamage * cfg.damageMultiplier, part: 'body', source: 'clearanceRack', weaponId });
      }
    },
    update() {
      if (owner && (gun.weaponFor(cfg.weapon) !== owner || workshopModOf(gun.modsFor(cfg.weapon)) !== 'clearanceRack')) {
        reset();
      }
      for (const zombie of tags.keys()) if (!zombie.isAlive || !zombies.zombies.includes(zombie)) untag(zombie);
    },
    reset,
  };
}
