// The run intro (game/runIntro.js): when a run's first round begins, the PA chimes and reads one of the configured
// lines. Only round 1, every run (Play again too), and it changes nothing about the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wireRunIntro } from '../src/game/runIntro.js';
import { createEvents } from '../src/game/events.js';
import { feel } from '../src/config/feel.js';
import { headlessGame } from './helpers/headlessGame.js';

function fake() {
  const banners = [];
  const sounds = [];
  return {
    banners,
    sounds,
    hud: { showAnnouncement: (b) => banners.push(b) },
    sound: { play: (name) => sounds.push(name) },
  };
}

test('round 1 starts: the PA chimes and reads a configured line; later rounds say nothing', () => {
  const events = createEvents();
  const f = fake();
  wireRunIntro({ events, hud: f.hud, sound: f.sound, random: () => 0.99 });
  events.emit('roundStart', { round: 1 });
  assert.deepEqual(f.banners, [{ kicker: feel.runIntro.kicker, text: feel.runIntro.lines.at(-1) }]);
  assert.deepEqual(f.sounds, ['paChime']);
  events.emit('roundStart', { round: 2 });
  events.emit('roundStart', { round: 7 });
  assert.equal(f.banners.length, 1);
});

test('it can be switched off again (unsubscribe), and the lines are real sentences', () => {
  const events = createEvents();
  const f = fake();
  const off = wireRunIntro({ events, hud: f.hud, sound: f.sound });
  off();
  events.emit('roundStart', { round: 1 });
  assert.equal(f.banners.length, 0);
  assert.ok(feel.runIntro.lines.length >= 3);
  for (const line of feel.runIntro.lines) assert.ok(line.length > 20 && /[.!?]$/.test(line), line);
});

test('the real game: the intro plays when round 1 begins, and again after Play again', () => {
  const t = headlessGame();
  const f = fake();
  wireRunIntro({ events: t.g.events, hud: f.hud, sound: f.sound });
  t.tick(1);
  t.tick(60 * 4); // round 1 begins after its short delay
  assert.equal(f.banners.length, 1, 'once for the first run');
  assert.ok(feel.runIntro.lines.includes(f.banners[0].text));
  t.g.resetRun();
  t.tick(60 * 4);
  assert.equal(f.banners.length, 2, 'and again for the next run');
});
