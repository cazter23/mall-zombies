import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDecorKit, DECOR_KINDS, DECOR_MATERIALS } from '../src/world/decor.js';
import { scatter, DENSITY_TIERS } from '../src/world/scatter.js';
import { decor } from '../src/config/decor.js';

const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

// A 20 x 12 m room: floor slab (only part of the area), a counter, a pillar, a wall, a high beam overhead.
function room() {
  const floor = box(-10, -0.2, -6, 8, 0, 6); // the area runs to x = 10: the last 2 m has no floor
  const counter = box(-2, 0, -1, 2, 1.1, 0.5);
  const pillar = box(4, 0, 2, 4.6, 4, 2.6);
  const wall = box(-10, 0, 5.8, 10, 4, 6.2);
  const beam = box(-8, 3, -6, -7, 3.4, 6); // overhead: clutter may go underneath
  const colliders = [floor, counter, pillar, wall, beam];
  return {
    colliders, floor, obstacles: [counter, pillar, wall],
    area: { minX: -10, maxX: 10, minZ: -6, maxZ: 6, y: 0 },
    keepClear: [{ minX: -10, maxX: 10, minZ: 2.5, maxZ: 3.5 }, { minX: -6, maxX: -4, minZ: -6, maxZ: 0 }],
  };
}

function trianglesOf(mesh, fn) {
  const position = mesh.geometry.attributes.position, v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const count = mesh.geometry.drawRange.count === Infinity ? position.count : Math.min(position.count, mesh.geometry.drawRange.count);
  for (let i = 0; i < count; i += 3) {
    for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(position, i + k);
    fn(v);
  }
}

test('every decor model and variant builds valid, budgeted, floor-standing geometry', () => {
  const kit = createDecorKit();
  assert.ok(DECOR_KINDS.length >= 15);
  for (const kind of DECOR_KINDS) {
    assert.ok(decor.kinds[kind], `${kind} has config`);
    for (let variant = 0; variant < kit.variantsOf(kind); variant++) {
      const model = kit.model(kind, variant), label = `${kind}:${variant}`;
      assert.equal(kit.model(kind, variant), model, `${label}: cached`);
      assert.ok(model.triangles > 0 && model.triangles <= decor.triangleBudget, `${label}: ${model.triangles} triangles`);
      assert.ok(model.radius > 0 && model.radius < 1.5, `${label}: footprint ${model.radius}`);
      assert.ok(model.parts.length >= 1 && model.parts.length <= DECOR_MATERIALS.length, `${label}: grouped by material`);
      assert.equal(new Set(model.parts.map((p) => p.material)).size, model.parts.length, `${label}: one geometry per material`);
      for (const { material, geometry } of model.parts) {
        assert.ok(DECOR_MATERIALS.includes(material), `${label}: known material ${material}`);
        const { position, normal, color } = geometry.attributes;
        assert.equal(geometry.index, null);
        assert.equal(position.count % 3, 0);
        assert.equal(normal.count, position.count); assert.equal(color.count, position.count);
        for (const array of [position.array, normal.array, color.array]) assert.ok(array.every(Number.isFinite), `${label}: finite`);
        for (let i = 0; i < position.count; i++) {
          const y = position.getY(i);
          assert.ok(y >= -1e-6, `${label}: nothing below the floor (${y})`);
          if (material === 'decal') assert.ok(y < 0.01, `${label}: decals lie flat`);
          assert.ok(Math.hypot(position.getX(i), position.getZ(i)) <= model.radius + 1e-6, `${label}: within its radius`);
        }
      }
    }
  }
  assert.throws(() => kit.model('mysteryBox'), /Unknown decor kind/);
  assert.throws(() => kit.model('toString'), /Unknown decor kind/);
  assert.throws(() => kit.model('receipts', 99), /no variant/);
  kit.dispose();
});

test('scatter is deterministic per seed and different seeds differ', () => {
  const kit = createDecorKit(), r = room();
  const make = (seed) => scatter({ kit, area: r.area, colliders: r.colliders, keepClear: r.keepClear, seed });
  const a = make(42), b = make(42), c = make(43);
  assert.ok(a.placements.length > 10);
  assert.deepEqual(a.placements, b.placements);
  assert.deepEqual(a.meshes.map((m) => [...m.geometry.attributes.position.array]), b.meshes.map((m) => [...m.geometry.attributes.position.array]));
  assert.notDeepEqual(a.placements, c.placements);
  [a, b, c].forEach((s) => s.dispose()); kit.dispose();
});

