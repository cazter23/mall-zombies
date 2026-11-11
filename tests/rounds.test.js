import test from 'node:test';
import assert from 'node:assert/strict';
import { createRounds } from '../src/game/rounds.js';
import { zombieCountForRound, economy } from '../src/config/economy.js';
import { menuDom } from './helpers/menuDom.js';
import { headlessGame } from './helpers/headlessGame.js';
import { hasStatNumber } from '../src/config/effectWords.js';
import { bindings, buttonLabels } from '../src/config/controls.js';
import { createClockIn } from '../src/game/clockIn.js';
import { createEvents } from '../src/game/events.js';

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
  assert.equal(rounds.lastShoppers, false, 'three alive: not the last shoppers yet');

  // One zombie dies: alive drops to 2 (<= 2): waveEnding MUST fire
  aliveCount = 2;
  rounds.update(0.1);
  assert.equal(rounds.lastShoppers, true, 'two alive, none to come: the last shoppers (the manager speeds them up)');
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

  // Not the last shoppers (rounds.lastShoppers: more to spawn, or too many alive): speed is not forced
  Object.defineProperty(t.g.rounds, 'lastShoppers', { value: false, configurable: true });
  t.g.zombies.update(1 / 60);
  assert.equal(z1.speed, 2.0);

  // The last shoppers: speed is forced to the type's fastest gait
  Object.defineProperty(t.g.rounds, 'lastShoppers', { value: true, configurable: true });
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

// ---------------------------------------------------------------------------------------------------------
// THE SHOPPING WINDOW: the break between rounds is long enough to shop, and the player can end it early
// ("Clock in": game/clockIn.js).
// ---------------------------------------------------------------------------------------------------------

// A zombie manager stand-in with nobody in the mall (spawnBackup "spawns" without anyone staying alive).
function emptyMall() {
  return { aliveCount: 0, spawn() { return { type: { id: 'shopper' } }; }, clear() {} };
}

// Fresh rounds plus a clock-in system on a fake button.
function clockInRig() {
  const rounds = createRounds({ zombies: emptyMall() });
  const events = createEvents();
  const clockIns = [];
  events.on('clockIn', (e) => clockIns.push(e));
  const button = { down: false };
  const input = { actionDown: (action) => action === economy.rounds.clockIn.action && button.down };
  const clockIn = createClockIn({ input, rounds, events });
  return { rounds, clockIn, clockIns, button };
}

// Use up the current round's spawns: with nobody alive it ends on the next update.
function emptyTheRound(rounds) {
  while (rounds.remainingToSpawn > 0) rounds.spawnBackup('shopper');
}

test('shopping window: the break is long enough to shop, and clocking in is quicker than waiting', () => {
  const { breakSeconds, clockIn } = economy.rounds;
  assert.ok(breakSeconds >= 15, 'a break long enough to reach a shop and buy');
  assert.ok(clockIn.holdSeconds + clockIn.leadSeconds < breakSeconds / 2, 'clocking in saves most of the break');
  assert.ok(clockIn.holdSeconds >= 0.5, 'a deliberate hold, not a tap');
  assert.ok(clockIn.action !== 'interact', 'not the buy button: a missed Hold F must not end the break');
  assert.ok(bindings[clockIn.action]?.length > 0, 'bound to an existing action');
  for (const device of Object.values(buttonLabels)) assert.ok(device[clockIn.action], 'the prompt has a button name on every device');
});

test('rounds.endBreak cuts the break to the lead time and reports the seconds skipped', () => {
  const rounds = createRounds({ zombies: emptyMall() });
  assert.equal(rounds.endBreak(1), null, 'nothing to end before the game starts');
  rounds.start();
  rounds.update(economy.rounds.firstRoundDelay + 0.1);
  assert.equal(rounds.endBreak(1), null, 'nothing to end during a round');
  emptyTheRound(rounds);
  rounds.update(0.1);
  assert.equal(rounds.state, 'break');
  assert.equal(rounds.breakRemaining, economy.rounds.breakSeconds);

  rounds.update(5);
  const skipped = rounds.endBreak(1);
  assert.ok(Math.abs(skipped - (economy.rounds.breakSeconds - 6)) < 1e-9);
  assert.equal(rounds.breakRemaining, 1);
  assert.equal(rounds.round, 2, 'the round number does not change');
  rounds.update(0.5);
  assert.equal(rounds.state, 'break', 'still the lead time');
  rounds.update(0.6);
  assert.equal(rounds.state, 'active');
  assert.equal(rounds.breakRemaining, 0);

  // A lead longer than what is left never makes the break longer.
  const late = createRounds({ zombies: emptyMall() });
  late.start();
  late.update(economy.rounds.firstRoundDelay - 0.5);
  assert.equal(late.endBreak(10), 0);
  assert.ok(Math.abs(late.breakRemaining - 0.5) < 1e-9);
});

