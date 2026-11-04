import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fonts } from '../src/config/fonts.js';
import { waitForFonts } from '../src/core/fontsReady.js';

const fakeDoc = (load, link = null) => ({ querySelector: () => link, fonts: { load } });

test('startup waits for every canvas font before it continues', async () => {
  const asked = [];
  let finish;
  const doc = fakeDoc((font) => { asked.push(font); return new Promise((resolve) => { finish = resolve; }); });
  let done = false;
  const wait = waitForFonts(doc, { canvas: ['400 40px "A"'], sampleText: 'Aa', maxWaitMs: 1000 }).then(() => { done = true; });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(asked, ['400 40px "A"']);
  assert.equal(done, false);
  finish();
  await wait;
  assert.equal(done, true);
});

test('a stuck network or a failed font never stops the game starting', async () => {
  await waitForFonts(fakeDoc(() => new Promise(() => {})), { canvas: ['x'], sampleText: 'Aa', maxWaitMs: 5 });
  await waitForFonts(fakeDoc(() => Promise.reject(new Error('offline'))), { canvas: ['x'], sampleText: 'Aa', maxWaitMs: 1000 });
  const neverLoads = { sheet: null, addEventListener() {} };
  await waitForFonts(fakeDoc(() => Promise.resolve(), neverLoads), { canvas: ['x'], sampleText: 'Aa', maxWaitMs: 5 });
});

test('the single-file build\'s late stylesheet is waited for before fonts are requested', async () => {
  const listeners = {}, asked = [];
  const link = { sheet: null, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const wait = waitForFonts(fakeDoc((font) => { asked.push(font); return Promise.resolve(); }, link),
    { canvas: ['x'], sampleText: 'Aa', maxWaitMs: 1000 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(asked.length, 0);
  listeners.load();
  await wait;
  assert.equal(asked.length, 1);
});

test('it watches the stylesheet link, not the preconnect link to the same host', async () => {
  let selector;
  const doc = { querySelector: (s) => { selector = s; return null; }, fonts: { load: () => Promise.resolve() } };
  await waitForFonts(doc, { canvas: ['x'], sampleText: 'Aa', maxWaitMs: 5 });
  assert.match(selector, /rel="stylesheet"/);
});

test('every font in the config is requested by the page, and the page boots through the wait', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const font of fonts.canvas) {
    const family = /"(.+)"/.exec(font)[1].replace(/ /g, '+');
    assert.ok(html.includes('family=' + family), family);
  }
  assert.ok(html.includes('src="/src/boot.js"'));
});
