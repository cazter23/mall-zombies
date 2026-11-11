import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoticeHistory } from '../src/ui/noticeHistory.js';
import { ui } from '../src/config/ui.js';
import './helpers/headlessGame.js';
import { settingDefs } from '../src/config/settings.js';
import { createSettings } from '../src/game/settings.js';

test('run correspondence retains instructions and certificates, bounds its archive, and resets independently of PA visibility', () => {
  const history = createNoticeHistory();
  history.addMessage({ kicker: 'Limited Edition', text: 'Tag body shots, then pop with a headshot.' });
  history.addMessage({ kicker: 'Limited Edition', text: 'Tag body shots, then pop with a headshot.' });
  assert.equal(history.snapshot().messages.length, 1);
  const certificate = { name: 'Gerald', note: 'Courtesy Loaner returned.' };
  history.addCertificate(certificate);
  certificate.name = 'Changed outside the archive';
  assert.equal(history.snapshot().certificates[0].name, 'Gerald');
  const snapshot = history.snapshot();
  snapshot.messages[0].text = 'Changed copy';
  assert.match(history.snapshot().messages[0].text, /Tag body shots/);
  for (let i = 0; i < ui.noticeHistorySize + 3; i++) history.addMessage({ text: `Message ${i}` });
  for (let i = 0; i < ui.certificateHistorySize + 3; i++) history.addCertificate({ name: `Blaster ${i}` });
  assert.equal(history.snapshot().messages.length, ui.noticeHistorySize);
  assert.equal(history.snapshot().certificates.length, ui.certificateHistorySize);
  assert.equal(history.snapshot().messages[0].text, `Message ${ui.noticeHistorySize + 2}`);
  history.clear();
  assert.deepEqual(history.snapshot(), { messages: [], certificates: [] });
});

test('UI and text scales save independently of render resolution, clamp invalid saves, and reset from Comfort', () => {
  const savedStorage = globalThis.localStorage;
  let data = null;
  globalThis.localStorage = { getItem: () => data, setItem: (_, value) => { data = value; } };
  const seen = {};
  const ctx = { renderer: { setPixelRatio: v => { seen.render = v; } },
    hud: { setFpsVisible() {}, setUiScale: v => { seen.ui = v; }, setTextSize: v => { seen.text = v; } },
    sound: { setMasterVolume() {} } };
  try {
    const settings = createSettings(ctx);
    const render = settings.get('renderScale');
    settings.set('uiScale', 1.25); settings.set('textSize', 1.5);
    assert.equal(seen.render, render);
    const again = createSettings(ctx);
    assert.equal(again.get('uiScale'), 1.25);
    assert.equal(again.get('textSize'), 1.5);
    assert.equal(again.get('renderScale'), render);
    again.set('textSize', 50);
    assert.equal(again.get('textSize'), 1.5);
    again.set('uiScale', NaN);
    assert.equal(again.get('uiScale'), 1);
    again.reset('Comfort');
    for (const id of ['uiScale', 'textSize']) {
      assert.equal(again.get(id), settingDefs.find(d => d.id === id).default);
      assert.equal(seen[id === 'uiScale' ? 'ui' : 'text'], 1);
    }
  } finally { globalThis.localStorage = savedStorage; }
});

test('readability CSS hides left HUD stack during both menu-open and fitting-open', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const css = fs.readFileSync(path.resolve('src/ui/readability.css'), 'utf8');
  assert.ok(css.includes('.hud.fitting-open .hud-left-stack'), 'fitting-open hides left stack');
  assert.ok(css.includes('.hud.menu-open .hud-left-stack'), 'menu-open hides left stack');
});
