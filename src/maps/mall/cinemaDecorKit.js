// Small map-owned primitives for cinema dressing. World coordinates keep the
// existing coplanar checks meaningful; no collision is added by these helpers.
import * as THREE from 'three';
import { drawType } from '../../world/typeKit.js';

export function cinemaDecorKit(kit, palette, floorY = 0) {
  const y = h => floorY + h;
  function tag(m, name) { m.name = `cinema_decor_${name}`; m.userData.cinemaDetail = true; return m; }
  function box(name, x, h, z, w, height, d, color, options = {}) {
    return tag(kit.box(x - w / 2, y(h), z - d / 2, x + w / 2, y(h + height), z + d / 2,
      kit.mat(color, options), { collide: false }), name);
  }
  function cyl(name, x, h, z, radius, height, color, rotation = [0, 0, 0], options = {}, sides = 10) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), kit.mat(color, options));
    m.position.set(x, y(h), z); m.rotation.set(...rotation); kit.group.add(m); return tag(m, name);
  }
  function panel(name, canvas, x, h, z, w, height, facing = 1) {
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height), new THREE.MeshBasicMaterial({ map: texture }));
    m.position.set(x, y(h), z);
    m.rotation.y = facing === -1 ? Math.PI : facing === 'x+' ? Math.PI / 2 : facing === 'x-' ? -Math.PI / 2 : 0;
    if (facing === 'floor') m.rotation.x = -Math.PI / 2;
    kit.group.add(m); return tag(m, name);
  }
  function canvas(w = 512, h = 384) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function placard(name, lines, x, h, z, w, height, facing = 1, base = '#49354d', ink = '#efdfbf') {
    const c = canvas(512, Math.round(512 * height / w)), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.strokeRect(9, 9, c.width - 18, c.height - 18);
    const text = lines.split('\n'), size = Math.min(34, c.height / (text.length + 1) * .7);
    text.forEach((s, i) => drawType(ctx, s, c.width / 2, c.height * (i + 1) / (text.length + 1),
      { role: 'wayfinding', size, fill: ink, maxWidth: c.width - 50 }));
    return panel(name, c, x, h, z, w, height, facing);
  }
  return { box, cyl, panel, canvas, placard, tag, y, colors: palette };
}
