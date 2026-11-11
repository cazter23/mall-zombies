// Weapon skins phase 6: the eleven slot 2 (role) challenges. Each counts what its gun is for, from events only,
// through the same advance path as mastery (so the Save & Quit replay rule and the assisted/over/noRewards rules hold).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { skins, skinStorage, skinNotices, challengeText } from '../src/config/skins.js';
import { weapons } from '../src/config/weapons.js';
import { createEvents } from '../src/game/events.js';
import { createSkinSave } from '../src/game/skinSave.js';
import { createChallenges } from '../src/game/challenges.js';
import { headlessGame } from './helpers/headlessGame.js';

const role = gunId => skins[gunId].find(skin => skin.slot === 2);

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
  const unlocks = [];
  events.on('skinUnlocked', event => unlocks.push(event));
  const progress = gunId => save.progress(gunId, role(gunId).id);
  return { events, state, save, challenges, unlocks, storage, progress };
}

const shopper = (extra = {}) => ({ type: { id: 'shopper' }, isAlive: false, ...extra });
const kill = (t, weaponId, extra = {}) => t.events.emit('kill', { weaponId, zombie: shopper(), headshot: false, melee: false, source: 'gun',
  distance: 5, bounces: null, firstWound: { weaponId, seconds: 0.2 }, ...extra });
const deadBy = (weaponId, extra = {}) => ({ target: shopper({ killedByWeaponId: weaponId, ...extra }) });
const shot = (t, weaponId, extra = {}) => t.events.emit('shot', { weaponId, hits: [], magazineLeft: 5, ...extra });
// One magazine of `shots` nails, every one hitting unless `miss` says which (0-based) did not.
function magazine(t, shots = 10, miss = -1) {
  for (let i = 0; i < shots; i++) {
    shot(t, 'nailGun', { magazineLeft: shots - 1 - i, hits: i === miss ? [] : [{ target: shopper({ isAlive: true }) }] });
  }
}

// For each gun: `earn` adds exactly one to its role challenge; `near` is the closest thing that must add nothing.
const CASES = {
  stapleGun: {
    earn: t => kill(t, 'stapleGun', { headshot: true }),
    near: t => { kill(t, 'stapleGun', { headshot: false }); kill(t, 'priceGun', { headshot: true }); },
  },
  priceGun: {
    earn: t => kill(t, 'priceGun', { firstWound: { weaponId: 'priceGun', seconds: 1 } }),
    near: t => {
      kill(t, 'priceGun', { firstWound: { weaponId: 'priceGun', seconds: 1.02 } }); // a moment too slow
      kill(t, 'priceGun', { firstWound: { weaponId: 'stapleGun', seconds: 0.1 } }); // another gun drew first blood
    },
  },
  nailGun: {
    earn: t => magazine(t),
    near: t => { magazine(t, 10, 9); magazine(t, 9); }, // the last nail missed; a magazine short of ten nails
  },
  foamDartBlaster: {
    earn: t => kill(t, 'foamDartBlaster', { distance: 15 }),
    near: t => { kill(t, 'foamDartBlaster', { distance: 14.9 }); kill(t, 'foamDartBlaster', { distance: null, source: 'build' }); },
  },
  confettiCannon: {
    earn: t => shot(t, 'confettiCannon', { hits: [deadBy('confettiCannon'), deadBy('confettiCannon'), deadBy('confettiCannon')] }),
    near: t => {
      const twice = deadBy('confettiCannon');
      shot(t, 'confettiCannon', { hits: [twice, twice, deadBy('confettiCannon'), { target: shopper({ isAlive: true }) }] }); // two pellets, one zombie
    },
  },
  rivetRifle: {
    earn: t => kill(t, 'rivetRifle', { headshot: true, distance: 10 }),
    near: t => { kill(t, 'rivetRifle', { headshot: true, distance: 9.9 }); kill(t, 'rivetRifle', { headshot: false, distance: 20 }); },
  },
  coilNailer: {
    earn: t => kill(t, 'coilNailer', { zombie: shopper({ type: { id: 'cartPusher' } }) }),
    near: t => kill(t, 'coilNailer', { zombie: shopper({ type: { id: 'mallWalker' } }) }),
  },
  barcodeScanner: {
    earn: t => shot(t, 'barcodeScanner', { hits: [deadBy('barcodeScanner'), deadBy('barcodeScanner')] }),
    near: t => shot(t, 'barcodeScanner', { hits: [deadBy('barcodeScanner'), deadBy('rivetRifle')] }), // the second was another gun's kill
  },
  leafBlower: {
    earn: t => shot(t, 'leafBlower', { cone: true, hits: [{ target: shopper({ isAlive: true }), interrupted: true }] }),
    near: t => shot(t, 'leafBlower', { cone: true, hits: [{ target: shopper({ isAlive: true }), interrupted: false }] }),
  },
  tennisBallLauncher: {
    earn: t => kill(t, 'tennisBallLauncher', { bounces: 1 }),
    near: t => kill(t, 'tennisBallLauncher', { bounces: 0 }),
  },
  returnToSender: {
    earn: t => kill(t, 'returnToSender', { zombie: shopper({ type: { id: 'janitor', boss: {} } }) }),
    near: t => kill(t, 'returnToSender', { zombie: shopper({ type: { id: 'mascot', mascot: {} } }) }),
  },
};

