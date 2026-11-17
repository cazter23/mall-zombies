// =============================================================================
// PRACTICE DUMMY (debug / test range only)
// A shop mannequin on a stand that you can shoot. Separate head and body
// hitboxes, a floating health bar, tips over when "killed", then pops back up.
// Implements the "shootable" interface described in weapons/hitscan.js, which
// zombies will implement too.
// =============================================================================

import * as THREE from 'three';
import { debug } from '../../config/debug.js';

const COLORS = {
  skin: 0xeadcc6, // mannequin beige
  stand: 0x3d3d48,
  barBack: 0x1d1626,
  barFill: 0xffffff,
};
// Cartoon "stuffing" splatter: mall-brand pink, teal, yellow.
const SPLAT_COLORS = [0xff4f9a, 0x2ec4b6, 0xffd23f];

// Body proportions in meters (feet at 0). Close to the player's size.
const SHAPE = {
  standHeight: 0.05,
  standRadius: 0.3,
  legs: { w: 0.3, d: 0.18, top: 0.85 },
  torso: { w: 0.46, d: 0.26, top: 1.45 },
  head: { size: 0.26, bottom: 1.5 },
  barY: 2.05,
  barWidth: 0.7,
  barHeight: 0.07,
  flashSeconds: 0.06,
};

// round: the round it stands in for (a gun with round scaling reads it: weapons/gunStats.js); onHit(info, dummy): every hit it takes,
// { damage, part, distance, weaponId, killed } (the shooting gallery's readout: maps/testRange/gallery.js).
export function createDummy({ parent, colliders, position, health, round = 1, onHit = null }) {
  const d = debug.dummies;

  // The pivot sits at the feet so the dummy tips over around its base.
  const pivot = new THREE.Group();
  pivot.position.copy(position);
  parent.add(pivot);

  const skin = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.7, flatShading: true });
  const standMat = new THREE.MeshStandardMaterial({ color: COLORS.stand, roughness: 0.8, flatShading: true });

  function part(geometry, material, y) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    pivot.add(mesh);
    return mesh;
  }
  const S = SHAPE;
  part(new THREE.CylinderGeometry(S.standRadius, S.standRadius, S.standHeight, 10), standMat, S.standHeight / 2);
  part(new THREE.BoxGeometry(S.legs.w, S.legs.top - S.standHeight, S.legs.d), skin, (S.legs.top + S.standHeight) / 2);
  part(new THREE.BoxGeometry(S.torso.w, S.torso.top - S.legs.top, S.torso.d), skin, (S.torso.top + S.legs.top) / 2);
  part(new THREE.BoxGeometry(0.08, S.head.bottom - S.torso.top, 0.08), skin, (S.head.bottom + S.torso.top) / 2); // neck
  part(new THREE.IcosahedronGeometry(S.head.size * 0.62, 0), skin, S.head.bottom + S.head.size / 2);

  // --- Hitboxes (world space; the dummy never moves while standing) ---------------
  const p = position;
  const halfBodyW = S.torso.w / 2;
  const halfBodyD = S.torso.d / 2;
  const half = S.head.size / 2;
  const hitboxes = [
    {
      part: 'head',
      box: new THREE.Box3(
        new THREE.Vector3(p.x - half, p.y + S.head.bottom, p.z - half),
        new THREE.Vector3(p.x + half, p.y + S.head.bottom + S.head.size, p.z + half),
      ),
    },
    {
      part: 'body',
      box: new THREE.Box3(
        new THREE.Vector3(p.x - halfBodyW, p.y + S.standHeight, p.z - halfBodyD),
        new THREE.Vector3(p.x + halfBodyW, p.y + S.head.bottom, p.z + halfBodyD),
      ),
    },
  ];

  // Stops the player walking through it, but doesn't stop bullets (the hitboxes handle those).
  const blocker = hitboxes[1].box.clone();
  blocker.min.y = p.y;
  blocker.ignoreShots = true;
  colliders.push(blocker);

  // --- Floating health bar (sprites always face the camera) -----------------------
  const barBack = new THREE.Sprite(new THREE.SpriteMaterial({ color: COLORS.barBack }));
  barBack.scale.set(S.barWidth, S.barHeight, 1);
  barBack.position.y = S.barY;
  pivot.add(barBack);
  const barFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: COLORS.barFill }));
  barFill.position.y = S.barY;
  barFill.renderOrder = 1;
  pivot.add(barFill);

  function setBar(fraction) {
    barFill.visible = fraction > 0;
    if (fraction <= 0) return;
    // Anchor the fill to the bar's left edge: a sprite's `center` is where its position sits.
    barFill.center.set(0.5 / fraction, 0.5);
    barFill.scale.set(S.barWidth * fraction, S.barHeight * 0.7, 1);
  }

  // --- State -------------------------------------------------------------------
  let hp = health;
  let state = 'up'; // 'up' | 'falling' | 'down' | 'rising'
  let timer = 0;
  let flash = 0;
  setBar(1);

  return {
    hitboxes,
    splatColors: SPLAT_COLORS,

    get isAlive() {
      return state === 'up';
    },
    get health() {
      return hp;
    },
    get maxHealth() {
      return health;
    },
    get round() {
      return round;
    },
    /** Stand in for another round: this health, back up and full at once. */
    setRound(nextRound, nextHealth) {
      round = nextRound;
      health = nextHealth;
      hp = health;
      state = 'up';
      timer = 0;
      setBar(1);
    },

    takeHit({ damage, part = 'body', distance = null, weaponId = null }) {
      if (state !== 'up') return { killed: false };
      hp = Math.max(0, hp - damage);
      flash = S.flashSeconds;
      setBar(hp / health);
      const killed = hp <= 0;
      onHit?.({ damage, part, distance, weaponId, killed }, this);
      if (!killed) return { killed: false };
      state = 'falling';
      timer = 0;
      return { killed: true };
    },

    // Fixed-tick update: hit flash, tipping over, waiting, standing back up.
    update(dt) {
      flash = Math.max(0, flash - dt);
      skin.emissive.setScalar(flash > 0 ? 0.6 : 0);

      timer += dt;
      let tip = 0; // 0 = standing, 1 = flat on its back
      if (state === 'falling') {
        tip = Math.min(1, timer / d.fallSeconds);
        if (tip >= 1) {
          state = 'down';
          timer = 0;
        }
      } else if (state === 'down') {
        tip = 1;
        if (timer >= d.respawnSeconds) {
          state = 'rising';
          timer = 0;
        }
      } else if (state === 'rising') {
        tip = 1 - Math.min(1, timer / d.fallSeconds);
        if (tip <= 0) {
          state = 'up';
          hp = health;
          setBar(1);
        }
      }
      // Fall backwards, away from the range's firing line (which is toward +Z).
      pivot.rotation.x = -tip * tip * (Math.PI / 2);
      barBack.visible = state === 'up';
      if (state !== 'up') barFill.visible = false;
    },
  };
}
