// =============================================================================
// KIOSK KEVIN HIMSELF (phase 8 of docs/kiosk-kevin-plan.md; colours and timings: config/kiosk.js vendor and hawk).
// A low-poly guy in a teal polo, with a lanyard and a name badge, a headset mic and a quiff, standing in his cart (only the
// top half shows over the counter). Presentation only: nothing here touches the game's state or its random numbers.
//
//   const kevin = buildKevin(mat)    kevin.group: place it on his stand point (feet on the floor), its +z towards the front
//   kevin.animate(dt, time, { mode, talking, look })   every rendered frame (maps/mall/kioskCart.js):
//       mode     'open' (selling: he bobs, turns to you, waves while he talks), 'hiding' (ducked into the cart, arms over his
//                head, peeking over the counter now and then), 'gone' (not here: hidden)
//       talking  0..1 while a speech bubble is up (his waving arm and his mouth)
//       look     the viewer's direction in his frame, radians (0 = straight out of the front), or null
//   kevin.popUp()   start him from down in the cart (he springs up: arriving at a cart, or coming back from hiding)
//   bubble = buildSpeechBubble()     bubble.sprite: a camera-facing speech bubble; bubble.say(text) draws it,
//                                    bubble.animate(dt) pops it in and fades it after kiosk.hawk.bubbleSeconds
// =============================================================================

import * as THREE from 'three';
import { kiosk } from '../../config/kiosk.js';
import { fitSize, drawType } from '../../world/typeKit.js';
import { bakeParts } from '../../world/bakeParts.js';

const V = kiosk.vendor;
const DOWN = -0.78; // m: his whole height drops this far when he ducks (his head ends below the counter top)
const PEEK = -0.56; // m: peeking (his eyes clear the counter)

