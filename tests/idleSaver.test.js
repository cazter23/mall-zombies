// The idle saver (core/idleGovernor.js decides, core/idleSaver.js acts, core/loop.js obeys, config/idle.js is the numbers):
// while the game is not running it draws slowly, then stops and mutes, and any input wakes it. Never during a live run.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/headlessGame.js'; // (first: it stubs the browser globals settings.js reads)
import { startLoop } from '../src/core/loop.js';
import { createIdleGovernor } from '../src/core/idleGovernor.js';
import { createIdleSaver } from '../src/core/idleSaver.js';
import { idle } from '../src/config/idle.js';
import { settingDefs } from '../src/config/settings.js';

const cfg = () => structuredClone(idle);

// --- the decisions ---------------------------------------------------------------------------------------------------
test('awake, then dim, then asleep as the quiet goes on; any input starts the count again', () => {
  const config = cfg();
  const { dim, sleep } = config.delays[config.delay];
  const changes = [];
  const governor = createIdleGovernor({ config, onChange: (stage, was) => changes.push([was, stage]) });
  governor.touch(0);
  assert.equal(governor.update(dim - 1), 'awake');
  assert.equal(governor.update(dim), 'dim');
  assert.equal(governor.update(sleep - 1), 'dim');
  assert.equal(governor.update(sleep), 'asleep');
  governor.touch(sleep + 1);
  assert.equal(governor.update(sleep + 1), 'awake');
  assert.deepEqual(changes, [['awake', 'dim'], ['dim', 'asleep'], ['asleep', 'awake']]);
});

test('a live run (not eligible) is never dimmed, and the count starts when the game stops running', () => {
  const config = cfg();
  const { sleep } = config.delays[config.delay];
  let eligible = false;
  const governor = createIdleGovernor({ config, eligible: () => eligible });
  governor.touch(0);
  assert.equal(governor.update(sleep * 10), 'awake', 'ten sleep-delays of playing: awake');
  eligible = true;
  assert.equal(governor.update(sleep * 10 + 1), 'awake', 'paused just now: the clock starts here, not at the last key');
  assert.equal(governor.update(sleep * 10 + sleep), 'asleep');
});

test('switched off in settings: always awake; the delay setting is read live', () => {
  const config = cfg();
  const governor = createIdleGovernor({ config });
  governor.touch(0);
  config.enabled = false;
  assert.equal(governor.update(10_000), 'awake');
  config.enabled = true;
  config.delay = 'short';
  governor.touch(20_000);
  assert.equal(governor.update(20_000 + config.delays.short.dim), 'dim');
  config.delay = 'long';
  assert.equal(governor.update(20_000 + config.delays.short.dim), 'awake', 'the longer delay applies at once');
});

test('an unfocused window is nobody being there: hovering over it is not activity, gaining focus is', () => {
  const config = cfg();
  const { sleep } = config.delays[config.delay];
  const governor = createIdleGovernor({ config });
  governor.touch(0);
  governor.setFocused(false, 10);
  governor.touch(sleep); // a mouse moving over the window while you type elsewhere
  assert.equal(governor.update(10 + sleep), 'asleep');
  governor.setFocused(true, 10 + sleep + 1);
  assert.equal(governor.update(10 + sleep + 1), 'awake');
});

// --- the loop ---------------------------------------------------------------------------------------------------------
function fakeFrames() {
  const queue = new Map();
  let nextId = 1;
  globalThis.requestAnimationFrame = (fn) => { queue.set(nextId, fn); return nextId++; };
  globalThis.cancelAnimationFrame = (id) => queue.delete(id);
  let time = performance.now();
  return {
    get pending() { return queue.size; },
    /** The animation clock catches up with the real one (the loop reads the real one when it resumes). */
    sync() { time = performance.now(); },
    /** Run `count` animation frames, `ms` apart. */
    run(count, ms = 1000 / 60) {
      for (let i = 0; i < count; i++) {
        time += ms;
        const callbacks = [...queue.entries()];
        queue.clear();
        for (const [, fn] of callbacks) fn(time);
      }
    },
  };
}

