import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { feel } from '../src/config/feel.js';
import { wardrobeLook } from '../src/config/wardrobe.js';
import { weapons, melee } from '../src/config/weapons.js';
import { workshopBuilds, workshopStuffings, workshopHearts } from '../src/config/workshop.js';
import { createPlayerBody } from '../src/player/body.js';
import { connectWardrobeAppearance } from '../src/player/wardrobeAppearance.js';
import { createViewmodel } from '../src/weapons/viewmodel.js';
import { Weapon } from '../src/weapons/weapon.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { createEvents } from '../src/game/events.js';
import { menuDom } from './helpers/menuDom.js';

function scenario(t) {
  const viewmodel = createViewmodel(Object.values(weapons), melee.boxCutter);
  const game = headlessGame({ viewmodel, camera: new THREE.PerspectiveCamera(75, 4 / 3, .05, 200) });
  const { g } = game;
  const body = createPlayerBody(new THREE.Scene(), g.effects);
  connectWardrobeAppearance(g.events, { body, viewmodel });
  t.after(() => g.map.dispose());
  game.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  return { ...game, viewmodel, body, player: g.player };
}

const visible = (root, select) => {
  const result = [];
  root.traverseVisible((o) => { if (select(o)) result.push(o); });
  return result;
};

test('knit and reflective sleeves survive every gun, its Build-A-Blaster variants and ADS', (t) => {
  const { g, player, viewmodel } = scenario(t);
  const camera = new THREE.PerspectiveCamera(75, 4 / 3, .05, 200);
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const draw = (def, aimAmount) => {
    viewmodel.update(dt, camera, { weapon: new Weapon(def, g.stats), player, aimAmount });
    viewmodel.scene.updateMatrixWorld(true);
    viewmodel.camera.updateMatrixWorld(true);
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(viewmodel.camera.projectionMatrix, viewmodel.camera.matrixWorldInverse));
  };
  const parts = (name) => visible(viewmodel.scene, (o) => o.userData.sleevePart === name);
  const builds = Object.keys(workshopStuffings).flatMap((stuffing) =>
    Object.keys(workshopHearts).map((heart) => ({ name: 'Fitting sample', stuffing, heart, quality: 'regular' })));
  g.wardrobe.buy('cardigan');
  for (const base of Object.values(weapons)) {
    for (const build of [null, ...builds]) {
      const def = build ? resolveGun(base, [{ id: 'build', build }]) : base;
      for (const aim of [0, 1]) {
        draw(def, aim);
        const sleeves = parts('sleeve');
        assert.equal(sleeves.length, 2, base.id);
        assert.ok(sleeves.every((s) => s.material.map?.isDataTexture), base.id);
        assert.ok([...sleeves, ...parts('forearm')].some((o) => frustum.intersectsObject(o)), `${base.id}: knit is in frame`);
      }
    }
  }
  g.wardrobe.buy('hiVisVest');
  for (const base of Object.values(weapons)) {
    const specials = Object.entries(workshopBuilds).filter(([, build]) => build.weapon === base.id);
    for (const def of [base, ...specials.map(([id]) => resolveGun(base, [{ id: 'workshop', workshop: id }]))]) {
      for (const aim of [0, 1]) {
        draw(def, aim);
        const tape = parts('tape');
        assert.equal(tape.length, 2, base.id);
        assert.ok(tape.every((p) => p.material.emissive.getHex() === wardrobeLook.vest.tape), base.id);
        assert.ok(tape.some((o) => frustum.intersectsObject(o)), `${base.id}: reflective tape is in frame`);
      }
    }
  }
  g.resetRun();
  draw(weapons.stapleGun, 0);
  assert.equal(parts('tape').length, 0);
  assert.ok(parts('sleeve').every((o) => o.material.color.getHex() === feel.body.colors.shirt));
});

test('a real fitting-room confirmation restyles the visible gun immediately', (t) => {
  const game = scenario(t), { g, viewmodel, player } = game;
  g.debug.run('doors');
  game.tick(240);
  g.wardrobe.buy('cardigan');
  g.wardrobe.buy('hiVisVest');
  const spot = g.map.features.find((f) => f.name === 'fittingRoom_staffLockers');
  player.teleport({ position: spot.position.clone().addScaledVector(spot.normal, .8).setY(0), yaw: Math.PI / 2 });
  game.tick();
  assert.equal(g.interactions.prompt?.id, 'picker');
  game.press('KeyF', Math.ceil(feel.interact.holdSeconds / dt) + 1);
  const room = g.features.list.find(({ feature }) => feature === spot).instance;
  for (let i = 0; i < 4 && room.view.slot !== 'torso'; i++) game.press('KeyD');
  if (!room.view.slots.find((slot) => slot.id === 'torso').items.find((item) => item.id === 'cardigan').selected) game.press('KeyS');
  game.press('KeyF');
  assert.equal(g.wardrobe.wearing('torso'), 'cardigan');
  assert.equal(visible(viewmodel.scene, (o) => o.userData.sleevePart === 'tape').length, 0);
  assert.equal(visible(viewmodel.scene, (o) => o.userData.sleevePart === 'sleeve' && o.material.map?.isDataTexture).length, 2);
});

