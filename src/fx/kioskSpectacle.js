// =============================================================================
// KIOSK KEVIN'S SPECTACLE (browser side; phase 8 of docs/archive/kiosk-kevin-plan.md; looks: config/kiosk.js spectacle).
// Everything here is for the eyes: it LISTENS to the game's events and draws, and nothing in the game reads it back.
//   Kevin      every cart's animation (maps/mall/kioskCart.js animate: the lid, Kevin ducking and waving and turning to you)
//              and his shouts ('kioskHawk': the speech bubble over him, and a short "hey!")
//   Soda Bomb  'equipmentBurst' sodaBomb: a cola geyser, a ring of foam skidding out, a ring to the blast's reach, "FSSSHH!"
//   Glitter    'equipmentBurst' glitterBomb: a twinkling cloud that drifts down, a pinch on each zombie it confused, its ring
//   Air Horn   'airHornBlast': rings of sound rolling out from you, on the floor and at chest height, "HOOONK!"
//   Bubble Wrap 'armourHit' with a layer popped: white bits bursting just in front of you, "POP!" (the HUD pops its segment)
//   Sentry     a flash at its muzzle with every shot (read from equipment.sentry), and 'sentryExpired': it comes apart in
//              pieces, "BZZT!" (the spring-up, spin and sputter are fx/throwableView.js)
// Its own particles (one instanced mesh of little cubes), rings (a small pool) and comic words (a small pool of sprites).
//
//   const show = createKioskSpectacle({ scene, events, camera, kiosk, equipment, effects, sound })
//     kiosk: the 'kiosk' feature instance (its .sites[].cart), or null on a map without Kevin
//   show.update(dt, time)   every rendered frame (dt 0 while paused: nothing moves)
//   show.clear()            everything gone (Play again)
//   show.dispose()
// =============================================================================

import * as THREE from 'three';
import { kiosk as cfg } from '../config/kiosk.js';
import { drawType } from '../world/typeKit.js';

const S = cfg.spectacle;
const between = ([a, b]) => a + Math.random() * (b - a);
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];
const UP = new THREE.Vector3(0, 1, 0);

