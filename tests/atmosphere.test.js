import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createAmbience } from '../src/game/ambience.js';
import { createContactShadows } from '../src/fx/contactShadows.js';
import { createSound } from '../src/audio/sound.js';
import { atmosphere } from '../src/config/environment.js';
import { createMapKit } from '../src/world/mapKit.js';
import { buildMallAtmosphere } from '../src/maps/mall/atmosphere.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { rampHeightAt, markCollidersChanged } from '../src/world/collision.js';

const bounds = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));

test('atmosphere adds no collision and keeps actual triangles out of shortcuts, aisles, vaults and the ceiling well', () => {
  const kit = createMapKit(new THREE.Group(), []);
  const hole = { minX: -12.4, maxX: -8.1, minZ: 0.7, maxZ: 3.3 };
  const dressing = buildMallAtmosphere(kit, LAYOUT, {
    service: { points: [{ x: -20.3 }, { x: -21.8 }] }, ceilingHole: hole,
  });
  assert.equal(kit.colliders.length, 0);
  const spaces = [
    bounds([-1.05, 0.05, 6.4], [1.05, 2.3, 15.6]),
    bounds([18.5, 0.05, -9.6], [22.8, 2.7, -7]),
    bounds([-22.5, 0.05, -13.2], [-18.5, 2.7, -11.2]),
    ...[21.9, 25.75, 29.25, 32.75].map(x => bounds([x - 0.48, 0.05, -19.4], [x + 0.48, 2.4, -8.05])),
    bounds([20.5, 0.05, -22.8], [33.3, 2.4, -20]),
    bounds([20.5, 0.05, -7.5], [33.1, 2.4, -5.2]),
    ...[4.1, 1.3, -1.5, -4.3].map(z => bounds([24.7, 1.09, z - 0.6], [26.3, 2.98, z + 0.6])),
    bounds([hole.minX, 5.8, hole.minZ], [hole.maxX, 6.1, hole.maxZ]),
  ];
  const triangle = new THREE.Triangle();
  kit.group.updateMatrixWorld(true);
  let draws = 0;
  dressing.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    draws++;
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      for (const [v, n] of [[triangle.a, 0], [triangle.b, 1], [triangle.c, 2]]) {
        v.fromBufferAttribute(p, index ? index.getX(i + n) : i + n).applyMatrix4(mesh.matrixWorld);
        assert.ok(v.toArray().every(Number.isFinite));
      }
      for (const [n, space] of spaces.entries()) assert.ok(!space.intersectsTriangle(triangle),
        `${mesh.name} intrudes into route ${n} near ${triangle.a.toArray()}`);
    }
  });
  assert.ok(draws < 30, 'static boxes batch by material');
  // (The swaying sign's two faces hang in a userData.dynamic group: everything else under the map is frozen after batching.)
  const swaying = dressing.group.children.find(o => o.name === 'hallway_hanging_sign');
  assert.ok(swaying.userData.dynamic && swaying.children.length === 2);
  const sign = swaying.children.find(o => o.name === 'galleria_notice' && o.position.y === 4.5);
  const dust = dressing.group.children.find(o => o.name === 'mall_dust_motes');
  assert.ok(dust?.isPoints);
  const initialDustY = dust.geometry.attributes.position.getY(0);
  dressing.update(2);
  assert.notEqual(sign.rotation.z, 0);
  assert.notEqual(dust.geometry.attributes.position.getY(0), initialDustY);
  dressing.reset();
  assert.equal(sign.rotation.z, 0);
  assert.equal(dust.geometry.attributes.position.getY(0), initialDustY);
  kit.dispose();
});

test('contact shadows interpolate feet, choose the supporting surface, cap counts and free owned graphics', () => {
  const scene = new THREE.Scene();
  const floor = bounds([-10, -0.3, -10], [10, 0, 10]);
  const platform = bounds([1, 0, -1], [3, 0.75, 1]);
  const shadows = createContactShadows(scene, [floor, platform]);
  const z = { position: new THREE.Vector3(2, 0.75, 0), prevPosition: new THREE.Vector3(0, 0.75, 0), state: 'walking' };
  shadows.update([z], 1);
  const matrix = new THREE.Matrix4(), p = new THREE.Vector3();
  shadows.mesh.getMatrixAt(0, matrix); p.setFromMatrixPosition(matrix);
  assert.ok(Math.abs(p.y - (0.75 + atmosphere.contact.lift)) < 1e-6);
  shadows.update([z], 0); shadows.mesh.getMatrixAt(0, matrix); p.setFromMatrixPosition(matrix);
  assert.equal(p.x, 0); assert.ok(Math.abs(p.y - atmosphere.contact.lift) < 1e-6);
  shadows.update([{ ...z, removed: true }, { ...z, state: 'spawning' }, { ...z, state: 'dead' },
    { ...z, position: new THREE.Vector3(2, 4, 0) }]);
  assert.equal(shadows.mesh.count, 0);
  shadows.update(Array(atmosphere.contact.maxZombies + 5).fill(z));
  assert.equal(shadows.mesh.count, atmosphere.contact.maxZombies);
  shadows.clear(); assert.equal(shadows.mesh.count, 0);
  let freed = 0;
  for (const resource of [shadows.mesh.geometry, shadows.mesh.material, shadows.mesh.material.map]) {
    resource.addEventListener('dispose', () => freed++);
  }
  shadows.dispose(); assert.equal(freed, 3); assert.equal(scene.children.length, 0);
});

