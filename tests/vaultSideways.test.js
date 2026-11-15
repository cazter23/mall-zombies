// Vaults never go sideways, and the magnet stays forgiving (docs/vault-notes.md, 15 November 2026). Both sides of the same rule,
// on REAL obstacles in the mall (a HOFFMAN'S counter, the start-room counter, a Mega Mart checkout, the Atrium and Promenade
// balcony rails), through the real PlayerController driven by a stick (input.padMove), so any angle between where you move and
// where you look is possible (keys only make 0, 45 and 90 degrees).
//   theta   your path's angle off straight over the obstacle
//   look    where you look, off your path (+ = to your left)
//   gap     how far your body is from the obstacle's face when you press jump (in reach, or early: the magnet waits)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { feel } from '../src/config/feel.js';

const DEG = Math.PI / 180;
const R = feel.player.radius;
const rot = (x, z, a) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
const angle = (ax, az, bx, bz) => Math.atan2(ax * bz - az * bx, ax * bx + az * bz) / DEG; // signed, a -> b
const inside = (b, x, z) => x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z;

// Straight over the face a path from `s` along (dx, dz) enters `box` by (a rail: straight out from the side you're on).
function entryOver(box, s, dx, dz) {
  if (box.ledge) {
    const thinX = box.max.x - box.min.x < box.max.z - box.min.z;
    return thinX ? [Math.sign((box.min.x + box.max.x) / 2 - s.x), 0] : [0, Math.sign((box.min.z + box.max.z) / 2 - s.z)];
  }
  const tx = Math.abs(dx) < 1e-9 ? -Infinity : Math.min((box.min.x - s.x) / dx, (box.max.x - s.x) / dx);
  const tz = Math.abs(dz) < 1e-9 ? -Infinity : Math.min((box.min.z - s.z) / dz, (box.max.z - s.z) / dz);
  return tx > tz ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
}

function mall() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true; // (the rail drops hurt)
  g.debug.run('doors');
  t.tick(150);
  const at = (x, z, pred) => g.colliders.find((b) => pred(b) && inside(b, x, z));
  const counters = {
    // `early`: the furthest-out press that still has clear floor behind it (the magnet waits for you from there).
    hoffmans: { box: at(-13.1, 10.0, (b) => b.vaultable), side: -1, early: 2.0 }, // the cosmetics counter, from the entrance side (another 1 m east of it)
    // from the spawn side; a shelf 0.9 m behind its east end, so vaults there turn a little to land beside it (`cluttered`)
    startRoom: { box: at(-2.7, 14.0, (b) => b.vaultable), side: -1, early: 1.2, cluttered: true },
    checkout: { box: at(26, 4.1, (b) => b.vaultable), side: -1, early: 1.0, offsets: [0, 0.5, 1.0] }, // a Mega Mart checkout, from its lane (a basket on its west end)
  };
  const rails = {
    atrium: { box: at(20, 10.05, (b) => b.ledge), side: -1, u: -2, early: 1.2 },
    promenade: { box: at(-5.5, 0.45, (b) => b.ledge), side: -1, u: 1, early: 1.2 },
  };
  for (const [name, o] of Object.entries({ ...counters, ...rails })) assert.ok(o.box, `found the ${name} obstacle`);
  return { t, g, counters, rails };
}

