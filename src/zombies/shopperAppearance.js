// =============================================================================
// SHOPPER APPEARANCE: which 1986 mall-goer a Shopper is (config/shoppers.js archetypes), chosen once per spawn.
//
//   lookRandom(seed)                  a small seeded random of its own (never Math.random), so a look never shifts the
//                                     game's random numbers and the same seed always gives the same Shopper
//   chooseShopperAppearance(random)   -> the look: { archetype, presentation ('masculine' | 'feminine': config
//                                     onlyFor keeps every piece agreeing with it), top, bottom, shoes, pattern, build, hair, hairColor,
//                                     headwear, eyewear, held, extra, wear, face, palette: { id, top, accent, inner,
//                                     pants, shoes } (hex), colors: { held, extra, headwear, eyewear } (hex) }
//   appearanceForSeed(seed)           the same, from a seed (zombieManager hands every spawn its own: zombie.lookSeed)
//
// Combat never reads a look. zombies/shopperModel.js dresses the skeleton with it.
// =============================================================================

import { shoppers, colors } from '../config/shoppers.js';

/** A seeded random in [0, 1) (mulberry32 over a scrambled seed: neighbouring seeds give unrelated Shoppers). */
export function lookRandom(seed) {
  let s = Math.imul((seed | 0) ^ 0x5bd1e995, 0x9e3779b1) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
function weighted(items, random) {
  let roll = random() * items.reduce((sum, item) => sum + item.weight, 0);
  for (const item of items) { roll -= item.weight; if (roll < 0) return item; }
  return items.at(-1);
}
const hex = (name) => {
  if (!(name in colors)) throw new Error(`config/shoppers.js: no colour named '${name}'`);
  return colors[name];
};

/** Can a Shopper of this presentation wear this piece? (No: another presentation has it in config onlyFor.) */
export function fitsPresentation(presentation, list, id) {
  return Object.entries(shoppers.onlyFor).every(([other, only]) => other === presentation || !only[list]?.includes(id));
}

/** One look per spawn. Every pick comes from the archetype's own lists, so outfits stay coordinated, and only from the
 *  pieces that fit the Shopper's presentation (config/shoppers.js onlyFor), so hair, build and clothes agree. */
export function chooseShopperAppearance(random = Math.random) {
  const archetype = weighted(shoppers.archetypes, random);
  const presentation = weighted(archetype.presentations, random).id;
  const fitting = (list) => {
    const options = archetype[list].filter((entry) => fitsPresentation(presentation, list, entry.id ?? entry));
    if (!options.length) throw new Error(`config/shoppers.js: ${archetype.id} has no ${list} for a ${presentation} Shopper`);
    return options;
  };
  const scheme = pick(archetype.palettes, random);
  const bottom = pick(fitting('bottoms'), random);
  const pantsColor = shoppers.bottoms[bottom].pantsColor; // (acid wash and ripped jeans are always denim)
  const palette = {
    id: scheme.id, top: hex(scheme.top), accent: hex(scheme.accent), inner: hex(scheme.inner),
    pants: hex(pantsColor ?? scheme.pants), shoes: hex(scheme.shoes),
  };
  const look = {
    archetype: archetype.id,
    presentation,
    top: pick(fitting('tops'), random),
    bottom,
    shoes: pick(fitting('shoes'), random),
    pattern: pick(archetype.patterns, random),
    build: pick(fitting('builds'), random),
    hair: weighted(fitting('hair'), random).id,
    hairColor: hex(pick(archetype.hairColors, random)),
    headwear: weighted(fitting('headwear'), random).id,
    eyewear: weighted(fitting('eyewear'), random).id,
    held: weighted(fitting('held'), random).id,
    extra: weighted(fitting('extras'), random).id,
    wear: weighted(shoppers.wearWeights, random).id,
    face: pick(shoppers.faceProfiles, random).id,
    palette,
    colors: {},
  };
  if (shoppers.extras[look.extra].head) look.headwear = 'none'; // (headphones and a hat don't share a head)
  for (const slot of ['held', 'extra', 'headwear', 'eyewear']) {
    const options = shoppers.itemColors[look[slot]];
    look.colors[slot] = options ? hex(pick(options, random)) : null;
  }
  return look;
}

export function appearanceForSeed(seed) {
  return chooseShopperAppearance(lookRandom(seed));
}
