// =============================================================================
// SHOPPER MODEL: dresses the shared zombie skeleton (zombieModel.js) as one Shopper look (shopperAppearance.js): the
// legs and shoes, the torso, sleeves, the thing in the right hand, hair, hat, glasses and extras, all from the parts in
// config/shoppers.js. Every piece is built with a PAINT (shopperBake.js), not a material; zombieModel bakes the lot into
// one shared vertex-coloured mesh per bone afterwards.
//
//   const dress = createShopperDresser(look, { skin, eyes, shape, geometries, block })
//   dress.leg(hip, side) / dress.torso(upper) / dress.upperArm(shoulder, side) / dress.forearm(elbow, side) / dress.head(neck)
//   dress.parts(bone, parts)     any other part list (the face profile)
//   dress.hasBag                 a shopping bag in hand (only these can drop a Limited Edition: limitedEditions.js)
//   dress.summary                what it's wearing (model.root.userData.appearance; tests and the debug panel read it)
//
// The skeleton, hitboxes, animation and the head's position never change with the look.
// =============================================================================

import * as THREE from 'three';
import { shoppers, colors } from '../config/shoppers.js';
import { paint } from './shopperBake.js';

const PALETTE_ROLES = new Set(['top', 'accent', 'inner', 'pants', 'shoes']);
const PRINTABLE_TOPS = new Set(['tee', 'polo', 'raglan']); // (the archetype's pattern goes on these only)

// Skirts flare by how much they taper; one shape per taper, shared by every Shopper (never disposed, like the boxes).
const skirtShapes = new Map();
function skirtGeometry(taper) {
  if (skirtShapes.has(taper)) return skirtShapes.get(taper);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) pos.setXYZ(i, pos.getX(i) * taper, pos.getY(i), pos.getZ(i) * taper);
  }
  geometry.computeVertexNormals();
  skirtShapes.set(taper, geometry);
  return geometry;
}

