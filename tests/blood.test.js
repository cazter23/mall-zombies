// Zombie splatter (feel.effects.blood, Settings > Comfort > Zombie splatter): confetti is the DEFAULT (the zombie's own
// bright colors, exactly as before); red = cartoon blood droplets and ONE pool of blood under each corpse; off = nothing.
// Dust and other non-flesh puffs never change. Checked on the real effects, and in the real game when a zombie dies.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals settings.js reads)
import { createEffects } from '../src/fx/effects.js';
import { feel } from '../src/config/feel.js';
import { settingDefs } from '../src/config/settings.js';
import { zombieTypes } from '../src/config/zombies.js';

const FX = feel.effects.blood;
const GREEN = zombieTypes.shopper.splatColors;
const UP = new THREE.Vector3(0, 1, 0);

function inMode(mode, fn, overrides = {}) {
  const saved = { mode: FX.mode, ...Object.fromEntries(Object.keys(overrides).map((k) => [k, FX[k]])) };
  FX.mode = mode;
  Object.assign(FX, overrides);
  try {
    return fn();
  } finally {
    Object.assign(FX, saved);
  }
}

const make = () => {
  const scene = new THREE.Scene();
  return { scene, fx: createEffects(scene) };
};
// The colors of the live particles (needs an update to be written).
function particleColors(scene) {
  const [particles] = scene.children.filter((c) => c.isInstancedMesh);
  const out = [];
  const c = new THREE.Color();
  for (let i = 0; i < particles.count; i++) { particles.getColorAt(i, c); out.push(c.clone()); }
  return out;
}
const isRed = (c) => c.r > 2 * Math.max(c.g, c.b) + 0.05;
const settle = (fx, seconds = 3, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) fx.update(dt); };

test('splatter is CONFETTI by default (config and settings), and the setting offers confetti / red / off', () => {
  assert.equal(FX.mode, 'confetti');
  const def = settingDefs.find((d) => d.id === 'splatter');
  assert.equal(def.default, 'confetti');
  assert.deepEqual(def.options.map((o) => o.value), ['confetti', 'red', 'off']);
  const saved = FX.mode;
  def.apply('red');
  assert.equal(FX.mode, 'red');
  def.apply('off');
  assert.equal(FX.mode, 'off');
  def.apply(saved);
});

test('confetti mode: a zombie hit sprays its own colors, exactly as before, and leaves no pool', () => {
  const { scene, fx } = make();
  fx.splat(new THREE.Vector3(0, 1, 0), UP, GREEN, 14, { flesh: true });
  fx.update(0);
  assert.equal(fx.counts.particles, 14);
  const wanted = new Set(GREEN.map((hex) => new THREE.Color(hex).getHexString()));
  for (const c of particleColors(scene)) assert.ok(wanted.has(c.getHexString()), 'the zombie\'s own colors');
  settle(fx, 3);
  assert.equal(fx.counts.pools, 0);
});

test('red mode: more droplets, all red; the same chunky cubes', () => {
  inMode('red', () => {
    const { scene, fx } = make();
    fx.splat(new THREE.Vector3(0, 1, 0), UP, GREEN, 14, { flesh: true });
    fx.update(0);
    assert.equal(fx.counts.particles, Math.round(14 * FX.countScale));
    assert.ok(particleColors(scene).every(isRed), 'every droplet is red');
  });
});

test('off mode: a zombie hit sprays nothing', () => {
  inMode('off', () => {
    const { fx } = make();
    fx.splat(new THREE.Vector3(0, 1, 0), UP, GREEN, 14, { flesh: true });
    assert.equal(fx.counts.particles, 0);
  });
});

test('things that are not flesh (spawn dust, wall puffs) never change with the setting', () => {
  for (const mode of ['confetti', 'red', 'off']) {
    inMode(mode, () => {
      const { scene, fx } = make();
      fx.splat(new THREE.Vector3(0, 1, 0), UP, [0xb8b0a4], 8); // no { flesh: true }
      fx.update(0);
      assert.equal(fx.counts.particles, 8, mode);
      assert.ok(particleColors(scene).every((c) => c.getHexString() === 'b8b0a4'), mode);
    });
  }
});

