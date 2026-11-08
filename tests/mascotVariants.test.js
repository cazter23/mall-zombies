// Mascot costumes (config/zombies.js mascotVariants -> zombies/mascotVariants.js picking, game/rounds.js debuts):
// one Mascot slot, several costumes. Checked: every costume resolves to a full Mascot type with its own banner and
// pop line; Sir Waffles is the type itself; costumes only appear from their unlock round and lean to their home
// zones; the Mascot's spawn rate is the same with or without costumes; each debut round forces its costume once,
// announced once; and the debug key spawns each costume in turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { economy } from '../src/config/economy.js';
import { mascotPicking, mascotTypes, mascotVariants, zombieTypes } from '../src/config/zombies.js';
import { createRounds } from '../src/game/rounds.js';
import { seededRandom } from '../src/world/textures.js';
import { MASCOT_VARIANT_IDS, mascotDebutIn, pickMascotVariant } from '../src/zombies/mascotVariants.js';

const mix = economy.zombieMix.mascot;

function fixture(t) {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  game.g.health.invulnerable = true;
  t.after(() => {
    game.g.zombies.clear();
    game.g.map.dispose();
  });
  return { ...game, scene };
}

test('every costume is a whole Mascot: same slot and numbers, its own name, banner, pop line and head', () => {
  assert.equal(zombieTypes.mascot, mascotTypes.sirWaffles, 'an unpicked Mascot is Sir Waffles');
  assert.equal(mascotVariants.sirWaffles.unlockRound, mix.fromRound);
  for (const id of MASCOT_VARIANT_IDS) {
    const type = mascotTypes[id];
    const costume = mascotVariants[id];
    assert.equal(type.id, 'mascot', id);
    assert.equal(type.variant, id);
    assert.equal(type.name, costume.name);
    assert.ok(costume.unlockRound >= mix.fromRound, `${id} unlocks no earlier than the Mascot itself`);
    assert.ok(costume.homeZones.length > 0, `${id} has a home`);
    assert.ok(type.introBanner.kicker && type.introBanner.text, `${id} has a banner`);
    assert.ok(type.mascot.helmetPopLine.kicker && type.mascot.helmetPopLine.text, `${id} has a pop line`);
    assert.equal(type.mascot.helmet, costume.head.helmet, 'the head hitbox block comes from the costume');
    for (const key of ['healthFraction', 'exposedSpeed', 'rage', 'leftHelmets', 'drop', 'pose', 'torso']) {
      assert.deepEqual(type.mascot[key], zombieTypes.mascot.mascot[key], `${id} shares ${key}`);
    }
    for (const key of ['suit', 'trim', 'boot', 'skin', 'eyes', 'dark', 'hair']) assert.ok(Number.isInteger(type.mascot.colors[key]), `${id} ${key}`);
  }
  const texts = MASCOT_VARIANT_IDS.map((id) => mascotTypes[id].introBanner.text);
  assert.equal(new Set(texts).size, texts.length, 'no two costumes share a banner');
  assert.deepEqual(mix, { fromRound: 10, shareByRound: [{ fromRound: 10, share: 0.04 }], healthMultiplier: 5, introSpawnIndex: 4, maxAlive: 2 },
    'the Mascot slot itself is untouched');
});

// A made-up wardrobe, so picking can be checked whatever costumes the game has today.
const wardrobe = {
  knight: { unlockRound: 10, homeZones: ['foodCourt'] },
  tag: { unlockRound: 13, homeZones: ['megaMart'] },
  bucket: { unlockRound: 16, homeZones: ['cinema'] },
};

