import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dt, headlessGame } from './helpers/headlessGame.js';
import { bossTypes } from '../src/config/bosses.js';
import { economy, zombieCountForRound, zombieHealthForRound } from '../src/config/economy.js';
import { zombieTypes } from '../src/config/zombies.js';
import { chooseBossSchedule } from '../src/game/bossDirector.js';
import { weapons } from '../src/config/weapons.js';

function fixture(t) {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  t.after(() => { game.g.resetRun(); game.g.map.dispose(); });
  return { ...game, scene };
}
const kill = (zombie, source = 'hazard') => zombie.takeHit({ damage: zombie.health, part: 'body', source });

test('a run picks one Janitor round from 5 or 7 and leaves the Mascot and other introductions alone', () => {
  const intros = Object.values(economy.zombieMix).map(({ fromRound }) => fromRound);
  for (const [roll, expected] of [[0, 5], [0.99, 7]]) {
    const schedule = chooseBossSchedule(() => roll);
    assert.equal(schedule.get(expected), 'janitor');
    assert.equal(schedule.size, Object.values(bossTypes).filter(({ firstRounds }) => firstRounds?.length).length);
    for (const [round, id] of schedule) assert.ok(bossTypes[id].firstRounds.includes(round) && !intros.includes(round));
    assert.ok(!intros.includes(expected));
  }
  assert.equal(economy.zombieMix.mascot.fromRound, 10);
  assert.ok(!economy.zombieMix.janitor && !zombieTypes.janitor);
});

test('the scheduled Janitor retries and blocks wave completion without consuming the regular quota', (t) => {
  const { g, tick, sounds, hud } = fixture(t);
  t.mock.method(Math, 'random', () => 0.12);
  g.health.invulnerable = true;
  g.rounds.jumpTo(4);
  const spawn = g.zombies.spawn.bind(g.zombies);
  let refuse = true, attempts = 0, regular = 0;
  g.zombies.spawn = (id, ...args) => {
    if (id === 'janitor') {
      attempts += 1;
      if (refuse) return null;
    }
    const zombie = spawn(id, ...args);
    if (zombie && id !== 'janitor' && g.rounds.round === 5) regular += 1;
    return zombie;
  };
  for (let i = 0; i < 6500 && (g.rounds.round < 5 || g.rounds.remainingToSpawn > 0); i++) {
    tick();
    for (const z of g.zombies.zombies) if (z.isAlive) kill(z);
  }
  tick(40);
  assert.equal(regular, zombieCountForRound(5));
  assert.equal(g.rounds.round, 5);
  assert.equal(g.rounds.remainingToSpawn, 0);
  assert.ok(g.bosses.pending && attempts > 1);

  refuse = false;
  tick(60);
  const boss = g.bosses.active;
  assert.equal(boss.health, zombieHealthForRound(5) * bossTypes.janitor.healthMultiplier);
  assert.equal(g.rounds.round, 5);
  assert.equal(g.zombies.aliveCount, 1);
  assert.equal(sounds.filter(s => s === boss.type.introSound).length, 1);
  assert.ok(hud.calls.some(([name, banner]) => name === 'showAnnouncement' && banner.text === boss.type.introBanner.text));
  assert.match(g.debug.run('summonBoss'), /unavailable/);
  kill(boss);
  tick();
  assert.equal(g.rounds.round, 6);
  assert.equal(g.powerUps.pickup?.id, boss.type.reward, 'the guaranteed reward survives natural wave advancement');
});

test('a boss uses normal markers even during a live Returns Chute ritual', (t) => {
  const { g, tick, press } = fixture(t);
  g.health.invulnerable = true;
  g.rounds.jumpTo(5);
  g.rounds.update = () => {};
  g.map.areaUnlocks.openAll();
  g.gun.give(weapons.nailGun);
  g.wallet.earn(10000);
  tick(120);
  const bench = g.map.features.find(f => f.kind === 'workshop');
  const ritual = g.features.list.find(f => f.feature === bench).instance.ritual;
  ritual.choose('smoothie', 'headshot');
  g.player.teleport({ position: new THREE.Vector3(bench.position.x, g.map.levelTwo.workshop.position.y, bench.position.z - 1), yaw: Math.PI });
  tick();
  press('KeyF', 20); // opens the order form (filled in with the choice above)...
  press('KeyF'); // ...and F orders
  assert.equal(ritual.phase, 'running');
  let drops = 0;
  g.events.on('chuteDrop', () => { drops += 1; });
  assert.match(g.debug.run('summonBoss'), /Summoned/);
  const boss = g.bosses.active;
  assert.ok(g.map.spawnPoints.some(point => point.position.equals(boss.position)));
  assert.ok(!boss.dropHeight);
  assert.equal(drops, 0);
  assert.ok(g.zombies.spawn('shopper')?.dropHeight > 0);
  assert.equal(drops, 1, 'ordinary spawns still use the chute');
});

