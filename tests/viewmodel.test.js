import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { weapons, melee } from '../src/config/weapons.js';
import { createViewmodel } from '../src/weapons/viewmodel.js';
import { withAttachment } from '../src/weapons/upgrades.js';

const defs = Object.values(weapons);

// Drive the REAL player gun and viewmodel, with an idle twin to subtract breathing/reload motion.
// The camera is fixed so camera recoil cannot masquerade as gun-model recoil.
function measureKick(attachment, { renderBeforeShot = true, dry = false, remove = false } = {}) {
  const viewmodel = createViewmodel(defs, melee.boxCutter);
  const idle = createViewmodel(defs, melee.boxCutter);
  const t = headlessGame({ viewmodel });
  const { g } = t;
  t.tick(); g.zombies.clear(); g.rounds.update = () => {};
  g.gun.give(weapons.priceGun); t.tick(40);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  const render = (vm, seconds) => vm.update(seconds, camera, {
    weapon: g.gun.weapon, shownDef: g.gun.shownDef, aimAmount: 0, player: g.player,
  });
  render(viewmodel, dt); render(idle, dt);
  if (attachment) {
    g.gun.setMods('priceGun', withAttachment(weapons.priceGun, [], attachment));
    if (renderBeforeShot || remove) { render(viewmodel, 0); render(idle, 0); }
    if (remove) g.gun.setMods('priceGun', []);
  }
  if (dry) g.gun.weapon.magazine = 0;
  t.press('Mouse0'); // may be the same tick as a purchase, before any rendered frame
  assert.equal(g.gun.weapon.magazine, dry ? 0 : weapons.priceGun.magazineSize - 1);
  render(viewmodel, dt); render(idle, dt);
  return viewmodel.getMuzzleWorldPosition(new THREE.Vector3())
    .distanceTo(idle.getMuzzleWorldPosition(new THREE.Vector3()));
}

test('resolved attachments change visible recoil without changing weapon id', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const plain = measureKick(null);
  const grip = measureKick('gripTape');
  const wrist = measureKick('wristband');
  assert.ok(plain > 0, 'a shot actually moves the model');
  assert.ok(grip < plain * 0.9, `Grip Tape reduces visible kick: ${grip} vs ${plain}`);
  assert.ok(wrist > plain * 1.1, `Wristband increases visible kick: ${wrist} vs ${plain}`);
});

test('the first shot and dry click after fitting/removing an attachment use the current resolved recoil', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  for (const dry of [false, true]) {
    const options = { dry, renderBeforeShot: false };
    const plain = measureKick(null, options);
    assert.ok(plain > 0);
    assert.ok(measureKick('gripTape', options) < plain * 0.9, 'fit takes effect before the next render');
    assert.ok(Math.abs(measureKick('gripTape', { ...options, remove: true }) - plain) < 1e-9,
      'removing the grip restores normal recoil before the next render');
  }
});
