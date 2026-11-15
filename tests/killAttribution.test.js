import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { dealHazardDamage } from '../src/game/features/hazards.js';
import { weapons } from '../src/config/weapons.js';

function quietGame(t) {
  t.g.rounds.update = () => {};
  t.tick();
  return t;
}

function shopper(t, x, z, health = 1) {
  const zombie = t.g.zombies.spawn('shopper', new THREE.Vector3(x, 0, z));
  zombie.setState('chasing');
  zombie.speed = 0;
  zombie.attackCooldown = 99;
  zombie.health = health;
  zombie.updateHitboxes();
  return zombie;
}

function shoot(t, zombie, part = 'body') {
  t.standAt(zombie.position.x, 12);
  const point = zombie.hitboxes.find(h => h.part === part).box.getCenter(new THREE.Vector3());
  t.g.player.pitch = Math.atan2(point.y - t.g.player.eyeHeight, 12 - point.z);
  t.input.held.add('Mouse2');
  t.tick(30);
  t.press('Mouse0');
  t.input.held.delete('Mouse2');
}

function fit(g, stuffing, heart = 'headshot') {
  g.gun.setMods(g.gun.def.id, [{ id: 'build', build: { stuffing, heart, quality: 'understuffed' } }]);
}

test('scripted fight matches the payout and run counters measured on main', () => {
  const t = headlessGame(), { g } = t;
  let seed = 5;
  const random = Math.random;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  try {
    quietGame(t);
    const body = shopper(t, 0, 9, 2 * weapons.stapleGun.damage);
    shoot(t, body);
    assert.ok(body.isAlive);
    t.tick(18);
    shoot(t, body);
    assert.equal(body.isAlive, false);
    const head = shopper(t, 0, 9);
    shoot(t, head, 'head');
    assert.equal(head.isAlive, false);

    t.standAt(0, 12, 0, -.2);
    const melee = shopper(t, 0, 10.7);
    t.press('KeyV');
    t.tick(30);
    assert.equal(melee.isAlive, false);

    const hazard = shopper(t, 2, 9);
    dealHazardDamage(hazard, 1000);
    assert.equal(hazard.isAlive, false);

    fit(g, 'fryerOil');
    const late = shopper(t, 0, 9, 1000);
    shoot(t, late, 'head');
    assert.ok(late.burn);
    late.health = 1;
    g.health.takeDamage(10_000);
    t.tick(60);
    assert.equal(late.isAlive, false);

    const summary = g.death.summary;
    const result = {
      points: g.wallet.points,
      pointsEarned: g.wallet.totalEarned,
      pointsSpent: g.wallet.totalSpent,
      kills: g.runStats.kills,
      headshotKills: g.runStats.headshotKills,
      meleeKills: g.runStats.meleeKills,
      bossesDefeated: g.runStats.bossesDefeated,
      shotsFired: g.runStats.shotsFired,
      shotsHit: g.runStats.shotsHit,
      accuracy: g.runStats.accuracy,
      ticks: Math.round(g.runStats.timeAlive / dt),
    };
    // Measured on main at ec36907 before adding weaponId.
    assert.deepEqual(result, {
      points: 870, pointsEarned: 370, pointsSpent: 0,
      kills: 4, headshotKills: 1, meleeKills: 1, bossesDefeated: 0,
      shotsFired: 4, shotsHit: 4, accuracy: 1, ticks: 179,
    });
    assert.deepEqual({
      points: summary.pointsRemaining, pointsEarned: summary.pointsEarned, pointsSpent: summary.pointsSpent,
      kills: summary.kills, headshotKills: summary.headshotKills, meleeKills: summary.meleeKills,
      bossesDefeated: summary.bossesDefeated, shotsFired: summary.shotsFired, shotsHit: summary.shotsHit,
      accuracy: summary.accuracy, ticks: Math.round(summary.timeAlive / dt),
    }, result);
  } finally {
    Math.random = random;
    g.map.dispose();
  }
});

