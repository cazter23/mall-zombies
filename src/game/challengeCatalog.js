// Every challenge the game offers, for the Challenges board and the tracker (DOM-free). One CATEGORY per kind of reward: today the weapon
// finishes (config/skins.js, counted by game/challenges.js). Another unlockable adds its own category here, with entries of the same shape:
//   { id, category, group, name, tag, text, done(ctx), progress(ctx), track(ctx) }
// where ctx = { save, challenges }: the reward's permanent record and the run's live counters. `id` is what game/challengePins.js stores.
import { skins, challengeText, locker as lockerWords } from '../config/skins.js';
import { weapons } from '../config/weapons.js';
import { challengeBoard as cfg } from '../config/challengeBoard.js';

export const skinPinId = (gunId, skinId) => `skin:${gunId}/${skinId}`;

// A feat's tracker line: its `track` words with {value} = the attempt in progress (0 before it starts), {gun} and its own fields.
const fill = (template, challenge, gunName, value) => template.replace(/\{(\w+)\}/g, (_, field) =>
  (field === 'value' ? String(value) : field === 'gun' ? gunName : String(challenge[field])));

function skinEntry(gunId, skin) {
  const gunName = weapons[gunId].name;
  const { challenge } = skin;
  const feat = skin.slot === 3;
  return {
    id: skinPinId(gunId, skin.id), category: 'skins', group: gunId, gunId, skinId: skin.id,
    name: skin.name, tag: cfg.slotTags[skin.slot], text: challengeText(challenge, gunName),
    done: ({ save }) => save.unlocked(gunId, skin.id),
    progress: ({ save }) => (feat ? lockerWords.featProgress : lockerWords.progress)(save.progress(gunId, skin.id), challenge.count),
    /** The tracker's line: the title, and how it stands now (a feat: the attempt in progress this run). */
    track({ save, challenges }) {
      const done = save.unlocked(gunId, skin.id);
      const value = done ? cfg.done : feat
        ? fill(challenge.track ?? '{value} / {count}', challenge, gunName, challenges?.attempt(gunId, skin.id)?.value ?? 0)
        : lockerWords.progress(save.progress(gunId, skin.id), challenge.count);
      return { id: skinPinId(gunId, skin.id), title: cfg.tracker.title(skin.name, gunName), value, done };
    },
  };
}

let catalog = null;
/** [{ id, label, groups: [{ id, label, entries }] }], built once. */
export function challengeCatalog() {
  catalog ??= [{
    id: 'skins', label: cfg.categories.skins,
    groups: Object.entries(skins).map(([gunId, list]) => ({
      id: gunId, label: weapons[gunId].name, entries: list.filter(skin => skin.challenge).map(skin => skinEntry(gunId, skin)),
    })),
  }];
  return catalog;
}

/** The entry with this id, or null (a pin the catalogue no longer knows). */
export function catalogEntry(id) {
  for (const category of challengeCatalog()) for (const group of category.groups) for (const entry of group.entries) if (entry.id === id) return entry;
  return null;
}
