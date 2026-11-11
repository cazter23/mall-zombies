import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/headlessGame.js';
import * as THREE from 'three';
import { PlayerController } from '../src/player/controller.js';
import { createPlayerStats } from '../src/player/stats.js';
import { createAim } from '../src/weapons/aim.js';
import { weapons } from '../src/config/weapons.js';
import { feel } from '../src/config/feel.js';
import { settingDefs, settingPresets } from '../src/config/settings.js';

const dt = 1 / feel.simulation.tickRate;
const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(
  new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1),
);

function createPlayerFixture() {
  const held = new Set();
  const pressed = new Set();
  const axis = { x: 0, y: 1 };
  const input = {
    held,
    pressed,
    axis,
    device: 'keyboard',
    moveAxis() { return this.axis; },
    consumeAction(action) {
      const val = this.pressed.has(action);
      this.pressed.delete(action);
      return val;
    },
    actionDown(action) { return this.held.has(action); },
    actionPressed(action) { return this.pressed.has(action); },
  };

  const floor = box(-50, -0.2, -50, 50, 0, 50);
  const colliders = [floor];
  const bodies = [];
  const player = new PlayerController({
    camera: new THREE.PerspectiveCamera(),
    input,
    stats: createPlayerStats(),
    colliders,
    spawn: { position: new THREE.Vector3(0, 0, 0), yaw: 0 },
    getBodies: () => bodies,
  });
  player.grounded = true;
  // Like the real game's input.endTick(): a press lasts one tick, whoever reads it.
  const update = player.update.bind(player);
  player.update = (step) => { update(step); pressed.clear(); };

  return { input, player, colliders };
}

function createAimFixture() {
  const held = new Set();
  const pressed = new Set();
  const axis = { x: 0, y: 0 };
  const input = {
    held,
    pressed,
    axis,
    device: 'keyboard',
    moveAxis() { return this.axis; },
    consumeAction(action) {
      const val = this.pressed.has(action);
      this.pressed.delete(action);
      return val;
    },
    actionDown(action) { return this.held.has(action); },
    actionPressed(action) { return this.pressed.has(action); },
  };

  const player = {
    velocity: { x: 0, z: 0 },
    grounded: true,
    stats: { walkSpeed: 5, adsTimeMultiplier: 1 },
    isSprinting: false,
    isAiming: false,
    aimAmount: 0,
    aimMoveMultiplier: 1,
  };

  const aim = createAim({ def: weapons.stapleGun, input, player });
  return { input, player, aim };
}

test('accessibility toggle settings are registered under Comfort tab with false defaults', () => {
  const ids = ['toggleSprint', 'toggleCrouch', 'toggleAds'];
  for (const id of ids) {
    const def = settingDefs.find((d) => d.id === id);
    assert.ok(def, `${id} is registered in settingDefs`);
    assert.equal(def.tab, 'Comfort');
    assert.equal(def.type, 'toggle');
    assert.equal(def.default, false);
    assert.ok(def.hint, `${id} has a descriptive hint`);
  }

  // Verify apply updates feel config
  const sprintDef = settingDefs.find((d) => d.id === 'toggleSprint');
  const crouchDef = settingDefs.find((d) => d.id === 'toggleCrouch');
  const adsDef = settingDefs.find((d) => d.id === 'toggleAds');

  sprintDef.apply(true);
  assert.equal(feel.sprint.toggle, true);
  sprintDef.apply(false);
  assert.equal(feel.sprint.toggle, false);

  crouchDef.apply(true);
  assert.equal(feel.crouch.toggle, true);
  crouchDef.apply(false);
  assert.equal(feel.crouch.toggle, false);

  adsDef.apply(true);
  assert.equal(feel.ads.toggle, true);
  adsDef.apply(false);
  assert.equal(feel.ads.toggle, false);

  // They are a control choice, not comfort: no Comfort preset (Calm, Standard) changes them
  for (const preset of settingPresets.Comfort) {
    for (const id of ids) assert.equal(id in preset.values, false, `${preset.label} leaves ${id} alone`);
  }
});

// The toggles together, the way the game ticks them: the player, then the gun's aim (each reads the same presses).
function createToggleRig() {
  const f = createPlayerFixture();
  const aim = createAim({ def: weapons.stapleGun, input: f.input, player: f.player });
  const updatePlayer = f.player.update; // (the fixture's: it ends the presses after the player)
  const tick = () => {
    const pressed = new Set(f.input.pressed);
    updatePlayer(dt);
    for (const p of pressed) f.input.pressed.add(p); // ...but this tick's presses are still there for the aim
    aim.update(dt);
    f.player.isAiming = aim.isAiming; // (playerGun does this in the game)
    f.input.pressed.clear(); // input.endTick()
  };
  return { ...f, aim, tick };
}

