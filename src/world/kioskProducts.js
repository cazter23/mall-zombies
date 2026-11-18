// =============================================================================
// KIOSK KEVIN'S PRODUCTS AS MODELS (docs/archive/kiosk-kevin-plan.md phase 8; colours: config/kiosk.js products' `look`).
// One place builds every product's little low-poly model, so the thing on Kevin's counter is the thing you throw:
//   buildProductModel(id, mat)    ONE item, centred on its middle (how it flies): fx/throwableView.js
//                                 `userData.base` = how far its bottom sits below the origin; a Sentry's turning head is
//                                 `userData.head` (its origin is on the floor)
//   buildProductDisplay(id, mat)  how it stands on the counter (maps/mall/kioskCart.js): origin on the counter top, its front
//                                 towards +z. Three bottles in a row, the cake on a doily, a mini display stand, a roll of
//                                 Bubble Wrap with a sheet pulled out, the air horn on its can, a glitter card standing open.
// `mat(color, options)` makes (or reuses) a material: the map's kit.mat, or the view's own cache.
// Geometry is made per call (the counts are tiny); whoever owns the group disposes it. Both are baked (world/bakeParts.js):
// one draw per material kind, the Sentry's head and spinner kept apart so they can turn.
// =============================================================================

import * as THREE from 'three';
import { kiosk } from '../config/kiosk.js';
import { bakeParts } from './bakeParts.js';

const { sodaBomb, sparklerCake, glitterBomb, sentry } = kiosk.products;
const wrapLook = kiosk.bubbleWrap.look;
const hornLook = kiosk.products.airHorn.look;

const part = (geometry, material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
};

// --- The single items ---------------------------------------------------------------------------------------------------

function bottle(mat) {
  const g = new THREE.Group();
  const glass = mat(sodaBomb.look.bottle, { roughness: 0.25, transparent: true, opacity: 0.88 });
  g.add(
    part(new THREE.CylinderGeometry(0.075, 0.085, 0.24, 8), glass),
    part(new THREE.CylinderGeometry(0.087, 0.087, 0.09, 8, 1, true), mat(sodaBomb.look.label, { roughness: 0.6, side: THREE.DoubleSide })),
    part(new THREE.CylinderGeometry(0.025, 0.07, 0.09, 8), glass, 0, 0.165),
    part(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 8), mat(sodaBomb.look.cap, { roughness: 0.5 }), 0, 0.225),
  );
  g.userData.base = 0.12;
  return g;
}

function cake(mat) {
  const g = new THREE.Group();
  g.add(
    part(new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10), mat(sparklerCake.look.cake, { roughness: 0.8 })),
    part(new THREE.CylinderGeometry(0.135, 0.135, 0.025, 10), mat(sparklerCake.look.icing, { roughness: 0.5 }), 0, 0.05),
  );
  const wick = mat(sparklerCake.look.wick, { roughness: 0.4, metalness: 0.5 });
  const wickGeometry = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4);
  for (let i = 0; i < 3; i++) g.add(part(wickGeometry, wick, Math.cos(i * 2.1) * 0.06, 0.12, Math.sin(i * 2.1) * 0.06));
  g.userData.base = 0.045;
  return g;
}

function card(mat) {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.17, 0.008, 0.12), mat(glitterBomb.look.envelope, { roughness: 0.4, metalness: 0.3 })));
  g.userData.base = 0.004;
  return g;
}

// The SPIN-O-MATIC: Kevin's own display stand (a weighted base, a pole) with a staple gun taped on top and his sign on it.
// Origin on the floor; the head (gun + sign) turns.
function stand(mat) {
  const g = new THREE.Group();
  const metal = mat(sentry.look.stand, { roughness: 0.5, metalness: 0.4 });
  g.add(
    part(new THREE.CylinderGeometry(0.17, 0.19, 0.04, 10), mat(sentry.look.base, { roughness: 0.6 }), 0, 0.02),
    part(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6), metal, 0, 0.45),
  );
  const head = new THREE.Group();
  head.userData.keep = true;
  head.position.y = sentry.turret.muzzleHeight;
  const gun = part(new THREE.BoxGeometry(0.08, 0.11, 0.28), mat(sentry.look.gun, { roughness: 0.45, metalness: 0.3 }));
  const tape = part(new THREE.BoxGeometry(0.1, 0.03, 0.06), mat(sentry.look.tape, { roughness: 0.9 }), 0, -0.04, -0.02);
  const sign = part(new THREE.BoxGeometry(0.2, 0.08, 0.01), mat(sentry.look.sign, { roughness: 0.6 }), 0, 0.1, -0.06);
  // A little spinner on top (the "SPIN-O" of it): turns fast whatever the head does (fx/throwableView.js).
  const spinner = new THREE.Group();
  spinner.userData.keep = true;
  spinner.position.y = 0.17;
  spinner.add(part(new THREE.BoxGeometry(0.22, 0.012, 0.035), mat(sentry.look.sign, { roughness: 0.6 })),
    part(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 6), metal, 0, -0.025));
  head.add(gun, tape, sign, spinner);
  bakeParts(spinner);
  bakeParts(head);
  g.add(head);
  g.userData.head = head;
  g.userData.spinner = spinner;
  g.userData.base = 0;
  return g;
}

