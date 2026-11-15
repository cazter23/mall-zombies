// THE NOVEMBER 2026 BUG HUNT: one regression test per bug found by reading the whole game and proving each suspicion
// in the real game (tests/helpers/headlessGame.js). Each test names what the player would have seen. docs/history.md
// has the list; a test here guards a RULE (ammo is never taken away, a sold-out bin can't be ordered...), not a number.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { weapons } from '../src/config/weapons.js';
import { returnToSender } from '../src/weapons/returnToSender.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { withTier } from '../src/weapons/upgrades.js';
import { buildOf } from '../src/config/workshop.js';
import { feel } from '../src/config/feel.js';
import { clawMachine } from '../src/config/clawMachine.js';
import { bossVouchers } from '../src/config/bosses.js';
import { kiosk } from '../src/config/kiosk.js';
import { economy } from '../src/config/economy.js';
import { save as saveConfig } from '../src/config/save.js';
import { createCareerStats } from '../src/game/careerStats.js';
import { saleEligibility, collectSaleSpots } from '../src/game/flashSales.js';
import { rampHeightAt, overlapsSolid } from '../src/world/collision.js';
import { headlessGame } from './helpers/headlessGame.js';

// A real game with the rounds held still (no zombies of its own) and the hallway bought.
function quietGame(context) {
  const t = headlessGame();
  context.after(() => { t.g.resetRun(); t.g.map.dispose(); });
  const { g } = t;
  g.rounds.update = () => {};
  t.tick();
  g.map.areaUnlocks.unlock('hallway');
  t.tick(60);
  const spawn = (type, x, z, options) => {
    const zombie = g.zombies.spawn(type, new THREE.Vector3(x, 0, z), options);
    zombie.setState('chasing');
    zombie.speed = 0;
    zombie.attackCooldown = 99;
    return zombie;
  };
  return { ...t, spawn };
}

// A stand-in for localStorage (Save & Quit's slot).
function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
  };
}

// With Math.random pinned for the length of `run` (the map is built first: Three.js makes ids with it).
function withRandom(value, run) {
  const real = Math.random;
  Math.random = () => value;
  try { return run(); } finally { Math.random = real; }
}

test('Full Refund never takes ammo away: a reserve above the cap (the Fanny Pack came off) keeps every round', (context) => {
  const t = quietGame(context);
  const { g } = t;
  g.wardrobe.buy('fannyPack');
  g.gun.give(weapons.returnToSender);
  t.tick(60);
  const weapon = g.gun.weapon;
  g.wardrobe.buy('goldCard'); // (same slot: the Fanny Pack comes off, the rounds it let you carry stay)
  assert.ok(weapon.reserve > weapon.reserveCap, 'the scenario: more rounds than the cap');
  const before = weapon.reserve;
  g.returnQuest.debug('labels');
  while (g.returnQuest.fitted !== 'refund') g.returnQuest.cycleLabel();
  const zombie = t.spawn('shopper', 0, 0);
  withRandom(0, () => { // (the roll says "a round back")
    returnToSender(zombie, { effects: g.effects, sound: null });
    g.returnQuest.blastDone();
  });
  assert.ok(weapon.reserve >= before, `the label's "round back" left ${weapon.reserve} of ${before} rounds`);
});

test('Build-A-Blaster: a Stuffing that left today\'s bins while the order form was open cannot be ordered', (context) => {
  const t = quietGame(context);
  const { g } = t;
  g.wallet.earn(20000);
  for (const id of Object.keys(g.map.zones)) if (!g.map.zones[id].open) g.map.areaUnlocks.unlock(id, { instant: true });
  t.tick(5);
  const ritual = g.features.instanceOf('workshop').ritual;
  ritual.orderForm.open();
  const picked = ritual.form.stuffings.find((s) => s.selected).id;
  // The world doesn't stop for the form: rounds start, and every round start re-rolls the bins.
  for (let i = 0; i < 400 && ritual.today.includes(picked); i++) g.events.emit('roundStart', { round: g.rounds.round });
  assert.ok(!ritual.today.includes(picked), 'the scenario: the filled-in Stuffing is no longer in the bins');
  const points = g.wallet.points;
  t.press('Enter', 1);
  if (ritual.phase === 'idle') {
    assert.equal(g.wallet.points, points, 'nothing ordered, nothing paid');
  } else {
    assert.ok(ritual.today.includes(ritual.pick.stuffing), `ordered ${ritual.pick.stuffing}, which is not in today's bins (${ritual.today})`);
  }
  const selected = ritual.form?.stuffings.find((s) => s.selected);
  if (selected) assert.ok(selected.available, 'the form never shows a pick it marks unavailable');
});

test('a gun with no reserve in config has none in the hand: the Leaf Blower carries 0 spare, so a Platinum one can run dry and claim', (context) => {
  assert.equal(weapons.leafBlower.startingReserve, 0, 'the scenario: a tank gun, nothing spare');
  assert.equal(resolveGun(weapons.leafBlower, []).startingReserve, 0, 'resolving a gun must not invent a round');
  const t = quietGame(context);
  const { g } = t;
  g.gun.give(weapons.leafBlower);
  t.tick(60);
  assert.equal(g.gun.weapon.reserve, 0, 'no phantom round in the reserve');
  // Platinum's promise (config/upgrades.js claim): a gun that runs completely dry is refilled, once a round.
  g.gun.setMods('leafBlower', withTier(weapons.leafBlower, g.gun.modsFor('leafBlower'), 'platinum'));
  const claims = [];
  g.events.on('warrantyClaim', (claim) => claims.push(claim.weaponId));
  g.gun.weapon.magazine = 0;
  t.tick(2);
  assert.deepEqual(claims, ['leafBlower'], 'the dry Platinum Leaf Blower made its claim');
});

