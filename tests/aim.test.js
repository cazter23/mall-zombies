import test from 'node:test';
import assert from 'node:assert/strict';
import { createAim } from '../src/weapons/aim.js';
import { Weapon } from '../src/weapons/weapon.js';
import { weapons } from '../src/config/weapons.js';
import { feel } from '../src/config/feel.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { withAttachment } from '../src/weapons/upgrades.js';
import { upgrades } from '../src/config/upgrades.js';

function fixture(def = weapons.priceGun) {
  const input = {
    aiming: false,
    actionDown() { return this.aiming; },
    consumeAction() { return false; },
    actionPressed() { return false; },
    moveAxis() { return { x: 0, y: 0 }; },
  };
  const player = { velocity: { x: 0, z: 0 }, grounded: true, stats: { walkSpeed: 5 } };
  return { aim: createAim({ def, input, player }), input };
}

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `expected ${expected}, got ${actual}`);

test('Price Gun sustained fire builds bloom at its actual cadence and stays capped', () => {
  const def = weapons.priceGun;
  const { aim } = fixture(def);
  const weapon = new Weapon(def, { reloadSpeed: 1 });
  const dt = 1 / feel.simulation.tickRate;
  let shots = 0;
  while (weapon.magazine > 0) {
    aim.update(dt);
    if (weapon.update(dt, { triggerHeld: true }) === 'fire') {
      shots++;
      // The shot uses the existing cone; its bloom affects subsequent shots.
      closeTo(aim.spreadDegrees, def.spread.base + Math.min(def.spread.maxBloom,
        (shots - 1) * def.spread.perShot));
      aim.onShot();
    }
    assert.ok(aim.spreadDegrees <= def.spread.base + def.spread.maxBloom + 1e-9);
  }
  closeTo(aim.spreadDegrees, def.spread.base + def.spread.maxBloom);
});

test('bloom waits after each shot, recovers only after the delay, and returns to base', () => {
  for (const def of Object.values(weapons)) {
    const { aim } = fixture(def);
    const s = def.spread;
    aim.onShot();
    aim.update(s.bloomRecoveryDelay / 2);
    closeTo(aim.spreadDegrees, s.base + s.perShot);
    aim.onShot(); // a fresh shot restarts the delay
    const bloom = Math.min(s.maxBloom, s.perShot * 2);
    aim.update(s.bloomRecoveryDelay - 0.01);
    closeTo(aim.spreadDegrees, s.base + bloom);
    aim.update(0.03); // 0.01s waiting, 0.02s recovering
    closeTo(aim.spreadDegrees, s.base + bloom - s.bloomRecovery * 0.02);
    aim.update(2);
    closeTo(aim.spreadDegrees, s.base);
  }
});

test('ADS scales delayed bloom and reset returns to resting hip accuracy', () => {
  const def = weapons.priceGun;
  const { aim, input } = fixture(def);
  input.aiming = true;
  aim.update(def.ads.seconds);
  aim.onShot();
  aim.update(def.spread.bloomRecoveryDelay / 2);
  closeTo(aim.spreadDegrees, (def.spread.base + def.spread.perShot) * def.spread.adsMultiplier);
  aim.reset();
  closeTo(aim.spreadDegrees, def.spread.base);
});

test('a weapon without a recovery delay retains immediate bloom recovery', () => {
  const def = weapons.priceGun;
  const legacyDef = { ...def, spread: { ...def.spread, bloomRecoveryDelay: 0 } };
  delete legacyDef.spread.bloomRecoveryDelay;
  const legacy = fixture(legacyDef).aim;
  legacy.onShot();
  legacy.update(0.01);
  closeTo(legacy.spreadDegrees, def.spread.base + def.spread.perShot - def.spread.bloomRecovery * 0.01);
});

test('Laser Pointer preserves its hip benefit and ADS penalty through repeated shots and recovery', () => {
  const dt = 1 / feel.simulation.tickRate;
  for (const base of Object.values(weapons)) {
    const laser = resolveGun(base, withAttachment(base, [], 'laserPointer'));
    for (const aiming of [false, true]) {
      const plain = fixture(base);
      const fitted = fixture(laser);
      plain.input.aiming = fitted.input.aiming = aiming;
      plain.aim.update(1); fitted.aim.update(1); // fully ADS before comparing cones
      const weapon = new Weapon(base, { reloadSpeed: 1 });
      const effects = upgrades.attachments.laserPointer.effects;
      const ratio = aiming ? effects.adsSpread : effects.hipSpread;
      let shots = 0;
      // Actual cadence (including Foam Dart bursts), then a pause long enough to recover fully.
      for (let tick = 0; tick < 340; tick++) {
        plain.aim.update(dt); fitted.aim.update(dt);
        const result = weapon.update(dt, {
          triggerPressed: tick < 220 && !weapon.isBursting && weapon.cooldown < dt,
          triggerHeld: tick < 220,
        });
        closeTo(fitted.aim.spreadDegrees, plain.aim.spreadDegrees * ratio);
        if (result === 'fire') {
          shots++;
          plain.aim.onShot(); fitted.aim.onShot();
        }
      }
      assert.ok(shots > 2, `${base.id}: exercised repeated shots`);
      closeTo(plain.aim.spreadDegrees, base.spread.base * (aiming ? base.spread.adsMultiplier : 1));
    }
  }
});
