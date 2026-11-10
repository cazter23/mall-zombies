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

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { Weapon } from './weapon.js';
import { workshopBuilds, workshopModOf, buildOf } from '../config/workshop.js';
import { castShot } from './hitscan.js';
import { createAim, applyConeSpread, pelletSpreadDegrees } from './aim.js';
import { hitDamage, resolveGun, isReturnable } from './gunStats.js';
import { findInCone, blowAway, createBlastPay } from './coneBlast.js';
import { impacts } from '../config/impacts.js';

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
}) {
  const startDef = def;
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  let lastReloadProgress = null; // for spotting reload events as the clock passes them
  let reloadRequested = false; // set by requestReload() (e.g. a controller X tap next to a buyable)
  let inspectTimer = 0;
  const INSPECT_DURATION = 1.8;

  // A slot = one carried gun: its config entry (`base`), its upgrades (`mods`), the resolved gun those
  // make (`def`, what gameplay reads), its ammo/cooldown state and its own aim (ADS/spread) settings.
  const makeSlot = (base, mods = []) => {
    const d = resolveGun(base, mods);
    return { base, mods, def: d, weapon: new Weapon(d, stats), aim: createAim({ def: d, input, player }) };
  };
  let slots = [makeSlot(startDef)];
  let current = 0; // index of the gun in hand

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
    viewmodel.fire(ads, d); // gun kick + muzzle flash using this shot's resolved stats (visual only)
    if (sound) sound.play(d.sounds.fire);
    return ads;
  }

  // A gun with a cone (the Leaf Blower): one PULSE of wind instead of a ray. Everything in the cone is shoved back (and the close ones laid down),
  // takes a tickle of damage, and the leaves fly. Points: a zombie that keeps being blown pays the hit +10 only now and then (createBlastPay).
  const blastPay = new Map(); // gun id -> its pulse ledger
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
    for (const { target, distance, point } of found) {
      if (!target.isAlive) continue; // (killed earlier this pulse by a kill listener)
      const hit = { target, part: 'body', point: point.clone(), normal: direction.clone().negate(), distance };
      hits.push(hit);
      const { killed } = target.takeHit({ damage: hitDamage(d, hit, 0, stats), part: 'body', point: hit.point, direction, impact: d.impact });
      if (!killed) blowAway(target, origin, cone, distance);
      resolved.push({ hit, killed, paid: killed || pay.take(target) });
    }
    const end = origin.clone().addScaledVector(direction, cone.range);
    const gust = cone.gust;
    effects.confetti(origin.clone().addScaledVector(direction, cone.range * 0.55), direction, gust);
    let paidAny = false;
    let anyKilled = false;
    for (const { hit, killed, paid } of resolved) {
      anyKilled ||= killed;
      if (killed) effects.splat(hit.point, hit.normal, hit.target.splatColors, feel.effects.splatCount, { flesh: true, speedScale: 1, direction });
      if (paid) {
        paidAny = true;
        if (onHit) onHit({ target: hit.target, killed, headshot: false, melee: false });
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
    const ahead = start.clone().addScaledVector(throwDirection, 6);
    const shot = { origin: start.clone(), end: ahead, endNormal: throwDirection.clone().negate(), point: ahead.clone(), normal: throwDirection.clone().negate(),
      distance: 6, target: null, part: null, hits: [], worldHit: null, projectile: true, weaponId: d.id, magazineLeft: weapon.magazine };
    let counted = false;
    balls.launch({
      position: start,
      direction: throwDirection,
      projectile,
      impact: d.impact,
      damageOf: ({ part, distance }) => hitDamage(d, { part, distance }, 0, stats),
      onHit({ target, part, point, normal, killed, direction: hitDirection }) {
        const headshot = part === 'head';
        if (!counted) { counted = true; onProjectileHit?.(); }
        effects.splat(point, normal, target.splatColors, headshot ? feel.effects.headshotSplatCount : feel.effects.splatCount,
          { flesh: true, speedScale: Math.sqrt(Math.max(1, d.impact?.deathImpulse ?? 1)) * (headshot ? 1.2 : 1), direction: hitDirection });
        if (onHit) onHit({ target, killed, headshot, melee: false });
        hud.showHitMarker({ headshot, killed });
        if (sound) {
          sound.play(headshot ? 'hitHead' : 'hitBody');
          if (killed) sound.play('killConfirm');
        }
      },
      onBounce({ point, normal, target }) {
        if (sound) sound.play(projectile.bounceSound);
        if (!target) effects.puff(point, normal);
      },
    });
    if (onShot) onShot(shot);
    return shot;
  }

  function fire(slot) {
    if (slot.def.projectile && balls) return fireProjectile(slot);
    if (slot.def.cone) return fireCone(slot);
    const { def: d, aim, weapon } = slot;
    player.getAim(origin, direction);
    const chargeRatio = d.charge ? (weapon.lastChargeRatio ?? 1) : 1;
    const chargeScale = d.charge ? d.charge.minDamageMultiplier + (1 - d.charge.minDamageMultiplier) * chargeRatio : 1;
    const pierce = d.pierce ?? null;
    const maxTargets = pierce
      ? (d.charge
          ? Math.round((d.charge.minTargets ?? 1) + (pierce.maxTargets - (d.charge.minTargets ?? 1)) * chargeRatio)
          : pierce.maxTargets)
      : 1;
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
      effects.tracer(muzzlePosition, ray.end, color);
      ray.hits.forEach((hit, i) => {
        // Hits are worked out before any damage, so a target can be dead by the time its hit applies
        // (killed by an earlier pellet, or by something reacting to another kill this shot): skip it.
        if (targets.get(hit.target)?.killed || !hit.target.isAlive) return;
        const headshot = hit.part === 'head';
        // Headshot x distance falloff x pass-through (pierce) falloff x player stats: gunStats.js.
        const damage = hitDamage(d, hit, i, stats, chargeScale, hit.target);
        const { killed } = hit.target.takeHit({
          damage,
          part: hit.part,
          point: hit.point,
          direction,
          impact: d.impact,
        });
        const previous = targets.get(hit.target);
        // On a kill, ONLY the killing pellet decides the headshot bonus.
        targets.set(hit.target, {
          hit: killed || headshot || !previous ? hit : previous.hit,
          killed,
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
      if (killed && d.instantKill && isReturnable(target)) {
        // Returned to sender: boxed up in cardboard and tape instead of the usual splatter.
        effects.confetti(hit.point, hit.normal, d.instantKill.box);
        if (sound) sound.play('returnStamp');
      } else {
        effects.splat(hit.point, hit.normal, target.splatColors,
          headshot ? feel.effects.headshotSplatCount : feel.effects.splatCount, {
            flesh: true,
            speedScale: baseImpulse * (headshot ? 1.2 : 1),
            direction,
          });
      }
      if (onHit) onHit({ target, killed, headshot, melee: false });
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
    get secondaryDef() {
      return this.inactiveSlot;
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
      slot.aim.update(dt, !busy); // melee/vaulting also lower ADS; no snap during a committed action
      if (aimAssist) {
        if (busy) aimAssist.reset();
        else aimAssist.update(dt, slot.aim);
      }
      const trigger = input.consumeAction('fire');
      const triggerHeld = input.actionDown('fire');
      const reload = input.consumeAction('reload') || reloadRequested;
      reloadRequested = false;
      const inspect = input.consumeAction('inspect');
      if (inspect && !busy && slot.weapon.reloadProgress === null && slot.aim.amount < 0.1) {
        inspectTimer = INSPECT_DURATION;
      }
      // Shooting while sprinting: drop to a walk and bring the gun up out of the running pose before
      // the shot goes off (the click is buffered, so it fires as soon as the gun is up).
      const wantsToFire = trigger || slot.weapon.isBursting || slot.weapon.isCharging
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
        sound.play(slot.def.charge.sound);
      }
      if (result === 'fire') {
        player.blockSprint(feel.sprint.fireBlocksSprintSeconds);
        this.lastShot = fire(slot);
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
    },
  };
}
