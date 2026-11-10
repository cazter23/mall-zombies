import { closingTime as config } from '../config/closingTime.js';
import { createFloorPickups, pickupDirection } from './floorPickups.js';

const lines = Object.entries(config.lines);
const total = lines.length;

export function createClosingTime({ events, player, colliders, state, view }) {
  const floor = createFloorPickups(colliders);
  const drops = new Map(); // boss id -> floor position (null while waiting for safe floor)
  const held = new Set();

  function place(bossId, position) {
    drops.set(bossId, position);
    view.drop(bossId, position);
    events.emit('closingKeyDrop', { bossId, position: position.clone(), pa: config.pa.drop(config.lines[bossId].key) });
  }

  function available(bossId) {
    return Object.hasOwn(config.lines, bossId) && !held.has(bossId) && !drops.has(bossId);
  }

  function drop(bossId, at) {
    if (state.over || !available(bossId)) return false;
    const position = floor.findPosition(at) ?? (at === player.position ? null : floor.findPosition(player.position));
    if (position) place(bossId, position);
    else drops.set(bossId, null); // e.g. the player is mid-air; retry at their feet on a later tick
    return true;
  }

  function collect(bossId) {
    if (state.over || held.has(bossId)) return false;
    const { key, duty } = config.lines[bossId];
    drops.delete(bossId);
    view.remove(bossId);
    held.add(bossId);
    const pa = config.pa.collect(key, duty);
    const done = held.size; // Until its duty exists, holding the key completes the line.
    events.emit('closingKey', { bossId, pa });
    events.emit('closingLine', { line: bossId, done, total, pa });
    return true;
  }

  events.on('bossDefeated', ({ zombie }) => drop(zombie.type.id, zombie.position));
  events.on('bossVanished', ({ zombie }) => drop(zombie.type.id, player.position));

  return {
    get done() { return held.size; },
    get checklist() {
      return lines.map(([bossId, line]) => ({ bossId, ...line, done: held.has(bossId) }));
    },
    get pickups() {
      return [...drops].filter(([, position]) => position).map(([bossId, position]) => ({ bossId, position: position.clone() }));
    },
    get markers() {
      const markers = {};
      for (const [bossId, position] of drops) {
        if (position) markers[bossId] = { name: config.lines[bossId].key, ...pickupDirection(player, position, config.marker) };
      }
      return markers;
    },
    update(dt) {
      if (state.over) return;
      for (const [bossId, position] of drops) {
        if (position) {
          if (floor.reached(player, position)) collect(bossId);
        } else {
          const fallback = floor.findPosition(player.position);
          if (fallback) place(bossId, fallback);
        }
      }
      view.update(dt);
    },
    reset() {
      for (const bossId of drops.keys()) view.remove(bossId);
      drops.clear();
      held.clear();
    },
    debug(mode = 'drop', bossId, at = player.position) {
      if (state.over) return 'The shift has ended';
      if (mode !== 'drop' && mode !== 'grant') return 'Use closing, drop or grant, and an optional boss id';
      bossId ??= lines.find(([id]) => mode === 'drop' ? available(id) : !held.has(id))?.[0];
      if (!bossId) return 'No closing keys left to ' + mode;
      if (!Object.hasOwn(config.lines, bossId)) return 'Unknown closing boss: ' + bossId;
      const changed = mode === 'grant' ? collect(bossId) : drop(bossId, at);
      return (changed ? (mode === 'grant' ? 'Granted ' : 'Dropped ') : 'Already issued: ') + config.lines[bossId].key;
    },
  };
}
