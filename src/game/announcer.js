// =============================================================================
// THE MALL PA, AS DATA
// Which event makes which announcement (hud.showAnnouncement) and which sound plays with it. Each table entry is
// [event, line(payload) -> announcement or null (null = stay silent), sound?]; the sound is 'paChime' unless the
// entry names another (null = none, or a function of the payload).
//
// createAnnouncer({ events, hud, sound, state }) -> { runAndFeatures(), bossesAndIncentives(), sales(), welcomeBack() }
// Each method registers one table. createGame calls them at four separate points on purpose: listeners of the same
// event run in the order they were added, and the HUD queues announcements of equal priority in the order they come,
// so each table is registered exactly where its listeners always were (e.g. a boss's defeat banner before Closing
// Time's key-drop line). Moving a table to another point can reorder what the player hears.
// =============================================================================

import { economy } from '../config/economy.js';
import { bossTiming } from '../config/bosses.js';
import { mascotTypes, zombieTypes } from '../config/zombies.js';
import { save as saveConfig } from '../config/save.js';

/** A system's own PA line ({ pa } in the payload) at this priority; silent when the payload has none. */
const paLine = (priority) => ({ pa }) => (pa ? { ...pa, priority } : null);

/** The same, always shown (these events always carry a line). */
const paAlways = (priority) => ({ pa }) => ({ ...pa, priority });

// The systems whose PA lines need nothing but showing: Build-A-Blaster (game/features/workshopRitual.js), GRAB-A-GUN
// (game/features/clawMachine.js), limited editions, the wardrobe, skins, Kiosk Kevin, the Survival Guide, Lost and
// Found and THE RETURN's own step lines (in-world: both run modes).
const PLAIN_PA_EVENTS = ['ritualStart', 'ritualQuality', 'ritualReady', 'ritualWaiting', 'ritualCollect', 'limitedEditionDrop',
  'limitedEditionFitted', 'wardrobeBuy', 'clawClosed', 'clawMoved', 'skinUnlocked', 'kioskStock', 'guideEntry', 'lostFound', 'returnQuest'];

// Closing Time's lines: Directed mode only (Classic has no PA text; its own sounds play in both modes, see createGame).
const CLOSING_PA_EVENTS = ['closingBriefing', 'closingKeyDrop', 'closingKey', 'closingLine', 'closingValidated'];

/** Pick one string at random from `lines` (`random()` in [0, 1)). */
export function pickPaLine(lines, random = Math.random) {
  if (!lines?.length) return '';
  return lines[Math.floor(random() * lines.length) % lines.length];
}

/** Resolve a static `{ kicker, text }` or pooled `{ kicker, lines, priority? }` PA entry. */
function pickPa(pa, random) {
  if (!pa?.lines?.length) return pa;
  const out = { kicker: pa.kicker, text: pickPaLine(pa.lines, random) };
  if (pa.priority !== undefined) out.priority = pa.priority;
  return out;
}

export function createAnnouncer({ events, hud, sound, state, random = Math.random }) {
  function register(table) {
    for (const [name, line, chime = 'paChime'] of table) {
      events.on(name, (payload) => {
        const announcement = line(payload);
        if (!announcement) return;
        hud.showAnnouncement(announcement);
        const id = typeof chime === 'function' ? chime(payload) : chime;
        if (id) sound.play(id);
      });
    }
  }

  const directedOnly = ({ pa }) => (state.showClosingGuidance && pa ? { ...pa, priority: 1 } : null);

  return {
    // Rounds, zombie introductions and every system's own lines. Registered before the boss director and Closing Time.
    runAndFeatures() {
      register([
        ['waveEnding', () => pickPa(economy.rounds.lastShoppers.pa, random)],
        // A zombie type's first appearance this run (Mall Walkers, round 4). A Mascot announces the costume it came in
        // (Sir Waffles in round 10); each later costume's first appearance gets its own.
        ['typeIntro', ({ typeId, zombie }) => {
          const intro = (zombie?.type ?? zombieTypes[typeId])?.introBanner;
          return intro ? { ...intro, priority: 2 } : null;
        }],
        ['mascotVariantIntro', ({ variant }) => ({ ...mascotTypes[variant].introBanner, priority: 2 })],
        ...PLAIN_PA_EVENTS.map((name) => [name, paLine(1)]),
        ...CLOSING_PA_EVENTS.map((name) => [name, directedOnly]),
        // A return label issued by a ticked duty is announced like the duty itself: Directed only (Classic finds the
        // label slot by the desk).
        ['returnLabel', directedOnly],
        ['warrantyClaim', paAlways(1)], // a Platinum warranty claim (game/warranty.js)
        ['ritualStage', ({ pa }) => ({ ...pa, priority: 0, archiveOnly: true }), null], // (narration: quality and ready lines beat it)
      ]);
    },

    // A boss's phase lines, power-ups and employee incentives. Registered after Closing Time.
    bossesAndIncentives() {
      register([
        ['bossPhase', ({ zombie, phase }) => {
          const pa = zombie.type.phases?.[phase];
          return pa ? { ...pa, priority: bossTiming.introPriority } : null;
        }],
        ['powerUpCollect', paAlways(1), ({ sound: name }) => name],
        ['incentiveComplete', ({ text }) => ({ kicker: 'Employee incentive complete', text, priority: 1 }), 'incentiveRestock'],
      ]);
    },

    // Clock in and Flash Sales. Registered after the features and Flash Sales are built.
    sales() {
      register([
        ['clockIn', () => pickPa(economy.rounds.clockIn.pa, random)],
        ['flashSaleSoon', ({ pa }) => pa],
        ['flashSaleStart', ({ pa }) => pa],
        ['flashSaleEnd', ({ reason, pa }) => (reason === 'expired' || reason === 'sold' ? pa : null)], // a new run or cancelled teaser ends silently
      ]);
    },

    // The PA welcomes you back after a load. Registered after Save & Quit.
    welcomeBack() {
      register([
        ['runLoaded', ({ round }) => ({ ...saveConfig.loadedPa, text: saveConfig.loadedPa.text.replace('{round}', String(round)), priority: 2 })],
      ]);
    },
  };
}