test('toggle ADS: aiming mid-sprint is allowed and ends the sprint (as with the held button)', () => {
  const r = createToggleRig();
  feel.ads.toggle = true;
  try {
    r.input.axis = { x: 0, y: 1 };
    r.input.held.add('sprint');
    r.tick();
    assert.equal(r.player.isSprinting, true, 'sprinting');
    r.input.pressed.add('aim');
    r.tick();
    assert.equal(r.aim.isAiming, true, 'the aim press raises the sights mid-sprint');
    r.tick();
    assert.equal(r.player.isSprinting, false, 'and the sprint stops');
    assert.equal(r.aim.isAiming, true, 'the sights stay up (sprint is held, not pressed again)');
  } finally {
    feel.ads.toggle = false;
  }
});

test('toggle sprint: a sprint press while aiming lowers the sights and starts the sprint', () => {
  for (const adsToggle of [false, true]) {
    const r = createToggleRig();
    feel.sprint.toggle = true;
    feel.ads.toggle = adsToggle;
    try {
      r.input.axis = { x: 0, y: 1 };
      if (adsToggle) r.input.pressed.add('aim');
      else r.input.held.add('aim');
      r.tick();
      assert.equal(r.aim.isAiming, true, 'aiming');
      r.input.pressed.add('sprint');
      r.tick();
      assert.equal(r.aim.isAiming, false, `the sprint press lowers the sights (toggle ADS ${adsToggle})`);
      r.tick();
      assert.equal(r.player.isSprinting, true, `and the sprint starts without a second press (toggle ADS ${adsToggle})`);
    } finally {
      feel.sprint.toggle = false;
      feel.ads.toggle = false;
    }
  }
});

test('toggle crouch: a sprint press stands you up, and with toggle sprint the sprint follows', () => {
  const r = createToggleRig();
  feel.crouch.toggle = true;
  feel.sprint.toggle = true;
  try {
    r.input.axis = { x: 0, y: 1 };
    r.input.pressed.add('crouch');
    r.tick();
    assert.equal(r.player.stance, 'crouch', 'crouched');
    for (let i = 0; i < 5; i++) r.tick();
    assert.equal(r.player.stance, 'crouch', 'stays crouched with nothing held');
    r.input.pressed.add('sprint');
    r.tick();
    assert.equal(r.player.stance, 'stand', 'the sprint press stands up');
    r.tick();
    assert.equal(r.player.isSprinting, true, 'and the one press is enough to sprint');
  } finally {
    feel.crouch.toggle = false;
    feel.sprint.toggle = false;
  }
});

test('toggleCrouch stays crouched on tap and stands on second tap or jump', () => {
  const f = createPlayerFixture();
  feel.crouch.toggle = true;

  try {
    // Tick 1: Tap crouch (pressed and not held)
    f.input.pressed.add('crouch');
    f.player.update(dt);
    assert.equal(f.player.stance, 'crouch', 'enters crouch on tap');

    // Tick 2: Key is no longer pressed or held; player must STAY crouched
    f.player.update(dt);
    assert.equal(f.player.stance, 'crouch', 'remains crouched without holding key');

    // Tick 3: Tap crouch again -> stands up
    f.input.pressed.add('crouch');
    f.player.update(dt);
    assert.equal(f.player.stance, 'stand', 'stands up on second crouch tap');

    // Tick 4: Crouch again
    f.input.pressed.add('crouch');
    f.player.update(dt);
    assert.equal(f.player.stance, 'crouch');

    // Tick 5: Press jump while crouched -> stands up
    f.input.pressed.add('jump');
    f.player.update(dt);
    assert.equal(f.player.stance, 'stand', 'stands up on jump press');
    assert.equal(f.player.velocity.y, 0, 'standing from crouch does not jump into air');
  } finally {
    feel.crouch.toggle = false;
  }
});

test('toggleCrouch respects low ceiling headroom checks', () => {
  const f = createPlayerFixture();
  feel.crouch.toggle = true;

  try {
    // Add a low overhead obstacle (roof at y = 1.25m, player standing needs 1.85m)
    const lowCeiling = box(-5, 1.2, -5, 5, 2, 5);
    f.colliders.push(lowCeiling);

    // Crouch down
    f.input.pressed.add('crouch');
    f.player.update(dt);
    assert.equal(f.player.stance, 'crouch');

    // Try to stand up while under low ceiling
    f.input.pressed.add('crouch');
    f.player.update(dt);
    assert.equal(f.player.stance, 'crouch', 'blocked from standing when headroom is obstructed');

    // Try jump while under low ceiling
    f.input.pressed.add('jump');
    f.player.update(dt);
    assert.equal(f.player.stance, 'crouch', 'cannot jump or stand when headroom is obstructed');

    // Remove low ceiling and stand up
    f.colliders.pop();
    f.input.pressed.add('crouch');
    f.player.update(dt);
    assert.equal(f.player.stance, 'stand', 'stands up once headroom is clear');
  } finally {
    feel.crouch.toggle = false;
  }
});

