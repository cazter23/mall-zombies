// =============================================================================
// DOOR OPENINGS: buying a door is a moment. This system turns a door 'purchase' into announcements on the bus and
// gives the view its little kick; everything you see and hear listens (config/shutters.js `opening`):
//
//   'areaOpened'     { areaId, doorId, openedDoorIds, first, pa }   once per door purchase. first = the first time this
//                    area opened this run; pa = the PA's welcome for it (only when first; the HUD drops it if another
//                    PA line is up: `ifQuiet`)
//   'barrierOpening' { door, doorId, areaId, bought, profile }      each barrier that purchase set rolling. bought = the one
//                    you paid at; the others are free connections (you own both sides now) and get the light version
//   'barrierOpened'  { door, doorId, areaId, bought, profile, near } that barrier clunked fully open (near = within
//                    opening.nudge.range of you; a bought one near you also kicks the view a little here)
//
// It follows the REAL barrier, never wall-clock time: pausing holds the show, a guard slamming it shut mid-roll or a new
// run cancels it. A loaded save opens its doorways instantly and announces nothing (and counts its areas as welcomed).
// Debug open-all is not a purchase, so it is silent too. DOM-free: it runs headless.
// =============================================================================

import { shutters } from '../config/shutters.js';
import { pickPaLine, paRandom } from './announcer.js';

/** A barrier's opening profile name (config/shutters.js opening.profiles). */
export function openingProfile(door) {
  return door.barrier.finish?.profile ?? shutters.opening.otherBarrier;
}

export function createDoorOpenings({ events, doors, zones, player, random = paRandom }) {
  const cfg = shutters.opening;
  const welcomed = new Set(); // areas opened (or loaded) this run
  const pending = new Map(); // doorId -> the 'barrierOpening' payload, until it clunks home

  events.on('purchase', (purchase) => {
    if (purchase.kind !== 'door') return;
    const boughtDoor = doors.find((d) => d.id === purchase.id);
    const areaId = purchase.areaId ?? boughtDoor?.opensZones?.[0] ?? null;
    const openedDoorIds = purchase.openedDoorIds ?? [purchase.id];
    const first = areaId !== null && !welcomed.has(areaId);
    if (areaId !== null) welcomed.add(areaId);
    const lines = first ? cfg.welcome.lines[areaId] : null;
    const pa = lines?.length ? { kicker: cfg.welcome.kicker, text: pickPaLine(lines, random), ifQuiet: true } : null;
    events.emit('areaOpened', { areaId, doorId: purchase.id, openedDoorIds, first, pa });
    for (const doorId of openedDoorIds) {
      const door = doors.find((d) => d.id === doorId);
      if (!door || pending.has(doorId)) continue;
      const opening = { door, doorId, areaId, bought: doorId === purchase.id, profile: openingProfile(door) };
      pending.set(doorId, opening);
      events.emit('barrierOpening', opening);
    }
  });

  // A loaded shift: every area it owns has been welcomed already (its doorways opened instantly, with no show).
  events.on('runLoaded', () => {
    for (const [id, zone] of Object.entries(zones)) if (zone.open) welcomed.add(id);
  });
  events.on('playerDeath', () => pending.clear());

  return {
    /** Areas that have had their opening this run (read-only, for tests). */
    get welcomed() {
      return [...welcomed];
    },
    /** Barriers still mid-show (read-only, for tests). */
    get pendingIds() {
      return [...pending.keys()];
    },
    update() {
      for (const [doorId, opening] of pending) {
        const barrier = opening.door.barrier;
        // (a barrier with no roll, like the escalator's rope, is open the moment it is bought)
        if (barrier.isOpen ?? true) {
          pending.delete(doorId);
          const p = player.position, at = opening.door.position;
          const near = Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z) <= cfg.nudge.range;
          if (opening.bought && near) player.addRecoil(cfg.nudge.pitch, cfg.nudge.roll);
          events.emit('barrierOpened', { ...opening, near });
        } else if (barrier.state !== 'opening') {
          pending.delete(doorId); // slammed shut mid-roll (Officer Kettle) or reset: the show is off
        }
      }
    },
    reset() {
      pending.clear();
      welcomed.clear();
    },
  };
}
