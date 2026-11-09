// The outfit rail's brain (game/outfitRail.js, g.outfitRail): each worn item's tag pulses on ITS trigger and nothing else, never when the
// item is only owned, never after death, and the rail's data (what is worn, what each item is doing, the receipt's DIED WEARING)
// is right. Triggers are driven through the real game: events, real keys, real zombies. The drawing (ui/outfitRail.js) is DOM and is
// checked in the browser; here only its data and its icons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { wardrobeItems, wardrobeSlots, outfitRail as cfg } from '../src/config/wardrobe.js';
import { triggers } from '../src/game/outfitRail.js';
import { ICON_IDS, iconSvg, slotSvg } from '../src/ui/outfitIcons.js';

function scenario(t) {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  game.tick();
  game.g.rounds.update = () => {};
  game.g.zombies.clear();
  return game;
}

const SLOTS = Object.keys(wardrobeSlots);
const idsIn = (slot) => Object.entries(wardrobeItems).filter(([, item]) => item.slot === slot).map(([id]) => id);

// Each driver causes its triggers the way the game does and says which trigger names it fired.
const hold = (game, codes, ticks) => {
  for (const code of codes) { game.input.pressed.add(code); game.input.held.add(code); }
  game.tick(ticks);
};
const release = (game, codes) => { for (const code of codes) game.input.held.delete(code); game.tick(10); };
const dummy = (game) => game.g.zombies.spawn('shopper', new Vector3(2, 0, 9)); // (a live zombie for a player attack to hit)
const drivers = {
  regenStart: { fires: ['regenStart'], run: (game) => game.g.events.emit('regenStart', {}) },
  hit: {
    fires: ['playerHit'],
    run: (game) => { game.g.stats.health = 60; game.g.events.emit('playerHit', { damage: 10, zombie: null, knockback: null }); },
  },
  hitAboveBase: { // (the extra health a Cardigan gives was in play)
    fires: ['playerHit', 'hitCushioned'],
    run: (game) => { game.g.stats.health = 120; game.g.events.emit('playerHit', { damage: 10, zombie: null, knockback: null }); },
  },
  paidKill: {
    fires: ['payingKill'],
    run: (game) => {
      const zombie = game.g.zombies.spawn('shopper', new Vector3(0, 0, 8));
      zombie.takeHit({ damage: zombie.health + 1, source: 'gun', part: 'body' });
    },
  },
  meleeHit: { fires: ['meleeHit'], run: (game) => game.g.events.emit('hit', { target: dummy(game), killed: false, headshot: false, melee: true }) },
  headshot: { fires: ['headshot'], run: (game) => game.g.events.emit('hit', { target: dummy(game), killed: false, headshot: true, melee: false }) },
  sprint: {
    fires: ['sprintStart'],
    run: (game) => { hold(game, ['KeyW', 'ShiftLeft'], 20); assert.equal(game.g.player.isSprinting, true, 'sprinting'); },
    after: (game) => release(game, ['KeyW', 'ShiftLeft']),
  },
  slide: {
    fires: ['slideStart'], // (a sprint first, then a tap of crouch)
    run: (game) => { hold(game, ['KeyW', 'ShiftLeft'], 20); game.input.pressed.add('KeyC'); game.tick(2); assert.equal(game.g.player.stance, 'slide'); },
    after: (game) => release(game, ['KeyW', 'ShiftLeft', 'KeyC']),
    also: ['sprintStart'], // (the sprint that leads into the slide is a sprint start too)
  },
  aim: {
    fires: ['aimStart'],
    run: (game) => { hold(game, ['Mouse2'], 15); assert.equal(game.g.player.isAiming, true, 'aiming'); },
    after: (game) => release(game, ['Mouse2']),
  },
  refill: {
    fires: ['ammoRefill'],
    run: (game) => { game.g.gun.weapon.reserve = 5; game.tick(2); game.g.gun.weapon.refill(); game.tick(2); },
  },
};