test('toggleCrouch default hold behavior is preserved when toggle is false', () => {
  const f = createPlayerFixture();
  feel.crouch.toggle = false;

  // Hold crouch
  f.input.held.add('crouch');
  f.player.update(dt);
  assert.equal(f.player.stance, 'crouch');

  // Release crouch -> stands up immediately
  f.input.held.delete('crouch');
  f.player.update(dt);
  assert.equal(f.player.stance, 'stand', 'stands up immediately when crouch is released in hold mode');
});

test('toggleSprint latches sprint on tap and unlatches on stop, fire, or stamina depletion', () => {
  const f = createPlayerFixture();
  feel.sprint.toggle = true;

  try {
    // Moving forward, tap sprint
    f.input.axis = { x: 0, y: 1 };
    f.input.pressed.add('sprint');
    f.player.update(dt);
    assert.equal(f.player.isSprinting, true, 'starts sprinting on tap');

    // Next tick: sprint key not held; player continues sprinting
    f.player.update(dt);
    assert.equal(f.player.isSprinting, true, 'continues sprinting while moving forward');

    // Stop moving: sprint unlatches
    f.input.axis = { x: 0, y: 0 };
    f.player.update(dt);
    assert.equal(f.player.isSprinting, false, 'stops sprinting when movement ceases');

    // Moving forward again does NOT resume sprint automatically
    f.input.axis = { x: 0, y: 1 };
    f.player.update(dt);
    assert.equal(f.player.isSprinting, false, 'does not resume sprinting without another tap');

    // Tap sprint again
    f.input.pressed.add('sprint');
    f.player.update(dt);
    assert.equal(f.player.isSprinting, true);

    // Gunfire stops sprint and unlatches
    f.player.blockSprint(feel.sprint.fireBlocksSprintSeconds);
    f.player.update(dt);
    assert.equal(f.player.isSprinting, false, 'firing stops sprint');

    // After fire delay expires, sprint does not auto-resume
    for (let i = 0; i < 25; i++) f.player.update(dt);
    assert.equal(f.player.isSprinting, false, 'sprint remains unlatched after gunfire');
  } finally {
    feel.sprint.toggle = false;
  }
});

test('toggleAds toggles ADS on tap and drops on sprint or weapon switch', () => {
  const f = createAimFixture();
  feel.ads.toggle = true;

  try {
    // Tick 1: Tap aim (press and release)
    f.input.pressed.add('aim');
    f.aim.update(dt);
    assert.equal(f.aim.isAiming, true, 'ADS engages on tap');

    // Tick 2: Aim key is not held; stays aiming
    f.aim.update(dt);
    assert.equal(f.aim.isAiming, true, 'ADS remains engaged without holding button');

    // Tick 3: Tap aim again -> lowers weapon
    f.input.pressed.add('aim');
    f.aim.update(dt);
    assert.equal(f.aim.isAiming, false, 'ADS disengages on second tap');

    // Tick 4: Tap aim again -> engages ADS
    f.input.pressed.add('aim');
    f.aim.update(dt);
    assert.equal(f.aim.isAiming, true);

    // Tick 5: Sprint while aiming -> drops ADS
    f.input.axis = { x: 0, y: 1 };
    f.input.pressed.add('sprint');
    f.aim.update(dt);
    assert.equal(f.aim.isAiming, false, 'sprinting drops ADS');

    // Tick 6: Tap aim again -> engages ADS
    f.input.pressed.clear();
    f.input.pressed.add('aim');
    f.aim.update(dt);
    assert.equal(f.aim.isAiming, true);

    // Tick 7: Weapon switch (allowAim = false) -> drops ADS
    f.input.pressed.clear();
    f.aim.update(dt, false);
    assert.equal(f.aim.isAiming, false, 'switching weapons drops ADS');
  } finally {
    feel.ads.toggle = false;
  }
});

test('toggleAds default hold behavior is preserved when toggle is false', () => {
  const f = createAimFixture();
  feel.ads.toggle = false;

  f.input.held.add('aim');
  f.aim.update(dt);
  assert.equal(f.aim.isAiming, true);

  f.input.held.delete('aim');
  f.aim.update(dt);
  assert.equal(f.aim.isAiming, false, 'drops ADS immediately when aim button is released in hold mode');
});
