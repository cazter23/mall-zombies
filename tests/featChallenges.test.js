// Weapon skins phase 7: the eleven slot 3 (feat) challenges. Each happens inside one run, counted from events only; its progress is the
// best attempt (never a sum), and the tracker hears how the attempt in progress stands ('challengeLive').
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { skins, skinStorage, skinNotices, challengeText } from '../src/config/skins.js';
import { weapons } from '../src/config/weapons.js';
import { createEvents } from '../src/game/events.js';
import { createSkinSave } from '../src/game/skinSave.js';
import { createChallenges } from '../src/game/challenges.js';
import { headlessGame } from './helpers/headlessGame.js';

const featOf = gunId => skins[gunId].find(skin => skin.slot === 3);

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    get record() { return JSON.parse(values.get(skinStorage.key) ?? 'null'); },
  };
}

function counters(storage = memoryStorage()) {
  const events = createEvents();
  const state = { assisted: false, over: false };
  const save = createSkinSave({ storage });
  const challenges = createChallenges({ events, state, save });
  const unlocks = [], live = [];
  events.on('skinUnlocked', event => unlocks.push(event));
  events.on('challengeLive', event => live.push(event));
  const progress = gunId => save.progress(gunId, featOf(gunId).id);
  const tick = () => challenges.update(1 / 60);
  return { events, state, save, challenges, unlocks, live, storage, progress, tick };
}

const zombie = (extra = {}) => ({ type: { id: 'shopper' }, isAlive: false, woundedBy: new Set(), ...extra });
const boss = (woundedBy, extra = {}) => zombie({ type: { id: 'janitor', boss: {} }, woundedBy: new Set(woundedBy), ...extra });
const kill = (t, weaponId, extra = {}) => t.events.emit('kill', { weaponId, zombie: zombie(), headshot: false, melee: false, source: 'gun',
  distance: 5, bounces: null, projectile: null, firstWound: null, woundedBy: [weaponId], ...extra });
const shot = (t, weaponId, extra = {}) => t.events.emit('shot', { weaponId, hits: [], magazineLeft: 5, ...extra });
const hitOn = (target, part = 'body') => ({ target, part });
const round = (t, n) => t.events.emit('roundStart', { round: n });

