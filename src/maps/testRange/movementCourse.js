// =============================================================================
// THE MOVEMENT COURSE'S NEW STATIONS (debug mode: built into the test range by testRange.js). Today's moves at today's numbers
// (config/feel.js vault, fall, movement; the "anything standable" rule in CLAUDE.md), each with a sign:
//   VAULT ROW    counters 0.9, 1.0 and 1.1 m high that vault (feel.vault.maxHeight), then 1.2 m (too high) and a 1.6 m deep one
//                (too deep: feel.vault.maxDepth) that don't, in a row you run straight through
//   RAMP         a slope (a ramp surface, world/collision.js) up to a flat LANDING at 3 m, then on to a BALCONY at 6.3 m, the mall's
//                upper floor. Both have balcony rails (`ledge`: a jump at one climbs over and drops you): off the landing is the
//                free drop (feel.fall.safeDrop), off the balcony the real upper-floor drop (~40 damage)
//   REACH RULE   a 0.95 m counter between a 2.0 m block (a jump from the counter reaches its top: never allowed in the mall) and a
//                2.1 m block (out of reach: the rule's floor)
// Range-local metres (the range's centre is 0, 0; -Z is north). Everything here is decoration plus solid boxes and two ramps.
//
//   buildMovementCourse({ group, box, label, mat, colliders, cx, cz, colors }) -> { vaultRow, balcony, landing, ramp, reach } (the boxes, for tests)
// =============================================================================

import * as THREE from 'three';
import { addRamp } from '../../world/collision.js';
import { feel } from '../../config/feel.js';

export const COURSE = {
  vaultRow: { x0: -3, x1: 3, depth: 0.6, rows: [
    { z: -14, height: 0.9 }, { z: -17.5, height: 1.0 }, { z: -21, height: 1.1 }, { z: -24.5, height: 1.2 }, { z: -27.4, height: 1.0, depth: 1.6 },
  ] },
  // The ramp runs north (-Z) from z0, x x0..x1: up to the landing's height, flat across the landing, up to the balcony's.
  // (overrun: the ramp's flat top carries on this far over the balcony, so a body, which reaches ahead of its feet, never meets the
  // balcony's edge while its feet are still a little below it: as the mall's escalators do, props.js)
  ramp: { x0: 9, x1: 12, z0: -6, up1: 7, landing: 2, up2: 7, overrun: 1.2 },
  landingHeight: 3,
  balcony: { x0: 6, x1: 12, z1: -29.5, height: 6.3 }, // (its south edge is where the ramp arrives)
  railHeight: 1.5, // a balcony rail (taller than a jump peaks: you climb it, you don't hop it): props.js railing
  railThick: 0.15,
  wallHeight: 2.2, // the balcony's north side: a wall, not a rail (beyond it is the range's wall and the outside)
  underside: 0.6, // the solid steps under the ramp stop this far below its surface (a body's width up the slope never touches them)
  reach: { z0: 13, z1: 15, counter: { x0: 18, x1: 19, height: 0.95 }, low: { x0: 16, x1: 18, height: 2.0 }, tall: { x0: 19, x1: 21, height: 2.1 } },
};

