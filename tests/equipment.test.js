// Kiosk Kevin phase 1 (docs/kiosk-kevin-plan.md): the two equipment pockets, their buttons and the Soda Bomb (game/equipment.js,
// game/equipment/equipmentDamage.js, config/kiosk.js), in the REAL game (tests/helpers/headlessGame.js). Checked: real input on the
// keyboard and controller codes throws from the right pocket; no throw while switching, vaulting, swinging, in a menu, mid-throw or
// dead; a throw blocks the gun and cancels a reload; the bottle bounces off zombies without hurting them; the blast pays only through
// 'kill' (never 'hit', +10 or power-up credit) and never touches Sunny or a dummy; the power curve holds; melee moved off RB;
// death and Play again leave nothing behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { kiosk } from '../src/config/kiosk.js';
import { bindings, controlsHelp, buttonLabels } from '../src/config/controls.js';
import { debug } from '../src/config/debug.js';
import { weapons } from '../src/config/weapons.js';
import { zombieHealthForRound } from '../src/config/economy.js';
import { equipmentPower, blastFalloff } from '../src/game/equipment/equipmentDamage.js';
import { pointsForHit } from '../src/game/wallet.js';
import { createThrowableView } from '../src/fx/throwableView.js';
import { Input } from '../src/core/input.js';

const soda = kiosk.products.sodaBomb;
const BLOCK_TICKS = Math.round(kiosk.throw.blockSeconds / dt);

// A real game in the start room, the round's own spawning switched off (zombies are placed by hand), pockets full.
function fixture({ fill = true } = {}) {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;
  t.standAt(0, 12, 0);
  if (fill) g.debug.run('pockets');
  return t;
}

// A Shopper standing still at (x, z): no rising, no walking.
function shopperAt(t, x, z) {
  const zombie = t.g.zombies.spawn('shopper', new THREE.Vector3(x, 0, z));
  zombie.position.set(x, 0, z);
  zombie.prevPosition?.copy(zombie.position);
  zombie.state = 'chasing';
  zombie.speed = 0;
  zombie.updateHitboxes();
  return zombie;
}

const at = (zombie) => new THREE.Vector3(zombie.position.x, 0.13, zombie.position.z); // a bottle resting at its feet
const lethal = (g) => g.equipment.pockets.lethal;

test('the power curve: equipment grows every round, far slower than zombie health; the plan\'s table holds', () => {
  let previous = 0;
  for (let round = 1; round <= 40; round++) {
    const power = equipmentPower(round);
    assert.ok(power > previous, `round ${round} is stronger than the one before`);
    previous = power;
  }
  const healthGrowth = zombieHealthForRound(30) / zombieHealthForRound(1);
  const powerGrowth = equipmentPower(30) / equipmentPower(1);
  assert.ok(powerGrowth < healthGrowth / 5, `equipment x${powerGrowth.toFixed(1)} vs zombies x${healthGrowth.toFixed(1)}`);
  for (const [round, power] of [[1, 0.54], [5, 0.81], [10, 1.0], [15, 1.15], [20, 1.31], [25, 1.5], [30, 1.71]]) {
    assert.ok(Math.abs(equipmentPower(round) - power) < 0.02, `round ${round}: ${equipmentPower(round).toFixed(3)}`);
  }
  assert.equal(blastFalloff(0, soda.blast), 1);
  assert.ok(Math.abs(blastFalloff(soda.blast.radius, soda.blast) - soda.blast.edgeFraction) < 1e-9);
  assert.equal(blastFalloff(soda.blast.radius + 0.01, soda.blast), 0);
});

test('a Soda Bomb centre hit kills a real Shopper at rounds 1 and 10, and takes 40 to 60% of one at round 25', () => {
  for (const [round, expect] of [[1, 'kill'], [10, 'kill'], [25, [0.4, 0.6]]]) {
    const t = fixture();
    t.g.rounds.jumpTo(round);
    const zombie = shopperAt(t, 0, 9);
    assert.equal(zombie.maxHealth, zombieHealthForRound(round), `a round ${round} Shopper`);
    t.g.equipment.detonate('sodaBomb', at(zombie));
    if (expect === 'kill') assert.equal(zombie.isAlive, false, `round ${round}: killed`);
    else {
      const share = 1 - zombie.health / zombie.maxHealth;
      assert.ok(zombie.isAlive && share >= expect[0] && share <= expect[1], `round 25 share ${share.toFixed(2)}`);
    }
  }
});

