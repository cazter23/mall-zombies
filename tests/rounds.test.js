import test from 'node:test';
import assert from 'node:assert/strict';
import { createRounds } from '../src/game/rounds.js';
import { zombieCountForRound, economy } from '../src/config/economy.js';
import { menuDom } from './helpers/menuDom.js';
import { headlessGame } from './helpers/headlessGame.js';
import { hasStatNumber } from '../src/config/effectWords.js';

test('remainingInWave tracks remaining zombies accurately and reflects break quota', () => {
  let aliveCount = 0;
  const fakeZombies = {
    get aliveCount() { return aliveCount; },
    spawn() {
      aliveCount += 1;
      return { type: { id: 'shopper' } };
    },
    clear() { aliveCount = 0; },
  };

  const rounds = createRounds({ zombies: fakeZombies });
  assert.equal(rounds.remainingInWave, 0); // idle before start

  rounds.start();
  const round1Total = zombieCountForRound(1);
  assert.equal(rounds.state, 'break');
  assert.equal(rounds.remainingToSpawn, round1Total);
  assert.equal(rounds.remainingInWave, round1Total); // during break: full upcoming round size

  // Advance through break into active
  rounds.update(economy.rounds.firstRoundDelay + 0.1);
  assert.equal(rounds.state, 'active');
  assert.equal(rounds.remainingInWave, round1Total);

  // Spawn 1 zombie: toSpawn decrements, aliveCount increments, remainingInWave is unchanged
  rounds.update(0.1);
  assert.equal(aliveCount, 1);
  assert.equal(rounds.remainingToSpawn, round1Total - 1);
  assert.equal(rounds.remainingInWave, round1Total);

  // Kill the zombie: aliveCount decrements, remainingInWave drops by 1
  aliveCount = 0;
  assert.equal(rounds.remainingInWave, round1Total - 1);
});

test('waveEnding fires once per round when no spawns remain and aliveCount is 2 or fewer', () => {
  let aliveCount = 3;
  const waveEndingEvents = [];
  const fakeZombies = {
    get aliveCount() { return aliveCount; },
    spawn() { return { type: { id: 'shopper' } }; },
    clear() { aliveCount = 0; },
  };

  const rounds = createRounds({
    zombies: fakeZombies,
    onWaveEnding: (data) => waveEndingEvents.push(data),
  });

  rounds.start();
  rounds.update(economy.rounds.firstRoundDelay + 0.1); // enter round 1 active

  // Manually consume toSpawn while aliveCount is still 3 (> 2)
  while (rounds.remainingToSpawn > 0) {
    rounds.spawnBackup('shopper');
  }
  assert.equal(rounds.remainingToSpawn, 0);

  // Alive is 3 (> 2): waveEnding must NOT fire yet
  rounds.update(0.1);
  assert.equal(waveEndingEvents.length, 0);

  // One zombie dies: alive drops to 2 (<= 2): waveEnding MUST fire
  aliveCount = 2;
  rounds.update(0.1);
  assert.equal(waveEndingEvents.length, 1);
  assert.deepEqual(waveEndingEvents[0], { round: 1, remaining: 2 });

  // Further updates in the same round must NOT re-emit (fires only once per round)
  rounds.update(0.1);
  aliveCount = 1;
  rounds.update(0.1);
  assert.equal(waveEndingEvents.length, 1);

  // Round finishes
  aliveCount = 0;
  rounds.update(0.1);
  assert.equal(rounds.state, 'break');
  assert.equal(rounds.round, 2);

  // Round 2 enters active
  rounds.update(economy.rounds.breakSeconds + 0.1);
  assert.equal(rounds.state, 'active');

  // Consume spawns in round 2
  while (rounds.remainingToSpawn > 0) {
    rounds.spawnBackup('shopper');
  }
  aliveCount = 2;
  rounds.update(0.1);

  // Fires again for round 2
  assert.equal(waveEndingEvents.length, 2);
  assert.deepEqual(waveEndingEvents[1], { round: 2, remaining: 2 });
});

