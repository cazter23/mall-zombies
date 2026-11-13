// The scope (weapons/scope.js, used by the Stargazer 3000): the eyepiece overlay, the figure-eight sway and the bolt that knocks
// the eye off the eyepiece (weapons/aim.js onShot). Alone, on made-up numbers; the gun's own test checks it in the real game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeOverlay, scopeSwayOffset, createScopeSway } from '../src/weapons/scope.js';
import { createAim } from '../src/weapons/aim.js';
import { weapons } from '../src/config/weapons.js';

const DEG = Math.PI / 180;
const dt = 1 / 60;
const scope = { overlayFrom: 0.8, sway: { degrees: 0.2, periodSeconds: 3, pitchShare: 0.6, crouchMultiplier: 0.4 } };

test('the eyepiece: nothing at the hip or below overlayFrom, all of the view when fully aimed, and never on a gun without a scope', () => {
  assert.equal(scopeOverlay(scope, 0), 0);
  assert.equal(scopeOverlay(scope, 0.8), 0);
  assert.equal(scopeOverlay(scope, 1), 1);
  assert.ok(Math.abs(scopeOverlay(scope, 0.9) - 0.5) < 1e-9);
  let last = 0;
  for (let a = 0; a <= 1; a += 0.01) { const o = scopeOverlay(scope, a); assert.ok(o >= last); last = o; }
  assert.equal(scopeOverlay(undefined, 1), 0);
  assert.equal(scopeOverlay(null, 1), 0);
});

test('the sway: none at the hip, a figure eight no wider than sway.degrees when aimed, and smaller crouched', () => {
  assert.deepEqual(scopeSwayOffset(scope, 1.3, 0), { yaw: 0, pitch: 0 });
  assert.deepEqual(scopeSwayOffset(undefined, 1.3, 1), { yaw: 0, pitch: 0 });
  let widest = 0, highest = 0;
  for (let t = 0; t < 3; t += dt) {
    const { yaw, pitch } = scopeSwayOffset(scope, t, 1);
    widest = Math.max(widest, Math.abs(yaw));
    highest = Math.max(highest, Math.abs(pitch));
  }
  assert.ok(widest <= 0.2 * DEG + 1e-12 && widest > 0.19 * DEG, 'it reaches sway.degrees sideways');
  assert.ok(highest <= 0.2 * 0.6 * DEG + 1e-12 && highest > 0.1 * DEG, 'and pitchShare of it up and down');
  // A figure eight: the pitch goes round twice for every once sideways (back to 0 at a quarter period, while the yaw is at its widest).
  const quarter = scopeSwayOffset(scope, 0.75, 1);
  assert.ok(Math.abs(quarter.pitch) < 1e-12 && Math.abs(quarter.yaw - 0.2 * DEG) < 1e-12);
  const standing = scopeSwayOffset(scope, 0.75, 1, false).yaw;
  const crouched = scopeSwayOffset(scope, 0.75, 1, true).yaw;
  assert.ok(Math.abs(crouched - 0.4 * standing) < 1e-12, 'crouched or prone: crouchMultiplier of it');
  assert.ok(Math.abs(scopeSwayOffset(scope, 0.75, 0.5).yaw - 0.5 * standing) < 1e-12, 'half aimed: half the sway');
});

test('per-tick changes add up to the offset, and lowering the scope hands back everything the sway took (no drift left behind)', () => {
  const sway = createScopeSway();
  const view = { yaw: 0, pitch: 0 };
  let aim = 0;
  for (let i = 0; i < 400; i++) {
    aim = Math.min(1, aim + dt / 0.3); // aiming in
    const c = sway.update(dt, scope, aim);
    view.yaw += c.yaw; view.pitch += c.pitch;
    assert.ok(Math.abs(view.yaw - sway.offset.yaw) < 1e-12 && Math.abs(view.pitch - sway.offset.pitch) < 1e-12);
  }
  assert.ok(Math.abs(view.yaw) > 0 || Math.abs(view.pitch) > 0, 'it drifted while aimed');
  for (let i = 0; i < 60; i++) {
    aim = Math.max(0, aim - dt / 0.3); // and out again
    const c = sway.update(dt, scope, aim);
    view.yaw += c.yaw; view.pitch += c.pitch;
  }
  assert.ok(Math.abs(view.yaw) < 1e-12 && Math.abs(view.pitch) < 1e-12, 'back exactly where the player left it');
  // A gun without a scope never moves the view.
  const none = createScopeSway();
  for (let i = 0; i < 100; i++) assert.deepEqual({ ...none.update(dt, undefined, 1) }, { yaw: 0, pitch: 0 });
});

test('every aim starts from the middle of the eight: the clock restarts when the scope comes down', () => {
  const sway = createScopeSway();
  for (let i = 0; i < 100; i++) sway.update(dt, scope, 1);
  sway.update(dt, scope, 0);
  const first = sway.update(dt, scope, 1);
  assert.ok(Math.abs(first.yaw) < 0.01 * DEG, 'a fresh aim starts near the middle');
  sway.reset();
  assert.deepEqual({ ...sway.offset }, { yaw: 0, pitch: 0 });
});

// A stub player and input for weapons/aim.js: standing still, aim held or not.
function aimRig(def) {
  const controls = { held: true };
  const input = {
    actionDown: (a) => a === 'aim' && controls.held, consumeAction: () => false, actionPressed: () => false, moveAxis: () => ({ x: 0, y: 0 }),
  };
  const player = { stats: { walkSpeed: 5 }, velocity: { x: 0, z: 0 }, grounded: true };
  return { aim: createAim({ def, input, player }), controls };
}

test('firing keeps the aim: a shot from a scoped gun leaves ADS fully in (the eyepiece stays); so does an unscoped gun', () => {
  const base = weapons.rivetRifle;
  const scoped = { ...base, scope };
  const { aim } = aimRig(scoped);
  for (let i = 0; i < 60; i++) aim.update(dt);
  assert.equal(aim.amount, 1);
  aim.onShot();
  aim.update(dt);
  assert.equal(aim.amount, 1, 'still fully aimed after the shot');
  assert.equal(scopeOverlay(scope, aim.amount), 1, 'still looking through the eyepiece');

  const plain = aimRig(base).aim;
  for (let i = 0; i < 60; i++) plain.update(dt);
  plain.onShot();
  plain.update(dt);
  assert.equal(plain.amount, 1, 'an unscoped gun stays aimed');
});
