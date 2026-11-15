// =============================================================================
// SKIN BADGE: the name tag on the Employee of the Month skin (config/skins.js `badge`, numbers in skinBadges).
//
//   applySkinBadge(root, def, skinId, mounts) -> the badge mesh, or null (no badge on this skin, or no spot for it on this gun)
//
// One small plate, ONE mesh and one material: a single draw call. It lies flat on the gun's left face (the side you see in your hands) beside
// the sticker mount, where the warranty seal sits (and the build patch, unless the gun gives it a `build` mount of its own), never on top of them. Guns differ too much to hand-place eleven badges, so
// the spot is FOUND: from each candidate position round the mount (config tries, back first) a ray is cast from the left; the plate goes where
// the first surface it meets lies at the face's own depth (the mount's x, within tolerance). A hand, an arm or a magazine standing out further
// left is hit first and rejects that candidate, so the badge is never glued to a hand. The print (a coloured band and two ruled lines) is made
// once per skin and shared; without a canvas (Node) the plate is plain.
// =============================================================================
import * as THREE from 'three';
import { gunSkin, skinBadges as cfg } from '../../config/skins.js';

const css = color => '#' + color.toString(16).padStart(6, '0');
const textures = new Map(); // skin id -> CanvasTexture, shared by every gun and every preview

function printedPlate(skin) {
  if (textures.has(skin.id)) return textures.get(skin.id);
  let texture = null;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext?.('2d');
  if (ctx) {
    const { width, height, stripe, lines } = cfg.canvas, { plate, stripe: band, ink } = skin.badge;
    canvas.width = width; canvas.height = height;
    ctx.fillStyle = css(plate); ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = css(band); ctx.fillRect(0, 0, width, height * stripe);
    ctx.fillStyle = css(ink);
    const room = height * (1 - stripe);
    for (let i = 0; i < lines; i++) ctx.fillRect(width * 0.1, height * stripe + room * (i + 1) / (lines + 1), width * (i ? 0.5 : 0.8), Math.max(1, height * 0.06));
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.sharedSkinPattern = true; // (a preview's release leaves a shared print alone: ui/locker.js)
    texture.name = `skinBadge:${skin.id}`;
  }
  textures.set(skin.id, texture);
  return texture;
}

const visibleChain = object => { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; };

// The build mount, when a gun has its own (models/buildVisual.js): the patch's pillow covers about this much round it (the biggest, Overstuffed).
const onBuildSpot = (at, mounts) => {
  const spot = mounts?.build?.position;
  return !!spot && Math.abs(at.z - spot[2]) < cfg.buildKeepOut[0] && Math.abs(at.y - spot[1]) < cfg.buildKeepOut[1];
};

export function applySkinBadge(root, def, skinId, mounts) {
  const skin = gunSkin(def.id, skinId);
  const anchor = mounts?.sticker?.position;
  if (!skin?.badge || !root || !anchor) return null;
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse(node => { if (node.isMesh && visibleChain(node)) meshes.push(node); });
  const toWorld = new THREE.Vector3(1, 0, 0).transformDirection(root.matrixWorld);
  const raycaster = new THREE.Raycaster();
  for (const [back, up] of cfg.tries) {
    const from = root.localToWorld(new THREE.Vector3(anchor[0] - cfg.rayStart, anchor[1] + up, anchor[2] + back));
    raycaster.set(from, toWorld);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) continue;
    const at = root.worldToLocal(hit.point.clone());
    if (onBuildSpot(at, mounts)) continue; // (a gun whose build patch has its own spot: never under the pillow)
    if (Math.abs(at.x - anchor[0]) > cfg.tolerance) continue;
    const [thick, height, length] = cfg.size;
    const texture = printedPlate(skin);
    const material = new THREE.MeshStandardMaterial({ color: texture ? 0xffffff : skin.badge.plate, map: texture, roughness: 0.45, metalness: 0.1 });
    const badge = new THREE.Mesh(new THREE.BoxGeometry(thick, height, length), material);
    badge.name = 'skinBadge';
    badge.position.set(at.x - thick / 2, at.y, at.z);
    root.add(badge);
    return badge;
  }
  return null;
}
