// Throwaway viewer for the neon builder: `npm run dev`, then open /tools/neonDemo.html.
// A dark room with the sample wall (src/world/neonDemo.js), the game's bloom/tone-mapping numbers, slow camera drift.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMapKit } from '../src/world/mapKit.js';
import { createNeon } from '../src/world/neon.js';
import { buildNeonSampleWall } from '../src/world/neonDemo.js';
import { atmosphere } from '../src/config/environment.js';

const post = atmosphere.postProcessing;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = post.exposure;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#05030a');
scene.add(new THREE.AmbientLight('#3a2a55', 0.6));
const roomLight = new THREE.PointLight('#c8b8ff', 25, 30); // demo only: a dim room light so dead glass shows
roomLight.position.set(0, 3, 6);
scene.add(roomLight);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);

const group = new THREE.Group();
scene.add(group);
const kit = createMapKit(group, []);
kit.box(-9, -1.5, -0.3, 9, 6, -0.1, kit.mat('#1b1424'), { collide: false }); // the wall
kit.box(-9, -1.7, -0.3, 9, -1.5, 6, kit.mat('#2a2230', { roughness: 0.3 }), { collide: false }); // a glossy floor
const neon = createNeon(kit);
buildNeonSampleWall(neon, { x: 0, y: 0, z: 0 });

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), post.bloomStrength, post.bloomRadius, post.bloomThreshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const $ = (id) => document.getElementById(id);
$('halo').onchange = (e) => neon.setQuality({ halo: e.target.checked });
$('flicker').onchange = (e) => neon.setQuality({ flicker: e.target.checked });
const s = neon.stats();
$('stats').textContent = `${s.meshes} meshes, ${Math.round(s.triangles / 1000)}k triangles`;

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

let last = performance.now(), t = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  neon.update(dt);
  camera.position.set(Math.sin(t * 0.15) * 1.5, 2.2, 9.5);
  camera.lookAt(0, 2, 0);
  if ($('bloom').checked) composer.render();
  else renderer.render(scene, camera);
});
window.__neon = { neon, camera, renderer };
