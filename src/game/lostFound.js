// Lost and Found: which pieces of lost property (config/lostFound.js) have been logged, for good.
// The record lives with the Survival Guide's (game/guideSave.js `found`): one binder, one localStorage key.
// A pickup is written at once (it is rare, and it must survive a closed tab). An assisted run logs nothing, and nothing
// is logged once the player is dead. Unlike a kill count there is nothing to replay: a found item stays found.
// 'lostFound' { itemId, found, total, complete, pa } announces each pickup.
//
// READERS (the guide's Lost and Found section, a challenges tab): `progress()` is the whole answer:
//   { found, total, complete, items: [{ id, name, area, found }] }
import { lostFound, lostItem } from '../config/lostFound.js';

/** The same answer straight from a record, for a screen that has the save but no game (the title's menus). */
export function lostFoundProgress(save) {
  const items = lostFound.items.map(({ id, name, area }) => ({ id, name, area, found: save.found(id) }));
  const found = items.filter((item) => item.found).length;
  return { found, total: items.length, complete: found === items.length, items };
}

export function createLostFound({ events, state, save }) {
  return {
    found: (id) => save.found(id),
    progress: () => lostFoundProgress(save),
    /** Why this run cannot log anything, as words for the prompt, or null. */
    get blocked() { return state.assisted ? lostFound.pickup.assisted : null; },
    /** Log an item. False when it is unknown, already logged, or this run does not count. */
    pickUp(id) {
      const item = lostItem(id);
      if (!item || state.assisted || state.over || !save.find(id)) return false;
      save.flush();
      const { found, total, complete } = lostFoundProgress(save);
      events.emit('lostFound', { itemId: id, found, total, complete, pa: lostFound.pa(item.name, found, total) });
      return true;
    },
    /** Developer shortcut: g.lostFound.debug('badge', 'find' | 'clear'), or ('all', 'find' | 'clear'). */
    debug(id, action = 'find') {
      const ids = id === 'all' ? lostFound.items.map((item) => item.id) : lostItem(id) ? [id] : [];
      if (!ids.length || !['find', 'clear'].includes(action)) return "Use g.lostFound.debug(itemId | 'all', 'find' | 'clear')";
      for (const each of ids) action === 'find' ? save.find(each) : save.lose(each);
      save.flush();
      const { found, total } = lostFoundProgress(save);
      events.emit('lostFound', { itemId: null, found, total, complete: found === total });
      return `Lost property: ${found} / ${total}`;
    },
  };
}