test('scatter keeps clear of keepClear rects and collider footprints and stays on the floor', () => {
  const kit = createDecorKit(), r = room();
  for (const seed of [1, 7, 99, 2024]) {
    const s = scatter({ kit, area: r.area, colliders: r.colliders, keepClear: r.keepClear, seed, perSquareMeter: 0.3 });
    assert.ok(s.placements.length > 20, `seed ${seed}: placed ${s.placements.length}`);
    assert.ok(s.placements.some((p) => p.x > -8.5 && p.x < -6.5), 'the high beam does not block the floor under it');
    for (const p of s.placements) {
      const rect = { minX: p.x - p.radius, maxX: p.x + p.radius, minZ: p.z - p.radius, maxZ: p.z + p.radius };
      assert.ok(rect.maxX <= r.floor.max.x && rect.minX >= r.floor.min.x && rect.minZ >= r.floor.min.z && rect.maxZ <= r.floor.max.z,
        `${p.kind} at ${p.x.toFixed(2)}, ${p.z.toFixed(2)} is on the floor`);
    }
    // Check the real triangles, not just the placement circles.
    const protectedRects = [...r.keepClear, ...r.obstacles.map((b) => ({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z }))];
    for (const mesh of s.meshes) {
      trianglesOf(mesh, (tri) => {
        for (const v of tri) {
          assert.ok(v.x >= r.floor.min.x - 1e-6 && v.x <= r.floor.max.x + 1e-6 && v.z >= r.floor.min.z - 1e-6 && v.z <= r.floor.max.z + 1e-6,
            `${mesh.name}: vertex off the floor at ${v.x}, ${v.z}`);
          assert.ok(v.y >= -1e-6, `${mesh.name}: below the floor`);
          for (const rect of protectedRects) {
            assert.ok(!(v.x > rect.minX && v.x < rect.maxX && v.z > rect.minZ && v.z < rect.maxZ), `${mesh.name}: vertex inside a protected rect at ${v.x}, ${v.z}`);
          }
        }
      });
    }
    s.dispose();
  }
  kit.dispose();
});

test('scatter on an upper floor uses that floor height, and explicit floors work without colliders', () => {
  const kit = createDecorKit();
  const slab = box(0, 6.0, 0, 6, 6.3, 6), ground = box(-20, -0.2, -20, 20, 0, 20);
  const s = scatter({ kit, area: { minX: -2, maxX: 8, minZ: -2, maxZ: 8, y: 6.3 }, colliders: [ground, slab], seed: 5, perSquareMeter: 0.3 });
  assert.ok(s.placements.length > 3);
  for (const p of s.placements) assert.ok(p.y === 6.3 && p.x - p.radius >= 0 && p.x + p.radius <= 6 && p.z - p.radius >= 0 && p.z + p.radius <= 6);
  const f = scatter({ kit, area: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, floors: [{ minX: 0, maxX: 5, minZ: 0, maxZ: 10 }], seed: 5 });
  for (const p of f.placements) assert.ok(p.x + p.radius <= 5);
  s.dispose(); f.dispose(); kit.dispose();
});

test("'some' is a fixed subset of 'full': changing density never moves anything; 'none' hides all", () => {
  const kit = createDecorKit(), r = room();
  const s = scatter({ kit, area: r.area, colliders: r.colliders, keepClear: r.keepClear, seed: 11, density: 'some' });
  const full = scatter({ kit, area: r.area, colliders: r.colliders, keepClear: r.keepClear, seed: 11, density: 'full' });
  assert.deepEqual(s.placements, full.placements, 'the tier picks nothing new');
  const some = s.placements.filter((p) => p.tier === 'some');
  assert.equal(some.length, Math.round(s.placements.length * decor.scatter.someFraction));
  assert.deepEqual(s.placements.slice(0, some.length), some, "'some' items come first");
  assert.equal(s.density, 'some');
  const before = s.meshes.map((m) => [m.geometry, [...m.geometry.attributes.position.array]]);
  const counted = () => s.meshes.reduce((sum, m) => sum + (m.visible ? m.geometry.drawRange.count : 0), 0);
  const someVertices = counted();
  s.setDensity('full');
  const fullVertices = counted();
  assert.ok(someVertices > 0 && someVertices < fullVertices);
  assert.equal(fullVertices, s.meshes.reduce((sum, m) => sum + m.geometry.attributes.position.count, 0));
  s.setDensity('none');
  assert.ok(s.meshes.every((m) => !m.visible && m.geometry.drawRange.count === 0), "'none' hides everything");
  assert.equal(s.drawCalls, 0);
  s.setDensity('some');
  assert.equal(counted(), someVertices);
  s.meshes.forEach((m, i) => { assert.equal(m.geometry, before[i][0]); assert.deepEqual([...m.geometry.attributes.position.array], before[i][1]); });
  assert.throws(() => s.setDensity('lots'), /Unknown decor density/);
  assert.deepEqual(DENSITY_TIERS, ['none', 'some', 'full']);
  const none = scatter({ kit, area: r.area, colliders: r.colliders, seed: 11, density: 'none' });
  assert.ok(none.meshes.every((m) => !m.visible));
  [s, full, none].forEach((x) => x.dispose()); kit.dispose();
});