test('the blast falls off with distance, stops at its radius and behind a wall', () => {
  const t = fixture();
  t.g.rounds.jumpTo(25); // (nothing dies, so every hit can be read)
  const near = shopperAt(t, -2, 9);
  const edge = shopperAt(t, -2 + soda.blast.radius - 0.5, 9);
  const far = shopperAt(t, -2, 9 + soda.blast.radius + 1.5);
  t.g.equipment.detonate('sodaBomb', at(near));
  const lost = (z) => z.maxHealth - z.health;
  assert.ok(lost(near) > lost(edge) && lost(edge) > 0, `${lost(near)} > ${lost(edge)} > 0`);
  assert.equal(lost(far), 0, 'out of range');
  // The start room's closed shutter (z 6) between the blast and a zombie in the hallway.
  const behind = shopperAt(t, 0, 4.6);
  t.g.equipment.detonate('sodaBomb', new THREE.Vector3(0, 0.13, 7.2));
  assert.equal(behind.health, behind.maxHealth, 'shielded by the shutter');
});

test('a boss takes only its fixed share of its max health', () => {
  const t = fixture();
  const { g } = t;
  g.rounds.jumpTo(9);
  const boss = g.bosses.summon('guard');
  assert.ok(boss?.type.boss);
  boss.position.set(0, 0, 9);
  boss.setState('chasing'); // (up out of its entrance, hitboxes above the floor)
  boss.speed = 0;
  boss.updateHitboxes();
  const before = boss.health;
  g.equipment.detonate('sodaBomb', at(boss));
  const expected = boss.maxHealth * soda.blast.bossShare * boss.damageTakenMultiplier;
  assert.ok(Math.abs(before - boss.health - expected) < 1, `lost ${before - boss.health}, expected ${expected}`);
});

test('keyboard G and controller RB throw from the Lethal pocket; middle click and D-pad right from the Tactical one', () => {
  const t = fixture();
  const { g } = t;
  const thrown = [];
  g.events.on('equipmentThrown', (e) => thrown.push(e));
  t.press('KeyG', 1);
  assert.deepEqual(thrown.at(-1), { id: 'sodaBomb', pocket: 'lethal', left: soda.charges - 1 });
  assert.equal(g.equipment.live.length, 1);
  assert.equal(g.throwables.list.length, 1, 'on its own ballistics instance');
  assert.equal(g.balls.list.length, 0, 'not on the Tennis Ball Launcher\'s');
  t.tick(BLOCK_TICKS);
  t.press('PadRB', 1);
  assert.equal(thrown.length, 2);
  assert.equal(lethal(g).count, soda.charges - 2);

  // The Tactical pocket has nothing on sale yet (phase 5): a stand-in product proves its buttons.
  kiosk.products.testCard = { ...soda, id: 'testCard', name: 'Test Card', pocket: 'tactical', charges: 2 };
  try {
    t.tick(BLOCK_TICKS);
    g.equipment.give('testCard');
    t.press('Mouse1', 1);
    assert.deepEqual(thrown.at(-1), { id: 'testCard', pocket: 'tactical', left: 1 });
    t.tick(BLOCK_TICKS);
    t.press('PadRight', 1);
    assert.deepEqual(thrown.at(-1), { id: 'testCard', pocket: 'tactical', left: 0 });
    assert.deepEqual(g.equipment.pockets.tactical, { id: null, count: 0 }, 'empty');
    assert.equal(lethal(g).count, soda.charges - 2, 'the other pocket untouched');
    t.tick(BLOCK_TICKS);
    t.press('Mouse1', 1);
    assert.equal(thrown.length, 4, 'an empty pocket throws nothing');
  } finally {
    delete kiosk.products.testCard;
  }
});

