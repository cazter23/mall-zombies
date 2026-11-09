// The Wardrobe showpieces (maps/mall/wardrobeShowpieces/): the three Food Court ones. Placement rules (clear approach, no spawn lane,
// prompt focus, standable, coplanar), the idle motion, the buying moment, the sold-out state and the motif, all through the real game.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { feel } from '../src/config/feel.js';
import { showpieces as cfg, wardrobeItems } from '../src/config/wardrobe.js';
import { overlapsSolid } from '../src/world/collision.js';

const IDS = ['paperHat', 'wheelieSneakers', 'foamFinger'];
const holdTicks = Math.ceil(feel.interact.holdSeconds / dt) + 1;

function scenario(t) {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  game.tick();
  game.g.rounds.update = () => {};
  game.g.zombies.clear();
  return game;
}

const spotOf = (g, id) => g.map.features.find((f) => f.kind === 'wardrobeRack' && f.item === id);
function standAt(game, spot, distance = 0.8) {
  const position = spot.position.clone().addScaledVector(spot.normal, distance).setY(0);
  game.g.player.teleport({ position, yaw: Math.atan2(spot.normal.x, spot.normal.z) });
  game.tick();
  return position;
}
const footprint = (position, r) => ({ minX: position.x - r, maxX: position.x + r, minZ: position.z - r, maxZ: position.z + r });

// Every flat face of an axis-aligned box or plane mesh, in world space.
function faces(mesh) {
  const type = mesh.geometry.type;
  if (type !== 'BoxGeometry' && type !== 'PlaneGeometry') return [];
  for (let o = mesh; o; o = o.parent) if (o.rotation.x || o.rotation.y || o.rotation.z || o.scale.x !== 1 || o.scale.y !== 1 || o.scale.z !== 1) return [];
  mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld); // (the piece alone, not its children)
  const out = [];
  const look = mesh.material.map ? `map:${mesh.material.map.uuid}` : `${mesh.material.color?.getHexString?.()}|${mesh.material.emissiveIntensity}`;
  const axes = ['x', 'y', 'z'];
  for (let a = 0; a < 3; a++) {
    const [u, v] = axes.filter((_, i) => i !== a);
    for (const dir of (type === 'PlaneGeometry' ? (a === 2 ? [1] : []) : [-1, 1])) {
      out.push({ mesh, axis: axes[a], c: dir < 0 ? b.min[axes[a]] : b.max[axes[a]], dir, lo: [b.min[u], b.min[v]], hi: [b.max[u], b.max[v]], look });
    }
  }
  return out;
}

test('each showpiece has a clear 2.4 m approach, the shop door stays open, nothing sits in a spawn lane, and the three prompts never compete', (t) => {
  const game = scenario(t), { g } = game;
  g.debug.run('doors');
  game.tick(120);
  const spots = IDS.map((id) => spotOf(g, id));
  for (const spot of spots) {
    assert.ok(spot.showpiece, `${spot.name} is a showpiece`);
    assert.ok(g.map.group.getObjectByName(spot.name), `${spot.name} is in the map`);
    // A clear 2.4 m approach: straight in, or along the front from either side (a stall's counter is approached along its queue lane).
    const right = new THREE.Vector3(spot.normal.z, 0, -spot.normal.x);
    const paths = [[spot.normal, 0], [right, 0.8], [right.clone().negate(), 0.8]].map(([dir, out]) => {
      const base = spot.position.clone().addScaledVector(spot.normal, out || 0.8).setY(0);
      const dist = out ? 2.4 : 2.4;
      return [0.8, 1.2, 1.6, 2.0, 2.4].filter((d) => d <= dist).every((d) => {
        const at = out ? base.clone().addScaledVector(dir, d) : spot.position.clone().addScaledVector(dir, d).setY(0);
        return !overlapsSolid(at, feel.player.radius, feel.player.height, g.colliders, 0);
      });
    });
    assert.ok(paths.some(Boolean), `${spot.name}: no clear 2.4 m approach (in / left / right: ${paths})`);
    assert.equal(overlapsSolid(standAt(game, spot, 0.8), feel.player.radius, feel.player.height, g.colliders, 0), false, `${spot.name} buying spot`);
    for (const s of g.map.spawnPoints.filter((p) => p.zone === 'foodCourt')) {
      assert.ok(Math.hypot(s.position.x - spot.position.x, s.position.z - spot.position.z) > 2.5, `${spot.name} sits in the lane of ${s.name}`);
    }
    // The prompt is its own item's, from where you would buy it.
    standAt(game, spot, 0.8);
    assert.equal(g.interactions.prompt?.id, spot.item, spot.name);
  }
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
    assert.ok(spots[i].position.distanceTo(spots[j].position) >= 1.2, `${spots[i].item} / ${spots[j].item} prompts`);
  }
  // Good Sports' door (x -14.5..-11.5) stays open into the court: none of the showpieces' solids (the ramp, its sign post, the bin)
  // reaches into the lane in front of it. (The court's own clutter is not this test's business.)
  for (const id of ['wheelieSneakers']) {
    const area = footprint(spotOf(g, id).position, 1.6);
    for (const b of g.colliders.filter((c) => c.max.x > area.minX && c.min.x < area.maxX && c.max.z > area.minZ && c.min.z < area.maxZ && c.min.z > -14.0 && c.max.y > 0.05)) {
      assert.ok(b.max.x <= -14.5 || b.min.x >= -11.5, `${id}: a solid reaches into the shop's door lane`);
    }
  }
});

