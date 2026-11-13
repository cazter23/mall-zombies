// Twisty the Pretzel (config/zombies.js mascotVariants.twisty, zombies/mascotHeads.js pretzel, game/saltTrail.js).
// Checked: appears from round 22 and not before (rounds 10-21 unchanged), popping his helmet drops a salt crystal
// patch that crunches underfoot when walking across and expires, standing still / outside / mid-air stays silent,
// zero damage and zero slow, Play again and Save & Quit clear active patches, and dispose frees resources cleanly.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dt, headlessGame } from './helpers/headlessGame.js';
import { mascotGoldTypes, mascotTypes, mascotVariants } from '../src/config/zombies.js';
import { createSaltTrail } from '../src/game/saltTrail.js';
import { createMascotModel } from '../src/zombies/mascotModel.js';
import { mascotDebutIn, pickMascotVariant } from '../src/zombies/mascotVariants.js';

const type = mascotTypes.twisty;
const patchCfg = type.mascot.saltPatch;
const ticks = (seconds) => Math.round(seconds / dt);

function makeStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
}

function fixture(t, options = {}) {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene, ...options });
  const { g } = game;
  g.health.invulnerable = true;
  g.rounds.jumpTo(22);
  g.rounds.update = () => {};
  game.standAt(0, 12);
  t.after(() => {
    g.resetRun();
    g.map.dispose();
  });
  return { ...game, scene, trail: g.mascotCostumes.salt };
}

const spawnTwisty = (g, x, z, gold = false) => {
  const zombie = g.zombies.spawn('mascot', new THREE.Vector3(x, 0, z), { variant: 'twisty', gold });
  zombie.setState('chasing');
  zombie.speed = 0;
  return zombie;
};

const popHelmet = (zombie) => {
  zombie.takeHit({
    damage: zombie.health - zombie.maxHealth * type.mascot.healthFraction + 1,
    part: 'body',
    source: 'hazard',
  });
};

function walkZombie(tick, zombie, { fromX, fromZ, speed = 3.6, seconds }) {
  for (let i = 1; i <= ticks(seconds); i++) {
    tick();
    zombie.position.set(fromX + speed * i * dt, 0, fromZ);
  }
}

test('appears from round 22 and never in rounds 10-21; round 22 debuts Twisty with PA notice', (t) => {
  assert.equal(mascotVariants.twisty.unlockRound, 22);
  assert.equal(mascotDebutIn(22), 'twisty');
  for (let round = 10; round <= 21; round++) {
    assert.notEqual(mascotDebutIn(round), 'twisty', `round ${round} does not debut Twisty`);
    for (let sample = 0; sample < 20; sample++) {
      assert.notEqual(pickMascotVariant(round, 'foodCourt', () => sample / 20), 'twisty', `round ${round} never picks Twisty`);
    }
  }
  const rolls = new Set();
  for (let i = 0; i < 40; i++) rolls.add(pickMascotVariant(22, 'foodCourt', () => i / 40));
  assert.ok(rolls.has('twisty'), 'round 22 can pick Twisty');

  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  const { g, hud, tick } = game;
  g.health.invulnerable = true;
  game.standAt(0, 12);
  t.after(() => {
    g.resetRun();
    g.map.dispose();
  });

  const intros = [];
  g.events.on('mascotVariantIntro', (payload) => intros.push(payload));

  // Meet the Mascot type in round 10 (Sir Waffles) first, just like a real run, so round 22 isn't firstOfType.
  g.rounds.jumpTo(10);
  let wafflesSeen = false;
  for (let i = 0; i < 1800 && !wafflesSeen; i++) {
    tick();
    for (const z of g.zombies.zombies) {
      if (!z.isAlive) continue;
      if (z.type.variant === 'sirWaffles') wafflesSeen = true;
      z.takeHit({ damage: z.health, part: 'body', source: 'hazard' });
    }
  }
  assert.ok(wafflesSeen, 'round 10 introduces Sir Waffles first');
  assert.equal(intros.length, 0);

  g.rounds.jumpTo(22);
  let twistySeen = null;
  for (let i = 0; i < 1800 && !twistySeen; i++) {
    tick();
    for (const z of g.zombies.zombies) {
      if (!z.isAlive) continue;
      if (z.type.variant === 'twisty') {
        twistySeen = z;
        break;
      }
      z.takeHit({ damage: z.health, part: 'body', source: 'hazard' });
    }
  }
  assert.ok(twistySeen, 'round 22 wave spawns Twisty naturally');
  assert.equal(twistySeen.type.name, 'Twisty the Pretzel');
  assert.equal(intros.length, 1);
  assert.equal(intros[0].variant, 'twisty');
  assert.ok(hud.calls.some(([fn, arg]) => fn === 'showAnnouncement' && arg?.text === mascotVariants.twisty.introBanner.text));
});

