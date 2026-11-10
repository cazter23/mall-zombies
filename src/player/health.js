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

export function createPlayerHealth({ stats, onDeath, onRegenStart = null }) {
  let sinceHit = Infinity; // seconds since the last hit (regen waits for stats.regenDelay)
  let regenerating = false; // health is climbing back (onRegenStart fires once each time that begins)
  let flash = 0; // seconds left on the red hit flash
  let time = 0; // for the low-health pulse
  let dead = false;
  let killedBy = null; // source of the lethal blow ({ type, id, variant, boss, fall })

  return {
    get regenWaitFraction() {
      return dead || stats.health >= stats.maxHealth ? null : Math.min(1, sinceHit / stats.regenDelay);
    },
    // Debug god mode (game/debugCommands.js): no damage at all while true. Not part of a run, so it survives Play again.
    invulnerable: false,

    get isDead() {
      return dead;
    },

    get killedBy() {
      return killedBy;
    },

    get fraction() {
      return stats.health / stats.maxHealth;
    },

    // The amount is final: clothes scale ZOMBIE hits in the 'playerHit' listener (game/createGame.js), never a fall.
    takeDamage(amount, source = null) {
      if (dead || amount <= 0 || this.invulnerable) return;
      stats.health = Math.max(0, stats.health - amount);
      sinceHit = 0;
      regenerating = false;
      flash = feel.health.hitFlashSeconds;
      if (stats.health <= 0) {
        dead = true;
        killedBy = source;
        onDeath(killedBy);
      }
    },

    update(dt) {
      time += dt;
      flash = Math.max(0, flash - dt);
      if (dead) return;
      sinceHit += dt;
      if (sinceHit >= stats.regenDelay && stats.health < stats.maxHealth) {
        if (!regenerating) {
          regenerating = true;
          if (onRegenStart) onRegenStart();
        }
        stats.health = Math.min(stats.maxHealth, stats.health + stats.regenRate * dt);
      } else if (stats.health >= stats.maxHealth) {
        regenerating = false;
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
      regenerating = false;
      flash = 0;
      dead = false;
      killedBy = null;
    },
  };
}
