import { createWorkshopRitual } from './workshopRitual.js';
import { createBuildEffects } from './workshopStuffings.js';
import { createWorkshopSpectacle } from './workshopSpectacle.js';

// Build-A-Blaster (map feature kind 'workshop'): the ritual at the bench, the builds' stuffings in a fight, and the room's spectacle.
// (The Party Trap and Clearance Rack Limited Editions were removed on 15 November 2026: shopping bags carry Kevin's stock now, game/bagDrops.js.)
export function buildWorkshop(bench, { map, gun, pricing, interactions, events, player, scene, zombies, rounds, colliders, effects, sound, stats, state, input, wallet, skins }) {
  const ritual = createWorkshopRitual({ bench, map, gun, pricing, interactions, events, player, zombies, rounds, scene, state, input, wallet, sound, skins });
  const buildEffects = createBuildEffects({ events, gun, player, zombies, colliders, effects, stats, state, sound, scene });
  const spectacle = createWorkshopSpectacle({ bench, ritual, events, zombies, player, sound });

  return {
    ritual,
    update(dt) {
      ritual.update(dt);
      buildEffects.update(dt);
      spectacle.update(dt);
    },
    // Save & Quit (game/saveGame.js): only the order and the run's names (puddles on the floor are not kept).
    serialize() {
      return { ritual: ritual.serialize() };
    },
    restore(data) {
      ritual.restore(data.ritual);
    },
    reset() {
      ritual.reset();
      buildEffects.reset();
      spectacle.reset();
    },
  };
}