test('popping helmet drops a salt crystal patch that expires after 10 seconds and pools cleanly', (t) => {
  const { g, scene, tick, trail } = fixture(t);
  const poolNodes = () => scene.children.filter((n) => n.name === 'saltPatch');
  assert.equal(poolNodes().length, 8, 'all 8 pooled saltPatch groups exist from start');
  assert.equal(trail.active.length, 0);

  // Other Mascot costumes do not drop salt patches on pop.
  const waffles = g.zombies.spawn('mascot', new THREE.Vector3(-2, 0, 9), { variant: 'sirWaffles', gold: false });
  popHelmet(waffles);
  assert.equal(trail.active.length, 0, 'Sir Waffles pop leaves no salt patch');

  const zombie = spawnTwisty(g, 0, 9);
  popHelmet(zombie);
  assert.equal(zombie.mascotHeadOff, true);
  assert.equal(trail.active.length, 1);
  assert.equal(trail.active[0].remaining, 10);
  assert.equal(trail.active[0].group.visible, true);

  tick(ticks(5));
  assert.equal(trail.active.length, 1, 'still active halfway through 10 s lifetime');
  tick(ticks(5) + 2);
  assert.equal(trail.active.length, 0, 'expired after 10 seconds');
  assert.ok(poolNodes().every((node) => !node.visible));

  // Exceeding pool size reuses oldest without adding more groups to the scene.
  for (let i = 0; i < 10; i++) trail.dropAt(i * 0.5, 0, 9);
  assert.equal(trail.active.length, 8);
  assert.equal(poolNodes().length, 8);
});

test('walking across salt plays crunch sound with zero damage and zero slow; standing still, outside, or mid-air is silent', (t) => {
  const { g, sounds, tick, standAt, input, trail } = fixture(t);
  g.health.invulnerable = false;
  const startHealth = g.health.fraction;
  assert.equal(startHealth, 1);

  const zombie = spawnTwisty(g, 2, 9);
  popHelmet(zombie);
  zombie.takeHit({ damage: 1e9, part: 'body', source: 'hazard' });
  assert.equal(trail.active.length, 1);
  const spot = { x: trail.active[0].x, z: trail.active[0].z };

  // Teleporting straight onto the patch and standing completely still emits no crunch, damage, or slow.
  standAt(spot.x, spot.z);
  sounds.length = 0;
  tick(ticks(1));
  assert.equal(sounds.filter((s) => s === 'saltCrunch').length, 0, 'standing still is silent');
  assert.equal(g.health.fraction, 1, 'no damage');
  assert.equal(g.stats.surfaceSpeed, 1, 'no slow');

  // Walking forward across the active patch plays saltCrunch while speed & health remain untouched.
  sounds.length = 0;
  input.held.add('KeyW');
  tick(ticks(0.35));
  const walkSpeed = Math.hypot(g.player.velocity.x, g.player.velocity.z);
  input.held.delete('KeyW');
  assert.ok(sounds.includes('saltCrunch'), 'walking on salt triggers saltCrunch');
  assert.ok(walkSpeed >= 4.9 && walkSpeed <= g.stats.walkSpeed + 1e-6, `walk speed unaffected (${walkSpeed} vs ${g.stats.walkSpeed})`);
  assert.equal(g.stats.surfaceSpeed, 1, 'no surface slow from salt');
  assert.equal(g.health.fraction, 1, 'no health lost from salt');

  // Walking well outside radius produces no crunch.
  standAt(spot.x + patchCfg.radius + 2, spot.z);
  sounds.length = 0;
  input.held.add('KeyA');
  tick(ticks(0.3));
  input.held.delete('KeyA');
  assert.equal(sounds.filter((s) => s === 'saltCrunch').length, 0, 'walking outside patch is silent');

  // Airborne jump over the patch produces no crunch while ungrounded.
  standAt(spot.x, spot.z);
  g.player.grounded = false;
  g.player.position.y = 0.05;
  sounds.length = 0;
  g.player.position.x += 0.2;
  tick(1);
  assert.equal(sounds.filter((s) => s === 'saltCrunch').length, 0, 'airborne over patch is silent');
});

