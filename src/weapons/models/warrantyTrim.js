// An Extended Warranty on a gun, in the open where you can see it from behind the gun (config/gunStyle.js has every size):
//   the BARREL COLLAR: rings round the barrel that get chunkier with the tier (one blue ring, two purple, then a wide gold block with two dark stripes
//   and a gem), with a small gold stud on top for each Warranty Renewal; and the TAG: a card on a string hanging off the grip heel, swinging as you move.
// Everything is built up front and hidden; show() switches it on. The collar goes on the gun's `barrel` mount and the tag on its `grip` mount, so
// it works for every gun that has them (weapons/models/*.js mounts), and it sits BEHIND the muzzle so the Extended Nozzle and Sawn-Off still show.
import * as THREE from 'three';
import { upgrades } from '../../config/upgrades.js';
import { gunStyle } from '../../config/gunStyle.js';

const materials = new Map();
function material(color, { basic = false, metal = false } = {}) {
  const key = `${color}|${basic}|${metal}`;
  if (!materials.has(key)) {
    materials.set(key, basic
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.3 : 0.55, metalness: metal ? 0.7 : 0.15, flatShading: true }));
  }
  return materials.get(key);
}

/** A hollow rectangle of four bars, `w` x `h` outside, `depth` long (along Z), centred on the origin. */
function ring(group, w, h, depth, bar, mat, z = 0) {
  const parts = [[w, bar, 0, (h - bar) / 2], [w, bar, 0, -(h - bar) / 2], [bar, h - 2 * bar, (w - bar) / 2, 0], [bar, h - 2 * bar, -(w - bar) / 2, 0]];
  for (const [pw, ph, x, y] of parts) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, depth), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
}

/** The metal a tier is made of (config/gunStyle.js finish): its own material, so a shimmering Platinum never changes another gun's. */
function metalMaterial(tierId, color) {
  const f = gunStyle.finish[tierId] ?? gunStyle.finish.deluxe;
  const paint = new THREE.MeshStandardMaterial({ color, roughness: f.rough, metalness: f.metal, flatShading: true });
  paint.emissive.setHex(color).multiplyScalar(f.sheen); // (no reflections here, so the metal gives off a little of its own colour)
  return paint;
}