test('shoes, belt and board use the first-person body pose and reset; wheel sparks require a slide', (t) => {
  const game = scenario(t), { g, body, player } = game;
  const shoe = body.root.getObjectByName('playerLeftShoe');
  const update = () => body.update(dt, player, 1);
  g.wardrobe.buy('sandwichBoard');
  g.wardrobe.buy('fannyPack');
  g.wardrobe.buy('orthopedicWalkers');
  update();
  assert.equal(shoe.material.color.getHex(), wardrobeLook.shoes.orthopedicWalkers.upper);
  assert.ok(shoe.scale.x > .12);
  assert.equal(body.root.getObjectByName('wardrobeFannyPack'), undefined);
  assert.equal(body.root.getObjectByName('wardrobeSandwichBoard'), undefined);
  player.pitch = -1.35;
  update();
  const pack = body.root.getObjectByName('wardrobeFannyPack');
  const board = body.root.getObjectByName('wardrobeSandwichBoard');
  player.syncCamera(1);
  player.camera.updateMatrixWorld();
  body.root.updateMatrixWorld(true);
  for (const piece of [pack, board]) {
    assert.ok(piece.visible);
    const projected = new THREE.Box3().setFromObject(piece).getCenter(new THREE.Vector3()).project(player.camera);
    assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, piece.name);
  }
  const sight = new THREE.Raycaster();
  for (const pitch of [-1.0, -1.2, -1.4, -1.53]) {
    player.pitch = pitch;
    update();
    player.syncCamera(1);
    player.camera.updateMatrixWorld();
    body.root.updateMatrixWorld(true);
    sight.setFromCamera(new THREE.Vector2(), player.camera);
    assert.equal(sight.intersectObjects([pack, board], true).length, 0, 'belt and board stay below the reticle');
  }

  g.wardrobe.buy('lightUpSneakers');
  const sole = body.root.children.find((o) => o.material?.emissive.getHex() === wardrobeLook.shoes.lightUpSneakers.sole);
  const brightness = new Set();
  player.velocity.z = -player.stats.walkSpeed;
  for (let i = 0; i < 45; i++) { update(); brightness.add(sole.material.emissiveIntensity); }
  assert.ok(brightness.size > 1, 'footfalls pulse the emissive soles');
  g.wardrobe.buy('wheelieSneakers');
  assert.equal(visible(body.root, (o) => o.name === 'wardrobeHeelWheel').length, 2);
  update();
  assert.equal(g.effects.counts.particles, 0);
  game.input.held.add('KeyW');
  game.input.held.add('ShiftLeft');
  game.tick(9);
  game.press('KeyC');
  assert.equal(player.stance, 'slide');
  update();
  assert.ok(g.effects.counts.particles > 0);
  g.resetRun();
  update();
  assert.equal(shoe.material.color.getHex(), feel.body.colors.shoes);
  assert.equal(visible(body.root, (o) => o.name === 'wardrobeHeelWheel').length, 0);
  assert.equal(pack.visible, false);
  assert.equal(board.visible, false);
});