test('round end, death, Play again, and Save & Quit all clear salt patches', (t) => {
  const saveStorage = makeStorage();
  const { g, tick, trail } = fixture(t, { saveStorage });

  // Round end clears.
  const z1 = spawnTwisty(g, 0, 9);
  popHelmet(z1);
  assert.equal(trail.active.length, 1);
  g.rounds.jumpTo(23);
  tick(1);
  assert.equal(trail.active.length, 0, 'round end clears salt');

  // Death clears.
  const z2 = spawnTwisty(g, 0, 9);
  popHelmet(z2);
  assert.equal(trail.active.length, 1);
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  assert.equal(g.state.over, true);
  assert.equal(trail.active.length, 0, 'player death clears salt');

  // Play again clears.
  g.resetRun();
  g.health.invulnerable = true;
  g.rounds.jumpTo(22);
  g.rounds.update = () => {};
  const z3 = spawnTwisty(g, 0, 9);
  popHelmet(z3);
  assert.equal(trail.active.length, 1);
  g.resetRun();
  assert.equal(trail.active.length, 0, 'Play again clears salt');
  assert.ok(trail.patches.every((p) => !p.group.visible));

  // Save & Quit + load clears active mid-round patches.
  g.rounds.jumpTo(22);
  tick(2);
  g.rounds.update = () => {};
  assert.equal(g.saveGame.canSave().ok, true);
  const z4 = spawnTwisty(g, 0, 9);
  popHelmet(z4);
  assert.equal(trail.active.length, 1);
  assert.equal(g.saveGame.saveAndQuit(), true);
  assert.equal(g.saveGame.load(), true);
  assert.equal(g.rounds.round, 22);
  assert.equal(trail.active.length, 0, 'Save & Quit load clears salt');
  assert.ok(trail.patches.every((p) => !p.group.visible));
});

