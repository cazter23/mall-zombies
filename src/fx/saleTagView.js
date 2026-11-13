// =============================================================================
// IN-WORLD SALE TAGS (browser side): draws floating retail clearance tags over every currently discounted (or
// teased) buy spot the player can use, using world/typeKit.js roles (never raw font strings) and shared instanced
// geometries so draw calls stay near zero.
// =============================================================================

import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { economy } from '../config/economy.js';
import { collectSaleSpots } from '../game/flashSales.js';
import { drawType } from '../world/typeKit.js';
import { createBeacon } from './beacon.js';

function twoSidedCardGeometry(width, height) {
  const halfOffset = 0.002;
  const front = new PlaneGeometry(width, height);
  front.translate(0, 0, halfOffset);
  const back = new PlaneGeometry(width, height);
  back.rotateY(Math.PI);
  back.translate(0, 0, -halfOffset);

  const joinFloat = (name, size) => {
    const a = front.attributes[name].array;
    const b = back.attributes[name].array;
    const out = new Float32Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return new BufferAttribute(out, size);
  };

  const geo = new BufferGeometry();
  geo.setAttribute('position', joinFloat('position', 3));
  geo.setAttribute('normal', joinFloat('normal', 3));
  geo.setAttribute('uv', joinFloat('uv', 2));
  const fi = front.index.array;
  const bi = back.index.array;
  const indices = [];
  for (let i = 0; i < fi.length; i++) indices.push(fi[i]);
  const vOffset = front.attributes.position.count;
  for (let i = 0; i < bi.length; i++) indices.push(bi[i] + vOffset);
  geo.setIndex(indices);
  geo.userData.shared = true;
  front.dispose();
  back.dispose();
  return geo;
}

