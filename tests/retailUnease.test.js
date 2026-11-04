import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/headlessGame.js';
import * as THREE from 'three';
import { buildRetailUnease } from '../src/game/features/retailUnease.js';
import { retailUnease as cfg } from '../src/config/retailUnease.js';
import { look } from '../src/config/look.js';
import { atmosphere } from '../src/config/environment.js';
import { createAmbience } from '../src/game/ambience.js';
import { batchStatic } from '../src/world/staticBatch.js';

function scene() {
  const group = new THREE.Group();
  const head = new THREE.Group(); head.name = 'retail_unease_head'; head.userData.dynamic = true; head.position.y = 1.6;
  const figure = new THREE.Mesh(new THREE.PlaneGeometry(.3, 1.6), new THREE.MeshStandardMaterial());
  figure.name = 'retail_unease_silhouette'; figure.userData.dynamic = true; figure.position.z = -9; figure.visible = false;
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(.5, .3), new THREE.MeshStandardMaterial()); tv.name = 'television_screen'; tv.position.set(0, 1.6, -2);
  group.add(head, figure, tv);
  const secondTV = tv.clone(); secondTV.position.x = .5; group.add(secondTV);
  const map = { group, zones: { atrium: { open: true } } }, player = { position: new THREE.Vector3(0, 0, 5), yaw: 0, pitch: 0, eyeHeight: 1.6 };
  const rounds = { inBreak: true }, effect = buildRetailUnease({ map, player, rounds });
  return { head, figure, tv, map, player, rounds, effect };
}

test('display changes require a previous sighting, an extended look away, proximity and a quiet interval', () => {
  const s = scene();
  s.player.yaw = Math.PI; s.effect.update(cfg.headCooldown + 1);
  assert.equal(s.head.rotation.y, 0, 'not seen yet');
  s.player.yaw = 0; s.effect.update(.1);
  s.player.yaw = Math.PI; s.rounds.inBreak = false; s.effect.update(cfg.awaySeconds + 1);
  assert.equal(s.head.rotation.y, 0, 'never turns during combat');
  s.rounds.inBreak = true; s.effect.update(.1);
  assert.equal(s.head.rotation.y, cfg.headAngle);
  s.effect.reset(); assert.equal(s.head.rotation.y, 0);
  s.player.position.z = 100; s.effect.update(500); assert.equal(s.figure.visible, false);
});

test('distant silhouette is brief; batching preserves anomalies and comfort/reset restore the ordinary displays', () => {
  const s = scene(), saved = look.runtime.horror;
  try {
    const texture = s.tv.material.map, version = texture.version; batchStatic(s.map.group);
    s.effect.update(cfg.silhouetteSeconds + 1); assert.equal(s.figure.visible, true);
    assert.equal(texture.version, version, 'a watched TV feed never switches, even after batching');
    s.effect.update(cfg.silhouetteDuration + 1); assert.equal(s.figure.visible, false);
    s.player.yaw = Math.PI; s.effect.update(cfg.awaySeconds + 1); assert.notEqual(s.head.rotation.y, 0);
    assert.ok(texture.version > version, 'the shared feed changes when no longer watched');
    look.runtime.horror = false; s.effect.update(.1);
    assert.equal(s.head.rotation.y, 0); assert.equal(s.figure.visible, false);
    assert.equal(s.tv.material.map, texture, 'reset reuses the owned texture');
    s.effect.reset(); assert.equal(s.figure.position.x, 0);
  } finally { look.runtime.horror = saved; }
});

test('unsettling local sounds respect zone ownership, pause and comfort/atmosphere switches', () => {
  const calls = [], saved = look.runtime.horror, ambient = atmosphere.ambient.enabled;
  const map = { zones: { atrium: { open: false } }, ambientEvents: [{ unsettling: true, zone: 'atrium',
    position: [0, 1, 1], range: 10, sound: 'backroomPhone', minSeconds: 1, maxSeconds: 1 }] };
  const sound = { setAmbience() {}, playAmbient: (...args) => calls.push(args) };
  const mix = createAmbience({ map, player: { position: new THREE.Vector3(), height: 1.8, yaw: 0 }, sound, colliders: [], random: () => 0 });
  try {
    mix.update(5, true); assert.equal(calls.length, 0);
    map.zones.atrium.open = true; mix.update(5, false); assert.equal(calls.length, 0);
    look.runtime.horror = false; mix.update(5, true); assert.equal(calls.length, 0);
    look.runtime.horror = true; atmosphere.ambient.enabled = false; mix.update(5, true); assert.equal(calls.length, 0);
    atmosphere.ambient.enabled = true; mix.update(1.1, true); assert.equal(calls[0][0], 'backroomPhone');
    mix.reset(); mix.update(.1, true); assert.equal(calls.length, 1);
  } finally { look.runtime.horror = saved; atmosphere.ambient.enabled = ambient; }
});