test('dispose frees saltTrail resources, unsubscribes costume bus listeners, and disposes pretzel model cleanly', (t) => {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  const { g } = game;
  t.after(() => g.map.dispose());

  // Standalone createSaltTrail disposal frees every geometry and material and removes scene nodes.
  const isolatedScene = new THREE.Scene();
  const isolatedTrail = createSaltTrail({
    scene: isolatedScene,
    player: g.player,
    colliders: [new THREE.Box3(new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 0, 10))],
    sound: { play: () => {} },
  });
  let disposedCount = 0;
  for (const patch of isolatedTrail.patches) {
    patch.dustMaterial.addEventListener('dispose', () => { disposedCount += 1; });
    for (const m of patch.materials) m.addEventListener('dispose', () => { disposedCount += 1; });
  }
  isolatedTrail.patches[0].group.children[0].geometry.addEventListener('dispose', () => { disposedCount += 1; });
  isolatedTrail.patches[0].group.children[1].geometry.addEventListener('dispose', () => { disposedCount += 1; });

  assert.equal(isolatedScene.children.length, 8);
  isolatedTrail.dispose();
  assert.equal(isolatedScene.children.length, 0);
  // 8 dustMaterials + (8 * 3) crystal materials + 2 shared geometries = 34 dispose events
  assert.equal(disposedCount, 34);

  // Disposing mascotCostumes removes its listeners cleanly.
  g.mascotCostumes.dispose();
  const z = spawnTwisty(g, 0, 9);
  popHelmet(z);
  assert.equal(g.mascotCostumes.salt.active.length, 0, 'bus listener unsubscribed on dispose');

  // Building and disposing regular + Employee of the Month pretzel mascot models works cleanly.
  for (const cfg of [mascotTypes.twisty, mascotGoldTypes.twisty]) {
    const model = createMascotModel(cfg);
    const helmet = model.root.getObjectByName('mascotHelmet');
    assert.ok(helmet && helmet.children.length > 0, 'pretzel helmet populated');
    let freedMaterials = 0;
    const seen = new Set();
    helmet.traverse((obj) => {
      if (obj.isMesh && !seen.has(obj.material)) {
        seen.add(obj.material);
        obj.material.addEventListener('dispose', () => { freedMaterials += 1; });
      }
    });
    assert.ok(seen.size > 0);
    model.dispose();
    assert.equal(freedMaterials, seen.size, 'every helmet material disposed');
  }
});

test('bare-headed Twisty crunches positionally while walking through salt, not with helmet on, outside, still, or past maxDistance', (t) => {
  const played = [];
  const sound = { play: (name, opts) => played.push({ name, volume: opts?.volume }), unlock: () => {} };
  const { g, tick, standAt, trail } = fixture(t, { sound });
  const crunches = () => played.filter((s) => s.name === 'saltCrunch');

  // Drop one active salt patch centered at (0, 0, 9), then remove the dropper.
  const dropper = spawnTwisty(g, 0, 9);
  popHelmet(dropper);
  dropper.takeHit({ damage: 1e9, part: 'body', source: 'hazard' });
  assert.equal(trail.active.length, 1);

  // Suited Twisty walking straight across the salt does not crunch while helmet is on.
  const twister = spawnTwisty(g, -0.9, 9);
  assert.equal(twister.mascotHeadOff, false);
  played.length = 0;
  walkZombie(tick, twister, { fromX: -0.9, fromZ: 9, speed: 3.6, seconds: 0.5 });
  assert.equal(crunches().length, 0, 'helmet on: silent');

  // Pop his helmet while pinned in place on the patch: standing still never crunches.
  twister.applySlow(99, 0);
  twister.position.set(0, 0, 9);
  twister.velocity.set(0, 0, 0);
  popHelmet(twister);
  assert.equal(twister.mascotHeadOff, true);
  played.length = 0;
  tick(ticks(1));
  assert.equal(crunches().length, 0, 'standing still in salt: silent');

  // Unfreeze and verify real AI rush after shake also crunches on salt.
  twister.slowTimer = 0;
  twister.slowFraction = 1;
  played.length = 0;
  tick(ticks(0.6));
  assert.ok(crunches().length >= 1, 'real AI rush across salt crunches');
  twister.applySlow(99, 0);
  twister.velocity.set(0, 0, 0);

  // Bare-headed Twisty walking outside salt does not crunch.
  twister.position.set(2.5, 0, 9);
  tick(1);
  played.length = 0;
  walkZombie(tick, twister, { fromX: 2.5, fromZ: 9, speed: 3.6, seconds: 0.5 });
  assert.equal(crunches().length, 0, 'walking outside salt: silent');

  // Walking 1.8 m across (0, 0, 9) at 3.6 m/s (0.5 s) throttles to 3 crunches (entry + 2 x 0.72 m).
  standAt(0, 12);
  twister.position.set(-0.9, 0, 9);
  tick(1);
  played.length = 0;
  walkZombie(tick, twister, { fromX: -0.9, fromZ: 9, speed: 3.6, seconds: 0.5 });
  const near = crunches();
  assert.equal(near.length, 3, `expected 3 step-throttled crunches over 1.8 m, got ${near.length}`);
  assert.ok(Math.abs(near[0].volume - (1 - Math.hypot(-0.78, 3) / 18)) < 0.03, `near volume ${near[0].volume}`);

  // Refresh patch and test positional distance falloff (quieter at 6 m than 3 m, silent past maxDistance 18 m).
  trail.dropAt(0, 0, 9);
  standAt(0, 15); // 6 m from z = 9 -> volume = 1 - 6/18 = 2/3
  twister.position.set(-0.5, 0, 9);
  tick(1);
  played.length = 0;
  walkZombie(tick, twister, { fromX: -0.5, fromZ: 9, speed: 3.6, seconds: 0.3 });
  const mid = crunches();
  assert.ok(mid.length >= 1, 'audible at 6 m');
  assert.ok(mid[0].volume < near[0].volume && mid[0].volume > 0.6 && mid[0].volume < 0.72, `mid volume ${mid[0].volume}`);

  standAt(0, 27.5); // 18.5 m > maxDistance (18 m)
  twister.position.set(-0.5, 0, 9);
  tick(1);
  played.length = 0;
  walkZombie(tick, twister, { fromX: -0.5, fromZ: 9, speed: 3.6, seconds: 0.3 });
  assert.equal(crunches().length, 0, 'silent beyond maxDistance');
});