test('spatial ambience respects zones, distance, occlusion, listener direction, voice cap and pause', () => {
  let mix;
  const map = { zones: { room: { open: true }, closed: { open: false } }, ambience: [
    { id: 'right', kind: 'ventilation', zone: 'room', position: [3, 1.6, 0], range: 10 },
    { id: 'locked', kind: 'music', zone: 'closed', position: [0, 1.6, 1], range: 10 },
    { id: 'far', kind: 'music', zone: 'room', position: [0, 1.6, 20], range: 10 },
  ] };
  const player = { position: new THREE.Vector3(), height: 2, yaw: 0 }, colliders = [];
  const ambience = createAmbience({ map, player, colliders, sound: { setAmbience: v => { mix = v; } } });
  ambience.update(1 / 60, true);
  assert.equal(mix.length, 1); assert.equal(mix[0].id, 'right'); assert.equal(mix[0].pan, 1);
  const unobstructed = mix[0].gain;
  colliders.push(bounds([1, 0, -1], [1.2, 3, 1]));
  ambience.update(1 / 60, true);
  assert.equal(mix[0].gain, unobstructed * atmosphere.ambience.occludedGain);
  player.yaw = Math.PI; ambience.update(1 / 60, true); assert.equal(mix[0].pan, -1);
  for (let i = 0; i < 6; i++) map.ambience.push({ ...map.ambience[0], id: `extra${i}` });
  ambience.update(1 / 60, true); assert.equal(mix.length, atmosphere.ambience.maxVoices);
  ambience.update(1 / 60, false); assert.deepEqual(mix, []);
  ambience.update(1 / 60, true); ambience.reset(); assert.deepEqual(mix, []);
});

test('real game silences ambience on pause, death and Play again without changing the map', () => {
  let mix;
  const t = headlessGame({ sound: { play() {}, setAmbience(v) { mix = v; } } });
  t.tick(); assert.ok(mix.length > 0);
  t.g.state.forceRun = false; t.tick(); assert.deepEqual(mix, []);
  t.g.state.forceRun = true; t.tick(); assert.ok(mix.length > 0);
  t.g.health.takeDamage(1e6); assert.deepEqual(mix, []);
  t.g.contactShadows.mesh.count = 1;
  t.g.resetRun(); assert.deepEqual(mix, []); assert.equal(t.g.contactShadows.mesh.count, 0);
  assert.equal(t.g.map.zones.hallway.open, false);
});

test('occasional rattles come from closed shutters and their timer freezes while paused', () => {
  const calls = [], door = { position: new THREE.Vector3(-2, 1.6, 0), isOpen: false };
  const ambience = createAmbience({
    map: { doors: [door], zones: {}, ambience: [] }, colliders: [], random: () => 0,
    player: { position: new THREE.Vector3(), height: 2, yaw: 0 },
    sound: { playAmbient: (...args) => calls.push(args) },
  });
  ambience.update(atmosphere.ambience.rattleMaxSeconds * 2, false);
  ambience.update(atmosphere.ambience.rattleMinSeconds - 1, true); assert.equal(calls.length, 0);
  ambience.update(1, true); assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'shutterRattle'); assert.equal(calls[0][1].pan, -1);
  door.isOpen = true;
  ambience.update(atmosphere.ambience.rattleMaxSeconds, true); assert.equal(calls.length, 1);
});

