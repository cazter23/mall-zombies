// Room culling's finer rules (fx/roomCulling.js): a room seen through a doorway draws only what the doorway shows, the
// Far objects setting drops small things beyond a distance (Potato, Low), props flagged by a feature get their room's layer,
// and the debug test range is only drawn from outside every room. A two-room setup for the rules, then the real mall for
// the invariants. (That the doorway test hides nothing visible is checked by pixels in the browser: docs/history.md.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createRoomCulling, visibleAreas, CULLED_LAYER, OUTSIDE_LAYER } from '../src/fx/roomCulling.js';
import { batchStatic, freezeStatic } from '../src/world/staticBatch.js';
import { settingDefs, settingPresets } from '../src/config/settings.js';
import { look } from '../src/config/look.js';

const CULLED = 1 << CULLED_LAYER;

// Two rooms side by side along z, a 2 m doorway in the wall between them at x -1..1:
//   room A: x -10..10, z 0..10 (the camera's)      room B: x -10..10, z -10..-0.3
const areas = [
  { id: 'a', minX: -10, maxX: 10, minY: 0, maxY: 4, minZ: 0, maxZ: 10 },
  { id: 'b', minX: -10, maxX: 10, minY: 0, maxY: 4, minZ: -10, maxZ: -0.3 },
];
const portals = [{ a: 'a', b: 'b', minX: -1, maxX: 1, minY: 0, maxY: 2.5, minZ: -0.3, maxZ: 0 }];

function setup(options = {}) {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 200);
  const scene = new THREE.Scene();
  const box = (name, x, y, z, size = 0.5) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial());
    mesh.name = name;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  const m = {
    inA: box('inA', 5, 1, 5),
    behindDoor: box('behindDoor', 0, 1, -5), // straight through the doorway
    aside: box('aside', -8, 1, -5), // in room B, far to the side of what the doorway shows
    wall: box('wall', 4, 1.9, -5, 3.6), // a big thing in room B (not a "small object"), reaching into the doorway's view
  };
  const culling = createRoomCulling({ areas, portals, camera, ...options });
  culling.tag(scene);
  culling.collect(scene);
  const look = (from, at) => {
    camera.position.set(...from);
    camera.lookAt(...at);
    camera.updateMatrixWorld(true);
    culling.update();
  };
  return { camera, scene, culling, look, ...m, roomB: m.behindDoor.layers.mask };
}

test('a room seen through a doorway draws what the doorway shows and skips the rest', () => {
  const s = setup();
  s.look([0, 1.6, 6], [0, 1.6, -5]); // in room A, facing the doorway
  assert.deepEqual([...s.culling.visible], ['a', 'b']);
  assert.equal(s.behindDoor.layers.mask, s.roomB, 'what the doorway shows is drawn');
  assert.equal(s.aside.layers.mask, CULLED, 'what is beside the doorway, behind the wall, is skipped');
  assert.equal(s.wall.layers.mask, s.roomB, 'a big thing that reaches into view is drawn');
  assert.equal(s.inA.layers.mask, 1 << 1, 'the camera\'s own room is drawn whole');
  assert.equal(s.culling.windowCulled, 1);
  assert.ok(s.camera.layers.test(s.behindDoor.layers) && !s.camera.layers.test(s.aside.layers), 'the camera draws one, not the other');
  const all = new THREE.Layers();
  all.enableAll();
  assert.ok(all.test(s.aside.layers), 'a ray test that enables every layer still finds a skipped object (bullet marks)');
});

test('walking through the doorway, or into the room, brings everything back', () => {
  const s = setup();
  s.look([0, 1.6, 6], [0, 1.6, -5]);
  assert.equal(s.aside.layers.mask, CULLED);
  s.look([0, 1.6, 0.3], [0, 1.6, -5]); // standing in the doorway: it fills the view
  assert.equal(s.aside.layers.mask, s.roomB, 'at the doorway the room is drawn whole');
  s.look([0, 1.6, 6], [0, 1.6, -5]);
  assert.equal(s.aside.layers.mask, CULLED);
  s.look([-8, 1.6, -3], [0, 1.6, -5]); // inside room B
  assert.equal(s.aside.layers.mask, s.roomB);
  s.look([0, 1.6, 6], [0, 1.6, -5]);
  s.culling.update(false); // culling off (?noculling): everything is drawn, nothing is left on the culled layer
  assert.equal(s.culling.visible, null);
  assert.equal(s.aside.layers.mask, s.roomB);
  s.look([0, 1.6, 6], [0, 1.6, -5]);
  s.culling.windowCulling = false; // the doorway test alone switched off: the old rule, a visible room is drawn whole
  s.culling.update();
  assert.equal(s.aside.layers.mask, s.roomB);
  assert.equal(s.culling.windowCulled, 0);
});

