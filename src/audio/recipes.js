// =============================================================================
// SOUND RECIPES (pure: no Web Audio, so tests and tools can use it)
// Turns a recipe from config/audio.js into one shape the engine (audio/sound.js) plays, checks recipes, and applies
// the data that changes a sound per play: a gun's upgrade tier, its renewals, its Build-A-Blaster stuffing, and the
// low-ammo lightening (config/gunSounds.js soundUpgrades / lowAmmo). The recipe format is described at the top of
// config/audio.js.
//
//   normalizeRecipe(def)              -> { volume, maxVoices, send, drive, vary, pitchVariation, flavourGain, flavourEvery, sidePan, pitchStep,
//                                          parts: [{ name, gain, drive, layers }] }
//   validateRecipe(def)               -> [] or a list of problems (strings)
//   resolveVariant(recipe, variant, upgrades) -> a normalized recipe with the variant applied
//   variantKey(variant)               -> a short string ('' for none), for caching
//   driveCurve(amount, size)          -> Float32Array for a WaveShaperNode (cached), and driveMakeup(amount) to keep levels matched
// =============================================================================

export const LAYER_TYPES = ['noise', 'tone', 'click', 'metal', 'fm'];
const FILTERS = ['lowpass', 'highpass', 'bandpass', 'notch', 'peaking'];
const WAVES = ['sine', 'square', 'triangle', 'sawtooth'];
const PART_ORDER = ['crack', 'body', 'mech', 'tail'];

/** One layer with its defaults filled in. */
function normalizeLayer(layer) {
  const out = { attack: 0.001, delay: 0, ...layer };
  if (out.type === 'click') {
    out.ms ??= 3;
    out.shape ??= 'noise';
    out.attack = 0;
    out.decay ??= out.ms / 1000;
  }
  return out;
}

function normalizePart(name, part) {
  const p = Array.isArray(part) ? { layers: part } : part;
  return { name, gain: p.gain ?? 1, drive: p.drive ?? 0, layers: (p.layers ?? []).map(normalizeLayer) };
}

const normalized = new WeakMap();

/** A recipe in one shape: `layers` (the old format) becomes a single part called 'main'. Cached per recipe object. */
export function normalizeRecipe(def) {
  if (normalized.has(def)) return normalized.get(def);
  const parts = [];
  if (def.layers) parts.push(normalizePart('main', def.layers));
  if (def.parts) {
    const names = Object.keys(def.parts).sort((a, b) => rank(a) - rank(b));
    for (const name of names) parts.push(normalizePart(name, def.parts[name]));
  }
  const recipe = {
    volume: def.volume ?? 1,
    maxVoices: def.maxVoices ?? null,
    send: def.send ?? 0,
    drive: def.drive ?? 0,
    vary: def.vary ?? null,
    pitchVariation: def.pitchVariation ?? null,
    flavourGain: def.flavourGain ?? 1,
    flavourEvery: def.flavourEvery ?? 1,
    sidePan: def.sidePan ?? 0,
    pitchStep: def.pitchStep ?? 0,
    upgrades: def.upgrades ?? null,
    parts,
  };
  normalized.set(def, recipe);
  return recipe;
}
const rank = (name) => { const i = PART_ORDER.indexOf(name); return i === -1 ? PART_ORDER.length : i; };

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Every problem with a recipe, as words ([] = fine). */
export function validateRecipe(def, name = 'sound') {
  const problems = [];
  const bad = (msg) => problems.push(`${name}: ${msg}`);
  if (!def || typeof def !== 'object') return [`${name}: not an object`];
  if (!def.layers && !def.parts) bad('has neither layers nor parts');
  if (def.volume !== undefined && !(finite(def.volume) && def.volume >= 0)) bad('volume must be a number >= 0');
  if (def.maxVoices !== undefined && !(Number.isInteger(def.maxVoices) && def.maxVoices >= 1)) bad('maxVoices must be an integer >= 1');
  if (def.flavourEvery !== undefined && !(Number.isInteger(def.flavourEvery) && def.flavourEvery >= 1)) bad('flavourEvery must be an integer >= 1');
  for (const key of ['send', 'drive', 'sidePan', 'pitchStep', 'flavourGain']) if (def[key] !== undefined && !(finite(def[key]) && def[key] >= 0)) bad(`${key} must be a number >= 0`);
  checkVary(def.vary, bad, 'vary');
  const recipe = normalizeRecipe(def);
  let layerCount = 0;
  for (const part of recipe.parts) {
    if (!finite(part.gain) || !finite(part.drive)) bad(`part ${part.name}: gain/drive must be numbers`);
    part.layers.forEach((layer, i) => { layerCount++; checkLayer(layer, (m) => bad(`part ${part.name} layer ${i}: ${m}`)); });
  }
  if (layerCount === 0) bad('has no layers');
  return problems;
}