/** A box between two corners, in the parent's frame. */
function block(parent, material, x0, y0, z0, x1, y1, z1, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** A small canvas texture with his badge on it (KEVIN, and the line under it). */
function badgeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f1e8';
  ctx.fillRect(0, 0, 128, 160);
  ctx.fillStyle = '#d8323a';
  ctx.fillRect(0, 0, 128, 34);
  drawType(ctx, V.badgeText[0], 64, 76, { role: 'priceTag', size: 48, fill: '#1d1626', maxWidth: 116 });
  drawType(ctx, V.badgeText[1], 64, 124, { role: 'priceTag', size: 22, fill: '#45246e', maxWidth: 116 });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildKevin(mat) {
  const group = new THREE.Group(); // (on his stand point)
  group.name = 'kevin';
  const body = new THREE.Group(); // (ducks: moves down into the cart)
  const turn = new THREE.Group(); // (turns to look at you)
  group.add(body);
  body.add(turn);
  const shirt = mat(V.shirt);
  const skin = mat(V.skin);
  const hair = mat(V.hair);
  const dark = mat(V.eyes);

  // The polo, its collar, a paunch, the trousers' waistband (just under the counter).
  block(turn, mat(V.trousers), -0.18, 0.78, -0.1, 0.18, 0.93, 0.1, 'kevin_trousers');
  block(turn, shirt, -0.19, 0.93, -0.1, 0.19, 1.43, 0.11, 'kevin_shirt');
  block(turn, shirt, -0.15, 0.96, 0.11, 0.15, 1.18, 0.15, 'kevin_paunch');
  block(turn, mat(V.collar), -0.1, 1.41, -0.06, 0.1, 1.47, 0.09, 'kevin_collar');
  // The lanyard: a red strap from each side of his collar meeting at his badge (a V), the badge high on his chest so it
  // shows over whatever is on the counter in front of him.
  const strap = mat(V.lanyard);
  for (const side of [-1, 1]) {
    const piece = block(turn, strap, -0.011, -0.075, -0.004, 0.011, 0.075, 0.004);
    piece.position.set(side * 0.042, 1.345, 0.118);
    piece.rotation.z = -side * 0.42; // (top end out towards his collar, bottom end in to the badge)
  }
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.008),
    [mat(V.badge), mat(V.badge), mat(V.badge), mat(V.badge), new THREE.MeshStandardMaterial({ map: badgeTexture(), roughness: 0.6 }), mat(V.badge)]);
  badge.position.set(0, 1.225, 0.124);
  badge.name = 'kevin_badge';
  turn.add(badge);

  // His head (on a neck pivot): face, ears, quiff, eyes, brows, mouth, and the headset with its mic.
  const neck = new THREE.Group();
  neck.userData.keep = true; // (each pivot is baked on its own: world/bakeParts.js)
  neck.position.y = 1.47;
  turn.add(neck);
  block(neck, skin, -0.03, -0.03, -0.03, 0.03, 0.03, 0.03); // (the neck)
  block(neck, skin, -0.105, 0.02, -0.1, 0.105, 0.28, 0.1, 'kevin_head');
  block(neck, skin, -0.125, 0.11, -0.02, 0.105 + 0.02, 0.17, 0.02); // (ears: one bar through the head)
  block(neck, hair, -0.11, 0.24, -0.11, 0.11, 0.31, 0.08);
  block(neck, hair, -0.11, 0.12, -0.11, 0.11, 0.25, -0.07);
  block(neck, hair, -0.111, 0.17, -0.07, 0.111, 0.25, 0.03); // (sideburns, so the hair reads as hair and not a cap)
  const quiff = block(neck, hair, -0.07, 0.27, -0.02, 0.09, 0.34, 0.13);
  quiff.rotation.x = -0.25;
  block(neck, skin, -0.019, 0.115, 0.1, 0.019, 0.165, 0.135, 'kevin_nose');
  const eyes = new THREE.Group();
  block(eyes, dark, -0.06, 0.165, 0.1, -0.035, 0.195, 0.106);
  block(eyes, dark, 0.035, 0.165, 0.1, 0.06, 0.195, 0.106);
  block(eyes, hair, -0.07, 0.21, 0.1, -0.025, 0.222, 0.108);
  block(eyes, hair, 0.025, 0.21, 0.1, 0.07, 0.222, 0.108);
  neck.add(eyes);
  const mouth = block(neck, mat(V.mouth), -0.045, 0.075, 0.1, 0.045, 0.1, 0.106, 'kevin_mouth');
  mouth.userData.keep = true; // (it opens and shuts)
  const headset = mat(V.headset);
  block(neck, headset, -0.118, 0.31, -0.035, 0.118, 0.325, -0.005); // (the band over the top of his hair)
  for (const x of [-0.125, 0.112]) block(neck, headset, x, 0.15, -0.035, x + 0.013, 0.325, -0.005); // (down each side)
  block(neck, headset, -0.137, 0.1, -0.04, -0.112, 0.18, 0.03); // (the earpiece)
  const boom = block(neck, headset, -0.006, -0.006, 0, 0.006, 0.006, 0.13);
  boom.position.set(-0.115, 0.11, 0.035);
  boom.rotation.y = 0.55;
  block(neck, headset, -0.068, 0.095, 0.1, -0.044, 0.12, 0.125); // (the mic)

  // Arms: a shoulder pivot each, a short sleeve, a forearm on an elbow pivot, a hand.
  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.235, 1.38, 0);
    shoulder.userData.keep = true;
    block(shoulder, shirt, -0.05, -0.17, -0.05, 0.05, 0.03, 0.05); // (the sleeve)
    const elbow = new THREE.Group();
    elbow.position.y = -0.24;
    elbow.userData.keep = true;
    block(shoulder, skin, -0.035, -0.26, -0.035, 0.035, -0.16, 0.035); // (the upper arm under the sleeve)
    block(elbow, skin, -0.035, -0.24, -0.035, 0.035, 0, 0.035);
    block(elbow, skin, -0.045, -0.32, -0.03, 0.045, -0.23, 0.04); // (the hand)
    shoulder.add(elbow);
    turn.add(shoulder);
    bakeParts(elbow);
    bakeParts(shoulder);
    return { shoulder, elbow };
  };
  const left = arm(-1);
  const right = arm(1);
  bakeParts(neck);
  bakeParts(turn); // (the torso, on the group that ducks and turns: 30 boxes become 8 draws in all)

  // Motion: a spring for the duck (he drops quickly, springs back up with a little overshoot), easing for the rest.
  let height = 0; // body.position.y, before the bob
  let speed = 0;
  let heading = 0; // turn.rotation.y
  let peekClock = 0;
  const ease = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));
  const pose = (limb, shoulderX, shoulderZ, elbowX, rate, dt) => {
    limb.shoulder.rotation.x = ease(limb.shoulder.rotation.x, shoulderX, rate, dt);
    limb.shoulder.rotation.z = ease(limb.shoulder.rotation.z, shoulderZ, rate, dt);
    limb.elbow.rotation.x = ease(limb.elbow.rotation.x, elbowX, rate, dt);
  };

  return {
    group,
    popUp() {
      height = DOWN;
      speed = 0;
    },
    animate(dt, time, { mode = 'open', talking = 0, look = null } = {}) {
      group.visible = mode !== 'gone';
      if (!group.visible) {
        height = DOWN; // (he arrives from down in the cart)
        speed = 0;
        return;
      }
      const hiding = mode === 'hiding';
      if (hiding) peekClock += dt;
      else peekClock = 0;
      const peeking = hiding && peekClock % V.peekSeconds > V.peekSeconds - 0.7;
      const target = !hiding ? 0 : peeking ? PEEK : DOWN;
      // A spring: stiff enough to drop in duckSeconds, damped enough to overshoot only a little on the way up.
      const stiffness = (Math.PI / V.duckSeconds) ** 2 / 4;
      const step = Math.min(dt, 1 / 30); // (a long frame doesn't blow the spring up)
      speed += ((target - height) * stiffness - speed * Math.sqrt(stiffness) * 1.3) * step;
      height += speed * step;
      body.position.y = height + (hiding ? 0 : Math.sin(time * 2.1) * 0.012);
      // He turns to you while he's selling (not past maxTurn), and looks straight ahead while he hides.
      const want = !hiding && look !== null ? THREE.MathUtils.clamp(look, -V.maxTurn, V.maxTurn) : 0;
      heading = ease(heading, want, V.turnSpeed, dt);
      turn.rotation.y = heading;
      neck.rotation.y = hiding ? Math.sin(time * 7) * 0.5 : (want - heading) * 0.6; // (his head leads; hiding, he looks round)
      neck.rotation.x = hiding ? -0.15 : Math.sin(time * 1.3) * 0.04;
      mouth.scale.y = talking > 0 ? 1 + Math.abs(Math.sin(time * 18)) * 1.6 : hiding ? 1.8 : 1;
      if (hiding) {
        // Duck and cover: both arms over his head.
        pose(left, -2.75, 0.35, -1.5, 18, dt);
        pose(right, -2.75, -0.35, -1.5, 18, dt);
      } else {
        // Selling: his forearms out on the counter; the right waves (or points) while he shouts.
        pose(left, -0.25, 0.08, -1.2, 8, dt);
        if (talking > 0) pose(right, -2.5, -0.25 + Math.sin(time * 11) * 0.45, -0.5, 14, dt);
        else pose(right, -0.25, -0.08, -1.2, 8, dt);
      }
    },
  };
}

