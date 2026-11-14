// =============================================================================
// PLAYER GUN (loadout)
// The guns the player carries (two slots, COD-style) and everything that connects
// the one in hand to the rest of the game: reads the trigger/reload/switch input,
// updates aim (ADS + spread), fires the hitscan ray inside the spread cone,
// applies damage (with headshots and the player's stat multipliers), and
// triggers the feedback: camera recoil, gun-model recoil, muzzle flash, sound,
// tracer, splatter and hit markers, all on the same tick as the shot.
// Reload sounds and bumps fire from the weapon's reload events, on the same clock
// as the reload animation, so they always line up.
//
// Each slot's gun is RESOLVED (weapons/gunStats.js resolveGun): its config entry plus any upgrades
// (mods, e.g. Build-A-Blaster), and everything here reads that resolved copy (`slot.def`). setMods()
// changes a carried gun's upgrades mid-run; the config entries themselves are never modified.
//
// Slots: you start with one gun. Buying a gun fills the empty slot; with both full
// it replaces the gun in your hands. Each gun keeps its own ammo. Switching
// (feel.weaponSwitch) drops the gun out of view and raises the other; no shooting
// or aiming until it's up, and a reload in progress is cancelled.
// =============================================================================

import { returnToSender } from './returnToSender.js';
import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { Weapon } from './weapon.js';
import { workshopBuilds, workshopModOf, buildOf } from '../config/workshop.js';
import { castShot } from './hitscan.js';
import { createAim, applyConeSpread, pelletSpreadDegrees } from './aim.js';
import { hitDamage, resolveGun, isReturnable } from './gunStats.js';
import { findInCone, blowAway, createBlastPay } from './coneBlast.js';
import { createScopeSway } from './scope.js';
import { findInBlast, selfBlastDamage } from './blast.js';
import { impacts } from '../config/impacts.js';
import { soundVariantOf } from './upgrades.js';
import { soundUpgrades } from '../config/gunSounds.js';

const DEG_TO_RAD = Math.PI / 180;
const MAX_SLOTS = 2;

