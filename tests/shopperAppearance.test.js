import test from 'node:test';
import assert from 'node:assert/strict';
import { shoppers } from '../src/config/shoppers.js';
import { chooseShopperAppearance } from '../src/zombies/shopperAppearance.js';
import { seededRandom } from '../src/world/textures.js';
import * as THREE from 'three';
import { createZombieModel } from '../src/zombies/zombieModel.js';
import { Zombie } from '../src/zombies/zombie.js';
import { zombieTypes } from '../src/config/zombies.js';

test('Shopper wardrobe mixes coordinated profiles with broad variety and mostly no accessory', () => {
  const random = seededRandom(81);
  const seen = { profile: new Set(), top: new Set(), bottom: new Set(), hair: new Set(), accessory: new Set(), wear: new Set() };
  let plainAccessory = 0;
  for (let i = 0; i < 3000; i++) {
    const look = chooseShopperAppearance(random);
    const profile = shoppers.profiles.find((item) => item.id === look.profile);
    assert.ok(profile);
    assert.ok(profile.palettes.includes(look.palette));
    assert.ok(profile.tops.includes(look.top));
    assert.ok(profile.bottoms.includes(look.bottom));
    assert.ok(profile.accessories.includes(look.accessory));
    assert.ok(profile.patterns.includes(look.pattern));
    for (const key of Object.keys(seen)) seen[key].add(look[key]);
    if (look.accessory === 'none') plainAccessory++;
  }
  assert.equal(seen.profile.size, shoppers.profiles.length);
  assert.equal(seen.top.size, Object.keys(shoppers.tops).length);
  assert.equal(seen.bottom.size, 3);
  assert.equal(seen.hair.size, Object.keys(shoppers.hair).length);
  assert.equal(seen.accessory.size, Object.keys(shoppers.accessories).length);
  assert.equal(seen.wear.size, shoppers.wearWeights.length);
  assert.ok(plainAccessory > 1500 && plainAccessory < 2700, `${plainAccessory}/3000 without accessories`);
});

test('appearance selection is repeatable with a seed and accepts both ends of the random range', () => {
  const a = seededRandom(105);
  const b = seededRandom(105);
  for (let i = 0; i < 50; i++) assert.deepEqual(chooseShopperAppearance(a), chooseShopperAppearance(b));
  for (const value of [0, 1 - Number.EPSILON]) {
    const look = chooseShopperAppearance(() => value);
    assert.ok(look.palette && look.build && look.hair && look.accessory);
  }
});

test('decorative wardrobe parts have valid finite dimensions and references', () => {
  for (const group of [shoppers.tops, shoppers.patterns, shoppers.hair, shoppers.accessories]) {
    for (const value of Object.values(group)) {
      const parts = Array.isArray(value) ? value : value.parts ?? Object.values(value).filter(Array.isArray).flat();
      for (const part of parts) {
        assert.equal(part.size.length, 3);
        assert.ok(part.size.every((v) => Number.isFinite(v) && v > 0));
        assert.ok(part.position.every(Number.isFinite));
        assert.ok(Number.isFinite(part.rz));
      }
    }
  }
  for (const build of shoppers.builds) assert.ok(build.width * 0.46 < 0.52, 'torso stays within body hitbox width');
});

function posedZombie(type, state = 'chasing') {
  return { type, state, position: new THREE.Vector3(), prevPosition: new THREE.Vector3(),
    yaw: 0, prevYaw: 0, horizontalSpeed: type.speed, speed: type.speed,
    stateTime: 0.2, windupSeconds: 0.35, attackCooldown: 0, windedTimer: 0, flinchTimer: 0 };
}

