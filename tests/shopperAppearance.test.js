// Shopper looks (config/shoppers.js, zombies/shopperAppearance.js, shopperModel.js, shopperBake.js): every archetype and
// every piece of it turns up, the same seed is the same Shopper, a Shopper is one material and 8 draw calls, the shared
// baked geometry is counted and freed (never by another zombie's death), and nothing combat reads moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shoppers, colors } from '../src/config/shoppers.js';
import { chooseShopperAppearance, appearanceForSeed, lookRandom } from '../src/zombies/shopperAppearance.js';
import { bakedGeometryStats } from '../src/zombies/shopperBake.js';
import { seededRandom } from '../src/world/textures.js';
import { createZombieModel, buildClerkFigure, ANATOMY_GEOMETRIES } from '../src/zombies/zombieModel.js';
import { applyZombieRim } from '../src/zombies/zombieRim.js';
import { batchStatic } from '../src/world/staticBatch.js';
import { Zombie } from '../src/zombies/zombie.js';
import { zombieTypes } from '../src/config/zombies.js';

const SLOTS = [['tops', 'top'], ['bottoms', 'bottom'], ['shoes', 'shoes'], ['patterns', 'pattern'], ['builds', 'build']];
const WEIGHTED = [['hair', 'hair'], ['headwear', 'headwear'], ['eyewear', 'eyewear'], ['held', 'held'], ['extras', 'extra']];

function meshesOf(model) {
  const list = [];
  model.root.traverse((node) => { if (node.isMesh) list.push(node); });
  return list;
}

function posedZombie(type, state = 'chasing') {
  return { type, state, position: new THREE.Vector3(), prevPosition: new THREE.Vector3(),
    yaw: 0, prevYaw: 0, horizontalSpeed: type.speed, speed: type.speed,
    stateTime: 0.2, windupSeconds: 0.35, attackCooldown: 0, windedTimer: 0, flinchTimer: 0 };
}

test('the same seed is the same Shopper, and over enough spawns every archetype and every piece of each turns up', () => {
  for (let seed = 1; seed < 60; seed++) assert.deepEqual(appearanceForSeed(seed), appearanceForSeed(seed));
  assert.notDeepEqual(appearanceForSeed(1), appearanceForSeed(2), 'neighbouring seeds are different Shoppers');
  const seen = new Map(shoppers.archetypes.map((a) => [a.id, { count: 0 }]));
  const N = 6000;
  for (let seed = 1; seed <= N; seed++) {
    const look = appearanceForSeed(seed);
    const archetype = shoppers.archetypes.find((a) => a.id === look.archetype);
    assert.ok(archetype, look.archetype);
    const s = seen.get(look.archetype);
    s.count++;
    for (const [list, key] of SLOTS) {
      assert.ok(archetype[list].includes(look[key]), `${look.archetype} ${key} ${look[key]}`);
      (s[key] ??= new Set()).add(look[key]);
    }
    for (const [list, key] of WEIGHTED) {
      if (key === 'headwear' && shoppers.extras[look.extra].head) assert.equal(look.headwear, 'none', 'headphones mean no hat');
      else assert.ok(archetype[list].some((w) => w.id === look[key]), `${look.archetype} ${key} ${look[key]}`);
      (s[key] ??= new Set()).add(look[key]);
    }
    assert.ok(archetype.palettes.some((p) => p.id === look.palette.id));
  }
  const total = shoppers.archetypes.reduce((sum, a) => sum + a.weight, 0);
  for (const archetype of shoppers.archetypes) {
    const s = seen.get(archetype.id);
    const expected = (N * archetype.weight) / total;
    assert.ok(Math.abs(s.count - expected) < expected * 0.25, `${archetype.id}: ${s.count} of ${N}, expected ~${Math.round(expected)}`);
    for (const [list, key] of SLOTS) assert.equal(s[key].size, archetype[list].length, `${archetype.id} wears every ${key}`);
    for (const [list, key] of WEIGHTED) {
      for (const { id } of archetype[list]) assert.ok(s[key].has(id), `${archetype.id} never rolled ${key} ${id}`);
    }
  }
});