test('Employee Discount does not outlive Save & Quit: after Continue the prices are full again', (context) => {
  const t = headlessGame({ saveStorage: memoryStorage() });
  context.after(() => t.g.map.dispose());
  const { g } = t;
  t.tick(2);
  const full = g.pricing.priceOf('door', 'megaMart');
  g.powerUps.debugDrop('employeeDiscount');
  t.tick(2);
  assert.ok(g.pricing.priceOf('door', 'megaMart') < full, 'the scenario: the discount is on');
  g.rounds.skipRound(); // (the round flips while it runs: the snapshot is taken on this tick)
  t.tick(1);
  assert.equal(g.saveGame.saveAndQuit(), true);
  assert.equal(g.saveGame.load(), true);
  assert.deepEqual(g.powerUps.effects.map((effect) => effect.id), [], 'no incentive is running after a load');
  assert.equal(g.pricing.priceOf('door', 'megaMart'), full, 'so nothing is discounted either');
});

test('Store-Wide Clearance never kills a boss, not even one the Barcode Scanner has RUNG UP', (context) => {
  const t = headlessGame();
  context.after(() => { t.g.resetRun(); t.g.map.dispose(); });
  const { g } = t;
  g.health.invulnerable = true;
  t.tick(2);
  g.map.areaUnlocks.unlock('hallway', { instant: true });
  g.rounds.jumpTo(9);
  t.tick(5);
  const clearOthers = (keep) => { for (const z of g.zombies.zombies) if (z.isAlive && z !== keep) z.takeHit({ damage: z.health + 1, part: 'body', source: 'hazard' }); };
  clearOthers(null);
  const boss = g.bosses.summon('guard');
  for (let i = 0; i < 600 && boss.state === 'spawning'; i++) { t.tick(1); clearOthers(boss); }
  boss.health = boss.maxHealth * 0.3;
  const mark = weapons.barcodeScanner.rungUp;
  boss.applyRungUp(mark.seconds, mark.damageTaken);
  g.player.teleport({ position: boss.position.clone().setY(0), yaw: 0 });
  g.powerUps.debugDrop('storeWideClearance', boss.position);
  t.tick(2);
  assert.ok(boss.health < boss.maxHealth * 0.3, 'the scenario: the Clearance reached the boss');
  assert.equal(boss.isAlive, true, 'heavily wounded, never killed (a clearance kill pays nothing)');
});

test('Stay for overtime, then Save & quit before the game has run a tick: the save still holds the win', (context) => {
  const storage = memoryStorage();
  const t = headlessGame({ saveStorage: storage });
  context.after(() => t.g.map.dispose());
  const { g } = t;
  t.tick();
  g.map.areaUnlocks.unlock('hallway', { instant: true });
  g.rounds.jumpTo(21);
  t.tick(3); // (a snapshot of the round before the win exists)
  for (const boss of ['janitor', 'guard', 'manager', 'influencer']) g.debug.run('closing', 'grant', boss);
  for (const line of ['janitor', 'guard', 'manager']) while (!g.closing.isDone(line)) g.events.emit(
    line === 'janitor' ? 'fountainKill' : line === 'manager' ? 'ritualCollect' : 'purchase', { kind: 'closing', id: 'nightSafe' });
  g.events.emit('purchase', { kind: 'closing', id: 'validation' });
  g.events.emit('bossDefeated', { zombie: { type: { id: 'lastCustomer' }, position: g.player.position } });
  g.events.emit('escapeVanStart');
  assert.equal(g.state.winPending, true, 'the scenario: the win receipt is up');
  assert.equal(g.stayForOvertime(), true);
  // No tick: main.js shows the pause screen (with Save & quit) right after Stay for overtime.
  assert.equal(g.saveGame.saveAndQuit(), true);
  const loaded = headlessGame({ saveStorage: storage });
  context.after(() => loaded.g.map.dispose());
  assert.equal(loaded.g.saveGame.load(), true);
  assert.equal(loaded.g.state.won, true, 'the shift was completed');
  assert.notEqual(loaded.g.overtimeFrom, null, 'and this is overtime');
});

test('Continue with a Second Chance already spent does not announce "Second Chance redeemed" again', (context) => {
  const t = headlessGame({ saveStorage: memoryStorage() });
  context.after(() => t.g.map.dispose());
  const { g } = t;
  t.tick(2);
  g.secondChance.buy();
  g.health.takeDamage(1e6, { type: 'zombie', id: 'shopper' });
  assert.equal(g.secondChance.status, 'used', 'the scenario: revived once');
  t.tick(60 * 5);
  g.rounds.skipRound();
  t.tick(2);
  g.stats.health = g.stats.maxHealth;
  assert.equal(g.saveGame.saveAndQuit(), true);
  const before = t.hud.calls.length;
  assert.equal(g.saveGame.load(), true);
  assert.equal(g.secondChance.status, 'used', 'still spent');
  const lines = t.hud.calls.slice(before).filter(([name]) => name === 'showAnnouncement').map(([, line]) => line.text);
  assert.ok(!lines.some((text) => /Second Chance/.test(text)), `the PA said: ${lines.join(' | ')}`);
  assert.deepEqual(t.hud.calls.slice(before).filter(([name]) => name === 'setSecondChance').map(([, on]) => on).slice(-1), [false], 'the HUD tag is off');
});