test('every item names a known trigger, an icon and a colour, and every slot has a silhouette', () => {
  for (const [id, item] of Object.entries(wardrobeItems)) {
    assert.ok(Object.hasOwn(triggers, item.pulse), `${id} pulse "${item.pulse}"`);
    assert.ok(ICON_IDS.includes(item.icon), `${id} icon "${item.icon}"`);
    assert.ok(Number.isInteger(item.color), `${id} colour`);
    assert.match(iconSvg(item.icon), /<svg/);
  }
  for (const slot of SLOTS) {
    assert.match(slotSvg(slot), /<path/, `${slot} silhouette`);
    assert.ok(cfg.emptyLabels[slot], `${slot} empty label`);
  }
  for (const name of Object.keys(triggers)) assert.ok(Object.values(wardrobeItems).some((item) => item.pulse === name), `trigger ${name} belongs to an item`);
  assert.equal(new Set(ICON_IDS).size, ICON_IDS.length);
});

test('each trigger pulses only the worn items that name it: all 12 items, in three outfits', (t) => {
  const game = scenario(t), { g } = game;
  g.player.teleport({ position: new Vector3(0, 0, 12), yaw: Math.PI }); // (the start room, facing the wall: nothing in the way)
  game.tick(2);
  for (let outfit = 0; outfit < 3; outfit++) {
    g.resetRun();
    game.tick(2);
    g.wallet.earn(1e6);
    const worn = SLOTS.map((slot) => idsIn(slot)[outfit]);
    for (const id of worn) g.wardrobe.buy(id);
    assert.deepEqual(SLOTS.map((slot) => g.wardrobe.wearing(slot)), worn);

    for (const [name, driver] of Object.entries(drivers)) {
      const before = { ...g.outfitRail.pulses };
      const pulsedEvents = [];
      const off = g.events.on('outfitPulse', (e) => pulsedEvents.push(e.id));
      driver.run(game);
      driver.after?.(game);
      off();
      const fired = [...driver.fires, ...(driver.also ?? [])];
      for (const id of Object.keys(wardrobeItems)) {
        const expected = worn.includes(id) && fired.includes(wardrobeItems[id].pulse) ? 1 : 0;
        const got = (g.outfitRail.pulses[id] ?? 0) - (before[id] ?? 0);
        assert.equal(got, expected, `outfit ${outfit}, ${name}: ${id} pulsed ${got}x, expected ${expected}`);
        assert.equal(pulsedEvents.filter((e) => e === id).length, expected, `${name}: ${id}'s 'outfitPulse' events`);
      }
      g.stats.health = g.stats.maxHealth; // (keep the run alive between drivers)
    }
  }
});

test('the Cardigan only reacts when the hit landed above the base max health; an owned item that is not worn never pulses', (t) => {
  const game = scenario(t), { g } = game;
  g.wallet.earn(1e6);
  g.wardrobe.buy('cardigan');
  g.wardrobe.buy('paperHat');
  g.wardrobe.buy('aviators'); // (replaces the hat: owned, not worn)
  g.stats.health = 100; // (a full bar at the base: the knit's extra 25 is not what took this one)
  g.events.emit('playerHit', { damage: 10, zombie: null, knockback: null });
  assert.equal(g.outfitRail.pulseCount('cardigan'), 0);
  g.stats.health = g.stats.maxHealth; // 125
  g.events.emit('playerHit', { damage: 10, zombie: null, knockback: null });
  assert.equal(g.outfitRail.pulseCount('cardigan'), 1);
  g.events.emit('regenStart', {});
  assert.equal(g.outfitRail.pulseCount('paperHat'), 0, 'the hat is owned but not on');
  assert.equal(g.outfitRail.pulseCount('aviators'), 0, 'the aviators are on but react to aiming only');
});

test('a gun swap is not a Fanny Pack refill, and a kill that pays no points does not pulse the Gold Card', (t) => {
  const game = scenario(t), { g } = game;
  g.wallet.earn(1e6);
  g.wardrobe.buy('fannyPack');
  g.wardrobe.buy('goldCard');
  g.wardrobe.buy('foamFinger'); // (replaces the pack: both are accessories) ...
  g.wardrobe.wear('fannyPack'); // ... and back
  g.gun.weapon.reserve = Math.round(g.gun.weapon.def.startingReserve * 0.5);
  game.tick(2);
  g.gun.weapon.refill();
  game.tick(2);
  assert.equal(g.outfitRail.pulseCount('fannyPack'), 1, 'a refill above the base pulses');
  g.wardrobe.wear('goldCard');
  const fan = g.zombies.spawn('shopper', new Vector3(0, 0, 8));
  fan.noRewards = true;
  fan.takeHit({ damage: fan.health + 1, source: 'gun', part: 'body' });
  assert.equal(g.outfitRail.pulseCount('goldCard'), 0, 'a fan actor pays nothing');
  const shopper = g.zombies.spawn('shopper', new Vector3(1, 0, 8));
  shopper.takeHit({ damage: shopper.health + 1, source: 'gun', part: 'body' });
  assert.equal(g.outfitRail.pulseCount('goldCard'), 1);
});