test('local ambient events wait for unlock and range, freeze on pause, and restart their countdown on reset', () => {
  const calls = [], player = { position: new THREE.Vector3(), height: 2, yaw: 0 };
  const map = { zones: { outside: { open: false } }, doors: [], ambience: [], ambientEvents: [
    { id: 'sign', sound: 'looseSignRattle', zone: 'outside', position: [2, 1.6, 0], range: 10,
      minSeconds: 3, maxSeconds: 3, gain: .4 },
  ] };
  const ambience = createAmbience({ map, player, colliders: [], random: () => 0,
    sound: { playAmbient: (...args) => calls.push(args) } });
  ambience.update(30, true); assert.equal(calls.length, 0, 'locked');
  map.zones.outside.open = true; player.position.x = 20;
  ambience.update(30, true); assert.equal(calls.length, 0, 'out of range');
  player.position.x = 0; ambience.update(2, true);
  ambience.update(30, false); assert.equal(calls.length, 0, 'paused');
  ambience.update(1, true); assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'looseSignRattle'); assert.ok(calls[0][1].volume > 0 && calls[0][1].volume <= .4);
  ambience.update(2, true); ambience.reset(); ambience.update(1, true); assert.equal(calls.length, 1);
  ambience.update(2, true); assert.equal(calls.length, 2, 'fresh countdown');
  ambience.update(100, true); assert.equal(calls.length, 3, 'no backlog burst');
});

test('spatial ambience applies authored gain and smooth pulses within the shared voice cap', () => {
  let mix;
  const map = { zones: { outside: { open: true } }, doors: [], ambience: [
    { id: 'traffic', kind: 'distantTraffic', zone: 'outside', position: [0, 1.6, 0], range: 20,
      gain: .4, pulse: { period: 4, depth: .5 } },
  ] };
  const ambience = createAmbience({ map, player: { position: new THREE.Vector3(), height: 2, yaw: 0 }, colliders: [],
    sound: { setAmbience: v => { mix = v; } } });
  ambience.update(1, true); const quiet = mix[0].gain;
  ambience.update(2, true); const loud = mix[0].gain;
  assert.ok(quiet > 0 && quiet < loud && loud <= .4);
  ambience.reset(); ambience.update(1, true); assert.equal(mix[0].gain, quiet, 'pulse timeline resets');
});

test('Web Audio ambience reuses voices, fades and disconnects them even if paused while the context is suspended', () => {
  const sources = [], nodes = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } });
  const node = () => {
    const n = { gain: param(), frequency: param(), pan: param(), Q: param(), threshold: param(), ratio: param(),
      connect() {}, disconnect() { this.disconnected = true; }, start() {}, stop(t) { this.stopped = t; } };
    nodes.push(n); return n;
  };
  let context;
  class AudioContext {
    constructor() { context = this; this.state = 'running'; this.currentTime = 1; this.sampleRate = 16; this.destination = {}; }
    createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
    createDynamicsCompressor = node;
    createGain = node;
    createBiquadFilter = node;
    createStereoPanner = node;
    createBufferSource() { const s = node(); sources.push(s); return s; }
    createOscillator() { const s = node(); sources.push(s); return s; }
  }
  const previous = window.AudioContext;
  window.AudioContext = AudioContext;
  try {
    const sound = createSound(); sound.unlock();
    const mix = [{ id: 'vent', kind: 'ventilation', gain: 1, pan: 0 }];
    sound.setAmbience(mix); sound.setAmbience(mix); assert.equal(sources.length, 1);
    context.state = 'suspended'; sound.setAmbience([]);
    assert.ok(sources[0].stopped > context.currentTime);
    sources[0].onended(); assert.equal(nodes.slice(-4).every(n => n.disconnected), true);
    context.state = 'running'; sound.setAmbience(mix); assert.equal(sources.length, 2);
    sound.setAmbience([]); sources[1].onended();
    sound.playAmbient('shutterRattle');
    const newSources = sources.slice(2); assert.ok(newSources.length > 0);
    for (const s of newSources) s.onended();
    assert.ok(nodes.filter(n => n.pan).slice(-1)[0].disconnected);
    sound.setAmbience([{ id: 'relay', kind: 'projectorRelay', gain: 1, pan: 0 }]);
    const firstTick = sources.at(-1); assert.equal(firstTick.loop, true);
    const pulseBuffer = firstTick.buffer; sound.setAmbience([]); firstTick.onended();
    sound.setAmbience([{ id: 'relay', kind: 'projectorRelay', gain: 1, pan: 0 }]);
    const secondTick = sources.at(-1); assert.equal(secondTick.buffer, pulseBuffer, 'relay buffer is reused when returning to the cinema');
    sound.setAmbience([]); secondTick.onended(); assert.ok(secondTick.disconnected);
    for (const name of ['looseSignRattle', 'distantPa', 'distantTrafficPass']) {
      const first = sources.length; sound.playAmbient(name, { volume: .5, pan: -.3 });
      const emitted = sources.slice(first); assert.ok(emitted.length > 0, `${name} synthesizes audio`);
      for (const source of emitted) source.onended();
      assert.ok(emitted.every(source => source.disconnected), `${name} releases its sources`);
      assert.ok(nodes.filter(n => n.pan).at(-1).disconnected, `${name} releases its spatial panner`);
    }
  } finally { window.AudioContext = previous; }
});