test('costumes appear only from their unlock round, lean to their home zones, and one costume draws no dice', () => {
  const random = seededRandom(41);
  const count = (round, zone, n = 6000) => {
    const counts = Object.fromEntries(Object.keys(wardrobe).map((id) => [id, 0]));
    for (let i = 0; i < n; i++) counts[pickMascotVariant(round, zone, random, wardrobe)] += 1;
    return counts;
  };
  for (const round of [10, 11, 12]) assert.deepEqual(count(round, 'megaMart', 200), { knight: 200, tag: 0, bucket: 0 });
  assert.equal(count(15, 'hallway').bucket, 0, 'not before round 16');

  // Two unlocked, no home here: even. In the tag's home (x homeWeight): homeWeight / (homeWeight + 1).
  const even = count(14, 'hallway');
  assert.ok(Math.abs(even.tag / 6000 - 0.5) < 0.03, JSON.stringify(even));
  const home = count(14, 'megaMart');
  assert.ok(Math.abs(home.tag / 6000 - mascotPicking.homeWeight / (mascotPicking.homeWeight + 1)) < 0.03, JSON.stringify(home));
  const noBias = count(14, null);
  assert.ok(Math.abs(noBias.tag / 6000 - 0.5) < 0.03, 'no zone (the chute, an explicit spot): no bias');
  const three = count(20, 'cinema');
  const w = mascotPicking.homeWeight;
  assert.ok(Math.abs(three.bucket / 6000 - w / (w + 2)) < 0.03, JSON.stringify(three));

  let draws = 0;
  const counting = () => { draws += 1; return 0.5; };
  assert.equal(pickMascotVariant(12, 'megaMart', counting, wardrobe), 'knight');
  assert.equal(pickMascotVariant(1, null, counting, wardrobe), 'knight', 'before any unlock: the earliest costume');
  assert.equal(draws, 0, 'one costume to choose from rolls nothing, so rounds 10-12 play exactly as before');
  assert.equal(mascotDebutIn(13, wardrobe), 'tag');
  assert.equal(mascotDebutIn(14, wardrobe), null);
  for (const id of MASCOT_VARIANT_IDS) assert.equal(mascotDebutIn(mascotVariants[id].unlockRound), id);
});

// Rounds with a stand-in zombie manager: every spawn succeeds at once and dies at once, and the costume is picked with
// its own dice. So the rounds' dice decide the TYPE of every spawn, as in the game.
// `firstCostumeOnly`: the same game with every costume but Sir Waffles locked away (as before costumes existed).
function playRounds({ lastRound, seed, firstCostumeOnly = false }) {
  const perRound = new Map();
  const intros = [];
  const pickDice = seededRandom(seed + 1);
  const realRandom = Math.random;
  const unlocks = MASCOT_VARIANT_IDS.map((id) => mascotVariants[id].unlockRound);
  if (firstCostumeOnly) for (const id of MASCOT_VARIANT_IDS) if (id !== 'sirWaffles') mascotVariants[id].unlockRound = Infinity;
  Math.random = seededRandom(seed);
  let rounds;
  const zombies = {
    aliveCount: 0,
    clear() {},
    spawn(typeId, _at, options) {
      const round = rounds.round;
      const variant = typeId === 'mascot' ? options?.variant ?? pickMascotVariant(round, 'hallway', pickDice) : null;
      const row = perRound.get(round) ?? perRound.set(round, { types: {}, variants: [] }).get(round);
      row.types[typeId] = (row.types[typeId] ?? 0) + 1;
      if (variant) row.variants.push(variant);
      return { type: variant ? mascotTypes[variant] : { id: typeId } };
    },
  };
  try {
    rounds = createRounds({ zombies, onVariantIntro: (variant) => intros.push(variant) });
    rounds.start();
    while (rounds.round <= lastRound) rounds.update(30);
  } finally {
    Math.random = realRandom;
    MASCOT_VARIANT_IDS.forEach((id, i) => { mascotVariants[id].unlockRound = unlocks[i]; });
  }
  return { perRound, intros };
}

test('costumes never change how many Mascots come: the same dice give the same waves, debut rounds aside', () => {
  const debutRounds = new Set(MASCOT_VARIANT_IDS.map((id) => mascotVariants[id].unlockRound));
  debutRounds.delete(mix.fromRound); // (round 10 is the Mascot's own intro, as before)
  for (const seed of [3, 17, 99]) {
    const withCostumes = playRounds({ lastRound: 30, seed });
    const without = playRounds({ lastRound: 30, seed, firstCostumeOnly: true });
    for (let round = 1; round <= 30; round++) {
      const a = withCostumes.perRound.get(round).types;
      const b = without.perRound.get(round).types;
      if (!debutRounds.has(round)) {
        assert.deepEqual(a, b, `seed ${seed}, round ${round}: identical waves`);
        continue;
      }
      // A debut can turn ONE other spawn into the costume's Mascot, and only when none had come by introSpawnIndex.
      const extra = (a.mascot ?? 0) - (b.mascot ?? 0);
      assert.ok(extra === 0 || extra === 1, `seed ${seed}, round ${round}`);
      assert.ok(a.mascot >= 1, 'a debut round always has a Mascot');
    }
  }
});

test('in its unlock round a costume debuts once: the first Mascot wears it, forced by the intro spawn if need be', () => {
  for (const seed of [5, 8]) {
    const { perRound, intros } = playRounds({ lastRound: 24, seed });
    for (const id of MASCOT_VARIANT_IDS) {
      const round = mascotVariants[id].unlockRound;
      if (round > 24) continue;
      const { variants } = perRound.get(round);
      assert.equal(variants[0], id, `round ${round} opens with ${id}`);
      for (let r = mix.fromRound; r < round; r++) assert.ok(!perRound.get(r).variants.includes(id), `${id} never before round ${round}`);
    }
    // Sir Waffles is the Mascot's own intro (typeIntro); every later costume is announced once, in its debut round.
    assert.deepEqual(intros, MASCOT_VARIANT_IDS.filter((id) => id !== 'sirWaffles' && mascotVariants[id].unlockRound <= 24));
  }
});

