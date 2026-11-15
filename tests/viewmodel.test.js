import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { weapons, melee } from '../src/config/weapons.js';
import { createViewmodel } from '../src/weapons/viewmodel.js';
import { withAttachment } from '../src/weapons/upgrades.js';
import { skins } from '../src/config/skins.js';
import { buildWeaponModel } from '../src/weapons/models/index.js';

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
  assert.ok(wrist > plain * 1.05, `Wristband increases visible kick: ${wrist} vs ${plain}`);
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

// Only the gun in hand is in the viewmodel scene. Every other model (and every skinned twin built on first use) waits
// detached: a hidden model is still walked by scene.updateMatrixWorld() and getMuzzleWorldPosition() every frame.
test('only the gun in hand is in the viewmodel scene, whatever was held before (skinned twins included)', () => {
  let skin = null;
  const viewmodel = createViewmodel(defs, melee.boxCutter, { skinFor: (id) => (id === 'stapleGun' ? skin : undefined) });
  const t = headlessGame({ viewmodel });
  const { g } = t;
  t.tick(); g.zombies.clear(); g.rounds.update = () => {};
  const camera = new THREE.PerspectiveCamera();
  const objects = () => {
    viewmodel.update(dt, camera, { weapon: g.gun.weapon, shownDef: g.gun.shownDef, aimAmount: 0, player: g.player });
    let n = 0; viewmodel.scene.traverse(() => n++);
    return n;
  };
  const muzzle = () => viewmodel.getMuzzleWorldPosition(new THREE.Vector3());
  const atStart = objects();
  const perGun = [];
  for (const def of defs) {
    g.gun.give(def); t.tick(60);
    assert.equal(g.gun.shownDef.id, def.id);
    perGun.push(objects());
    assert.ok(muzzle().distanceTo(camera.position) < 2, `${def.id}: the muzzle is on the gun in hand, in front of the camera`);
  }
  // (the fifteen bare models, counted apart from any viewmodel. One gun's scene also holds its hidden upgrade parts, the
  // box cutter arm and the lights, and is still far smaller: with every model attached it was three times this.)
  const all = defs.reduce((sum, def) => { let n = 0; buildWeaponModel(def).root.traverse(() => n++); return sum + n; }, 0);
  assert.ok(Math.max(...perGun) < all, `no gun's scene holds the other guns: largest ${Math.max(...perGun)}, all models ${all}`);

  // A skinned twin (built the first time it is held) replaces the default model in the scene: nothing piles up.
  g.resetRun(); t.tick();
  assert.equal(g.gun.shownDef.id, 'stapleGun');
  assert.equal(objects(), atStart, 'back on the first gun: the same scene as at the start');
  skin = skins.stapleGun[0].id;
  const skinned = objects();
  let housing = null; viewmodel.scene.traverseVisible((o) => { if (o.name === 'stapleHousing') housing ??= o; });
  assert.equal(housing.material.color.getHex(), skins.stapleGun[0].palette.body, 'the skinned twin is the one in hand');
  assert.ok(skinned < atStart * 1.5, `the skinned twin stands in for the default model: ${atStart} -> ${skinned}`);
  skin = null;
  assert.equal(objects(), atStart, 'the skin taken off: the scene is the start scene again');
});