test('one kind per pocket: the same kind adds, another kind replaces it and leaves the other pocket alone', () => {
  const t = fixture({ fill: false });
  const { g } = t;
  assert.deepEqual(g.equipment.give('sodaBomb', 2), { pocket: 'lethal', count: 2, replaced: null });
  assert.equal(g.equipment.give('sodaBomb', 1).count, 3);
  kiosk.products.testCake = { ...soda, id: 'testCake', pocket: 'lethal', charges: 2 };
  try {
    assert.deepEqual(g.equipment.give('testCake'), { pocket: 'lethal', count: 2, replaced: { id: 'sodaBomb', count: 3 } });
    assert.deepEqual(g.equipment.pockets.tactical, { id: null, count: 0 });
  } finally {
    delete kiosk.products.testCake;
  }
  assert.throws(() => g.equipment.give('nope'), /unknown product/);
  for (const product of Object.values(kiosk.products)) assert.ok(kiosk.pockets.includes(product.pocket), product.id);
});

test('a throw blocks the gun for its moment, cancels a reload, and only one throw happens at a time', () => {
  const t = fixture();
  const { g } = t;
  for (let i = 0; i < 3; i++) { t.press('Mouse0', 1); t.tick(15); }
  t.press('KeyR', 1);
  assert.equal(g.gun.weapon.isReloading, true);
  t.press('KeyG', 1);
  assert.equal(g.gun.weapon.isReloading, false, 'the throw cancelled the reload');
  assert.equal(g.equipment.isBusy, true);
  const shots = g.runStats.shotsFired;
  t.press('Mouse0', 1);
  t.press('KeyG', 1);
  assert.equal(g.runStats.shotsFired, shots, 'no shot mid-throw');
  assert.equal(lethal(g).count, soda.charges - 1, 'no second throw mid-throw');
  t.tick(BLOCK_TICKS);
  assert.equal(g.equipment.isBusy, false);
  t.press('KeyG', 1);
  assert.equal(lethal(g).count, soda.charges - 2, 'the next throw once the hands are free');
  t.tick(BLOCK_TICKS);
  const before = g.runStats.shotsFired;
  t.press('Mouse0', 1);
  assert.equal(g.runStats.shotsFired, before + 1, 'and the gun fires again');
});

test('no throw while switching guns, swinging the box cutter, vaulting, in a menu or dead', () => {
  const t = fixture();
  const { g } = t;
  const count = () => lethal(g).count;
  // Switching.
  g.gun.give(weapons.priceGun);
  t.tick(60);
  assert.equal(g.gun.isSwitching, false);
  t.press('Digit1', 1);
  assert.equal(g.gun.isSwitching, true);
  t.press('KeyG', 1);
  assert.equal(count(), soda.charges, 'refused mid-switch');
  t.tick(60);
  // Swinging.
  t.press('KeyV', 1);
  assert.equal(g.melee.isBusy, true);
  t.press('KeyG', 1);
  assert.equal(count(), soda.charges, 'refused mid-swing');
  t.tick(60);
  // Vaulting: a counter-height box in front of you, sprint and jump.
  const counter = new THREE.Box3(new THREE.Vector3(-1.5, 0, 9.6), new THREE.Vector3(1.5, 1, 10));
  counter.vaultable = true;
  g.colliders.push(counter);
  try {
    t.standAt(0, 13, 0);
    t.input.held.add('KeyW'); t.input.held.add('ShiftLeft');
    t.tick(12);
    t.input.pressed.add('Space');
    let vaulting = false;
    for (let i = 0; i < 30 && !vaulting; i++) { t.tick(); vaulting = g.player.vault.active; }
    assert.ok(vaulting, 'the vault started');
    t.press('KeyG', 1);
    assert.equal(g.player.vault.active, true);
    assert.equal(count(), soda.charges, 'refused mid-vault');
    t.input.clear();
    t.tick(90);
  } finally {
    g.colliders.splice(g.colliders.indexOf(counter), 1);
  }
  // A menu (Build-A-Blaster's order form): no throw, and D-pad right is left for the menu.
  g.state.menu = 'orderForm';
  t.press('KeyG', 1);
  t.press('PadRB', 1);
  assert.equal(count(), soda.charges, 'refused in a menu');
  t.input.pressed.add('PadRight');
  g.equipment.update(dt, { inMenu: true });
  assert.ok(t.input.pressed.has('PadRight'), 'the menu still gets D-pad right');
  t.input.endTick();
  g.state.menu = null;
  // Dead.
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  assert.equal(g.state.over, true);
  t.press('KeyG', 1);
  assert.equal(count(), soda.charges, 'refused when dead');
  assert.equal(g.equipment.live.length, 0);
});

