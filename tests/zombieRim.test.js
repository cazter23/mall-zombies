// Zombie edge glow (zombies/zombieRim.js): every standard material of a zombie gets the rim once, in its kind's colour,
// sharing one shader program; glass and other see-through parts are left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyZombieRim, rimColorFor, rimDaylightFor, rimShared, setRimDaylight } from '../src/zombies/zombieRim.js';
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
  const shader = { uniforms: {}, fragmentShader: '#include <common>\n#include <normal_fragment_maps>\n#include <dithering_fragment>\n' };
  skin.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /totalEmissiveRadiance \+= rimColor/);
  assert.match(shader.fragmentShader, /mix\(gl_FragColor\.rgb, edgeColor/, 'the dark edge is drawn last');
  assert.ok(shader.uniforms.rimColor && shader.uniforms.rimPower);
  assert.equal(shader.uniforms.rimDaylight, rimShared.rimDaylight, 'every material shares the one daylight value');
});

test('bright views get the dark edge, dim views the light rim, blended in between', () => {
  const [light, dark] = look.zombieRim.darkBelow;
  assert.equal(rimDaylightFor(1), 1);
  assert.equal(rimDaylightFor(dark), 1);
  assert.equal(rimDaylightFor(light), 0);
  assert.equal(rimDaylightFor(0.3), 0, 'a power cut is all light rim');
  const mid = rimDaylightFor((light + dark) / 2);
  assert.ok(mid > 0.4 && mid < 0.6);
  setRimDaylight(0.4);
  assert.equal(rimShared.rimDaylight.value, 0);
  setRimDaylight(1);
  assert.equal(rimShared.rimDaylight.value, 1);
});