// For each gun: `earn` completes its feat from a fresh run; `near` is the closest attempt that must not.
const CASES = {
  stapleGun: {
    earn: t => { for (let r = 1; r <= 15; r++) { round(t, r); shot(t, 'stapleGun'); } },
    near: t => {
      round(t, 1);
      t.events.emit('purchase', { kind: 'weapon', id: 'priceGun', cost: 500 }); // bought another gun (never fired)
      for (let r = 2; r <= 15; r++) round(t, r);
    },
  },
  priceGun: {
    earn: t => kill(t, 'priceGun', { zombie: boss(['priceGun']) }),
    near: t => kill(t, 'priceGun', { zombie: boss(['priceGun', 'stapleGun']) }), // the Staple Gun chipped it once
  },
  nailGun: {
    earn: t => { round(t, 3); for (let i = 0; i < 40; i++) kill(t, 'nailGun'); },
    near: t => { round(t, 3); for (let i = 0; i < 39; i++) kill(t, 'nailGun'); round(t, 4); for (let i = 0; i < 39; i++) kill(t, 'nailGun'); },
  },
  foamDartBlaster: {
    earn: t => { round(t, 12); for (let i = 0; i < 30; i++) kill(t, 'foamDartBlaster', { headshot: true }); round(t, 13); },
    near: t => {
      round(t, 11); for (let i = 0; i < 30; i++) kill(t, 'foamDartBlaster', { headshot: true }); round(t, 12); // too early
      for (let i = 0; i < 30; i++) kill(t, 'foamDartBlaster', { headshot: true });
      kill(t, null, { source: 'melee', melee: true }); // one box cutter kill spoils round 12
      round(t, 13);
    },
  },
  confettiCannon: {
    earn: t => {
      const mascot = zombie({ type: { id: 'mascot', mascot: {} }, isAlive: true, woundedBy: new Set(['stapleGun']) });
      t.events.emit('mascotHeadPop', { zombie: mascot, again: false }); t.tick();
      mascot.isAlive = false; mascot.woundedBy.add('confettiCannon');
      kill(t, 'confettiCannon', { zombie: mascot });
    },
    near: t => {
      const mascot = zombie({ type: { id: 'mascot', mascot: {} }, isAlive: true, woundedBy: new Set(['stapleGun']) });
      t.events.emit('mascotHeadPop', { zombie: mascot, again: false }); t.tick();
      mascot.woundedBy.add('confettiCannon');
      shot(t, 'confettiCannon', { hits: [hitOn(mascot), hitOn(mascot)] }); t.tick(); // a blast that left it standing
      mascot.isAlive = false;
      kill(t, 'confettiCannon', { zombie: mascot });
    },
  },
  rivetRifle: {
    earn: t => { for (let i = 0; i < 20; i++) { kill(t, 'rivetRifle', { headshot: true }); shot(t, 'rivetRifle', { hits: [hitOn(zombie(), 'head')] }); } },
    near: t => {
      for (let i = 0; i < 19; i++) kill(t, 'rivetRifle', { headshot: true });
      shot(t, 'rivetRifle', { hits: [hitOn(zombie({ isAlive: true }), 'body')] }); // one body shot
      for (let i = 0; i < 19; i++) kill(t, 'rivetRifle', { headshot: true });
    },
  },
  coilNailer: {
    earn: t => { kill(t, 'coilNailer', { zombie: boss(['coilNailer']) }); kill(t, 'coilNailer', { zombie: boss(['coilNailer', 'priceGun']) }); },
    near: t => { kill(t, 'coilNailer', { zombie: boss(['coilNailer']) }); kill(t, 'priceGun', { zombie: boss(['coilNailer', 'priceGun']) }); },
  },
  barcodeScanner: {
    earn: t => { round(t, 4); for (let i = 0; i < 25; i++) shot(t, 'barcodeScanner', { hits: [hitOn(zombie())] }); round(t, 5); },
    near: t => {
      round(t, 4); for (let i = 0; i < 24; i++) shot(t, 'barcodeScanner', { hits: [hitOn(zombie())] }); round(t, 5); // too few shots
      for (let i = 0; i < 30; i++) shot(t, 'barcodeScanner', { hits: i === 7 ? [] : [hitOn(zombie())] }); round(t, 6); // one miss
    },
  },
  leafBlower: {
    earn: t => {
      round(t, 8);
      for (let i = 0; i < 10; i++) shot(t, 'leafBlower', { cone: true, hits: [{ target: zombie({ isAlive: true }), interrupted: true }] });
      round(t, 9);
    },
    near: t => {
      round(t, 8);
      for (let i = 0; i < 12; i++) shot(t, 'leafBlower', { cone: true, hits: [{ target: zombie({ isAlive: true }), interrupted: true }] });
      t.events.emit('playerHit', { damage: 30 }); // hurt once
      round(t, 9);
    },
  },
  tennisBallLauncher: {
    earn: t => { for (let i = 0; i < 3; i++) kill(t, 'tennisBallLauncher', { projectile: 7 }); },
    near: t => { kill(t, 'tennisBallLauncher', { projectile: 7 }); kill(t, 'tennisBallLauncher', { projectile: 7 }); kill(t, 'tennisBallLauncher', { projectile: 8 }); },
  },
  returnToSender: {
    earn: t => kill(t, 'returnToSender', { zombie: zombie({ type: { id: 'lastCustomer', boss: {} } }) }),
    near: t => kill(t, 'returnToSender', { zombie: boss(['returnToSender']) }),
  },
};

test('every gun has exactly one feat (slot 3) with a counter, a sentence built from its own data and a tracker line', () => {
  assert.deepEqual(Object.keys(CASES).sort(), Object.keys(skins).sort());
  for (const [gunId, entries] of Object.entries(skins)) {
    assert.deepEqual(entries.map(skin => skin.slot), [1, 2, 3], gunId);
    const { challenge, treatment } = featOf(gunId);
    assert.ok(Number.isSafeInteger(challenge.count) && challenge.count > 0, gunId);
    assert.ok(treatment, `${gunId}: a feat skin has a treatment`);
    const text = challengeText(challenge, weapons[gunId].name);
    assert.ok(text.includes(weapons[gunId].name) && !/[{}]/.test(text), text);
    assert.equal(typeof challenge.track, 'string', gunId);
  }
});