test('waveEnding does not fire if toSpawn is greater than 0', () => {
  let aliveCount = 1;
  const waveEndingEvents = [];
  const fakeZombies = {
    get aliveCount() { return aliveCount; },
    spawn() { return { type: { id: 'shopper' } }; },
    clear() { aliveCount = 0; },
  };

  const rounds = createRounds({
    zombies: fakeZombies,
    onWaveEnding: (data) => waveEndingEvents.push(data),
  });

  rounds.start();
  rounds.update(economy.rounds.firstRoundDelay + 0.1);
  assert.ok(rounds.remainingToSpawn > 0);

  // aliveCount is 1, but toSpawn > 0: must not fire
  rounds.update(0.1);
  assert.equal(waveEndingEvents.length, 0);
});

test('HUD occupancy counter renders STORE OCCUPANCY and CLOSED FOR RESTOCK', async () => {
  menuDom();
  const { createHud } = await import('../src/ui/hud.js');
  const hud = createHud();

  const occupancyEl = hud.element.querySelector('.round-occupancy');
  assert.ok(occupancyEl, 'occupancy element exists in HUD');

  // Active round: count = 12
  hud.setOccupancy(12, false);
  assert.equal(occupancyEl.textContent, 'STORE OCCUPANCY: 12');
  assert.equal(occupancyEl.classList.contains('closed'), false);

  // Break between rounds
  hud.setOccupancy(12, true);
  assert.equal(occupancyEl.textContent, 'CLOSED FOR RESTOCK');
  assert.equal(occupancyEl.classList.contains('closed'), true);

  // Clear / inactive
  hud.setOccupancy(null, false);
  assert.equal(occupancyEl.textContent, '');
});

test('wave copy complies with the words-only rule', () => {
  assert.equal(hasStatNumber('STORE OCCUPANCY: 12'), false);
  assert.equal(hasStatNumber('CLOSED FOR RESTOCK'), false);
  assert.equal(hasStatNumber('ATTENTION SHOPPERS: Final clearance — registers closing shortly!'), false);
});

test('Last Shopper pacing acceleration: zombieManager speeds up remaining zombies', () => {
  const t = headlessGame();
  t.tick(1);
  t.g.rounds.update = () => {};
  t.g.zombies.clear();

  // Spawn a slow walking shopper (base walk speed = 2.0 m/s)
  const z1 = t.g.zombies.spawn('shopper');
  z1.speed = 2.0;

  // With pending spawns remaining, speed is not forced
  Object.defineProperty(t.g.rounds, 'remainingToSpawn', { value: 5, configurable: true });
  Object.defineProperty(t.g.rounds, 'state', { value: 'active', configurable: true });
  t.g.zombies.update(1 / 60);
  assert.equal(z1.speed, 2.0);

  // When no spawns remain and aliveCount <= 2, speed is forced to jog/sprint
  Object.defineProperty(t.g.rounds, 'remainingToSpawn', { value: 0, configurable: true });
  t.g.zombies.update(1 / 60);
  const fastSpeed = z1.type.gaits.run ?? z1.type.gaits.jog ?? 2.0;
  assert.ok(fastSpeed > 2.0, 'shopper has faster gait');
  assert.equal(z1.speed, fastSpeed);
});

test('real game createGame wiring: waveEnding triggers PA announcement and chime', () => {
  const t = headlessGame();
  t.tick(1);
  t.g.rounds.update = () => {};
  t.g.zombies.clear();

  const waveEndingEvents = [];
  t.g.events.on('waveEnding', (e) => waveEndingEvents.push(e));

  // Trigger waveEnding event
  t.g.events.emit('waveEnding', { round: 3, remaining: 1 });
  assert.equal(waveEndingEvents.length, 1);

  // Check PA sound played
  assert.ok(t.sounds.includes('paChime'), 'paChime was played');

  // Check HUD announcement
  const announcement = t.hud.calls.find(([name]) => name === 'showAnnouncement');
  assert.ok(announcement, 'announcement shown on HUD');
  assert.equal(announcement[1].kicker, 'Attention shoppers');
  assert.equal(announcement[1].text, 'Final clearance — registers closing shortly!');
  assert.equal(announcement[1].priority, 1);
});
