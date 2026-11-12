// The mall PA as data (game/announcer.js), in the real game: each event shows its line with a chime, Directed-only
// lines stay silent in Classic, and the order the tables were registered in still holds where it matters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';

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
