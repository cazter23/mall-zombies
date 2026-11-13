import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { createEvents } from '../src/game/events.js';
import { createHaptics } from '../src/core/haptics.js';
import { createGamepad } from '../src/core/gamepad.js';
import { haptics as defaults } from '../src/config/haptics.js';
import { settingDefs } from '../src/config/settings.js';
import { weapons } from '../src/config/weapons.js';
import { Input } from '../src/core/input.js';

function fixture(actuator) {
  const calls = [];
  const motor = actuator ?? {
    effects: ['dual-rumble'],
    playEffect: (type, effect) => { calls.push([type, effect]); return Promise.resolve('complete'); },
    reset: () => { calls.push(['reset']); return Promise.resolve('complete'); },
  };
  const gamepad = { connected: true, pad: { index: 0, id: 'Xbox', connected: true, vibrationActuator: motor } };
  const input = { device: 'gamepad' };
  const state = { running: true, over: false };
  const health = { invulnerable: false, isDead: false };
  const config = { ...defaults, strength: 1 };
  const events = createEvents();
  const page = new EventTarget(); page.hidden = false; page.hasFocus = () => true;
  const windowTarget = new EventTarget();
  let time = 0;
  const haptics = createHaptics({ gamepad, input, state, health, events, config, page, windowTarget, now: () => time });
  return { calls, motor, gamepad, input, state, health, config, events, haptics, page, windowTarget,
    advance: (ms) => { time += ms; } };
}

test('every gun has a distinct bounded pulse; strength scales both motors and unknown guns do nothing', () => {
  const t = fixture();
  t.haptics.setStrength(0.5);
  for (const weaponId of Object.keys(weapons)) {
    t.events.emit('shot', { weaponId });
    const [type, pulse] = t.calls.at(-1);
    const expected = defaults.shots[weaponId];
    assert.equal(type, 'dual-rumble');
    assert.deepEqual(pulse, { duration: expected.duration, startDelay: 0,
      strongMagnitude: expected.strongMagnitude * 0.5, weakMagnitude: expected.weakMagnitude * 0.5 });
    assert.ok(pulse.duration > 0 && pulse.duration < 250);
    t.advance(300);
  }
  const count = t.calls.length;
  t.events.emit('shot', { weaponId: 'futureGun' });
  assert.equal(t.calls.length, count);
  t.haptics.dispose();
});

test('damage overrides firing and cannot be overwritten by a burst or pickup until it ends; no rumble for god-mode hits', () => {
  const t = fixture();
  t.events.emit('shot', { weaponId: 'confettiCannon' });
  t.events.emit('playerHit', { damage: 40 });
  assert.equal(t.calls.at(-1)[1].duration, defaults.damage.duration);
  const count = t.calls.length;
  for (let i = 0; i < 3; i++) t.events.emit('shot', { weaponId: 'foamDartBlaster' });
  t.events.emit('powerUpCollect');
  assert.equal(t.calls.length, count);
  t.advance(defaults.damage.duration + 1);
  t.events.emit('powerUpCollect');
  assert.equal(t.calls.at(-1)[1].duration, defaults.pickup.duration);
  t.health.invulnerable = true;
  t.events.emit('playerHit', { damage: 40 });
  assert.equal(t.calls.length, count + 1);
  t.haptics.dispose();
});

test('pause, keyboard, hidden tab, blur, disconnect, controller replacement, death, reset and disabling stop vibration', () => {
  for (const scenario of ['pause', 'keyboard', 'hidden', 'blur', 'disconnect', 'replacement', 'death', 'reset', 'disable']) {
    const t = fixture();
    t.events.emit('shot', { weaponId: 'nailGun' });
    if (scenario === 'pause') t.state.running = false;
    if (scenario === 'keyboard') t.input.device = 'keyboard';
    if (scenario === 'hidden') { t.page.hidden = true; t.page.dispatchEvent(new Event('visibilitychange')); }
    if (scenario === 'blur') t.windowTarget.dispatchEvent(new Event('blur'));
    if (scenario === 'disconnect') { t.gamepad.connected = false; t.gamepad.pad = null; }
    if (scenario === 'replacement') t.gamepad.pad = { ...t.gamepad.pad, index: 1, id: 'PlayStation' };
    if (scenario === 'death') { t.state.over = true; t.events.emit('playerDeath'); }
    if (scenario === 'reset') t.events.emit('runReset');
    if (scenario === 'disable') t.haptics.setStrength(0);
    t.haptics.update();
    assert.deepEqual(t.calls.at(-1), ['reset'], scenario);
    assert.equal(t.calls.filter(([kind]) => kind === 'reset').length, 1, `${scenario}: stop once`);
    t.haptics.dispose();
  }
});

