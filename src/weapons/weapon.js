// =============================================================================
// WEAPON STATE
// Ammo, fire rate, and reloading for one gun. Pure state: it decides WHEN a
// shot goes off; playerGun.js decides what the shot hits and shows the effects.
// Runs on the fixed game tick.
// =============================================================================

export class Weapon {
  constructor(def, stats) {
    this.burstRemaining = 0;
    this.chargeTimer = 0; // seconds spent charging the current shot (fireMode: 'charge')
    this.lastChargeRatio = 1; // 0..1 charge level of the most recently fired shot
    this.justStartedCharging = false; // true on the tick a charge begins (triggers charge sound)
    this.reloadPhase = null; // shell-by-shell guns: 'start' (open up) -> 'shell' (one per cycle) -> 'end' (close up)
    this.reloadQueued = false; // a reload press during a burst waits for its last dart
    this.def = def; // entry from config/weapons.js
    this.stats = stats; // player stats (damageMultiplier, reloadSpeed)
    this.magazine = def.magazineSize;
    this.reserve = def.startingReserve;

    this.cooldown = 0; // seconds until the next shot is allowed
    this.fireRequest = 0; // > 0 while a click is waiting to be fired (click buffer)
    this.reloadTimer = 0; // seconds left in the current reload (0 = not reloading)
    this.reloadDuration = 0;
  }

  get isBursting() {
    return this.burstRemaining > 0;
  }

  get isCharging() {
    return this.chargeTimer > 0;
  }

  // 0..1 progress toward a full charge (0 when not charging).
  get chargeProgress() {
    if (!this.isCharging || !this.def.charge) return 0;
    return Math.min(1, this.chargeTimer / this.def.charge.seconds);
  }

  // The gun's stats changed (an upgrade was applied: gunStats.js resolveGun). Ammo carries over,
  // excess magazine rounds return to reserve; anything mid-way (burst, reload) is dropped.
  setDef(def) {
    this.cancelFire();
    this.cancelReload();
    this.def = def;
    const excess = Math.max(0, this.magazine - def.magazineSize);
    this.magazine -= excess;
    this.reserve += excess; // Unloaded rounds remain yours, even if the reserve was already full.
  }

  // Lowering the gun abandons both remaining darts and buffered input.
  cancelFire() {
    this.burstRemaining = 0;
    this.chargeTimer = 0;
    this.justStartedCharging = false;
    this.fireRequest = 0;
    this.reloadQueued = false;
  }

  get isReloading() {
    return this.reloadTimer > 0;
  }

  // Shell-by-shell reload (def.shellReload, e.g. the Confetti Cannon): one shell in per cycle, and
  // firing interrupts it as soon as there is a shell in the gun.
  get isShellReload() {
    return !!this.def.shellReload;
  }

  // 0 at the start of a reload, 1 when done. Null when not reloading. A shell-by-shell reload maps its
  // phases onto windows of the animation (def.shellReload.progress): the "one shell" window repeats
  // for every shell, so the same hand animation plays each time.
  get reloadProgress() {
    if (!this.isReloading) return null;
    const t = 1 - this.reloadTimer / this.reloadDuration;
    if (!this.isShellReload) return t;
    const [a, b] = this.def.shellReload.progress[this.reloadPhase];
    return a + (b - a) * t;
  }

  // Magazine and reserve both full (nothing an ammo buy would add).
  get isFull() {
    return this.magazine === this.def.magazineSize && this.reserve >= this.def.startingReserve;
  }

  // Ammo buy: magazine and reserve back to full. Any reload in progress is finished off.
  refill() {
    this.cancelFire();
    this.magazine = this.def.magazineSize;
    this.reserve = Math.max(this.reserve, this.def.startingReserve);
    this.reloadTimer = 0;
    this.reloadPhase = null;
  }

  // Stockroom Delivery: reserve ammo, with a small ready-magazine top-up.
  // Never bypass a running reload or the Cannon's individual shell loading.
  restock(magazineFraction = 0) {
    this.reserve = Math.max(this.reserve, this.def.startingReserve);
    if (!this.isReloading && !this.isShellReload) {
      this.magazine = Math.max(this.magazine, Math.ceil(this.def.magazineSize * magazineFraction));
    }
  }

  get canReload() {
    return !this.isBursting && !this.isCharging && !this.isReloading && this.magazine < this.def.magazineSize && this.reserve > 0;
  }

  startReload() {
    if (this.isBursting) {
      this.reloadQueued = true;
      return;
    }
    this.chargeTimer = 0;
    this.reloadQueued = false;
    if (!this.canReload) return;
    if (this.isShellReload) {
      this.reloadPhase = 'start';
      this.reloadDuration = this.def.shellReload.startSeconds / this.stats.reloadSpeed;
    } else {
      this.reloadDuration = this.def.reloadTime / this.stats.reloadSpeed;
    }
    this.reloadTimer = this.reloadDuration;
  }

  // Abandon a reload in progress (no ammo is lost; shells already loaded stay loaded).
  cancelReload() {
    this.reloadQueued = false;
    this.reloadTimer = 0;
    this.reloadPhase = null;
  }

  // Full ammo and no timers, for a new run.
  reset() {
    this.cancelFire();
    this.magazine = this.def.magazineSize;
    this.reserve = this.def.startingReserve;
    this.cooldown = 0;
    this.fireRequest = 0;
    this.reloadTimer = 0;
    this.reloadPhase = null;
  }