test('every gun has exactly one role challenge, each with a counter and a sentence built from its own data', () => {
  assert.deepEqual(Object.keys(CASES).sort(), Object.keys(skins).sort());
  for (const [gunId, entries] of Object.entries(skins)) {
    assert.equal(entries.filter(skin => skin.slot === 2).length, 1, gunId);
    const { challenge } = role(gunId);
    assert.ok(Number.isSafeInteger(challenge.count) && challenge.count > 0, gunId);
    const text = challengeText(challenge, weapons[gunId].name);
    assert.ok(text.includes(weapons[gunId].name) && text.includes(String(challenge.count)) && !/[{}]/.test(text), text);
  }
  assert.equal(challengeText(skins.rivetRifle[1].challenge, 'Rivet Rifle'), 'Land 150 headshot kills from 10 m or more with the Rivet Rifle.');
});

for (const [gunId, { earn, near }] of Object.entries(CASES)) {
  test(`${gunId} role: counts its case, not the nearest one, and unlocks once`, () => {
    const t = counters();
    const skin = role(gunId);
    near(t);
    assert.equal(t.progress(gunId), 0, 'the nearest case adds nothing');
    earn(t);
    assert.equal(t.progress(gunId), 1);
    t.save.record(gunId, skin.id, skin.challenge.count - 1);
    earn(t);
    earn(t);
    assert.equal(t.progress(gunId), skin.challenge.count);
    assert.deepEqual(t.unlocks.map(({ gunId: g, skinId }) => `${g}/${skinId}`), [`${gunId}/${skin.id}`], 'one unlock');
    assert.deepEqual(t.unlocks[0].pa, skinNotices.pa(weapons[gunId].name, skin.name, 2));
    assert.equal(t.storage.record.unlocked[gunId][skin.id], true, 'the unlock is written at once');
  });

  test(`${gunId} role: nothing counts while assisted or after the death`, () => {
    const t = counters();
    t.state.assisted = true;
    earn(t);
    t.state.assisted = false;
    t.state.over = true;
    earn(t);
    assert.equal(t.progress(gunId), 0);
  });

  test(`${gunId} role: earn some, Save & Quit, Continue, earn the same again: paid once`, () => {
    const storage = memoryStorage();
    const first = counters(storage);
    for (let i = 0; i < 3; i++) earn(first);
    assert.equal(first.progress(gunId), 3);
    first.events.emit('runSaved', { round: 4 });
    const again = counters(storage); // (a new page: the save is read back, then the run is loaded)
    again.challenges.restore(first.challenges.serialize());
    again.events.emit('runLoaded', { round: 4 });
    for (let i = 0; i < 3; i++) earn(again);
    assert.equal(again.progress(gunId), 3, 'the replayed round pays nothing twice');
    earn(again);
    assert.equal(again.progress(gunId), 4, 'what goes beyond it pays');
  });
}

test('fan hits do not make a shot challenge: a fan kill is no multi-kill, a fan hit is no clean nail, a fan shove stops nothing', () => {
  const t = counters();
  shot(t, 'barcodeScanner', { hits: [deadBy('barcodeScanner'), deadBy('barcodeScanner', { noRewards: true })] });
  shot(t, 'leafBlower', { cone: true, hits: [{ target: shopper({ isAlive: true, noRewards: true }), interrupted: true }] });
  for (let i = 0; i < 10; i++) shot(t, 'nailGun', { magazineLeft: 9 - i, hits: [{ target: shopper({ isAlive: true, noRewards: i === 4 }) }] });
  kill(t, 'returnToSender', { zombie: shopper({ type: { id: 'janitor', boss: {} }, noRewards: true }) });
  for (const gunId of ['barcodeScanner', 'leafBlower', 'nailGun', 'returnToSender']) assert.equal(t.progress(gunId), 0, gunId);
});