function makeTagTexture(label, { bg, border, ink }, cfg) {
  const canvas = document.createElement('canvas');
  canvas.width = cfg.canvasWidth;
  canvas.height = cfg.canvasHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pad = 6;
    const notch = 26;
    ctx.beginPath();
    ctx.moveTo(pad + notch, pad);
    ctx.lineTo(w - pad, pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(pad + notch, h - pad);
    ctx.lineTo(pad, h / 2);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = border;
    ctx.stroke();

    // Ticket punch hole on the pointed left tip.
    ctx.beginPath();
    ctx.arc(pad + 19, h / 2, 7, 0, Math.PI * 2);
    ctx.fillStyle = border;
    ctx.fill();

    drawType(ctx, label, (pad + notch + w - pad) / 2, h / 2 + 2, {
      role: 'clearance',
      size: cfg.fontSize,
      maxWidth: w - pad * 2 - notch - 24,
      min: cfg.minFontSize,
      fill: ink,
      outline: false,
      shadow: false,
    });
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createSaleTagView(scene, g) {
  const cfg = economy.flashSales.worldTag;
  const root = new Group();
  root.name = 'saleTags';
  root.userData.dynamic = true;
  scene.add(root);

  const normalGeo = twoSidedCardGeometry(cfg.tagWidth, cfg.tagHeight);
  const doorbusterGeo = twoSidedCardGeometry(cfg.doorbusterWidth, cfg.doorbusterHeight);

  const makeMesh = (geo, max, label, palette) => {
    const mat = new MeshBasicMaterial({
      map: makeTagTexture(label, palette, cfg),
      transparent: true,
      alphaTest: 0.2,
    });
    const mesh = new InstancedMesh(geo, mat, max);
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  };

  const c = cfg.colors;
  const soonMesh = makeMesh(normalGeo, cfg.maxNormal, 'SALE SOON', { bg: c.soonBg, border: c.soonBorder, ink: c.soonInk });
  const saleMesh = makeMesh(normalGeo, cfg.maxNormal, 'SALE', { bg: c.saleBg, border: c.saleBorder, ink: c.saleInk });
  const doorbusterMesh = makeMesh(
    doorbusterGeo,
    cfg.maxDoorbuster,
    'DOORBUSTER',
    { bg: c.doorbusterBg, border: c.doorbusterBorder, ink: c.doorbusterInk },
  );

  const beacon = createBeacon({ color: c.doorbusterBg });
  beacon.root.visible = false;
  root.add(beacon.root);

  let spots = [];
  let dirty = true;
  let clock = 0;
  let syncTimer = 0;
  const dummy = new Object3D();

  // Re-read at once on these (a bought item loses its tag the same frame); otherwise every cfg.syncIntervalSeconds.
  const refreshEvents = ['flashSaleSoon', 'flashSaleStart', 'flashSaleEnd', 'purchase', 'clawMoved', 'kioskMoved', 'kioskStock', 'runReset', 'runLoaded'];
  const unsubscribe = refreshEvents.map((ev) => g.events.on(ev, () => { dirty = true; }));

  function sync() {
    dirty = false;
    syncTimer = cfg.syncIntervalSeconds;
    const hideAll = g.state?.over;
    const sale = hideAll ? null : (g.flashSales?.active ?? (g.flashSales?.pending ? { ...g.flashSales.pending, soon: true } : null));
    spots = sale ? collectSaleSpots(g, sale) : [];
    const activeMesh = !spots.length ? null : spots[0].doorbuster ? doorbusterMesh : spots[0].soon ? soonMesh : saleMesh;
    for (const m of [soonMesh, saleMesh, doorbusterMesh]) {
      m.visible = m === activeMesh;
      if (m !== activeMesh) m.count = 0;
    }
    if (!spots.length) {
      beacon.root.visible = false;
      return;
    }
    const maxCount = activeMesh === doorbusterMesh ? cfg.maxDoorbuster : cfg.maxNormal;
    activeMesh.count = Math.min(spots.length, maxCount);

    if (activeMesh === doorbusterMesh) {
      const lead = spots[0];
      beacon.root.position.set(lead.x, Math.max(0.02, lead.y - cfg.beaconFloorDrop), lead.z);
      beacon.root.visible = true;
    } else {
      beacon.root.visible = false;
    }
  }

  return {
    root,
    refresh() { dirty = true; },
    // Stop listening and free the tags (their geometry, materials and canvas textures) and the beacon's own material.
    dispose() {
      for (const off of unsubscribe) off();
      for (const m of [soonMesh, saleMesh, doorbusterMesh]) {
        m.material.map?.dispose();
        m.material.dispose();
        m.dispose();
      }
      normalGeo.dispose();
      doorbusterGeo.dispose();
      beacon.dispose();
      root.removeFromParent();
      spots = [];
    },
    counts() {
      return { soon: soonMesh.count, sale: saleMesh.count, doorbuster: doorbusterMesh.count, beacon: beacon.root.visible };
    },
    update(dt) {
      clock += dt;
      syncTimer -= dt;
      // Re-read on a timer whenever a sale or teaser is on, even with no tag up yet: a spot can become usable without an
      // event (Kevin stops hiding, the claw reopens, an area opens by a debug or quest path).
      const saleOn = !!(g.flashSales?.active || g.flashSales?.pending);
      if (dirty || ((spots.length || saleOn) && syncTimer <= 0)) sync();
      if (!spots.length) return;

      const isDb = spots[0].doorbuster;
      const mesh = isDb ? doorbusterMesh : spots[0].soon ? soonMesh : saleMesh;
      const spin = isDb ? cfg.doorbusterSpinSpeed : cfg.spinSpeed;
      const count = mesh.count;
      for (let i = 0; i < count; i++) {
        const spot = spots[i];
        const nx = spot.normal?.x ?? 0;
        const nz = spot.normal?.z ?? 0;
        const bob = Math.sin(clock * cfg.bobSpeed + i * 0.9) * cfg.bobAmplitude;
        const pulse = isDb ? 1 + cfg.doorbusterPulseAmplitude * Math.sin(clock * cfg.doorbusterPulseSpeed + i) : 1;
        dummy.position.set(spot.x + nx * cfg.wallOffset, spot.y + cfg.hoverY + bob, spot.z + nz * cfg.wallOffset);
        dummy.rotation.set(0, clock * spin + i * 0.7, 0);
        dummy.scale.setScalar(pulse);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (beacon.root.visible) beacon.update(clock);
    },
  };
}
