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
//                     state = { sinceFire, reloadProgress, reloadWeight, chargeProgress, time, loaded } (time: a running clock, for a skin's treatment;
//                     loaded: the magazine holds a round, false once the last is fired)
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
import { buildStargazerModel, buildStargazerDisplay } from './stargazer.js';
import { buildBottleRocketModel, buildBottleRocketDisplay } from './bottleRocket.js';
import { buildBalloonLauncherModel, buildBalloonLauncherDisplay } from './balloonLauncher.js';
import { resolveGunColors } from '../skinPalette.js';
import { applySkinPattern } from './skinPattern.js';
import { applySkinTreatment } from './skinTreatments.js';
import { applySkinBadge } from './skinBadge.js';
import { gunSkin } from '../../config/skins.js';

const builders = {
  rivetRifle: { model: buildRivetRifleModel, display: buildRivetRifleDisplay },
  coilNailer: { model: buildCoilNailerModel, display: buildCoilNailerDisplay },
  barcodeScanner: { model: buildBarcodeScannerModel, display: buildBarcodeScannerDisplay },
  foamDartBlaster: { model: buildFoamDartBlasterModel, display: buildFoamDartBlasterDisplay },
  confettiCannon: { model: buildConfettiCannonModel, display: buildConfettiCannonDisplay },
  leafBlower: { model: buildLeafBlowerModel, display: buildLeafBlowerDisplay },
  tennisBallLauncher: { model: buildTennisBallLauncherModel, display: buildTennisBallLauncherDisplay },
  returnToSender: { model: buildReturnToSenderModel, display: buildReturnToSenderDisplay },
  stargazer: { model: buildStargazerModel, display: buildStargazerDisplay },
  bottleRocket: { model: buildBottleRocketModel, display: buildBottleRocketDisplay },
  balloonLauncher: { model: buildBalloonLauncherModel, display: buildBalloonLauncherDisplay },
  stapleGun: { model: buildStapleGunModel, display: buildStapleGunDisplay },
  priceGun: { model: buildPriceGunModel, display: buildPriceGunDisplay },
  nailGun: { model: buildNailGunModel, display: buildNailGunDisplay },
};

function builderFor(def) {
  const b = builders[def.viewmodel.model];
  if (!b) throw new Error(`Unknown weapon model "${def.viewmodel.model}" (weapons.${def.id}.viewmodel.model)`);
  return b;
}

// A slot 2 skin's printed pattern, a slot 3 skin's treatment and the Employee of the Month badge go on after the build (models/skinPattern.js,
// models/skinTreatments.js, models/skinBadge.js); other skins and the default are untouched. A treatment runs from the model's own animate().
export function buildWeaponModel(def, skinId) {
  const model = builderFor(def).model(def, skinId);
  applySkinPattern(model.root, def, skinId, model.mounts);
  const treatment = applySkinTreatment(model.root, def, skinId);
  applySkinBadge(model.root, def, skinId, model.mounts);
  if (treatment) {
    const animate = model.animate;
    model.animate = state => { animate?.call(model, state); treatment.animate(state?.time ?? 0); };
  }
  return model;
}

export function buildWeaponDisplay(def, skinId) {
  // Display builders already resolve their defaults. Supply a copy of the chosen
  // colour set only for the locker and YOUR conveyor gun; world displays omit it.
  const painted = skinId ? { ...def, viewmodel: { ...def.viewmodel, ...resolveGunColors(def, skinId) } } : def;
  const display = builderFor(def).display(painted);
  if (gunSkin(def.id, skinId)?.pattern) applySkinPattern(display, def, skinId, mountsOf(def));
  applySkinTreatment(display, def, skinId); // (display.userData.skinTreatment: the locker preview animates it; elsewhere it holds still)
  if (gunSkin(def.id, skinId)?.badge) applySkinBadge(display, def, skinId, mountsOf(def));
  return display;
}

// A display has no mounts of its own; a printed one borrows the model's (where its keep-outs go). One default model per gun, built once.
const mountCache = new Map();
function mountsOf(def) {
  if (!mountCache.has(def.id)) mountCache.set(def.id, builderFor(def).model(def).mounts ?? {});
  return mountCache.get(def.id);
}
