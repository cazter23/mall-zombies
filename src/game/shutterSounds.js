import { shutters } from '../config/shutters.js';

// The sound of a door being bought, per kind of barrier (config/shutters.js opening.profiles; recipes in config/audio.js).
// It listens to game/doorOpenings.js, so it follows the real barrier, not wall-clock time: pausing stops the sequence,
// death/reset cancels it, debug open-all is not a purchase and never starts nine motors, and a load replays nothing.
//   bought barrier:    unlock + motor at once, a roll tick while it rises, the heavy end clunk when it is fully up
//   free connection:   only its end clunk, quieter (opening.lightVolume)
export function createShutterSounds({ events, sound }) {
  const { profiles, lightVolume } = shutters.opening;
  const pending = new Map(); // doorId -> { barrier, elapsed, profile }
  events.on('barrierOpening', ({ door, doorId, bought, profile: name }) => {
    if (!bought) return;
    const profile = profiles[name];
    if (profile.unlock) sound.play(profile.unlock);
    if (profile.motor) sound.play(profile.motor);
    if (profile.roll && door.barrier.state === 'opening') pending.set(doorId, { barrier: door.barrier, elapsed: 0, profile });
  });
  events.on('barrierOpened', ({ doorId, bought, profile: name }) => {
    pending.delete(doorId);
    const stop = profiles[name].stop;
    if (!stop) return;
    if (bought) sound.play(stop);
    else sound.play(stop, { volume: lightVolume });
  });
  const clear = () => pending.clear();
  events.on('runReset', clear);
  events.on('playerDeath', clear);
  return {
    update(dt) {
      for (const [id, p] of pending) {
        if (p.barrier.state !== 'opening') { pending.delete(id); continue; }
        p.elapsed += dt;
        if (p.elapsed >= p.profile.rollInterval) {
          p.elapsed %= p.profile.rollInterval;
          sound.play(p.profile.roll);
        }
      }
    },
  };
}
