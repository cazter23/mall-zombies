// =============================================================================
// OUTFIT RAIL (g.outfitRail): the DOM-free half of the Wardrobe's HUD rail. It decides WHEN an item's tag pulses (its item just
// did its job) and what the rail shows; ui/outfitRail.js draws it. Nothing here changes gameplay.
//
// An item names its trigger in config/wardrobe.js (`pulse`); `triggers` below says what each name means. Only the item WORN in a
// slot can pulse, and only on its own trigger, so a tag swinging is a true "this just helped you".
//
//   pulseCount(id)   how many times that item's tag has pulsed this run (tests read this)
//   pulses           { id: count } for every item that has
//   snapshot()       the rail as data: [{ slot, slotLabel, id|null, name, shortName, color, icon, lines: [{ text, good }] }]
//                    (lines: what the worn item is doing, g.wardrobe.wornLines; the pause screen prints them)
//   update(dt)       once a tick: the triggers that are read from the player's state (sprint, slide, aim, ammo)
//   reset()          a new run
// It announces each pulse on the bus: 'outfitPulse' { id, slot } (the HUD swings the tag).
// =============================================================================
import { wardrobeItems, wardrobeSlots } from '../config/wardrobe.js';
import { feel } from '../config/feel.js';

/** Every trigger name an item's `pulse` may use, and when it fires. */
export const triggers = {
  regenStart: 'health began climbing back (Paper Hat: the shorter wait)',
  playerHit: 'a zombie hit landed (Sandwich Board, Hi-Vis Vest)',
  hitCushioned: 'a hit landed while you were above the base max health: the knit took it (Cardigan)',
  payingKill: 'a kill that paid (Gold Card)',
  meleeHit: 'the box cutter hit something (Foam Finger)',
  headshot: 'a gun hit the head (3D Glasses)',
  sprintStart: 'a sprint began (Light-Up Sneakers, Orthopedics)',
  slideStart: 'a slide began (Wheelies)',
  aimStart: 'aiming down sights began (Aviators)',
  ammoRefill: 'a refill took the reserve above the gun\'s base amount (Fanny Pack)',
};

export function createOutfitRail({ events, wardrobe, stats, player, gun, state }) {
  let counts = {};
  const edge = { sprint: false, slide: false, aim: false };
  let watched = null; // the gun in hand and its reserve last tick (a refill is the reserve going UP above its base)
  let reserve = 0;

  function pulse(id) {
    counts[id] = (counts[id] ?? 0) + 1;
    events.emit('outfitPulse', { id, slot: wardrobeItems[id].slot });
  }
  // Pulse whichever WORN item names this trigger.
  function fire(trigger) {
    if (state.over) return;
    for (const slot of Object.keys(wardrobeSlots)) {
      const id = wardrobe.wearing(slot);
      if (id && wardrobeItems[id].pulse === trigger) pulse(id);
    }
  }

  events.on('regenStart', () => fire('regenStart'));
  events.on('playerHit', ({ damage }) => {
    fire('playerHit');
    // (createGame's listener has already applied the hit: health before it = now + what it took. Back at FULL health means
    // this hit just spent Second Chance: that sum says nothing about the cushion.)
    if (stats.health < stats.maxHealth && stats.health + damage * stats.damageTakenMultiplier > feel.player.maxHealth) fire('hitCushioned');
  });
  events.on('kill', ({ zombie }) => { if (!zombie?.noRewards) fire('payingKill'); });
  events.on('hit', ({ headshot, melee }) => {
    if (melee) fire('meleeHit');
    else if (headshot) fire('headshot');
  });

  const rises = (key, now) => { const rose = now && !edge[key]; edge[key] = now; return rose; };

  return {
    pulseCount: (id) => counts[id] ?? 0,
    get pulses() { return { ...counts }; },

    snapshot() {
      return Object.entries(wardrobeSlots).map(([slot, slotLabel]) => {
        const id = wardrobe.wearing(slot);
        const item = id ? wardrobeItems[id] : null;
        return {
          slot, slotLabel, id,
          name: item?.name ?? null, shortName: item?.shortName ?? null, color: item?.color ?? null, icon: item?.icon ?? null,
          lines: id ? wardrobe.wornLines(id) : [],
        };
      });
    },

    update() {
      if (rises('sprint', player.isSprinting)) fire('sprintStart');
      if (rises('slide', player.stance === 'slide')) fire('slideStart');
      if (rises('aim', player.isAiming)) fire('aimStart');
      const weapon = gun.weapon;
      if (weapon !== watched) { watched = weapon; reserve = weapon.reserve; return; } // (a gun swap is not a refill)
      if (weapon.reserve > reserve && weapon.reserve > weapon.def.startingReserve) fire('ammoRefill');
      reserve = weapon.reserve;
    },

    // Save & Quit (game/saveGame.js): how often each worn item has pulsed this run.
    serialize() {
      return { counts: { ...counts } };
    },
    restore(data) {
      counts = { ...data.counts };
    },

    reset() {
      counts = {};
      edge.sprint = edge.slide = edge.aim = false;
      watched = null;
    },
  };
}