test('kills from any source pay once, award a pickup and count on the receipt', (t) => {
  const { g, tick, scene } = fixture(t);
  for (const source of ['gun', 'melee', 'build', 'incentive', 'hazard']) {
    g.rounds.jumpTo(6);
    g.rounds.update = () => {};
    tick();
    assert.match(g.debug.run('summonBoss'), /Summoned/);
    const boss = g.bosses.active;
    const points = g.wallet.points;
    let count = 0;
    const off = g.events.on('bossDefeated', () => { count += 1; });
    boss.takeHit({ damage: boss.health, part: 'body', source, melee: source === 'melee' });
    kill(boss);
    tick();
    off();
    assert.equal(count, 1);
    assert.equal(g.wallet.points - points, economy.killValues.janitor + (source === 'melee' ? economy.payouts.meleeKillBonus : 0));
    assert.equal(g.powerUps.pickup?.id, boss.type.reward);
    assert.equal(scene.getObjectByName('janitorWetFloor'), undefined);
  }
  assert.equal(g.runStats.kills, 5);
  assert.equal(g.runStats.bossesDefeated, 5);
  g.health.takeDamage(g.stats.maxHealth);
  assert.equal(g.death.summary.bossesDefeated, 5);
  assert.ok(!g.shootables.some(z => z.type?.boss));
  g.resetRun();
  assert.equal(g.runStats.bossesDefeated, 0);
});

test('bosses resist control, keep full damage, and are excluded from both incentive marks', (t) => {
  const { g, tick } = fixture(t);
  g.rounds.jumpTo(6);
  g.rounds.update = () => {};
  tick();
  g.debug.run('summonBoss');
  const boss = g.bosses.active;
  boss.position.set(0, 0, 10);
  boss.setState('windup');
  assert.equal(boss.staggerAway(g.player.position, { seconds: 2, knockback: 7, drag: 1 }), false);
  assert.equal(boss.applyConfusion(3, 100), false);
  assert.equal(boss.state, 'windup');
  boss.applySlow(2, 0.4);
  assert.equal(boss.slowFraction, 0.7);
  boss.setState('chasing');
  const health = boss.health;
  boss.takeHit({ damage: 400, part: 'body', source: 'build', direction: { x: 1, z: 0 }, impact: { knockback: 5, hitstopSeconds: 1 } });
  assert.equal(boss.health, health - 400);
  assert.equal(boss.velocity.x, 0);
  assert.equal(boss.hitstopTimer, 0);
  for (const x of [-2, 2]) g.zombies.spawn('shopper', new THREE.Vector3(x, 0, 9)).setState('chasing');
  for (const id of ['mysteryShopper']) {
    assert.ok(g.powerUps.debugDrop(id));
    g.powerUps.update(dt);
    const mark = g.powerUps.effects.find(effect => effect.id === id);
    assert.ok(mark?.targets.length && !mark.targets.includes(boss));
  }
});

test('a guaranteed drop waits for an existing pickup and a debug skip clears the boss reward', (t) => {
  const { g, tick } = fixture(t);
  g.rounds.jumpTo(6);
  g.rounds.update = () => {};
  tick();
  assert.ok(g.powerUps.debugDrop('shiftBonus', new THREE.Vector3(0, 0, 8.5)));
  assert.match(g.debug.run('summonBoss'), /Summoned/);
  const boss = g.bosses.active;
  kill(boss);
  tick();
  assert.equal(g.powerUps.pickup.id, 'shiftBonus');
  g.player.teleport({ position: g.powerUps.pickup.position, yaw: 0 });
  tick(2);
  assert.equal(g.powerUps.pickup?.id, boss.type.reward);
  g.player.teleport({ position: g.powerUps.pickup.position, yaw: 0 });
  tick();
  assert.ok(g.powerUps.effects.some(effect => effect.bossReward));
  g.debug.run('nextRound');
  assert.ok(!g.powerUps.effects.some(effect => effect.bossReward));
  assert.equal(g.powerUps.pickup, null);
});