function scenario(context, weapon) {
  const t = quietGame(headlessGame()), { g } = t;
  context.after(() => g.map.dispose());
  const kills = [];
  g.events.on('kill', event => kills.push(event));
  if (weapon) {
    g.gun.give(weapon);
    t.tick(40);
  }
  return {
    ...t,
    kills,
    expectKill(zombie, source, weaponId, melee = false) {
      const matches = kills.filter(event => event.zombie === zombie);
      assert.equal(matches.length, 1, `expected one ${source} kill`);
      assert.deepEqual([matches[0].source, matches[0].weaponId, matches[0].melee], [source, weaponId, melee]);
    },
  };
}

for (const id of ['stapleGun', 'confettiCannon', 'returnToSender', 'leafBlower']) {
  test(`direct ${id} damage credits the firing gun`, context => {
    const t = scenario(context, id === 'stapleGun' ? null : weapons[id]);
    const zombie = shopper(t, 0, 9.5, id === 'returnToSender' ? 5000 : 1);
    shoot(t, zombie);
    t.expectKill(zombie, 'gun', id);
  });
}

test('piercing hits keep the firing gun after a kill listener replaces it', context => {
  const t = scenario(context, weapons.nailGun), { g } = t;
  const first = shopper(t, 0, 9);
  const second = shopper(t, 0, 8);
  g.events.on('kill', ({ zombie }) => {
    if (zombie === first) g.gun.give(weapons.priceGun);
  });
  shoot(t, first);
  assert.equal(g.gun.def.id, 'priceGun');
  t.expectKill(first, 'gun', 'nailGun');
  t.expectKill(second, 'gun', 'nailGun');
});

test('an active boss killed by the gun carries its ID and counts one defeat', context => {
  const t = scenario(context), { g } = t;
  const boss = g.bosses.summon('janitor');
  assert.ok(boss);
  boss.position.set(0, 0, 9);
  boss.setState('chasing');
  boss.speed = 0;
  boss.health = 1;
  boss.updateHitboxes();
  shoot(t, boss);
  t.expectKill(boss, 'gun', 'stapleGun');
  assert.equal(g.runStats.bossesDefeated, 1);
});

for (const replace of [false, true]) {
  test(`Fryer Oil credits gun A after ${replace ? 'replacing it' : 'switching to gun B'}`, context => {
    const t = scenario(context, weapons.nailGun), { g } = t;
    fit(g, 'fryerOil');
    const zombie = shopper(t, 0, 9, 1000);
    shoot(t, zombie, 'head');
    assert.ok(zombie.burn);
    zombie.health = 1;
    if (replace) g.gun.give(weapons.priceGun);
    else t.press('Digit1');
    assert.equal(g.gun.def.id, replace ? 'priceGun' : 'stapleGun');
    assert.equal(g.gun.owns('nailGun'), !replace);
    assert.ok(zombie.isAlive);
    t.tick(35);
    t.expectKill(zombie, 'build', 'nailGun');
  });
}

test('a weaker burn refresh preserves the owner of the damage', context => {
  const t = scenario(context, weapons.nailGun);
  fit(t.g, 'fryerOil');
  const zombie = shopper(t, 0, 9, 1000);
  shoot(t, zombie, 'head');
  const { perTick, tickSeconds, left } = zombie.burn;
  zombie.applyBurn(perTick * left / tickSeconds / 2, left, tickSeconds, 'stapleGun');
  assert.equal(zombie.burn.perTick, perTick);
  zombie.health = 1;
  t.tick(35);
  t.expectKill(zombie, 'build', 'nailGun');
});

test('Neon Tube arc credits its build gun', context => {
  const t = scenario(context, weapons.nailGun);
  fit(t.g, 'neonTube');
  const anchor = shopper(t, 0, 9, 1000);
  const victim = shopper(t, 1.2, 9);
  shoot(t, anchor, 'head');
  t.expectKill(victim, 'build', 'nailGun');
});

test('Antifreeze shatter and shard splash both credit their build gun', context => {
  const t = scenario(context, weapons.nailGun);
  fit(t.g, 'antifreeze');
  const anchor = shopper(t, 0, 9, 1000);
  const frozen = shopper(t, 1, 9);
  frozen.applySlow(5, .8, 'antifreeze');
  const splash = shopper(t, 2.1, 9);
  shoot(t, anchor, 'head');
  t.expectKill(frozen, 'build', 'nailGun');
  t.expectKill(splash, 'build', 'nailGun');
});