test('clock in: a fresh hold during the break ends it once and announces clockIn', () => {
  const { rounds, clockIn, clockIns, button } = clockInRig();
  const cfg = economy.rounds.clockIn;
  const step = 1 / 60;
  const hold = (seconds) => { for (let t = 0; t < seconds; t += step) { clockIn.update(step); rounds.update(step); } };

  // Not offered before round 1 or during a round.
  rounds.start();
  assert.equal(clockIn.prompt, null, 'the wait before round 1 is not a shopping window');
  rounds.update(economy.rounds.firstRoundDelay + 0.1);
  assert.equal(clockIn.prompt, null);

  // A button already held when the break starts does nothing: it takes a fresh press.
  button.down = true;
  clockIn.update(step);
  emptyTheRound(rounds);
  rounds.update(step);
  assert.equal(rounds.state, 'break');
  assert.deepEqual(clockIn.prompt, { action: cfg.action, progress: 0 });
  hold(cfg.holdSeconds + 0.5);
  assert.equal(clockIns.length, 0);
  assert.equal(rounds.state, 'break');

  // A tap is not enough, and letting go starts the hold over.
  button.down = false;
  hold(0.1);
  button.down = true;
  hold(cfg.holdSeconds / 2);
  assert.ok(clockIn.prompt.progress > 0.3 && clockIn.prompt.progress < 1);
  button.down = false;
  hold(0.1);
  assert.equal(clockIn.prompt.progress, 0);
  assert.equal(clockIns.length, 0);

  // The full hold: the break is cut to the lead time, one event, and the offer is gone.
  const before = rounds.breakRemaining;
  button.down = true;
  hold(cfg.holdSeconds + 2 * step);
  assert.equal(clockIns.length, 1);
  assert.equal(clockIns[0].round, 2);
  assert.ok(clockIns[0].skipped > 0 && clockIns[0].skipped < before);
  assert.ok(rounds.breakRemaining <= cfg.leadSeconds);
  assert.equal(clockIn.prompt, null, 'once per break');
  hold(cfg.leadSeconds + 0.1); // (still holding: nothing more happens)
  assert.equal(rounds.state, 'active');
  assert.equal(rounds.round, 2);
  assert.equal(clockIns.length, 1);
});

test('clock in: ignored while not allowed (an open menu), offered again in the next break, reset clears it', () => {
  const { rounds, clockIn, clockIns, button } = clockInRig();
  const cfg = economy.rounds.clockIn;
  const step = 1 / 60;
  rounds.start();
  rounds.update(economy.rounds.firstRoundDelay + 0.1);
  emptyTheRound(rounds);
  rounds.update(step);
  assert.equal(rounds.state, 'break');

  button.down = true;
  for (let t = 0; t < cfg.holdSeconds + 0.5; t += step) clockIn.update(step, false);
  assert.equal(clockIns.length, 0, 'a menu is open: the button belongs to the menu');
  assert.ok(clockIn.prompt, 'the offer itself stays');

  // Closing the menu with the button still down counts as a fresh press from then on.
  for (let t = 0; t < cfg.holdSeconds + 2 * step; t += step) clockIn.update(step, true);
  assert.equal(clockIns.length, 1);

  // Round 2 plays out; its break is offered again.
  button.down = false;
  rounds.update(cfg.leadSeconds + 0.1);
  assert.equal(rounds.state, 'active');
  emptyTheRound(rounds);
  rounds.update(step);
  assert.equal(rounds.round, 3);
  clockIn.update(step);
  assert.ok(clockIn.prompt, 'offered in the next break');

  clockIn.reset();
  rounds.reset();
  assert.equal(clockIn.prompt, null);
});

test('real game: holding Clock in during the break brings the next round early, with a PA line', () => {
  const t = headlessGame();
  const cfg = economy.rounds.clockIn;
  t.tick(1);
  assert.ok(t.g.resetSteps.includes('clockIn'), 'Play again forgets a used clock in');

  // Straight to the break before round 2: round 1 with nobody left.
  t.g.rounds.jumpTo(1);
  for (let i = 0; i < 3000 && !(t.g.rounds.inBreak && t.g.rounds.round === 2); i++) {
    t.g.zombies.clear(); // (every spawn leaves at once: the round runs out of zombies)
    t.tick(1);
  }
  assert.equal(t.g.rounds.inBreak, true);
  assert.equal(t.g.rounds.round, 2);
  assert.ok(t.g.clockIn.prompt, 'the break offers Clock in');

  const events = [];
  t.g.events.on('clockIn', (e) => events.push(e));
  const soundsBefore = t.sounds.length;
  t.press(bindings[cfg.action][0], Math.ceil(cfg.holdSeconds * 60) + 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].round, 2);
  assert.ok(events[0].skipped > economy.rounds.breakSeconds / 2, 'most of the break was skipped');
  assert.ok(t.sounds.slice(soundsBefore).includes('paChime'));
  const pa = t.hud.calls.filter(([name]) => name === 'showAnnouncement').at(-1);
  assert.equal(pa[1].text, cfg.pa.text);
  assert.equal(hasStatNumber(pa[1].text), false);
  assert.equal(t.g.clockIn.prompt, null);

  // The zombies come after the lead time, long before the full break would have ended.
  t.tick(Math.ceil(cfg.leadSeconds * 60) + 2);
  assert.equal(t.g.rounds.state, 'active');
  assert.equal(t.g.rounds.round, 2);

  // Play again: nothing carries over.
  t.g.resetRun();
  assert.equal(t.g.clockIn.prompt, null);
});

test('HUD clock-in prompt shows the button and the hold progress, and hides', async () => {
  menuDom();
  const { createHud } = await import('../src/ui/hud.js');
  const hud = createHud();
  const box = hud.element.querySelector('.clock-in');
  assert.ok(box, 'clock-in element exists in HUD');
  assert.equal(box.classList.contains('show'), false);

  hud.setClockIn({ progress: 0.5 }, 'I');
  assert.equal(box.classList.contains('show'), true);
  assert.equal(box.querySelector('.clock-in-text').textContent, 'IHold to clock in'); // (the key cap, then the words)
  assert.equal(box.querySelector('.clock-in-fill').style.width, '50%');
  assert.equal(hasStatNumber('Hold to clock in'), false);

  hud.setClockIn(null);
  assert.equal(box.classList.contains('show'), false);
});