test('a moving object is measured every frame; decals, see-through-walls materials and instances keep the old rule', () => {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 200);
  const scene = new THREE.Scene();
  const at = (object, x, z) => { object.position.set(x, 1, z); scene.add(object); return object; };
  const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const mover = new THREE.Group();
  mover.userData.dynamic = true;
  const moving = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  mover.add(moving);
  at(mover, -8, -5);
  const decal = at(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: -1 })), -8, -6);
  const xray = at(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ depthTest: false })), -8, -7);
  const instanced = at(new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 4), -8, -8);
  const culling = createRoomCulling({ areas, portals, camera });
  culling.tag(scene);
  assert.equal(culling.collect(scene), 1, 'only the plain mesh is listed for the doorway test');
  const update = () => { scene.updateMatrixWorld(true); culling.update(); };
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, 1.6, -5);
  camera.updateMatrixWorld(true);
  update();
  const roomB = decal.layers.mask;
  assert.equal(moving.layers.mask, CULLED, 'beside the doorway: skipped');
  for (const o of [decal, xray, instanced]) assert.equal(o.layers.mask, roomB, 'drawn with its room, as before');
  mover.position.set(0, 1, -5); // it rolls into the doorway's view
  update();
  assert.equal(moving.layers.mask, roomB, 'a moving object is measured again each frame');
});

test('Far objects: small things beyond the distance are skipped, big ones never, and they do not blink at the edge', () => {
  const far = { metres: Infinity, maxRadius: 2, hysteresis: 1.5 };
  const s = setup({ farProps: () => far });
  s.look([0, 1.6, 9], [0, 1.6, -5]);
  assert.equal(s.behindDoor.layers.mask, s.roomB, 'no limit (Medium, High): drawn at 14 m');
  far.metres = 10;
  s.look([0, 1.6, 9], [0, 1.6, -5]);
  assert.equal(s.behindDoor.layers.mask, CULLED, 'a small thing 14 m away is skipped at a 10 m limit');
  assert.equal(s.wall.layers.mask, s.roomB, 'a big thing is drawn at any distance');
  assert.equal(s.inA.layers.mask, 1 << 1, 'near things in the camera\'s own room are drawn');
  s.look([0, 1.6, 4.5], [0, 1.6, -5]); // 9.5 m away: inside the limit, but not yet `hysteresis` inside it
  assert.equal(s.behindDoor.layers.mask, CULLED, 'it only comes back 1.5 m nearer than it went');
  s.look([0, 1.6, 3], [0, 1.6, -5]); // 8 m
  assert.equal(s.behindDoor.layers.mask, s.roomB);
  s.look([0, 1.6, 4.5], [0, 1.6, -5]);
  assert.equal(s.behindDoor.layers.mask, s.roomB, 'and stays until it is past the limit again');
  // The camera's own room too: a small thing at the far end of a long hall.
  s.look([-9, 1.6, 9], [5, 1, 5]);
  assert.equal(s.inA.layers.mask, CULLED, 'the far end of the room the camera is in');
  far.metres = Infinity;
  s.culling.update();
  assert.equal(s.inA.layers.mask, 1 << 1, 'the setting back to Everywhere: everything is drawn again');
});

test('the rectangle a room is seen through covers every way into it', () => {
  // Two doorways into room B: the room's rectangle is the bounds of both.
  const two = [...portals, { a: 'a', b: 'b', minX: 6, maxX: 8, minY: 0, maxY: 2.5, minZ: -0.3, maxZ: 0 }];
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 200);
  camera.position.set(3, 1.6, 8);
  camera.lookAt(3, 1.6, -5);
  camera.updateMatrixWorld(true);
  const one = new Map(), both = new Map();
  visibleAreas({ areas, portals, camera, windows: one });
  visibleAreas({ areas, portals: two, camera, windows: both });
  assert.deepEqual(one.get('a'), { x0: -1, x1: 1, y0: -1, y1: 1 }, 'the camera\'s room: the whole screen');
  assert.ok(both.get('b').x0 <= one.get('b').x0 + 1e-9 && both.get('b').x1 > one.get('b').x1, 'wider with the second doorway');
});