test('red droplets are only droplets: they never leave scattered stains on the floor', () => {
  inMode('red', () => {
    const { fx } = make();
    for (let i = 0; i < 40; i++) fx.splat(new THREE.Vector3(i * 0.1, 0.3, 0), UP, GREEN, 26, { flesh: true });
    settle(fx, 3);
    assert.equal(fx.counts.particles, 0, 'the droplets are gone');
    assert.equal(fx.counts.pools, 0, 'and left nothing behind: only a corpse makes a pool');
  });
});

test('a corpse leaves ONE pool of blood in red mode only; it spreads out, then fades; clear() removes it', () => {
  inMode('red', () => {
    const { scene, fx } = make();
    fx.pool(2, 3);
    assert.equal(fx.counts.pools, 1);
    const widthNow = () => {
      for (const mesh of scene.children.filter((c) => c.isInstancedMesh && c.name.startsWith('pools_'))) {
        if (mesh.count > 0) {
          const m = new THREE.Matrix4();
          mesh.getMatrixAt(0, m);
          return new THREE.Vector3().setFromMatrixScale(m).x;
        }
      }
      return 0;
    };
    settle(fx, 0.3);
    const early = widthNow();
    settle(fx, FX.poolGrowSeconds);
    const grown = widthNow();
    assert.ok(grown > early * 2, `spreads out: ${early.toFixed(2)} -> ${grown.toFixed(2)} m`);
    assert.ok(grown > FX.poolRadius * 2, 'a pool bigger than the body is wide');
    settle(fx, FX.poolSeconds);
    assert.equal(fx.counts.pools, 0, 'it faded away');
    fx.pool(0, 0);
    fx.clear();
    assert.equal(fx.counts.pools, 0);
  });
  for (const mode of ['confetti', 'off']) {
    inMode(mode, () => {
      const { fx } = make();
      fx.pool(0, 0);
      assert.equal(fx.counts.pools, 0, mode);
    });
  }
});

test('the pool is a smooth textured plane (not a square), in a few different shapes, capped in number', () => {
  inMode('red', () => {
    const { scene, fx } = make();
    const meshes = scene.children.filter((c) => c.isInstancedMesh && c.name.startsWith('pools_'));
    assert.equal(meshes.length, FX.poolVariants);
    for (let i = 0; i < 60; i++) fx.pool(i * 0.5, 0);
    fx.update(0.1);
    assert.equal(fx.counts.pools, FX.maxPools, 'the oldest are replaced beyond the cap');
    const textures = new Set();
    for (const mesh of meshes) {
      assert.equal(mesh.geometry.type, 'PlaneGeometry', 'flat, not a box');
      assert.ok(mesh.material.map && mesh.material.transparent, 'an organic outline cut out of a transparent texture');
      textures.add(mesh.material.map.uuid);
    }
    assert.equal(textures.size, meshes.length, 'every shape has its own texture');
    assert.ok(meshes.filter((m) => m.count > 0).length >= 2, 'corpses do not all leave the same shape');
  });
});

test('the real game: a dying zombie bursts and leaves its pool only in red mode', () => {
  const kill = () => {
    const t = headlessGame();
    const { g } = t;
    t.tick(1);
    g.zombies.clear();
    g.rounds.update = () => {};
    const z = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 0));
    z.position.set(0, 0, 9);
    z.state = 'chasing';
    z.speed = 0;
    z.updateHitboxes();
    const before = g.effects.counts.particles;
    z.takeHit({ damage: 99999, part: 'body', point: new THREE.Vector3(0, 1, 9) });
    return { burst: g.effects.counts.particles - before, pools: g.effects.counts.pools };
  };
  const confetti = inMode('confetti', kill);
  const red = inMode('red', kill);
  const off = inMode('off', kill);
  assert.ok(confetti.burst >= zombieTypes.shopper.deathSplatCount && confetti.pools === 0, 'confetti: its burst, no pool');
  assert.ok(red.burst > confetti.burst && red.pools === 1, 'red: a bigger burst and one pool');
  assert.equal(off.burst, 0);
  assert.equal(off.pools, 0);
});