test('nothing pulses once you are dead, the death summary records what you wore, and Play again clears the rail', (t) => {
  const game = scenario(t), { g } = game;
  g.wallet.earn(1e6);
  for (const id of ['paperHat', 'sandwichBoard', 'wheelieSneakers', 'goldCard']) g.wardrobe.buy(id);
  g.events.emit('playerHit', { damage: 10, zombie: null, knockback: null });
  assert.equal(g.outfitRail.pulseCount('sandwichBoard'), 1);
  g.health.takeDamage(1e6);
  game.tick(2);
  assert.equal(g.state.over, true);
  assert.deepEqual({ ...g.death.summary.wearing }, { head: 'paperHat', torso: 'sandwichBoard', feet: 'wheelieSneakers', accessory: 'goldCard' });
  assert.ok(Object.isFrozen(g.death.summary.wearing));
  g.events.emit('playerHit', { damage: 10, zombie: null, knockback: null });
  g.events.emit('regenStart', {});
  assert.equal(g.outfitRail.pulseCount('sandwichBoard'), 1, 'still 1: the dead do not swing');
  assert.equal(g.outfitRail.pulseCount('paperHat'), 0);

  g.resetRun();
  game.tick(2);
  assert.deepEqual(g.outfitRail.pulses, {});
  assert.ok(g.outfitRail.snapshot().every((tag) => tag.id === null && tag.lines.length === 0 && tag.color === null));
});

test('the rail snapshot lists four slots with the worn item and what it is doing (the pause screen prints these lines)', (t) => {
  const game = scenario(t), { g } = game;
  const empty = g.outfitRail.snapshot();
  assert.deepEqual(empty.map((tag) => tag.slot), SLOTS);
  assert.ok(empty.every((tag) => tag.id === null), 'round 1: four empty silhouettes');
  g.wallet.earn(1e6);
  g.wardrobe.buy('cardigan');
  g.wardrobe.buy('hiVisVest'); // (replaces it: torso)
  g.wardrobe.buy('lightUpSneakers');
  const tags = Object.fromEntries(g.outfitRail.snapshot().map((tag) => [tag.slot, tag]));
  assert.equal(tags.torso.id, 'hiVisVest');
  assert.equal(tags.torso.shortName, 'Hi-Vis Vest');
  assert.equal(tags.torso.color, wardrobeItems.hiVisVest.color);
  assert.equal(tags.torso.icon, 'vest');
  assert.equal(tags.head.id, null);
  const text = tags.torso.lines.map((l) => l.text);
  assert.ok(text.includes('Reload 25% faster'), text.join(' | '));
  assert.ok(text.includes('Zombie hits hurt 25% more'));
  assert.equal(tags.torso.lines.find((l) => l.text.startsWith('Reload')).good, true);
  assert.equal(tags.torso.lines.find((l) => l.text.startsWith('Zombie hits')).good, false);
  assert.equal(tags.torso.lines[0].good, true, 'upsides first');
  assert.ok(tags.feet.lines.some((l) => /^Sprint speed \d+\.\d m\/s → \d+\.\d m\/s$/.test(l.text)), tags.feet.lines.map((l) => l.text).join(' | '));
  // the lines describe the item as worn: the stat after equals the live stat
  const after = Number(tags.feet.lines.find((l) => l.text.startsWith('Sprint speed')).text.match(/→ ([\d.]+)/)[1]);
  assert.equal(after, Number(g.stats.sprintSpeed.toFixed(1)));
  assert.deepEqual(g.wardrobe.wornLines('cardigan'), [], 'an item that is not worn has no lines');
});
