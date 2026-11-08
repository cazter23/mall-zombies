// Fall damage (feel.fall) and climbing over a balcony rail to drop to the floor below (feel.vault.ledge, player/vault.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { feel } from '../src/config/feel.js';

const Y = 6.3;

function fixture() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  const falls = [];
  g.events.on('playerFall', (fall) => falls.push(fall));
  return { t, g, falls };
}

// The main hallway (open floor, 6 m ceiling): drop the player from `height` and wait for the landing.
function dropFrom(t, g, height) {
  g.player.teleport({ position: new THREE.Vector3(0, height, 2), yaw: 0 });
  g.player.grounded = false;
  for (let i = 0; i < 400 && !g.player.grounded; i++) t.tick();
  assert.ok(g.player.grounded, 'landed');
  t.tick(2);
}

const expected = (drop) => (drop - feel.fall.safeDrop) * feel.fall.damagePerMeter;

test('a short drop is free; past the safe drop, every extra metre costs health', () => {
  const { t, g, falls } = fixture();
  const full = g.stats.maxHealth;
  dropFrom(t, g, feel.fall.safeDrop - 0.5);
  assert.equal(falls.length, 0, 'no fall event');
  assert.equal(g.stats.health, full);
  dropFrom(t, g, feel.fall.safeDrop + 1.2);
  assert.equal(falls.length, 1);
  assert.ok(Math.abs(falls[0].damage - expected(falls[0].drop)) < 1e-9);
  assert.ok(Math.abs(falls[0].drop - (feel.fall.safeDrop + 1.2)) < 0.3, `the drop is measured from where you let go (${falls[0].drop})`);
  assert.ok(Math.abs(g.stats.health - (full - falls[0].damage)) < 1e-9, 'and it is taken from health');
  g.map.dispose();
});

test('a fall can kill; god mode and a soft-landing stat take nothing', () => {
  const { t, g, falls } = fixture();
  g.health.invulnerable = true;
  dropFrom(t, g, 4.2);
  assert.equal(falls.length, 1);
  assert.equal(g.stats.health, g.stats.maxHealth, 'god mode takes nothing');
  g.health.invulnerable = false;
  g.stats.fallDamageScale = 0;
  dropFrom(t, g, 4.2);
  assert.equal(g.stats.health, g.stats.maxHealth, 'a scale of 0 takes nothing');
  g.stats.fallDamageScale = 10; // (the hallway ceiling stops a taller drop; a scaled one proves the same rule)
  dropFrom(t, g, 4.2);
  assert.equal(g.health.isDead, true, 'enough damage ends the run');
  g.map.dispose();
});

test('a jump, a bench and the stairs cost nothing, even run at full speed', () => {
  const { t, g, falls } = fixture();
  g.health.invulnerable = true;
  g.map.doors.find((d) => d.id === 'serviceCorridor').open();
  g.map.cinema.stairs.door.open();
  t.tick(120);
  g.player.teleport({ position: new THREE.Vector3(-44.15, Y, -6.4), yaw: Math.PI });
  t.tick(20);
  t.input.held.add('KeyW');
  t.input.held.add('ShiftLeft');
  for (let i = 0; i < 125; i++) t.tick();
  t.input.clear();
  assert.equal(g.player.position.y, 0, 'ran all the way down the flight');
  assert.equal(falls.length, 0, 'and it never counted as a fall');
  dropFrom(t, g, 1); // (a jump off a 1 m ledge)
  assert.equal(falls.length, 0);
  g.map.dispose();
});

// Where a rail can be climbed from: the first rail and side that the vault says yes to, deterministic for this map.
function ledgeSpot(g) {
  for (const rail of g.colliders.filter((b) => b.ledge)) {
    const thinX = rail.max.x - rail.min.x < rail.max.z - rail.min.z;
    const cx = (rail.min.x + rail.max.x) / 2, cz = (rail.min.z + rail.max.z) / 2;
    for (const side of [-1, 1]) {
      const x = thinX ? cx + side * 1.4 : cx, z = thinX ? cz : cz + side * 1.4;
      const dx = thinX ? -side : 0, dz = thinX ? 0 : -side;
      const onFloor = g.colliders.some((b) => b !== rail && Math.abs(b.max.y - rail.min.y) < 0.06 && x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z);
      if (!onFloor) continue;
      g.player.teleport({ position: new THREE.Vector3(x, rail.min.y, z), yaw: Math.atan2(-dx, -dz) });
      g.player.grounded = true;
      g.player.velocity.set(dx * 5, 0, dz * 5);
      if (g.player.vault.preview()) { g.player.vault.reset(); return { rail, x, y: rail.min.y, z, dx, dz }; }
    }
  }
  return null;
}

