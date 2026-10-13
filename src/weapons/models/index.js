// =============================================================================
// WEAPON MODEL REGISTRY
// First-person models by name (weapons.<id>.viewmodel.model in config/weapons.js).
// A new gun = a new file here that exports a model builder and a display builder,
// plus one line below.
//
// A model builder takes the weapon's config entry and returns:
//   root              THREE.Object3D: the gun + hands, pointing down -Z, origin = where it's held
//   muzzle            Object3D on the gun where tracers and the muzzle flash start
//   animate(state)    gun-specific animation every frame (trigger, hands during reload...);
//                     state = { sinceFire, reloadProgress, reloadWeight }
//   leftHandVisible   setter: hide the support hand (the box cutter arm replaces it)
// A display builder returns just the gun (no hands), for the wall-buy display.
// =============================================================================

import { buildStapleGunModel, buildStapleGunDisplay } from './stapleGun.js';
import { buildPriceGunModel, buildPriceGunDisplay } from './priceGun.js';

const builders = {
  stapleGun: { model: buildStapleGunModel, display: buildStapleGunDisplay },
  priceGun: { model: buildPriceGunModel, display: buildPriceGunDisplay },
};

function builderFor(def) {
  const b = builders[def.viewmodel.model];
  if (!b) throw new Error(`Unknown weapon model "${def.viewmodel.model}" (weapons.${def.id}.viewmodel.model)`);
  return b;
}

export function buildWeaponModel(def) {
  return builderFor(def).model(def);
}

export function buildWeaponDisplay(def) {
  return builderFor(def).display(def);
}