export function createKioskSpectacle({ scene, events, camera, kiosk = null, equipment = null, effects = null, sound = null }) {
  const group = new THREE.Group();
  group.name = 'kiosk_spectacle';
  scene.add(group);
  const unsubscribe = [];
  const listen = (name, fn) => unsubscribe.push(events.on(name, fn));

  // --- Particles: little cubes with a velocity, gravity, drag and a life; glitter twinkles -----------------------------
  const max = S.maxParticles;
  const particles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), max);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particles.frustumCulled = false;
  particles.count = 0;
  for (let i = 0; i < max; i++) particles.setColorAt(i, new THREE.Color(1, 1, 1));
  group.add(particles);
  const live = []; // { position, velocity, life, maxLife, size, gravity, drag, color, twinkle, spin, floor }
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  // floor: the height it skids on (cola, foam and debris), or none (glitter and bubble bits float).
  function spawn(position, velocity, color, { size, life, gravity = 9, drag = 0, twinkle = false, floor = -Infinity }) {
    if (live.length >= max) return;
    const maxLife = Array.isArray(life) ? between(life) : life;
    live.push({ position: position.clone(), velocity: velocity.clone(), life: maxLife, maxLife, size: size * (0.6 + Math.random() * 0.8),
      gravity, drag, color, twinkle, spin: Math.random() * 6, floor });
  }
  const scratch = new THREE.Vector3();
  const randomDir = () => scratch.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();

  // --- Rings: flat, glowing, growing to a radius and fading ------------------------------------------------------------
  const ringGeometry = new THREE.RingGeometry(0.92, 1, 56).rotateX(-Math.PI / 2);
  const rings = Array.from({ length: 8 }, () => {
    const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    mesh.visible = false;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { mesh, age: 0, seconds: 1, radius: 1, delay: 0 };
  });
  let nextRing = 0;
  function ring(position, radius, color, { delay = 0, seconds = S.ringSeconds, y = 0.05 } = {}) {
    const r = rings[nextRing];
    nextRing = (nextRing + 1) % rings.length;
    r.mesh.position.copy(position).setY(position.y + y);
    r.mesh.material.color.setHex(color);
    Object.assign(r, { age: -delay, seconds, radius });
    r.mesh.visible = false; // (shown once its delay is up)
  }

  // --- Comic words: sprites that pop up, rise and fade -----------------------------------------------------------------
  const wordTextures = new Map();
  function wordTexture(text) {
    if (wordTextures.has(text)) return wordTextures.get(text);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    drawType(ctx, text, 256, 84, { role: 'toyBrand', size: 110, fill: ['#fff3a0', '#ff8a3d'], maxWidth: 480 });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    wordTextures.set(text, texture);
    return texture;
  }
  const words = Array.from({ length: 4 }, () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
    sprite.visible = false;
    sprite.renderOrder = 10;
    sprite.raycast = () => {}; // (not a thing to hit)
    group.add(sprite);
    return { sprite, age: Infinity, base: new THREE.Vector3(), size: 1 };
  });
  let nextWord = 0;
  function word(text, position, size = S.words.size) {
    if (!text) return;
    const w = words[nextWord];
    nextWord = (nextWord + 1) % words.length;
    w.sprite.material.map = wordTexture(text);
    w.sprite.material.needsUpdate = true;
    w.base.copy(position);
    w.size = size;
    w.age = 0;
  }

  // --- What each event shows ---------------------------------------------------------------------------------------------
  const geysers = []; // { position, left }
  const flashOf = new WeakMap(); // (the Sentry's last shot we flashed for)

  listen('equipmentBurst', ({ id, position, radius, hit }) => {
    if (id === 'sodaBomb') {
      geysers.push({ position: position.clone(), left: S.cola.seconds });
      const { foam } = S.cola;
      for (let i = 0; i < foam.count; i++) {
        const angle = (i / foam.count) * Math.PI * 2 + Math.random() * 0.2;
        const speed = between(foam.speed);
        spawn(position, scratch.set(Math.cos(angle) * speed, 0.8 + Math.random(), Math.sin(angle) * speed), foam.color,
          { size: foam.size, life: foam.life, gravity: foam.gravity, drag: foam.drag, floor: position.y - 0.1 });
      }
      ring(position, radius, S.cola.ring);
      word(S.words.sodaBomb, position.clone().setY(position.y + 1.6));
    } else if (id === 'glitterBomb') {
      const g = S.glitter;
      for (let i = 0; i < g.count; i++) {
        const v = randomDir().multiplyScalar(between(g.speed));
        v.y = Math.abs(v.y) * 0.8 + 0.4;
        spawn(position, v, pickOf(g.colors), { size: g.size, life: g.life, gravity: g.gravity, drag: g.drag, twinkle: true });
      }
      for (const { target } of hit ?? []) {
        const head = target.position.clone().setY(target.position.y + (target.type?.height ?? 1.8));
        for (let i = 0; i < g.perTarget; i++) {
          spawn(head, randomDir().multiplyScalar(0.6), pickOf(g.colors), { size: g.size, life: g.life, gravity: g.gravity, drag: g.drag, twinkle: true });
        }
      }
      ring(position, radius, g.ring);
      word(S.words.glitterBomb, position.clone().setY(position.y + 1.4), S.words.size * 1.1);
    }
  });

  listen('airHornBlast', ({ position, radius }) => {
    const h = S.horn;
    for (let i = 0; i < h.rings; i++) {
      ring(position, radius, h.color, { delay: i * h.gap, seconds: S.ringSeconds });
      ring(position, radius * 0.85, h.color, { delay: i * h.gap + 0.03, seconds: S.ringSeconds, y: h.chestHeight });
    }
    const ahead = new THREE.Vector3();
    camera.getWorldDirection(ahead);
    word(S.words.airHorn, camera.position.clone().addScaledVector(ahead.setY(0).normalize(), 2.4).setY(camera.position.y + 0.35));
  });

  listen('armourHit', ({ popped }) => {
    if (!popped) return;
    const w = S.wrap;
    const ahead = new THREE.Vector3();
    camera.getWorldDirection(ahead);
    const at = camera.position.clone().addScaledVector(ahead, w.distance);
    at.y -= 0.18;
    for (let i = 0; i < w.count; i++) {
      const spot = at.clone().add(randomDir().multiplyScalar(0.12 + Math.random() * 0.12));
      spawn(spot, randomDir().multiplyScalar(between(w.speed)), pickOf(w.colors), { size: w.size, life: w.life, gravity: w.gravity });
    }
    word(S.words.bubbleWrap, camera.position.clone().addScaledVector(ahead, 1.6).setY(camera.position.y + 0.25), S.words.size * 0.55);
  });

  listen('sentryExpired', ({ position }) => {
    const s = S.sentry;
    const at = position.clone().setY(position.y + 0.6);
    for (let i = 0; i < s.debris; i++) {
      const v = randomDir().multiplyScalar(between(s.speed));
      v.y = Math.abs(v.y) + 1.5;
      spawn(at, v, pickOf(s.colors), { size: s.size, life: s.life, gravity: s.gravity, drag: s.drag, floor: position.y + 0.03 });
    }
    effects?.flash(at, s.flash, { size: 0.6, seconds: 0.18 });
    word(S.words.sentry, position.clone().setY(position.y + 1.5), S.words.size * 0.8);
    sound?.play('sentryBreak');
  });

  listen('kioskHawk', ({ siteId, kind, line }) => {
    const site = kiosk?.sites.find((s) => s.id === siteId);
    if (!site) return;
    site.cart.say(line);
    const near = camera.position.distanceTo(site.cart.stand) <= cfg.hawk.radius * 1.5;
    if (near) sound?.play(kind === 'duck' ? 'kevinYelp' : 'kevinShout');
  });

  const clear = () => {
    live.length = 0;
    geysers.length = 0;
    particles.count = 0;
    for (const r of rings) r.mesh.visible = false;
    for (const w of words) {
      w.age = Infinity;
      w.sprite.visible = false;
    }
  };
  listen('runReset', clear);

  return {
    group,
    clear,
    update(dt, time) {
      // Kevin's carts.
      for (const site of kiosk?.sites ?? []) site.cart.animate(dt, time, camera.position);
      if (dt <= 0) return;

      // The Sentry's muzzle flash: once per shot.
      const turret = equipment?.sentry;
      if (turret?.deployed && turret.lastShot && flashOf.get(turret) !== turret.lastShot) {
        flashOf.set(turret, turret.lastShot);
        effects?.flash(turret.muzzle, S.sentry.flash, { size: 0.22, seconds: 0.06, opacity: 0.9 });
      }

      // Cola geysers spray while they last.
      const c = S.cola;
      for (let i = geysers.length - 1; i >= 0; i--) {
        const geyser = geysers[i];
        geyser.left -= dt;
        const count = Math.round(c.perSecond * dt * (0.6 + Math.random() * 0.8));
        for (let n = 0; n < count; n++) {
          const v = randomDir().multiplyScalar(c.spread).add(UP).normalize().multiplyScalar(between(c.speed) * (0.5 + geyser.left / c.seconds));
          spawn(geyser.position, v, pickOf(c.colors), { size: c.size, life: c.life, gravity: c.gravity, drag: c.drag, floor: geyser.position.y - 0.1 });
        }
        if (geyser.left <= 0) geysers.splice(i, 1);
      }

      // Particles.
      let n = 0;
      for (let i = 0; i < live.length; i++) {
        const p = live[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        p.velocity.y -= p.gravity * dt;
        if (p.drag) p.velocity.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.position.addScaledVector(p.velocity, dt);
        if (p.position.y < p.floor && p.velocity.y < 0) { // (cola and debris skid on the floor, more or less)
          p.position.y = p.floor;
          p.velocity.y *= -0.25;
          p.velocity.x *= 0.6;
          p.velocity.z *= 0.6;
        }
        p.spin += dt * 8;
        const fade = Math.min(1, p.life / Math.min(0.3, p.maxLife));
        dummy.position.copy(p.position);
        dummy.rotation.set(p.spin, p.spin * 0.7, 0);
        dummy.scale.setScalar(p.size * fade);
        dummy.updateMatrix();
        particles.setMatrixAt(n, dummy.matrix);
        tint.setHex(p.color);
        if (p.twinkle) tint.multiplyScalar(0.55 + 0.45 * Math.abs(Math.sin(time * 9 + p.spin * 3)));
        particles.setColorAt(n, tint);
        live[n++] = p;
      }
      live.length = n;
      particles.count = n;
      particles.instanceMatrix.needsUpdate = true;
      if (particles.instanceColor) particles.instanceColor.needsUpdate = true;

      // Rings.
      for (const r of rings) {
        if (r.age >= r.seconds) continue;
        r.age += dt;
        if (r.age < 0) continue;
        const t = Math.min(1, r.age / r.seconds);
        r.mesh.visible = t < 1;
        r.mesh.scale.setScalar(Math.max(0.05, r.radius * (1 - (1 - t) ** 3)));
        r.mesh.material.opacity = 0.85 * (1 - t);
      }

      // Comic words.
      for (const w of words) {
        if (w.age >= S.words.seconds) {
          w.sprite.visible = false;
          continue;
        }
        w.age += dt;
        const t = w.age / S.words.seconds;
        const pop = t < 0.15 ? 0.5 + t / 0.15 * 0.7 : 1.2 - Math.min(0.2, (t - 0.15) * 0.8);
        w.sprite.visible = true;
        w.sprite.position.copy(w.base).setY(w.base.y + t * 0.4);
        w.sprite.scale.set(w.size * pop, w.size * pop * 160 / 512, 1);
        w.sprite.material.opacity = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
      }
    },
    dispose() {
      for (const off of unsubscribe) off();
      scene.remove(group);
      particles.geometry.dispose();
      particles.material.dispose();
      ringGeometry.dispose();
      for (const r of rings) r.mesh.material.dispose();
      for (const w of words) w.sprite.material.dispose();
      for (const texture of wordTextures.values()) texture.dispose();
    },
  };
}