export function createShopperDresser(look, { skin, eyes, shape: S, geometries, block }) {
  const top = shoppers.tops[look.top];
  const bottom = shoppers.bottoms[look.bottom];
  const width = shoppers.builds[look.build].width;
  const shapes = {
    box: geometries.unitBox, jaw: geometries.jawBox, cranium: geometries.craniumBox, limbY: geometries.limbBoxY,
    limbZ: geometries.limbBoxZ, torso: geometries.torsoBox, shoe: geometries.shoeBox, hand: geometries.handBox,
  };

  function role(name, slot) {
    if (PALETTE_ROLES.has(name)) return paint(look.palette[name]);
    if (name === 'torso') return role(top.torsoRole ?? 'top');
    if (name === 'skin') return paint(skin);
    if (name === 'hair') return paint(look.hairColor);
    if (name === 'eyes') return paint(eyes);
    if (name === 'item') return paint(look.colors[slot] ?? look.palette.accent);
    if (!(name in colors)) throw new Error(`config/shoppers.js: no colour or role named '${name}'`);
    return paint(colors[name]);
  }

  // `width`: the build (torso and leg parts widen with it); `side`: -1 on the left limb (mirror parts flip); `forward`:
  // pushes parts out in front (a stain over a jacket's panels); `slot`: whose rolled colour `item` means.
  function parts(parent, list = [], { scale = 1, side = 1, forward = 0, slot = null } = {}) {
    for (const part of list) {
      const [w, h, d] = part.size;
      const [x, y, z] = part.position;
      const flip = part.mirror && side < 0 ? -1 : 1;
      const mesh = block(role(part.role, slot), w * scale, h, d, x * scale * flip, y, z - forward, parent, shapes[part.geo ?? 'box']);
      mesh.rotation.set(part.rx ?? 0, (part.ry ?? 0) * flip, part.rz * flip);
    }
  }

  const torn = (side) => look.wear === 'tornSleeve' && side < 0;
  const sleeveRole = top.sleeveRole ?? 'top';
  const sleevePadding = top.sleevePadding ?? 0.02;

  return {
    hasBag: look.held === 'shoppingBag',
    summary: {
      archetype: look.archetype, presentation: look.presentation, palette: look.palette.id, top: look.top, bottom: look.bottom, shoes: look.shoes,
      build: look.build, hair: look.hair, headwear: look.headwear, eyewear: look.eyewear, held: look.held,
      extra: look.extra, wear: look.wear, face: look.face,
    },
    parts,

    leg(hip, side) {
      const legWidth = S.legWidth * width;
      if (bottom.legs === 'pants') block(role('pants'), legWidth, S.hipY, S.legWidth + 0.02, 0, -S.hipY / 2, 0, hip, shapes.limbY);
      else {
        block(role('skin'), legWidth, S.hipY, S.legWidth + 0.02, 0, -S.hipY / 2, 0, hip, shapes.limbY);
        if (bottom.legs === 'shorts') block(role('pants'), legWidth + shoppers.clothingPadding, shoppers.shortsLength,
          S.legWidth + 0.02 + shoppers.clothingPadding, 0, -shoppers.shortsLength / 2, 0, hip, shapes.limbY);
      }
      parts(hip, bottom.leg, { scale: width, side });
      const barefoot = look.wear === 'missingShoe' && side < 0;
      block(role(barefoot ? 'skin' : 'shoes'), S.legWidth + 0.01, 0.085, 0.26, 0, -S.hipY + 0.042, -0.04, hip, shapes.shoe);
      if (!barefoot) parts(hip, shoppers.shoes[look.shoes], { side });
    },

    torso(upper) {
      block(role('torso'), S.torso.w * width, S.torso.h, S.torso.d, 0, S.torso.h / 2, 0, upper, shapes.torso);
      // Shoulder caps at the top of the torso bridge into the upper arms.
      block(role(top.shoulderRole ?? 'top'), (S.torso.w + 0.04) * width, 0.08, S.torso.d - 0.02, 0, S.torso.h - 0.035, 0, upper, shapes.jaw);
      parts(upper, top.parts, { scale: width });
      if (PRINTABLE_TOPS.has(look.top)) parts(upper, shoppers.patterns[look.pattern], { scale: width });
      if (look.wear === 'stain') parts(upper, shoppers.stain, { scale: width, forward: top.stainForward ?? 0 });
      parts(upper, bottom.waist, { scale: width });
      if (bottom.skirt) {
        const skirt = bottom.skirt;
        const mesh = new THREE.Mesh(skirtGeometry(skirt.taper), role('pants'));
        mesh.scale.set(skirt.width * width, skirt.height, skirt.depth);
        mesh.position.y = -skirt.height / 2;
        upper.add(mesh);
      }
      parts(upper, shoppers.extras[look.extra].torso, { scale: width, slot: 'extra' });
    },

    upperArm(shoulder, side) {
      const t = S.armThickness;
      block(role('skin'), t, t, S.sleeve, 0, 0, -S.sleeve / 2, shoulder, shapes.limbZ);
      const length = torn(side) ? shoppers.tornSleeveLength : shoppers.shortSleeveLength;
      block(role(sleeveRole), t + sleevePadding, t + sleevePadding, length, 0, 0, -length / 2, shoulder, shapes.limbZ);
      if (!torn(side)) parts(shoulder, top.arm, { side });
    },

    forearm(elbow, side) {
      const t = S.armThickness;
      if (top.sleeve === 'long') {
        const length = torn(side) ? shoppers.tornLongSleeveLength : shoppers.longSleeveLength;
        const pad = sleevePadding - 0.008;
        block(role(sleeveRole), t + pad, t + pad, length, 0, 0, -length / 2, elbow, shapes.limbZ);
        if (!torn(side)) parts(elbow, top.forearm, { side });
      }
      if (side > 0) parts(elbow, shoppers.held[look.held], { slot: 'held' });
    },

    head(neck) {
      parts(neck, shoppers.hair[look.hair]);
      parts(neck, shoppers.headwear[look.headwear], { slot: 'headwear' });
      parts(neck, shoppers.eyewear[look.eyewear], { slot: 'eyewear' });
      parts(neck, shoppers.extras[look.extra].head, { slot: 'extra' });
    },
  };
}
