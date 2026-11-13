// The mall PA as data (game/announcer.js), in the real game: each event shows its line with a chime, Directed-only
// lines stay silent in Classic, and the order the tables were registered in still holds where it matters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { createAnnouncer, pickPaLine } from '../src/game/announcer.js';
import { createEvents } from '../src/game/events.js';
import { economy } from '../src/config/economy.js';
import { save as saveConfig } from '../src/config/save.js';

const pa = (text) => ({ kicker: 'Attention shoppers', text });
const announcements = (t, from) => t.hud.calls.slice(from).filter(([name]) => name === 'showAnnouncement').map(([, a]) => a);

test("a system's PA line is shown with a chime; an event without one stays silent", () => {
  const t = headlessGame();
  const h = t.hud.calls.length, s = t.sounds.length;
  t.g.events.emit('kioskStock', { pa: pa('New stock at the kiosk') });
  t.g.events.emit('kioskStock', {});
  assert.deepEqual(announcements(t, h), [{ ...pa('New stock at the kiosk'), priority: 1 }]);
  assert.deepEqual(t.sounds.slice(s), ['paChime']);
});

test('Closing Time lines and return labels are Directed only; the key sound plays in both modes, before the chime', () => {
  for (const mode of ['classic', 'directed']) {
    const t = headlessGame();
    t.g.state.closingMode = mode;
    const h = t.hud.calls.length, s = t.sounds.length;
    t.g.events.emit('closingKey', { pa: pa('Key found') });
    t.g.events.emit('returnLabel', { pa: pa('Return label issued') });
    const shown = announcements(t, h).map((a) => a.text);
    if (mode === 'classic') {
      assert.deepEqual(shown, []);
      assert.deepEqual(t.sounds.slice(s), ['closingKey']);
    } else {
      assert.deepEqual(shown, ['Key found', 'Return label issued']);
      assert.deepEqual(t.sounds.slice(s), ['closingKey', 'paChime', 'paChime']);
    }
  }
});

test("Build-A-Blaster's collect line comes before its certificate; a Flash Sale ended by a new run is silent", () => {
  const t = headlessGame();
  const h = t.hud.calls.length;
  t.g.events.emit('ritualCollect', { pa: pa('Your order is ready'), certificate: { id: 'cert' } });
  const names = t.hud.calls.slice(h).map(([name]) => name);
  assert.deepEqual(names.filter((n) => n === 'showAnnouncement' || n === 'showCertificate'), ['showAnnouncement', 'showCertificate']);

  const h2 = t.hud.calls.length;
  t.g.events.emit('flashSaleEnd', { reason: 'reset', pa: pa('Sale over') });
  assert.deepEqual(announcements(t, h2), []);
  t.g.events.emit('flashSaleEnd', { reason: 'expired', pa: pa('Sale over') });
  assert.deepEqual(announcements(t, h2).map((a) => a.text), ['Sale over']);
});

test('features.instanceOf finds a built feature by kind; instancesOf lists them all', () => {
  const t = headlessGame();
  const { features } = t.g;
  assert.equal(features.instanceOf('kiosk'), features.list.find(({ feature }) => feature.kind === 'kiosk').instance);
  assert.equal(features.instanceOf('no such kind'), undefined);
  const racks = features.list.filter(({ feature }) => feature.kind === 'wardrobeRack');
  assert.ok(racks.length > 1);
  assert.deepEqual(features.instancesOf('wardrobeRack'), racks.map(({ instance }) => instance));
});

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
  };
}

test('PA line pools: counts, lengths, placeholders, and voice match config expectations', () => {
  const lastLines = economy.rounds.lastShoppers.pa.lines;
  assert.ok(lastLines.length >= 15);
  assert.equal(new Set(lastLines).size, lastLines.length);
  assert.equal(lastLines[0], 'Final clearance — registers closing shortly!');
  for (const line of lastLines) {
    assert.ok(line.length <= 'Final clearance — registers closing shortly!'.length, `too long: ${line}`);
  }
  for (const line of lastLines.slice(1)) {
    assert.ok(!line.includes('!'), `new PA line has exclamation mark: ${line}`);
  }

  const clockLines = economy.rounds.clockIn.pa.lines;
  assert.ok(clockLines.length >= 8);
  assert.equal(new Set(clockLines).size, clockLines.length);
  assert.equal(clockLines[0], 'An associate has clocked in early. Doors are opening now!');
  for (const line of clockLines.slice(1)) {
    assert.ok(!line.includes('!'), `new clock-in line has exclamation mark: ${line}`);
  }

  const teaserLines = economy.flashSales.teaser.lines;
  assert.ok(teaserLines.length >= 8);
  assert.equal(new Set(teaserLines).size, teaserLines.length);
  for (const line of teaserLines) {
    assert.ok(line.includes('{lead}') && line.includes('{label}'), `missing placeholder in: ${line}`);
    assert.ok(!line.includes('!'), `teaser line has exclamation mark: ${line}`);
  }
});