function checkVary(vary, bad, where) {
  if (vary === undefined || vary === null) return;
  for (const [k, v] of Object.entries(vary)) {
    if (!['pitch', 'gain', 'decay', 'freq', 'delay'].includes(k)) bad(`${where}.${k} is not a vary field`);
    else if (!(finite(v) && v >= 0 && v < 1)) bad(`${where}.${k} must be a fraction 0..1`);
  }
}

function checkLayer(layer, bad) {
  if (!LAYER_TYPES.includes(layer.type)) return bad(`unknown type ${layer.type}`);
  if (!(finite(layer.gain) && layer.gain >= 0)) bad('gain must be a number >= 0');
  if (!(finite(layer.attack) && layer.attack >= 0)) bad('attack must be a number >= 0');
  if (!(finite(layer.decay) && layer.decay > 0)) bad('decay must be a number > 0');
  if (!(finite(layer.delay) && layer.delay >= 0)) bad('delay must be a number >= 0');
  if (layer.drive !== undefined && !(finite(layer.drive) && layer.drive >= 0)) bad('drive must be a number >= 0');
  checkVary(layer.vary, bad, 'vary');
  const hz = (v) => finite(v) && v > 0 && v < 24000;
  if (layer.type === 'click') {
    if (!(finite(layer.ms) && layer.ms > 0 && layer.ms <= 30)) bad('click ms must be 0..30');
    if (!['noise', 'impulse'].includes(layer.shape)) bad('click shape must be noise or impulse');
    if (layer.filter !== undefined && !FILTERS.includes(layer.filter)) bad(`unknown filter ${layer.filter}`);
    if (layer.filter !== undefined && !hz(layer.freq)) bad('a filtered click needs freq');
    return;
  }
  if (!hz(layer.freq)) bad('freq must be in Hz (0..24000)');
  if (layer.freqEnd !== undefined && !hz(layer.freqEnd)) bad('freqEnd must be in Hz');
  if (layer.type === 'noise') {
    if (!FILTERS.includes(layer.filter)) bad(`unknown filter ${layer.filter}`);
  } else if (layer.type === 'tone') {
    if (!WAVES.includes(layer.wave)) bad(`unknown wave ${layer.wave}`);
  } else if (layer.type === 'metal') {
    if (!Array.isArray(layer.ratios) || layer.ratios.length < 1 || !layer.ratios.every((r) => finite(r) && r > 0)) bad('metal needs ratios');
    if (layer.ratios?.some((r) => !hz(r * layer.freq))) bad('a metal partial is out of range');
    if (layer.wave !== undefined && !WAVES.includes(layer.wave)) bad(`unknown wave ${layer.wave}`);
  } else if (layer.type === 'fm') {
    if (!(finite(layer.ratio) && layer.ratio > 0)) bad('fm needs ratio');
    if (!(finite(layer.index) && layer.index >= 0)) bad('fm needs index');
    if (layer.indexEnd !== undefined && !(finite(layer.indexEnd) && layer.indexEnd >= 0)) bad('fm indexEnd must be >= 0');
    if (layer.wave !== undefined && !WAVES.includes(layer.wave)) bad(`unknown wave ${layer.wave}`);
  }
}

// ---- Variants: upgrades and low ammo ----------------------------------------------------------------------------

/** A short key for a variant, '' when it changes nothing. */
export function variantKey(v) {
  if (!v) return '';
  const tier = v.tier && v.tier !== 'standard' ? v.tier : '';
  const key = [tier, v.renewals || '', v.stuffing || '', v.lowAmmo ? 'low' : ''].join('|');
  return key === '|||' ? '' : key;
}

const scaleLayer = (layer, s) => ({
  ...layer,
  gain: layer.gain * (s.gain ?? 1),
  ...(s.pitch && s.pitch !== 1 && layer.freq ? { freq: layer.freq * s.pitch } : {}),
  ...(s.pitch && s.pitch !== 1 && layer.freqEnd ? { freqEnd: layer.freqEnd * s.pitch } : {}),
  ...(s.decay && s.decay !== 1 ? { decay: layer.decay * s.decay } : {}),
});

