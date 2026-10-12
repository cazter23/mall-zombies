// =============================================================================
// PLAYER HEALTH
// Taking damage, regenerating, and dying. Health itself lives in the stats
// object (stats.health / stats.maxHealth) so perks can change it; so do the
// regen delay and rate. At zero health this calls onDeath exactly once: the
// game's single death path (onPlayerDeath in main.js), so a downed/revive
// system can hook in there later.
// Runs on the fixed tick.
// =============================================================================

import { feel } from '../config/feel.js';

export function createPlayerHealth({ stats, onDeath }) {
  let sinceHit = Infinity; // seconds since the last hit (regen waits for stats.regenDelay)
  let flash = 0; // seconds left on the red hit flash
  let time = 0; // for the low-health pulse
  let dead = false;

  return {
    get isDead() {
      return dead;
    },

    get fraction() {
      return stats.health / stats.maxHealth;
    },

    takeDamage(amount) {
      if (dead || amount <= 0) return;
      stats.health = Math.max(0, stats.health - amount);
      sinceHit = 0;
      flash = feel.health.hitFlashSeconds;
      if (stats.health <= 0) {
        dead = true;
        onDeath();
      }
    },

    update(dt) {
      time += dt;
      flash = Math.max(0, flash - dt);
      if (dead) return;
      sinceHit += dt;
      if (sinceHit >= stats.regenDelay && stats.health < stats.maxHealth) {
        stats.health = Math.min(stats.maxHealth, stats.health + stats.regenRate * dt);
      }
    },

    // 0..1: how strongly the screen edges glow red. Grows as health drops, pulses
    // when low ("one more hit and you're down"), and flashes on every hit.
    get overlay() {
      const h = feel.health;
      const fraction = this.fraction;
      let strength = (1 - fraction) * h.hurtMaxOpacity;
      if (fraction < h.lowHealthFraction && !dead) {
        // Low health: a much stronger, clearly throbbing glow, so it's unmistakable vs. one hit.
        const pulse = 0.5 + 0.5 * Math.sin(time * h.pulseSpeed);
        strength = h.lowHealthOpacity * (1 - h.pulseAmount + h.pulseAmount * pulse);
      }
      const hitFlash = (flash / h.hitFlashSeconds) * h.hitFlashOpacity;
      return Math.min(1, Math.max(strength, hitFlash));
    },

    // Back to full health for a new run.
    reset() {
      stats.health = stats.maxHealth;
      sinceHit = Infinity;
      flash = 0;
      dead = false;
    },
  };
}
