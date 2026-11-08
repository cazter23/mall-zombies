// =============================================================================
// LOOK KIT: the shared tools of the visual overhaul ("Grand Opening, Forever"), so every area of the mall is dressed the
// same way: pastel wall bands (wainscot + chrome rail + a colour band), neon (signs, slogans, trim), painted light pools
// (soft additive glows, no real lights), the corporate-cheer posters, and clutter. ONE kit for the whole map: it follows
// the Graphics settings for everything it made (look.runtime.neonGlow, look.runtime.clutter, atmosphere.ambient.enabled
// for flicker) and ticks every neon. Decoration only: no colliders. Neon, pools and clutter live in groups flagged
// userData.dynamic, so static batching (world/staticBatch.js) leaves them alone and the settings can switch them.
//
//   const looks = createLookKit({ kit, colliders })
//   looks.bands({ along, from, to, wallAt, facing, gaps, colors: { wainscot, rail, band }, heights }) round openings
//   looks.neon(name)            a neon builder (world/neon.js) for one area
//   looks.pool(x, y, z, w, h, facing, color, opacity, { wash })   facing: 1 | -1 | 'x+' | 'x-' | 'floor'
//   looks.poster(kind, options, x, y, z, w, h, facing)            world/posterTextures.js, facing as for signs
//   looks.clutter({ name, area, kinds, seed, perSquareMeter, keepClear })
//   looks.update(dt), looks.reset(), looks.parts (parts.neonsByName: each area's neon builder)
// =============================================================================

import * as THREE from 'three';
import { createNeon } from '../../world/neon.js';
import { createDecorKit } from '../../world/decor.js';
import { scatter } from '../../world/scatter.js';
import { makeSoftFootprint } from '../../world/atmosphereTextures.js';
import { makePosterTexture } from '../../world/posterTextures.js';
import { look } from '../../config/look.js';
import { atmosphere } from '../../config/environment.js';

const facingRotation = (mesh, facing) => {
  if (facing === 'floor') mesh.rotation.x = -Math.PI / 2;
  else if (facing === -1) mesh.rotation.y = Math.PI;
  else if (facing === 'x+') mesh.rotation.y = Math.PI / 2;
  else if (facing === 'x-') mesh.rotation.y = -Math.PI / 2;
};

// A soft wash for long strips (under trim tubes): bright along its top edge, fading downwards, the same all along.
function makeWashTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  const fade = c.createLinearGradient(0, 0, 0, 64);
  fade.addColorStop(0, 'rgba(255,255,255,0.85)');
  fade.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = fade;
  c.fillRect(0, 0, 4, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLookKit({ kit, colliders }) {
  const { box, mat } = kit;
  const neons = [];
  const neonsByName = {}; // area name -> its neon builder (the horror layer cuts an area's power)
  const clutters = [];
  const posters = [];
  const groups = new Map();

  const dynamicGroup = (name) => {
    if (groups.has(name)) return groups.get(name);
    const g = new THREE.Group();
    g.name = name;
    g.userData.dynamic = true;
    kit.group.add(g);
    groups.set(name, g);
    return g;
  };
  const poolGroup = dynamicGroup('look_light_pools');

  /** Wainscot (0 .. heights.wainscot), a chrome rail on top and a colour band, 2 cm proud of a wall, round its `gaps` ([from, to]). `floorY`: an upper floor. */
  function bands({ along, from, to, wallAt, facing, gaps = [], colors, heights = {}, name = 'look_wainscot', floorY = 0 }) {
    const h = { wainscot: 1.1, rail: 0.05, band: [1.32, 1.5], ...heights };
    const wainscot = colors.wainscot != null ? mat(colors.wainscot, { roughness: 0.6 }) : null;
    const rail = colors.rail != null ? mat(colors.rail, { roughness: 0.25, metalness: 0.8 }) : null;
    const band = colors.band != null ? mat(colors.band, { roughness: 0.55 }) : null;
    let cursor = from;
    const pieces = [];
    for (const g of [...gaps].sort((a, b) => a[0] - b[0])) {
      if (g[0] > cursor) pieces.push([cursor, g[0]]);
      cursor = Math.max(cursor, g[1]);
    }
    if (cursor < to) pieces.push([cursor, to]);
    const a = wallAt;
    const b = wallAt + facing * 0.02;
    const c = wallAt + facing * 0.035;
    for (const [u0, u1] of pieces) {
      if (u1 - u0 < 0.05) continue;
      const place = (y0, y1, d0, d1, m) => (along === 'x'
        ? box(u0, floorY + y0, Math.min(d0, d1), u1, floorY + y1, Math.max(d0, d1), m, { collide: false, name })
        : box(Math.min(d0, d1), floorY + y0, u0, Math.max(d0, d1), floorY + y1, u1, m, { collide: false, name }));
      if (wainscot) place(0, h.wainscot, a, b, wainscot);
      if (rail) place(h.wainscot, h.wainscot + h.rail, a, c, rail);
      if (band) place(h.band[0], h.band[1], a, b, band);
    }
  }

  function neon(name) {
    const n = createNeon({ group: dynamicGroup(`look_neon_${name}`) });
    neons.push(n);
    neonsByName[name] = n;
    return n;
  }

  const soft = makeSoftFootprint();
  const wash = makeWashTexture();
  const poolMaterials = new Map();
  const poolMat = (color, opacity, texture) => {
    const key = `${color}|${opacity}|${texture.uuid}`;
    if (!poolMaterials.has(key)) {
      poolMaterials.set(key, new THREE.MeshBasicMaterial({
        map: texture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
    }
    return poolMaterials.get(key);
  };
  /** A glow on a wall (facing as for signs) or on the floor ('floor'), centred at (x, y, z), w x h metres. */
  function pool(x, y, z, w, h, facing, color, opacity, { wash: isWash = false } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), poolMat(color, opacity, isWash ? wash : soft));
    m.position.set(x, y, z);
    facingRotation(m, facing);
    m.name = 'light_pool';
    poolGroup.add(m);
    return m;
  }

  /** A poster / banner / notice (world/posterTextures.js), unlit so it reads in any light. */
  function poster(kind, options, x, y, z, w, h, facing) {
    const texture = makePosterTexture(kind, options);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    m.position.set(x, y, z);
    facingRotation(m, facing);
    m.name = `poster_${kind}`;
    kit.group.add(m);
    posters.push(m);
    return m;
  }

  let decorKit = null;
  function clutter({ name, area, kinds, seed, perSquareMeter, keepClear = [] }) {
    decorKit ??= createDecorKit();
    const c = scatter({
      kit: decorKit, area, kinds, density: look.runtime.clutter, seed, perSquareMeter, keepClear, colliders,
      parent: dynamicGroup(`look_clutter_${name}`), name: `clutter_${name}`,
    });
    clutters.push(c);
    return c;
  }

  // Following the Graphics settings (only when they change).
  let shown = null;
  function follow() {
    const glow = look.runtime.neonGlow;
    const flicker = atmosphere.ambient.enabled;
    const density = look.runtime.clutter;
    const key = `${glow}|${flicker}|${density}|${neons.length}|${clutters.length}`;
    if (key === shown) return;
    shown = key;
    for (const n of neons) n.setQuality({ halo: glow, flicker });
    poolGroup.visible = glow;
    for (const c of clutters) c.setDensity(density);
  }

  return {
    bands, neon, pool, poster, clutter,
    parts: { neons, neonsByName, clutters, posters, pools: poolGroup },
    update(dt) {
      follow();
      for (const n of neons) n.update(dt);
    },
    reset() {
      follow();
    },
  };
}
