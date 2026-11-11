// A run wears the locker choices it started with. Continue restores those choices,
// even if the locker has since changed. Unlocks and preferences stay in skinSave.
import { skins, gunSkin } from '../config/skins.js';

export function createSkins({ save }) {
  let worn = {};
  const valid = (gunId, skinId) => gunSkin(gunId, skinId) && save.unlocked(gunId, skinId) ? skinId : 'default';
  function restore(choices = {}) {
    worn = Object.fromEntries(Object.keys(skins).map(id => [id, valid(id, choices?.[id])]));
  }
  function reset() { restore(save.snapshot().equipped); }
  reset();
  return {
    skinFor: gunId => worn[gunId] ?? 'default',
    serialize: () => ({ ...worn }),
    restore,
    reset,
  };
}
