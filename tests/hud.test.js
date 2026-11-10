import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';
import { headlessGame } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { gunLabel, workshopStuffings } from '../src/config/workshop.js';
import { upgrades } from '../src/config/upgrades.js';

menuDom();
const { createHud } = await import('../src/ui/hud.js');

test('createHud initializes with inactive secondary indicator hidden', () => {
  menuDom();
  const hud = createHud();
  const secondary = hud.element.querySelector('.ammo-secondary');
  assert.ok(secondary, 'secondary ammo element exists in HUD');
  assert.equal(secondary.hidden, true, 'hidden initially');
  assert.equal(secondary.classList.contains('show'), false, 'does not have show class');
});

test('playerGun inactiveSlot / secondaryDef returns null when carrying one gun, and slot data when carrying two', () => {
  const t = headlessGame();
  const { gun } = t.g;

  // Single starting gun
  assert.equal(gun.inactiveSlot, null);
  assert.equal(gun.secondaryDef, null);

  // Give second gun
  gun.give(weapons.priceGun);
  assert.ok(gun.inactiveSlot, 'inactiveSlot is populated');
  assert.ok(gun.secondaryDef, 'secondaryDef is populated');
  assert.equal(gun.inactiveSlot.def.id, 'stapleGun', 'staple gun is now in reserve');
  assert.equal(gun.inactiveSlot.index, 0);
  assert.equal(gun.def.id, 'priceGun', 'price gun is in hand');
});

test('HUD setAmmo updates secondary weapon display on weapon pickup, switch, and upgrades', () => {
  menuDom();
  const events = {
    listeners: new Map(),
    on(name, fn) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(fn);
    },
    emit(name, payload) {
      for (const fn of this.listeners.get(name) ?? []) fn(payload);
    },
  };

  const hud = createHud();
  hud.connectEvents(events);

  const t = headlessGame();
  const { gun } = t.g;

  const secondaryEl = hud.element.querySelector('.ammo-secondary');
  const nameEl = hud.element.querySelector('.ammo-secondary-name');
  const keyEl = hud.element.querySelector('.ammo-secondary-key');
  const ammoEl = hud.element.querySelector('.ammo-secondary-ammo');
  const pipEl = hud.element.querySelector('.ammo-secondary-pip');

  // 1. Initial 1-gun state
  hud.setAmmo(gun.weapon, 'R', gun.inactiveSlot);
  assert.equal(secondaryEl.hidden, true);
  assert.equal(secondaryEl.classList.contains('show'), false);

  // 2. Pickup second gun (Price Gun)
  gun.give(weapons.priceGun);
  t.tick(40);
  // priceGun is in hand (current = 1); stapleGun is inactive (slot 0)
  hud.setAmmo(gun.weapon, 'R', gun.inactiveSlot, '1');

  assert.equal(secondaryEl.hidden, false);
  assert.equal(secondaryEl.classList.contains('show'), true);
  assert.equal(nameEl.textContent, gunLabel(weapons.stapleGun));
  assert.equal(keyEl.textContent, '[1]');
  assert.equal(ammoEl.textContent, String(gun.inactiveSlot.weapon.reserve));
  assert.equal(pipEl.style.display, 'none', 'plain gun has no upgrade pip');

  // 3. Upgrade inactive gun with warranty tier (Deluxe)
  gun.setMods('stapleGun', [{ id: 'tier', tier: 'deluxe' }]);
  hud.setAmmo(gun.weapon, 'R', gun.inactiveSlot, '1');

  const deluxeColor = `#${upgrades.tiers.find((x) => x.id === 'deluxe').color.toString(16).padStart(6, '0')}`;
  assert.equal(pipEl.style.display, 'inline-block');
  assert.equal(pipEl.style.backgroundColor, deluxeColor);

  // 4. Upgrade with Build-A-Blaster mod
  gun.setMods('stapleGun', [{ id: 'build', build: { stuffing: 'popcornButter', heart: 'lastRound', quality: 'standard' } }]);
  hud.setAmmo(gun.weapon, 'R', gun.inactiveSlot, '1');
  const butterColor = `#${workshopStuffings.popcornButter.color.toString(16).padStart(6, '0')}`;
  assert.equal(pipEl.style.display, 'inline-block');
  assert.equal(pipEl.style.backgroundColor, butterColor);

  // 5. Weapon switch
  // Switching brings stapleGun to hand and priceGun to inactive
  t.press('Digit1');
  t.tick(40);

  hud.setAmmo(gun.weapon, 'R', gun.inactiveSlot, '2');
  assert.equal(nameEl.textContent, gunLabel(weapons.priceGun));
  assert.equal(keyEl.textContent, '[2]');
  assert.equal(ammoEl.textContent, String(gun.inactiveSlot.weapon.reserve));
  assert.equal(secondaryEl.classList.contains('switched'), true, 'switched class triggered on weapon switch');

  // 6. Play again reset (runReset)
  events.emit('runReset');
  assert.equal(secondaryEl.hidden, true);
  assert.equal(secondaryEl.classList.contains('show'), false);
  assert.equal(secondaryEl.classList.contains('switched'), false);

  // Calling reset on gun and updating HUD restores single-gun state
  gun.reset();
  hud.setAmmo(gun.weapon, 'R', gun.inactiveSlot);
  assert.equal(secondaryEl.hidden, true);
  assert.equal(secondaryEl.classList.contains('show'), false);
});

test('createGame runs without DOM pollution', () => {
  const t = headlessGame();
  t.tick();
  t.g.gun.give(weapons.priceGun);
  t.tick();
  assert.ok(t.g.gun.inactiveSlot);
  t.g.resetRun();
  t.tick();
  assert.equal(t.g.gun.inactiveSlot, null);
});
