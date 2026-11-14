// =============================================================================
// AUDITION: PUNCH VERSIONS (dev only, tools/audition.html)
// Three takes on the punch of the Confetti Cannon, Rivet Rifle and Stargazer, to pick from by ear. B is what the game plays
// (config/gunSounds.js); A and C live only here. Each keeps B's crack, mechanism and tail and changes the body (the kick
// and slap: see gunSounds.js kick / slap) and the duck. Their volumes are levelled to B's loudness, so only the punch differs.
//   A = tighter and drier: a higher, shorter kick, less drive, a smaller dip
//   C = bigger and heavier: a lower, longer kick, more drive and roll, a deeper dip
// Delete this file once a version is picked (and copy that version's body into gunSounds.js if it is A or C).
// =============================================================================

import { gunSounds, soundKit } from '../src/config/gunSounds.js';

const { thump, air, at, kick, slap } = soundKit;
const take = (name, { volume, duck, drive, body }) => {
  const b = gunSounds[name];
  return { ...b, volume, drive: drive ?? b.drive, duck: duck === undefined ? b.duck : duck, parts: { ...b.parts, body } };
};

export const punchVersions = {
  confettiShotPunchA: take('confettiShot', { volume: 2.29, duck: { db: 4, seconds: 0.15 }, body: { drive: 0.55, layers: [
    kick(220, 78, 1.3, 0.12, 0.015), slap(350, 1, 0.018), air('lowpass', 2200, 1, 0.05, { freqEnd: 600 })] } }),
  confettiShotPunchC: take('confettiShot', { volume: 1.36, duck: { db: 8, seconds: 0.25 }, drive: 0.5, body: { drive: 0.85, layers: [
    kick(190, 62, 1.5, 0.22, 0.025), slap(250, 1.2, 0.026), slap(600, 0.7, 0.014),
    air('lowpass', 2000, 1.1, 0.08, { freqEnd: 400 }), thump(52, 42, 0.6, 0.4, { attack: 0.01 })] } }),

  rivetShotPunchA: take('rivetShot', { volume: 3.45, body: { drive: 0.5, layers: [
    kick(260, 110, 1, 0.05, 0.008), slap(450, 0.9, 0.012), air('bandpass', 2200, 0.5, 0.03, { q: 0.7 })] } }),
  rivetShotPunchC: take('rivetShot', { volume: 2.59, body: { drive: 0.75, layers: [
    kick(220, 85, 1.2, 0.08, 0.012), slap(320, 1.1, 0.016), slap(900, 0.4, 0.01), air('bandpass', 2200, 0.5, 0.03, { q: 0.7 })] } }),

  stargazerShotPunchA: take('stargazerShot', { volume: 1.05, duck: { db: 5, seconds: 0.22 }, body: { drive: 0.6, layers: [
    kick(200, 62, 1.3, 0.2, 0.02), slap(300, 1, 0.02), air('lowpass', 2500, 1, 0.08, { freqEnd: 450 }),
    at(0.02, thump(52, 42, 0.5, 0.45, { attack: 0.02 }))] } }),
  stargazerShotPunchC: take('stargazerShot', { volume: 1.09, duck: { db: 9, seconds: 0.35 }, drive: 0.45, body: { drive: 0.85, layers: [
    kick(220, 55, 1.5, 0.28, 0.024), slap(240, 1.2, 0.026), slap(700, 0.6, 0.014),
    air('lowpass', 2400, 1.1, 0.1, { freqEnd: 350 }), at(0.02, thump(50, 40, 0.8, 0.7, { attack: 0.02 }))] } }),
};

/** gun id -> [name of A, name of B (the game's), name of C] */
export const punchSets = {
  confettiCannon: ['confettiShotPunchA', 'confettiShot', 'confettiShotPunchC'],
  rivetRifle: ['rivetShotPunchA', 'rivetShot', 'rivetShotPunchC'],
  stargazer: ['stargazerShotPunchA', 'stargazerShot', 'stargazerShotPunchC'],
};