test('a tennis ball thrown with your face against a wall stays on your side of it', (context) => {
  const t = quietGame(context);
  const { g } = t;
  g.gun.give(weapons.tennisBallLauncher);
  t.tick(60);
  // Walk into the start room's west wall (HOFFMAN'S, locked, is behind it).
  t.standAt(-3, 14, 90);
  t.input.held.add('KeyW');
  t.tick(90);
  t.input.held.delete('KeyW');
  t.tick(10);
  const wallSide = g.player.position.x;
  const zombie = t.spawn('shopper', wallSide - 2.2, g.player.position.z);
  zombie.updateHitboxes();
  const points = g.wallet.points;
  t.press('Mouse0');
  let furthest = Infinity;
  for (let i = 0; i < 120; i++) {
    for (const ball of g.balls.list) furthest = Math.min(furthest, ball.position.x);
    t.tick();
  }
  assert.ok(Number.isFinite(furthest), 'the scenario: a ball was thrown');
  assert.ok(furthest > wallSide - 0.6, `the ball got to x ${furthest.toFixed(2)}, through the wall (you stood at ${wallSide.toFixed(2)})`);
  assert.equal(zombie.health, zombie.maxHealth, 'the zombie in the locked store was not hit');
  assert.equal(g.wallet.points, points, 'and nothing was paid for it');
});

test('Build-A-Blaster counts a kill for the gun that made it, not the gun in your hand when the balloon lands', (context) => {
  const t = quietGame(context);
  const { g } = t;
  g.debug.run('doors');
  t.tick(5);
  g.gun.give(weapons.balloonLauncher);
  t.tick(60);
  const build = (name) => [{ id: 'build', build: { name, stuffing: 'smoothie', heart: 'everyTenth', quality: 'understuffed' } }];
  g.gun.setMods('stapleGun', build('Stapley'));
  g.gun.setMods('balloonLauncher', build('Loony'));
  let kills = 0;
  g.events.on('kill', (kill) => { if (kill.weaponId === 'balloonLauncher' && g.gun.def.id === 'stapleGun') kills += 1; });
  for (let i = 0; i < 3; i++) {
    t.standAt(0, 15, 0);
    if (g.gun.def.id !== 'balloonLauncher') { t.press('Digit2'); t.tick(40); }
    const zombie = t.spawn('shopper', 0, 8);
    zombie.health = 1;
    zombie.updateHitboxes();
    t.press('Mouse0');
    t.tick(2);
    t.press('Digit1'); // (the staple gun is in hand when the balloon gets there)
    t.tick(240);
    g.zombies.clear();
    g.gun.weaponFor('balloonLauncher').refill();
  }
  assert.ok(kills > 0, 'the scenario: balloons killed after the switch');
  assert.equal(buildOf(g.gun.modsFor('balloonLauncher')).confirmed, kills, 'the launcher\'s build has its kills');
  assert.equal(buildOf(g.gun.modsFor('stapleGun')).confirmed ?? 0, 0, 'the staple gun\'s build has none of them');
});

test('a holstered gun is not frozen in time: its fire delay runs out and the Leaf Blower\'s tank refills', (context) => {
  const t = quietGame(context);
  const { g } = t;
  t.standAt(0, 12, 0);
  g.gun.give(weapons.stargazer);
  t.tick(60);
  let shots = 0;
  g.events.on('shot', () => { shots += 1; });
  t.press('Mouse0');
  assert.equal(shots, 1, 'the scenario: one Stargazer round fired');
  t.press('Digit1');
  t.tick(600); // ten seconds with the staple gun out
  t.press('Digit2');
  for (let i = 0; i < 120 && (g.gun.isSwitching || g.gun.def.id !== 'stargazer'); i++) t.tick();
  t.press('Mouse0');
  t.tick(12);
  assert.equal(shots, 2, 'ten seconds later the first click fires');

  g.gun.reset();
  t.tick();
  g.gun.give(weapons.leafBlower);
  t.tick(60);
  t.input.held.add('Mouse0');
  t.input.pressed.add('Mouse0');
  t.tick(60 * 8);
  t.input.held.delete('Mouse0');
  const blower = g.gun.weaponFor('leafBlower');
  assert.ok(blower.magazine < weapons.leafBlower.fuel.restartAt, 'the scenario: the tank ran dry');
  t.press('Digit1');
  t.tick(600);
  assert.equal(blower.magazine, g.gun.defOf('leafBlower').magazineSize, 'ten seconds in the holster: a full tank (config fuel.regenPerSecond)');
});

// A real game with every area open, god mode and no wave of its own (for the horde's routes).
function openMall(context) {
  const t = headlessGame();
  context.after(() => { t.g.resetRun(); t.g.map.dispose(); });
  const { g } = t;
  g.health.invulnerable = true;
  g.map.areaUnlocks.openAll();
  t.tick(130);
  g.rounds.jumpTo(3);
  g.rounds.update = () => {};
  g.zombies.clear();
  return t;
}