test('a thrown bottle bounces off a zombie without hurting it, then bursts after its fuse and the kill pays only through \'kill\'', () => {
  const t = fixture();
  const { g } = t;
  const hits = [];
  const kills = [];
  g.events.on('hit', (h) => hits.push(h));
  g.events.on('kill', (k) => kills.push(k));
  const zombie = shopperAt(t, 0, 10.8); // just ahead, in the path of the lob
  const points = g.wallet.points;
  const progress = g.powerUps.progress;
  t.press('KeyG', 1);
  const ball = g.throwables.list[0];
  let bounced = false;
  for (let i = 0; i < 30; i++) { t.tick(); bounced ||= ball.lastTarget === zombie; }
  assert.ok(bounced, 'it bounced off the zombie');
  assert.equal(zombie.health, zombie.maxHealth, 'and didn\'t hurt it');
  // Wherever it ends up, the zombie stands by it when the fuse runs out.
  const item = g.equipment.live[0];
  let ticks = 0;
  while (g.equipment.live.length && ticks++ < 200) {
    zombie.position.set(item.position.x, 0, item.position.z + 0.3);
    zombie.updateHitboxes();
    t.tick();
  }
  assert.ok(ticks >= Math.round(soda.fuseSeconds / dt) - 40, `burst on its fuse (${ticks} ticks)`);
  assert.equal(zombie.isAlive, false, 'a round 1 Shopper dies');
  assert.equal(kills.length, 1);
  assert.equal(kills[0].source, 'equipment');
  assert.equal(hits.length, 0, 'never a \'hit\' event');
  assert.equal(g.wallet.points - points, pointsForHit({ target: zombie, killed: true }), 'the kill value, no +10');
  assert.equal(g.powerUps.progress, progress, 'no power-up credit');
  assert.ok(t.sounds.includes('sodaBurst'));
  assert.ok(item.removed && g.throwables.list.length === 0, 'nothing left');
});

test('a hit that doesn\'t kill pays nothing at all (no +10), and nothing pays after death', () => {
  const t = fixture();
  const { g } = t;
  g.rounds.jumpTo(25);
  const zombie = shopperAt(t, 0, 9);
  const points = g.wallet.points;
  g.equipment.detonate('sodaBomb', at(zombie));
  assert.ok(zombie.isAlive && zombie.health < zombie.maxHealth);
  assert.equal(g.wallet.points, points);
  g.rounds.jumpTo(1);
  const later = shopperAt(t, 0, 9);
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  g.equipment.detonate('sodaBomb', at(later));
  assert.equal(later.isAlive, false);
  assert.equal(g.wallet.points, points, 'dead: nothing more is paid');
});

test('the blast never touches Sunny, a practice dummy or anything else without a zombie type', () => {
  const t = fixture();
  const { g } = t;
  const fake = (extra) => {
    const position = new THREE.Vector3(0.5, 0, 9);
    const target = {
      ...extra, isAlive: true, position, struck: 0,
      hitboxes: [{ part: 'body', box: new THREE.Box3(new THREE.Vector3(0.2, 0, 8.7), new THREE.Vector3(0.8, 1.2, 9.3)) }],
      takeHit() { this.struck += 1; return { killed: false }; },
    };
    g.shootables.push(target);
    return target;
  };
  const sunny = fake({ isSunny: true, noRewards: true, ignoreAimAssist: true, type: { id: 'plush' } }); // (noRewards, even with a type)
  const dummy = fake({}); // (a test-range dummy: no type)
  g.equipment.detonate('sodaBomb', new THREE.Vector3(0, 0.13, 9));
  assert.equal(sunny.struck, 0, 'Sunny untouched');
  assert.equal(dummy.struck, 0, 'dummy untouched');
  for (const target of [sunny, dummy]) g.shootables.splice(g.shootables.indexOf(target), 1);
});

