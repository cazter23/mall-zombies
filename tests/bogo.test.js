// BOGO (Buy One Get One): the akimbo SMGs, a claw-only prize. One gun to the game (one magazine, one reload), a PAIR on screen with a trigger
// per hand (left mouse / LT the left gun, right mouse / RT the right, no ADS); the muzzle and its flash go to the gun that fired; the reload
// goes one gun at a time; attachments, trims and skins go on both.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { weapons } from '../src/config/weapons.js';
import { clawMachine } from '../src/config/clawMachine.js';
import { economy } from '../src/config/economy.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';
import { Weapon } from '../src/weapons/weapon.js';
import { createPlayerStats } from '../src/player/stats.js';
import { createPlayerGun } from '../src/weapons/playerGun.js';
import { Input } from '../src/core/input.js';

const bogo = weapons.bogo;
const dt = 1 / 60;
const worldX = (object) => object.getWorldPosition(new THREE.Vector3()).x;

test('BOGO is a claw-only purple prize, on no wall', () => {
  assert.equal(bogo.clawOnly, true);
  assert.equal(clawMachine.prizes.bogo?.capsule, 'purple');
  assert.equal(economy.wallBuys.bogo, undefined);
});

test('BOGO fires faster than any other gun, out of one shared magazine, and reloads both guns at once', () => {
  for (const d of Object.values(weapons)) if (d !== bogo && d.fireInterval) assert.ok(bogo.fireInterval < d.fireInterval, d.name);
  const w = new Weapon(bogo, createPlayerStats());
  let shots = 0;
  for (let tick = 0; tick < 60; tick++) if (w.update(dt, { triggerPressed: tick === 0, triggerHeld: true }) === 'fire') shots++;
  assert.ok(shots >= 17 && shots <= 19, `about 18 a second (${shots})`);
  for (let tick = 0; tick < 400 && w.magazine; tick++) w.update(dt, { triggerHeld: true });
  assert.equal(w.magazine, 0);
  w.startReload();
  for (let tick = 0; tick < Math.ceil(bogo.reloadTime / dt) + 2; tick++) w.update(dt, {});
  assert.equal(w.magazine, bogo.magazineSize, 'one reload fills both guns');
});

test('the model is a pair: a right gun and a mirrored left one, and the shots alternate between their muzzles (the flash goes with them)', () => {
  const model = buildWeaponModel(bogo);
  model.root.updateMatrixWorld(true);
  const guns = [];
  model.root.traverse((o) => { if (o.name === 'bogoGun') guns.push(o); });
  assert.equal(guns.length, 2);
  const flash = new THREE.Object3D();
  model.muzzle.add(flash);
  model.animate({ sinceFire: 0, reloadProgress: 0, reloadWeight: 0, time: 0, aimAmount: 0 });
  const sides = [];
  for (let i = 0; i < 4; i++) {
    model.onFire(flash);
    model.root.updateMatrixWorld(true);
    assert.equal(flash.parent, model.muzzle, 'the flash sits on the gun that fired');
    sides.push(Math.sign(worldX(model.muzzle)));
  }
  assert.deepEqual(sides, [1, -1, 1, -1], 'right, left, right, left');
  model.onFire(flash, 'left');
  model.root.updateMatrixWorld(true);
  assert.equal(Math.sign(worldX(model.muzzle)), -1, 'a named side fires that gun');
  model.onFire(flash, 'left');
  model.root.updateMatrixWorld(true);
  assert.equal(Math.sign(worldX(model.muzzle)), -1, 'and again (no alternating when the side is given)');
});

// The real Input's action methods (no constructor: it listens to the window) over a stand-in player, viewmodel and world.
function pairFixture() {
  const input = Object.create(Input.prototype);
  input.held = new Set();
  input.pressed = new Set();
  input.padMove = { x: 0, y: 0 };
  const stats = createPlayerStats();
  const player = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), stats, grounded: true, stance: 'stand',
    isSprinting: false, sprintAmount: 0, blockSprint() {}, getAim(o, d) { o.set(0, 1.6, 0); d.set(0, 0, -1); }, addRecoil() {} };
  const sides = [];
  const gun = createPlayerGun({ def: bogo, stats, player, input, colliders: [], shootables: [],
    effects: { tracer() {}, splat() {}, puff() {} },
    viewmodel: { fire(ads, d, side) { sides.push(side); }, dryFire() {}, jolt() {}, getMuzzleWorldPosition: (out) => out.set(0, 1.6, 0) },
    hud: { showHitMarker() {} }, sound: null });
  const hold = (codes, ticks) => {
    for (const c of codes) { input.held.add(c); input.pressed.add(c); }
    for (let i = 0; i < ticks; i++) { gun.update(dt); input.pressed.clear(); }
    for (const c of codes) input.held.delete(c);
  };
  return { gun, sides, hold, player };
}

