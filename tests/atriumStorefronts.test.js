import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { atriumDetails as cfg } from '../src/config/atrium.js';

test('every atrium shop has an exposed interior behind continuous sealed glazing on both floors', () => {
  const scene = new THREE.Scene(), { g } = headlessGame({ scene });
  try {
    scene.updateMatrixWorld(true);
    const barriers = g.colliders.filter(b => b.name === 'atrium_sealed_shop');
    assert.equal(barriers.length, cfg.storefronts.length);
    const walls = []; scene.traverse(m => { if (m.isMesh && /^atrium_wall_(north|west|east)$/.test(m.name)) walls.push(m); });
    const atlasMaterials = new Set();
    const area = g.map.cullAreas.find(a => a.id === 'atrium');
    const visibleBounds = new THREE.Box3(new THREE.Vector3(area.minX, area.minY, area.minZ), new THREE.Vector3(area.maxX, area.maxY, area.maxZ));
    for (const s of cfg.storefronts) {
      const shop = scene.getObjectByName(`display_${s.name}`);
      assert.ok(shop, s.name);
      assert.ok(visibleBounds.containsBox(new THREE.Box3().setFromObject(shop)), `${s.name}: interior belongs to atrium visibility`);
      const rear = shop.getObjectByName('shop_rear_wall'), pane = shop.getObjectByName('sealed_shop_glass');
      assert.ok(pane.position.z - rear.position.z > 2, `${s.name}: real depth`);
      assert.ok(shop.getObjectByName('shop_floor') && shop.getObjectByName('shop_ceiling'), `${s.name}: complete shell`);
      assert.ok(shop.getObjectByName('shop_closed') && shop.getObjectByName('door_lock'), `${s.name}: closed entrance`);
      atlasMaterials.add(shop.getObjectByName('shop_name').material);
      // Window edges and the apparent door are all sealed, including above normal jump height.
      for (const x of [-s.width / 2 + .12, 0, s.width / 2 - .48]) for (const y of [.15, 1.5, 2.95]) {
        const point = shop.localToWorld(new THREE.Vector3(x, y, .09));
        assert.ok(barriers.some(b => b.containsPoint(point)), `${s.name}: sealed at ${x}, ${y}`);
      }
      const origin = shop.localToWorld(new THREE.Vector3(0, 1.85, .55));
      const direction = new THREE.Vector3(0, 0, -1).transformDirection(shop.matrixWorld);
      const ray = new THREE.Raycaster(origin, direction, 0, 2);
      assert.equal(ray.intersectObjects(walls).length, 0, `${s.name}: masonry does not conceal the interior`);
      assert.equal(ray.intersectObject(shop, true)[0]?.object.name, 'sealed_shop_glass', `${s.name}: glass faces the arcade`);
    }
    assert.equal(atlasMaterials.size, 1, 'shop lettering shares one material for batching');
  } finally { g.map.dispose(); }
});