test('a magazine is the shots between refills: a reload mid-magazine starts a new one, and other guns do not break it', () => {
  const t = counters();
  for (let i = 0; i < 4; i++) shot(t, 'nailGun', { magazineLeft: 9 - i, hits: [] }); // four misses, then a reload
  for (let i = 0; i < 10; i++) {
    shot(t, 'nailGun', { magazineLeft: 9 - i, hits: [{ target: shopper({ isAlive: true }) }] });
    shot(t, 'priceGun', { magazineLeft: 3, hits: [] }); // a swap and a miss with another gun in between
  }
  assert.equal(t.progress('nailGun'), 1);
  assert.deepEqual(t.challenges.snapshot().run['nailGun/measure-twice'], { left: 0, shots: 10, clean: true });
});

// --- The real game ------------------------------------------------------------------------------------------------

function realGame(context, options = {}) {
  const t = headlessGame(options);
  context.after(() => t.g.map.dispose());
  t.g.rounds.update = () => {};
  t.tick();
  const kills = [];
  t.g.events.on('kill', event => kills.push(event));
  return { ...t, kills };
}

function standing(t, x, z, health = 1, type = 'shopper') {
  const zombie = t.g.zombies.spawn(type, new THREE.Vector3(x, 0, z));
  zombie.setState('chasing');
  zombie.speed = 0;
  zombie.attackCooldown = 99;
  zombie.health = health;
  zombie.updateHitboxes();
  return zombie;
}

function aimAt(t, zombie, part = 'body', fromZ = 12) {
  t.standAt(zombie.position.x, fromZ);
  const point = zombie.hitboxes.find(h => h.part === part).box.getCenter(new THREE.Vector3());
  t.g.player.pitch = Math.atan2(point.y - t.g.player.eyeHeight, fromZ - point.z);
  t.input.held.add('Mouse2');
  t.tick(30);
}

test('a hitscan kill carries how far the shot went and what drew first blood how long before', context => {
  const t = realGame(context);
  const far = standing(t, 0, 7, 1000);
  aimAt(t, far, 'body', 15);
  t.press('Mouse0'); // a staple across the start room: it lives
  assert.ok(far.isAlive);
  t.tick(30);
  far.health = 1;
  t.press('Mouse0');
  t.input.held.delete('Mouse2');
  const [event] = t.kills;
  assert.equal(event.zombie, far);
  assert.equal(event.weaponId, 'stapleGun');
  assert.ok(Math.abs(event.distance - 8) < 0.6, `distance ${event.distance}`);
  assert.equal(event.bounces, null);
  assert.equal(event.firstWound.weaponId, 'stapleGun');
  assert.ok(event.firstWound.seconds > 0.45 && event.firstWound.seconds < 0.6, `seconds ${event.firstWound.seconds}`);

  const burnt = standing(t, 2, 9);
  burnt.takeHit({ damage: 5, part: 'body', source: 'build', weaponId: 'priceGun' });
  assert.deepEqual([t.kills[1].distance, t.kills[1].firstWound], [null, { weaponId: 'priceGun', seconds: 0 }], 'a burn has no distance');
});

for (const bounced of [false, true]) {
  test(`a tennis ball kill carries its bounces (${bounced ? 'the second zombie of a chain' : 'first contact'})`, context => {
    const t = realGame(context);
    t.g.gun.give(weapons.tennisBallLauncher);
    t.tick(40);
    t.standAt(0, 12);
    const first = standing(t, 0, 8, bounced ? 1000 : 1);
    const victim = bounced ? standing(t, 0.2, 6.8) : first;
    t.press('Mouse0');
    t.tick(60);
    const event = t.kills.find(entry => entry.zombie === victim);
    assert.equal(event.weaponId, 'tennisBallLauncher');
    assert.equal(event.bounces > 0, bounced);
    assert.ok(event.distance > 0);
  });
}

test('the Leaf Blower marks a shove that stopped an attack, and only that', context => {
  const t = realGame(context);
  t.g.gun.give(weapons.leafBlower);
  t.tick(40);
  const shots = [];
  t.g.events.on('shot', entry => shots.push(entry));
  t.standAt(0, 12);
  const swinging = standing(t, 0, 10.4, 1000);
  swinging.setState('windup');
  const walking = standing(t, 0.6, 9.6, 1000);
  t.press('Mouse0');
  const hits = shots.at(-1).hits;
  assert.equal(hits.find(hit => hit.target === swinging).interrupted, true);
  assert.equal(hits.find(hit => hit.target === walking).interrupted, false);
  assert.notEqual(swinging.state, 'windup', 'the gust stopped it');
});

