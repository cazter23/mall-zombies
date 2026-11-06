// =============================================================================
// RUN STATS
// Counters for the current run, shown on the results screen when you die.
// (Not to be confused with the player's stats object in player/stats.js.)
// =============================================================================

export function createRunStats() {
  return {
    timeAlive: 0, // seconds of unpaused play
    kills: 0,
    headshotKills: 0,
    meleeKills: 0,
    bossesDefeated: 0,
    shotsFired: 0,
    shotsHit: 0, // shots that hit something shootable

    // 0..1
    get accuracy() {
      return this.shotsFired > 0 ? this.shotsHit / this.shotsFired : 0;
    },

    recordShot(shot) {
      this.shotsFired += 1;
      if (shot.target) this.shotsHit += 1;
    },

    recordKill(zombie) {
      this.kills += 1;
      if (zombie.killedByHeadshot) this.headshotKills += 1;
      if (zombie.killedByMelee) this.meleeKills += 1;
    },

    reset() {
      this.timeAlive = 0;
      this.kills = 0;
      this.headshotKills = 0;
      this.meleeKills = 0;
      this.bossesDefeated = 0;
      this.shotsFired = 0;
      this.shotsHit = 0;
    },
  };
}