// Pockets a player can hop into (over a bench, a table, a kerb) where no walkable cell is within zombieNav.playerSearchRadius.
const POCKETS = [
  ['the Food Court bench pocket by the RESTOCK-O-MATIC', [6.8, 0, -2.75], [6.8, 0, -8]],
  ['the Food Court south-west nook behind the table', [-9.6, 0, -13.95], [-6, 0, -9]],
];
for (const [name, at, zombieAt] of POCKETS) {
  test(`the horde never freezes: standing in ${name}, zombies still have a route, still spawn and still come`, (context) => {
    const t = openMall(context);
    const { g } = t;
    g.player.teleport({ position: new THREE.Vector3(...at), yaw: 0 });
    t.tick(40);
    const nav = g.zombies.nav;
    const routed = g.map.spawnPoints.filter((s) => Number.isFinite(nav.distanceToTarget(s.position.x, s.position.z, s.position.y))).length;
    assert.ok(routed > 0, 'some spawn marker has a route towards the player (none: the wave stops spawning)');
    assert.ok(g.zombies.spawn('shopper'), 'the round can still spawn');
    g.zombies.clear();
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(...zombieAt));
    t.tick(70); // (risen)
    const from = zombie.position.clone();
    const gap = Math.hypot(from.x - at[0], from.z - at[2]);
    t.tick(60 * 6);
    const now = Math.hypot(zombie.position.x - at[0], zombie.position.z - at[2]);
    assert.ok(zombie.position.distanceTo(from) > 0.5 || now < 1.6, `a zombie ${gap.toFixed(1)} m away stood still for six seconds`);
    assert.ok(now < gap || now < 1.6, 'and it came closer');
  });
}

test('stairs and escalators: wherever a body can stand on a ramp, the horde knows you are on it', (context) => {
  const t = openMall(context);
  const { g } = t;
  const nav = g.zombies.nav;
  const R = feel.player.radius, H = feel.player.height;
  for (const ramp of g.colliders.ramps) {
    const misses = [];
    for (let x = ramp.minX + 0.02; x <= ramp.maxX - 0.02; x += 0.1) for (let z = ramp.minZ + 0.02; z <= ramp.maxZ - 0.02; z += 0.1) {
      const y = rampHeightAt(ramp, x, z);
      if (y === null || y < 0.7 || y > 5.6) continue; // (mid-flight: the ends are next to a floor)
      if (overlapsSolid(new THREE.Vector3(x, y, z), R, H, g.colliders, feel.movement.stepTolerance)) continue; // (no room for a body)
      if (!nav.rampAt(x, y, z)) misses.push([x.toFixed(2), y.toFixed(2), z.toFixed(2)].join(' '));
    }
    assert.deepEqual(misses.slice(0, 3), [], `${ramp.id}: ${misses.length} standable spots are not on its nav link (zombies lose you there)`);
  }
});

test('zombies on different floors leave each other alone: one upstairs does not shove one right below it', (context) => {
  const t = openMall(context);
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(15, 0, 0), yaw: 0 });
  t.tick(2);
  const below = g.zombies.spawn('shopper', new THREE.Vector3(-4, 0, 0));
  const above = g.zombies.spawn('shopper', new THREE.Vector3(-3.7, 6.3, 0));
  below.speed = 0;
  above.speed = 0;
  t.tick(90);
  assert.ok(Math.abs(above.position.y - below.position.y) > 5, 'the scenario: a floor apart');
  assert.ok(Math.abs(below.position.x + 4) < 0.01 && Math.abs(above.position.x + 3.7) < 0.01,
    `they pushed each other: below x ${below.position.x.toFixed(2)} (was -4), above x ${above.position.x.toFixed(2)} (was -3.7)`);
});

test('the failsafe rescues a wedged zombie that is right above you on another floor (near on the map is not near)', (context) => {
  const t = openMall(context);
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(0, 0, 0), yaw: 0 });
  t.tick(2);
  const zombie = g.zombies.spawn('shopper', new THREE.Vector3(-3, 6.3, 0));
  zombie.speed = 0; // (wedged: it cannot move)
  const from = zombie.position.clone();
  t.tick(60 * 45);
  assert.ok(zombie.position.distanceTo(from) > 0.5, 'still wedged upstairs after 45 seconds: a round would wait on it forever');
});

test('a boss\'s backup counts as that type\'s first sighting: the intro carries the zombie and the guide page is marked seen', (context) => {
  const t = headlessGame();
  context.after(() => { t.g.resetRun(); t.g.map.dispose(); });
  const { g } = t;
  g.health.invulnerable = true;
  g.map.areaUnlocks.openAll();
  t.tick(5);
  g.rounds.jumpTo(9);
  t.tick(2);
  const intros = [];
  g.events.on('typeIntro', (intro) => intros.push([intro.typeId, intro.zombie?.type.id ?? null]));
  const seenBefore = g.guide.pages().find((page) => page.entry.id === 'mallWalker').seen;
  const zombie = g.rounds.spawnBackup('mallWalker');
  assert.ok(zombie, 'the scenario: a Mall Walker was sent as backup');
  assert.equal(seenBefore, false, 'the scenario: never seen before');
  assert.deepEqual(intros, [['mallWalker', 'mallWalker']], 'the intro names the zombie that arrived');
  assert.equal(g.guide.pages().find((page) => page.entry.id === 'mallWalker').seen, true, 'its Survival Guide page is marked seen');
});