export function createWarrantyTrim(gun, mounts = {}) {
  const style = gunStyle;
  const shimmers = []; // the Platinum materials, which drift between pearl tints (animate())
  const shimmerOf = (tierId, materialToShimmer, emissive = true) => { if (gunStyle.finish[tierId]?.shimmer) shimmers.push({ tierId, material: materialToShimmer, emissive }); return materialToShimmer; };
  const c = style.collar;
  const barrel = mounts.barrel, grip = mounts.grip;
  const collars = new Map(); // tier id -> its group
  const studs = [];
  let collarTop = 0;

  if (barrel) {
    const w = (barrel.size?.w ?? (barrel.radius ?? 0.02) * 2) + c.margin * 2;
    const h = (barrel.size?.h ?? (barrel.radius ?? 0.02) * 2) + c.margin * 2;
    collarTop = h / 2;
    const parent = barrel.parent ?? gun;
    const holder = new THREE.Group();
    holder.name = 'warrantyCollar';
    holder.position.set(barrel.position[0], barrel.position[1], barrel.position[2] + c.back);
    for (const tier of upgrades.tiers) {
      const spec = c.tiers[tier.id];
      if (!spec) continue;
      const group = new THREE.Group();
      group.visible = false;
      const paint = shimmerOf(tier.id, metalMaterial(tier.id, tier.color));
      const rings = spec.rings ?? 1;
      for (let i = 0; i < rings; i++) ring(group, w, h, spec.ringDepth, c.bar, paint, i * (spec.ringDepth + (spec.gap ?? 0)));
      if (spec.stripes) {
        for (let i = 0; i < spec.stripes; i++) {
          const z = (i - (spec.stripes - 1) / 2) * spec.ringDepth * 0.62;
          ring(group, w + 0.002, h + 0.002, 0.004, c.bar + 0.001, material(c.stripe), z);
        }
      }
      if (spec.gem) {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(c.gem, 0), material(0x7df9ff, { basic: true }));
        gem.name = 'warrantyGem';
        gem.position.set(0, h / 2 + c.gem * 0.5, 0);
        group.add(gem);
      }
      holder.add(group);
      collars.set(tier.id, group);
    }
    // Renewal studs: small gold blocks on top of the collar, one per renewal.
    const studMaterial = metalMaterial('renewal', upgrades.renewals.color);
    for (let i = 0; i < upgrades.renewals.max; i++) {
      const stud = new THREE.Mesh(new THREE.BoxGeometry(c.stud.size, c.stud.size, c.stud.size * 1.6), studMaterial);
      stud.position.set((i - (upgrades.renewals.max - 1) / 2) * c.stud.spacing, collarTop + c.stud.size / 2 + (c.gem + 0.012), -0.004);
      stud.visible = false;
      studs.push(stud);
      holder.add(stud);
    }
    parent.add(holder);
  }

  // The tag: a pivot at the grip heel, a string, a card.
  const t = style.tag;
  const pivot = new THREE.Group();
  pivot.name = 'warrantyTag';
  pivot.visible = false;
  const cardMaterials = new Map(upgrades.tiers.map((t) => [t.id, shimmerOf(t.id, new THREE.MeshBasicMaterial({ color: t.color }), false)]));
  const card = new THREE.Mesh(new THREE.BoxGeometry(t.size[0], t.size[1], t.thickness), material(0xffffff, { basic: true }));
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.0016, t.string, 0.0016), material(t.stringColor, { basic: true }));
  string.position.y = -t.string / 2;
  card.position.y = -t.string - t.size[1] / 2 + 0.004;
  // A dark hole punched near the top and a bar of print across the middle, so it reads as a card from a distance.
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, t.thickness + 0.001), material(c.stripe, { basic: true }));
  hole.position.set(0, t.size[1] / 2 - 0.007, 0);
  const print = new THREE.Mesh(new THREE.BoxGeometry(t.size[0] * 0.7, 0.005, t.thickness + 0.001), material(c.stripe, { basic: true }));
  print.position.set(0, -0.004, 0);
  card.add(hole, print);
  pivot.add(string, card);
  if (grip) {
    pivot.position.set(grip.position[0], grip.position[1] - (grip.size?.h ?? 0.12) / 2 + 0.012, grip.position[2] + t.back);
    gun.add(pivot);
  }

  return {
    /** tier: a tier id; renewals: how many Warranty Renewals. */
    show(tier = 'standard', renewals = 0) {
      for (const [id, group] of collars) group.visible = id === tier;
      studs.forEach((stud, i) => { stud.visible = tier === 'platinum' && i < renewals; });
      const cfg = upgrades.tiers.find((x) => x.id === tier);
      pivot.visible = !!grip && !!cfg && tier !== 'standard';
      if (!pivot.visible) return;
      card.material = cardMaterials.get(tier);
      pivot.scale.setScalar(tier === 'platinum' ? t.platinumScale : 1);
    },
    /** The tag swings, and Platinum shimmers. `time` in seconds. */
    animate(time) {
      for (const { tierId, material: m, emissive } of shimmers) {
        const { speed, hue, saturation, lightness } = gunStyle.finish[tierId].shimmer;
        const wave = (Math.sin(time * speed) + 1) / 2;
        m.color.setHSL(hue[0] + (hue[1] - hue[0]) * wave, saturation, lightness);
        if (emissive) m.emissive.copy(m.color).multiplyScalar(gunStyle.finish[tierId].sheen);
      }
      if (!pivot.visible) return;
      pivot.rotation.z = Math.sin(time * t.speed) * t.sway;
      pivot.rotation.x = Math.cos(time * t.speed * 0.7) * t.sway * 0.5;
    },
  };
}
