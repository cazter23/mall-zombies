// =============================================================================
// PLAYER HEALTH
// Taking damage, regenerating, and dying. Health itself lives in the stats
// object (stats.health / stats.maxHealth) so perks can change it; so do the
// regen delay and rate. A lethal hit calls the game's single death handler
// in createGame.js, which can revive the player before ending the run.
// Runs on the fixed tick.
// =============================================================================

import { feel } from '../config/feel.js';
import { armourDefaults } from './stats.js';

export function createPlayerHealth({ stats, onDeath, onRegenStart = null }) {
  let sinceHit = Infinity; // seconds since the last hit (regen waits for stats.regenDelay)
  let regenerating = false; // health is climbing back (onRegenStart fires once each time that begins)
  let flash = 0; // seconds left on the red hit flash
  let time = 0; // for the low-health pulse
  let dead = false;
  let killedBy = null; // source of the lethal blow ({ type, id, variant, boss, fall })
  let reviveProtection = 0;
  const armour = [];

  return {
    get regenWaitFraction() {
      return dead || stats.health >= stats.maxHealth ? null : Math.min(1, sinceHit / stats.regenDelay);
    },
    // Debug god mode (game/debugCommands.js): no damage at all while true. Not part of a run, so it survives Play again.
    invulnerable: false,

    get isReviveProtected() {
      return reviveProtection > 1e-9;
    },

    get armour() {
      return armour.slice();
    },

    get maxArmourLayers() {
      return stats.maxArmourLayers ?? armourDefaults.maxArmourLayers;
    },

    addArmour(count = 1) {
      const strength = stats.armourLayerStrength ?? armourDefaults.armourLayerStrength;
      const added = Math.max(0, Math.min(count, this.maxArmourLayers - armour.length));
      for (let i = 0; i < added; i++) armour.push(strength);
      return added;
    },

    // Save & Quit (game/saveGame.js): the layers as they are (each one's strength left).
    restoreArmour(layers) {
      armour.length = 0;
      armour.push(...layers.slice(0, this.maxArmourLayers));
    },

    absorb(amount) {
      let popped = 0;
      while (!dead && !this.invulnerable && amount > 0 && armour.length) {
        const outer = armour.length - 1;
        const absorbed = Math.min(amount, armour[outer]);
        armour[outer] -= absorbed;
        amount -= absorbed;
        if (armour[outer] > 0) break;
        armour.pop();
        popped += 1;
      }
      return { damage: amount, popped };
    },

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
      if (dead || amount <= 0 || this.invulnerable || this.isReviveProtected) return;
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
      reviveProtection = Math.max(0, reviveProtection - dt);
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

    revive(seconds) {
      this.reset();
      reviveProtection = seconds;
    },

    // Back to full health and clear damage from the previous life.
    reset() {
      armour.length = 0;
      stats.health = stats.maxHealth;
      sinceHit = Infinity;
      regenerating = false;
      flash = 0;
      dead = false;
      killedBy = null;
      reviveProtection = 0;
    },
  };
}