// Tops a chain of jumps reached (each replayed with real key presses during the hunt), where no zombie could hit you: feet on top.
const PERCHES = [
  ['the start room\'s TV wall (from the crates)', [0.5, 1.95, 15.65]],
  ['the hallway arcade cabinets (from the prop beside them)', [-17.0, 1.9, -1.5]],
  ['a Mega Mart gondola (a sprint-jump off the checkout)', [27.5, 2.0, -12]],
  ['the sealed escalator\'s first side wall (from the planter)', [-4.7, 1.62, 1.15]],
  ['the escalator side wall two steps up (the hub perch)', [-6.9, 2.77, 1.15]],
  ['Good Sports\' counter (over it: the clerk\'s strip has no way out)', [-13, 1.25, -19.3]],
  ['Play Time Toys\' counter', [-13.5, 1.25, -3.6]],
  ['the parking kerb island (zombies cannot step onto a kerb, so nothing reached you on it)', [38.0, 0.15, -9.0]],
];
test('nobody can stand on the known perches: there is no room for a body on top of them', (context) => {
  const t = openMall(context);
  const { g } = t;
  for (const [name, at] of PERCHES) {
    const feet = new THREE.Vector3(...at);
    const under = g.colliders.some((box) => Math.abs(box.max.y - at[1]) < 0.011 && at[0] > box.min.x && at[0] < box.max.x && at[2] > box.min.z && at[2] < box.max.z);
    assert.ok(under, `the scenario: ${name} still has its top at ${at}`);
    assert.ok(overlapsSolid(feet, feel.player.radius, feel.player.height, g.colliders, feel.movement.stepTolerance), `${name}: a body fits on top`);
    const crouched = overlapsSolid(feet, feel.player.radius, feel.movement.proneHeight ?? 0.5, g.colliders, feel.movement.stepTolerance);
    assert.ok(crouched, `${name}: not lying down either`);
  }
  // The slot between the parking kerb island and the first van (0.75 m: a body fit, the horde's routes did not).
  const slot = new THREE.Vector3(39.65, 0, -12.2);
  assert.ok(!g.zombies.nav.isWalkableAt(slot.x, slot.z, 0), 'the scenario: zombies cannot route into the slot');
  assert.ok(overlapsSolid(slot, feel.player.radius, feel.movement.proneHeight ?? 0.5, g.colliders, feel.movement.stepTolerance), 'so the player cannot stand in it either');
});

test('GRAB-A-GUN: a save taken during a site\'s last grab comes back sold out, not open with "0 left"', (context) => {
  const storage = memoryStorage();
  const setup = () => {
    const t = headlessGame({ saveStorage: storage });
    context.after(() => t.g.map.dispose());
    t.tick();
    t.g.rounds.update = () => {};
    t.g.zombies.clear();
    return { ...t, claw: t.g.features.instanceOf('clawMachine') };
  };
  const stand = ({ g, claw, tick }) => {
    const { position, normal } = claw.site.cabinet;
    const floorY = clawMachine.sites.find((site) => site.id === claw.site.id).floorY;
    g.player.teleport({ position: new THREE.Vector3(position.x + normal.x * 1.3, floorY, position.z + normal.z * 1.3), yaw: Math.atan2(normal.x, normal.z) });
    g.player.pitch = 0;
    tick();
  };
  const a = setup();
  a.g.wallet.earn(50_000);
  a.g.map.areaUnlocks.unlock('hallway');
  a.tick(60);
  const real = Math.random;
  context.after(() => { Math.random = real; });
  Math.random = () => 0.99; // (after the map is built: no plush)
  for (let i = 0; i < clawMachine.stock - 1; i++) {
    stand(a);
    a.press('KeyF', 20); // pay
    a.tick(5);
    a.press('KeyF', 1); // drop
    a.tick(Math.ceil(clawMachine.liftSeconds * 60) + 5);
    a.press('KeyF', 20); // take
    a.tick(40);
  }
  stand(a);
  const beforeGrab = a.g.wallet.points;
  a.press('KeyF', 20); // the site's last grab
  assert.ok(a.g.wallet.points < beforeGrab, 'the scenario: the last grab is paid');
  assert.equal(a.claw.stock, 0, 'the scenario: the last grab is paid and under way');
  a.g.rounds.skipRound(); // (the round's last zombie dies during the grab: the snapshot is taken now)
  a.tick(1);
  Math.random = real;
  a.g.state.assisted = false;
  assert.equal(a.g.saveGame.saveAndQuit(), true);

  const b = setup();
  assert.equal(b.g.saveGame.load(), true);
  b.tick(2);
  // The grab under way is not kept by a save, so it is not charged either: the points are back and so is that grab.
  assert.equal(b.g.wallet.points, beforeGrab, 'the grab the save dropped was refunded');
  assert.equal(b.claw.stock, 1, 'and it is still there to be had');
  assert.equal(b.claw.phase, 'idle');
  // A save that does hold a sold-out machine (an older one): never open with nothing left.
  b.claw.restore({ siteId: b.claw.site.id, grabsHere: clawMachine.stock, stock: 0 });
  const points = b.g.wallet.points;
  stand(b);
  b.press('KeyF', 20);
  assert.equal(b.g.wallet.points, points, 'a sold-out machine takes no money');
  assert.ok(b.claw.stock >= 0, `stock went to ${b.claw.stock}`);
  assert.equal(b.claw.phase, 'closed', 'out of service until the next round');
  b.g.events.emit('roundStart', { round: b.g.rounds.round + 1 });
  assert.equal(b.claw.phase, 'idle', 'and restocked with the round, as a sold-out machine is');
  assert.equal(b.claw.stock, clawMachine.stock);
});

test('the HUD is told about the boss voucher when it changes, not sixty times a second', (context) => {
  const t = quietGame(context);
  const { g } = t;
  const calls = () => t.hud.calls.filter(([name]) => name === 'setVoucher');
  let before = calls().length;
  t.tick(120);
  assert.equal(calls().length - before, 0, 'two quiet seconds: nothing to say');
  g.pricing.setVoucher(bossVouchers.discountCode);
  before = calls().length;
  t.tick(120);
  assert.equal(calls().length - before, 1, 'a voucher picked up: told once');
  assert.equal(calls().at(-1)[1]?.name, bossVouchers.discountCode.name);
  g.resetRun();
  t.tick(2);
  assert.equal(calls().at(-1)[1], null, 'Play again: the tag is cleared');
});