test('the real mall: props get their room, the test range is outside every room, and culling never leaves a mask behind', () => {
  const { g } = headlessGame({ buildTestRange: (scene) => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()), new THREE.PointLight());
    scene.add(group);
    return { group, contains: () => false, shootables: [], update() {}, playerSpawn: { position: new THREE.Vector3(), yaw: 0 } };
  } });
  const scene = g.map.group.parent;
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 400);
  const far = { ...look.propDistance, metres: Infinity };
  const culling = createRoomCulling({ areas: g.map.cullAreas, portals: g.map.cullPortals, camera, farProps: () => far });
  culling.tag(g.map.group);
  const props = scene.children.filter((c) => c.userData.roomProp);
  assert.ok(props.length >= 15, `features flag their still props (${props.length})`);
  assert.ok(culling.tagProps(scene) >= 100, 'wall-buy guns, Lost and Found and switches are on room layers');
  assert.equal(culling.tagOutside(g.arena.group), 1, 'the test range\'s meshes (not its lights)');
  let rangeLight = null;
  g.arena.group.traverse((o) => { if (o.isLight) rangeLight = o; });
  assert.equal(rangeLight.layers.mask, 1, 'its lights still light the scene');
  batchStatic(g.map.group, { shade: look.bakedShade, cellSize: look.batchCellSize });
  freezeStatic(g.map.group);
  const listed = culling.collect(scene);
  assert.ok(listed > 1500, `the rooms' meshes are listed (${listed})`);
  for (const door of g.map.doors) door.open({ instant: true });

  const masks = new Map();
  scene.traverse((o) => { if (o.isMesh) masks.set(o, o.layers.mask); });
  const rangeMesh = g.arena.group.children.find((o) => o.isMesh);
  let skippedThroughDoors = 0, skippedFar = 0;
  for (const shot of g.map.benchmarkShots) {
    camera.position.fromArray(shot.from);
    camera.lookAt(...shot.lookFrom);
    camera.updateMatrixWorld(true);
    far.metres = Infinity;
    culling.update();
    assert.ok(culling.visible, `${shot.name}: the camera is in a room`);
    // (A strip of the range shows over the lot's fence, so wherever the lot can be seen the range is still drawn.)
    assert.equal(camera.layers.test(rangeMesh.layers), culling.visible.has('parkingLot'), `${shot.name}: the test range is drawn only where the open air is seen`);
    skippedThroughDoors += culling.windowCulled;
    const throughDoors = culling.windowCulled;
    far.metres = look.propDistance.metres.close; // Potato
    culling.update();
    assert.ok(culling.windowCulled >= throughDoors, `${shot.name}: Far objects only ever skips more`);
    skippedFar += culling.windowCulled - throughDoors;
  }
  assert.equal(g.map.cullAreas.find((a) => a.id === 'parkingLot').outdoors, true, 'the lot is the open air');
  assert.ok(skippedThroughDoors > 1000, `the doorway test skips objects across the route (${skippedThroughDoors})`);
  assert.ok(skippedFar > 300, `Far objects (Potato) skips more (${skippedFar})`);
  // Outside every room (the test range, a doorway): everything is drawn and every mesh is back on its own layer.
  camera.position.set(0, 1.6, -100);
  camera.updateMatrixWorld(true);
  culling.update();
  assert.equal(culling.visible, null);
  assert.ok(camera.layers.test(rangeMesh.layers), 'in the test range it is drawn');
  for (const [o, mask] of masks) if (o.parent) assert.equal(o.layers.mask, mask, `${o.name || 'a mesh'} is back on its layer`);
});

test('Far objects is a Graphics setting: off on Medium and High, Near on Low, Close on Potato', () => {
  const def = settingDefs.find((d) => d.id === 'propDistance');
  assert.equal(def.default, 'all');
  assert.deepEqual(def.options.map((o) => o.value), Object.keys(look.propDistance.metres));
  const of = (label) => settingPresets.Graphics.find((p) => p.label === label).values.propDistance;
  assert.deepEqual([of('Potato'), of('Low'), of('Medium'), of('High')], ['close', 'near', 'all', 'all']);
  assert.equal(look.propDistance.metres.all, Infinity, 'High never skips a thing for being far');
  const saved = look.runtime.propDistance;
  def.apply('close');
  assert.equal(look.runtime.propDistance, 'close');
  def.apply(saved);
});
