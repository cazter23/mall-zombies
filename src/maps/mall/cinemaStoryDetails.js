import * as THREE from 'three';
import { cinemaDetails as d } from '../../config/cinemaDetails.js';
import { atmosphere } from '../../config/environment.js';
import { look } from '../../config/look.js';
import { cinemaDecorKit } from './cinemaDecorKit.js';
import { seededRandom } from '../../world/textures.js';
import { batchStatic } from '../../world/staticBatch.js';

export function buildCinemaStoryDetails({ kit, layout: c, floorY: Y }) {
  const C = d.palette, { box, placard } = cinemaDecorKit(kit, C, Y);
  const programme = placard('premiere_programme', d.story.premiere, c.lobby.maxX - .09, 2.25, -8.3, 1.8, 1.55, 'x-', '#d7c7ad', '#644553');
  const programmeMount = new THREE.Group(); programmeMount.name = 'cinema_programme_mount'; programmeMount.userData.dynamic = true;
  kit.group.add(programmeMount); programmeMount.attach(programme);
  for (const z of [-8.9, -7.7]) box('programme_clip', c.lobby.maxX - .11, 3.03, z, .04, .07, .065, C.gold);
  // One loose programme moves within its mounting; no broad environment flicker.
  const root = new THREE.Group(); root.name = 'cinema_litter'; root.userData.dynamic = true; kit.group.add(root);
  const rand = seededRandom(9441);
  for (const [index, cluster] of d.litter.entries()) {
    const h = cluster.floorY ?? Y, helper = cinemaDecorKit(kit, C, h), group = new THREE.Group(); group.userData.fullOnly = index % 2 === 1;
    group.name = `cinema_litter_cluster_${index}`; root.add(group);
    for (let i = 0; i < cluster.count; i++) {
      const x = cluster.x + (rand() - .5) * cluster.spread, z = cluster.z + (rand() - .5) * cluster.spread;
      const popcorn = cluster.kind === 'popcorn';
      const m = helper.box(`litter_${cluster.kind}`, x, .012 + (i % 3) * .002, z,
        popcorn ? .025 + rand() * .02 : .06 + rand() * .09, popcorn ? .022 : .006,
        popcorn ? .03 : .035 + rand() * .04, popcorn ? (i % 3 ? C.paper : C.gold) : (i % 2 ? C.paper : C.rose));
      m.rotation.y = rand() * Math.PI; group.attach(m);
    }
    batchStatic(group); // one small draw per cluster, still switchable by density
  }
  // Carpet traffic is drawn into a tiny transparent decal; no piles in lanes.
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, 256, 128);
  const fade = ctx.createRadialGradient(128, 64, 5, 128, 64, 120);
  fade.addColorStop(0, 'rgba(213,192,171,.10)'); fade.addColorStop(1, 'rgba(213,192,171,0)');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 256, 128);
  const texture = new THREE.CanvasTexture(cv); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  for (const [x, z, w, depth] of [[-39.1, 5.2, 2.3, 2], [-22, 5.2, 2.2, 2], [-21.2, -2.9, 2, 2.4]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, depth), material); m.position.set(x, Y + .024, z); m.rotation.x = -Math.PI / 2;
    m.name = 'cinema_carpet_wear'; root.add(m);
  }
  let time = 0;
  function pose() {
    programme.rotation.z = Math.sin(time * Math.PI * 2 / d.motion.posterPeriod) * d.motion.posterRadians;
    root.visible = look.runtime.clutter !== 'none';
    for (const cluster of root.children) cluster.visible = look.runtime.clutter === 'full' || !cluster.userData.fullOnly;
  }
  pose();
  return { root, programme, update(dt) { if (atmosphere.ambient.enabled) time += dt; pose(); }, reset() { time = 0; pose(); } };
}