test('a Sentry with zombies in range but none in sight waits a beat before looking again (not every tick)', (context) => {
  const t = headlessGame();
  context.after(() => { t.g.resetRun(); t.g.map.dispose(); });
  const { g } = t;
  t.tick(1);
  t.standAt(0, 15, 0);
  g.rounds.jumpTo(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;
  // In the start room, its shutter shut; the zombie stands in the hallway behind it.
  const zombie = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 3));
  zombie.position.set(0, 0, 3);
  zombie.state = 'chasing';
  zombie.speed = 1e-6;
  zombie.updateHitboxes();
  g.equipment.detonate('sentry', new THREE.Vector3(0, 0.16, 13));
  const item = g.equipment.sentry;
  assert.ok(item?.deployed, 'the scenario: a Sentry is out');
  t.tick(Math.ceil(kiosk.products.sentry.turret.warmupSeconds * 60) + 30); // (stood up, and looking)
  assert.equal(zombie.health, zombie.maxHealth, 'the scenario: it cannot see the zombie');
  const waits = [];
  for (let i = 0; i < 30; i++) { t.tick(1); waits.push(item.fireTimer); }
  const looks = waits.filter((timer, i) => i > 0 && timer > waits[i - 1]).length; // (the timer is wound back up each time it looks)
  assert.ok(waits.some((timer) => timer > 1e-9), 'it waits between looks (every look is a line-of-sight ray per zombie in range)');
  assert.ok(looks >= 1 && looks <= Math.ceil(0.5 / kiosk.products.sentry.turret.fireSeconds) + 1, `it looked ${looks} times in half a second`);
});

test('jumping into the Build-A-Blaster order form does not leave you hanging in the air', (context) => {
  const t = quietGame(context);
  const { g } = t;
  g.wallet.earn(20000);
  for (const id of Object.keys(g.map.zones)) if (!g.map.zones[id].open) g.map.areaUnlocks.unlock(id, { instant: true });
  t.tick(5);
  const ritual = g.features.instanceOf('workshop').ritual;
  t.standAt(0, 12, 0);
  const floor = g.player.position.y;
  t.press('Space', 1);
  t.tick(13);
  assert.ok(g.player.position.y > floor + 0.3, 'the scenario: in the air');
  ritual.orderForm.open();
  t.tick(180);
  assert.equal(g.state.menu, 'orderForm', 'the form is still open');
  assert.ok(Math.abs(g.player.position.y - floor) < 0.01 && g.player.grounded, `three seconds later you are at y ${g.player.position.y.toFixed(2)} (the floor is ${floor.toFixed(2)})`);
  const at = g.player.position.clone();
  t.input.held.add('KeyW');
  t.tick(30);
  t.input.held.delete('KeyW');
  assert.ok(g.player.position.distanceTo(at) < 0.01, 'and on the ground the form still holds you still');
});

test('sprinting up an escalator and jumping does not sink you under the treads', (context) => {
  const t = openMall(context);
  const { g } = t;
  const ramp = g.colliders.ramps.find((r) => rampHeightAt(r, -9, 2) !== null);
  assert.ok(ramp, 'the scenario: the hallway escalator');
  for (const jumpAt of [-6, -7, -8]) {
    g.player.teleport({ position: new THREE.Vector3(-3, 0, 2), yaw: Math.PI / 2 }); // (facing -X: up the escalator)
    t.tick(5);
    let jumped = false;
    let sunk = 0;
    t.input.held.add('KeyW');
    t.input.held.add('ShiftLeft');
    for (let i = 0; i < 150; i++) {
      if (!jumped && g.player.position.x <= jumpAt) {
        jumped = true;
        t.input.pressed.add('Space');
      }
      t.tick(1);
      const surface = rampHeightAt(ramp, g.player.position.x, g.player.position.z);
      if (surface !== null) sunk = Math.max(sunk, surface - g.player.position.y);
    }
    t.input.held.delete('KeyW');
    t.input.held.delete('ShiftLeft');
    assert.ok(jumped, 'the scenario: jumped on the way up');
    assert.ok(sunk < 0.3, `jump at x ${jumpAt}: feet got ${sunk.toFixed(2)} m under the treads`);
  }
});

// ---- Decisions taken after the hunt (docs/history.md, 14 November 2026) ----

test('a boss\'s voucher survives Save & Quit when the boss was the round\'s last kill', (context) => {
  const t = headlessGame({ saveStorage: memoryStorage() });
  context.after(() => { t.g.resetRun(); t.g.map.dispose(); });
  const { g } = t;
  g.health.invulnerable = true;
  t.tick(2);
  g.map.areaUnlocks.unlock('hallway', { instant: true });
  g.rounds.jumpTo(9);
  t.tick(5);
  const clearOthers = (keep) => { for (const z of g.zombies.zombies) if (z.isAlive && z !== keep) z.takeHit({ damage: z.health + 1, part: 'body', source: 'hazard' }); };
  clearOthers(null);
  const boss = g.bosses.summon('guard');
  for (let i = 0; i < 600 && boss.state === 'spawning'; i++) { t.tick(1); clearOthers(boss); }
  const reward = boss.type.reward;
  assert.ok(bossVouchers[reward], 'the scenario: this boss leaves a voucher');
  g.player.teleport({ position: new THREE.Vector3(0, 0, 12), yaw: 0 }); // (away from where it falls)
  boss.takeHit({ damage: boss.health + 1, part: 'body', source: 'gun' });
  g.saveGame.markRoundStart(); // (it was the last of the wave: the round flips on the same tick, and the snapshot is taken with it)
  t.tick(1);
  // You pick it up AFTER the snapshot: the save knows nothing of the voucher in your pocket.
  for (let i = 0; i < 600 && !g.pricing.voucher; i++) {
    if (g.powerUps.pickup) g.player.teleport({ position: g.powerUps.pickup.position.clone().setY(0), yaw: 0 });
    t.tick(1);
  }
  assert.equal(g.pricing.voucher?.name, bossVouchers[reward].name, 'the scenario: the voucher was collected');
  assert.equal(g.saveGame.saveAndQuit(), true);
  assert.equal(g.saveGame.load(), true);
  g.player.teleport({ position: new THREE.Vector3(0, 0, 12), yaw: 0 });
  t.tick(5);
  assert.ok(g.pricing.voucher || g.powerUps.pickup?.id === reward, 'after Continue the reward is in your pocket or back on the floor');
  for (let i = 0; i < 600 && !g.pricing.voucher; i++) {
    if (g.powerUps.pickup) g.player.teleport({ position: g.powerUps.pickup.position.clone().setY(0), yaw: 0 });
    t.tick(1);
  }
  assert.equal(g.pricing.voucher?.name, bossVouchers[reward].name, 'and it can be collected again');
});