// A zombie's shadow does not read the whole collider list every frame: it keeps the few colliders around where it last
// looked. The shadow must still be exactly the one a full scan gives, wherever it walks and whenever a door changes the list.
test('contact shadows: the same shadow as a full scan along a walk through the real mall, for a fraction of the collider reads', () => {
  const t = headlessGame(), { g } = t;
  t.tick(); g.debug.run('doors'); t.tick(400);
  const colliders = g.colliders;
  const kept = createContactShadows(new THREE.Scene(), colliders), full = createContactShadows(new THREE.Scene(), colliders);
  const a = new THREE.Matrix4(), b = new THREE.Matrix4();
  const walker = { state: 'chasing', position: new THREE.Vector3(), prevPosition: new THREE.Vector3() };
  // Start room -> hallway -> the foot of the escalator, up its surface, then along level 2: 6 cm steps (a zombie's frame).
  const ramp = g.map.escalator.ramp;
  const rampX = (ramp.minX + ramp.maxX) / 2, rampZ = (ramp.minZ + ramp.maxZ) / 2;
  const along = (s) => (ramp.axis === 'x' ? [ramp.minX + (ramp.maxX - ramp.minX) * s, rampZ] : [rampX, ramp.minZ + (ramp.maxZ - ramp.minZ) * s]);
  const legs = [
    (s) => [0, 0, 12 - 10 * s], (s) => [-14 * s, 0, 2], // the start room, the hallway
    (s) => { const [x, z] = along(s); return [x, rampHeightAt(ramp, x, z) ?? 0, z]; }, // riding the escalator
    (s) => [-8 + 16 * s, 6.3, 1], () => [8, 6.3, 1], // level 2, then standing still
  ];
  let frames = 0, shown = 0;
  const heights = new Set();
  for (const [leg, at] of legs.entries()) {
    for (let i = 0; i <= 250; i++) {
      walker.prevPosition.copy(walker.position);
      walker.position.set(...at(i / 250));
      kept.update([walker]);
      full.update([{ ...walker }]); // (a zombie never seen before has no colliders remembered: a full scan)
      assert.equal(kept.mesh.count, full.mesh.count, `leg ${leg} step ${i}: shown or not`);
      frames++;
      if (!kept.mesh.count) continue;
      shown++;
      kept.mesh.getMatrixAt(0, b); full.mesh.getMatrixAt(0, a);
      assert.deepEqual(b.elements, a.elements, `leg ${leg} step ${i}: the same shadow as a full scan`);
      heights.add(Math.round(b.elements[13]));
    }
  }
  assert.ok(shown > frames * 0.5 && heights.size >= 4, `${shown} of ${frames} frames drew a shadow, on ${heights.size} heights`);

  // How often a collider is looked at (through each box's `max`): far less than every collider every frame.
  let reads = 0;
  for (const box of colliders) { const max = box.max; Object.defineProperty(box, 'max', { configurable: true, get() { reads++; return max; } }); }
  const again = createContactShadows(new THREE.Scene(), colliders);
  const stroll = { state: 'chasing', position: new THREE.Vector3(0, 0, 12), prevPosition: new THREE.Vector3(0, 0, 12) };
  for (let i = 0; i < 200; i++) { stroll.prevPosition.copy(stroll.position); stroll.position.z -= 0.05; again.update([stroll]); }
  assert.ok(reads < colliders.length * 200 * 0.25, `${reads} collider looks in 200 frames (a full scan each frame: at least ${colliders.length * 200})`);

  // A collider list that changes is noticed at once (a door: markCollidersChanged), even under a zombie standing still.
  again.update([stroll]); again.mesh.getMatrixAt(0, b);
  const floorY = b.elements[13];
  const crate = bounds([stroll.position.x - 1, 0, stroll.position.z - 1], [stroll.position.x + 1, 0.05, stroll.position.z + 1]);
  colliders.push(crate); markCollidersChanged(colliders);
  again.update([stroll]); again.mesh.getMatrixAt(0, b);
  assert.ok(Math.abs(b.elements[13] - floorY - 0.05) < 1e-6, 'the shadow steps up onto a box that appeared under it');
  crate.max.y = 0.07; // (a box changing HEIGHT in place, as a rolling shutter does, needs no notice)
  again.update([stroll]); again.mesh.getMatrixAt(0, b);
  assert.ok(Math.abs(b.elements[13] - floorY - 0.07) < 1e-6);
  kept.dispose(); full.dispose(); again.dispose();
});