test('foam stays on the melee arm, and the Gold Card marks only paid kills', (t) => {
  const { g, player, viewmodel, hud } = scenario(t);
  const camera = new THREE.PerspectiveCamera(75, 4 / 3, .05, 200);
  const draw = (meleeProgress) => viewmodel.update(dt, camera, {
    weapon: g.gun.weapon, player, aimAmount: 0, meleeProgress,
  });
  const foamVisible = () => visible(viewmodel.scene, (o) => o.name === 'wardrobeFoamFinger').length;
  g.wardrobe.buy('foamFinger');
  draw(null);
  assert.equal(foamVisible(), 0);
  draw(.28);
  assert.equal(foamVisible(), 1);
  const foam = viewmodel.scene.getObjectByName('wardrobeFoamFinger');
  const sight = new THREE.Raycaster();
  for (let i = 0; i <= 100; i++) {
    draw(i / 100);
    viewmodel.scene.updateMatrixWorld(true);
    viewmodel.camera.updateMatrixWorld();
    sight.setFromCamera(new THREE.Vector2(), viewmodel.camera);
    assert.equal(sight.intersectObject(foam, true).length, 0, `foam clears the reticle at ${i}% of the swing`);
  }
  g.wardrobe.buy('goldCard');
  draw(.28);
  assert.equal(foamVisible(), 0);
  const popups = () => hud.calls.filter(([name]) => name === 'pointsPopup');
  g.wallet.earn(5);
  assert.deepEqual(popups().at(-1), ['pointsPopup', 5]);
  const fan = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 8));
  fan.noRewards = true;
  const count = popups().length;
  fan.takeHit({ damage: fan.health + 1, source: 'gun', part: 'body' });
  assert.equal(popups().length, count);
  const shopper = g.zombies.spawn('shopper', new THREE.Vector3(1, 0, 8));
  shopper.takeHit({ damage: shopper.health + 1, source: 'gun', part: 'body' });
  assert.deepEqual(popups().at(-1), ['pointsPopup', 80, 'goldCard']); // 60 x 1.25, paid in tens
});

test('the Paper Hat HUD timer follows the current regen delay', (t) => {
  const { g } = scenario(t);
  g.wardrobe.buy('paperHat');
  assert.equal(g.health.regenWaitFraction, null);
  g.health.takeDamage(20);
  assert.equal(g.health.regenWaitFraction, 0);
  g.health.update(g.stats.regenDelay / 2);
  assert.equal(g.health.regenWaitFraction, .5);
  g.health.update(g.stats.regenDelay / 2 - dt / 2);
  g.health.update(dt);
  assert.equal(g.health.regenWaitFraction, 1);
});

test('the HUD wears its own styles and keeps its ammo and reticle live through swaps and reset', async (t) => {
  const before = { document: globalThis.document, window: globalThis.window };
  t.after(() => Object.assign(globalThis, before));
  const { document } = menuDom();
  const { createHud } = await import('../src/ui/hud.js');
  const hud = createHud();
  const events = createEvents();
  hud.connectEvents(events);
  const root = document.querySelector('.hud');
  const wear = (slot, worn) => events.emit('wardrobeChange', { slot, worn });

  wear('head', 'paperHat');
  hud.setHealth(.6, .5);
  assert.equal(root.dataset.wardrobeHead, 'paperHat');
  assert.equal(root.querySelector('.wardrobe-regen').style.getPropertyValue('--regen'), '0.5');
  wear('head', 'aviators');
  hud.setCrosshair(4, .5);
  assert.equal(root.querySelector('.wardrobe-eyewear').style.getPropertyValue('--wardrobe-aim'), '0.5');
  assert.equal(root.querySelector('.ch-dot').style.opacity, '0.5');
  wear('head', 'glasses');
  events.emit('outfitPulse', { id: 'glasses', slot: 'head' });
  assert.ok(root.querySelector('.wardrobe-eyewear').classList.contains('headshot'));

  wear('torso', 'cardigan');
  assert.equal(root.dataset.wardrobeTorso, 'cardigan');
  wear('torso', 'sandwichBoard');
  assert.equal(root.dataset.wardrobeTorso, 'sandwichBoard');
  wear('feet', 'lightUpSneakers');
  hud.setSprint(.5, false, true);
  assert.ok(root.querySelector('.sprint').classList.contains('active'));
  wear('feet', 'orthopedicWalkers');
  assert.equal(root.dataset.wardrobeFeet, 'orthopedicWalkers');

  const weapon = new Weapon(weapons.stapleGun, { reserveMultiplier: 1.25 });
  wear('accessory', 'fannyPack');
  hud.setAmmo(weapon);
  assert.ok(root.querySelector('.ammo-pouch').classList.contains('show'));
  assert.equal(root.querySelector('.ammo-reserve').textContent, ' / 75');
  wear('accessory', 'goldCard');
  hud.setAmmo(weapon);
  assert.ok(!root.querySelector('.ammo-pouch').classList.contains('show'));
  hud.pointsPopup(70, 'goldCard');
  assert.equal(root.querySelector('.gold-card').textContent, '+70 ★');
  events.emit('runReset');
  assert.equal(root.dataset.wardrobeHead, undefined);
  assert.ok(!root.querySelector('.wardrobe-eyewear').classList.contains('headshot'));
});
