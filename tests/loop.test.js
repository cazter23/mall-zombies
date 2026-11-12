// The fixed-step loop (core/loop.js) survives a thrown error: the next frame is still requested, the other
// stages of the frame still run, a throwing tick is used up rather than owed, and repeats are not reported 60 times a second.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startLoop } from '../src/core/loop.js';

function fakeFrames() {
  const queue = new Map();
  let nextId = 1;
  globalThis.requestAnimationFrame = (fn) => { queue.set(nextId, fn); return nextId++; };
  globalThis.cancelAnimationFrame = (id) => queue.delete(id);
  let time = performance.now();
  return {
    get pending() { return queue.size; },
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

test('a tick that throws does not stop the loop: render still runs and the next frame is requested', () => {
  const frames = fakeFrames();
  const caught = [];
  let ticks = 0, rendered = 0, looked = 0;
  const loop = startLoop({
    tickRate: 60, maxFrameTime: 0.25,
    beforeUpdate: () => { looked++; },
    update: () => { ticks++; if (ticks === 30) throw new Error('boom'); },
    render: () => { rendered++; },
    onError: (error, stage) => caught.push([error.message, stage]),
  });
  frames.run(60);
  assert.deepEqual(caught, [['boom', 'update']]);
  assert.equal(loop.errors, 1);
  assert.equal(rendered, 60, 'every frame still drew');
  assert.equal(looked, 60);
  assert.ok(ticks >= 58 && ticks <= 61, `ticks carried on after the throw, got ${ticks}`);
  assert.equal(frames.pending, 1, 'the next frame is asked for');
  loop.pause();
});

test('a tick that always throws is used up, not owed: the clock does not pile up behind it', () => {
  const frames = fakeFrames();
  let broken = true, ticks = 0;
  const loop = startLoop({
    tickRate: 60, maxFrameTime: 0.25,
    update: () => { ticks++; if (broken) throw new Error('always'); },
    render: () => {},
    onError: () => {},
  });
  frames.run(120); // two seconds of throwing ticks
  assert.ok(loop.errors >= 118, `every tick reported, got ${loop.errors}`);
  broken = false;
  ticks = 0;
  frames.run(1);
  assert.ok(ticks <= 2, `once fixed, one frame plays about one tick, not the two seconds missed (got ${ticks})`);
  loop.pause();
});

test('render and look input that throw are caught on their own; a broken reporter does not stop the loop', () => {
  const frames = fakeFrames();
  let ticks = 0;
  const loop = startLoop({
    tickRate: 60, maxFrameTime: 0.25,
    beforeUpdate: () => { throw new Error('look'); },
    update: () => { ticks++; },
    render: () => { throw new Error('draw'); },
    onError: () => { throw new Error('the reporter itself'); },
  });
  frames.run(30);
  assert.equal(loop.errors, 60, 'two caught per frame');
  assert.ok(ticks >= 29, 'ticks still ran between them');
  assert.equal(frames.pending, 1);
  loop.pause();
});

test('the default report prints each distinct error once, then only a periodic count of repeats', () => {
  const frames = fakeFrames();
  const printed = [];
  const original = console.error;
  console.error = (...args) => printed.push(args.map(String).join(' '));
  try {
    const loop = startLoop({
      tickRate: 60, maxFrameTime: 0.25,
      update: () => { throw new Error('every tick'); },
      render: () => {},
    });
    frames.run(60);
    loop.pause();
  } finally {
    console.error = original;
  }
  assert.ok(printed.length >= 1 && printed.length <= 3, `about 60 throws, a few lines printed (got ${printed.length})`);
  assert.match(printed[0], /update threw/);
});