// Put the player at the press point already moving (stick held, so the controller keeps the heading), press jump, and watch.
// Returns { vaulted, turn (vault direction vs heading), offView (vs where you look), over (vs straight over), crossed, jumpTick, landY }.
function approach(world, { box, side, u = 0 }, { theta, look = 0, gap = 0.4, sprint = true }) {
  const { g } = world, P = g.player;
  const thinX = box.max.x - box.min.x < box.max.z - box.min.z;
  const nx = thinX ? -side : 0, nz = thinX ? 0 : -side; // straight over, into the obstacle
  const faceX = thinX ? (side > 0 ? box.max.x : box.min.x) : (box.min.x + box.max.x) / 2 + u;
  const faceZ = thinX ? (box.min.z + box.max.z) / 2 + u : (side > 0 ? box.max.z : box.min.z);
  const [vx, vz] = rot(nx, nz, theta * DEG);
  const [lx, lz] = rot(vx, vz, look * DEG);
  const yaw = Math.atan2(-lx, -lz);
  const back = (gap + R) / Math.cos(theta * DEG);
  P.teleport({ position: new THREE.Vector3(faceX - vx * back, box.min.y, faceZ - vz * back), yaw });
  P.grounded = true;
  const input = world.t.input;
  input.clear();
  // The stick, in the view's frame: x = right, y = forward.
  input.padMove.x = vx * Math.cos(yaw) - vz * Math.sin(yaw);
  input.padMove.y = -vx * Math.sin(yaw) - vz * Math.cos(yaw);
  if (sprint) input.held.add('ShiftLeft');
  const speed = sprint && input.padMove.y >= feel.movement.minForwardInput ? feel.movement.sprintSpeed : feel.movement.walkSpeed;
  P.velocity.set(vx * speed, 0, vz * speed);
  input.pressed.add('Space');
  // deflected: something (a neighbouring fixture) turned your path before any vault, so this is not the approach asked for.
  const out = { vaulted: false, crossed: new Set(), jumpTick: null, deflected: false };
  let start = null, heading = [vx, vz];
  for (let i = 0; i < 200; i++) {
    const before = P.position.clone();
    const was = P.vault.active;
    if (!was) {
      const s = Math.hypot(P.velocity.x, P.velocity.z);
      if (s > 0.5) heading = [P.velocity.x / s, P.velocity.z / s];
      // (turned by the obstacle itself, once you touch it, is the real approach; by anything else first, it isn't)
      const touching = P.position.x + R + 0.02 > box.min.x && P.position.x - R - 0.02 < box.max.x && P.position.z + R + 0.02 > box.min.z && P.position.z - R - 0.02 < box.max.z;
      if (!out.deflected && !touching && Math.abs(angle(vx, vz, ...heading)) > 1) out.deflected = `at (${P.position.x.toFixed(2)}, ${P.position.z.toFixed(2)}) tick ${i}`;
    }
    P.update(dt);
    input.pressed.clear();
    if (!was && P.vault.active) { start = before; out.vaulted = true; }
    if (!start && out.jumpTick === null && P.velocity.y > 0.1) out.jumpTick = i;
    if (!start && i > 45) break; // (the magnet and the air grace are long over: no vault now)
    if (P.vault.active) for (const b of g.colliders) if ((b.vaultable || b.ledge) && Math.abs(b.max.y - P.position.y) < 2 && inside(b, P.position.x, P.position.z)) out.crossed.add(b);
    if (start && !P.vault.active) {
      for (let k = 0; k < 150 && !P.grounded; k++) P.update(dt);
      const ex = P.position.x - start.x, ez = P.position.z - start.z, len = Math.hypot(ex, ez);
      const [dx, dz] = [ex / len, ez / len];
      out.turn = angle(...heading, dx, dz); // vs where you were actually heading when it started
      out.offView = angle(lx, lz, dx, dz);
      out.over = angle(nx, nz, dx, dz);
      // Your view against straight over the obstacle it actually crossed (the face the vault entered by).
      const crossedBox = [...out.crossed][0];
      if (crossedBox) {
        const [ox, oz] = entryOver(crossedBox, start, dx, dz);
        out.viewOffOver = angle(ox, oz, lx, lz);
      }
      out.landY = P.position.y;
      out.beyond = (P.position.x - faceX) * nx + (P.position.z - faceZ) * nz; // metres past the near face, straight over
      const cx = Math.max(box.min.x, Math.min(P.position.x, box.max.x)), cz = Math.max(box.min.z, Math.min(P.position.z, box.max.z));
      out.landClear = Math.hypot(P.position.x - cx, P.position.z - cz) >= R - 0.01; // your body beside or past it, not on it
      break;
    }
  }
  input.clear();
  input.padMove.x = 0;
  input.padMove.y = 0;
  P.vault.reset();
  return out;
}

const where = (name, c) => `${name} theta ${c.theta} look ${c.look ?? 0} gap ${c.gap ?? 0.4} ${c.sprint === false ? 'walk' : 'sprint'}${c.u ? ` u ${c.u}` : ''}`;