test('a look accepts both ends of the random range, and the seeded random stays in [0, 1)', () => {
  for (const value of [0, 1 - Number.EPSILON]) {
    const look = chooseShopperAppearance(() => value);
    assert.ok(look.palette && look.build && look.hair && look.held && look.extra);
  }
  for (const seed of [0, 1, -5, 2147483647, 123456789]) {
    const random = lookRandom(seed);
    for (let i = 0; i < 200; i++) { const v = random(); assert.ok(v >= 0 && v < 1); }
  }
});

test('every colour comes from the curated palette, and every part is well formed', () => {
  const ROLES = new Set(['top', 'accent', 'inner', 'pants', 'shoes', 'skin', 'hair', 'eyes', 'item', 'torso']);
  const GEOS = new Set([undefined, 'box', 'jaw', 'cranium', 'limbY', 'limbZ', 'torso', 'shoe', 'hand']);
  for (const archetype of shoppers.archetypes) {
    for (const p of archetype.palettes) for (const slot of ['top', 'accent', 'inner', 'pants', 'shoes']) assert.ok(p[slot] in colors, `${p.id}.${slot}`);
    for (const name of archetype.hairColors) assert.ok(name in colors, name);
    for (const top of archetype.tops) assert.ok(shoppers.tops[top], top);
    for (const bottom of archetype.bottoms) assert.ok(shoppers.bottoms[bottom], bottom);
    for (const shoe of archetype.shoes) assert.ok(shoppers.shoes[shoe], shoe);
    for (const { id } of archetype.hair) assert.ok(shoppers.hair[id], id);
    for (const { id } of archetype.headwear) assert.ok(shoppers.headwear[id], id);
    for (const { id } of archetype.eyewear) assert.ok(shoppers.eyewear[id], id);
    for (const { id } of archetype.held) assert.ok(shoppers.held[id], id);
    for (const { id } of archetype.extras) assert.ok(shoppers.extras[id], id);
  }
  for (const list of Object.values(shoppers.itemColors)) for (const name of list) assert.ok(name in colors, name);
  const groups = [shoppers.tops, shoppers.bottoms, shoppers.shoes, shoppers.hair, shoppers.headwear, shoppers.eyewear,
    shoppers.held, shoppers.extras, shoppers.patterns, { stain: shoppers.stain }, { faces: shoppers.faceProfiles.flatMap((f) => f.parts) }];
  for (const group of groups) {
    for (const value of Object.values(group)) {
      const parts = Array.isArray(value) ? value : Object.values(value).filter(Array.isArray).flat();
      for (const part of parts) {
        assert.ok(ROLES.has(part.role) || part.role in colors, `unknown colour or role '${part.role}'`);
        assert.ok(GEOS.has(part.geo), part.geo);
        assert.equal(part.size.length, 3);
        assert.ok(part.size.every((v) => Number.isFinite(v) && v > 0));
        assert.ok(part.position.every(Number.isFinite));
        assert.ok(Number.isFinite(part.rz));
      }
    }
  }
  for (const build of Object.values(shoppers.builds)) assert.ok(build.width * 0.46 < 0.52, 'torso stays within body hitbox width');
});

test('Shoppers keep to their own silhouette: none of the other kinds\' signatures', () => {
  // The Shoplifter's dark hoodie and beanie, the Mall Walker's headband and wristbands are theirs alone.
  for (const forbidden of ['hoodie', 'beanie', 'headband', 'wristbands']) {
    for (const group of [shoppers.tops, shoppers.headwear, shoppers.extras, shoppers.held]) assert.equal(group[forbidden], undefined, forbidden);
  }
  // Hats have brims or folds (never a plain band round the head), and nothing towers far over the head hitbox.
  const headTop = zombieTypes.shopper.hitbox.headTop - 1.42; // (the neck sits at 1.42 m)
  for (const group of [shoppers.hair, shoppers.headwear, shoppers.eyewear]) {
    for (const parts of Object.values(group)) {
      for (const part of parts) assert.ok(part.position[1] + part.size[1] / 2 < headTop + 0.07, `${part.role} part too tall`);
    }
  }
});

