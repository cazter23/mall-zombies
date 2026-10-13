// =============================================================================
// WEAPON STATE
// Ammo, fire rate, and reloading for one gun. Pure state: it decides WHEN a
// shot goes off; playerGun.js decides what the shot hits and shows the effects.
// Runs on the fixed game tick.
// =============================================================================

export class Weapon {
  constructor(def, stats) {
    this.def = def; // entry from config/weapons.js
    this.stats = stats; // player stats (damageMultiplier, reloadSpeed)
    this.magazine = def.magazineSize;
    this.reserve = def.startingReserve;

    this.cooldown = 0; // seconds until the next shot is allowed
    this.fireRequest = 0; // > 0 while a click is waiting to be fired (click buffer)
    this.reloadTimer = 0; // seconds left in the current reload (0 = not reloading)
    this.reloadDuration = 0;
  }

  get isReloading() {
    return this.reloadTimer > 0;
  }

  // 0 at the start of a reload, 1 when done. Null when not reloading.
  get reloadProgress() {
    return this.isReloading ? 1 - this.reloadTimer / this.reloadDuration : null;
  }

  get canReload() {
    return !this.isReloading && this.magazine < this.def.magazineSize && this.reserve > 0;
  }

  startReload() {
    if (!this.canReload) return;
    this.reloadDuration = this.def.reloadTime / this.stats.reloadSpeed;
    this.reloadTimer = this.reloadDuration;
  }

  // Abandon a reload in progress (no ammo is lost; it just has to start again).
  cancelReload() {
    this.reloadTimer = 0;
  }

  // Full ammo and no timers, for a new run.
  reset() {
    this.magazine = this.def.magazineSize;
    this.reserve = this.def.startingReserve;
    this.cooldown = 0;
    this.fireRequest = 0;
    this.reloadTimer = 0;
  }

  finishReload() {
    const needed = this.def.magazineSize - this.magazine;
    const loaded = Math.min(needed, this.reserve);
    this.magazine += loaded;
    this.reserve -= loaded;
    this.reloadTimer = 0;
  }

  /**
   * Advance one tick. `triggerPressed` / `reloadPressed` are one-shot presses.
   * `blocked` (e.g. mid box-cutter swing): nothing fires, and a click queued just before is dropped.
   * Returns 'fire' if a shot goes off this tick, 'empty' on a dry click, else null.
   */
  update(dt, { triggerPressed, reloadPressed, blocked = false }) {
    // The cooldown may dip just below zero on the tick it runs out. If a click is waiting, that
    // leftover fraction of a tick counts toward the next shot, so the real fire rate matches
    // fireInterval instead of rounding up to whole ticks (0.12s, not 0.133s at 60Hz). A gun that
    // was already ready stays at exactly zero, so waiting never banks up a faster next shot.
    this.cooldown = this.cooldown > 0 ? this.cooldown - dt : 0;
    this.fireRequest = Math.max(0, this.fireRequest - dt);

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }

    if (blocked) {
      this.fireRequest = 0;
      return null;
    }

    if (reloadPressed) this.startReload();
    if (triggerPressed) this.fireRequest = this.def.fireBuffer;

    if (this.fireRequest <= 0 || this.cooldown > 0 || this.isReloading) return null;
    this.fireRequest = 0;

    if (this.magazine <= 0) {
      this.startReload(); // clicking on empty reloads automatically
      this.cooldown = 0;
      return 'empty';
    }

    this.magazine -= 1;
    this.cooldown += this.def.fireInterval; // carries the leftover (cooldown is <= 0 here)
    return 'fire';
  }

}