test('FORGIVING: a counter run at roughly head-on (up to 35 degrees off), early, late or off centre, vaults along your heading', () => {
  const world = mall();
  const searchTurn = Math.max(...feel.vault.directionSearchDegrees.map(Math.abs));
  let vaults = 0;
  for (const [name, obstacle] of Object.entries(world.counters)) {
    const depth = Math.min(obstacle.box.max.x - obstacle.box.min.x, obstacle.box.max.z - obstacle.box.min.z);
    for (const theta of [0, 20, 35, -20, -35]) for (const look of [-25, 0, 25]) for (const gap of [0.05, 0.4, obstacle.early]) {
      for (const sprint of [true, false]) for (const u of obstacle.offsets ?? [0, -0.9, 0.9]) {
        const c = { theta, look, gap, sprint };
        const r = approach(world, { ...obstacle, u }, c);
        const label = where(name, { ...c, u });
        assert.ok(!r.deflected, `the approach runs clear until the vault (a fixture problem otherwise): ${label}, turned ${r.deflected}`);
        assert.ok(r.vaulted, `vaults: ${label}`);
        // Where you were heading, or a search turn that dodges something on the landing side (a display base behind HOFFMAN'S,
        // a shelf behind the start counter, a stand behind the checkout).
        assert.ok(Math.abs(r.turn) <= searchTurn + 0.5, `goes (nearly) where you were heading (${r.turn.toFixed(1)} degrees): ${label}`);
        if (!obstacle.cluttered && u === 0 && Math.abs(theta) <= 20) {
          assert.ok(Math.abs(r.turn) <= 0.5, `at its middle, exactly where you were heading (${r.turn.toFixed(1)}): ${label}`);
        }
        // (past the far side, or, heading over a corner near its end, beside the end: either way clear of it)
        assert.ok(r.beyond > depth / 2 && r.landClear, `lands past it, standing clear of it (${r.beyond.toFixed(2)} m): ${label}`);
        assert.ok([...r.crossed].every((b) => b === obstacle.box), `crosses only this obstacle: ${label}`);
        vaults++;
      }
    }
    // A key diagonal (W+D / W+A) at a counter you look nearly straight at still vaults.
    for (const [theta, look] of [[45, -45], [-45, 45], [30, -45], [-30, 45]]) {
      assert.ok(approach(world, obstacle, { theta, look }).vaulted, `a key diagonal while looking at it: ${where(name, { theta, look })}`);
    }
  }
  assert.ok(vaults > 400);
  world.g.map.dispose();
});

test('FORGIVING: a balcony rail run at roughly head-on (up to 35 degrees off), looking at it, climbs STRAIGHT over and drops', () => {
  const world = mall();
  for (const [name, rail] of Object.entries(world.rails)) {
    for (const theta of [0, 20, 35, -20, -35]) for (const lookStraight of [false, true]) for (const gap of [0.05, 0.4, rail.early]) for (const sprint of [true, false]) {
      const c = { theta, look: lookStraight ? -theta : 0, gap, sprint };
      const r = approach(world, rail, c);
      const label = where(name, c);
      assert.ok(!r.deflected, `the approach runs clear: ${label}`);
      assert.ok(r.vaulted, `climbs: ${label}`);
      assert.ok(Math.abs(r.over) <= 0.5, `straight over the rail (${r.over.toFixed(1)}): ${label}`);
      assert.ok(Math.abs(r.turn) <= Math.abs(theta) + 0.5, `turned no more than the approach angle (${r.turn.toFixed(1)}): ${label}`);
      assert.ok(r.landY <= rail.box.min.y - feel.vault.ledge.minDrop, `dropped to the floor below (${r.landY.toFixed(2)}): ${label}`);
    }
  }
  world.g.map.dispose();
});

test('NOT SIDEWAYS: strafing past, running along, or looking along or away from a counter never vaults it', () => {
  const world = mall();
  let clear = 0, deflected = 0;
  for (const [name, obstacle] of Object.entries(world.counters)) {
    const cases = [
      ...[0, 20, 40, 60].flatMap((theta) => [{ theta, look: 90 }, { theta, look: -90 }, { theta: -theta, look: 90 }]), // strafing (A / D)
      { theta: 70 }, { theta: -70 }, { theta: 80 }, { theta: 70, sprint: false }, // running along it, drifting in
      { theta: 45, look: 45 }, { theta: -45, look: -45 }, { theta: 40, look: 45 }, // looking along it, W+D / W+A diagonal into it
      { theta: 30, look: 60 }, { theta: 60, look: 30 }, { theta: 20, look: 60 }, // a stick: looking along it (80-90 degrees off straight over)
      { theta: 30, look: 50 }, { theta: 40, look: 40 }, // looking 80 degrees off straight over
      { theta: 0, look: 70 }, { theta: 0, look: -70 }, { theta: 20, look: -80 }, // the vault would go 70-80 degrees off your view
    ];
    for (const gap of [0.4, obstacle.early]) for (const c of cases) {
      const r = approach(world, obstacle, { ...c, gap });
      // (A run that brushes a neighbouring fixture first is a different approach: the wide sweep below checks those by what
      // actually happened. Most of these run clear.)
      if (r.deflected) { deflected++; continue; }
      clear++;
      assert.equal(r.vaulted, false, `no vault: ${where(name, { ...c, gap })} (it went ${r.offView?.toFixed(0)} degrees off your view)`);
    }
  }
  assert.ok(clear >= 4 * deflected, `most of these approaches run clear (${clear} clear, ${deflected} deflected)`);
  world.g.map.dispose();
});