test('a whole room of clutter batches into one mesh per material (per chunk with distance culling)', () => {
  const kit = createDecorKit(), r = room();
  const s = scatter({ kit, area: r.area, colliders: r.colliders, keepClear: r.keepClear, seed: 3, perSquareMeter: 0.3 });
  const materials = new Set(s.meshes.map((m) => m.userData.decor.material));
  assert.equal(s.meshes.length, materials.size, 'one mesh per material');
  assert.ok(s.meshes.length <= DECOR_MATERIALS.length, `${s.meshes.length} draw calls`);
  for (const mesh of s.meshes) assert.equal(mesh.material, kit.materials[mesh.userData.decor.material], 'shares the kit material');
  const kindsUsed = new Set(s.placements.map((p) => p.kind));
  assert.ok(kindsUsed.size >= 8, `variety: ${kindsUsed.size} kinds`);

  const chunked = scatter({ kit, area: r.area, colliders: r.colliders, keepClear: r.keepClear, seed: 3, perSquareMeter: 0.3, maxDistance: 6 });
  assert.deepEqual(chunked.placements, s.placements, 'distance culling does not change placement');
  const chunks = Math.ceil(20 / decor.scatter.chunkSize) * Math.ceil(12 / decor.scatter.chunkSize);
  for (const material of materials) {
    assert.ok(chunked.meshes.filter((m) => m.userData.decor.material === material).length <= chunks);
  }
  chunked.update({ position: new THREE.Vector3(500, 1.7, 500) });
  assert.equal(chunked.drawCalls, 0, 'far away: everything hidden');
  chunked.update({ position: new THREE.Vector3(-9, 1.7, -5) });
  assert.ok(chunked.drawCalls > 0 && chunked.drawCalls < chunked.meshes.length, 'near one corner: only near chunks');
  chunked.setDensity('none'); chunked.setDensity('full');
  assert.ok(chunked.drawCalls < chunked.meshes.length, 'density changes keep far chunks hidden');
  chunked.update({ position: new THREE.Vector3(0, 1.7, 0) });
  s.update({ position: new THREE.Vector3(500, 0, 500) });
  assert.equal(s.drawCalls, s.meshes.length, 'no maxDistance: update does nothing');
  [s, chunked].forEach((x) => x.dispose()); kit.dispose();
});

test('scatter adds no colliders and dispose frees everything', () => {
  const kit = createDecorKit(), r = room();
  const colliders = [...r.colliders], snapshot = colliders.map((b) => b.clone());
  const parent = new THREE.Group();
  const s = scatter({ kit, area: r.area, colliders, keepClear: r.keepClear, seed: 9, parent });
  assert.equal(colliders.length, snapshot.length);
  colliders.forEach((b, i) => assert.ok(b.equals(snapshot[i]), 'colliders untouched'));
  assert.equal(s.group.parent, parent);
  let freed = 0;
  const geometries = s.meshes.map((m) => m.geometry);
  geometries.forEach((g) => g.addEventListener('dispose', () => freed++));
  s.dispose();
  assert.equal(freed, geometries.length, 'every merged geometry freed');
  assert.equal(s.group.parent, null); assert.equal(s.group.children.length, 0); assert.equal(s.meshes.length, 0);
  assert.equal(colliders.length, snapshot.length);

  let kitFreed = 0;
  Object.values(kit.materials).forEach((m) => m.addEventListener('dispose', () => kitFreed++));
  const template = kit.model('receipts', 0).parts[0].geometry;
  template.addEventListener('dispose', () => kitFreed++);
  kit.dispose();
  assert.equal(kitFreed, DECOR_MATERIALS.length + 1, 'the kit frees its materials and templates');
});
