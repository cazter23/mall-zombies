// =============================================================================
// FUEL (a gun with a tank instead of a magazine you reload: the Leaf Blower)
//
// Pure timing, no THREE and no DOM, so it is tested alone (tests/fuel.test.js). The tank's LEVEL is the weapon's `magazine` (whole units), so the
// HUD, the RESTOCK-O-MATIC, Refurbished grabs, Build-A-Blaster and the Stockroom Delivery all keep working on it unchanged. This module owns what
// is new: the tank REFILLS BY ITSELF a moment after you stop blowing, and running it dry LOCKS the trigger until it has built up a little fuel
// again (so an empty blower doesn't sputter one pulse a time).
//
// The numbers are the gun's `fuel` block in config/weapons.js:
//   regenDelay      seconds after the last pulse before the tank starts to refill
//   regenPerSecond  units per second while it refills
//   restartAt       after running dry, the trigger stays locked until the tank holds this much
//
// weapon.js owns one of these (`weapon.fuel`) and calls tickFuel once per tick.
// =============================================================================

/** A fresh tank's timing state. */
export function createFuel() {
  return { sinceFire: Infinity, carry: 0, locked: false };
}

/**
 * Advance the tank one tick.
 *   cfg:   the gun's `fuel` block
 *   input: { fired, level, capacity }   fired = a pulse went off this tick; level = the units in the tank now; capacity = the tank's size
 * Returns the whole units to ADD to the tank this tick (0 while firing, during the delay, or when full). Updates `state` (including the lock).
 */
export function tickFuel(state, cfg, dt, { fired, level, capacity }) {
  if (fired) {
    state.sinceFire = 0;
    state.carry = 0;
  } else {
    state.sinceFire += dt;
  }
  let gained = 0;
  if (!fired && state.sinceFire >= cfg.regenDelay && level < capacity) {
    state.carry += cfg.regenPerSecond * dt;
    gained = Math.min(Math.floor(state.carry), capacity - level);
    state.carry -= gained;
    if (level + gained >= capacity) state.carry = 0;
  }
  const after = level + gained;
  if (after <= 0) state.locked = true; // ran dry
  else if (state.locked && after >= cfg.restartAt) state.locked = false;
  return gained;
}

/** Back to a full, unlocked tank (a refill, a new run). */
export function resetFuel(state) {
  state.sinceFire = Infinity;
  state.carry = 0;
  state.locked = false;
}