test('a real Confetti Cannon blast that kills three counts once; the Price Gun counts a quick kill from full health', context => {
  const t = realGame(context);
  t.g.gun.give(weapons.confettiCannon);
  t.tick(40);
  const clump = [standing(t, 0, 10, 60), standing(t, 0.12, 10.4, 60), standing(t, -0.12, 10.4, 60)];
  aimAt(t, clump[0]);
  t.input.held.delete('Mouse2');
  t.tick(20); // (hip fire: the wider cone reaches all three)
  t.press('Mouse0');
  assert.deepEqual(clump.map(zombie => zombie.isAlive), [false, false, false]);
  assert.ok(clump.every(zombie => !zombie.isAlive));
  assert.equal(t.g.challenges.snapshot().progress.confettiCannon['party-size'], 1);

  t.g.gun.give(weapons.priceGun);
  t.tick(40);
  const fresh = standing(t, 0, 9, 1);
  fresh.health = fresh.maxHealth = 50;
  aimAt(t, fresh);
  t.input.held.add('Mouse0');
  t.tick(20);
  t.input.held.delete('Mouse0');
  t.input.held.delete('Mouse2');
  assert.equal(fresh.isAlive, false);
  assert.equal(t.g.challenges.snapshot().progress.priceGun.doorbuster, 1);
});

test('the real game: a Nail Gun magazine in progress is saved at the round start, cleared by Play again, and paid once', context => {
  const slot = new Map();
  const saveStorage = { getItem: key => slot.get(key) ?? null, setItem: (key, value) => slot.set(key, value), removeItem: key => slot.delete(key) };
  const save = createSkinSave({ storage: memoryStorage() });
  const t = headlessGame({ skinSave: save, saveStorage });
  context.after(() => t.g.map.dispose());
  const { g } = t;
  const nail = left => g.events.emit('shot', { weaponId: 'nailGun', magazineLeft: left, hits: [{ target: shopper({ isAlive: true }) }] });
  t.tick();
  for (let i = 0; i < 4000 && g.rounds.state !== 'active'; i++) t.tick();
  for (let left = 9; left >= 4; left--) nail(left); // six clean nails
  g.saveGame.markRoundStart(); // (what rounds.js does as a round begins: the save's snapshot is taken on the next tick)
  t.tick();
  const run = () => g.challenges.snapshot().run['nailGun/measure-twice'];
  assert.deepEqual(g.saveGame.snapshot.data.challenges.run['nailGun/measure-twice'], { left: 4, shots: 6, clean: true });
  for (let left = 3; left >= 0; left--) nail(left);
  assert.equal(save.progress('nailGun', 'measure-twice'), 1);
  assert.equal(g.saveGame.saveAndQuit(), true);
  g.resetRun();
  assert.deepEqual(run(), { left: null, shots: 0, clean: true }, 'Play again starts with no magazine');
  assert.equal(g.saveGame.load(), true);
  assert.deepEqual(run(), { left: 4, shots: 6, clean: true }, 'Continue resumes the magazine as it was when the round began');
  for (let left = 3; left >= 0; left--) nail(left);
  assert.equal(save.progress('nailGun', 'measure-twice'), 1, 'the replayed magazine is not paid again');
  for (let left = 9; left >= 0; left--) nail(left);
  assert.equal(save.progress('nailGun', 'measure-twice'), 2);
});

test('the real game: a ranged kill paid before Save & Quit is not paid again when its round is replayed', context => {
  const slot = new Map();
  const saveStorage = { getItem: key => slot.get(key) ?? null, setItem: (key, value) => slot.set(key, value), removeItem: key => slot.delete(key) };
  const save = createSkinSave({ storage: memoryStorage() });
  const t = headlessGame({ skinSave: save, saveStorage });
  context.after(() => t.g.map.dispose());
  const { g } = t;
  t.tick();
  for (let i = 0; i < 4000 && g.rounds.state !== 'active'; i++) t.tick();
  const far = () => {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(3, 0, 12));
    z.takeHit({ damage: z.health + 1, part: 'body', weaponId: 'foamDartBlaster', distance: 20 });
  };
  for (let i = 0; i < 5; i++) far();
  assert.equal(g.saveGame.saveAndQuit(), true);
  g.resetRun();
  assert.equal(g.saveGame.load(), true);
  for (let i = 0; i < 5; i++) far();
  assert.equal(save.progress('foamDartBlaster', 'aisle-fifteen'), 5);
  far();
  assert.equal(save.progress('foamDartBlaster', 'aisle-fifteen'), 6);
});
