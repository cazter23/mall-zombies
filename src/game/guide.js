// The Survival Guide's counters: listens to the bus and fills in the permanent record (game/guideSave.js).
// A page is SEEN when its subject first appears (or dies), and counts every kill of it that pays: not a fan
// (noRewards), not in an assisted run, not after the player has died. Stages come from config/guide.js guideStage.
// 'guideEntry' { entryId, stage, pa? } announces a page appearing (stage 1) or gaining a paragraph (2, 3: with a PA line).
//
// Save & Quit replays the current round, so kills counted during it must not be counted again: `credited` is what this
// round has already been counted (it travels in the guide record's `replay`), `replayed` is this attempt's count, and
// only what an attempt earns beyond `credited` is new. (The same rule as game/challenges.js, kept apart on purpose:
// the two records are written separately and either may be cleared without the other.)
import { guideEntries, guideEntry, guideEntryId, guideStage, guideNotices, guideDebug } from '../config/guide.js';

export function createGuide({ events, state, save }) {
  const credited = new Map(); // page id -> kills this unfinished round has been counted, over every attempt at it
  const replayed = new Map(); // page id -> kills this attempt at the round has made so far
  function newlyEarned(id, amount) {
    const before = replayed.get(id) ?? 0, after = before + amount, paid = credited.get(id) ?? 0;
    replayed.set(id, after);
    if (after > paid) credited.set(id, after);
    return Math.max(0, after - Math.max(paid, before));
  }
  const clearRound = () => { credited.clear(); replayed.clear(); };
  const counting = () => !state.assisted && !state.over;
  const stageOf = (entry) => guideStage(entry, { seen: save.seen(entry.id), kills: save.kills(entry.id) });

  // Apply a change to one page and announce what it did to the page's stage.
  function change(entry, apply) {
    const before = stageOf(entry);
    apply();
    const stage = stageOf(entry);
    if (stage <= before) return stage;
    save.flush(); // a page appearing or gaining a paragraph is rare: worth a write at once
    events.emit('guideEntry', { entryId: entry.id, stage, ...(stage >= 2 ? { pa: guideNotices.pa(entry.name, stage) } : {}) });
    return stage;
  }
  function sight(zombie) {
    const entry = guideEntry(guideEntryId(zombie?.type));
    if (!entry || !counting() || zombie.noRewards) return;
    change(entry, () => save.see(entry.id));
  }

  // Sightings: a type's first spawn of the run, each Mascot costume's, a gold Mascot, a boss walking in.
  for (const name of ['typeIntro', 'mascotVariantIntro', 'mascotGold', 'bossSpawn']) events.on(name, ({ zombie }) => sight(zombie));
  events.on('kill', ({ zombie }) => {
    const entry = guideEntry(guideEntryId(zombie?.type));
    if (!entry || !counting() || zombie.noRewards) return;
    const amount = newlyEarned(entry.id, 1);
    change(entry, () => { save.see(entry.id); if (amount > 0) save.add(entry.id, amount); });
  });

  // Nothing new = no write.
  const flushIfDirty = () => (save.dirty ? save.flush() : false);
  events.on('runEnd', flushIfDirty);
  // Save & Quit keeps the counts and records what the round it will replay has already been counted.
  events.on('runSaved', () => { save.setReplay(Object.fromEntries(credited)); save.flush(); });
  events.on('roundStart', clearRound); // (the save's snapshot moves here: nothing before it is replayed)
  events.on('runLoaded', () => { // (after the load's own reset and any 'roundStart' its restore announced)
    clearRound();
    for (const [id, amount] of Object.entries(save.replay)) credited.set(id, amount);
  });
  // Quit to title and Restart run end a run without a 'runEnd': write what it counted.
  events.on('runReset', flushIfDirty);

  return {
    /** Every page with where it stands: [{ entry, seen, kills, stage }], in book order. */
    pages() {
      return guideEntries.map((entry) => ({ entry, seen: save.seen(entry.id) || !!entry.alwaysSeen, kills: save.kills(entry.id), stage: stageOf(entry) }));
    },
    /** Write unsaved counts now (main.js: the page is closing). No-op when storage is already current. */
    flush: flushIfDirty,
    reset: clearRound,
    /** Developer shortcut: g.guide.debug('mallWalker', 'add', 25) | 'see' | 'complete' | 'clear'. Never a replay. */
    debug(id, action, amount = 1) {
      const entry = guideEntry(id);
      if (!entry) return guideDebug.unknown;
      if (action === 'clear') {
        save.clear(id);
        events.emit('guideEntry', { entryId: id, stage: stageOf(entry) });
        return guideDebug.cleared(entry.name);
      }
      if (!['add', 'see', 'complete'].includes(action)) return guideDebug.usage;
      if (action === 'add' && (!Number.isSafeInteger(amount) || amount <= 0)) return guideDebug.invalidAmount;
      const add = action === 'add' ? amount : action === 'complete' ? Math.max(0, entry.tipAt - save.kills(id)) : 0;
      const stage = change(entry, () => { save.see(id); if (add > 0) save.add(id, add); });
      save.flush();
      return guideDebug.changed(entry.name, save.kills(id), stage);
    },
  };
}
