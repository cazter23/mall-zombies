// Zombie edge glow (zombies/zombieRim.js): every standard material of a zombie gets the rim once, in its kind's colour,
// sharing one shader program; glass and other see-through parts are left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyZombieRim, rimColorFor } from '../src/zombies/zombieRim.js';
import { look } from '../src/config/look.js';

test('each kind gets its colour: bosses, every mascot costume, mannequins, the rest by id or the default', () => {
  const c = look.zombieRim.colors;
  assert.equal(rimColorFor({ id: 'shopper' }), c.default);
  assert.equal(rimColorFor({ id: 'mallWalker' }), c.mallWalker);
  assert.equal(rimColorFor({ id: 'sirWaffles', mascot: {} }), c.mascot);
  assert.equal(rimColorFor({ id: 'mannequin', plastic: true }), c.mannequin);
  assert.equal(rimColorFor({ id: 'janitor', boss: true }), c.boss);
});

test('applied once per material, opaque standard materials only, one shared program', () => {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial();
  const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.4 });
  const basic = new THREE.MeshBasicMaterial();
  const box = new THREE.BoxGeometry();
  for (const m of [skin, skin, glass, basic]) root.add(new THREE.Mesh(box, m));
  applyZombieRim(root, { id: 'shopper' });
  applyZombieRim(root, { id: 'mallWalker' }); // (a second pass changes nothing)
  assert.ok(skin.userData.rim, 'skin has the rim');
  assert.equal(skin.userData.rim.rimColor.value.getHex(),
    new THREE.Color(look.zombieRim.colors.default).multiplyScalar(look.zombieRim.strength).getHex());
  assert.equal(glass.userData.rim, undefined);
  assert.equal(basic.userData.rim, undefined);
  assert.equal(skin.customProgramCacheKey(), 'zombieRim');
  const shader = { uniforms: {}, fragmentShader: '#include <common>\n#include <normal_fragment_maps>\n' };
  skin.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /totalEmissiveRadiance \+= rimColor/);
  assert.ok(shader.uniforms.rimColor && shader.uniforms.rimPower);
});