export function buildMovementCourse({ group, box, label, mat, colliders, cx, cz, colors }) {
  const ok = mat(colors.jumpBox);
  const no = mat(colors.tooHigh);
  const rail = mat(colors.post);
  const floor = mat(colors.platform);

  // --- Vault row -----------------------------------------------------------------
  const V = COURSE.vaultRow;
  const vaultRow = V.rows.map(({ z, height, depth = V.depth }) => {
    const vaults = height <= feel.vault.maxHeight && depth <= feel.vault.maxDepth;
    const mesh = box(V.x0, 0, z - depth / 2, V.x1, height, z + depth / 2, vaults ? ok : no);
    const collider = colliders[colliders.length - 1];
    collider.vaultable = vaults;
    const words = vaults ? `${height} m: VAULT` : depth > feel.vault.maxDepth ? `${depth} m DEEP: NO VAULT` : `${height} m: TOO HIGH`;
    label(words, 0, height + 0.45, z + depth / 2 + 0.02, 2.6, 0.45);
    return { collider, height, depth, vaults, mesh };
  });
  label('VAULT ROW', 0, 2.6, -11.5, 4, 1.0, undefined, undefined, { style: 'industrial', subtext: 'RUN AND JUMP' });

  // --- The ramp, the 3 m landing and the 6.3 m balcony -------------------------------
  const R = COURSE.ramp;
  const L = COURSE.landingHeight;
  const B = COURSE.balcony;
  const zAt = (s) => R.z0 - s; // (s = metres north along the ramp from its foot)
  const s1 = R.up1, s2 = s1 + R.landing, s3 = s2 + R.up2, s4 = s3 + R.overrun;
  const points = [[0, 0], [s1, L], [s2, L], [s3, B.height], [s4, B.height]];
  const heightAt = (s) => {
    for (let i = 1; i < points.length; i++) {
      const [sa, ya] = points[i - 1], [sb, yb] = points[i];
      if (s <= sb) return ya + ((s - sa) / (sb - sa)) * (yb - ya);
    }
    return B.height;
  };
  const ramp = addRamp(colliders, {
    axis: 'z', origin: cz + R.z0, dir: -1, minX: cx + R.x0, maxX: cx + R.x1, minZ: cz + zAt(s4), maxZ: cz + R.z0, points,
  });
  // Its surface (two sloped slabs, the flat landing between and the flat top over the balcony's edge), and solid steps underneath
  // (their tops `underside` below the surface, the landing's too: a solid top flush with the slope would be a lip to walk into).
  const slope = (sa, sb) => {
    const ya = heightAt(sa), yb = heightAt(sb), run = sb - sa, rise = yb - ya;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(R.x1 - R.x0, 0.1, Math.hypot(run, rise)), floor);
    slab.position.set(cx + (R.x0 + R.x1) / 2, (ya + yb) / 2 - 0.05, cz + zAt((sa + sb) / 2));
    slab.rotation.x = Math.atan2(rise, run);
    group.add(slab);
  };
  slope(0, s1);
  slope(s1, s2);
  slope(s2, s3);
  slope(s3, s4);
  for (let s = 0; s < s4; s += 1) {
    const top = Math.min(heightAt(s), heightAt(Math.min(s4, s + 1))) - COURSE.underside;
    if (top > 0.05) box(R.x0, 0, zAt(Math.min(s4, s + 1)), R.x1, top, zAt(s), rail);
  }
  // The landing (3 m): a rail along its west side; over it, the free drop.
  const landingRail = box(R.x0 - COURSE.railThick, L, zAt(s2), R.x0, L + COURSE.railHeight, zAt(s1), rail);
  const landingRailBox = colliders[colliders.length - 1];
  landingRailBox.ledge = true;
  landingRailBox.ignoreShots = true;
  label(`${L} m DROP: FREE`, R.x0 - 1.2, L + 1.9, zAt(s1) + 0.05, 2.2, 0.4);
  // The balcony (6.3 m): solid to the ground; rails west, east and on its south side west of the ramp; a wall north.
  // (Its floor: solid west of the ramp all the way, and under the ramp's flat top only beyond it.)
  const balcony = box(B.x0, 0, B.z1, B.x1, B.height, zAt(s4), floor);
  box(B.x0, 0, zAt(s4), R.x0, B.height, zAt(s3), floor);
  const balconyBox = colliders[colliders.length - 1];
  const railBox = (x0, z0, x1, z1) => {
    box(x0, B.height, z0, x1, B.height + COURSE.railHeight, z1, rail);
    const c = colliders[colliders.length - 1];
    c.ledge = true;
    c.ignoreShots = true;
    return c;
  };
  const balconyRails = [
    railBox(B.x0, B.z1, B.x0 + COURSE.railThick, zAt(s3)), // west
    railBox(B.x1 - COURSE.railThick, B.z1, B.x1, zAt(s3)), // east
    railBox(B.x0 + COURSE.railThick, zAt(s3) - COURSE.railThick, R.x0, zAt(s3)), // south, west of the ramp's top
  ];
  box(B.x0, B.height, B.z1, B.x1, B.height + COURSE.wallHeight, B.z1 + COURSE.railThick, rail); // north: a wall
  const dropDamage = Math.round((B.height - feel.fall.safeDrop) * feel.fall.damagePerMeter);
  label(`${B.height} m DROP: ~${dropDamage} DAMAGE`, (B.x0 + B.x1) / 2, B.height + 2.0, zAt(s3) + 0.05, 3.4, 0.45);
  label('RAMP', (R.x0 + R.x1) / 2, 2.4, R.z0 + 0.6, 4.2, 1.0, undefined, undefined, { style: 'industrial', subtext: '3 m LANDING  ·  6.3 m BALCONY' });

  // --- The reach rule ----------------------------------------------------------------
  const Q = COURSE.reach;
  box(Q.counter.x0, 0, Q.z0, Q.counter.x1, Q.counter.height, Q.z1, ok);
  const reachCounter = colliders[colliders.length - 1];
  reachCounter.vaultable = true;
  box(Q.low.x0, 0, Q.z0, Q.low.x1, Q.low.height, Q.z1, no);
  const lowBox = colliders[colliders.length - 1];
  box(Q.tall.x0, 0, Q.z0, Q.tall.x1, Q.tall.height, Q.z1, ok);
  const tallBox = colliders[colliders.length - 1];
  label('2.0 m: REACHABLE FROM THE COUNTER (NEVER IN THE MALL)', (Q.low.x0 + Q.low.x1) / 2, 2.55, Q.z1 + 0.05, 2.0, 0.5);
  label('2.1 m: OUT OF REACH', (Q.tall.x0 + Q.tall.x1) / 2, 2.65, Q.z1 + 0.05, 2.0, 0.4);
  label('REACH RULE', 18.5, 3.3, Q.z1 + 0.6, 5.4, 1.1, undefined, undefined, { style: 'industrial', subtext: 'STANDABLE: A STEP, A COUNTER, OR 2.1 m AND UP' });

  return {
    vaultRow,
    ramp,
    rampHeightAt: heightAt,
    landing: { height: L, rail: landingRailBox, z: [zAt(s2), zAt(s1)], x: [R.x0, R.x1] },
    balcony: { box: balconyBox, rails: balconyRails, height: B.height },
    reach: { counter: reachCounter, low: lowBox, tall: tallBox },
    mesh: { landingRail, balcony },
  };
}