test('every piece builds valid geometry, follows the skeleton, and a Shopper is one material and 8 draw calls', () => {
  const type = zombieTypes.shopper;
  const overrides = [];
  for (const archetype of shoppers.archetypes) {
    for (const top of archetype.tops) overrides.push({ archetype: archetype.id, top });
    for (const bottom of archetype.bottoms) overrides.push({ archetype: archetype.id, bottom });
  }
  for (const key of ['shoes', 'hair', 'headwear', 'eyewear', 'held']) for (const id of Object.keys(shoppers[key])) overrides.push({ [key]: id });
  for (const extra of Object.keys(shoppers.extras)) overrides.push({ extra, headwear: 'none' });
  for (const { id: wear } of shoppers.wearWeights) overrides.push({ wear });
  for (const { id: face } of shoppers.faceProfiles) overrides.push({ face });
  for (const build of Object.keys(shoppers.builds)) overrides.push({ build });
  for (const [i, override] of overrides.entries()) {
    const look = { ...appearanceForSeed(i + 1), ...override };
    const model = createZombieModel(type, { seed: i + 1, appearance: look });
    const meshes = meshesOf(model);
    assert.equal(meshes.length, 8, `${JSON.stringify(override)}: one mesh per moving bone`);
    assert.equal(new Set(meshes.map((m) => m.material)).size, 1, 'one material');
    for (const mesh of meshes) {
      assert.ok(mesh.material.isMeshStandardMaterial && mesh.material.vertexColors);
      const { position, normal, color } = mesh.geometry.attributes;
      assert.ok(position && normal && color, 'positions, normals and baked colours');
      assert.ok([...position.array].every(Number.isFinite));
      assert.equal(color.count, position.count);
    }
    model.root.updateMatrixWorld(true);
    const head = model.root.getObjectByName('head');
    assert.ok(Math.abs(head.getWorldPosition(new THREE.Vector3()).y - 1.42) < 1e-6, 'head anchor never moves with the look');
    for (const name of ['leftLeg', 'rightLeg', 'upperBody', 'leftArm', 'rightArm']) assert.ok(model.root.getObjectByName(name), name);
    for (const state of ['spawning', 'chasing', 'windup', 'swing', 'dead']) {
      model.update(1 / 60, posedZombie(type, state), 1);
      model.root.updateMatrixWorld(true);
      model.root.traverse((node) => assert.ok(node.matrixWorld.elements.every(Number.isFinite), state));
    }
    for (const key of Object.keys(override)) assert.equal(model.root.userData.appearance[key], look[key], 'the summary says what it wears');
    assert.equal(model.hasBag, look.held === 'shoppingBag');
    model.dispose();
  }
  assert.deepEqual(bakedGeometryStats(), { entries: 0, refs: 0 });
});

test('the Cart Pusher wears the same looks behind a cart that keeps its own materials', () => {
  const model = createZombieModel(zombieTypes.cartPusher, { seed: 7 });
  assert.ok(model.root.userData.appearance.archetype);
  const materials = new Set(meshesOf(model).map((m) => m.material));
  assert.ok(materials.size > 1 && [...materials].filter((m) => m.vertexColors).length === 1, 'one Shopper material + the cart\'s');
  model.dispose();
  assert.deepEqual(bakedGeometryStats(), { entries: 0, refs: 0 });
});

