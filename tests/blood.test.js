// Zombie splatter (feel.effects.blood, Settings > Comfort > Zombie splatter): confetti is the DEFAULT (the zombie's own
// bright colors, exactly as before); red = cartoon blood that leaves floor stains and corpse puddles; off = nothing.
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

test('confetti mode: a zombie hit sprays its own colors, exactly as before, and leaves no stains', () => {
  const { scene, fx } = make();
  fx.splat(new THREE.Vector3(0, 1, 0), UP, GREEN, 14, { flesh: true });
  fx.update(0);
  assert.equal(fx.counts.particles, 14);
  const wanted = new Set(GREEN.map((hex) => new THREE.Color(hex).getHexString()));
  for (const c of particleColors(scene)) assert.ok(wanted.has(c.getHexString()), 'the zombie\'s own colors');
  settle(fx, 3);
  assert.equal(fx.counts.stains, 0);
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

test('red droplets that land leave floor stains (confetti never does), capped, and they fade away', () => {
  inMode('red', () => {
    const { fx } = make();
    fx.splat(new THREE.Vector3(0, 0.3, 0), UP, GREEN, 20, { flesh: true });
    settle(fx, 1);
    assert.ok(fx.counts.stains > 0, `${fx.counts.stains} stains from one hit`);
    // Many hits: never more than the cap.
    for (let i = 0; i < 80; i++) fx.splat(new THREE.Vector3(i * 0.1, 0.2, 0), UP, GREEN, 26, { flesh: true });
    settle(fx, 1);
    assert.ok(fx.counts.stains <= FX.maxStains, `capped at ${FX.maxStains}: ${fx.counts.stains}`);
    settle(fx, FX.stainSeconds + FX.fadeSeconds + 1);
    assert.equal(fx.counts.stains, 0, 'every stain faded away');
  }, { stainChance: 1 });
  inMode('confetti', () => {
    const { fx } = make();
    fx.splat(new THREE.Vector3(0, 0.3, 0), UP, GREEN, 20, { flesh: true });
    settle(fx, 2);
    assert.equal(fx.counts.stains, 0);
  }, { stainChance: 1 });
});

test('stains are splat-shaped, not squares: textured transparent planes in several different shapes', () => {
  inMode('red', () => {
    const { scene, fx } = make();
    const meshes = scene.children.filter((c) => c.isInstancedMesh && c.name.startsWith('stains_'));
    assert.equal(meshes.length, FX.splatVariants + 1, 'a few splat shapes plus the puddle');
    // A real spray uses more than one of them (and the textures are drawn the first time a stain appears).
    for (let i = 0; i < 20; i++) fx.splat(new THREE.Vector3(i * 0.2, 0.2, 0), UP, GREEN, 26, { flesh: true });
    fx.puddle(0, 0);
    settle(fx, 1);
    const textures = new Set();
    for (const mesh of meshes) {
      assert.equal(mesh.geometry.type, 'PlaneGeometry', 'flat, not a box');
      assert.ok(mesh.material.map && mesh.material.transparent, 'an irregular shape cut out of a transparent texture');
      textures.add(mesh.material.map.uuid);
    }
    assert.equal(textures.size, meshes.length, 'every shape has its own texture');
    const used = meshes.filter((m) => m.name !== 'stains_puddle' && m.count > 0).length;
    assert.ok(used >= 2, `${used} different splat shapes in use`);
  }, { stainChance: 1 });
});

test('a corpse leaves a puddle in red mode only, it spreads out, and clear() removes everything', () => {
  inMode('red', () => {
    const { scene, fx } = make();
    fx.puddle(2, 3);
    assert.equal(fx.counts.stains, 1);
    const stains = scene.getObjectByName('stains_puddle');
    const widthAt = (seconds) => {
      settle(fx, seconds);
      const m = new THREE.Matrix4();
      stains.getMatrixAt(0, m);
      return new THREE.Vector3().setFromMatrixScale(m).x;
    };
    const early = widthAt(0.3);
    const grown = widthAt(FX.puddleGrowSeconds);
    assert.ok(grown > early * 2, `spreads out: ${early.toFixed(2)} -> ${grown.toFixed(2)} m`);
    fx.clear();
    assert.equal(fx.counts.stains, 0);
  });
  for (const mode of ['confetti', 'off']) {
    inMode(mode, () => {
      const { fx } = make();
      fx.puddle(0, 0);
      assert.equal(fx.counts.stains, 0, mode);
    });
  }
});

test('the real game: a dying zombie bursts and leaves its puddle only in red mode', () => {
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
    return { burst: g.effects.counts.particles - before, stains: g.effects.counts.stains };
  };
  const confetti = inMode('confetti', kill);
  const red = inMode('red', kill);
  const off = inMode('off', kill);
  assert.ok(confetti.burst >= zombieTypes.shopper.deathSplatCount && confetti.stains === 0, 'confetti: its burst, no puddle');
  assert.ok(red.burst > confetti.burst && red.stains === 1, 'red: a bigger burst and one puddle');
  assert.equal(off.burst, 0);
  assert.equal(off.stains, 0);
});