test('melee is still V and R3 (R3 alone on the controller); RB is the Lethal throw now', () => {
  assert.deepEqual(bindings.melee, ['KeyV', 'PadR3']);
  assert.deepEqual(bindings.lethal, ['KeyG', 'PadRB']);
  assert.deepEqual(bindings.tactical, ['Mouse1', 'PadRight']);
  const t = fixture({ fill: false });
  const { g } = t;
  t.press('KeyV', 1);
  assert.equal(g.melee.isBusy, true, 'V swings');
  t.tick(60);
  t.press('PadR3', 1);
  assert.equal(g.melee.isBusy, true, 'R3 swings');
  t.tick(60);
  t.press('PadRB', 1);
  assert.equal(g.melee.isBusy, false, 'RB doesn\'t');
  assert.equal(g.equipment.live.length, 0, '(and with empty pockets it throws nothing)');
});

test('controls: help lines and prompt labels for both throws; god mode off G; pockets has no key', () => {
  for (const device of ['keyboard', 'gamepad']) {
    const texts = controlsHelp[device].map((e) => e.text).join(' | ');
    assert.match(texts, /Throw Lethal/, device);
    assert.match(texts, /Throw Tactical/, device);
  }
  for (const labels of Object.values(buttonLabels)) assert.ok(labels.lethal && labels.tactical && labels.melee);
  assert.equal(buttonLabels.xbox.melee, 'R3');
  const god = debug.commands.find((c) => c.id === 'god');
  assert.equal(god.key, 'KeyB');
  assert.ok(!debug.commands.some((c) => c.key === 'KeyG' || c.id === 'pockets'));
  const t = fixture({ fill: false });
  assert.ok(t.g.debug.keylessIds.includes('pockets'));
  assert.match(t.g.debug.run('pockets'), /3 Soda Bombs/);
  assert.deepEqual(lethal(t.g), { id: 'sodaBomb', count: soda.charges });
  assert.equal(t.g.state.assisted, true, 'a debug fill marks the run assisted');
});

test('a middle click never starts the browser\'s autoscroll, before or after pointer lock', () => {
  const listeners = {};
  const real = document.addEventListener;
  document.addEventListener = (name, fn) => { listeners[name] = fn; };
  try {
    const input = new Input({});
    for (const locked of [false, true]) {
      input.locked = locked;
      let prevented = false;
      listeners.mousedown({ button: 1, preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true, `locked ${locked}`);
      assert.equal(input.pressed.has('Mouse1'), locked, 'tracked only while locked');
    }
    let leftPrevented = false;
    input.locked = false;
    listeners.mousedown({ button: 0, preventDefault: () => { leftPrevented = true; } });
    assert.equal(leftPrevented, false, 'other buttons untouched');
  } finally {
    document.addEventListener = real;
  }
});

test('death and Play again leave nothing behind: every thrown thing removed, the view hidden and disposed', () => {
  const fresh = snapshot(headlessGame().g);
  const t = fixture();
  const { g } = t;
  const scene = new THREE.Scene();
  const view = createThrowableView(scene, g.equipment);
  t.press('KeyG', 1);
  t.tick(BLOCK_TICKS);
  t.press('KeyG', 1);
  view.update(1);
  const shown = () => view.group.children.filter((m) => m.visible).length;
  assert.equal(shown(), 2);
  const items = [...g.equipment.live];
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  t.tick(1);
  assert.equal(g.equipment.live.length, 0, 'death clears them');
  assert.equal(g.throwables.list.length, 0);
  assert.ok(items.every((i) => i.removed));
  view.update(1);
  assert.equal(shown(), 0);
  g.resetRun();
  g.state.forceRun = true;
  assert.deepEqual(g.equipment.pockets, { lethal: { id: null, count: 0 }, tactical: { id: null, count: 0 } });
  g.health.invulnerable = false;
  // (the fixture switched off round spawning and moved the player: compare what Play again owns)
  const after = snapshot(g);
  assert.deepEqual(after.equipment, fresh.equipment);
  view.dispose();
  assert.equal(scene.children.includes(view.group), false);

  // And Play again with a bomb still on its fuse (no death first).
  const t2 = fixture();
  t2.press('KeyG', 1);
  t2.g.health.invulnerable = false;
  t2.g.resetRun();
  assert.equal(t2.g.equipment.live.length, 0);
  assert.equal(t2.g.throwables.list.length, 0);
  assert.equal(t2.g.equipment.isBusy, false);
  assert.deepEqual(snapshot(t2.g).equipment, fresh.equipment);
  assert.ok(t2.g.resetSteps.indexOf('equipment') === t2.g.resetSteps.indexOf('balls') + 1, 'right after balls');
});
