// The type system (config/typefaces.js, world/typeKit.js, src/fonts/): every sign asks for a ROLE, every role names a bundled
// family, and no module smuggles in a raw font string (a typo or a system fallback would silently draw in the wrong face).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { families, roles, signKinds, posterTypography } from '../src/config/typefaces.js';
import { fonts } from '../src/config/fonts.js';
import { fontFor, drawType, fitSize, roleOf } from '../src/world/typeKit.js';

const slug = (name) => name.toLowerCase().replaceAll(' ', '-');
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    statSync(path).isDirectory() ? walk(path, out) : path.endsWith('.js') && out.push(path.replaceAll('\\', '/'));
  }
  return out;
};

test('every role uses a bundled family, in a weight (and style) that is bundled', () => {
  for (const [name, role] of Object.entries(roles)) {
    const family = families[role.family];
    assert.ok(family, `role ${name}: unknown family ${role.family}`);
    const list = role.italic ? family.italic : family.weights;
    assert.ok(list?.includes(role.weight), `role ${name}: ${role.family} ${role.italic ? 'italic ' : ''}${role.weight} is not bundled`);
  }
});

test('every sign kind and poster typeface names real roles', () => {
  for (const [kind, set] of Object.entries(signKinds)) for (const role of Object.values(set)) assert.ok(roles[role], `signKinds.${kind}: ${role}`);
  for (const [kind, set] of Object.entries(posterTypography)) for (const role of Object.values(set)) assert.ok(roles[role], `posterTypography.${kind}: ${role}`);
});

test('every configured font is bundled: a @font-face, a file on disk, and a licence we may ship', () => {
  const css = readFileSync('src/fonts/fonts.css', 'utf8');
  for (const [name, def] of Object.entries(families)) {
    assert.ok(['OFL', 'Apache'].includes(def.license), `${name}: licence ${def.license}`);
    const faces = [...def.weights.map((w) => [w, 'normal']), ...(def.italic ?? []).map((w) => [w, 'italic'])];
    for (const [weight, style] of faces) {
      const file = `${slug(name)}-latin-${weight}-${style}.woff2`;
      assert.ok(existsSync(`src/fonts/files/${file}`), `missing ${file}`);
      assert.ok(css.includes(`font-family: "${name}"; font-style: ${style}; font-weight: ${weight};`) && css.includes(`/${file}`), `fonts.css lacks ${name} ${style} ${weight}`);
    }
  }
  const declared = [...css.matchAll(/font-family: "([^"]+)"/g)].map((m) => m[1]);
  for (const name of declared) assert.ok(families[name], `fonts.css declares ${name}, which config/typefaces.js does not list`);
  // the startup wait asks for every one of them
  for (const [name, def] of Object.entries(families)) {
    for (const w of def.weights) assert.ok(fonts.canvas.includes(`${w} 40px "${name}"`), `startup does not wait for ${name} ${w}`);
  }
  assert.ok(!/https?:\/\//.test(css), 'fonts.css must not load anything from the network');
});

test('no module writes a raw font string: text asks for a role', () => {
  // HUD / minimap text (DOM + the minimap canvas) is outside the 3D-world type system.
  const allowed = new Set(['src/config/typefaces.js', 'src/config/fonts.js', 'src/config/minimap.js', 'src/world/typeKit.js', 'src/ui/minimap.js']);
  const generic = /\b(Arial|Helvetica|Georgia|Times New Roman|Courier|Comic Sans|Impact|Trebuchet|monospace|sans-serif|cursive|Segoe)\b/;
  const names = Object.keys(families).map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const literal = new RegExp(`['"\`][^'"\`\\n]*(\\d+px\\s|"(${names})")`);
  const bad = [];
  for (const file of walk('src')) {
    if (allowed.has(file) || file.startsWith('src/ui/')) continue;
    readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
      const code = text.replace(/\/\/.*$/, '');
      if ((generic.test(code) && /['"`][^'"`]*\b(Arial|Helvetica|Georgia|Times New Roman|Courier|Comic Sans|Impact|Trebuchet|monospace|sans-serif|cursive|Segoe)\b/.test(code)) || literal.test(code)) bad.push(`${file}:${i + 1}: ${text.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('fontFor builds a canvas font from a role; an unknown role is an error, not a fallback', () => {
  assert.match(fontFor('hoffmanBrand', 40), /^700 40px "Cinzel", /);
  assert.match(fontFor('hoffmanSub', 20), /^italic 400 20px "Playfair Display", /);
  assert.match(fontFor('marker', 12, { weight: 400 }), /"Permanent Marker"/);
  assert.throws(() => roleOf('hoffmanBrnad'), /unknown type role/);
  assert.throws(() => fontFor('Arial, sans-serif', 20), /unknown type role/);
});

// A recording canvas context: text width = 0.5 em per character, so fitting is predictable.
function fakeCtx() {
  const calls = [];
  const ctx = {
    calls, font: '', letterSpacing: '0px', textAlign: 'left', textBaseline: 'alphabetic', fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() { calls.push(['save']); }, restore() { calls.push(['restore']); }, translate() {}, transform() {},
    createLinearGradient() { return { addColorStop() {} }; },
    measureText(text) { const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)[1]); return { width: text.length * px * 0.5 }; },
    fillText(text, x, y) { calls.push(['fill', text, x, y, this.font, this.fillStyle]); },
    strokeText(text, x, y) { calls.push(['stroke', text, x, y, this.font]); },
  };
  return ctx;
}

test('drawType draws in the role\'s family, shrinks to fit and never clips', () => {
  const ctx = fakeCtx();
  const size = drawType(ctx, 'HOFFMAN\'S DEPARTMENT STORE', 100, 20, { role: 'hoffmanBrand', size: 80, maxWidth: 300, fill: '#fff' });
  assert.ok(size < 80 && size >= 6);
  const fill = ctx.calls.find((c) => c[0] === 'fill');
  assert.match(fill[4], /"Cinzel"/);
  assert.ok(ctx.measureText.call({ font: fill[4] }, fill[1]).width <= 300 + 1);
  assert.equal(ctx.calls.at(-1)[0], 'restore', 'drawing leaks no state');
});

test('treatments: outline strokes first, a hard shadow draws under the letters, caps follow the role', () => {
  const ctx = fakeCtx();
  drawType(ctx, 'sale', 10, 10, { role: 'clearance', size: 40, fill: '#fff', outline: { color: '#000', width: 0.1 }, shadow: { color: '#f00', dx: 0.05, dy: 0.05 } });
  const kinds = ctx.calls.map((c) => c[0]).filter((k) => k !== 'save' && k !== 'restore');
  assert.deepEqual(kinds, ['stroke', 'fill', 'stroke', 'fill']); // shadow (outline + fill), then outline, then the fill
  assert.equal(ctx.calls.find((c) => c[0] === 'fill')[1], 'SALE'); // clearance is upper-case
  assert.equal(fitSize(fakeCtx(), 'x', 'marker', 30, 1000), 30);
});