test('each showpiece is readable from the Food Court entrance: a clear line from across the doorway to its tallest part', (t) => {
  const game = scenario(t), { g } = game;
  const tops = { paperHat: [-5.75, 5.4, -13.45], wheelieSneakers: [-9.95, 2.4, -12.4], foamFinger: [-15, 3.1, -10.0] }; // (the burger lid, the NO RUNNING sign, the fingertip)
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  for (const id of IDS) {
    for (const x of [-3, 0, 3]) { // across the 7 m doorway
      const eye = new THREE.Vector3(x, feel.player.eyeHeight, -2.7);
      const target = new THREE.Vector3(...tops[id]);
      ray.set(eye, target.clone().sub(eye).normalize());
      const reach = eye.distanceTo(target) - 0.05;
      const blocker = g.colliders.find((b) => ray.intersectBox(b, hit) && hit.distanceTo(eye) < reach);
      assert.ok(!blocker, `${id} from x ${x}: blocked by a solid at ${blocker?.min.toArray().map((n) => n.toFixed(1))}`);
    }
  }
});

test('the burger stays under the 6 m ceiling at the top of its idle bob and its buying pose, and the duct above Burger Barn leaves it room', (t) => {
  const game = scenario(t), { g } = game;
  const spot = spotOf(g, 'paperHat');
  const root = g.map.group.getObjectByName(spot.name);
  let top = 0;
  const measure = () => { root.updateMatrixWorld(true); top = Math.max(top, new THREE.Box3().setFromObject(root.getObjectByName(`${root.name}_live`).children.find((c) => c.isGroup && c.children.some((m) => m.geometry?.type === 'SphereGeometry'))).max.y); };
  for (let i = 0; i < 240; i++) { spot.showpiece.update(dt); if (i % 4 === 0) measure(); }
  spot.showpiece.pose();
  for (let i = 0; i < 80; i++) { spot.showpiece.update(dt); measure(); }
  assert.ok(top < 5.98, `the lid reaches ${top.toFixed(2)} m`);
  assert.ok(top > 5.6, 'and it is the lid that was measured');
  // The Food Court's exhaust duct (y 5.51..5.85, z -13.8..-13.3) has a gap over the burger: the ray straight down the burger's axis
  // from the ceiling's underside meets the lid, not a duct.
  const ray = new THREE.Raycaster(new THREE.Vector3(spot.position.x, 5.99, -13.69), new THREE.Vector3(0, -1, 0), 0, 1.4);
  const first = ray.intersectObject(g.map.group, true).find((h) => h.object.visible);
  assert.ok(first, 'the burger is under the ray');
  let owner = first.object;
  while (owner && owner !== root) owner = owner.parent;
  assert.equal(owner, root, `the first thing below the ceiling is ${first.object.name || first.object.parent?.name || first.object.geometry.type}, not the burger`);
});

