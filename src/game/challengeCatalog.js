// Every challenge the game offers, for the Challenges board and the tracker (DOM-free). One CATEGORY per kind of reward: today the weapon
// finishes (config/skins.js, counted by game/challenges.js). Another unlockable adds its own category here, with entries of the same shape:
//   { id, category, group, name, tag, text, done(ctx), progress(ctx), track(ctx) }
// where ctx = { save, challenges, guideSave }: the skins' permanent record, the run's live counters, and the Survival Guide's record (which
// holds lost property). `id` is what game/challengePins.js stores. An entry must cope with a ctx that lacks the record it reads.
import { skins, gunSkin, closingRewards, challengeText, locker as lockerWords } from '../config/skins.js';
import { weapons } from '../config/weapons.js';
import { challengeBoard as cfg } from '../config/challengeBoard.js';
import { lostFoundProgress } from './lostFound.js';
import { lostFound } from '../config/lostFound.js';

// A Closing Time reward belongs to every gun at once: one pin id, whichever gun's progress moved.
export const skinPinId = (gunId, skinId) => (gunSkin(gunId, skinId)?.shared ? `skin:closing/${skinId}` : `skin:${gunId}/${skinId}`);

// A feat's tracker line: its `track` words with {value} = the attempt in progress (0 before it starts), {gun} and its own fields.
const fill = (template, challenge, gunName, value) => template.replace(/\{(\w+)\}/g, (_, field) =>
  (field === 'value' ? String(value) : field === 'gun' ? gunName : String(challenge[field])));

function skinEntry(gunId, skin) {
  const gunName = weapons[gunId].name;
  const { challenge } = skin;
  const feat = skin.slot >= 3; // (a feat or a Closing Time reward: its progress is a best, or done / not yet)
  return {
    id: skinPinId(gunId, skin.id), category: 'skins', group: gunId, gunId, skinId: skin.id,
    name: skin.name, tag: cfg.slotTags[skin.slot], text: challengeText(challenge, gunName),
    done: ({ save }) => save.unlocked(gunId, skin.id),
    progress: ({ save }) => (feat ? lockerWords.featProgress : lockerWords.progress)(save.progress(gunId, skin.id), challenge.count),
    /** The tracker's line: the title, and how it stands now (a feat: the attempt in progress this run). */
    track({ save, challenges }) {
      const done = save.unlocked(gunId, skin.id);
      if (skin.shared) return { id: skinPinId(gunId, skin.id), title: cfg.tracker.sharedTitle(skin.name), value: done ? cfg.done : challenge.track, done };
      const value = done ? cfg.done : feat
        ? fill(challenge.track ?? '{value} / {count}', challenge, gunName, challenges?.attempt(gunId, skin.id)?.value ?? 0)
        : lockerWords.progress(save.progress(gunId, skin.id), challenge.count);
      return { id: skinPinId(gunId, skin.id), title: cfg.tracker.title(skin.name, gunName), value, done };
    },
  };
}

export const LOST_FOUND_PIN = 'collection:lostFound';
// Lost and Found: one entry for the whole collection (the items themselves are not listed: there are no hints).
function lostFoundEntry() {
  const words = cfg.lostFound;
  const standing = ({ guideSave } = {}) => (guideSave ? lostFoundProgress(guideSave) : { found: 0, total: lostFound.items.length, complete: false });
  return {
    id: LOST_FOUND_PIN, category: 'collections', group: 'lostFound',
    name: words.name, tag: words.tag, text: words.text(lostFound.items.length),
    done: (ctx) => standing(ctx).complete,
    progress: (ctx) => { const { found, total } = standing(ctx); return words.progress(found, total); },
    track(ctx) {
      const { found, total, complete } = standing(ctx);
      return { id: LOST_FOUND_PIN, title: words.trackerTitle, value: complete ? cfg.done : words.progress(found, total), done: complete };
    },
  };
}

let catalog = null;
/** [{ id, label, groups: [{ id, label, entries }] }], built once. */
export function challengeCatalog() {
  catalog ??= [{
    id: 'skins', label: cfg.categories.skins,
    groups: [...Object.entries(skins).map(([gunId, list]) => ({
      id: gunId, label: weapons[gunId].name, entries: list.filter(skin => skin.challenge && !skin.shared).map(skin => skinEntry(gunId, skin)),
    })), {
      // The rewards every gun shares, listed once: they unlock together, so one entry reads the first gun's record.
      id: 'closing', label: cfg.closingGroup,
      entries: closingRewards.map(reward => skinEntry(Object.keys(skins)[0], gunSkin(Object.keys(skins)[0], reward.id))),
    }],
  }, {
    id: 'collections', label: cfg.categories.collections,
    groups: [{ id: 'lostFound', label: cfg.lostFound.group, entries: [lostFoundEntry()] }],
  }];
  return catalog;
}

/** The entry with this id, or null (a pin the catalogue no longer knows). */
export function catalogEntry(id) {
  for (const category of challengeCatalog()) for (const group of category.groups) for (const entry of group.entries) if (entry.id === id) return entry;
  return null;
}