test('every clothing/hair/accessory/condition builds valid geometry, follows the skeleton, and stays within a mesh budget', () => {
  const configs = [
    ...Object.keys(shoppers.tops).map((top) => ({ top })),
    ...['trousers', 'shorts', 'skirt'].map((bottom) => ({ bottom })),
    ...Object.keys(shoppers.hair).map((hair) => ({ hair })),
    ...Object.keys(shoppers.accessories).map((accessory) => ({ accessory })),
    ...shoppers.wearWeights.map(({ id: wear }) => ({ wear })),
    ...shoppers.builds.map((build) => ({ build })),
  ];
  const type = zombieTypes.shopper;
  for (const [i, overrides] of configs.entries()) {
    const look = { ...chooseShopperAppearance(seededRandom(i + 1)), ...overrides };
    const model = createZombieModel(type, { random: seededRandom(i + 2), appearance: look });
    let meshes = 0;
    const materialSet = new Set();
    model.root.traverse((node) => {
      if (!node.isMesh) return;
      meshes++;
      materialSet.add(node.material);
      assert.ok([...node.geometry.attributes.position.array].every(Number.isFinite));
      assert.ok([...node.geometry.attributes.normal.array].every(Number.isFinite));
    });
    assert.ok(meshes <= 30, `${JSON.stringify(overrides)} uses ${meshes} meshes after batching`);
    assert.ok(materialSet.size <= 10, 'reuse colors within each zombie');
    model.root.updateMatrixWorld(true);
    const head = model.root.getObjectByName('head');
    assert.ok(head);
    assert.ok(Math.abs(head.getWorldPosition(new THREE.Vector3()).y - 1.42) < 1e-6, 'head anchor never moves with wardrobe/build');
    for (const state of ['spawning', 'chasing', 'windup', 'swing', 'dead']) {
      const zombie = posedZombie(type, state);
      model.update(1 / 60, zombie, 1);
      model.root.updateMatrixWorld(true);
      model.root.traverse((node) => assert.ok(node.matrixWorld.elements.every(Number.isFinite), state));
    }
    assert.deepEqual(model.root.userData.appearance.top, look.top, 'appearance persists across animation/death');
    model.dispose();
  }
});

test('hit flash is isolated per zombie and disposal frees only owned materials and merged geometry', () => {
  const a = createZombieModel(zombieTypes.shopper, { random: seededRandom(5) });
  const b = createZombieModel(zombieTypes.shopper, { random: seededRandom(5) });
  const materialOf = (model) => { const out = new Set(); model.root.traverse((node) => { if (node.isMesh) out.add(node.material); }); return out; };
  const aMaterials = materialOf(a);
  const bMaterials = materialOf(b);
  for (const material of aMaterials) assert.ok(!bMaterials.has(material), 'never share emissive hit-flash materials across zombies');
  a.update(1 / 60, { ...posedZombie(zombieTypes.shopper), flinchTimer: zombieTypes.shopper.flinchSeconds }, 1);
  assert.ok([...aMaterials].every((m) => m.emissive.r > 0));
  assert.ok([...bMaterials].every((m) => m.emissive.r === 0));
  let freedMaterials = 0;
  let freedMerged = 0;
  let sharedDisposed = false;
  for (const material of aMaterials) material.addEventListener('dispose', () => freedMaterials++);
  const bGeometry = new Set();
  b.root.traverse((node) => { if (node.isMesh) bGeometry.add(node.geometry); });
  a.root.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry.addEventListener('dispose', () => { if (bGeometry.has(node.geometry)) sharedDisposed = true; else freedMerged++; });
  });
  a.dispose();
  assert.equal(freedMaterials, aMaterials.size);
  assert.ok(freedMerged > 0);
  assert.equal(sharedDisposed, false, 'shared box geometry remains usable by other zombies');
  b.dispose();
});

test('Shopper hitboxes/stats stay fixed across appearance rolls; Mall Walkers keep their tracksuit and dimensions', () => {
  const type = zombieTypes.shopper;
  for (let i = 0; i < 12; i++) {
    const z = new Zombie({ type, position: new THREE.Vector3(), yaw: 0, health: 150, speed: type.speed, round: 1 });
    assert.equal(z.health, 150);
    assert.equal(z.type.attack.damage, 40);
    assert.equal(z.type.radius, type.radius);
    assert.equal(z.type.height, type.height);
    // Spawning hitboxes start underground; use the normal chasing state for the comparison.
    z.setState('chasing');
    z.updateHitboxes();
    const head = z.hitboxes.find((box) => box.part === 'head').box;
    assert.equal(head.min.y, type.hitbox.headBottom);
    assert.equal(head.max.y, type.hitbox.headTop);
    assert.equal(head.max.x, type.hitbox.headHalfSize);
    z.model.dispose();
  }
  const walker = createZombieModel(zombieTypes.mallWalker, { random: seededRandom(5) });
  assert.equal(walker.root.userData.appearance, undefined);
  assert.equal(walker.root.children[0].scale.x, zombieTypes.mallWalker.modelScale.width);
  walker.update(1 / 60, { ...posedZombie(zombieTypes.mallWalker), windedTimer: 1 }, 1);
  assert.ok(walker.root.children[0].children.some((node) => node.name === 'upperBody'));
  walker.dispose();
});
