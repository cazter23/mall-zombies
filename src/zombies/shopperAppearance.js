import { shoppers } from '../config/shoppers.js';

const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
function weighted(items, random) {
  let roll = random() * items.reduce((sum, item) => sum + item.weight, 0);
  for (const item of items) { roll -= item.weight; if (roll < 0) return item; }
  return items.at(-1);
}

// One appearance per spawn. All combinations come from a coordinated
// wardrobe; animation never rolls again. Combat never reads this descriptor.
export function chooseShopperAppearance(random = Math.random) {
  const profile = weighted(shoppers.profiles, random);
  return {
    profile: profile.id,
    palette: pick(profile.palettes, random),
    top: pick(profile.tops, random),
    bottom: pick(profile.bottoms, random),
    build: pick(shoppers.builds, random),
    hair: weighted(shoppers.hairWeights, random).id,
    accessory: weighted(shoppers.accessoryWeights.filter((item) => profile.accessories.includes(item.id)), random).id,
    pattern: pick(profile.patterns, random),
    wear: weighted(shoppers.wearWeights, random).id,
    accessoryColor: pick(shoppers.colors.accessory, random),
    face: pick(shoppers.faceProfiles, random).id,
  };
}
