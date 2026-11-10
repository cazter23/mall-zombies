import { gunSkin } from '../config/skins.js';
import { gunPaletteKeys, gunPaletteDefaults } from '../config/gunPalettes.js';

/** Resolve the model's colour keys from its defaults and a gun-specific base coat. */
export function resolveGunColors(def, skinId) {
  const vm = def.viewmodel;
  const palette = gunSkin(def.id, skinId)?.palette ?? {};
  const colors = {
    bodyColor: palette.body ?? vm.bodyColor,
    darkColor: palette.dark ?? vm.darkColor ?? vm.gripColor,
    metalColor: palette.metal ?? vm.metalColor,
    gripColor: palette.grip ?? vm.gripColor ?? vm.darkColor,
    accentColor: palette.accent ?? vm.accentColor,
    sightColor: palette.sight ?? vm.sightColor,
  };
  for (const [key, role] of Object.entries(gunPaletteKeys[def.id] ?? {})) {
    colors[key] = palette[role] ?? vm[key] ?? gunPaletteDefaults[def.id]?.[key];
  }
  return colors;
}
