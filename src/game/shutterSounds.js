import { shutters } from '../config/shutters.js';

// Purchase feedback follows the real barrier, not wall-clock time. Pausing stops
// the sequence, death/reset cancels it, and debug open-all never starts nine motors.
export function createShutterSounds({ events, doors, sound }) {
  const pending = new Map();
  events.on('purchase', ({ kind, id }) => {
    if (kind !== 'door') return;
    const door = doors.find(d => d.id === id);
    if (door?.barrier.mesh?.userData.kind !== 'shutter' || pending.has(id)) return;
    pending.set(id, { barrier: door.barrier, elapsed: 0 });
    sound.play('shutterMotor');
  });
  const clear = () => pending.clear();
  events.on('runReset', clear);
  events.on('playerDeath', clear);
  return {
    update(dt) {
      for (const [id, p] of pending) {
        if (p.barrier.isOpen) { sound.play('shutterStop'); pending.delete(id); continue; }
        if (p.barrier.state !== 'opening') { pending.delete(id); continue; }
        p.elapsed += dt;
        if (p.elapsed >= shutters.rollSoundInterval) {
          p.elapsed %= shutters.rollSoundInterval;
          sound.play('shutterRoll');
        }
      }
    },
  };
}
