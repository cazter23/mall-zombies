import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { attachmentCounterItem } from '../src/game/features/attachmentCounter.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { attachmentFits, attachmentLines, withAttachment, withTier } from '../src/weapons/upgrades.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { Weapon } from '../src/weapons/weapon.js';
import { economy } from '../src/config/economy.js';

test('attachment Flash Sales stop being offered once every run unlock is owned', () => {
  const groups = economy.flashSales.groups;
  economy.flashSales.groups = groups.filter(g => g.id === 'attachments');
  const { g } = headlessGame();
  try {
    assert.equal(g.flashSales.startNow(), true);
    g.flashSales.reset();
    for (const spot of g.map.features.filter(f => f.kind === 'attachmentCounter')) {
      attachmentCounterItem({ spot, zones: g.map.zones, gun: g.gun, pricing: g.pricing }).use();
    }
    assert.equal(g.flashSales.startNow(), false);
  } finally { g.map.dispose(); economy.flashSales.groups = groups; }
});

test('real counter purchases unlock for the run; swaps and replacement weapons refit free; reset clears ownership', () => {
  const t = headlessGame(), { g } = t;
  t.tick(); g.rounds.update = () => {}; g.zombies.clear(); g.health.invulnerable = true;
  for (const door of g.map.doors) door.open(); t.tick(120); g.wallet.earn(10000);
  const counter = id => attachmentCounterItem({ spot: g.map.features.find(f => f.attachment === id), zones: g.map.zones, gun: g.gun, pricing: g.pricing });
  const fit = id => {
    const spot = g.map.features.find(f => f.attachment === id), position = spot.position.clone().addScaledVector(spot.normal, 1.1); position.y = 0;
    g.player.teleport({ position, yaw: Math.atan2(spot.normal.x, spot.normal.z) }); t.tick();
    assert.equal(g.interactions.prompt?.id, id);
    const cost = g.interactions.prompt.cost, before = g.wallet.points;
    t.press('KeyF', 30); assert.equal(before - g.wallet.points, cost); return cost;
  };
  try {
    g.pricing.setDiscount('attachment', .25);
    assert.equal(fit('jumboPack'), 750, 'first purchase uses the live discount');
    g.pricing.setDiscount('attachment', 0);
    assert.equal(fit('speedLoader'), 1000);
    assert.equal(counter('jumboPack').cost, 0);
    assert.match(counter('jumboPack').detail, /Owned this run.*bigger magazine.*Reloads .* slower/);
    const total = g.gun.weapon.magazine + g.gun.weapon.reserve;
    assert.equal(fit('jumboPack'), 0); assert.equal(g.gun.weapon.magazine + g.gun.weapon.reserve, total);
    g.gun.give(weapons.priceGun); t.tick(40);
    assert.equal(fit('jumboPack'), 0, 'same unlock works on another gun');
    g.gun.give(weapons.foamDartBlaster); t.tick(40);
    assert.equal(fit('jumboPack'), 0, 'ownership survives replacing a weapon');
    g.gun.weapon.magazine = 0; g.gun.weapon.startReload();
    assert.equal(counter('speedLoader').available(), false, 'refitting cannot bypass reloads');
    g.resetRun(); assert.equal(counter('jumboPack').cost, 1000);
  } finally { g.map.dispose(); }
});

test('shrinking and expanding magazines conserve ammunition, including full reserves, and preserve fire cooldown', () => {
  const base = weapons.priceGun, stats = { reloadSpeed: 1 }, w = new Weapon(base, stats);
  w.cooldown = .25;
  const total = w.magazine + w.reserve;
  for (let i = 0; i < 10; i++) for (const id of ['speedLoader', 'jumboPack']) {
    w.setDef(resolveGun(base, withAttachment(base, [], id)));
    assert.equal(w.magazine + w.reserve, total); assert.equal(w.cooldown, .25);
  }
  w.setDef(resolveGun(base, withAttachment(base, [], 'speedLoader')));
  w.refill(); assert.ok(w.reserve >= base.startingReserve, 'restocking never destroys stored excess rounds');
});

test('all four-slot builds resolve with whole counts and meaningful comparisons at each warranty tier', () => {
  const slots = Object.values(upgrades.attachmentSlots), choices = Object.keys(upgrades.attachmentSlots).map(slot => Object.keys(upgrades.attachments).filter(id => upgrades.attachments[id].slot === slot));
  assert.equal(slots.length, 4);
  for (const base of Object.values(weapons)) for (const tier of upgrades.tiers) for (let mask = 0; mask < 16; mask++) {
    let mods = withTier(base, [], tier.id);
    choices.forEach((ids, i) => { const id = ids[(mask >> i) & 1]; if (attachmentFits(base, id)) mods = withAttachment(base, mods, id); });
    const gun = resolveGun(base, mods);
    assert.ok(Number.isInteger(gun.magazineSize) && gun.magazineSize > 0);
    assert.ok(gun.damage > 0 && gun.ads.seconds > 0 && gun.recoil.pitchDegrees > 0);
    for (const id of choices[3]) assert.ok(attachmentLines(id).length > 0, `${id} says what it does`);
  }
});