test('the real game: the round-10 Mascot is Sir Waffles with his banner, and a debut is forced by the intro spawn', (t) => {
  const { g, tick, hud } = fixture(t);
  const variantIntros = [];
  g.events.on('mascotVariantIntro', ({ variant }) => variantIntros.push(variant));
  for (const id of MASCOT_VARIANT_IDS) {
    const round = mascotVariants[id].unlockRound;
    g.rounds.jumpTo(round);
    const seen = [];
    for (let i = 0; i < 1800 && seen.length <= mix.introSpawnIndex; i++) {
      tick();
      for (const zombie of g.zombies.zombies) {
        if (!zombie.isAlive) continue;
        seen.push(zombie.type.variant ?? zombie.type.id);
        zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' });
      }
    }
    assert.ok(seen.slice(0, mix.introSpawnIndex + 1).includes(id), `${id} by the intro spawn of round ${round}: ${seen}`);
    assert.equal(seen.find((s) => MASCOT_VARIANT_IDS.includes(s)), id, 'and it is the first Mascot of its round');
  }
  const banner = (id) => hud.calls.filter(([name, b]) => name === 'showAnnouncement' && b.text === mascotTypes[id].introBanner.text).length;
  for (const id of MASCOT_VARIANT_IDS) assert.equal(banner(id), 1, `${id}'s banner, once`);
  assert.deepEqual(variantIntros, MASCOT_VARIANT_IDS.filter((id) => id !== 'sirWaffles'));
});

test('in the real manager the spawn point\'s zone sets the bias, and the Returns Chute has none', (t) => {
  const { g, tick, standAt } = fixture(t);
  const round = mascotVariants.captainCoupon.unlockRound; // (Sir Waffles and Captain Coupon to choose from)
  assert.ok(Object.values(mascotVariants).filter((v) => v.unlockRound <= round).length === 2);
  assert.ok(mascotVariants.captainCoupon.homeZones.includes('megaMart') && !mascotVariants.sirWaffles.homeZones.includes('megaMart'));
  g.rounds.jumpTo(round);
  g.rounds.update = () => {};
  for (const zone of Object.values(g.map.zones)) zone.open = false;
  g.map.zones.megaMart.open = true;
  standAt(29, -22); // Mega Mart's back walkway
  tick(30);
  t.mock.method(Math, 'random', seededRandom(12)); // (after the map is built)
  const couponShare = (options, n = 120) => {
    let coupons = 0;
    for (let i = 0; i < n; i++) {
      const zombie = g.zombies.spawn('mascot', null, options);
      assert.ok(zombie?.type.mascot, 'a Mascot every time');
      if (zombie.type.variant === 'captainCoupon') coupons += 1;
      g.zombies.clear();
    }
    return coupons / n;
  };
  const home = mascotPicking.homeWeight / (mascotPicking.homeWeight + 1);
  const atHome = couponShare({ nearest: true });
  assert.ok(Math.abs(atHome - home) < 0.12, `Mega Mart spawns: ${atHome} Coupons, expected about ${home}`);
  g.zombies.steerSpawns([{ zone: 'megaMart', position: new THREE.Vector3(22, 0, -22) }]);
  const chute = couponShare({});
  assert.ok(Math.abs(chute - 0.5) < 0.12, `out of the chute: ${chute} Coupons, expected about 0.5`);
});

test('the debug key spawns each costume in turn at the spawn point nearest you, and the Mascot cap still holds', (t) => {
  const { g, tick } = fixture(t);
  tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  const d = g.debug;
  assert.equal(d.resolve('KeyM', false).id, 'spawnMascot');
  const spawned = [];
  for (let i = 0; i < MASCOT_VARIANT_IDS.length; i++) {
    let message = d.run('spawnMascot');
    for (let tries = 0; tries < 20 && !message.startsWith('Spawned'); tries++) { tick(20); message = d.run('spawnMascot'); }
    const zombie = g.zombies.zombies.at(-1);
    assert.equal(message, `Spawned ${zombie.type.name}`);
    spawned.push(zombie.type.variant);
    zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' }); // (so the cap of two never gets in the way)
  }
  assert.deepEqual(spawned, MASCOT_VARIANT_IDS);
  assert.ok(g.state.assisted, 'a debug spawn marks the run as assisted');
});
