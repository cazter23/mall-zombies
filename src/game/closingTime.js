import { closingTime as config } from '../config/closingTime.js';
import { createFloorPickups, pickupDirection } from './floorPickups.js';

const lines = Object.entries(config.lines);
const total = lines.length;
const leavingLine = lines.find(([, line]) => !line.needed)[0]; // line 4: no duty count, it is ticked by the win

// stats: the player's stats object (overtime's kill pay is multiplied into it). getOvertimeRound: () => how many overtime
// rounds have begun (0 before overtime; the first overtime round is 1), worked out by createGame from the round number
// and the saved `overtimeFrom`, so a loaded overtime run gets the right health with no counter of its own to save.
export function createClosingTime({ events, player, colliders, state, view, rounds, bosses, stats = null, getOvertimeRound = () => 0 }) {
  const floor = createFloorPickups(colliders);
  const drops = new Map(); // boss id -> floor position (null while waiting for safe floor)
  const held = new Set();
  const completed = new Set();
  const counts = new Map(); // opened duties that take more than a key
  let briefingIn = null; // seconds until the PA introduces the checklist (null: not waiting)
  let closingRound = null;
  let lastCustomerDefeated = false;
  let validated = false; // paid once per run; restored silently by Save & Quit
  let briefed = false; // once per run
  const progressDuties = {
    janitor: { open: config.pa.openFountain, complete: config.pa.completeFountain },
    guard: { open: config.pa.openNightSafe, complete: config.pa.completeNightSafe },
    manager: { open: config.pa.openLastOrders, complete: config.pa.completeLastOrders },
  };

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
    const { key, needed } = config.lines[bossId];
    drops.delete(bossId);
    view.remove(bossId);
    held.add(bossId);
    const progress = progressDuties[bossId];
    if (progress) counts.set(bossId, 0);
    // A key never ticks a line by itself: lines 1 to 3 have a duty, and line 4 (the Van Keys) is ticked by the win.
    events.emit('closingKey', { bossId, pa: progress ? progress.open(key, needed) : config.pa.vanKeys(key) });
    return true;
  }

  events.on('bossDefeated', ({ zombie }) => {
    if (!state.over && zombie.type.id === config.finale.bossId && validated) lastCustomerDefeated = true;
    drop(zombie.type.id, zombie.position);
  });
  events.on('closingValidated', ({ round }) => {
    if (state.over || !validated || closingRound !== null) return;
    closingRound = round + config.finale.roundOffset;
    bosses.book(closingRound, config.finale.bossId);
  });
  events.on('bossVanished', ({ zombie }) => drop(zombie.type.id, player.position));
  function advance(line) {
    if (state.over || !counts.has(line) || completed.has(line)) return;
    const { needed } = config.lines[line];
    const count = counts.get(line) + 1;
    counts.set(line, count);
    if (count === needed) completed.add(line);
    events.emit('closingProgress', { line, count, needed });
    if (count === needed) {
      events.emit('closingLine', { line, done: completed.size, total, pa: progressDuties[line].complete });
    }
  }

  // The PA introduces the checklist once per run, shortly after the run's opening line (round 1's announcement).
  events.on('roundStart', ({ round }) => {
    if (round === 1 && !briefed && briefingIn === null) briefingIn = config.briefing.delaySeconds;
  });

  events.on('fountainKill', () => advance('janitor'));
  events.on('ritualCollect', () => advance('manager'));
  events.on('purchase', ({ kind, id }) => {
    if (kind === 'closing' && id === 'nightSafe') advance('guard');
    if (kind === 'closing' && id === 'validation' && !state.over && !state.won && !validated && readyToValidate()) {
      validated = true;
      events.emit('closingValidated', { round: rounds.round, pa: config.pa.validated });
    }
  });

  const readyToValidate = () => held.size === total && lines.every(([id, line]) => !line.needed || completed.has(id));
  // Overtime pay: once, when overtime starts. Deliberately not on 'runLoaded' or in restore(): the stats object is saved as
  // it is (the x1.25 included), and Play again's stats reset puts the multiplier back to 1.
  events.on('overtimeStart', () => {
    if (stats) stats.killPayMultiplier *= config.overtime.killPay;
  });

  return {
    // The health multiplier for a zombie spawned now (the zombie manager reads it on every spawn): 1 before overtime.
    get healthMultiplier() {
      return Math.pow(config.overtime.healthPerRound, Math.max(0, getOvertimeRound()));
    },
    get done() { return completed.size; },
    hasKey(bossId) { return held.has(bossId); },
    isDone(bossId) { return completed.has(bossId); },
    get missingKeys() { return lines.filter(([id]) => !held.has(id)).map(([, { key }]) => key); },
    // Lines 1 to 3 that are not ticked yet (line 4 is leaving itself, so it is never "missing").
    get missingDuties() {
      return lines.filter(([id, line]) => line.needed && !completed.has(id)).map(([bossId, line]) => ({ bossId, ...line }));
    },
    // Parking validation needs every key and the first three duties; the van also needs the Last Customer defeated.
    get readyToValidate() { return readyToValidate(); },
    get validated() { return validated; },
    get closingRound() { return closingRound; },
    isClosingRound(round) { return round === closingRound; },
    get lastCustomerDefeated() { return lastCustomerDefeated; },
    get readyToLeave() { return readyToValidate() && validated && lastCustomerDefeated; },
    // The one thing to do next, as text for the HUD (config.objective; first match wins), or null once the shift is won.
    get nextStep() {
      const text = config.objective;
      if (state.won) return null;
      const onFloor = [...drops].find(([, position]) => position);
      if (onFloor) return text.collect(config.lines[onFloor[0]].key);
      for (const [bossId, line] of lines) {
        if (!line.needed || !held.has(bossId) || completed.has(bossId)) continue;
        const count = counts.has(bossId) ? ` ${config.lineProgress(counts.get(bossId), line.needed)}` : '';
        return text.duty[bossId] + count;
      }
      if (validated) return lastCustomerDefeated ? text.leave : text.lastCustomer; // (validating needs every key and duty)
      if (readyToValidate()) return text.validate;
      return held.size ? text.keys : text.waiting;
    },
    // A duty's count as text ("3/12") while its key is held and its line is still open, else null (the fountain switch's prompt).
    dutyProgress(bossId) {
      if (!counts.has(bossId) || completed.has(bossId)) return null;
      return config.lineProgress(counts.get(bossId), config.lines[bossId].needed);
    },
    // Line 4 ("Car park cleared") is the win itself: createGame's onRunWon ticks it here, once, so `done`, the
    // 'closingLine' event and the run summary are right without any help from the browser side.
    completeLeaving() {
      if (completed.has(leavingLine)) return false;
      completed.add(leavingLine);
      events.emit('closingLine', { line: leavingLine, done: completed.size, total });
      return true;
    },
    get checklist() {
      return lines.map(([bossId, line]) => ({
        bossId, ...line, done: completed.has(bossId),
        ...(counts.has(bossId) ? { count: counts.get(bossId) } : {}),
      }));
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
      if (briefingIn !== null && (briefingIn -= dt) <= 0) {
        briefingIn = null;
        briefed = true;
        events.emit('closingBriefing', { pa: config.pa.briefing });
      }
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
    // Save & Quit (game/saveGame.js): the checklist as it stood at the round's start, keys still on the floor included (a
    // key drops only once per run, so a save must never lose one). restore() puts them back without the PA lines.
    serialize() {
      return {
        drops: [...drops].map(([bossId, position]) => [bossId, position ? position.toArray() : null]),
        held: [...held], completed: [...completed], counts: [...counts], briefingIn, briefed, validated, closingRound, lastCustomerDefeated,
      };
    },
    restore(data) {
      this.reset();
      for (const [bossId, at] of data.drops) {
        if (!at) { drops.set(bossId, null); continue; } // (placed at the player's feet on a later tick)
        const position = player.position.clone().fromArray(at);
        drops.set(bossId, position);
        view.drop(bossId, position);
      }
      for (const id of data.held) held.add(id);
      for (const id of data.completed) completed.add(id);
      for (const [id, count] of data.counts) counts.set(id, count);
      briefingIn = data.briefingIn;
      briefed = data.briefed;
      validated = data.validated;
      closingRound = data.closingRound;
      lastCustomerDefeated = data.lastCustomerDefeated;
    },
    reset() {
      for (const bossId of drops.keys()) view.remove(bossId);
      drops.clear();
      held.clear();
      completed.clear();
      counts.clear();
      briefingIn = null;
      briefed = false;
      validated = false;
      closingRound = null;
      lastCustomerDefeated = false;
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
