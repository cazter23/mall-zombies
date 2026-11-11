// =============================================================================
// WEAPON MODEL REGISTRY
// First-person models by name (weapons.<id>.viewmodel.model in config/weapons.js).
// A new gun = a new file here that exports a model builder and a display builder,
// plus one line below.
//
// A model builder takes the weapon's config entry and optional skin id and returns:
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
import { buildLeafBlowerModel, buildLeafBlowerDisplay } from './leafBlower.js';
import { buildTennisBallLauncherModel, buildTennisBallLauncherDisplay } from './tennisBallLauncher.js';
import { buildReturnToSenderModel, buildReturnToSenderDisplay } from './returnToSender.js';
import { resolveGunColors } from '../skinPalette.js';
import { applySkinPattern } from './skinPattern.js';

const builders = {
  rivetRifle: { model: buildRivetRifleModel, display: buildRivetRifleDisplay },
  coilNailer: { model: buildCoilNailerModel, display: buildCoilNailerDisplay },
  barcodeScanner: { model: buildBarcodeScannerModel, display: buildBarcodeScannerDisplay },
  foamDartBlaster: { model: buildFoamDartBlasterModel, display: buildFoamDartBlasterDisplay },
  confettiCannon: { model: buildConfettiCannonModel, display: buildConfettiCannonDisplay },
  leafBlower: { model: buildLeafBlowerModel, display: buildLeafBlowerDisplay },
  tennisBallLauncher: { model: buildTennisBallLauncherModel, display: buildTennisBallLauncherDisplay },
  returnToSender: { model: buildReturnToSenderModel, display: buildReturnToSenderDisplay },
  stapleGun: { model: buildStapleGunModel, display: buildStapleGunDisplay },
  priceGun: { model: buildPriceGunModel, display: buildPriceGunDisplay },
  nailGun: { model: buildNailGunModel, display: buildNailGunDisplay },
};

function builderFor(def) {
  const b = builders[def.viewmodel.model];
  if (!b) throw new Error(`Unknown weapon model "${def.viewmodel.model}" (weapons.${def.id}.viewmodel.model)`);
  return b;
}

// A slot 2 skin's printed pattern goes on after the build (models/skinPattern.js); other skins and the default are untouched.
export function buildWeaponModel(def, skinId) {
  const model = builderFor(def).model(def, skinId);
  applySkinPattern(model.root, def, skinId);
  return model;
}

export function buildWeaponDisplay(def, skinId) {
  // Display builders already resolve their defaults. Supply a copy of the chosen
  // colour set only for the locker and YOUR conveyor gun; world displays omit it.
  const painted = skinId ? { ...def, viewmodel: { ...def.viewmodel, ...resolveGunColors(def, skinId) } } : def;
  return applySkinPattern(builderFor(def).display(painted), def, skinId);
}
