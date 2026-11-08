import { createWhiteboard } from './employeeModel.js';

export function createManagerBehavior({ zombie, scene, zombies, colliders, player, onPhase }) {
  const { meeting: cfg, report } = zombie.type;
  const board = createWhiteboard(scene, zombie.type.whiteboard);
  let threshold = 0, phase = 'chasing', left = 0, healthAtStart = 0, reportIn = report.interval;
  const visible = radius => zombies.zombies.filter(z => z !== zombie && z.isAlive && !z.type.boss
    && z.position.distanceTo(zombie.position) <= radius
    && !zombie.wallBetween({ position: z.position, height: z.type.height }, colliders));
  function release() {
    for (const z of zombies.zombies) if (z.hold?.source === zombie) z.hold = null;
    board.hide();
    zombie.damageTakenMultiplier = 1;
  }
  zombie.control = (dt, ctx) => {
    if (phase === 'chasing') return false;
    zombie.standStill(dt, ctx);
    zombie.faceToward(player.position, dt);
    return true;
  };
  function endMeeting(cancelled) {
    release();
    if (cancelled) { phase = 'stunned'; left = cfg.stunSeconds; onPhase('cancelled'); }
    else {
      phase = 'chasing'; zombie.controlled = false;
      for (const z of zombies.zombies) z.applyBuff(zombie, { seconds: cfg.buffSeconds, speed: cfg.speed, damage: cfg.damage });
      onPhase('failed');
    }
  }
  return {
    get phase() { return phase; },
    update(dt) {
      if (zombie.state === 'spawning') return;
      if (phase === 'meeting') {
        left -= dt;
        // Check damage first: an exact threshold on the last tick still cancels the meeting.
        if (healthAtStart - zombie.health + Number.EPSILON * zombie.maxHealth >= zombie.maxHealth * cfg.cancelFraction) endMeeting(true);
        else if (left <= 1e-9) endMeeting(false);
        return;
      }
      if (phase === 'stunned') {
        left -= dt;
        if (left <= 1e-9) { phase = 'chasing'; zombie.controlled = false; }
        return;
      }
      if (threshold < cfg.thresholds.length && zombie.health <= zombie.maxHealth * cfg.thresholds[threshold]) {
        threshold += 1; phase = 'meeting'; left = cfg.seconds; healthAtStart = zombie.health;
        zombie.setState('chasing'); zombie.velocity.x = zombie.velocity.z = 0;
        zombie.controlled = true;
        zombie.damageTakenMultiplier = cfg.damageTaken;
        for (const z of visible(cfg.radius)) z.applyHold(zombie, cfg.seconds);
        board.show(zombie.position); onPhase('meeting');
        return;
      }
      reportIn -= dt;
      if (reportIn <= 1e-9) {
        reportIn += report.interval;
        for (const z of visible(report.radius).sort((a,b) => a.position.distanceToSquared(zombie.position) - b.position.distanceToSquared(zombie.position)).slice(0, report.maxTargets)) {
          z.applyBuff(zombie, { seconds: report.seconds, speed: report.speed });
        }
        onPhase('report');
      }
    },
    dispose() { release(); zombie.control = null; zombie.controlled = false; board.dispose(); },
  };
}
