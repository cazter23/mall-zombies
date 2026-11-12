// =============================================================================
// SCOPE: a real telescopic sight for a gun with `scope` in config/weapons.js (the Stargazer 3000).
// Three small pieces, each pure or nearly so, so they run headless and are tested alone (tests/scope.test.js):
//
//   scopeOverlay(scope, aimAmount)   0..1: how far the eyepiece fills the view. 0 below scope.overlayFrom, 1 when fully
//                                    aimed. main.js draws the eyepiece at this opacity (ui/hud.js setScope) and stops
//                                    drawing the gun model once it is 1 (you are looking THROUGH the gun).
//   scopeSwayOffset(scope, t, aim, crouched)   the view's drift at time t, in radians { yaw, pitch }: a slow figure
//                                    eight, scaled by how far you are aimed (none at the hip), smaller while crouched.
//   createScopeSway()                turns that offset into per-tick CHANGES for player.yaw / pitch (playerGun.js), so the
//                                    crosshair really drifts (shots go where you look) and the player corrects it. Only the
//                                    change is applied, so dropping the scope gives back exactly what the sway took: no drift
//                                    is ever left behind.
//
// The bolt: after each shot the ADS amount falls back to scope.boltDropTo (weapons/aim.js onShot), the eye comes off the
// eyepiece while the bolt is worked, and it eases back in by itself while aim is still held.
// =============================================================================

const DEG_TO_RAD = Math.PI / 180;

/** 0..1: how much of the view the eyepiece covers at this ADS amount. A gun without a scope never shows one. */
export function scopeOverlay(scope, aimAmount) {
  if (!scope) return 0;
  const from = scope.overlayFrom;
  if (aimAmount <= from) return 0;
  if (aimAmount >= 1) return 1;
  return (aimAmount - from) / (1 - from);
}

/** The sway at time `t` (s): a figure eight, `sway.degrees` wide each way, scaled by aimAmount (0 at the hip). */
export function scopeSwayOffset(scope, t, aimAmount, crouched = false) {
  const sway = scope?.sway;
  if (!sway || aimAmount <= 0) return { yaw: 0, pitch: 0 };
  const size = sway.degrees * DEG_TO_RAD * aimAmount * (crouched ? sway.crouchMultiplier : 1);
  const phase = (2 * Math.PI * t) / sway.periodSeconds;
  return { yaw: size * Math.sin(phase), pitch: size * sway.pitchShare * Math.sin(2 * phase) };
}

/**
 * Per-tick sway changes. update(dt, scope, aimAmount, crouched) -> { yaw, pitch }: what to ADD to the view this tick.
 * The clock only runs while there is sway, so every aim starts from the middle of the eight.
 */
export function createScopeSway() {
  let time = 0;
  let applied = { yaw: 0, pitch: 0 }; // the offset already added to the view
  const change = { yaw: 0, pitch: 0 };
  return {
    update(dt, scope, aimAmount, crouched = false) {
      if (scope?.sway && aimAmount > 0) time += dt;
      else time = 0;
      const next = scopeSwayOffset(scope, time, aimAmount, crouched);
      change.yaw = next.yaw - applied.yaw;
      change.pitch = next.pitch - applied.pitch;
      applied = next;
      return change;
    },
    /** The offset the view carries right now (radians). */
    get offset() {
      return applied;
    },
    /** New run (or a gun swap that already reset the view): forget the offset without handing it back. */
    reset() {
      time = 0;
      applied = { yaw: 0, pitch: 0 };
    },
  };
}