test('jumping at a balcony rail climbs over it and drops to the floor below, and the landing hurts', () => {
  const { t, g, falls } = fixture();
  const spot = ledgeSpot(g);
  assert.ok(spot, 'at least one rail can be climbed');
  assert.equal(spot.y, Y, 'an upper-floor balcony');
  g.player.teleport({ position: new THREE.Vector3(spot.x, spot.y, spot.z), yaw: Math.atan2(-spot.dx, -spot.dz) });
  t.tick(2);
  const start = g.player.position.clone();
  t.input.held.add('KeyW');
  t.input.held.add('ShiftLeft');
  t.tick(10);
  t.press('Space', 2);
  let airborne = false;
  for (let i = 0; i < 400 && !(airborne && g.player.grounded); i++) {
    t.tick();
    if (!g.player.grounded) airborne = true;
  }
  t.input.clear();
  assert.ok(airborne && g.player.grounded, 'went over and landed');
  assert.ok(g.player.position.y <= feel.vault.ledge.landingMaxY, `on the ground floor (${g.player.position.y})`);
  assert.equal(falls.length, 1, 'one hard landing');
  assert.ok(Math.abs(falls[0].drop - (Y - g.player.position.y)) < 0.1, `measured from the balcony floor, not the climb (${falls[0].drop})`);
  assert.ok(Math.abs(g.stats.health - (g.stats.maxHealth - expected(Y))) < 1, `about ${expected(Y).toFixed(0)} damage (${g.stats.health})`);
  const across = (g.player.position.x - start.x) * spot.dx + (g.player.position.z - start.z) * spot.dz;
  assert.ok(across > 1.4, `beyond the rail, not straight down its foot (${across.toFixed(2)} m)`);
  g.map.dispose();
});

test('a rail only lets you over where there is open floor to land on, and never from the floor below', () => {
  const { g } = fixture();
  const rails = g.colliders.filter((b) => b.ledge);
  assert.ok(rails.length >= 10, 'the Promenade and the Atrium have railings');
  assert.ok(rails.every((r) => !r.vaultable), 'rails are their own kind: counters and benches are unaffected');
  let refused = 0;
  for (const rail of rails) {
    const thinX = rail.max.x - rail.min.x < rail.max.z - rail.min.z;
    const cx = (rail.min.x + rail.max.x) / 2, cz = (rail.min.z + rail.max.z) / 2;
    // From the ground floor under it: far too tall to climb.
    g.player.teleport({ position: new THREE.Vector3(thinX ? cx + 1.4 : cx, 0, thinX ? cz : cz + 1.4), yaw: 0 });
    g.player.grounded = true;
    g.player.velocity.set(thinX ? -5 : 0, 0, thinX ? 0 : -5);
    assert.equal(g.player.vault.preview(), false, 'no climbing a first-floor rail from below');
    refused++;
  }
  assert.equal(refused, rails.length);
  // Somewhere the landing is blocked (fountain, kiosk, escalator): the vault refuses and says why.
  let blocked = 0;
  for (const rail of rails) {
    const thinX = rail.max.x - rail.min.x < rail.max.z - rail.min.z;
    const cx = (rail.min.x + rail.max.x) / 2, cz = (rail.min.z + rail.max.z) / 2;
    for (const side of [-1, 1]) {
      const x = thinX ? cx + side * 1.4 : cx, z = thinX ? cz : cz + side * 1.4;
      if (!g.colliders.some((b) => b !== rail && Math.abs(b.max.y - rail.min.y) < 0.06 && x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z)) continue;
      g.player.teleport({ position: new THREE.Vector3(x, rail.min.y, z), yaw: Math.atan2(thinX ? side : 0, thinX ? 0 : side) });
      g.player.grounded = true;
      g.player.velocity.set(thinX ? -side * 5 : 0, 0, thinX ? 0 : -side * 5);
      if (!g.player.vault.tryStart() && g.player.vault.lastResult === 'nowhere safe to drop') blocked++;
      g.player.vault.reset();
    }
  }
  assert.ok(blocked >= 1, 'some rails look down onto things you must not land on');
  g.map.dispose();
});
