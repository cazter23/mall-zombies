// =============================================================================
// WEAPON MODEL REGISTRY
// First-person models by name (weapons.<id>.viewmodel.model in config/weapons.js).
// A new gun = a new file here that exports a builder, plus one line below.
//
// A builder takes the weapon's config entry and returns:
//   root              THREE.Object3D: the gun + hands, pointing down -Z, origin = where it's held
//   muzzle            Object3D on the gun where tracers and the muzzle flash start
//   animate(state)    gun-specific animation every frame (trigger, hands during reload...);
//                     state = { sinceFire, reloadProgress, reloadWeight }
//   leftHandVisible   setter: hide the support hand (the box cutter arm replaces it)
// =============================================================================

import { buildStapleGunModel } from './stapleGun.js';

const builders = {
  stapleGun: buildStapleGunModel,
};

export function buildWeaponModel(def) {
  const build = builders[def.viewmodel.model];
  if (!build) throw new Error(`Unknown weapon model "${def.viewmodel.model}" (weapons.${def.id}.viewmodel.model)`);
  return build(def);
}