  // A shell-by-shell reload's current phase ran out: put the shell in (after a 'shell' phase), then start
  // the next shell, or close the gun up when it's full / out of reserve. (The leftover fraction of a tick
  // carries over, so the timing doesn't drift.)
  advanceShellReload() {
    const sr = this.def.shellReload;
    const begin = (phase, seconds) => {
      this.reloadPhase = phase;
      this.reloadDuration = seconds / this.stats.reloadSpeed;
      this.reloadTimer += this.reloadDuration;
    };
    if (this.reloadPhase === 'end') {
      this.reloadTimer = 0;
      this.reloadPhase = null;
      return;
    }
    if (this.reloadPhase === 'shell') {
      this.magazine += 1;
      this.reserve -= 1;
    }
    if (this.magazine < this.def.magazineSize && this.reserve > 0) begin('shell', sr.shellSeconds);
    else begin('end', sr.endSeconds);
  }

  finishReload() {
    const needed = this.def.magazineSize - this.magazine;
    const loaded = Math.min(needed, this.reserve);
    this.magazine += loaded;
    this.reserve -= loaded;
    this.reloadTimer = 0;
  }

  /**
   * Advance one tick. `triggerPressed` / `reloadPressed` are one-shot presses; `triggerHeld` is the
   * trigger being held down (a full-auto gun keeps firing while it is).
   * A burst press starts def.burst.count darts; fireInterval is the pause after its LAST dart.
   * Reload presses during a burst queue until it finishes. Blocking drops the burst and queue.
   * `blocked` (e.g. mid box-cutter swing): nothing fires, and a click queued just before is dropped.
   * `reloadPaused`: a reload in progress holds where it is (and carries on afterwards).
   * Returns 'fire' if a shot goes off this tick, 'empty' on a dry click, else null.
   */
  update(dt, { triggerPressed, triggerHeld = false, reloadPressed, blocked = false, reloadPaused = false }) {
    // The cooldown may dip just below zero on the tick it runs out. If a click is waiting, that
    // leftover fraction of a tick counts toward the next shot, so the real fire rate matches
    // fireInterval instead of rounding up to whole ticks (0.12s, not 0.133s at 60Hz). A gun that
    // was already ready stays at exactly zero, so waiting never banks up a faster next shot.
    this.cooldown = this.cooldown > 0 ? this.cooldown - dt : 0;
    this.fireRequest = Math.max(0, this.fireRequest - dt);
    this.justStartedCharging = false;

    if (this.isReloading && !reloadPaused) {
      // (`reloadPaused`: hands busy for a moment, e.g. vaulting: the reload waits, then carries on.)
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        if (this.isShellReload) this.advanceShellReload();
        else this.finishReload();
      }
    }

    if (blocked) {
      this.cancelFire();
      return null;
    }

    if (reloadPressed || (this.reloadQueued && !this.isBursting)) this.startReload();

    if (this.def.fireMode === 'charge') {
      if (this.isCharging) {
        if (this.isReloading) {
          this.chargeTimer = 0;
          return null;
        }
        if (triggerHeld) {
          this.chargeTimer += dt;
          if (this.chargeTimer >= this.def.charge.seconds) {
            return this.fireChargedShot(1);
          }
          return null;
        }
        return this.fireChargedShot(this.chargeProgress);
      }
      const wantsCharge = triggerPressed || (triggerHeld && this.magazine > 0);
      this.fireRequest = wantsCharge ? this.def.fireBuffer : 0;
      if (triggerHeld && !triggerPressed && this.magazine === 0) this.startReload();
    } else if (this.def.fireMode === 'auto') {
      // Full auto: fires whenever the cooldown allows while the trigger is held (a fresh press
      // counts too). An empty gun only dry-clicks on a fresh press, not every tick.
      const wantsShot = triggerPressed || (triggerHeld && this.magazine > 0);
      this.fireRequest = wantsShot ? this.def.fireBuffer : 0;
      // Ran dry while still holding the trigger: reload by itself (COD).
      if (triggerHeld && !triggerPressed && this.magazine === 0) this.startReload();
    } else if (triggerPressed) {
      this.fireRequest = this.def.fireBuffer;
    }

    if (this.isBursting) {
      if (this.cooldown > 0) return null;
      return this.fireBurstDart();
    }

    if (this.fireRequest <= 0 || this.cooldown > 0) return null;
    if (this.isReloading) {
      // Normal guns wait for the reload. A shell-by-shell gun can fire mid-reload once it has a shell in it.
      if (!(this.isShellReload && this.magazine > 0)) return null;
      this.cancelReload();
    }
    this.fireRequest = 0;

    if (this.magazine <= 0) {
      this.startReload(); // clicking on empty reloads automatically
      this.cooldown = 0;
      return 'empty';
    }

    if (this.def.fireMode === 'charge') {
      if (!triggerHeld) return this.fireChargedShot(0);
      this.chargeTimer = dt;
      this.justStartedCharging = true;
      if (this.chargeTimer >= this.def.charge.seconds) {
        return this.fireChargedShot(1);
      }
      return null;
    }

    if (this.def.fireMode === 'burst') {
      this.burstRemaining = this.def.burst.count;
      return this.fireBurstDart();
    }

    this.magazine -= 1;
    this.cooldown += this.def.fireInterval; // carries the leftover (cooldown is <= 0 here)
    return 'fire';
  }

  fireChargedShot(ratio) {
    this.lastChargeRatio = Math.max(0, Math.min(1, ratio));
    this.chargeTimer = 0;
    this.magazine -= 1;
    this.cooldown = Math.min(0, this.cooldown) + this.def.fireInterval;
    return 'fire';
  }

  fireBurstDart() {
    this.magazine -= 1;
    this.burstRemaining -= 1;
    if (this.magazine === 0) this.burstRemaining = 0; // stop cleanly, no automatic dry clicks
    this.cooldown += this.isBursting ? this.def.burst.interval : this.def.fireInterval;
    return 'fire';
  }
}