test('controllers without motors are harmless; legacy pulse works; rejected/throwing browser APIs do not escape', async () => {
  const legacy = [];
  const t = fixture({ pulse: (strength, duration) => { legacy.push([strength, duration]); return Promise.resolve(true); } });
  t.events.emit('shot', { weaponId: 'priceGun' });
  assert.deepEqual(legacy[0], [defaults.shots.priceGun.weakMagnitude, defaults.shots.priceGun.duration]);
  t.haptics.stop();
  assert.deepEqual(legacy.at(-1), [0, 0]);
  t.haptics.dispose();
  for (const actuator of [undefined, { playEffect() { throw new Error('disconnected'); }, reset() { throw new Error('hidden'); } },
    { playEffect: () => Promise.reject(new Error('unsupported')), reset: () => Promise.reject(new Error('inactive')) }]) {
    const f = fixture({});
    f.gamepad.pad.vibrationActuator = actuator;
    assert.doesNotThrow(() => f.events.emit('shot', { weaponId: 'stapleGun' }));
    assert.doesNotThrow(() => f.haptics.dispose());
  }
  await new Promise((resolve) => setImmediate(resolve)); // rejected motor promises must be handled
});

test('driver exposes the polled pad and clears it on unplug, without changing existing controller input', () => {
  const saved = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
  const pad = { connected: true, id: 'Xbox', axes: [0, 0, 0, 0], buttons: Array(17).fill({ pressed: false, value: 0 }) };
  let pads = [pad];
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads });
  try {
    const input = new Input({});
    const driver = createGamepad(input);
    driver.poll();
    assert.equal(driver.pad, pad);
    assert.equal(driver.connected, true);
    pads = []; driver.poll();
    assert.equal(driver.pad, null);
    assert.equal(driver.connected, false);
  } finally {
    if (saved) Object.defineProperty(navigator, 'getGamepads', saved);
    else delete navigator.getGamepads;
  }
});

test('real gun events carry weapon identity and drive one pulse per actual shot; death/reset stop the motor', () => {
  const t = headlessGame();
  const f = fixture();
  let clock = 0;
  const feedback = createHaptics({ gamepad: f.gamepad, input: f.input, state: t.g.state, health: t.g.health,
    events: t.g.events, config: f.config, page: f.page, windowTarget: f.windowTarget, now: () => clock });
  t.tick();
  t.g.rounds.update = () => {};
  for (const def of Object.values(weapons)) {
    t.g.gun.give(def); t.tick(45);
    clock += 1000; // (a rocket's blast, priority over shots, has long finished before the next gun)
    // (A rocket bursting against the range is a moment of its own, haptics.blast: not counted as a shot.)
    const shotPulses = () => f.calls.filter(([kind, effect]) => kind === 'dual-rumble' && effect.duration !== defaults.blast.duration);
    const before = shotPulses().length;
    // (A charge gun, the Barcode Scanner, fires when its scan completes: hold for the scan, then let go. It hums while it
    // winds up only when given a charge reader, which this one isn't.)
    t.press('Mouse0', def.charge ? Math.ceil(def.charge.seconds * 60) + 1 : 1); t.tick(20);
    const pulses = shotPulses();
    assert.equal(pulses.length - before, def.fireMode === 'burst' ? 3 : 1, def.id);
    assert.equal(pulses.at(-1)[1].duration, defaults.shots[def.id].duration);
  }
  t.g.health.takeDamage(10000);
  assert.deepEqual(f.calls.at(-1), ['reset']);
  t.g.resetRun();
  feedback.dispose(); f.haptics.dispose();
});

