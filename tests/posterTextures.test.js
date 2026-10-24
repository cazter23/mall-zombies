// The corporate-cheer posters (world/posterTextures.js): every kind builds a texture, an unknown kind is an error, and
// the hallway hangs its posters proud of the wall (in front of the peach band) with the satire copy from config/look.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (stubs <canvas>)
import { makePosterTexture, POSTER_KINDS } from '../src/world/posterTextures.js';
import { look } from '../src/config/look.js';

test('every poster kind builds; unknown kinds throw', () => {
  for (const kind of POSTER_KINDS) assert.ok(makePosterTexture(kind, { text: 'TEST', title: 'TEST' }).isTexture, kind);
  assert.throws(() => makePosterTexture('toString'), /Unknown poster kind/);
});

test('the hallway hangs its satire posters on the walls, 3 cm proud, and the copy lives in config', async () => {
  const { buildMall, LAYOUT } = await import('../src/maps/mall/mall.js');
  const map = buildMall(new THREE.Scene(), []);
  const posters = [];
  map.group.traverse((o) => { if (o.name.startsWith('poster_')) posters.push(o); });
  assert.ok(posters.length >= 8, `${posters.length} posters`);
  const H = LAYOUT.hallway;
  for (const p of posters) {
    const gap = Math.min(Math.abs(p.position.z - H.maxZ), Math.abs(p.position.z - H.minZ));
    assert.ok(Math.abs(gap - 0.03) < 1e-6, `${p.name} is 3 cm off its wall`);
  }
  for (const line of Object.values(look.hallway.satire)) assert.ok(line.length, 'satire copy present');
  map.dispose();
});