for (const [gunId, { earn, near }] of Object.entries(CASES)) {
  const skin = featOf(gunId);
  test(`${skin.name} (${gunId}): ${challengeText(skin.challenge, weapons[gunId].name)}`, () => {
    const t = counters();
    near(t);
    assert.equal(t.save.unlocked(gunId, skin.id), false, 'the near miss earns nothing');
    assert.equal(t.unlocks.length, 0);

    const u = counters();
    earn(u);
    assert.equal(u.save.unlocked(gunId, skin.id), true, 'the feat unlocks its skin');
    assert.equal(u.progress(gunId), skin.challenge.count);
    assert.deepEqual(u.unlocks.map(event => event.skinId), [skin.id], 'exactly one unlock, and no other gun moved');
    assert.deepEqual(u.unlocks[0].pa, skinNotices.pa(weapons[gunId].name, skin.name, 3));
    assert.equal(u.storage.record.unlocked[gunId][skin.id], true, 'written at once');

    const v = counters();
    v.state.assisted = true;
    earn(v);
    assert.equal(v.save.unlocked(gunId, skin.id), false, 'nothing counts in an assisted run');
  });
}

test('a feat records its best attempt, never a sum: two rounds of 30 Nail Gun kills are 30, not 60', () => {
  const t = counters();
  round(t, 5); for (let i = 0; i < 30; i++) kill(t, 'nailGun');
  round(t, 6); for (let i = 0; i < 25; i++) kill(t, 'nailGun');
  assert.equal(t.progress('nailGun'), 30);
  round(t, 7); for (let i = 0; i < 33; i++) kill(t, 'nailGun');
  assert.equal(t.progress('nailGun'), 33);
  assert.deepEqual(t.challenges.attempt('nailGun', 'rush-order'), { value: 33, needed: 40, failed: false });
});

test('the tracker hears an attempt fail: a body shot breaks the streak, a hit spoils the calm round, another gun spoils loyalty', () => {
  const t = counters();
  for (let i = 0; i < 5; i++) kill(t, 'rivetRifle', { headshot: true });
  shot(t, 'rivetRifle', { hits: [hitOn(zombie({ isAlive: true }), 'body')] });
  assert.deepEqual(t.live.filter(e => e.gunId === 'rivetRifle').at(-1), { gunId: 'rivetRifle', skinId: 'gold-standard', value: 5, needed: 20, failed: true });
  kill(t, 'rivetRifle', { headshot: true });
  assert.deepEqual(t.challenges.attempt('rivetRifle', 'gold-standard'), { value: 1, needed: 20, failed: false }, 'and starts again');
  assert.equal(t.progress('rivetRifle'), 5, 'the best run is kept');

  round(t, 8);
  t.events.emit('playerFall', { drop: 5, damage: 20 });
  assert.equal(t.challenges.attempt('leafBlower', 'still-air').failed, true);

  const u = counters(); // (the Rivet Rifle above already spoiled loyalty there)
  round(u, 1); round(u, 2);
  shot(u, 'priceGun');
  assert.equal(u.challenges.attempt('stapleGun', 'company-man').failed, true);
  round(u, 3);
  assert.equal(u.progress('stapleGun'), 2, 'loyalty stops at the round reached before it was spoiled');
});

test('a round thrown away (a debug jump) decides nothing, and a debug jump spoils loyalty', () => {
  const t = counters();
  round(t, 12);
  for (let i = 0; i < 20; i++) kill(t, 'foamDartBlaster', { headshot: true });
  t.events.emit('roundDiscard', { reason: 'debug' });
  round(t, 13);
  assert.equal(t.progress('foamDartBlaster'), 0);
  const u = counters();
  round(u, 1);
  u.events.emit('roundDiscard', { reason: 'debug' });
  round(u, 20);
  assert.equal(u.progress('stapleGun'), 0, 'jumping to round 20 is not reaching it');
});