test('showpiece solids are standable by the rules: a step, a vaultable counter, or at least 2.1 m, and nothing climbable hides above', (t) => {
  const game = scenario(t), { g } = game;
  const { vault } = feel;
  for (const id of ['wheelieSneakers', 'foamFinger']) {
    const spot = spotOf(g, id);
    const area = footprint(spot.position, 1.6);
    const own = g.colliders.filter((b) => b.max.x > area.minX && b.min.x < area.maxX && b.max.z > area.minZ && b.min.z < area.maxZ && b.max.y > 0.05)
      .filter((b) => b.min.z > -14.0); // (not the shop's front wall)
    assert.ok(own.length > 0, `${id} has a base`);
    for (const b of own) {
      const height = b.max.y - b.min.y;
      const ok = height <= 0.35 || (b.vaultable && height <= vault.maxHeight && Math.min(b.max.x - b.min.x, b.max.z - b.min.z) <= vault.maxDepth) || height >= 2.1;
      assert.ok(ok, `${id}: a ${height.toFixed(2)} m solid is neither a step, a vaultable counter nor tall`);
    }
  }
  // The burger is decoration on the roof: nothing of it is solid, and it sits where no jump reaches.
  const burger = g.map.group.getObjectByName(spotOf(g, 'paperHat').name);
  const bounds = new THREE.Box3();
  for (const mesh of burger.getObjectByName(`${burger.name}_still`).children) {
    if (mesh.position.y > 4) bounds.expandByObject(mesh);
  }
  assert.ok(bounds.min.y >= 4.2, 'the roof platform is out of reach');
  assert.ok(!g.colliders.some((b) => b.min.x < -4.5 && b.max.x > -7 && b.min.z < -12.9 && b.max.z > -14.4 && b.max.y > 2.1 && b.min.y > 2.0 && b.min.y < 5.9), 'no collider was added up there');
});

test('no two faces of a showpiece (or against the mall around it) lie on the same plane with a different look', (t) => {
  const game = scenario(t), { g } = game;
  g.map.group.updateMatrixWorld(true);
  const all = [];
  g.map.group.traverse((o) => { if (o.isMesh && o.visible) all.push(...faces(o)); });
  for (const id of IDS) {
    const root = g.map.group.getObjectByName(spotOf(g, id).name);
    const mine = new Set();
    root.traverse((o) => { if (o.isMesh) mine.add(o); });
    const nearby = all.filter((f) => !mine.has(f.mesh));
    const own = all.filter((f) => mine.has(f.mesh));
    const area = new THREE.Box3().setFromObject(root).expandByScalar(0.1);
    for (const a of own) {
      for (const b of [...own, ...nearby]) {
        if (a === b || a.axis !== b.axis || a.dir !== b.dir || a.look === b.look || Math.abs(a.c - b.c) >= 0.004) continue;
        if (a.axis === 'y' && a.dir < 0) continue; // (a bottom face rests on what is under it: hidden)
        if (own.includes(b) && a.mesh.id > b.mesh.id) continue;
        const overlapU = Math.min(a.hi[0], b.hi[0]) - Math.max(a.lo[0], b.lo[0]);
        const overlapV = Math.min(a.hi[1], b.hi[1]) - Math.max(a.lo[1], b.lo[1]);
        if (overlapU * overlapV <= 0.0005 || overlapU <= 0 || overlapV <= 0) continue;
        const where = new THREE.Box3().setFromObject(b.mesh);
        if (!area.intersectsBox(where)) continue;
        assert.fail(`${id}: ${a.mesh.name || a.mesh.geometry.type} @${a.mesh.position.toArray().map((n) => n.toFixed(2))} and ${b.mesh.name || b.mesh.geometry.type} @${b.mesh.position.toArray().map((n) => n.toFixed(2))} share a ${a.axis}${a.dir} plane at ${a.c.toFixed(3)}`);
      }
    }
  }
});