test('pickPaLine & createAnnouncer: uses injectable random for waveEnding and clockIn pools', () => {
  assert.equal(pickPaLine([], () => 0), '');
  assert.equal(pickPaLine(['only'], () => 0.7), 'only');
  assert.equal(pickPaLine(['a', 'b', 'c'], () => 0), 'a');
  assert.equal(pickPaLine(['a', 'b', 'c'], () => 0.99), 'c');
  assert.equal(pickPaLine(['a', 'b', 'c'], () => 1), 'a');

  const announceWith = (roll) => {
    const events = createEvents();
    const calls = [];
    const sounds = [];
    const announcer = createAnnouncer({
      events,
      hud: { showAnnouncement: (a) => calls.push(a) },
      sound: { play: (s) => sounds.push(s) },
      state: { showClosingGuidance: true },
      random: () => roll,
    });
    announcer.runAndFeatures();
    announcer.sales();
    events.emit('waveEnding', { round: 2, remaining: 1 });
    events.emit('clockIn', { round: 3, skipped: 15 });
    return { calls, sounds };
  };

  const lastLines = economy.rounds.lastShoppers.pa.lines;
  const clockLines = economy.rounds.clockIn.pa.lines;

  const first = announceWith(0);
  assert.deepEqual(first.sounds, ['paChime', 'paChime']);
  assert.equal(first.calls[0].kicker, economy.rounds.lastShoppers.pa.kicker);
  assert.equal(first.calls[0].priority, economy.rounds.lastShoppers.pa.priority);
  assert.equal(first.calls[0].text, lastLines[0]);
  assert.equal(first.calls[1].kicker, economy.rounds.clockIn.pa.kicker);
  assert.equal(first.calls[1].text, clockLines[0]);

  const last = announceWith(0.999);
  assert.equal(last.calls[0].text, lastLines[lastLines.length - 1]);
  assert.equal(last.calls[1].text, clockLines[clockLines.length - 1]);
  assert.notEqual(first.calls[0].text, last.calls[0].text);
  assert.notEqual(first.calls[1].text, last.calls[1].text);

  const seenLast = new Set(lastLines.map((_, i) => announceWith(i / lastLines.length + 1e-6).calls[0].text));
  assert.equal(seenLast.size, lastLines.length);
  const seenClock = new Set(clockLines.map((_, i) => announceWith(i / clockLines.length + 1e-6).calls[1].text));
  assert.equal(seenClock.size, clockLines.length);
});

test('real game & save load: pooled PA announcements always come from config pools and old saves still load', (t) => {
  const storage = memoryStorage();
  const savedRun = headlessGame({ saveStorage: storage });
  t.after(() => savedRun.g.map.dispose());
  savedRun.tick();
  savedRun.g.rounds.jumpTo(4);
  savedRun.tick();
  assert.equal(savedRun.g.saveGame.saveAndQuit(), true);

  const rawSave = JSON.parse(storage.getItem(saveConfig.storageKey));
  assert.equal(rawSave.version, saveConfig.version);
  assert.equal(rawSave.data.announcer, undefined);

  const loaded = headlessGame({ saveStorage: storage });
  t.after(() => loaded.g.map.dispose());
  assert.equal(loaded.g.saveGame.load(), true);
  loaded.tick();

  const h = loaded.hud.calls.length;
  const s = loaded.sounds.length;
  loaded.g.events.emit('waveEnding', { round: 4, remaining: 1 });
  loaded.g.events.emit('clockIn', { round: 5, skipped: 12 });
  assert.equal(loaded.g.flashSales.teaseNow('category'), true);

  const banners = announcements(loaded, h);
  assert.equal(banners.length, 3);
  assert.deepEqual(loaded.sounds.slice(s), ['paChime', 'paChime', 'paChime']);
  assert.ok(economy.rounds.lastShoppers.pa.lines.includes(banners[0].text));
  assert.ok(economy.rounds.clockIn.pa.lines.includes(banners[1].text));

  const teaserTemplates = economy.flashSales.teaser.lines.map((line) => line.replace('{lead}', 'ten seconds'));
  assert.ok(
    teaserTemplates.some((tpl) => {
      const prefix = tpl.split('{label}')[0];
      const suffix = tpl.split('{label}')[1];
      return banners[2].text.startsWith(prefix) && banners[2].text.endsWith(suffix);
    }),
    `flashSaleSoon text came from teaser pool: ${banners[2].text}`,
  );
});