test('hit flash, glow and the edge are per zombie; shared baked geometry is counted and only freed with its last Shopper', () => {
  const type = zombieTypes.shopper;
  const a = createZombieModel(type, { seed: 5 });
  const b = createZombieModel(type, { seed: 5 }); // the same look: shares every bone's geometry
  const c = createZombieModel(type, { seed: 6 });
  const geometries = (model) => new Set(meshesOf(model).map((m) => m.geometry));
  assert.deepEqual(geometries(a), geometries(b), 'the same look shares its geometry');
  const matA = meshesOf(a)[0].material, matB = meshesOf(b)[0].material;
  assert.notEqual(matA, matB, 'never share a material across zombies (hit flashes)');
  applyZombieRim(a.root, type);
  applyZombieRim(b.root, type);
  assert.ok(matA.userData.rim && matB.userData.rim, 'the edge shading reaches the vertex-coloured material');
  a.update(1 / 60, { ...posedZombie(type), flinchTimer: type.flinchSeconds }, 1);
  b.update(1 / 60, posedZombie(type), 1);
  assert.ok(matA.emissive.r > 0, 'the hit Shopper flashes');
  assert.equal(matB.emissive.r, 0, 'its twin does not');

  const before = bakedGeometryStats();
  let disposedShared = 0, materialDisposed = false;
  for (const g of geometries(b)) g.addEventListener('dispose', () => disposedShared++);
  matA.addEventListener('dispose', () => { materialDisposed = true; });
  a.dispose();
  assert.ok(materialDisposed, 'its own material goes with it');
  assert.equal(disposedShared, 0, 'geometry its twin still uses stays');
  assert.equal(bakedGeometryStats().refs, before.refs - 8);
  b.dispose();
  assert.equal(disposedShared, geometries(b).size - [...geometries(b)].filter((g) => geometries(c).has(g)).length,
    'freed with the last Shopper using it (unless the third one shares it)');
  c.dispose();
  assert.deepEqual(bakedGeometryStats(), { entries: 0, refs: 0 });
});

test('no leaks over many spawns and deaths, and a crowd reuses geometry', () => {
  const type = zombieTypes.shopper;
  const crowd = [];
  for (let seed = 1; seed <= 24; seed++) crowd.push(createZombieModel(type, { seed: seed * 7919 }));
  const stats = bakedGeometryStats();
  assert.equal(stats.refs, 24 * 8);
  assert.ok(stats.entries < stats.refs, `${stats.entries} geometries for ${stats.refs} bones: some are shared`);
  crowd.forEach((m) => m.dispose());
  for (let wave = 0; wave < 10; wave++) {
    const models = [];
    for (let i = 0; i < 40; i++) models.push(createZombieModel(type, { seed: wave * 1000 + i }));
    models.forEach((m) => { m.dispose(); m.dispose(); }); // (a second dispose is harmless)
  }
  assert.deepEqual(bakedGeometryStats(), { entries: 0, refs: 0 });
});

test('a Shopper\'s look never depends on Math.random, and hitboxes and stats stay fixed whatever it wears', () => {
  const type = zombieTypes.shopper;
  const real = Math.random;
  const build = (value) => { // (Three.js still uses Math.random for object ids: the look must not care)
    Math.random = () => value;
    try {
      const model = createZombieModel(type, { seed: 42 });
      const out = { look: model.root.userData.appearance, verts: meshesOf(model).map((m) => m.geometry.attributes.position.count) };
      model.dispose();
      return out;
    } finally { Math.random = real; }
  };
  assert.deepEqual(build(0.1), build(0.9));
  for (let i = 0; i < 12; i++) {
    const z = new Zombie({ type, position: new THREE.Vector3(), yaw: 0, health: 150, speed: type.speed, round: 1, lookSeed: i * 31 + 1 });
    assert.equal(z.health, 150);
    assert.equal(z.type.attack.damage, 40);
    z.setState('chasing');
    z.updateHitboxes();
    const head = z.hitboxes.find((box) => box.part === 'head').box;
    assert.equal(head.min.y, type.hitbox.headBottom);
    assert.equal(head.max.y, type.hitbox.headTop);
    assert.equal(head.max.x, type.hitbox.headHalfSize);
    z.model.dispose();
  }
});

