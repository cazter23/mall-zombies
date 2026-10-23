// Settings presets (config/settings.js settingPresets): every preset only sets real settings of its own tab, to values
// those settings accept (inside a slider's range, one of a select's options, a boolean for a toggle).
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/headlessGame.js'; // (first: it stubs the browser globals settings.js reads)
import { settingDefs, settingPresets, settingsTabs, nativeRenderRatio } from '../src/config/settings.js';

test('every preset sets real settings of its own tab to values they accept', () => {
  for (const [tab, presets] of Object.entries(settingPresets)) {
    assert.ok(settingsTabs.includes(tab), `${tab} is a real tab`);
    assert.ok(presets.length >= 2, `${tab}: a choice of presets`);
    for (const preset of presets) {
      for (const [id, value] of Object.entries(preset.values)) {
        const def = settingDefs.find((d) => d.id === id);
        assert.ok(def, `${tab} / ${preset.label}: ${id} is a real setting`);
        assert.equal(def.tab, tab, `${id} lives on the ${tab} tab`);
        if (def.type === 'slider') assert.ok(value >= def.min && value <= def.max, `${id}: ${value} in range`);
        if (def.type === 'toggle') assert.equal(typeof value, 'boolean', id);
        if (def.type === 'select') assert.ok(def.options.some((o) => o.value === value), id);
      }
    }
  }
});

test('the Standard comfort preset is the shipped defaults (so picking it undoes Calm)', () => {
  const standard = settingPresets.Comfort.find((p) => p.label === 'Standard');
  for (const [id, value] of Object.entries(standard.values)) {
    assert.equal(value, settingDefs.find((d) => d.id === id).default, id);
  }
});

test('Video presets have distinct resolutions; High and the default retain exact native density without rounding down', () => {
  const saved = window.devicePixelRatio;
  try {
    for (const ratio of [1, 1.1, 1.25, 1.5, 2, 3]) {
      window.devicePixelRatio = ratio;
      assert.equal(nativeRenderRatio(), Math.min(ratio, 2));
    }
  } finally { window.devicePixelRatio = saved; }
  const values = settingPresets.Video.map((preset) => preset.values.renderScale);
  assert.equal(new Set(values).size, values.length, 'controller can cycle every preset at DPR 1 too');
  assert.equal(values.at(-1), nativeRenderRatio());
  assert.equal(settingDefs.find((def) => def.id === 'renderScale').default, nativeRenderRatio());
});
