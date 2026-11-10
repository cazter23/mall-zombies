import { gunSkin } from '../config/skins.js';

/** Resolve the model's colour keys from its defaults and a gun-specific base coat. */
export function resolveGunColors(def, skinId) {
  const vm = def.viewmodel;
  const palette = gunSkin(def.id, skinId)?.palette ?? {};
  return {
    bodyColor: palette.body ?? vm.bodyColor,
    darkColor: palette.dark ?? vm.darkColor,
    metalColor: palette.metal ?? vm.metalColor,
    gripColor: palette.grip ?? vm.gripColor ?? vm.darkColor,
    accentColor: palette.accent ?? vm.accentColor,
    sightColor: palette.sight ?? vm.sightColor,
  };
}