test('NOT SIDEWAYS: running along a balcony, or looking along it, never tips you over the rail, and the jump is not held back', () => {
  const world = mall();
  for (const [name, rail] of Object.entries(world.rails)) {
    for (const theta of [60, -60, 70, -70]) for (const look of [0, -theta]) for (const gap of [0.4, rail.early]) {
      const c = { theta, look, gap };
      const r = approach(world, rail, c);
      assert.equal(r.vaulted, false, `no climb: ${where(name, c)} (it would turn you ${Math.abs(theta)} degrees)`);
      assert.ok(r.jumpTick !== null && r.jumpTick <= 1, `a plain jump, straight away (the magnet doesn't hold it): ${where(name, c)}`);
    }
    for (const [theta, look] of [[0, 60], [0, -60], [0, 90], [20, 60], [20, 90], [-20, -60], [-20, -90]]) { // view 60-110 off straight over
      assert.equal(approach(world, rail, { theta, look }).vaulted, false, `looking along the balcony: ${where(name, { theta, look })}`);
    }
  }
  world.g.map.dispose();
});

test('NOT SIDEWAYS: across a wide sweep, a vault never turns you more than a small search turn, nor goes far off your view', () => {
  const world = mall();
  const searchTurn = Math.max(...feel.vault.directionSearchDegrees.map(Math.abs));
  let vaults = 0;
  for (const [name, obstacle] of Object.entries({ ...world.counters, ...world.rails })) {
    const rail = !!obstacle.box.ledge;
    for (let theta = -80; theta <= 80; theta += 10) for (let look = -90; look <= 90; look += 15) {
      const c = { theta, look };
      const r = approach(world, obstacle, c);
      if (!r.vaulted) continue;
      vaults++;
      const label = where(name, c);
      if (rail) {
        assert.ok(Math.abs(r.viewOffOver) <= feel.vault.ledge.maxLookDegrees + 0.5, `only over a rail you look at (${r.viewOffOver.toFixed(0)}): ${label}`);
        assert.ok(Math.abs(r.turn) <= feel.vault.ledge.maxApproachDegrees + 0.5, `a rail climb turns you at most ledge.maxApproachDegrees (${r.turn.toFixed(0)}): ${label}`);
        assert.ok(Math.abs(r.offView) <= feel.vault.ledge.maxLookDegrees + 0.5, `and goes at most ledge.maxLookDegrees off your view (${r.offView.toFixed(0)}): ${label}`);
      } else {
        assert.ok(Math.abs(r.turn) <= searchTurn + 0.5, `a counter vault turns you at most a search turn (${r.turn.toFixed(0)}): ${label}`);
        assert.ok(Math.abs(r.offView) <= feel.vault.maxLookDegrees + 0.5, `and goes at most maxLookDegrees off your view (${r.offView.toFixed(0)}): ${label}`);
        assert.ok(Math.abs(r.viewOffOver) <= feel.vault.maxFaceDegrees + 0.5, `only over a counter you look at (view ${r.viewOffOver.toFixed(0)} off straight over it): ${label}`);
        assert.ok(r.crossed.size <= 1, `crosses one obstacle: ${label}`);
      }
    }
  }
  assert.ok(vaults > 200, `the sweep found plenty of vaults (${vaults})`);
  world.g.map.dispose();
});

test('NOT SIDEWAYS: running for the gap between two HOFFMAN\'S counters never vaults the corner of the one beside it', () => {
  // (Before 15 November 2026 the angled search paths picked up the counter beside the gap: a 24 degree turn onto it, and the
  // magnet, while it held a press, would vault any obstacle that came onto your path.)
  const world = mall();
  const { box } = world.counters.hoffmans;
  const halfLength = (box.max.x - box.min.x) / 2;
  const searchTurn = Math.max(...feel.vault.directionSearchDegrees.map(Math.abs));
  for (const theta of [-40, -50, -60]) for (const look of [60, 45, 30, 0, -30]) for (const gap of [0.4, 2.0]) { // (from the south: negative = heading east)
    const c = { theta, look, gap, u: halfLength + R + 0.15 }; // aimed so your body clears its east end by 15 cm, heading east
    const r = approach(world, { ...world.counters.hoffmans, u: c.u }, c);
    if (r.deflected) continue;
    assert.ok(!r.crossed.has(box), `never over this counter's corner: ${where('hoffmans', c)} (turned ${r.turn?.toFixed(0)})`);
    if (r.vaulted) assert.ok(Math.abs(r.turn) <= searchTurn + 0.5, `anything it vaults is (nearly) straight ahead: ${where('hoffmans', c)} (${r.turn.toFixed(0)})`);
  }
  world.g.map.dispose();
});