/** Kevin's speech bubble: a sprite whose canvas holds the line (two lines at most, wrapped by words). */
export function buildSpeechBubble() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 200;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Not tone-mapped or fogged (the paper stays white, not grey), and drawn after the cart's light column (fx/beacon.js,
  // renderOrder 2), which rises right through it and would otherwise wash out the middle of the line.
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, fog: false });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 3;
  sprite.name = 'kevin_bubble';
  sprite.raycast = () => {}; // (never in the way of a shot or a bullet mark: a sprite can't be raycast without a camera)
  sprite.visible = false;
  const WIDTH = 1.5; // m
  sprite.scale.set(WIDTH, WIDTH * canvas.height / canvas.width, 1);
  let age = Infinity;

  function draw(text) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // The bubble: a rounded box with a tail pointing down at Kevin, white with an ink outline.
    const x = 10, y = 10, w = canvas.width - 20, h = 140, r = 36;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.lineTo(canvas.width / 2 + 10, y + h);
    ctx.lineTo(canvas.width / 2 - 26, canvas.height - 6);
    ctx.lineTo(canvas.width / 2 - 30, y + h);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = '#fffdf6';
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#1d1626';
    ctx.stroke();
    // The words: one line if they fit, else two split at the space nearest the middle, all at the one size that fits.
    const room = w - 44;
    let lines = [text];
    if (fitSize(ctx, text, 'toyBody', 46, room) < 46) {
      const spaces = [...text.matchAll(/ /g)].map((match) => match.index);
      const cut = spaces.reduce((best, i) => (Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2) ? i : best), spaces[0] ?? -1);
      if (cut > 0) lines = [text.slice(0, cut), text.slice(cut + 1)];
    }
    const size = Math.min(...lines.map((line) => fitSize(ctx, line, 'toyBody', lines.length === 1 ? 46 : 40, room)));
    const middle = y + h / 2;
    lines.forEach((line, i) => drawType(ctx, line, canvas.width / 2, middle + (i - (lines.length - 1) / 2) * size * 1.15,
      { role: 'toyBody', size, fill: '#1d1626' }));
    texture.needsUpdate = true;
  }

  return {
    sprite,
    /** 0..1: how "up" the bubble is (Kevin waves and talks while it's above 0). */
    get talking() {
      return age < kiosk.hawk.bubbleSeconds ? 1 : 0;
    },
    say(text) {
      draw(text);
      age = 0;
    },
    hide() {
      age = Infinity;
      sprite.visible = false;
    },
    animate(dt) {
      age += dt;
      const seconds = kiosk.hawk.bubbleSeconds;
      sprite.visible = age < seconds + 0.3;
      if (!sprite.visible) return;
      const grow = Math.min(1, age / 0.12);
      const pop = grow < 1 ? 0.6 + grow * 0.5 : 1 + Math.max(0, 0.1 - (age - 0.12)) ; // (pops in a touch big, settles)
      sprite.scale.set(WIDTH * pop, WIDTH * pop * canvas.height / canvas.width, 1);
      material.opacity = age < seconds ? 1 : Math.max(0, 1 - (age - seconds) / 0.3);
    },
  };
}