test('a second bare-headed Twisty crunches independently from the first', (t) => {
  const played = [];
  const sound = { play: (name, opts) => played.push({ name, volume: opts?.volume }), unlock: () => {} };
  const { g, tick, standAt } = fixture(t, { sound });
  const crunches = () => played.filter((s) => s.name === 'saltCrunch');

  // Stand at (-2, 0, 12): patch A at (-2, 0, 9) is 3 m away (vol ~0.833), patch B at (3, 0, 9) is ~5.83 m away (vol ~0.676).
  standAt(-2, 12);
  const a = spawnTwisty(g, -2, 9);
  const b = spawnTwisty(g, 3, 9);
  popHelmet(a);
  popHelmet(b);
  a.applySlow(99, 0);
  b.applySlow(99, 0);
  a.velocity.set(0, 0, 0);
  b.velocity.set(0, 0, 0);

  // Twisty A stands still in patch A while Twisty B walks across patch B -> only Twisty B's distant volume plays.
  b.position.set(2.4, 0, 9);
  tick(1);
  played.length = 0;
  walkZombie(tick, b, { fromX: 2.4, fromZ: 9, speed: 3.6, seconds: 0.35 });
  const onlyB = crunches();
  assert.ok(onlyB.length >= 2, 'Twisty B crunches while A stands still');
  assert.ok(onlyB.every((s) => s.volume < 0.72), 'no crunches came from close Twisty A');

  // Step both outside patches first so each enters cleanly from outside, then walk both concurrently.
  a.position.set(-3.1, 0, 9);
  b.position.set(1.9, 0, 9);
  tick(1);
  played.length = 0;
  for (let i = 1; i <= ticks(0.55); i++) {
    tick();
    a.position.set(-3.1 + 3.6 * i * dt, 0, 9);
    b.position.set(1.9 + 3.6 * i * dt, 0, 9);
  }
  const both = crunches();
  const fromA = both.filter((s) => s.volume > 0.78);
  const fromB = both.filter((s) => s.volume <= 0.75);
  assert.equal(both.length, 6);
  assert.equal(fromA.length, 3, `Twisty A crunched 3 times (${fromA.length})`);
  assert.equal(fromB.length, 3, `Twisty B crunched 3 times independently (${fromB.length})`);
});