test('the loop: setMaxFps draws about that many frames a second, pause requests nothing, resume does not replay the sleep', () => {
  const frames = fakeFrames();
  let rendered = 0, ticks = 0, lastFrameTime = 0;
  const loop = startLoop({ tickRate: 60, maxFrameTime: 0.25, update: () => { ticks++; }, render: (a, frameTime) => { rendered++; lastFrameTime = frameTime; } });
  frames.run(60);
  assert.equal(rendered, 60, 'uncapped: every animation frame');
  loop.setMaxFps(10);
  rendered = 0;
  frames.run(60); // one second at 60 Hz
  assert.ok(rendered >= 9 && rendered <= 11, `about 10 frames in a second, got ${rendered}`);
  assert.equal(loop.maxFps, 10);
  loop.setMaxFps(null);
  assert.equal(loop.maxFps, null);

  loop.pause();
  assert.equal(frames.pending, 0, 'nothing is requested while paused');
  rendered = 0; ticks = 0;
  frames.run(120);
  assert.equal(rendered + ticks, 0);
  assert.equal(loop.paused, true);
  loop.resume();
  assert.equal(frames.pending, 1);
  frames.sync();
  frames.run(1);
  assert.equal(rendered, 1);
  assert.ok(lastFrameTime < 0.1, `the first frame back is a normal frame, not the sleep (${lastFrameTime})`);
  loop.resume(); // (resuming a running loop is harmless)
  assert.equal(frames.pending, 1);
});

// --- the browser half -------------------------------------------------------------------------------------------------
function saverFixture(overrides = {}) {
  const config = cfg();
  const { dim, sleep } = config.delays[config.delay];
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => true });
  const calls = [];
  const loop = {
    setMaxFps: (fps) => calls.push(['maxFps', fps]),
    pause: () => calls.push(['pause']),
    resume: () => calls.push(['resume']),
  };
  const sound = { setSleeping: (v) => calls.push(['sleeping', v]) };
  let clock = 0;
  let timerFn = null, cleared = false;
  let pads = [];
  const eligibleRef = { value: true };
  const saver = createIdleSaver({
    loop, sound, config, win, doc,
    eligible: () => eligibleRef.value,
    now: () => clock,
    getPads: () => pads,
    setTimer: (fn) => { timerFn = fn; return 1; },
    clearTimer: () => { cleared = true; },
    ...overrides,
  });
  return {
    saver, config, win, doc, calls, dim, sleep, eligibleRef,
    at(seconds) { clock = seconds; saver.tick(); },
    setPads(next) { pads = next; },
    get cleared() { return cleared; },
    get timerFn() { return timerFn; },
  };
}

test('dim slows the loop, asleep pauses it and the sound, and a key wakes both at once', () => {
  const f = saverFixture();
  f.at(f.dim);
  assert.equal(f.saver.stage, 'dim');
  assert.deepEqual(f.calls, [['maxFps', f.config.dimFps]]);
  f.at(f.sleep);
  assert.equal(f.saver.stage, 'asleep');
  assert.deepEqual(f.calls.slice(1), [['maxFps', null], ['pause'], ['sleeping', true]]);
  f.calls.length = 0;
  f.win.dispatchEvent(new Event('keydown'));
  assert.equal(f.saver.stage, 'awake');
  assert.deepEqual(f.calls, [['maxFps', null], ['resume'], ['sleeping', false]]);
});

test('mouse movement, clicks and the wheel wake it; without the mute setting the sound is left alone', () => {
  for (const type of ['pointermove', 'pointerdown', 'wheel']) {
    const f = saverFixture();
    f.config.muteWhenAsleep = false;
    f.at(f.sleep);
    assert.equal(f.saver.stage, 'asleep');
    assert.ok(!f.calls.some(([name]) => name === 'sleeping'), 'not muted');
    f.win.dispatchEvent(new Event(type));
    assert.equal(f.saver.stage, 'awake', type);
  }
});