test('unsold showpieces move; bought ones strike a pose, announce it, then go still, dim and read SOLD OUT; Play again brings them back', (t) => {
  const game = scenario(t), { g } = game;
  g.debug.run('doors');
  game.tick(120);
  g.wallet.earn(20000);
  const announced = [];
  g.events.on('wardrobeBuy', (e) => announced.push(e));
  const poseTicks = Math.ceil(cfg.poseSeconds / dt) + 2;
  const motion = (root) => {
    const live = root.getObjectByName(`${root.name}_live`);
    const parts = [];
    live.traverse((o) => { if (o !== live) parts.push(o.matrixWorld.elements.join()); });
    return parts;
  };
  const glows = (root) => {
    const list = [];
    root.traverse((o) => { if (o.isMesh && o.material.emissive && o.material.emissive.getHex() !== 0) list.push(o.material); });
    return list;
  };
  const cards = (root) => {
    const found = { visible: [], hidden: [] };
    root.getObjectByName(`${root.name}_live`).traverse((o) => { if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.material.map) found[o.visible ? 'visible' : 'hidden'].push(o); });
    return found;
  };

  for (const id of IDS) {
    const spot = spotOf(g, id);
    const handle = spot.showpiece;
    const root = g.map.group.getObjectByName(spot.name);
    standAt(game, spot);
    // alive while unsold
    root.updateMatrixWorld(true);
    const before = motion(root);
    game.tick(25);
    root.updateMatrixWorld(true);
    const after = motion(root);
    assert.ok(before.some((m, i) => m !== after[i]), `${id}: idle motion`);
    assert.equal(handle.soldOut, false);
    assert.equal(handle.dimmed, false);
    const lit = glows(root).map((m) => m.emissiveIntensity);
    assert.ok(lit.length > 0, `${id} glows`);

    // the buying moment
    const points = g.wallet.points;
    standAt(game, spot);
    game.press('KeyF', holdTicks);
    assert.equal(g.wardrobe.owns(id), true, `${id} bought`);
    assert.ok(g.wallet.points < points);
    assert.equal(handle.posing, true, `${id}: pose`);
    assert.equal(handle.dimmed, false, `${id}: still lit during the pose`);
    assert.equal(announced.at(-1)?.id, id);
    const line = game.hud.calls.filter(([name]) => name === 'showAnnouncement').at(-1)[1];
    assert.equal(line.text, wardrobeItems[id].pa.text);
    assert.equal(line.kicker, 'Attention shoppers');
    game.tick(poseTicks);

    // sold out
    assert.equal(handle.posing, false);
    assert.equal(handle.soldOut, true);
    assert.equal(handle.dimmed, true, `${id}: dim once owned`);
    glows(root).forEach((m, i) => assert.ok(m.emissiveIntensity < lit[i] * 0.5 && m.emissiveIntensity < 0.3, `${id}: glow ${i} dimmed`));
    const clock = handle.clock;
    root.updateMatrixWorld(true);
    const rest = motion(root);
    game.tick(40);
    root.updateMatrixWorld(true);
    assert.equal(handle.clock, clock, `${id}: the clock stopped`);
    assert.deepEqual(motion(root), rest, `${id}: nothing moves once sold`);
    const shown = cards(root);
    assert.ok(shown.visible.length > 0 && shown.hidden.length > 0, `${id}: one card shown, one hidden`);
    assert.equal(g.interactions.prompt?.id === id, false, `${id}: no prompt once owned`);
  }

  // Play again: all three are unsold, lit and moving again.
  g.resetRun();
  game.tick(2);
  for (const id of IDS) {
    const spot = spotOf(g, id);
    assert.equal(spot.showpiece.soldOut, false, `${id} reset`);
    assert.equal(spot.showpiece.dimmed, false);
    assert.equal(g.wardrobe.owns(id), false);
  }
  const root = g.map.group.getObjectByName(spotOf(g, 'foamFinger').name);
  const clock = spotOf(g, 'foamFinger').showpiece.clock;
  game.tick(30);
  assert.ok(spotOf(g, 'foamFinger').showpiece.clock > clock, 'moving again');
  assert.ok(root.getObjectByName(`${root.name}_live`));
});

test('an unsold showpiece hums its motif within range every few seconds, and goes quiet when you are far or own it', (t) => {
  const game = scenario(t), { g } = game;
  g.debug.run('doors');
  game.tick(120);
  const motif = (id) => wardrobeItems[id].motif;
  const hums = (id) => game.sounds.filter((s) => s === motif(id)).length;

  const hat = spotOf(g, 'paperHat');
  standAt(game, hat, 5);
  game.tick(Math.ceil((cfg.motifSeconds * 2 + 1) / dt));
  assert.ok(hums('paperHat') >= 2, 'hummed twice in two periods');

  // Far from all three (the court's east end): silence.
  const heard = game.sounds.length;
  game.standAt(15, -8);
  game.tick(Math.ceil((cfg.motifSeconds * 2 + 1) / dt));
  assert.equal(game.sounds.slice(heard).filter((s) => IDS.some((id) => s === motif(id))).length, 0, 'out of range: silent');
  standAt(game, hat, 5);

  g.wardrobe.buy('paperHat');
  const before = hums('paperHat');
  game.tick(Math.ceil((cfg.motifSeconds * 2 + 1) / dt));
  assert.equal(hums('paperHat'), before, 'owned: silent');
  assert.ok(g.map.zones.foodCourt.open);
  for (const id of IDS) assert.ok(audioHas(motif(id)), `${motif(id)} is defined in config/audio.js`);
});

import { audio } from '../src/config/audio.js';
const audioHas = (name) => Array.isArray(audio.sounds[name]?.layers) && audio.sounds[name].layers.length >= 2;