test('Second Chance keeps your Bubble Wrap: a revive after a lethal fall leaves the layers on', (context) => {
  const t = quietGame(context);
  const { g } = t;
  g.health.addArmour(3);
  const layers = [...g.health.armour];
  g.secondChance.buy();
  g.health.takeDamage(9999, { type: 'fall', fall: true }); // (a fall goes past armour: the layers were never touched)
  assert.equal(g.state.over, false, 'the scenario: revived');
  assert.equal(g.secondChance.status, 'used');
  assert.deepEqual([...g.health.armour], layers, 'the Bubble Wrap is still on');
  assert.equal(g.stats.health, g.stats.maxHealth, 'at full health');
});

test('a reissued Return to Sender comes back with the ammo the last one had, not a free full load', (context) => {
  const t = quietGame(context);
  const { g } = t;
  g.returnQuest.debug('called');
  assert.equal(g.returnQuest.collect(), true, 'the scenario: the first one is issued');
  t.tick(40);
  const first = g.gun.weaponFor('returnToSender');
  assert.ok(first.magazine > 0 && first.reserve > 1, 'the first issue is fully loaded');
  first.magazine = 1;
  first.reserve = 2;
  t.tick(2);
  g.gun.give(weapons.nailGun); // (a 500-point wall gun bought over it)
  t.tick(40);
  assert.equal(g.gun.owns('returnToSender'), false, 'the scenario: it was replaced');
  assert.equal(g.returnQuest.collect(), true, 'the desk reissues it');
  t.tick(2);
  const again = g.gun.weaponFor('returnToSender');
  assert.deepEqual([again.magazine, again.reserve], [1, 2], 'with what it had: ammo is the desk\'s to sell');
  // ...and over a save.
  const kept = g.returnQuest.serialize();
  g.gun.give(weapons.nailGun);
  t.tick(40);
  g.returnQuest.restore(kept);
  assert.equal(g.returnQuest.collect(), true);
  t.tick(2);
  assert.deepEqual([g.gun.weaponFor('returnToSender').magazine, g.gun.weaponFor('returnToSender').reserve], [1, 2], 'a load remembers it too');
});

test('a Flash Sale is skipped when it would mark nothing you can buy right now', (context) => {
  const t = quietGame(context); // (start room + hallway, the staple gun)
  const { g } = t;
  const groups = Object.fromEntries(economy.flashSales.groups.map((group) => [group.id, group]));
  const eligible = () => saleEligibility({ map: g.map, gun: g.gun, warranty: g.warranty, wardrobe: g.wardrobe, kiosk: g.features.instanceOf('kiosk'), features: g.features });
  const marks = (group) => collectSaleSpots({ map: g.map, features: g.features, gun: g.gun, warranty: g.warranty, wardrobe: g.wardrobe }, { categories: group.categories }).length;
  for (const id of ['ammo', 'attachments', 'hazards', 'tiers', 'weapons', 'apparel', 'doors']) {
    if (!groups[id]) continue;
    assert.equal(eligible()(groups[id]), marks(groups[id]) > 0, `${id}: on sale only if it marks a buy spot (it marks ${marks(groups[id])})`);
  }
  assert.equal(marks(groups.ammo), 0, 'the scenario: with only the staple gun there is no ammo to buy');
  g.gun.give(weapons.nailGun); // (its wall buy is in the hallway: ammo for it is on sale there)
  t.tick(40);
  assert.equal(eligible()(groups.ammo), true, 'with a wall gun in hand an ammo sale is of use');
});

test('a fleeing Shoplifter can be knocked down like anyone else: it stops, and its getaway clock waits', (context) => {
  const t = openMall(context);
  const { g } = t;
  g.rounds.jumpTo(5);
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(0, 0, 2), yaw: 0 });
  t.tick(2);
  g.wallet.earn(2000);
  const thief = g.zombies.spawn('shoplifter', new THREE.Vector3(1.2, 0, 2));
  t.tick(70);
  g.events.emit('playerHit', { damage: 0, zombie: thief });
  t.tick(20);
  assert.ok(thief.loot > 0 && thief.control, 'the scenario: it stole and is running');
  g.health.invulnerable = false;
  const clock = thief.fleeTimer;
  const from = thief.position.clone();
  assert.equal(thief.applySlip(2, 6), true, 'the scenario: it slipped');
  t.tick(60);
  assert.ok(thief.position.distanceTo(from) < 1.5, `flat on its back it still ran ${thief.position.distanceTo(from).toFixed(2)} m in a second`);
  assert.equal(thief.fleeTimer, clock, 'the getaway clock waits while it is down');
  t.tick(120);
  assert.ok(thief.removed || thief.fleeTimer < clock, 'back on its feet, it runs again');
});