/**
 * Apply one modifier to a normalized recipe:
 *   { volume: x, drive: +x, send: +x, scale: { <part>|'*': { gain, pitch, decay } }, add: { <part>: [layers] } }
 * `addGain` scales added layers (a gun's flavourGain for stuffings).
 */
function applyModifier(recipe, mod, { times = 1, addGain = 1 } = {}) {
  if (!mod || times <= 0) return recipe;
  const out = { ...recipe, parts: recipe.parts.map((p) => ({ ...p })) };
  out.volume *= (mod.volume ?? 1) ** times;
  out.drive += (mod.drive ?? 0) * times;
  out.send += (mod.send ?? 0) * times;
  for (const [name, s] of Object.entries(mod.scale ?? {})) {
    const pow = { gain: (s.gain ?? 1) ** times, pitch: (s.pitch ?? 1) ** times, decay: (s.decay ?? 1) ** times };
    for (const part of out.parts) {
      if (name !== '*' && part.name !== name) continue;
      part.layers = part.layers.map((l) => scaleLayer(l, pow));
    }
  }
  for (const [name, layers] of Object.entries(mod.add ?? {})) {
    const added = normalizePart(name, layers);
    added.layers = added.layers.map((l) => ({ ...l, gain: l.gain * addGain }));
    const existing = out.parts.find((p) => p.name === name);
    if (existing) existing.layers = [...existing.layers, ...added.layers];
    else out.parts.push(added);
  }
  return out;
}

/**
 * The recipe a variant plays: the tier, then each renewal, then the stuffing's flavour, then low ammo. A recipe's own
 * `upgrades` (same shape as `upgrades`) replaces the shared entry for that tier / stuffing / lowAmmo.
 * @param upgrades { tiers: { id: mod }, renewal: mod, maxRenewals, stuffings: { id: mod }, lowAmmo: mod }
 */
export function resolveVariant(recipe, variant, upgrades) {
  if (!variant || !upgrades) return recipe;
  const own = recipe.upgrades ?? {};
  let out = recipe;
  if (variant.tier && variant.tier !== 'standard') out = applyModifier(out, own.tiers?.[variant.tier] ?? upgrades.tiers?.[variant.tier]);
  if (variant.renewals) out = applyModifier(out, own.renewal ?? upgrades.renewal, { times: Math.min(variant.renewals, upgrades.maxRenewals ?? 5) });
  if (variant.stuffing) out = applyModifier(out, own.stuffings?.[variant.stuffing] ?? upgrades.stuffings?.[variant.stuffing], { addGain: recipe.flavourGain });
  if (variant.lowAmmo) out = applyModifier(out, own.lowAmmo ?? upgrades.lowAmmo);
  return out;
}

// ---- Drive (saturation) ----------------------------------------------------------------------------------------------

const curves = new Map();
const kOf = (amount) => 1 + amount * 12;

/**
 * A soft-saturation curve: tanh with a touch of asymmetry (even harmonics: "crunch" rather than fuzz).
 * amount 0 = clean, 0.3 = warm, 1 = crushed. Cached by amount.
 */
export function driveCurve(amount, size = 1024) {
  const key = `${amount.toFixed(3)}:${size}`;
  if (curves.has(key)) return curves.get(key);
  const k = kOf(amount), norm = Math.tanh(k), curve = new Float32Array(size);
  const asym = 0.15 * Math.min(1, amount);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * (x + asym * x * x)) / norm; // (asym leaves a tiny DC offset; the reverb's and speakers' high-pass take it)
  }
  curves.set(key, curve);
  return curve;
}

/** Post-gain after a drive stage: drive makes small signals louder (by about k / tanh(k)); this gives most of that back. */
export function driveMakeup(amount) {
  const k = kOf(amount);
  return (Math.tanh(k) / k) ** 0.75;
}

/** The final safety stage: unity up to `knee`, then a smooth curve that never passes `ceiling` (peak stays under 0 dBFS). */
export function softClipCurve({ knee = 0.7, ceiling = 0.98 } = {}, size = 2048) {
  const curve = new Float32Array(size);
  const room = ceiling - knee;
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1, a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}