const single = { cake, card, sentry: stand, bottle };

/** One product as it flies (see the header). Unknown ids get the bottle. */
export function buildProductModel(id, mat) {
  return bakeParts((single[kiosk.products[id]?.look?.model] ?? bottle)(mat));
}

// --- On the counter -----------------------------------------------------------------------------------------------------

const onCounter = (model, x = 0, z = 0) => {
  model.position.set(x, model.userData.base, z);
  return model;
};

function bubbleWrapDisplay(mat) {
  const g = new THREE.Group();
  const plastic = mat(wrapLook.sheet, { roughness: 0.3, transparent: true, opacity: 0.8 });
  const roll = part(new THREE.CylinderGeometry(0.075, 0.075, 0.34, 10), plastic, 0, 0.075, -0.06);
  roll.rotation.z = Math.PI / 2;
  const core = part(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), mat(wrapLook.core, { roughness: 0.9 }), 0, 0.075, -0.06);
  core.rotation.z = Math.PI / 2;
  // The sheet pulled off the roll and over the counter's front, with a few big bubbles on it.
  const sheet = part(new THREE.BoxGeometry(0.3, 0.006, 0.16), plastic, 0, 0.004, 0.08);
  g.add(roll, core, sheet);
  const bubble = new THREE.IcosahedronGeometry(0.022, 0);
  const shine = mat(wrapLook.bubble, { roughness: 0.15, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 6; i++) g.add(part(bubble, shine, -0.1 + (i % 3) * 0.1, 0.018, 0.04 + Math.floor(i / 3) * 0.07));
  return g;
}

function airHornDisplay(mat) {
  const g = new THREE.Group();
  // The can, standing, with the horn on top and pointing out at you (the way it's sold).
  g.add(part(new THREE.CylinderGeometry(0.045, 0.045, 0.15, 8), mat(hornLook.can, { roughness: 0.4, metalness: 0.3 }), 0, 0.075));
  g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.035, 8), mat(hornLook.valve, { roughness: 0.5 }), 0, 0.17));
  const horn = part(new THREE.CylinderGeometry(0.065, 0.016, 0.16, 8, 1, true), mat(hornLook.horn, { roughness: 0.4, side: THREE.DoubleSide }),
    0, 0.21, 0.06);
  horn.rotation.x = Math.PI / 2 - 0.35;
  g.add(horn);
  return g;
}

function glitterDisplay(mat) {
  const g = new THREE.Group();
  // A greeting card standing open like a tent, on its envelope.
  const front = mat(glitterBomb.look.card, { roughness: 0.6 });
  const leafGeometry = new THREE.BoxGeometry(0.16, 0.13, 0.006);
  const left = part(leafGeometry, front, -0.06, 0.06, 0);
  left.rotation.y = 0.55;
  const right = part(leafGeometry, mat(glitterBomb.look.envelope, { roughness: 0.4, metalness: 0.3 }), 0.06, 0.06, 0);
  right.rotation.y = -0.55;
  const envelope = part(new THREE.BoxGeometry(0.2, 0.006, 0.14), mat(glitterBomb.look.envelope, { roughness: 0.4, metalness: 0.3 }), 0, 0.003, 0.02);
  g.add(left, right, envelope);
  return g;
}

/** A product as it stands on Kevin's counter (see the header). */
export function buildProductDisplay(id, mat) {
  const g = new THREE.Group();
  g.name = `kevin_display_${id}`;
  if (id === 'bubbleWrap') g.add(bubbleWrapDisplay(mat));
  else if (id === 'airHorn') g.add(airHornDisplay(mat));
  else if (id === 'glitterBomb') g.add(glitterDisplay(mat));
  else if (id === 'sodaBomb') for (let i = -1; i <= 1; i++) g.add(onCounter(bottle(mat), i * 0.19, i === 0 ? -0.03 : 0.02));
  else if (id === 'sparklerCake') g.add(
    part(new THREE.CylinderGeometry(0.17, 0.17, 0.008, 12), mat(sparklerCake.look.doily, { roughness: 0.9 }), 0, 0.004),
    onCounter(cake(mat), 0, 0),
  );
  else if (id === 'sentry') {
    const mini = onCounter(stand(mat));
    mini.scale.setScalar(0.42); // (the demo unit: a little one)
    g.add(mini);
    g.userData.spinner = mini.userData.spinner;
  }
  return bakeParts(g);
}