test('Controller vibration setting supports off, applies immediately and uses the normal settings schema', () => {
  const t = fixture();
  const def = settingDefs.find((entry) => entry.id === 'padVibration');
  assert.equal(def.tab, 'Controller');
  assert.equal(def.min, 0);
  t.events.emit('shot', { weaponId: 'stapleGun' });
  const previous = defaults.strength;
  try {
    def.apply(0, { haptics: t.haptics });
    assert.deepEqual(t.calls.at(-1), ['reset']);
    const count = t.calls.length;
    t.events.emit('shot', { weaponId: 'stapleGun' });
    assert.equal(t.calls.length, count);
  } finally { defaults.strength = previous; t.haptics.dispose(); }
});

test('moments rumble: blasts, the air horn, bosses, jackpots and Doorbusters (not every Flash Sale, not glitter)', () => {
  const t = fixture();
  const fire = (event, payload, effect) => {
    const count = t.calls.length;
    t.events.emit(event, payload);
    assert.equal(t.calls.length, count + 1, event);
    assert.equal(t.calls.at(-1)[1].duration, effect.duration, event);
    t.advance(1000);
  };
  fire('gunBlast', { weaponId: 'bottleRocket' }, defaults.blast);
  fire('equipmentBurst', { id: 'sodaBomb' }, defaults.blast);
  fire('airHornBlast', {}, defaults.airHorn);
  fire('bossSpawn', {}, defaults.bossSpawn);
  fire('bossDefeated', {}, defaults.bossDefeated);
  fire('clawPrize', { outcome: 'new' }, defaults.jackpot);
  fire('ticketsWon', { amount: 5 }, defaults.jackpot);
  fire('mascotGold', {}, defaults.jackpot);
  fire('flashSaleStart', { kind: 'doorbuster' }, defaults.doorbuster);
  const count = t.calls.length;
  t.events.emit('flashSaleStart', { kind: 'flashSale' });
  t.events.emit('equipmentBurst', { id: 'glitterBomb' });
  assert.equal(t.calls.length, count, 'a plain Flash Sale and a Glitter Bomb stay quiet');
  for (const key of ['blast', 'airHorn', 'bossSpawn', 'bossDefeated', 'jackpot', 'doorbuster']) {
    assert.ok(defaults[key].priority > defaults.shots.stapleGun.priority && defaults[key].priority < defaults.damage.priority, key);
  }
  t.haptics.dispose();
});

test('a charge gun winding up hums, growing as it fills, every everyMs; a shot plays over it; nothing when not charging', () => {
  const calls = [];
  const motor = { effects: ['dual-rumble'], playEffect: (type, effect) => { calls.push(effect); return Promise.resolve(); }, reset: () => Promise.resolve() };
  const gamepad = { connected: true, pad: { index: 0, id: 'Xbox', connected: true, vibrationActuator: motor } };
  const events = createEvents();
  const page = new EventTarget(); page.hidden = false; page.hasFocus = () => true;
  let time = 0;
  let amount = 0;
  const haptics = createHaptics({ gamepad, input: { device: 'gamepad' }, state: { running: true, over: false },
    health: { invulnerable: false, isDead: false }, events, config: { ...defaults, strength: 1 }, page,
    windowTarget: new EventTarget(), now: () => time, charge: () => amount });
  const hum = defaults.charge;
  haptics.update();
  assert.equal(calls.length, 0, 'not charging: quiet');
  amount = 0.1;
  haptics.update();
  const low = calls.at(-1);
  haptics.update();
  assert.equal(calls.length, 1, 'not again before everyMs');
  time += hum.everyMs;
  amount = 1;
  haptics.update();
  const high = calls.at(-1);
  assert.equal(calls.length, 2);
  assert.ok(high.strongMagnitude > low.strongMagnitude && high.weakMagnitude > low.weakMagnitude, 'it grows');
  assert.ok(Math.abs(high.strongMagnitude - hum.strongMagnitude[1]) < 1e-9);
  events.emit('shot', { weaponId: 'barcodeScanner' });
  assert.equal(calls.at(-1).duration, defaults.shots.barcodeScanner.duration, 'the shot plays over the hum');
  time += hum.everyMs;
  haptics.update();
  assert.equal(calls.at(-1).duration, defaults.shots.barcodeScanner.duration, 'and the hum does not cut the shot short');
  haptics.dispose();
});