test('once the player is dead nothing counts, and a noRewards fan is never a feat', () => {
  const t = counters();
  for (let i = 0; i < 3; i++) kill(t, 'tennisBallLauncher', { projectile: 1, zombie: zombie({ noRewards: true }) });
  t.state.over = true;
  for (let i = 0; i < 3; i++) kill(t, 'tennisBallLauncher', { projectile: 2 });
  assert.equal(t.progress('tennisBallLauncher'), 0);
});

test('Save & Quit keeps run feats where the round began: a streak, the bosses so far, loyalty and the round a round feat is on', () => {
  const t = counters();
  round(t, 9);
  for (let i = 0; i < 7; i++) kill(t, 'rivetRifle', { headshot: true });
  kill(t, 'coilNailer', { zombie: boss(['coilNailer']) });
  shot(t, 'priceGun'); // loyalty spoiled
  const saved = t.challenges.serialize();
  assert.deepEqual(saved.run['rivetRifle/gold-standard'], { streak: 7 });
  assert.deepEqual(saved.run['coilNailer/double-shift'], { bosses: 1 });
  assert.deepEqual(saved.run['stapleGun/company-man'], { spoiled: true });
  assert.deepEqual(saved.run['leafBlower/still-air'], { round: 9 });

  const again = counters(t.storage);
  again.challenges.restore(saved);
  kill(again, 'coilNailer', { zombie: boss(['coilNailer']) });
  assert.equal(again.save.unlocked('coilNailer', 'double-shift'), true, 'the second boss of the run completes it');
  for (let i = 0; i < 13; i++) kill(again, 'rivetRifle', { headshot: true });
  assert.equal(again.save.unlocked('rivetRifle', 'gold-standard'), true, 'the streak carried on');
  // The leaf blower's round 9 is replayed from its break and still counts, without a new 'roundStart'.
  for (let i = 0; i < 10; i++) shot(again, 'leafBlower', { cone: true, hits: [{ target: zombie({ isAlive: true }), interrupted: true }] });
  round(again, 10);
  assert.equal(again.save.unlocked('leafBlower', 'still-air'), true);
  again.challenges.reset();
  assert.equal(again.challenges.serialize().run['rivetRifle/gold-standard'].streak, 0, 'Play again starts every feat over');
});

// --- In the real game: the kill names what hurt it and which ball made it; a hit names its gun ---

function realGame(context) {
  const save = createSkinSave({ storage: memoryStorage() });
  const t = headlessGame({ skinSave: save });
  context.after(() => t.g.map.dispose());
  t.g.rounds.update = () => {};
  t.tick();
  return { ...t, save };
}

test('a kill reports woundedBy (every gun or source that hurt it) and the lethal ball; a gun hit names its gun', context => {
  const t = realGame(context);
  const kills = [], hits = [];
  t.g.events.on('kill', event => kills.push(event));
  t.g.events.on('hit', event => hits.push(event));
  const z = t.g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 9));
  z.speed = 0; z.health = 100;
  z.takeHit({ damage: 30, part: 'body', weaponId: 'stapleGun' });
  z.takeHit({ damage: 30, part: 'body', melee: true });
  z.takeHit({ damage: 0, part: 'body', weaponId: 'nailGun' }); // no damage: not a wound
  z.takeHit({ damage: 50, part: 'body', weaponId: 'tennisBallLauncher', bounces: 1, projectile: 42 });
  assert.deepEqual(kills.at(-1).woundedBy, ['stapleGun', 'melee', 'tennisBallLauncher']);
  assert.equal(kills.at(-1).projectile, 42);

  // A staple from the gun in hand: its 'hit' carries the gun's id.
  const target = t.g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 7));
  target.setState('chasing'); target.speed = 0; target.attackCooldown = 99; target.health = 10000; target.updateHitboxes();
  t.standAt(0, 12);
  const point = target.hitboxes.find(h => h.part === 'body').box.getCenter(new THREE.Vector3());
  t.g.player.pitch = Math.atan2(point.y - t.g.player.eyeHeight, 12 - point.z);
  t.input.held.add('Mouse2');
  t.tick(30);
  t.press('Mouse0');
  t.input.held.delete('Mouse2');
  assert.equal(hits.at(-1)?.target, target);
  assert.equal(hits.at(-1).weaponId, 'stapleGun');
});