test('a live run is never throttled', () => {
  const f = saverFixture();
  f.eligibleRef.value = false;
  f.at(f.sleep * 5);
  assert.equal(f.saver.stage, 'awake');
  assert.deepEqual(f.calls, []);
});

test('an unfocused or hidden window sleeps even if the mouse moves over it, and focus wakes it', () => {
  const f = saverFixture();
  f.doc.hasFocus = () => false;
  f.win.dispatchEvent(new Event('blur'));
  f.at(f.dim - 1 + 0); // (the blur is the last activity, at time 0)
  assert.equal(f.saver.stage, 'awake');
  f.at(f.sleep);
  assert.equal(f.saver.stage, 'asleep');
  f.win.dispatchEvent(new Event('pointermove'));
  assert.equal(f.saver.stage, 'asleep', 'hovering is not playing');
  f.doc.hasFocus = () => true;
  f.win.dispatchEvent(new Event('focus'));
  assert.equal(f.saver.stage, 'awake');

  const hidden = saverFixture();
  hidden.doc.visibilityState = 'hidden';
  hidden.doc.dispatchEvent(new Event('visibilitychange'));
  hidden.at(hidden.sleep);
  assert.equal(hidden.saver.stage, 'asleep');
  hidden.doc.visibilityState = 'visible';
  hidden.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(hidden.saver.stage, 'awake');
});

test('controller input counts as activity (it makes no browser events); stick drift does not', () => {
  const f = saverFixture();
  const pad = (buttons, axes) => ({ connected: true, buttons: buttons.map((pressed) => ({ pressed })), axes });
  f.at(f.dim);
  assert.equal(f.saver.stage, 'dim');
  f.setPads([pad([false, false], [0.1, -0.2])]);
  f.at(f.dim + 1);
  assert.equal(f.saver.stage, 'dim', 'a resting stick is not input');
  f.setPads([pad([false, true], [0, 0])]);
  f.at(f.dim + 2);
  assert.equal(f.saver.stage, 'awake', 'a button wakes it');
  f.setPads([pad([false], [0.9, 0])]);
  f.at(f.dim + f.dim + 3);
  assert.equal(f.saver.stage, 'awake', 'and a pushed stick keeps it awake');
});

test('dispose stops the timer and the listeners, and wakes a sleeping game', () => {
  const f = saverFixture();
  f.at(f.sleep);
  assert.equal(f.saver.stage, 'asleep');
  f.calls.length = 0;
  f.saver.dispose();
  assert.ok(f.cleared);
  assert.deepEqual(f.calls, [['maxFps', null], ['resume'], ['sleeping', false]]);
  f.calls.length = 0;
  f.win.dispatchEvent(new Event('keydown'));
  assert.deepEqual(f.calls, [], 'no longer listening');
});

// --- the settings -----------------------------------------------------------------------------------------------------
test('the settings menu switches the saver, its delay and the mute, and they start at the shipped defaults', () => {
  const saved = { ...idle };
  try {
    const def = (id) => settingDefs.find((d) => d.id === id);
    assert.equal(def('idleSaver').default, saved.enabled);
    assert.equal(def('idleDelay').default, saved.delay);
    assert.equal(def('idleMute').default, saved.muteWhenAsleep);
    assert.ok(def('idleDelay').options.every((o) => Object.hasOwn(idle.delays, o.value)), 'every delay option is a real row');
    assert.ok(Object.keys(idle.delays).every((id) => def('idleDelay').options.some((o) => o.value === id)), 'and every row is offered');
    def('idleSaver').apply(false);
    def('idleDelay').apply('long');
    def('idleMute').apply(false);
    assert.deepEqual([idle.enabled, idle.delay, idle.muteWhenAsleep], [false, 'long', false]);
  } finally {
    Object.assign(idle, saved);
  }
});
