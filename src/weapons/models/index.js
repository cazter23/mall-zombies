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
//   mounts            where upgrade parts go: barrel / top / side / grip / magazine / sticker (upgradeParts.js)
// A display builder returns just the gun (no hands), for the wall-buy display.
// =============================================================================

import { buildStapleGunModel, buildStapleGunDisplay } from './stapleGun.js';
import { buildPriceGunModel, buildPriceGunDisplay } from './priceGun.js';
import { buildNailGunModel, buildNailGunDisplay } from './nailGun.js';
import { buildRivetRifleModel, buildRivetRifleDisplay } from './rivetRifle.js';
import { buildCoilNailerModel, buildCoilNailerDisplay } from './coilNailer.js';
import { buildBarcodeScannerModel, buildBarcodeScannerDisplay } from './barcodeScanner.js';

import { buildFoamDartBlasterModel, buildFoamDartBlasterDisplay } from './foamDartBlaster.js';
import { buildConfettiCannonModel, buildConfettiCannonDisplay } from './confettiCannon.js';

const builders = {
  rivetRifle: { model: buildRivetRifleModel, display: buildRivetRifleDisplay },
  coilNailer: { model: buildCoilNailerModel, display: buildCoilNailerDisplay },
  barcodeScanner: { model: buildBarcodeScannerModel, display: buildBarcodeScannerDisplay },
  foamDartBlaster: { model: buildFoamDartBlasterModel, display: buildFoamDartBlasterDisplay },
  confettiCannon: { model: buildConfettiCannonModel, display: buildConfettiCannonDisplay },
  stapleGun: { model: buildStapleGunModel, display: buildStapleGunDisplay },
  priceGun: { model: buildPriceGunModel, display: buildPriceGunDisplay },
  nailGun: { model: buildNailGunModel, display: buildNailGunDisplay },
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