test('Save & Quit and storage: a newer build\'s save is left alone, and the "discarded" notice is offered once', (context) => {
  const storage = memoryStorage();
  const t = headlessGame({ saveStorage: storage });
  context.after(() => t.g.map.dispose());
  const { g } = t;
  const newer = JSON.stringify({ version: saveConfig.version + 1, round: 7, savedAt: 'x', data: {} });
  storage.setItem(saveConfig.storageKey, newer);
  assert.equal(g.saveGame.peek(), null, 'no Continue for a save this build cannot read');
  assert.equal(storage.getItem(saveConfig.storageKey), newer, 'but it is not deleted: the newer build can still continue it');
  assert.equal(g.saveGame.load(), false);
  g.saveGame.discard(); // (Play from the title: there was no "your save is discarded" warning, so it must not be)
  assert.equal(storage.getItem(saveConfig.storageKey), newer, 'still there after a failed load and a fresh Play');
  assert.equal(g.saveGame.takeNotice(), saveConfig.newerNotice, 'the title is given a line to say so');
  assert.equal(g.saveGame.takeNotice(), null, 'once');

  storage.setItem(saveConfig.storageKey, JSON.stringify({ version: saveConfig.version - 1, round: 3, data: {} }));
  assert.equal(g.saveGame.peek(), null);
  assert.equal(storage.getItem(saveConfig.storageKey), null, 'an older save is dropped, as before');
  assert.equal(g.saveGame.takeNotice(), saveConfig.droppedNotice);
  assert.equal(g.saveGame.takeNotice(), null, 'not again on every return to the title');
});

test('Save & Quit and storage: a browser that blocks storage greys the button out instead of pretending to save', (context) => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError: storage is blocked'); } });
  context.after(() => { delete globalThis.localStorage; });
  const t = headlessGame(); // (no storage handed in: the game looks for the browser's)
  context.after(() => t.g.map.dispose());
  const { g } = t;
  t.tick(2);
  g.rounds.skipRound();
  t.tick(2);
  assert.deepEqual(g.saveGame.canSave(), { ok: false, reason: saveConfig.reasons.blocked });
  assert.equal(g.saveGame.saveAndQuit(), false, 'nothing is "saved" into memory to be lost with the tab');
});

test('Save & Quit and storage: a full store says so on the button, and the next round may try again', (context) => {
  const storage = memoryStorage();
  let full = true;
  const setItem = storage.setItem;
  storage.setItem = (key, value) => { if (full && key === saveConfig.storageKey) throw new Error('QuotaExceededError'); setItem(key, value); };
  const t = headlessGame({ saveStorage: storage });
  context.after(() => t.g.map.dispose());
  const { g } = t;
  t.tick(2);
  g.rounds.skipRound();
  t.tick(2);
  assert.equal(g.saveGame.canSave().ok, true, 'the scenario: nothing wrong until the write');
  assert.equal(g.saveGame.saveAndQuit(), false, 'the write failed: the run goes on');
  assert.deepEqual(g.saveGame.canSave(), { ok: false, reason: saveConfig.reasons.full }, 'and the button says why');
  full = false;
  g.rounds.skipRound();
  t.tick(2);
  assert.equal(g.saveGame.canSave().ok, true, 'a new round: worth another try');
  assert.equal(g.saveGame.saveAndQuit(), true);
});

test('career stats: two tabs do not wipe each other\'s runs (the ledger is re-read before a run is added)', () => {
  const storage = memoryStorage();
  const run = (round) => ({ round, timeAlive: round * 60, kills: round * 10, headshotKills: round, pointsEarned: round * 1000, shotsFired: 100, shotsHit: 50, accuracy: 0.5, won: false });
  const tabA = createCareerStats({ storage });
  const tabB = createCareerStats({ storage }); // (both opened before either finished a run)
  tabA.recordRun(run(12));
  const result = tabB.recordRun(run(2));
  assert.equal(result.snapshot.totals.runs, 2, 'tab B added its run to tab A\'s');
  assert.equal(result.snapshot.bests.round, 12, 'and kept tab A\'s record');
  assert.deepEqual(result.newRecords, [], 'a round 2 run is no new record after a round 12');
  assert.equal(createCareerStats({ storage }).snapshot().totals.runs, 2, 'that is what is stored');
});

test('a Shoplifter that gets away after you died says nothing over the receipt: no PA line, no chime', (context) => {
  const t = openMall(context);
  const { g } = t;
  g.rounds.jumpTo(5);
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(0, 0, 2), yaw: 0 });
  t.tick(2);
  g.wallet.earn(2000);
  const thief = g.zombies.spawn('shoplifter', new THREE.Vector3(1.2, 0, 2));
  t.tick(70);
  g.events.emit('playerHit', { damage: 0, zombie: thief });
  t.tick(20);
  assert.ok(thief.loot > 0 && thief.control, 'the scenario: it stole and is running');
  g.health.invulnerable = false;
  g.health.takeDamage(1e6, { type: 'zombie', id: 'shopper' });
  assert.equal(g.state.over, true, 'the scenario: you died while it was still running');
  let escaped = 0;
  g.events.on('shoplifterEscaped', () => { escaped += 1; });
  const lines = () => t.hud.calls.filter(([name]) => name === 'showAnnouncement').length;
  const before = [lines(), t.sounds.length];
  t.tick(Math.ceil(thief.fleeTimer * 60) + 10);
  assert.equal(escaped, 1, 'the scenario: it got away after the death (the event still fires)');
  assert.deepEqual([lines(), t.sounds.length], before, 'the PA read "a shoplifter left with your points" over the receipt');
});
