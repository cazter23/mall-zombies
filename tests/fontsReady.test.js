import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fonts } from '../src/config/fonts.js';
import { waitForFonts } from '../src/core/fontsReady.js';

const fakeDoc = (load) => ({ fonts: { load } });

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
});

test('the page boots through the wait, and the fonts come from the local bundle, not a font host', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes('src="/src/boot.js"'));
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html), 'index.html must not load fonts from the network');
  const boot = readFileSync('src/boot.js', 'utf8');
  assert.ok(boot.includes("./fonts/fonts.css"));
  assert.ok(fonts.canvas.length > 0);
});