test('a trigger per hand: left mouse fires the left gun, right mouse the right one, at half the rate each; both together take turns at the full rate', () => {
  const f = pairFixture();
  f.hold(['Mouse0'], 60);
  assert.ok(f.sides.length >= 8 && f.sides.length <= 10, `one gun: about 9 a second (${f.sides.length})`);
  assert.ok(f.sides.every((s) => s === 'left'), 'left mouse: only the left gun');
  assert.equal(f.gun.aim.amount, 0);
  f.sides.length = 0;
  f.hold(['Mouse2'], 30);
  assert.ok(f.sides.length > 0 && f.sides.every((s) => s === 'right'), 'right mouse: only the right gun');
  assert.equal(f.gun.aim.amount, 0, 'right mouse never aims (and so never zooms)');
  assert.equal(f.player.aimAmount, 0);
  f.gun.weapon.magazine = bogo.magazineSize;
  f.sides.length = 0;
  f.hold(['Mouse0', 'Mouse2'], 60);
  assert.ok(f.sides.length >= 17 && f.sides.length <= 19, `both: about 18 a second (${f.sides.length})`);
  for (let i = 1; i < f.sides.length; i++) assert.notEqual(f.sides[i], f.sides[i - 1], 'they take turns');
});

test('on a controller the left trigger is the left gun: LT (bound to aim) fires left, RT (fire) fires right', () => {
  const f = pairFixture();
  f.hold(['PadLT'], 20);
  assert.ok(f.sides.length > 0 && f.sides.every((s) => s === 'left'));
  f.sides.length = 0;
  f.hold(['PadRT'], 20);
  assert.ok(f.sides.length > 0 && f.sides.every((s) => s === 'right'));
  assert.equal(f.gun.aim.amount, 0);
});

test('the reload goes one gun at a time: the left magazine is out while the right gun waits, then the other way round; both full at the end', () => {
  const model = buildWeaponModel(bogo);
  const mags = [];
  model.root.traverse((o) => { if (o.name === 'bogoMagazine') mags.push(o); }); // [right gun, left gun]
  assert.equal(mags.length, 2);
  const r = bogo.viewmodel.reload;
  const gap = (r.magazineDrop[1] + r.magazineIn[0]) / 2; // within a turn: the magazine is out
  const inTurn = ([a, b]) => a + gap * (b - a);
  const at = (p) => { model.animate({ sinceFire: 1, reloadProgress: p, reloadWeight: 1, time: p, aimAmount: 0 }); return mags.map((m) => m.visible); };
  assert.deepEqual(at(inTurn(r.turns[0])), [true, false], 'the left gun first');
  assert.deepEqual(at(inTurn(r.turns[1])), [false, true], 'then the right');
  assert.deepEqual(at(0.97), [true, true]);
  // A sound on each magazine: out and in for each gun, inside its own turn.
  const within = ([a, b], s) => r.events.some((e) => e.sound === s && e.at > a && e.at < b);
  for (const turn of r.turns) for (const s of ['bogoReloadOut', 'bogoReloadIn']) assert.ok(within(turn, s), `${s} in the turn ${turn}`);
});

test('the gun whose turn it is tips in toward the middle of the view, and both are back where they started after the reload', () => {
  const model = buildWeaponModel(bogo);
  const guns = [];
  model.root.traverse((o) => { if (o.name === 'bogoGun') guns.push(o); }); // [right, left]
  const xs = (p, weight = 1) => { model.animate({ sinceFire: 1, reloadProgress: p, reloadWeight: weight, time: 1, aimAmount: 0 }); model.root.updateMatrixWorld(true); return guns.map(worldX); };
  const rest = xs(0, 0);
  const r = bogo.viewmodel.reload;
  const mid = ([a, b]) => (a + b) / 2;
  assert.ok(Math.abs(xs(mid(r.turns[0]))[1]) < Math.abs(rest[1]) - 0.03, 'the left gun comes in for its turn');
  assert.ok(Math.abs(xs(mid(r.turns[1]))[0]) < Math.abs(rest[0]) - 0.03, 'then the right');
  xs(1).forEach((x, i) => assert.ok(Math.abs(x - rest[i]) < 1e-6, 'home'));
});

test('attachments and the warranty sticker go on BOTH guns; the box cutter swing hides the left gun', () => {
  const model = buildWeaponModel(bogo);
  const upgrades = model.createUpgradeVisuals();
  assert.equal(upgrades.perGun.length, 2);
  for (const each of upgrades.perGun) for (const id of ['zoomLens', 'laserPointer', 'jumboPack']) assert.ok(each.parts[id], `${id} has a mount on each gun`);
  upgrades.show({ tier: 'premium', attachments: { optic: 'zoomLens', magazine: 'jumboPack' } });
  for (const each of upgrades.perGun) {
    assert.equal(each.parts.zoomLens.visible, true);
    assert.equal(each.parts.jumboPack.visible, true);
    assert.equal(each.parts.laserPointer.visible, false);
  }
  model.leftHandVisible = false;
  const mirror = model.root.getObjectByName('bogoLeftHand');
  assert.equal(mirror.visible, false);
  model.leftHandVisible = true;
  assert.equal(mirror.visible, true);
});

test('the chute display shows the pair', () => {
  const display = buildWeaponDisplay(bogo);
  let guns = 0;
  display.traverse((o) => { if (o.name === 'bogoGun') guns++; });
  assert.equal(guns, 2);
});