export function createPlayerGun({
  def, // the starting gun
  stats,
  player,
  input,
  colliders,
  shootables,
  effects,
  viewmodel,
  hud,
  sound = null, // optional (audio/sound.js)
  onShot = null,
  onHit = null, // ({ target, killed, headshot, melee }) after any hit on a shootable (points)
  onReload = null, // ({ weaponId }) a reload just began
  aimAssist = null, // optional (weapons/aimAssist.js): controller aim help, applied before each shot
  balls = null, // optional (weapons/ballistics.js): the bouncing balls of a gun with a `projectile` (the Tennis Ball Launcher)
  onProjectileHit = null, // () a ball touched its first zombie (run accuracy: the throw was a shot, this makes it a hit)
  rockets = null, // optional (weapons/ballistics.js, zombies 'bounce'): the rockets of a gun with `blast` (the Bottle Rocket Bazooka) in the air
  onBlast = null, // ({ weaponId, position, radius, hits, selfDamage }) a rocket burst; selfDamage = what it does to you (createGame applies it)
}) {
  const startDef = def;
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  let lastReloadProgress = null; // for spotting reload events as the clock passes them
  let reloadRequested = false; // set by requestReload() (e.g. a controller X tap next to a buyable)
  let inspectTimer = 0;
  const INSPECT_DURATION = 1.8;
  let shotSide = null; // while a shot is being fired: 'left' / 'right' for an akimbo gun (which gun of the pair fires), else null

  // A slot = one carried gun: its config entry (`base`), its upgrades (`mods`), the resolved gun those
  // make (`def`, what gameplay reads), its ammo/cooldown state and its own aim (ADS/spread) settings.
  const makeSlot = (base, mods = []) => {
    const d = resolveGun(base, mods);
    const slot = { base, mods, def: d, weapon: new Weapon(d, stats), aim: createAim({ def: d, input, player }) };
    if (d.akimbo) slot.akimbo = { cooldown: [0, 0], request: [0, 0], last: 1 }; // [left gun, right gun]; `last` = the gun that fired last
    return slot;
  };

  // An akimbo gun (def.akimbo, the BOGO): one gun to the game (one magazine, one reload), but TWO triggers, one per hand, and no ADS.
  // Left mouse fires the left gun and right mouse the right one; on a controller LT is the left gun and RT the right (so the
  // 'fire' and 'aim' actions swap sides between the devices). Each gun fires at most every 2 x fireInterval, so one trigger
  // gives half the pair's rate and both together alternate at the full fireInterval. Returns this tick's trigger for the
  // Weapon (only when a gun is ready, so a held trigger can't fire its gun faster) and the side that would fire.
  function akimboTriggers(slot, dt) {
    const a = slot.akimbo;
    // (An input without per-device questions, e.g. a test's stand-in: 'fire' is the left gun and 'aim' the right.)
    const downOn = (action, pad) => (input.actionDownOn ? input.actionDownOn(action, pad) : !pad && input.actionDown(action));
    const pressedOn = (action, pad) => (input.actionPressedOn ? input.actionPressedOn(action, pad) : !pad && input.actionPressed(action));
    const held = [downOn('fire', false) || downOn('aim', true), downOn('aim', false) || downOn('fire', true)];
    const pressed = [pressedOn('fire', false) || pressedOn('aim', true), pressedOn('aim', false) || pressedOn('fire', true)];
    input.consumeAction('fire');
    input.consumeAction('aim');
    for (const i of [0, 1]) {
      a.cooldown[i] = a.cooldown[i] > 0 ? a.cooldown[i] - dt : 0;
      a.request[i] = pressed[i] ? slot.def.fireBuffer : Math.max(0, a.request[i] - dt);
    }
    const wants = (i) => held[i] || a.request[i] > 0;
    // The gun that didn't fire last goes first, so with both triggers held they take turns.
    const order = [1 - a.last, a.last];
    const side = order.find((i) => wants(i) && a.cooldown[i] <= 0) ?? null;
    return {
      side,
      anyHeld: held[0] || held[1],
      trigger: side !== null && a.request[side] > 0,
      triggerHeld: side !== null,
    };
  }
  function akimboFired(slot, side) {
    const a = slot.akimbo;
    a.cooldown[side] += 2 * slot.def.fireInterval; // (carries the leftover, like Weapon's cooldown)
    a.request[side] = 0;
    a.last = side;
  }
  let slots = [makeSlot(startDef)];
  let current = 0; // index of the gun in hand
  let chargeVoice = null; // the charge sound playing (the Barcode Scanner's whine), so a cancelled scan can stop it

  // A gun handed over at Build-A-Blaster: out of the loadout until collect() brings it back. Keeps its own ammo.
  let away = null;

  // Switching: null, or { from: slot shown while it drops away, timer: seconds since the switch started }.
  // (`from` can be a slot that was just replaced by a bought gun: it still drops away visibly.)
  let switching = null;

  const ws = feel.weaponSwitch;

  function startSwitch(toIndex, fromSlot = slots[current]) {
    if (toIndex === current && fromSlot === slots[current]) return;
    fromSlot.weapon.cancelFire();
    slots[current].weapon.cancelReload();
    current = toIndex;
    slots[current].weapon.cancelReload();
    slots[current].weapon.cancelFire();
    lastReloadProgress = null;
    inspectTimer = 0;
    slots[current].aim.reset(); // comes up at the hip
    switching = { from: fromSlot, timer: 0 };
  }

  // Where a gun coming back from Build-A-Blaster goes: over a copy of itself bought meanwhile, over the loaner, into a free
  // slot, or, with two guns of your own, over the gun in your hand (like buying a gun with a full loadout).
  function collectSlot(id) {
    const copy = slots.findIndex((s) => s.def.id === id && !s.loaner);
    if (copy !== -1) return copy;
    const loan = slots.findIndex((s) => s.loaner);
    if (loan !== -1) return loan;
    return slots.length < MAX_SLOTS ? slots.length : current;
  }

  // The feedback every shot shares: camera recoil (moves the crosshair, springs back), the gun model's kick and muzzle flash, and the sound.
  // Uses the aim from before the kick. `kickScale`: a charged shot kicks harder the longer it was charged. Returns the ADS amount.
  function kick(d, aim, kickScale = 1) {
    const r = d.recoil;
    const ads = aim.amount;
    const cameraScale = (1 + (r.adsMultiplier - 1) * ads) * kickScale;
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    player.addRecoil(
      r.pitchDegrees * DEG_TO_RAD * cameraScale,
      side() * r.rollDegrees * DEG_TO_RAD * cameraScale,
      side() * (r.yawDegrees ?? 0) * DEG_TO_RAD * cameraScale * (0.5 + Math.random() * 0.5),
    );
    viewmodel.fire(ads, d, shotSide); // gun kick + muzzle flash using this shot's resolved stats (visual only); shotSide: which of a pair
    if (sound) {
      // The shot's sound carries its upgrades (tier, renewals, stuffing) and, on the last few rounds, a lighter mechanism + a tick.
      const weapon = slots[current]?.weapon;
      const lowAmmo = !!weapon && !d.fuel && d.magazineSize > soundUpgrades.lowAmmoMinMagazine && weapon.magazine <= feel.effects.lowAmmoThreshold;
      sound.play(d.sounds.fire, { variant: { ...soundVariantOf(d.modList), lowAmmo }, side: shotSide }); // (side: which gun of a pair)
      if (d.sounds.beep) sound.play(d.sounds.beep); // (the Barcode Scanner's checkout BEEP, on top of the shot)
    }
    return ads;
  }

  // A gun with a cone (the Leaf Blower, Return to Sender): one PULSE of wind instead of a ray. Everything in the cone is shoved back (and the close
  // ones laid down), takes the gun's damage, and the gust flies. Points: a zombie that keeps being blown pays the hit +10 only now and then
  // (createBlastPay). A cone gun with `instantKill` (Return to Sender) RETURNS every returnable zombie within cone.killRange (the same path as its
  // old beam: weapons/returnToSender.js) and only shoves the ones beyond it; bosses and Mascots within killRange take its big hit.
  const blastPay = new Map(); // gun id -> its pulse ledger
  const scopeSway = createScopeSway(); // the scoped gun's drift (weapons/scope.js), applied in update()
  function fireCone(slot) {
    const { def: d, aim, weapon } = slot;
    const cone = d.cone;
    player.getAim(origin, direction);
    aim.onShot();
    kick(d, aim);
    const pay = blastPay.get(d.id) ?? blastPay.set(d.id, createBlastPay(Math.max(1, Math.ceil(cone.payEverySeconds / d.fireInterval)))).get(d.id);
    pay.pulse();
    const found = findInCone(origin, direction, cone, colliders, shootables);
    const hits = [];
    const resolved = [];
    const killRange = cone.killRange ?? cone.range;
    for (const { target, distance, point } of found) {
      if (!target.isAlive) continue; // (killed earlier this pulse by a kill listener)
      const hit = { target, part: 'body', point: point.clone(), normal: direction.clone().negate(), distance };
      hits.push(hit);
      const attacking = target.isAttacking === true; // (before the gust: the shove is what stops it)
      const inReach = distance <= killRange;
      const returned = !!d.instantKill && isReturnable(target);
      let killed = false;
      if (returned) {
        if (inReach) ({ killed } = returnToSender(target, { effects, sound, point: hit.point, normal: hit.normal, part: 'body', direction, impact: d.impact, distance }));
      } else if (inReach) {
        ({ killed } = target.takeHit({ damage: hitDamage(d, hit, 0, stats, 1, target), part: 'body', point: hit.point, direction, impact: d.impact, weaponId: d.id, distance }));
      }
      // interrupted: the gust shoved a zombie out of an attack (shot.hits; weapon skin challenges count it, nothing pays by it).
      const blown = killed || !target.isAlive ? null : blowAway(target, origin, cone, distance);
      hit.interrupted = attacking && blown?.pushed === true;
      resolved.push({ hit, killed, returned: returned && killed, paid: killed || pay.take(target) });
    }
    const end = origin.clone().addScaledVector(direction, cone.range);
    const gust = cone.gust;
    effects.confetti(origin.clone().addScaledVector(direction, cone.range * 0.55), direction, gust);
    let paidAny = false;
    let anyKilled = false;
    for (const { hit, killed, returned, paid } of resolved) {
      anyKilled ||= killed;
      if (killed && !returned) effects.splat(hit.point, hit.normal, hit.target.splatColors, feel.effects.splatCount, { flesh: true, speedScale: 1, direction });
      if (paid) {
        paidAny = true;
        if (onHit) onHit({ target: hit.target, killed, headshot: false, melee: false, weaponId: d.id });
      }
    }
    if (paidAny) {
      hud.showHitMarker({ headshot: false, killed: anyKilled });
      if (sound) { sound.play('hitBody'); if (anyKilled) sound.play('killConfirm'); }
    }
    const shot = { origin: origin.clone(), end, endNormal: direction.clone().negate(), point: end.clone(), normal: direction.clone().negate(), distance: cone.range,
      target: hits[0]?.target ?? null, part: hits[0] ? 'body' : null, hits, worldHit: null, cone: true };
    shot.weaponId = d.id;
    shot.magazineLeft = weapon.magazine;
    if (onShot) onShot(shot);
    return shot;
  }

  // A gun with a projectile (the Tennis Ball Launcher): the trigger THROWS a ball (weapons/ballistics.js) that flies, bounces and hits later: each
  // zombie it touches is a hit (+10, hit marker, splat, and a kill pays as usual). The throw is the shot (one pulse, one shot counted); the ball's first
  // hit on a zombie makes it a hit for the run's accuracy (onProjectileHit).
  function fireProjectile(slot) {
    const { def: d, aim, weapon } = slot;
    const projectile = d.projectile;
    player.getAim(origin, direction);
    const throwDirection = direction.clone();
    aim.applySpread(throwDirection);
    aim.onShot();
    kick(d, aim);
    const start = origin.clone().addScaledVector(throwDirection, projectile.startOffset);
    start.y += projectile.startDrop;
    // Zeroed: angle the throw so the ball crosses the crosshair line `zeroDistance` out (it leaves below the eye and falls), lifted by the drop
    // gravity gives it over that flight, as the ball does when it seeks its next zombie (weapons/ballistics.js).
    if (projectile.zeroDistance) {
      const zero = origin.clone().addScaledVector(throwDirection, projectile.zeroDistance).sub(start);
      const flight = zero.length() / projectile.speed;
      zero.y += 0.5 * projectile.gravity * flight * flight;
      throwDirection.copy(zero.normalize());
    }
    const ahead = start.clone().addScaledVector(throwDirection, 6);
    const shot = { origin: start.clone(), end: ahead, endNormal: throwDirection.clone().negate(), point: ahead.clone(), normal: throwDirection.clone().negate(),
      distance: 6, target: null, part: null, hits: [], worldHit: null, projectile: true, weaponId: d.id, magazineLeft: weapon.magazine };
    let counted = false;
    balls.launch({
      weaponId: d.id,
      position: start,
      direction: throwDirection,
      projectile,
      impact: d.impact,
      damageOf: ({ part, distance, target }) => hitDamage(d, { part, distance }, 0, stats, 1, target),
      onHit({ target, part, point, normal, killed, direction: hitDirection }) {
        const headshot = part === 'head';
        if (!counted) { counted = true; onProjectileHit?.(); }
        effects.splat(point, normal, target.splatColors, headshot ? feel.effects.headshotSplatCount : feel.effects.splatCount,
          { flesh: true, speedScale: Math.sqrt(Math.max(1, d.impact?.deathImpulse ?? 1)) * (headshot ? 1.2 : 1), direction: hitDirection });
        if (onHit) onHit({ target, killed, headshot, melee: false, weaponId: d.id });
        hud.showHitMarker({ headshot, killed });
        if (sound) {
          sound.play(headshot ? 'hitHead' : 'hitBody');
          if (killed) sound.play('killConfirm');
        }
      },
      onBounce({ point, normal, target, ball }) {
        if (sound) sound.play(projectile.bounceSound, { step: Math.max(0, (ball?.bounces ?? 1) - 1) }); // (climbs in pitch along the chain)
        if (!target) effects.puff(point, normal);
      },
    });
    if (onShot) onShot(shot);
    return shot;
  }

  // A gun with a blast (the Bottle Rocket Bazooka): the trigger launches a ROCKET (weapons/ballistics.js, the `rockets` instance, which bounces off zombies
  // without hurting them) that bursts on the first thing it touches, or in the air at the end of its life. The burst (weapons/blast.js) hits every zombie
  // in its radius and in sight of it (+10 each, a kill pays as usual) and reports what it does to you (onBlast: createGame takes it off your health).
  // The launch is the shot; the burst's first zombie makes it a hit for the run's accuracy (onProjectileHit).
  function fireRocket(slot) {
    const { def: d, aim, weapon } = slot;
    const r = d.flight;
    player.getAim(origin, direction);
    const flight = direction.clone();
    aim.applySpread(flight);
    aim.onShot();
    kick(d, aim);
    const start = origin.clone().addScaledVector(flight, r.startOffset);
    start.y += r.startDrop;
    const ahead = start.clone().addScaledVector(flight, 6);
    // (blast: true tells Build-A-Blaster's shot Hearts to wait for the burst, 'gunBlast', which carries magazineLeft and the hits)
    const shot = { origin: start.clone(), end: ahead, endNormal: flight.clone().negate(), point: ahead.clone(), normal: flight.clone().negate(),
      distance: 6, target: null, part: null, hits: [], worldHit: null, projectile: true, blast: true, weaponId: d.id, magazineLeft: weapon.magazine };
    const fired = origin.clone();
    const magazineLeft = weapon.magazine;
    // The launch point is in front of the eye, further than you are wide: up against a wall (or a zombie) it would already be on
    // the far side. Anything between the eye and the launch point (plus the rocket's radius) bursts it right there instead.
    const toStart = start.clone().sub(origin);
    const reach = toStart.length();
    toStart.divideScalar(reach);
    const blocker = castShot(origin, toStart, reach + r.radius, colliders, shootables);
    if (blocker.distance < reach + r.radius) {
      const centre = origin.clone().addScaledVector(toStart, Math.max(0, blocker.distance - r.radius));
      if (onShot) onShot(shot);
      explode(d, centre, fired, magazineLeft);
      return shot;
    }
    rockets.launch({
      weaponId: d.id,
      position: start,
      direction: flight,
      projectile: { ...r, restitution: 0, maxBounces: 1, minSpeed: 0, rehitSeconds: 0, seekRange: 0 }, // (one contact of any kind and it is over)
      onEnd: ({ ball }) => explode(d, ball.position.clone(), fired, magazineLeft), // (fx/rocketView.js draws it in the air, with its spark trail)
    });
    if (onShot) onShot(shot);
    return shot;
  }

  // A rocket burst at `centre`: every zombie caught takes the blast damage (gunStats.hitDamage with blastDistance), then what it does to you.
  function explode(d, centre, firedFrom, magazineLeft) {
    const found = findInBlast(centre, d.blast, colliders, shootables); // (snapshot first: a kill listener can change the list)
    const hits = [];
    let anyKilled = false;
    for (const { target, distance } of found) {
      if (!target.isAlive) continue; // (killed by an earlier kill's listener: no hits on corpses)
      const away = new THREE.Vector3(target.position.x - centre.x, 0, target.position.z - centre.z);
      if (away.lengthSq() < 1e-6) away.set(0, 0, 1);
      away.normalize();
      const damage = hitDamage(d, { part: 'body', blastDistance: distance }, 0, stats, 1, target); // (the target: Black Friday's one-shot needs it)
      const point = target.position.clone().setY(target.position.y + 1);
      const { killed } = target.takeHit({ damage, part: 'body', point, direction: away, impact: d.impact, weaponId: d.id, distance: firedFrom.distanceTo(centre) });
      anyKilled ||= killed;
      hits.push({ target, part: 'body', killed, distance });
      effects.splat(point, away, target.splatColors, feel.effects.splatCount, { flesh: true, speedScale: 1.4, direction: away });
      if (onHit) onHit({ target, killed, headshot: false, melee: false, weaponId: d.id });
    }
    effects.confetti(centre, new THREE.Vector3(0, 1, 0), d.blast.look);
    effects.flash(centre, d.blast.flash.color, { size: d.blast.flash.size, seconds: d.blast.flash.seconds });
    if (sound) sound.play(d.sounds.burst);
    if (hits.length) {
      onProjectileHit?.();
      hud.showHitMarker({ headshot: false, killed: anyKilled });
      if (sound) { sound.play('hitBody'); if (anyKilled) sound.play('killConfirm'); }
    }
    const eye = new THREE.Vector3();
    player.getAim(eye, new THREE.Vector3());
    const selfDamage = selfBlastDamage({ eye, feetY: player.position.y }, centre, d.blast, colliders, stats.maxHealth, stats.ownBlastDamage ?? 1);
    onBlast?.({ weaponId: d.id, position: centre.clone(), radius: d.blast.radius, hits, selfDamage, magazineLeft });
  }

  function fire(slot) {
    if (slot.def.blast && rockets) return fireRocket(slot);
    if (slot.def.projectile && balls) return fireProjectile(slot);
    if (slot.def.cone) return fireCone(slot);
    const { def: d, aim, weapon } = slot;
    player.getAim(origin, direction);
    // (A charged gun, the Barcode Scanner, only fires when its scan completes: every shot is a full one, weapons/weapon.js.)
    const chargeRatio = d.charge ? (weapon.lastChargeRatio ?? 1) : 1;
    const chargeScale = 1;
    const pierce = d.pierce ?? null;
    const maxTargets = pierce ? pierce.maxTargets : 1;
    const trap = workshopBuilds.partyTrap;
    const workshop = workshopModOf(slot.mods);
    const placementRay = workshop === 'partyTrap' && aim.amount >= trap.aimAmount
      ? castShot(origin, direction, trap.placementRange, colliders, shootables) : null;
    const placement = placementRay?.worldHit && placementRay.hits.length === 0 && placementRay.endNormal.y === 1
      ? placementRay.end : null;
    // A placement spends the normal shell and uses its recoil, with no extra pellet attack.
    const rays = placement ? [placementRay] : [];
    const pelletCone = pelletSpreadDegrees(d, aim.amount);
    // Resolve all rays before damage: a killed front zombie still stops this blast's other pellets.
    for (let i = 0; !placement && i < (d.pellets?.count ?? 1); i++) {
      const rayDirection = direction.clone();
      aim.applySpread(rayDirection);
      applyConeSpread(rayDirection, pelletCone);
      rays.push(castShot(origin, rayDirection, d.range, colliders, shootables, maxTargets));
    }
    aim.onShot(); // once per blast, once per dart
    const hits = rays.flatMap((ray) => ray.hits);
    const firstHit = hits[0];
    // One shot for run accuracy even if only a later pellet connected.
    const shot = d.pellets
      ? { ...rays[0], ...(firstHit ?? {}), hits, pellets: rays }
      : rays[0];
    if (d.charge) shot.chargeRatio = chargeRatio;
    if (placement) shot.workshopPlacement = placement;

    // Feedback, all this tick. Camera recoil (moves the crosshair, springs back) uses the aim
    // from before the kick, so this shot lands exactly where you were looking.
    kick(d, aim, d.charge ? 0.55 + 0.45 * chargeRatio : 1);
    const muzzlePosition = viewmodel.getMuzzleWorldPosition(muzzle);
    const targets = new Map();
    let puffs = 0;
    let marks = 0;
    for (const [rayIndex, ray] of rays.entries()) {
      const colors = d.pellets?.tracerColors;
      const color = colors ? colors[rayIndex % colors.length] : d.tracerColor;
      effects.tracer(muzzlePosition, ray.end, color, d.beam); // (d.beam: a gun's own fatter, longer streak: the Barcode Scanner's beam)
      ray.hits.forEach((hit, i) => {
        // Hits are worked out before any damage, so a target can be dead by the time its hit applies
        // (killed by an earlier pellet, or by something reacting to another kill this shot): skip it.
        if (targets.get(hit.target)?.killed || !hit.target.isAlive) return;
        const headshot = hit.part === 'head';
        // Headshot x distance falloff x pass-through (pierce) falloff x player stats: gunStats.js.
        const damage = hitDamage(d, hit, i, stats, chargeScale, hit.target);
        const returned = !!d.instantKill && isReturnable(hit.target);
        const { killed } = returned ? returnToSender(hit.target, { effects, sound, point: hit.point, normal: hit.normal, part: hit.part, direction, impact: d.impact, distance: hit.distance }) : hit.target.takeHit({
          damage,
          part: hit.part,
          point: hit.point,
          direction,
          impact: d.impact,
          weaponId: d.id,
          distance: hit.distance,
        });
        const previous = targets.get(hit.target);
        // On a kill, ONLY the killing pellet decides the headshot bonus.
        targets.set(hit.target, {
          hit: killed || headshot || !previous ? hit : previous.hit,
          killed, returned,
          headshot: killed ? headshot : headshot || (previous?.headshot ?? false),
        });
      });
      if (ray.hits.length < maxTargets && ray.end.distanceTo(origin) < d.range - 1e-3
        && (!d.pellets || puffs < feel.effects.maxPelletWallPuffs)) {
        effects.puff(ray.end, ray.endNormal);
        puffs += 1;
      }
      if (ray.worldHit && (!d.pellets || marks < impacts.maxPelletMarks)) {
        effects.impact?.(d.id, origin, ray.worldHit);
        marks++; // cap projection work too, even if a tiny/unsupported surface rejects the mark
      }
    }
    let anyKilled = false;
    let anyHeadshot = false;
    const baseImpulse = Math.sqrt(Math.max(1, d.impact?.deathImpulse ?? 1));
    for (const [target, result] of targets) {
      const { hit, killed, headshot } = result;
      anyKilled ||= killed;
      anyHeadshot ||= headshot;
      if (!result.returned) {
        effects.splat(hit.point, hit.normal, target.splatColors,
          headshot ? feel.effects.headshotSplatCount : feel.effects.splatCount, {
            flesh: true,
            speedScale: baseImpulse * (headshot ? 1.2 : 1),
            direction,
          });
      }
      if (onHit) onHit({ target, killed, headshot, melee: false, weaponId: d.id });
    }
    if (targets.size > 0) {
      const isHead = d.pellets ? anyHeadshot : shot.hits[0].part === 'head';
      hud.showHitMarker({ headshot: isHead, killed: anyKilled });
      if (sound) {
        sound.play(isHead ? 'hitHead' : 'hitBody');
        if (anyKilled) sound.play('killConfirm');
      }
    }
    shot.weaponId = d.id; // capture the firing gun, even if a kill listener switches the loadout
    shot.magazineLeft = weapon.magazine; // (Build-A-Blaster's Last Round heart)
    if (workshop === 'clearanceRack') {
      const resolvedHit = targets.values().next().value;
      if (resolvedHit) shot.clearanceHit = { ...resolvedHit, weapon, baseDamage: d.damage };
    }
    if (onShot) onShot(shot);
    return shot;
  }

  // Sounds and bumps placed along the reload (config: viewmodel.reload.events).
  function runReloadEvents(slot) {
    const progress = slot.weapon.reloadProgress;
    if (progress !== null) {
      const from = lastReloadProgress ?? -1; // a reload that just started counts from before 0
      for (const event of slot.def.viewmodel.reload.events) {
        if (event.at <= from || event.at > progress) continue;
        if (event.sound && sound) sound.play(event.sound);
        if (event.jolt) viewmodel.jolt(event.jolt);
      }
    }
    lastReloadProgress = progress;
  }

  return {
    lastShot: null, // most recent shot result (handy for debugging)

    // The gun in hand.
    get weapon() {
      return slots[current].weapon;
    },
    get aim() {
      return slots[current].aim;
    },
    get def() {
      return slots[current].def;
    },
    get slots() {
      return slots.map((s) => s.def.id);
    },

    // The carried gun not currently in hand (or null if only 1 gun is carried).
    get inactiveSlot() {
      if (slots.length <= 1) return null;
      const other = current === 0 ? 1 : 0;
      const s = slots[other];
      if (!s) return null;
      return { def: s.def, mods: s.mods, weapon: s.weapon, index: other };
    },

    // Match the displayed cone to gameplay, using interpolated ADS for the pellet portion.
    spreadDegreesForDisplay(aimAmount = slots[current].aim.amount) {
      return slots[current].aim.spreadDegrees + pelletSpreadDegrees(slots[current].def, aimAmount);
    },

    // For the viewmodel: which gun model is showing, and how far out of view it is (0 up .. 1 gone).
    get shownDef() {
      if (switching && switching.timer < ws.lowerSeconds) return switching.from.def;
      return slots[current].def;
    },
    get switchLower() {
      if (!switching) return 0;
      if (switching.timer < ws.lowerSeconds) return switching.timer / ws.lowerSeconds;
      return 1 - Math.min(1, (switching.timer - ws.lowerSeconds) / ws.raiseSeconds);
    },
    get isSwitching() {
      return switching !== null;
    },

    owns(id) {
      return slots.some((s) => s.def.id === id);
    },

    // The resolved gun with this id (or null).
    defOf(id) {
      return slots.find((s) => s.def.id === id)?.def ?? null;
    },

    // The carried Weapon with this id (or null).
    weaponFor(id) {
      const slot = slots.find((s) => s.def.id === id);
      return slot ? slot.weapon : null;
    },

    // Refill carried reserves; only the gun in hand receives the ready-magazine top-up.
    restock(magazineFraction) {
      for (const slot of slots) slot.weapon.restock(slot === slots[current] ? magazineFraction : 0);
    },

    // Upgrades on a carried gun ([] if none, null if you don't carry it).
    modsFor(id) {
      const slot = slots.find((s) => s.def.id === id);
      return slot ? slot.mods : null;
    },

    /**
     * Replace the upgrades on a carried gun (Build-A-Blaster etc.): re-resolves its stats from its config
     * entry + `mods` and hands them to its ammo/aim state. Ammo carries over (excess loaded rounds return to reserve).
     * Upgrades stay through ammo buys; they go with the gun when it's replaced, and on a new run.
     * Returns false if that gun isn't carried.
     */
    setMods(id, mods) {
      const slot = slots.find((s) => s.def.id === id);
      if (!slot) return false;
      slot.mods = mods;
      slot.def = resolveGun(slot.base, mods);
      slot.weapon.setDef(slot.def);
      slot.aim.setDef(slot.def);
      return true;
    },

    // True when the gun in hand is the Courtesy Loaner: nothing can be bought for it, it goes back at collection.
    get isLoaner() {
      return slots[current].loaner === true;
    },

    // The gun handed over at Build-A-Blaster, or null: { def, mods }.
    get away() {
      return away ? { def: away.def, mods: away.mods } : null;
    },

    /**
     * Build-A-Blaster: the gun in your hand leaves the loadout. Your other gun comes up, or, if it was your only
     * gun, `loanerDef` is lent to you (a plain gun, flagged as the loaner). Returns false if a gun is already away.
     */
    handOver(loanerDef) {
      if (away) return false;
      const slot = slots[current];
      slot.weapon.cancelFire();
      slot.weapon.cancelReload();
      away = slot;
      if (slots.length > 1) {
        slots.splice(current, 1);
        current = 0;
      } else {
        const loan = makeSlot(loanerDef);
        loan.loaner = true;
        slots[0] = loan;
      }
      startSwitch(0, slot);
      return true;
    },

    /**
     * Build-A-Blaster: the away gun comes back, loaded, into your hand, with withBuild(mods) as its new mods.
     * The slot it takes: see collectSlot. (Only a player with one gun gets the loaner, and that gun is always the starting
     * gun, which can't be bought again, so a loaner and a bought copy never meet.)
     */
    collect(withBuild = (mods) => mods) {
      if (!away) return false;
      const slot = away;
      away = null;
      slot.mods = withBuild(slot.mods);
      slot.def = resolveGun(slot.base, slot.mods);
      slot.weapon.setDef(slot.def);
      slot.aim.setDef(slot.def);
      slot.weapon.refill(); // (a build's bigger magazine comes loaded, and the reserve is topped up)
      const previous = slots[current];
      previous.weapon.cancelFire();
      previous.weapon.cancelReload();
      const index = collectSlot(slot.def.id);
      slots[index] = slot;
      startSwitch(index, previous);
      return true;
    },

    // Your named Build-A-Blaster guns' builds, whether carried or back at the workshop.
    get namedBuilds() {
      return [...slots, ...(away ? [away] : [])].map((s) => buildOf(s.mods)).filter((build) => build?.name);
    },

    // Is the Courtesy Loaner still in your loadout? (A bought gun can replace it.)
    get hasLoaner() {
      return slots.some((s) => s.loaner);
    },

    // The gun of yours that collecting would replace (its name), or null if it costs you nothing.
    get collectReplaces() {
      if (!away) return null;
      const replaced = slots[collectSlot(away.def.id)];
      return replaced && !replaced.loaner ? replaced.def.name : null;
    },

    /**
     * Bought a gun off the wall. Already have it: full ammo. Room in the loadout: added and
     * switched to. Loadout full: it replaces the gun in your hands (the old one drops away).
     */
    give(newDef) {
      const owned = slots.findIndex((s) => s.def.id === newDef.id);
      if (owned !== -1) {
        slots[owned].weapon.refill();
        return;
      }
      if (slots.length < MAX_SLOTS) {
        slots.push(makeSlot(newDef));
        startSwitch(slots.length - 1);
      } else {
        const old = slots[current];
        old.weapon.cancelFire();
        old.weapon.cancelReload();
        slots[current] = makeSlot(newDef);
        startSwitch(current, old);
      }
    },

    // Fixed-tick update. `blocked` (e.g. mid melee swing): no firing, reloading or switching this tick.
    // `reloadPaused` (e.g. vaulting): a reload in progress waits instead of continuing.
    update(dt, blocked = false, reloadPaused = false) {
      // --- Weapon switching ---
      const swap = input.consumeAction('switchWeapon');
      const pick1 = input.consumeAction('weapon1');
      const pick2 = input.consumeAction('weapon2');
      if (!blocked && !switching && slots.length > 1) {
        if (swap) startSwitch((current + 1) % slots.length);
        else if (pick1 && current !== 0) startSwitch(0);
        else if (pick2 && current !== 1) startSwitch(1);
      }
      if (switching) {
        switching.timer += dt * (stats.switchSpeed ?? 1);
        if (switching.timer >= ws.lowerSeconds + ws.raiseSeconds) switching = null;
      }

      const slot = slots[current];
      const busy = blocked || switching !== null;
      const pair = slot.akimbo ? akimboTriggers(slot, dt) : null; // (read before aim.update: right mouse is a trigger here, not ADS)
      slot.aim.update(dt, !busy && !pair); // melee/vaulting also lower ADS; no snap during a committed action
      // A scoped gun's view drifts in a slow figure eight while aimed (weapons/scope.js); crouched or prone it is steadier.
      // Only the change is added, so the view gets back exactly what the sway took when the scope comes down.
      const sway = scopeSway.update(dt, slot.def.scope, slot.aim.amount, player.stance === 'crouch' || player.stance === 'prone');
      if (sway.yaw !== 0 || sway.pitch !== 0) {
        player.yaw += sway.yaw;
        player.pitch += sway.pitch;
        player.clampPitch?.();
      }
      if (aimAssist) {
        if (busy) aimAssist.reset();
        else aimAssist.update(dt, slot.aim);
      }
      const trigger = pair ? pair.trigger : input.consumeAction('fire');
      const triggerHeld = pair ? pair.triggerHeld : input.actionDown('fire');
      const reload = input.consumeAction('reload') || reloadRequested;
      reloadRequested = false;
      const inspect = input.consumeAction('inspect');
      if (inspect && !busy && slot.weapon.reloadProgress === null && slot.aim.amount < 0.1) {
        inspectTimer = INSPECT_DURATION;
      }
      // Shooting while sprinting: drop to a walk and bring the gun up out of the running pose before
      // the shot goes off (the click is buffered, so it fires as soon as the gun is up).
      const wantsToFire = trigger || slot.weapon.isBursting || slot.weapon.isCharging || pair?.anyHeld
        || (triggerHeld && (slot.def.fireMode === 'auto' || slot.def.fireMode === 'charge'));
      if (wantsToFire || slot.aim.amount > 0.1 || player.isSprinting || reload || busy) {
        inspectTimer = 0;
      } else if (inspectTimer > 0) {
        inspectTimer = Math.max(0, inspectTimer - dt);
      }
      if (wantsToFire && !busy) {
        if (player.isSprinting || player.sprintAmount > 0.3) {
          slot.weapon.cooldown = Math.max(slot.weapon.cooldown, feel.sprint.sprintOutSeconds * player.sprintAmount);
        }
        player.blockSprint(feel.sprint.fireBlocksSprintSeconds);
      }
      const wasReloading = slot.weapon.isReloading;
      const result = slot.weapon.update(dt, {
        triggerPressed: trigger,
        triggerHeld,
        reloadPressed: reload,
        blocked: busy,
        reloadPaused,
      });
      if (!wasReloading && slot.weapon.isReloading) onReload?.({ weaponId: slot.def.id });
      if (slot.weapon.justStartedCharging && sound && slot.def.charge?.sound) {
        chargeVoice?.stop?.();
        chargeVoice = sound.play(slot.def.charge.sound);
      }
      // A scan let go of before it completed (or a gun switch/reload) cuts its whine off.
      if (chargeVoice && !slot.weapon.isCharging && result !== 'fire') { chargeVoice.stop?.(); chargeVoice = null; }
      if (result === 'fire') chargeVoice = null;
      if (result === 'fire') {
        player.blockSprint(feel.sprint.fireBlocksSprintSeconds);
        if (pair) akimboFired(slot, pair.side);
        shotSide = pair ? (pair.side === 0 ? 'left' : 'right') : null;
        this.lastShot = fire(slot);
        shotSide = null;
      } else if (result === 'empty') {
        // Dry click on an empty mag (the weapon starts reloading by itself).
        viewmodel.dryFire(slot.def);
        if (sound) sound.play(slot.def.sounds.dryFire);
      }
      runReloadEvents(slot);
    },

    // Inspect progress for viewmodel animation (0 to 1, or null if not inspecting).
    get inspectProgress() {
      return inspectTimer > 0 ? (1 - inspectTimer / INSPECT_DURATION) : null;
    },

    // Reload as if the reload button was pressed (next tick).
    requestReload() {
      reloadRequested = true;
    },

    // Save & Quit (game/saveGame.js): each carried gun (and one away at Build-A-Blaster) as its config id, its mods (plain
    // data) and its ammo. restore(data, defs) rebuilds them from `defs` (config/weapons.js), in hand, with no switch.
    serialize() {
      const slotData = (s) => ({
        id: s.base.id, loanerName: s.loaner ? s.base.name : null, mods: structuredClone(s.mods),
        magazine: s.weapon.magazine, reserve: s.weapon.reserve,
      });
      return { slots: slots.map(slotData), current, away: away ? slotData(away) : null };
    },
    restore(data, defs) {
      const slotFrom = (d) => {
        const base = d.loanerName ? { ...defs[d.id], name: d.loanerName, loaner: true } : defs[d.id];
        const slot = makeSlot(base, d.mods);
        if (d.loanerName) slot.loaner = true;
        slot.weapon.magazine = d.magazine;
        slot.weapon.reserve = d.reserve;
        return slot;
      };
      this.reset();
      slots = data.slots.map(slotFrom);
      current = Math.min(data.current, slots.length - 1);
      away = data.away ? slotFrom(data.away) : null;
    },

    // New run: just the starting gun, full ammo, hip fire.
    reset() {
      slots = [makeSlot(startDef)];
      slots[0].aim.reset(); // clear the old gun's ADS progress and handling penalty immediately
      current = 0;
      switching = null;
      away = null;
      reloadRequested = false;
      inspectTimer = 0;
      lastReloadProgress = null;
      this.lastShot = null;
      blastPay.clear(); // (a stream's pay ledgers start over with the run)
      scopeSway.reset(); // (the player's view is reset with the run too)
    },
  };
}