test('the other kinds are untouched: Mall Walkers keep their tracksuit, Shoplifters their beanie, both with materials per colour', () => {
  const walker = createZombieModel(zombieTypes.mallWalker, { random: seededRandom(5) });
  assert.equal(walker.root.userData.appearance, undefined);
  assert.equal(walker.root.children[0].scale.x, zombieTypes.mallWalker.modelScale.width);
  walker.update(1 / 60, { ...posedZombie(zombieTypes.mallWalker), windedTimer: 1 }, 1);
  assert.ok(walker.root.children[0].children.some((node) => node.name === 'upperBody'));
  assert.ok(meshesOf(walker).every((m) => !m.material.vertexColors));
  walker.dispose();
  const thief = createZombieModel(zombieTypes.shoplifter, { random: seededRandom(9) });
  assert.equal(thief.root.userData.appearance, undefined);
  assert.equal(thief.hasBag, true);
  assert.ok(new Set(meshesOf(thief).map((m) => m.material)).size > 3);
  thief.dispose();
});

test('static shop clerks use the shared faceted builder, batch cleanly, and dispose without freeing live zombie geometry', () => {
  const group = new THREE.Group();
  const mats = new Map();
  const mat = (color) => {
    if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }));
    return mats.get(color);
  };
  let sharedDisposed = false;
  for (const geo of Object.values(ANATOMY_GEOMETRIES)) {
    geo.addEventListener('dispose', () => { sharedDisposed = true; });
  }
  const clerkMeshes = buildClerkFigure({ group, mat, x: 2, z: -3, rotationY: Math.PI, apron: 0xd62839, hair: 0x6b6b6b });
  assert.ok(clerkMeshes.length >= 4 && clerkMeshes.length <= 8);
  const clerkBounds = new THREE.Box3().setFromObject(group);
  assert.ok(clerkBounds.min.y >= -0.01 && clerkBounds.max.y > 1.95 && clerkBounds.max.y < 2.15, 'counter height proportions preserved');
  buildClerkFigure({ group, mat, x: 3, z: -3, rotationY: Math.PI, apron: 0x2d6a4f, hair: 0x6b6b6b });
  const { merged, batches } = batchStatic(group);
  assert.ok(merged > 0 && batches > 0, 'clerk meshes participate in static batching');
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  assert.equal(sharedDisposed, false, 'disposing map-owned clerk geometry never disposes shared zombie anatomy');
});

test('in the real game: the same seeded spawns are the same Shoppers, each spawn takes the same random numbers whatever it wears, and a cleared crowd frees its geometry', async () => {
  const { headlessGame } = await import('./helpers/headlessGame.js');
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  const real = Math.random;
  const crowd = (seed) => {
    Math.random = seededRandom(seed);
    try {
      const looks = [];
      for (let i = 0; i < 30; i++) looks.push(g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 12)).model.root.userData.appearance);
      return { looks, next: Math.random() };
    } finally { Math.random = real; }
  };
  for (const warm of [5, 6]) { crowd(warm); g.zombies.clear(); } // (the run's first Shopper fires its intro and the dust pool fills: get those out of the way)
  const a = crowd(77);
  assert.equal(bakedGeometryStats().refs, 30 * 8);
  g.zombies.clear();
  assert.deepEqual(bakedGeometryStats(), { entries: 0, refs: 0 }, 'clear() frees every shared Shopper geometry');
  const b = crowd(77);
  g.zombies.clear();
  assert.deepEqual(a, b, 'same seed, same Shoppers, and the game\'s random numbers end up in the same place');
  assert.ok(new Set(a.looks.map((l) => l.archetype)).size >= 5, 'a crowd of 30 is a mix');
  g.map.dispose();
});
