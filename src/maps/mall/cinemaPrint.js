// Canvas artwork with a distinct cinema print language; textures belong to the
// returned mesh and are disposed with the map. No font downloads are needed.
import { cinemaDecorKit } from './cinemaDecorKit.js';
import * as THREE from 'three';

const atlases = new WeakMap();

export function cinemaPrint(kit, palette, floorY = 0) {
  const h = cinemaDecorKit(kit, palette, floorY);
  // A map-local sheet lets printed props share material and static batches.
  function printPanel(name, art, x, y, z, w, height, facing = 1) {
    if (!atlases.has(kit)) {
      const sheet = h.canvas(2048, 2048), texture = new THREE.CanvasTexture(sheet);
      texture.colorSpace = THREE.SRGBColorSpace;
      atlases.set(kit, { sheet, texture, material: new THREE.MeshBasicMaterial({ map: texture }), next: 0 });
    }
    const a = atlases.get(kit), slot = a.next++;
    if (slot >= 32) throw new Error('Cinema print sheet is full');
    const col = slot % 4, row = Math.floor(slot / 4);
    a.sheet.getContext('2d').drawImage(art, col * 512 + 2, row * 256 + 2, 508, 252);
    a.texture.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(w, height), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (col * 512 + 3 + uv.getX(i) * 506) / 2048,
      1 - (row * 256 + 3 + (1 - uv.getY(i)) * 250) / 2048);
    const m = new THREE.Mesh(geo, a.material); m.position.set(x, floorY + y, z);
    m.rotation.y = facing === -1 ? Math.PI : facing === 'x+' ? Math.PI / 2 : facing === 'x-' ? -Math.PI / 2 : 0;
    kit.group.add(m); return h.tag(m, name);
  }
  function form(name, lines, x, y, z, w, height, facing) {
    const cv = h.canvas(512, 640), c = cv.getContext('2d');
    c.fillStyle = '#eee3c8'; c.fillRect(0, 0, 512, 640);
    c.fillStyle = '#494d49'; c.textAlign = 'left';
    c.font = 'bold 24px "Courier New", monospace'; c.fillText('SUNSET CINEMA', 34, 52);
    c.font = '14px "Courier New", monospace'; c.fillText('OPERATIONS / COPY 02', 34, 79);
    c.strokeStyle = '#a9b5ac'; c.lineWidth = 2;
    for (let y = 125; y < 600; y += 54) { c.beginPath(); c.moveTo(25, y); c.lineTo(487, y); c.stroke(); }
    c.font = 'bold 21px "Courier New", monospace';
    lines.forEach((line, i) => c.fillText(line, 34, 115 + i * 108));
    c.save(); c.translate(300, 535); c.rotate(-.12); c.strokeStyle = '#97554d';
    c.strokeRect(-125, -26, 250, 48); c.fillStyle = '#97554d'; c.font = 'bold 23px serif';
    c.fillText('RETAIN INDEFINITELY', -117, 6); c.restore();
    return printPanel(name, cv, x, y, z, w, height, facing);
  }
  function label(name, title, sub, x, y, z, w, height, facing, base = '#52374d') {
    const cv = h.canvas(768, 256), c = cv.getContext('2d');
    c.fillStyle = base; c.fillRect(0, 0, 768, 256);
    c.strokeStyle = '#c6a675'; c.lineWidth = 4; c.strokeRect(12, 12, 744, 232);
    c.fillStyle = '#f2e2bf'; c.textAlign = 'center';
    c.font = 'bold 77px Georgia, serif'; c.fillText(title, 384, 127);
    c.font = '20px "Courier New", monospace'; c.fillText(sub, 384, 202);
    return printPanel(name, cv, x, y, z, w, height, facing);
  }
  return { ...h, printPanel, form, label };
}
