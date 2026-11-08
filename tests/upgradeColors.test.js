// The colour languages of gun upgrades stay apart (config/gunStyle.js): the Extended Warranty is METAL (tier colours: steel, gold, pearl), the Build-A-Blaster is CANDY
// (the stuffing colours), and a Heart's badge has its own colour. Before this, Premium purple was nearly Glitter and Platinum gold was nearly Popcorn Butter.
// Distances are CIE76 delta-E in Lab (about 2 is the least a person can tell apart, 10-20 is "similar", 30+ is clearly different).
import test from 'node:test';
import assert from 'node:assert/strict';
import { upgrades } from '../src/config/upgrades.js';
import { workshopStuffings, workshopHearts } from '../src/config/workshop.js';
import { gunStyle } from '../src/config/gunStyle.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { buildModifiers } from '../src/weapons/upgrades.js';

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function lab(hex) {
  const r = lin((hex >> 16) & 255), g = lin((hex >> 8) & 255), b = lin(hex & 255);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const distance = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
const closest = (listA, listB) => {
  let best = { d: Infinity };
  for (const [na, ca] of listA) for (const [nb, cb] of listB) { const d = distance(ca, cb); if (d < best.d) best = { d, pair: `${na} / ${nb}` }; }
  return best;
};
const warranty = [...upgrades.tiers.filter((t) => t.id !== 'standard').map((t) => [t.name, t.color]), ['Renewal', upgrades.renewals.color]];
const stuffings = Object.entries(workshopStuffings).map(([id, s]) => [id, s.color]);
const hearts = Object.entries(gunStyle.heart.colors);

test('no warranty colour looks like any stuffing colour', () => {
  const { d, pair } = closest(warranty, stuffings);
  assert.ok(d >= 30, `closest warranty/stuffing pair ${pair} is only ${d.toFixed(0)} apart`);
});

test('the warranty tiers are told apart from each other, and from the Standard grey', () => {
  const tiers = upgrades.tiers.map((t) => [t.name, t.color]);
  let worst = Infinity, pair = '';
  for (let i = 0; i < tiers.length; i++) for (let j = i + 1; j < tiers.length; j++) {
    const d = distance(tiers[i][1], tiers[j][1]);
    if (d < worst) { worst = d; pair = `${tiers[i][0]} / ${tiers[j][0]}`; }
  }
  assert.ok(worst >= 15, `${pair} are only ${worst.toFixed(0)} apart`);
});

test('the stuffings are told apart from each other, and each Heart badge from the others', () => {
  const pairwise = (list) => {
    let worst = { d: Infinity };
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const d = distance(list[i][1], list[j][1]);
      if (d < worst.d) worst = { d, pair: `${list[i][0]} / ${list[j][0]}` };
    }
    return worst;
  };
  const s = pairwise(stuffings), h = pairwise(hearts);
  assert.ok(s.d >= 35, `stuffings ${s.pair}: ${s.d.toFixed(0)}`);
  assert.ok(h.d >= 40, `hearts ${h.pair}: ${h.d.toFixed(0)}`);
});

test('every Heart has a badge colour and a shape, and every warranty tier has a metal finish', () => {
  for (const id of Object.keys(workshopHearts)) {
    assert.ok(gunStyle.heart.colors[id] !== undefined, `${id} colour`);
    assert.ok(['crosshair', 'bullet', 'ring', 'star'].includes(gunStyle.heart.shapes[id]), `${id} shape`);
  }
  for (const tier of upgrades.tiers.filter((t) => t.id !== 'standard')) {
    const f = gunStyle.finish[tier.id];
    assert.ok(f && f.metal >= 0.5, `${tier.id} is metal`);
  }
  assert.ok(gunStyle.finish.platinum.shimmer, 'Platinum shimmers');
});

test('a better quality is more vivid and glows more', () => {
  const order = ['understuffed', 'regular', 'extraStuffed', 'overstuffed'].map((id) => gunStyle.quality[id]);
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i].saturation >= order[i - 1].saturation && order[i].glow >= order[i - 1].glow && order[i].seamHot >= order[i - 1].seamHot, `quality ${i}`);
  }
  assert.ok(order[0].glow === 0 && order.at(-1).glow > 0);
});

test('a built gun still shoots in its stuffing colour (tracers), whatever the quality', () => {
  const base = { pellets: null, tracerColor: 0 };
  const mods = buildModifiers(base, workshopStuffings.neonTube.color, { damage: 1 });
  assert.equal(resolveGun({ ...base, id: 'x', name: 'x', damage: 10 }, [{ id: 'build', modifiers: mods }]).tracerColor, workshopStuffings.neonTube.color);
});
