// =============================================================================
// RUN INTRO: when a run's first round begins, the mall PA chimes and makes a (useless) announcement, so every run
// opens with a beat instead of just "ROUND 1". It only LISTENS (the 'roundStart' event, game/events.js) and shows a
// banner + chime, so it changes nothing about the game. The lines are config (feel.runIntro).
//
//   wireRunIntro({ events, hud, sound, random, arenaLine }) -> unsubscribe()
//     arenaLine  optional () => { kicker, text } | null: an arena run's own opener (config/arenas.js pa) instead of a random line
// =============================================================================

import { feel } from '../config/feel.js';

export function wireRunIntro({ events, hud, sound, random = Math.random, config = feel.runIntro, arenaLine = () => null }) {
  return events.on('roundStart', ({ round }) => {
    if (round !== 1) return;
    const own = arenaLine();
    if (!own && !config.lines.length) return;
    const text = own ? own.text : config.lines[Math.floor(random() * config.lines.length) % config.lines.length];
    hud.showAnnouncement({ kicker: own ? own.kicker : config.kicker, text, flavor: true });
    sound.play('paChime');
  });
}
