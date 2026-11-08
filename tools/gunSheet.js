// Contact sheet for gun upgrade looks: `npm run dev`, then open /tools/gunSheet.html?gun=nailGun&view=left
// One gun in eight states: plain, the three Extended Warranty tiers (+ Renewals), a Regular and an Overstuffed build, all four attachments, and everything at once.
// gun = any id in config/weapons.js; view = left | right | front | top; stuffing = a stuffing id (the build's colour); heart = a Heart id (its badge).
import * as THREE from 'three';
import { weapons } from '../src/config/weapons.js';
import { buildWeaponModel } from '../src/weapons/models/index.js';
import { createUpgradeVisuals } from '../src/weapons/models/upgradeParts.js';
import { workshopStuffings } from '../src/config/workshop.js';

const params = new URLSearchParams(location.search);
const gunId = params.get('gun') ?? 'stapleGun';
const view = params.get('view') ?? 'left';
const stuffing = params.get('stuffing') ?? 'fryerOil';
const heart = params.get('heart') ?? 'headshot'; // headshot | lastRound | reload | everyTenth
const ATTACHMENTS = { barrel: 'extendedNozzle', sight: 'zoomLens', magazine: 'jumboPack', grip: 'gripTape' };

const STATES = [
  { label: 'plain', show: {} },
  { label: 'Deluxe', show: { tier: 'deluxe' } },
  { label: 'Premium', show: { tier: 'premium' } },
  { label: 'Platinum + 3 renewals', show: { tier: 'platinum', renewals: 3 } },
  { label: 'Build: Regular', show: { build: { stuffing, heart, quality: 'regular' } } },
  { label: 'Build: Overstuffed', show: { build: { stuffing, heart, quality: 'overstuffed' } } },
  { label: 'Attachments', show: { attachments: ATTACHMENTS } },
  { label: 'ALL THREE', show: { tier: 'platinum', renewals: 3, build: { stuffing, heart, quality: 'extraStuffed' }, attachments: ATTACHMENTS } },
];

const hud = document.getElementById('hud');
hud.innerHTML = `${gunId} · ${view} · ${stuffing} · ` + Object.keys(weapons).map((id) => `<a href="?gun=${id}&view=${view}&stuffing=${stuffing}">${id}</a>`).join('')
  + ' | ' + ['left', 'right', 'front', 'top'].map((v) => `<a href="?gun=${gunId}&view=${v}&stuffing=${stuffing}">${v}</a>`).join('')
  + ' | ' + Object.keys(workshopStuffings).map((s) => `<a href="?gun=${gunId}&view=${view}&stuffing=${s}">${s}</a>`).join('');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a2036');
scene.add(new THREE.HemisphereLight(0xfff6e6, 0x4a3f55, 1.8));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(1, 2, 1.5);
scene.add(key);

const cells = STATES.map((state, i) => {
  const model = buildWeaponModel(weapons[gunId]);
  const visuals = createUpgradeVisuals(model);
  visuals.show({ ...state.show, time: 0.6 });
  const holder = new THREE.Group();
  holder.position.set(i * 2, 0, 0);
  holder.add(model.root);
  scene.add(holder);
  return { state, holder, visuals };
});

const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
const EYE = { left: [-0.7, 0.34, -0.5], right: [0.7, 0.34, -0.5], front: [0.12, 0.12, -0.8], top: [-0.1, 0.8, -0.2] };

function frame(ms) {
  const cols = 4, rows = 2, w = innerWidth / cols, h = innerHeight / rows;
  cells.forEach((cell, i) => {
    cell.visuals.show({ ...cell.state.show, time: ms / 1000 });
    const x = (i % cols) * w, y = innerHeight - (Math.floor(i / cols) + 1) * h;
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const centre = new THREE.Vector3(i * 2, -0.03, -0.12);
    camera.position.set(centre.x + EYE[view][0], centre.y + EYE[view][1], centre.z + EYE[view][2]);
    camera.lookAt(centre);
    renderer.render(scene, camera);
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