for (const built of [true, false]) {
  test(`a confused zombie attack credits ${built ? 'the Glitter gun' : 'no gun when unowned'}`, context => {
    const t = scenario(context, weapons.nailGun);
    const attacker = shopper(t, 0, 9, 1000);
    if (built) {
      fit(t.g, 'glitter');
      shoot(t, attacker, 'head');
      assert.ok(attacker.confusion);
      t.press('Digit1');
      assert.equal(t.g.gun.def.id, 'stapleGun');
    } else {
      attacker.applyConfusion(6, 50);
    }
    attacker.attackCooldown = 0;
    const victim = shopper(t, 1.15, 9);
    t.tick(110);
    t.expectKill(victim, 'build', built ? 'nailGun' : null);
  });
}

for (const bounced of [false, true]) {
  test(`a tennis ball credits its launcher ${bounced ? 'after bouncing' : 'on first contact'} after switching`, context => {
    const t = scenario(context, weapons.tennisBallLauncher), { g } = t;
    t.standAt(0, 12);
    const first = shopper(t, 0, 8, bounced ? 1000 : 1);
    const victim = bounced ? shopper(t, 0.2, 6.8) : first;
    let bouncesAtKill;
    g.events.on('kill', ({ zombie }) => {
      if (zombie === victim) bouncesAtKill = g.balls.list[0].bounces;
    });
    t.press('Mouse0');
    assert.equal(g.balls.list.length, 1);
    t.press('Digit1');
    assert.equal(g.gun.def.id, 'stapleGun');
    assert.ok(victim.isAlive);
    t.tick(60);
    t.expectKill(victim, 'gun', 'tennisBallLauncher');
    assert.equal(bouncesAtKill > 0, bounced);
  });
}

test('a box-cutter kill has no weapon ID and keeps its melee flag', context => {
  const t = scenario(context);
  t.standAt(0, 12, 0, -.2);
  const zombie = shopper(t, 0, 10.7);
  t.press('KeyV');
  t.tick(30);
  t.expectKill(zombie, 'melee', null, true);
});

test('a hazard kill has no weapon ID even after an earlier gun hit', context => {
  const t = scenario(context);
  const zombie = shopper(t, 0, 9, 1000);
  shoot(t, zombie);
  assert.ok(zombie.health < 1000 && zombie.isAlive);
  dealHazardDamage(zombie, 1000);
  t.expectKill(zombie, 'hazard', null);
});

test('a Soda Bomb kill has no weapon ID', context => {
  const t = scenario(context);
  const zombie = shopper(t, 0, 9);
  t.g.equipment.detonate('sodaBomb', new THREE.Vector3(0, .13, 9));
  t.expectKill(zombie, 'equipment', null);
});

test('an Inventory Liquidation kill has no weapon ID', context => {
  const t = scenario(context), { g } = t;
  const trigger = shopper(t, 0, 9);
  const victim = shopper(t, 1.2, 9);
  g.events.emit('roundStart', { round: 2 });
  assert.equal(g.powerUps.debugDrop('inventoryLiquidation'), true);
  g.powerUps.update(dt);
  shoot(t, trigger);
  assert.ok(victim.isAlive, 'burst damage is deferred');
  g.powerUps.update(dt);
  t.expectKill(victim, 'incentive', null);
});

test('debug killZombies has no weapon ID', context => {
  const t = scenario(context);
  const zombie = shopper(t, 0, 9);
  t.g.debug.run('killZombies');
  t.expectKill(zombie, 'hazard', null);
});

test('falling out of the map is a rescue; a lethal hit with source fall has no weapon ID', context => {
  const t = scenario(context);
  const zombie = shopper(t, 0, 9);
  zombie.position.y = -100;
  t.tick();
  assert.ok(zombie.isAlive && zombie.position.y > -10, 'rescued without a kill');
  assert.equal(t.kills.length, 0);
  zombie.takeHit({ damage: 1000, part: 'body', source: 'fall' });
  t.expectKill(zombie, 'fall', null);
});
