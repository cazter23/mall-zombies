// =============================================================================
// RUN INTRO: when a run's first round begins, the mall PA chimes and makes a (useless) announcement, so every run
// opens with a beat instead of just "ROUND 1". It only LISTENS (the 'roundStart' event, game/events.js) and shows a
// banner + chime, so it changes nothing about the game. The lines are config (feel.runIntro).
//
//   wireRunIntro({ events, hud, sound, random }) -> unsubscribe()
// =============================================================================

import { feel } from '../config/feel.js';

export function wireRunIntro({ events, hud, sound, random = Math.random, config = feel.runIntro }) {
  return events.on('roundStart', ({ round }) => {
    if (round !== 1 || !config.lines.length) return;
    const text = config.lines[Math.floor(random() * config.lines.length) % config.lines.length];
    hud.showAnnouncement({ kicker: config.kicker, text });
    sound.play('paChime');
  });
}
