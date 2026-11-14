// =============================================================================
// AUDIO CONFIG
// Volumes, the master chain, the rooms, and sound recipes. Every sound is synthesized in code (no audio files), the
// same way textures are drawn on a canvas. Guns, the box cutter, the Kiosk Sentry and the hit sounds live in
// config/gunSounds.js (merged in below); everything else is here. audio/recipes.js reads and checks recipes;
// audio/sound.js plays them. tools/audition.html (npm run dev) plays and measures them.
//
// A RECIPE:
//   { volume, layers: [...] }                       the simple form: one list of layers
//   { volume, parts: { crack: [...], body: [...], mech: [...], ... } }
//                                                   named groups of layers (a part can also be { gain, drive, layers }),
//                                                   so upgrades can scale or add a part by name (gunSounds.js soundUpgrades)
//   optional:  maxVoices    copies of this sound at once (default voices.perSound); the oldest is stolen. Automatic guns: 3-4
//              send         0..1 into the room reverb (0 = dry: hit sounds, UI)
//              drive        saturation of the whole sound, 0 clean .. 1 crushed (the "crunch" that makes small shots loud)
//              vary         { pitch, gain, decay, freq, delay }: fractions each LAYER is randomly moved by on every play,
//                           on top of the global pitchVariation (a layer's own `vary` replaces it)
//              pitchVariation  replaces the global wobble for this sound (0: a beep that must stay on its note)
//              flavourGain  how loud a Build-A-Blaster stuffing's flavour is on this gun (lower on automatic guns)
//              sidePan      how far left/right a play with `side: 'left' | 'right'` goes (BOGO's two guns)
//              pitchStep    pitch rise per `step` a play is given (the Tennis Ball's bounces up a chain)
//              upgrades     this recipe's own entries replacing soundUpgrades' (same shape)
//
// A LAYER (times in seconds, freq/freqEnd in Hz, gain 0..1+; every layer has gain, attack, decay, delay, and may have
// `drive` and `vary` of its own):
//   noise: { type: 'noise', filter: 'bandpass' | 'lowpass' | 'highpass', freq, freqEnd?, q }   filtered noise; freqEnd
//          sweeps the filter (a hiss closing, a whoosh opening)
//   tone:  { type: 'tone', wave: 'sine' | 'square' | 'triangle' | 'sawtooth', freq, freqEnd? }  a tone, swept to freqEnd
//   click: { type: 'click', shape: 'noise' | 'impulse', ms, filter?, freq?, q? }   a few ms transient: noise = a crack,
//          impulse = a tick or a ratchet tooth (through a narrow bandpass, a little ping). No envelope: its length is ms.
//   metal: { type: 'metal', freq, ratios: [1, 2.76, ...], partialDecay?, detune?, gains?, wave?, freqEnd? }
//          inharmonic partials (a spring, a struck rivet, a bell); each higher partial dies faster (x partialDecay)
//   fm:    { type: 'fm', freq, ratio, index, indexEnd?, wave?, modWave?, freqEnd? }   a modulator at freq x ratio
//          wobbling the tone by `index`: a falling index = a twang or a boing; a high one = a rattle or a buzz
// Each layer rises to gain over `attack`, then fades exponentially over `decay`, starting `delay` after the play.
//
// Weapons refer to sounds by name (config/weapons.js -> sounds, reload events); so do zombie types
// (config/zombies.js -> sounds) and the PA chime.
// =============================================================================

import { gunSounds } from './gunSounds.js';

export const audio = {
  masterVolume: 0.55,
  ambienceVolume: 0.65,
  musicVolume: 0.45,
  pitchVariation: 0.05, // each play is randomly up to this fraction higher/lower, so repeats don't sound robotic
  // Fast peak control leaves the body of each shot intact while catching the initial transient at full volume.
  // (attack 6 ms: the first milliseconds of a shot, its punch, get through; the limiter and soft clip catch the peak)
  compressor: { thresholdDb: -12, ratio: 4, attack: 0.006, release: 0.12, kneeDb: 6 },
  // After the compressor: a fast limiter, then a soft clip (unity below `knee`, never past `ceiling`) so peaks stay under 0 dBFS.
  limiter: { thresholdDb: -3, ratio: 20, attack: 0.001, release: 0.1, kneeDb: 0 },
  softClip: { knee: 0.7, ceiling: 0.98 },
  // Voice limits: at most `perSound` copies of one sound (a recipe's maxVoices overrides it) and `total` overall; the oldest is stolen.
  voices: { perSound: 6, total: 40, stealFadeSeconds: 0.012 },
  // The shared room reverb (audio/sound.js, impulses from audio/roomImpulse.js). Room presets; `roomOf` maps a grade zone
  // (map.gradeZones; null = the hallway) to one. seconds = time to -60 dB, brightness = [startHz, endHz] of the darkening tail.
  reverb: { enabled: true, defaultRoom: 'hall', crossfadeSeconds: 0.6 }, // (enabled: Settings > Audio > Room echo)
  rooms: {
    hall: { seconds: 1.0, preDelay: 0.012, brightness: [6000, 1500], lowCut: 180, early: { count: 6, spread: 0.04, gain: 0.5 }, wet: 0.1 },
    court: { seconds: 1.3, preDelay: 0.018, brightness: [6500, 1600], lowCut: 160, early: { count: 6, spread: 0.06, gain: 0.45 }, wet: 0.12 },
    atrium: { seconds: 2.0, preDelay: 0.03, brightness: [8000, 2000], lowCut: 150, early: { count: 8, spread: 0.08, gain: 0.4 }, wet: 0.16 },
    cinema: { seconds: 1.6, preDelay: 0.025, brightness: [3500, 700], lowCut: 120, early: { count: 5, spread: 0.06, gain: 0.35 }, wet: 0.14 },
    corridor: { seconds: 0.45, preDelay: 0.004, brightness: [7000, 3000], lowCut: 250, early: { count: 10, spread: 0.015, gain: 0.6 }, ring: { freq: 1100, feedback: 0.45 }, wet: 0.12 },
    store: { seconds: 0.6, preDelay: 0.01, brightness: [3000, 900], lowCut: 200, early: { count: 4, spread: 0.03, gain: 0.3 }, wet: 0.07 },
    warehouse: { seconds: 1.2, preDelay: 0.02, brightness: [6000, 1800], lowCut: 160, early: { count: 7, spread: 0.05, gain: 0.45 }, wet: 0.1 },
    smallRoom: { seconds: 0.4, preDelay: 0.006, brightness: [5000, 2000], lowCut: 220, early: { count: 6, spread: 0.02, gain: 0.5 }, wet: 0.06 },
    parking: { seconds: 0.3, preDelay: 0.06, brightness: [5000, 3000], lowCut: 300, early: { count: 2, spread: 0.12, gain: 0.8 }, wet: 0.04 },
  },
  roomOf: {
    front: 'hall', level2: 'hall', startRoom: 'smallRoom', foodCourt: 'court', megaMart: 'warehouse', martBack: 'corridor',
    serviceCorridor: 'corridor', cinemaService: 'corridor', cinemaLobby: 'cinema', cinemaScreen: 'cinema', departmentStore: 'store',
    atrium: 'atrium', parkingLot: 'parking',
  },

  sounds: {
    // Sparse back-room sounds, spatially mixed and occluded by their closed storefronts.
    backroomPhone: { volume: .25, layers: [
      { type: 'tone', wave: 'triangle', freq: 980, freqEnd: 960, gain: .22, attack: .01, decay: .22 },
      { type: 'tone', wave: 'sine', freq: 1240, freqEnd: 1200, gain: .12, attack: .01, decay: .2, delay: .09 },
      { type: 'tone', wave: 'triangle', freq: 980, freqEnd: 960, gain: .22, attack: .01, decay: .22, delay: .5 },
    ] },
    distantSteps: { volume: .35, layers: [0, .64, 1.39].map(delay =>
      ({ type: 'noise', filter: 'lowpass', freq: 650, q: .8, gain: .45, attack: .008, decay: .14, delay })) },
    unseenCart: { volume: .25, layers: [
      { type: 'noise', filter: 'bandpass', freq: 570, q: 1.8, gain: .22, attack: .25, decay: 1.2 },
      { type: 'tone', wave: 'sine', freq: 730, freqEnd: 560, gain: .06, attack: .2, decay: .7, delay: .3 },
    ] },
    looseSignRattle: { volume: .18, layers: [
      { type: 'tone', wave: 'triangle', freq: 460, freqEnd: 330, gain: .22, attack: .002, decay: .18 },
      { type: 'noise', filter: 'bandpass', freq: 1800, q: 2, gain: .24, attack: .002, decay: .11, delay: .13 },
      { type: 'tone', wave: 'sine', freq: 620, freqEnd: 430, gain: .12, attack: .003, decay: .28, delay: .3 },
    ] },
    // Speech-shaped, low-passed PA chatter; deliberately indistinct through the exit.
    distantPa: { volume: .16, layers: [
      { type: 'tone', wave: 'sine', freq: 490, freqEnd: 410, gain: .18, attack: .03, decay: .22 },
      { type: 'tone', wave: 'sine', freq: 650, freqEnd: 500, gain: .13, attack: .03, decay: .28, delay: .18 },
      ...[.65, .9, 1.14, 1.54, 1.83, 2.14, 2.65, 2.88].map((delay, i) => ({
        type: 'noise', filter: 'bandpass', freq: 430 + i % 3 * 130, q: 2.5,
        gain: .13, attack: .035, decay: .16 + i % 2 * .08, delay,
      })),
    ] },
    distantTrafficPass: { volume: .14, layers: [
      { type: 'noise', filter: 'lowpass', freq: 500, gain: .3, attack: 1.5, decay: 3.5 },
      { type: 'tone', wave: 'sine', freq: 96, freqEnd: 66, gain: .12, attack: 1, decay: 3, delay: .4 },
    ] },
    // Three distinct employee incentives, all routed through the existing master-volume bus.
    // Closing Time, in both run modes (game/createGame.js): a checklist key picked up (a bright jingle of keys), and a
    // checklist line ticked (a short two-note confirmation). Classic has no PA text, so these are its feedback.
    closingKey: { volume: 0.5, layers: [
      { type: 'noise', filter: 'bandpass', freq: 5200, q: 3, gain: 0.22, attack: 0.001, decay: 0.05 },
      { type: 'tone', wave: 'triangle', freq: 1568, freqEnd: 1568, gain: 0.3, attack: 0.002, decay: 0.12 },
      { type: 'tone', wave: 'triangle', freq: 2093, freqEnd: 2093, gain: 0.26, attack: 0.002, decay: 0.2, delay: 0.07 },
    ] },
    closingDuty: { volume: 0.5, layers: [
      { type: 'tone', wave: 'sine', freq: 784, freqEnd: 784, gain: 0.34, attack: 0.004, decay: 0.14 },
      { type: 'tone', wave: 'sine', freq: 1175, freqEnd: 1175, gain: 0.3, attack: 0.004, decay: 0.3, delay: 0.11 },
    ] },
    incentiveRestock: { volume: 0.55, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1200, q: 1, gain: 0.35, attack: 0.002, decay: 0.08 },
      { type: 'tone', wave: 'triangle', freq: 440, freqEnd: 440, gain: 0.3, attack: 0.005, decay: 0.13 },
      { type: 'tone', wave: 'triangle', freq: 660, freqEnd: 660, gain: 0.3, attack: 0.005, decay: 0.2, delay: 0.12 },
    ] },
    incentiveSpill: { volume: 0.5, layers: [
      { type: 'tone', wave: 'sine', freq: 660, freqEnd: 880, gain: 0.4, attack: 0.008, decay: 0.18 },
      { type: 'tone', wave: 'sine', freq: 880, freqEnd: 1320, gain: 0.3, attack: 0.008, decay: 0.3, delay: 0.14 },
    ] },
    incentiveSecurity: { volume: 0.6, layers: [
      { type: 'tone', wave: 'triangle', freq: 620, freqEnd: 380, gain: 0.4, attack: 0.01, decay: 0.23 },
      { type: 'tone', wave: 'triangle', freq: 620, freqEnd: 380, gain: 0.35, attack: 0.01, decay: 0.23, delay: 0.25 },
      { type: 'tone', wave: 'sine', freq: 100, freqEnd: 45, gain: 0.4, attack: 0.005, decay: 0.2 },
    ] },
    incentiveClearance: { volume: 0.72, layers: [
      { type: 'noise', filter: 'bandpass', freq: 650, q: 0.7, gain: 0.65, attack: 0.004, decay: 0.45 },
      { type: 'tone', wave: 'sine', freq: 140, freqEnd: 34, gain: 0.6, attack: 0.004, decay: 0.5 },
      { type: 'tone', wave: 'triangle', freq: 523.25, freqEnd: 523.25, gain: 0.35, attack: 0.01, decay: 0.22, delay: 0.08 },
      { type: 'tone', wave: 'triangle', freq: 783.99, freqEnd: 1046.5, gain: 0.35, attack: 0.01, decay: 0.35, delay: 0.16 },
    ] },
    incentiveCommission: { volume: 0.6, layers: [
      { type: 'tone', wave: 'triangle', freq: 587.33, freqEnd: 587.33, gain: 0.32, attack: 0.005, decay: 0.14 },
      { type: 'tone', wave: 'triangle', freq: 880, freqEnd: 880, gain: 0.34, attack: 0.005, decay: 0.16, delay: 0.09 },
      { type: 'tone', wave: 'sine', freq: 1174.66, freqEnd: 1174.66, gain: 0.36, attack: 0.005, decay: 0.32, delay: 0.18 },
      { type: 'tone', wave: 'sine', freq: 1760, freqEnd: 1760, gain: 0.22, attack: 0.005, decay: 0.36, delay: 0.22 },
    ] },
    incentiveBlackFriday: { volume: 0.65, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 220, freqEnd: 110, gain: 0.28, attack: 0.006, decay: 0.38 },
      { type: 'tone', wave: 'sawtooth', freq: 329.63, freqEnd: 329.63, gain: 0.24, attack: 0.006, decay: 0.35, delay: 0.04 },
      { type: 'tone', wave: 'square', freq: 659.25, freqEnd: 880, gain: 0.22, attack: 0.006, decay: 0.35, delay: 0.1 },
    ] },
    // Soft retail desk ding when Employee of the Hour approaches its next drop.
    incentiveMeterReady: { volume: 0.22, layers: [
      { type: 'tone', wave: 'sine', freq: 1174.66, gain: 0.45, attack: 0.004, decay: 0.22 },
      { type: 'tone', wave: 'sine', freq: 1760, gain: 0.28, attack: 0.004, decay: 0.28, delay: 0.06 },
    ] },
    // The Return to Sender quest: a NO REFUNDS floor sign shot over (game/features/refundSign.js).
    refundSignDown: { volume: 0.5, layers: [
      { type: 'noise', filter: 'bandpass', freq: 900, q: 1.5, gain: 0.6, attack: 0.002, decay: 0.09 },
      { type: 'tone', wave: 'triangle', freq: 220, freqEnd: 120, gain: 0.4, attack: 0.002, decay: 0.16, delay: 0.22 },
      { type: 'noise', filter: 'lowpass', freq: 500, q: 0.8, gain: 0.5, attack: 0.002, decay: 0.12, delay: 0.24 },
    ] },
    // Lost and Found (game/features/lostProperty.js): a quiet cue from an item you are near, by what it is, and the pickup.
    lostGlint: { volume: 0.22, layers: [
      { type: 'tone', wave: 'sine', freq: 2093, gain: 0.5, attack: 0.004, decay: 0.28 },
      { type: 'tone', wave: 'sine', freq: 3136, gain: 0.3, attack: 0.004, decay: 0.2, delay: 0.09 },
    ] },
    lostBeep: { volume: 0.2, layers: [
      { type: 'tone', wave: 'square', freq: 1480, gain: 0.35, attack: 0.002, decay: 0.07 },
      { type: 'tone', wave: 'square', freq: 1480, gain: 0.35, attack: 0.002, decay: 0.07, delay: 0.16 },
    ] },
    lostCreak: { volume: 0.24, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 310, freqEnd: 420, gain: 0.22, attack: 0.05, decay: 0.3 },
      { type: 'noise', filter: 'bandpass', freq: 1800, q: 6, gain: 0.2, attack: 0.04, decay: 0.22 },
    ] },
    lostFlutter: { volume: 0.24, layers: [
      { type: 'noise', filter: 'highpass', freq: 3000, q: 0.7, gain: 0.4, attack: 0.02, decay: 0.09 },
      { type: 'noise', filter: 'highpass', freq: 3400, q: 0.7, gain: 0.3, attack: 0.02, decay: 0.08, delay: 0.14 },
    ] },
    lostPickup: { volume: 0.4, layers: [
      { type: 'tone', wave: 'triangle', freq: 784, gain: 0.5, attack: 0.004, decay: 0.2 },
      { type: 'tone', wave: 'triangle', freq: 1175, gain: 0.5, attack: 0.004, decay: 0.2, delay: 0.1 },
      { type: 'tone', wave: 'triangle', freq: 1568, gain: 0.5, attack: 0.004, decay: 0.34, delay: 0.2 },
    ] },
    // The Staff Survival Guide (ui/guide.js): a sheet of paper flicked over on the binder's rings.
    pageTurn: { volume: 0.3, layers: [
      { type: 'noise', filter: 'highpass', freq: 2600, q: 0.7, gain: 0.5, attack: 0.03, decay: 0.12 },
      { type: 'noise', filter: 'bandpass', freq: 900, q: 1.2, gain: 0.35, attack: 0.005, decay: 0.07, delay: 0.1 },
    ] },
    shutterRattle: { volume: 0.12, layers: [
      { type: 'noise', filter: 'bandpass', freq: 650, q: 2, gain: 0.3, attack: 0.04, decay: 0.45 },
      { type: 'tone', wave: 'triangle', freq: 170, freqEnd: 95, gain: 0.12, attack: 0.03, decay: 0.35, delay: 0.12 },
    ] },
    // BUYING A DOOR (config/shutters.js opening.profiles picks one of each per kind of barrier): an unlock as the
    // purchase lands, the motor catching, a roll tick while it rises, and the heavy end clunk when it is fully up.
    // Store roll-down grille: a key turn and a latch.
    shutterLatch: { volume: 0.34, layers: [
      { type: 'noise', filter: 'highpass', freq: 3000, q: 0.7, gain: 0.4, attack: 0.001, decay: 0.03 },
      { type: 'tone', wave: 'square', freq: 1400, freqEnd: 900, gain: 0.07, attack: 0.001, decay: 0.04, delay: 0.03 },
      { type: 'noise', filter: 'bandpass', freq: 700, q: 3, gain: 0.32, attack: 0.002, decay: 0.08, delay: 0.07 },
      { type: 'tone', wave: 'triangle', freq: 180, freqEnd: 120, gain: 0.22, attack: 0.002, decay: 0.1, delay: 0.07 },
    ] },
    // The start room's flimsy clearance shutter: a padlock click and the whole curtain rattling in its tracks.
    shutterLatchTin: { volume: 0.34, layers: [
      { type: 'noise', filter: 'highpass', freq: 3500, q: 0.7, gain: 0.35, attack: 0.001, decay: 0.025 },
      { type: 'noise', filter: 'bandpass', freq: 1600, q: 4, gain: 0.35, attack: 0.003, decay: 0.05, delay: 0.05 },
      { type: 'noise', filter: 'bandpass', freq: 900, q: 2, gain: 0.28, attack: 0.02, decay: 0.28, delay: 0.08 },
      { type: 'tone', wave: 'triangle', freq: 420, freqEnd: 300, gain: 0.1, attack: 0.002, decay: 0.08, delay: 0.06 },
    ] },
    // A steel service door: a heavy deadbolt thrown back.
    shutterBolt: { volume: 0.4, layers: [
      { type: 'noise', filter: 'lowpass', freq: 2200, gain: 0.5, attack: 0.001, decay: 0.05 },
      { type: 'tone', wave: 'sine', freq: 140, freqEnd: 70, gain: 0.5, attack: 0.001, decay: 0.12 },
      { type: 'noise', filter: 'bandpass', freq: 1100, q: 5, gain: 0.3, attack: 0.001, decay: 0.06, delay: 0.09 },
      { type: 'tone', wave: 'square', freq: 520, freqEnd: 380, gain: 0.06, attack: 0.001, decay: 0.05, delay: 0.09 },
    ] },
    // A brass-trimmed storefront (the Atrium, HOFFMAN'S, the Cinema): the shop bell over the door, and a soft latch.
    shutterChime: { volume: 0.3, layers: [
      { type: 'noise', filter: 'highpass', freq: 2500, q: 0.7, gain: 0.2, attack: 0.001, decay: 0.03 },
      { type: 'tone', wave: 'sine', freq: 1568, gain: 0.3, attack: 0.003, decay: 0.45, delay: 0.02 },
      { type: 'tone', wave: 'sine', freq: 2350, gain: 0.12, attack: 0.003, decay: 0.3, delay: 0.02 },
      { type: 'tone', wave: 'triangle', freq: 200, freqEnd: 140, gain: 0.12, attack: 0.002, decay: 0.08, delay: 0.05 },
    ] },
    shutterMotor: { volume: 0.32, layers: [
      { type: 'tone', wave: 'triangle', freq: 105, freqEnd: 145, gain: 0.28, attack: 0.018, decay: 0.15 },
      { type: 'noise', filter: 'lowpass', freq: 850, gain: 0.16, attack: 0.006, decay: 0.09 },
    ] },
    shutterMotorLight: { volume: 0.28, layers: [
      { type: 'tone', wave: 'triangle', freq: 160, freqEnd: 230, gain: 0.22, attack: 0.015, decay: 0.12 },
      { type: 'noise', filter: 'lowpass', freq: 1400, gain: 0.16, attack: 0.006, decay: 0.08 },
    ] },
    shutterMotorHeavy: { volume: 0.36, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 62, freqEnd: 90, gain: 0.18, attack: 0.03, decay: 0.35 },
      { type: 'noise', filter: 'lowpass', freq: 500, gain: 0.25, attack: 0.02, decay: 0.3 },
      { type: 'tone', wave: 'triangle', freq: 120, freqEnd: 150, gain: 0.15, attack: 0.02, decay: 0.25 },
    ] },
    shutterRoll: { volume: 0.2, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1100, q: 1.2, gain: 0.3, attack: 0.004, decay: 0.075 },
      { type: 'tone', wave: 'triangle', freq: 205, freqEnd: 170, gain: 0.1, attack: 0.003, decay: 0.06 },
    ] },
    shutterRollTin: { volume: 0.2, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1900, q: 2, gain: 0.32, attack: 0.003, decay: 0.05 },
      { type: 'tone', wave: 'triangle', freq: 330, freqEnd: 280, gain: 0.08, attack: 0.002, decay: 0.04 },
    ] },
    shutterRollHeavy: { volume: 0.24, layers: [
      { type: 'noise', filter: 'bandpass', freq: 600, q: 1, gain: 0.35, attack: 0.005, decay: 0.1 },
      { type: 'tone', wave: 'triangle', freq: 120, freqEnd: 100, gain: 0.14, attack: 0.004, decay: 0.09 },
    ] },
    shutterRollSmooth: { volume: 0.16, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1400, q: 0.9, gain: 0.2, attack: 0.005, decay: 0.07 },
      { type: 'tone', wave: 'sine', freq: 240, freqEnd: 220, gain: 0.06, attack: 0.004, decay: 0.06 },
    ] },
    // The heavy end clunks: a low thump into the housing, the slam's crack, and a short metal ring.
    shutterStop: { volume: 0.4, layers: [
      { type: 'tone', wave: 'sine', freq: 95, freqEnd: 40, gain: 0.55, attack: 0.002, decay: 0.18 },
      { type: 'noise', filter: 'lowpass', freq: 1200, gain: 0.4, attack: 0.001, decay: 0.07 },
      { type: 'tone', wave: 'triangle', freq: 360, freqEnd: 190, gain: 0.12, attack: 0.002, decay: 0.09 },
      { type: 'noise', filter: 'bandpass', freq: 2400, q: 6, gain: 0.08, attack: 0.002, decay: 0.25, delay: 0.02 },
    ] },
    shutterStopTin: { volume: 0.36, layers: [
      { type: 'tone', wave: 'sine', freq: 130, freqEnd: 60, gain: 0.4, attack: 0.002, decay: 0.12 },
      { type: 'noise', filter: 'bandpass', freq: 1800, q: 3, gain: 0.3, attack: 0.002, decay: 0.2 },
      { type: 'tone', wave: 'triangle', freq: 620, freqEnd: 540, gain: 0.08, attack: 0.002, decay: 0.2, delay: 0.02 },
    ] },
    shutterStopHeavy: { volume: 0.46, layers: [
      { type: 'tone', wave: 'sine', freq: 70, freqEnd: 32, gain: 0.7, attack: 0.002, decay: 0.28 },
      { type: 'noise', filter: 'lowpass', freq: 700, gain: 0.5, attack: 0.001, decay: 0.12 },
      { type: 'tone', wave: 'triangle', freq: 220, freqEnd: 110, gain: 0.2, attack: 0.002, decay: 0.15 },
      { type: 'noise', filter: 'bandpass', freq: 900, q: 2, gain: 0.2, attack: 0.02, decay: 0.3, delay: 0.06 },
    ] },
    shutterStopBrass: { volume: 0.4, layers: [
      { type: 'tone', wave: 'sine', freq: 90, freqEnd: 42, gain: 0.55, attack: 0.002, decay: 0.2 },
      { type: 'noise', filter: 'lowpass', freq: 1500, gain: 0.3, attack: 0.001, decay: 0.06 },
      { type: 'tone', wave: 'sine', freq: 880, gain: 0.1, attack: 0.002, decay: 0.6, delay: 0.01 },
      { type: 'tone', wave: 'sine', freq: 1320, gain: 0.05, attack: 0.002, decay: 0.45, delay: 0.01 },
    ] },
    // The escalator repaired: the motor spins up, then the steps engage with a clunk.
    escalatorStartup: { volume: 0.4, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 40, freqEnd: 110, gain: 0.16, attack: 0.3, decay: 0.5 },
      { type: 'noise', filter: 'lowpass', freq: 400, gain: 0.25, attack: 0.2, decay: 0.5 },
      { type: 'tone', wave: 'sine', freq: 90, freqEnd: 40, gain: 0.5, attack: 0.001, decay: 0.15, delay: 0.6 },
      { type: 'noise', filter: 'lowpass', freq: 1000, gain: 0.3, attack: 0.001, decay: 0.06, delay: 0.6 },
    ] },

    // Build-A-Blaster. The jingle is a music-box tune, repeated over the fighting while a ritual runs.
    ritualJingle: { volume: .34, layers: [
      ...[[784, 0], [988, .22], [1175, .44], [1568, .66], [1319, 1.1], [1175, 1.32], [988, 1.54], [1175, 1.76], [784, 2.2], [880, 2.42], [988, 2.64], [1175, 2.86], [1568, 3.3], [1760, 3.52], [1568, 3.74], [1175, 3.96]]
        .flatMap(([freq, delay]) => [
          { type: 'tone', wave: 'triangle', freq, gain: .5, attack: .004, decay: .32, delay },
          { type: 'tone', wave: 'sine', freq: freq * 2, gain: .12, attack: .004, decay: .16, delay },
        ]),
    ] },
    // GRAB-A-GUN (game/features/clawMachine.js): the pay jingle, a tick as the claw crosses into each lane (timing help), the
    // motor down and up, the grab, the prize's little fanfare, and Sunny's sad slide whistle.
    clawJingle: { volume: .32, layers: [
      ...[[523, 0], [659, .09], [784, .18], [1047, .27], [988, .4], [1047, .5], [1319, .62]]
        .flatMap(([freq, delay]) => [
          { type: 'tone', wave: 'triangle', freq, gain: .5, attack: .004, decay: .2, delay },
          { type: 'tone', wave: 'square', freq: freq / 2, gain: .06, attack: .004, decay: .12, delay },
        ]),
    ] },
    clawTick: { volume: .3, layers: [
      { type: 'tone', wave: 'square', freq: 1700, gain: .3, attack: .001, decay: .03 },
      { type: 'noise', filter: 'bandpass', freq: 3200, q: 2, gain: .2, attack: .001, decay: .02 },
    ] },
    clawMotorDown: { volume: .38, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 190, freqEnd: 120, gain: .22, attack: .02, decay: .42 },
      { type: 'noise', filter: 'bandpass', freq: 650, q: 1.2, gain: .18, attack: .02, decay: .38 },
    ] },
    clawGrab: { volume: .55, layers: [
      { type: 'noise', filter: 'bandpass', freq: 2400, q: 2, gain: .8, attack: .001, decay: .04 },
      { type: 'tone', wave: 'square', freq: 320, gain: .25, attack: .001, decay: .05 },
    ] },
    clawMotorUp: { volume: .38, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 120, freqEnd: 210, gain: .22, attack: .02, decay: .5 },
      { type: 'noise', filter: 'bandpass', freq: 650, q: 1.2, gain: .18, attack: .02, decay: .45 },
    ] },
    clawWin: { volume: .34, layers: [
      ...[[784, 0], [988, .08], [1175, .16], [1568, .27]].map(([freq, delay]) => ({ type: 'tone', wave: 'triangle', freq, gain: .55, attack: .004, decay: delay > .2 ? .5 : .14, delay })),
    ] },
    sunnyPop: { volume: .5, layers: [ // Sunny shot: a soft pomf and a squeak
      { type: 'noise', filter: 'lowpass', freq: 700, q: .8, gain: .8, attack: .002, decay: .14 },
      { type: 'tone', wave: 'sine', freq: 1500, freqEnd: 2600, gain: .3, attack: .005, decay: .12, delay: .03 },
    ] },
    clawPlush: { volume: .4, layers: [
      { type: 'tone', wave: 'sine', freq: 1250, freqEnd: 330, gain: .5, attack: .02, decay: .75 },
      { type: 'tone', wave: 'sine', freq: 190, freqEnd: 520, gain: .35, attack: .01, decay: .22, delay: .8 },
    ] },
    tankGulp: { volume: .5, layers: [
      { type: 'tone', wave: 'sine', freq: 180, freqEnd: 520, gain: .7, attack: .01, decay: .22 },
      { type: 'noise', filter: 'lowpass', freq: 800, q: .7, gain: .25, attack: .01, decay: .12 },
    ] },
    chuteThunk: { volume: .6, layers: [
      { type: 'noise', filter: 'lowpass', freq: 520, q: .9, gain: .9, attack: .002, decay: .16 },
      { type: 'tone', wave: 'sine', freq: 92, gain: .7, attack: .002, decay: .2 },
    ] },
    leverClunk: { volume: .7, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1400, q: 1.4, gain: .7, attack: .001, decay: .05 },
      { type: 'tone', wave: 'square', freq: 120, gain: .3, attack: .002, decay: .1 },
    ] },
    stuffingSmoothie: { volume: .5, layers: [
      { type: 'noise', filter: 'lowpass', freq: 900, q: 1.1, gain: .7, attack: .004, decay: .14 },
      { type: 'tone', wave: 'sine', freq: 340, freqEnd: 150, gain: .4, attack: .004, decay: .16 },
    ] },
    stuffingFryer: { volume: .48, layers: [
      { type: 'noise', filter: 'highpass', freq: 3200, q: .7, gain: .7, attack: .01, decay: .32 },
      { type: 'noise', filter: 'bandpass', freq: 1500, q: 1.1, gain: .3, attack: .004, decay: .1 },
    ] },
    stuffingButter: { volume: .5, layers: [
      { type: 'noise', filter: 'lowpass', freq: 620, q: 1.3, gain: .75, attack: .006, decay: .2 },
      { type: 'tone', wave: 'sine', freq: 210, freqEnd: 90, gain: .35, attack: .006, decay: .22 },
    ] },
    stuffingFreeze: { volume: .46, layers: [
      { type: 'noise', filter: 'highpass', freq: 4200, q: 1, gain: .6, attack: .002, decay: .14 },
      { type: 'tone', wave: 'triangle', freq: 2350, gain: .22, attack: .002, decay: .2 },
      { type: 'tone', wave: 'triangle', freq: 3130, gain: .12, attack: .002, decay: .14, delay: .05 },
    ] },
    stuffingGlitter: { volume: .42, layers: [
      { type: 'tone', wave: 'sine', freq: 2093, gain: .3, attack: .002, decay: .16 },
      { type: 'tone', wave: 'sine', freq: 2637, gain: .24, attack: .002, decay: .16, delay: .05 },
      { type: 'tone', wave: 'sine', freq: 3136, gain: .2, attack: .002, decay: .2, delay: .1 },
      { type: 'noise', filter: 'highpass', freq: 6000, q: .7, gain: .15, attack: .004, decay: .22 },
    ] },
    stuffingNeon: { volume: .46, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 120, gain: .4, attack: .002, decay: .16 },
      { type: 'tone', wave: 'square', freq: 1860, gain: .12, attack: .002, decay: .08 },
      { type: 'noise', filter: 'highpass', freq: 5200, q: .7, gain: .35, attack: .001, decay: .09 },
    ] },

    // Kiosk Kevin's Soda Bomb bursting (config/kiosk.js): a deep pop, a fizzing spray, a hiss that trails off.
    sodaBurst: { volume: .9, layers: [
      { type: 'tone', wave: 'sine', freq: 140, freqEnd: 40, gain: 1, attack: .001, decay: .22 },
      { type: 'noise', filter: 'lowpass', freq: 1100, q: .7, gain: .85, attack: .001, decay: .16 },
      { type: 'noise', filter: 'highpass', freq: 4200, q: .7, gain: .45, attack: .01, decay: .6 },
    ] },
    stadiumAirHorn: { volume: .72, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 415, freqEnd: 392, gain: .5, attack: .012, decay: .34 },
      { type: 'tone', wave: 'sawtooth', freq: 508, freqEnd: 480, gain: .35, attack: .016, decay: .33 },
    ] },
    // Kiosk Kevin shouting (fx/kioskSpectacle.js, 'kioskHawk'): a nasal "hey-HEY!" (two buzzy rising syllables through a
    // vowel-ish band), a squeaky yelp as he ducks, and the SPIN-O-MATIC coming apart (a sad descending whirr and a rattle).
    kevinShout: { volume: .42, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 210, freqEnd: 260, gain: .35, attack: .01, decay: .09 },
      { type: 'noise', filter: 'bandpass', freq: 1300, q: 3, gain: .25, attack: .01, decay: .08 },
      { type: 'tone', wave: 'sawtooth', freq: 270, freqEnd: 330, gain: .45, attack: .01, decay: .16, delay: .12 },
      { type: 'noise', filter: 'bandpass', freq: 1500, q: 3, gain: .3, attack: .01, decay: .14, delay: .12 },
    ] },
    kevinYelp: { volume: .4, layers: [
      { type: 'tone', wave: 'square', freq: 520, freqEnd: 880, gain: .3, attack: .005, decay: .14 },
      { type: 'noise', filter: 'bandpass', freq: 2200, q: 2.5, gain: .2, attack: .005, decay: .12 },
    ] },
    sentryBreak: { volume: .6, layers: [
      { type: 'tone', wave: 'square', freq: 640, freqEnd: 140, gain: .35, attack: .005, decay: .55 },
      { type: 'noise', filter: 'bandpass', freq: 1800, q: .9, gain: .5, attack: .002, decay: .18 },
      { type: 'noise', filter: 'lowpass', freq: 700, q: .7, gain: .4, attack: .002, decay: .12, delay: .2 },
    ] },
    bubbleWrapPop: { volume: .65, layers: [
      { type: 'noise', filter: 'bandpass', freq: 2400, q: 1.1, gain: .9, attack: .001, decay: .035 },
      { type: 'tone', wave: 'sine', freq: 260, freqEnd: 95, gain: .4, attack: .001, decay: .065 },
    ] },
    partySnap: { volume: .8, layers: [
      { type: 'noise', filter: 'bandpass', freq: 3300, q: .8, gain: .9, attack: .001, decay: .045 },
      { type: 'noise', filter: 'lowpass', freq: 920, q: .7, gain: .48, attack: .002, decay: .075 },
    ] },

    // Mall Walker: a sneaker squeak on the shiny mall floor (quiet; volume also drops with distance)...
    walkerSqueak: {
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 1700, freqEnd: 2600, gain: 0.5, attack: 0.006, decay: 0.07 },
        { type: 'tone', wave: 'triangle', freq: 3300, freqEnd: 4300, gain: 0.12, attack: 0.006, decay: 0.05 },
        { type: 'noise', filter: 'highpass', freq: 5000, q: 0.7, gain: 0.08, attack: 0.002, decay: 0.03 },
      ],
    },
    // ...a breathy "hff" every couple of steps...
    walkerHuff: {
      volume: 0.5,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 950, q: 0.8, gain: 0.55, attack: 0.025, decay: 0.16 },
        { type: 'noise', filter: 'lowpass', freq: 500, q: 0.7, gain: 0.3, attack: 0.025, decay: 0.12 },
      ],
    },
    // The Shoplifter (game/shoplifting.js): a cash drawer's "ka-ching" as it grabs your points...
    shopliftGrab: { volume: 0.75, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1800, q: 2, gain: 0.35, attack: 0.001, decay: 0.05 },
      { type: 'tone', wave: 'triangle', freq: 2637, freqEnd: 2637, gain: 0.3, attack: 0.002, decay: 0.35, delay: 0.06 },
      { type: 'tone', wave: 'sine', freq: 3520, freqEnd: 3520, gain: 0.2, attack: 0.002, decay: 0.45, delay: 0.09 },
    ] },
    // ...and a bright two-note chime when they come back (it was stopped).
    shopliftRecovered: { volume: 0.6, layers: [
      { type: 'tone', wave: 'sine', freq: 1046, freqEnd: 1046, gain: 0.4, attack: 0.005, decay: 0.2 },
      { type: 'tone', wave: 'sine', freq: 1568, freqEnd: 1568, gain: 0.4, attack: 0.005, decay: 0.35, delay: 0.12 },
    ] },
    // ...and three quick pants when it's winded after a swing.
    walkerPant: {
      volume: 0.6,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 1050, q: 0.8, gain: 0.55, attack: 0.015, decay: 0.12 },
        { type: 'noise', filter: 'bandpass', freq: 950, q: 0.8, gain: 0.5, attack: 0.015, decay: 0.12, delay: 0.24 },
        { type: 'noise', filter: 'bandpass', freq: 850, q: 0.8, gain: 0.45, attack: 0.015, decay: 0.14, delay: 0.48 },
      ],
    },

    // Cart Pusher: a squealing wheel while it rolls...
    mannequinClick: { volume: .45, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1800, q: 3, gain: .4, attack: .002, decay: .045 },
      { type: 'tone', wave: 'sine', freq: 650, freqEnd: 310, gain: .25, attack: .002, decay: .07 },
    ] },
    mannequinStep: { volume: .3, layers: [
      { type: 'noise', filter: 'highpass', freq: 1200, gain: .25, attack: .002, decay: .035 },
      { type: 'tone', wave: 'sine', freq: 260, freqEnd: 150, gain: .35, attack: .002, decay: .055 },
    ] },
    cartSqueak: {
      volume: 0.35,
      layers: [
        { type: 'tone', wave: 'sawtooth', freq: 2300, freqEnd: 1900, gain: 0.18, attack: 0.01, decay: 0.12 },
        { type: 'tone', wave: 'sine', freq: 3100, freqEnd: 2700, gain: 0.25, attack: 0.01, decay: 0.1 },
      ],
    },
    // ...the WARNING before a charge: the wire basket rattling hard and a long rising wheel squeal...
    cartRattle: {
      volume: 0.7,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3200, q: 2.5, gain: 0.4, attack: 0.005, decay: 0.05 },
        { type: 'noise', filter: 'bandpass', freq: 2800, q: 2.5, gain: 0.4, attack: 0.005, decay: 0.05, delay: 0.09 },
        { type: 'noise', filter: 'bandpass', freq: 3400, q: 2.5, gain: 0.4, attack: 0.005, decay: 0.05, delay: 0.18 },
        { type: 'noise', filter: 'bandpass', freq: 3000, q: 2.5, gain: 0.4, attack: 0.005, decay: 0.05, delay: 0.27 },
        { type: 'noise', filter: 'bandpass', freq: 3300, q: 2.5, gain: 0.45, attack: 0.005, decay: 0.05, delay: 0.36 },
        { type: 'noise', filter: 'bandpass', freq: 2900, q: 2.5, gain: 0.45, attack: 0.005, decay: 0.05, delay: 0.45 },
        { type: 'tone', wave: 'sawtooth', freq: 1500, freqEnd: 2900, gain: 0.16, attack: 0.15, decay: 0.75 },
      ],
    },
    // ...and a metal CRASH when it misses and hits something.
    cartCrash: {
      volume: 0.8,
      layers: [
        { type: 'noise', filter: 'lowpass', freq: 900, q: 0.7, gain: 0.7, attack: 0.002, decay: 0.18 },
        { type: 'noise', filter: 'bandpass', freq: 2600, q: 1.5, gain: 0.5, attack: 0.002, decay: 0.35 },
        { type: 'tone', wave: 'square', freq: 420, freqEnd: 300, gain: 0.12, attack: 0.002, decay: 0.3 },
        { type: 'noise', filter: 'bandpass', freq: 3800, q: 3, gain: 0.25, attack: 0.002, decay: 0.08, delay: 0.14 },
      ],
    },

    // Sir Waffles: soft boot thumps and the rip, hollow pop and flop of a foam helmet coming loose.
    mascotThump: {
      volume: 0.48,
      layers: [
        { type: 'tone', wave: 'sine', freq: 112, freqEnd: 54, gain: 0.52, attack: 0.004, decay: 0.14 },
        { type: 'noise', filter: 'lowpass', freq: 420, gain: 0.34, attack: 0.005, decay: 0.11 },
      ],
    },
    // The warning before the rush: a rising, ragged howl from inside the costume.
    mascotHowl: {
      volume: 0.7,
      layers: [
        { type: 'tone', wave: 'sawtooth', freq: 95, freqEnd: 260, gain: 0.5, attack: 0.08, decay: 0.5, delay: 0.1 },
        { type: 'noise', filter: 'bandpass', freq: 700, q: 1.6, gain: 0.26, attack: 0.1, decay: 0.45, delay: 0.1 },
      ],
    },
    mascotHeadPop: {
      volume: 0.82,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 1850, q: 1.3, gain: 0.64, attack: 0.003, decay: 0.15 },
        { type: 'tone', wave: 'triangle', freq: 530, freqEnd: 150, gain: 0.72, attack: 0.003, decay: 0.24 },
        { type: 'noise', filter: 'lowpass', freq: 360, gain: 0.47, attack: 0.008, decay: 0.16, delay: 0.68 },
      ],
    },
    saltCrunch: {
      volume: 0.75,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 2600, q: 1.6, gain: 0.56, attack: 0.002, decay: 0.045 },
        { type: 'noise', filter: 'highpass', freq: 4200, q: 0.9, gain: 0.44, attack: 0.001, decay: 0.035, delay: 0.015 },
        { type: 'noise', filter: 'bandpass', freq: 2100, q: 1.8, gain: 0.48, attack: 0.003, decay: 0.055, delay: 0.045 },
        { type: 'noise', filter: 'lowpass', freq: 480, gain: 0.24, attack: 0.002, decay: 0.04 },
      ],
    },

    // A detuned closing bell and a low bucket clang for the Night Janitor.
    janitorSting: {
      volume: 0.8,
      layers: [
        { type: 'tone', wave: 'triangle', freq: 440, freqEnd: 416, gain: 0.56, attack: 0.009, decay: 0.65 },
        { type: 'tone', wave: 'triangle', freq: 293, freqEnd: 262, gain: 0.52, attack: 0.009, decay: 0.8, delay: 0.24 },
        { type: 'noise', filter: 'bandpass', freq: 460, q: 1.7, gain: 0.55, attack: 0.006, decay: 0.42, delay: 0.24 },
      ],
    },

    managerSting: {
      volume: 0.7,
      layers: [
        { type: 'tone', wave: 'triangle', freq: 330, freqEnd: 294, gain: 0.5, attack: 0.01, decay: 0.5 },
        { type: 'tone', wave: 'triangle', freq: 440, freqEnd: 392, gain: 0.5, attack: 0.01, decay: 0.5, delay: 0.18 },
        { type: 'tone', wave: 'sawtooth', freq: 196, freqEnd: 165, gain: 0.14, attack: 0.02, decay: 0.8, delay: 0.36 },
      ],
    },
    guardSting: {
      volume: 0.6,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 1400, q: 2, gain: 0.35, attack: 0.01, decay: 0.18 },
        { type: 'tone', wave: 'square', freq: 880, freqEnd: 660, gain: 0.18, attack: 0.01, decay: 0.25, delay: 0.1 },
        { type: 'tone', wave: 'square', freq: 660, freqEnd: 440, gain: 0.18, attack: 0.01, decay: 0.35, delay: 0.4 },
      ],
    },
    influencerSting: {
      volume: 0.6,
      layers: [
        { type: 'tone', wave: 'sine', freq: 659, gain: 0.35, attack: 0.006, decay: 0.3 },
        { type: 'tone', wave: 'sine', freq: 831, gain: 0.35, attack: 0.006, decay: 0.3, delay: 0.12 },
        { type: 'tone', wave: 'sine', freq: 988, gain: 0.35, attack: 0.006, decay: 0.6, delay: 0.24 },
        { type: 'noise', filter: 'highpass', freq: 6000, gain: 0.12, attack: 0.005, decay: 0.1, delay: 0.24 },
      ],
    },

    // Mall PA "ding-dong" before an announcement (a new zombie type showing up).
    paChime: {
      volume: 0.55,
      layers: [
        { type: 'tone', wave: 'sine', freq: 880, gain: 0.55, attack: 0.005, decay: 0.8 },
        { type: 'tone', wave: 'triangle', freq: 1760, gain: 0.08, attack: 0.005, decay: 0.35 },
        { type: 'tone', wave: 'sine', freq: 698, gain: 0.55, attack: 0.005, decay: 1.0, delay: 0.42 },
        { type: 'tone', wave: 'triangle', freq: 1396, gain: 0.08, attack: 0.005, decay: 0.4, delay: 0.42 },
      ],
    },

    // Trigger squeezed on an empty gun: crisp metallic striker snap, hammer release, and hollow chamber ring.
    dryClick: {
      volume: 0.85,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3800, q: 2.2, gain: 0.8, attack: 0.0005, decay: 0.026 },
        { type: 'tone', wave: 'triangle', freq: 2400, freqEnd: 1500, gain: 0.35, attack: 0.0005, decay: 0.022 },
        { type: 'tone', wave: 'sine', freq: 880, freqEnd: 520, gain: 0.22, attack: 0.001, decay: 0.065, delay: 0.006 },
        { type: 'noise', filter: 'lowpass', freq: 1200, q: 1.2, gain: 0.28, attack: 0.001, decay: 0.038, delay: 0.004 },
      ],
    },

    // Wardrobe showpiece motifs (config/wardrobe.js showpieces): the mall chime family, 2-3 soft bell notes per item, hummed while the item is unsold.
    motifGlasses: {
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 392, gain: 0.4, attack: 0.005, decay: 0.24 },
        { type: 'tone', wave: 'triangle', freq: 740, gain: 0.4, attack: 0.005, decay: 0.24, delay: 0.18 },
        { type: 'tone', wave: 'sine', freq: 494, gain: 0.4, attack: 0.005, decay: 0.45, delay: 0.36 },
      ],
    },
    motifLightUps: {
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 698, gain: 0.4, attack: 0.005, decay: 0.24 },
        { type: 'tone', wave: 'triangle', freq: 932, gain: 0.4, attack: 0.005, decay: 0.24, delay: 0.18 },
        { type: 'tone', wave: 'sine', freq: 1397, gain: 0.4, attack: 0.005, decay: 0.45, delay: 0.36 },
      ],
    },
    motifOrthopedics: {
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 440, gain: 0.4, attack: 0.005, decay: 0.24 },
        { type: 'tone', wave: 'triangle', freq: 554, gain: 0.4, attack: 0.005, decay: 0.45, delay: 0.18 },
      ],
    },
    motifAviators: { // an airy rising pair
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 784, gain: 0.4, attack: 0.005, decay: 0.24 },
        { type: 'tone', wave: 'triangle', freq: 1175, gain: 0.4, attack: 0.005, decay: 0.44, delay: 0.17 },
      ],
    },
    motifCardigan: { // a low three-note waltz
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 392, gain: 0.4, attack: 0.005, decay: 0.24 },
        { type: 'tone', wave: 'triangle', freq: 494, gain: 0.4, attack: 0.005, decay: 0.24, delay: 0.17 },
        { type: 'tone', wave: 'sine', freq: 587, gain: 0.4, attack: 0.005, decay: 0.44, delay: 0.34 },
      ],
    },
    motifSandwichBoard: { // two short sale bells and a final call
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 988, gain: 0.4, attack: 0.005, decay: 0.24 },
        { type: 'tone', wave: 'triangle', freq: 988, gain: 0.4, attack: 0.005, decay: 0.24, delay: 0.17 },
        { type: 'tone', wave: 'sine', freq: 1319, gain: 0.4, attack: 0.005, decay: 0.44, delay: 0.34 },
      ],
    },
    motifHiVisVest: { // a rising staff alert
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 659, gain: 0.4, attack: 0.005, decay: 0.24 },
        { type: 'tone', wave: 'triangle', freq: 880, gain: 0.4, attack: 0.005, decay: 0.24, delay: 0.17 },
        { type: 'tone', wave: 'sine', freq: 988, gain: 0.4, attack: 0.005, decay: 0.44, delay: 0.34 },
      ],
    },
    motifFannyPack: { // a bright descending TV jingle
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 1319, gain: 0.4, attack: 0.005, decay: 0.24 },
        { type: 'tone', wave: 'triangle', freq: 1047, gain: 0.4, attack: 0.005, decay: 0.24, delay: 0.17 },
        { type: 'tone', wave: 'sine', freq: 784, gain: 0.4, attack: 0.005, decay: 0.44, delay: 0.34 },
      ],
    },
    motifGoldCard: { // a high three-note flourish
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 880, gain: 0.4, attack: 0.005, decay: 0.24 },
        { type: 'tone', wave: 'triangle', freq: 1109, gain: 0.4, attack: 0.005, decay: 0.24, delay: 0.17 },
        { type: 'tone', wave: 'sine', freq: 1568, gain: 0.4, attack: 0.005, decay: 0.44, delay: 0.34 },
      ],
    },
    motifPaperHat: { // order-up bell: two quick dings and a lower one
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 1175, gain: 0.4, attack: 0.004, decay: 0.3 },
        { type: 'tone', wave: 'sine', freq: 1175, gain: 0.4, attack: 0.004, decay: 0.3, delay: 0.16 },
        { type: 'tone', wave: 'triangle', freq: 880, gain: 0.35, attack: 0.004, decay: 0.5, delay: 0.34 },
      ],
    },
    motifWheelie: { // a rising whirr into a ding
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'triangle', freq: 523, freqEnd: 1047, gain: 0.3, attack: 0.01, decay: 0.26 },
        { type: 'noise', filter: 'bandpass', freq: 2600, q: 1.5, gain: 0.12, attack: 0.01, decay: 0.24 },
        { type: 'tone', wave: 'sine', freq: 1568, gain: 0.4, attack: 0.004, decay: 0.45, delay: 0.26 },
      ],
    },
    motifFoamFinger: { // a stadium fanfare: da-da-DAA
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'triangle', freq: 659, gain: 0.35, attack: 0.006, decay: 0.16 },
        { type: 'tone', wave: 'triangle', freq: 784, gain: 0.35, attack: 0.006, decay: 0.16, delay: 0.17 },
        { type: 'tone', wave: 'triangle', freq: 1047, gain: 0.45, attack: 0.006, decay: 0.6, delay: 0.34 },
        { type: 'tone', wave: 'sine', freq: 2093, gain: 0.08, attack: 0.006, decay: 0.4, delay: 0.34 },
      ],
    },

    // Bought something: a cash-register "ka-ching" (drawer clunk + two bell tones).
    purchase: {
      volume: 0.6,
      layers: [
        { type: 'noise', filter: 'lowpass', freq: 900, q: 0.8, gain: 0.5, attack: 0.002, decay: 0.07 },
        { type: 'tone', wave: 'triangle', freq: 1320, gain: 0.45, attack: 0.002, decay: 0.35, delay: 0.05 },
        { type: 'tone', wave: 'triangle', freq: 1760, gain: 0.4, attack: 0.002, decay: 0.45, delay: 0.11 },
        { type: 'tone', wave: 'sine', freq: 3520, gain: 0.12, attack: 0.002, decay: 0.3, delay: 0.11 },
      ],
    },
    // Not enough points: a short, flat register buzz.
    denied: {
      volume: 0.45,
      layers: [
        { type: 'tone', wave: 'square', freq: 150, freqEnd: 140, gain: 0.35, attack: 0.004, decay: 0.22 },
        { type: 'tone', wave: 'square', freq: 151, freqEnd: 141, gain: 0.25, attack: 0.004, decay: 0.22, delay: 0.005 },
      ],
    },

    // Skylar's van at the end of a won run (fx/vanLights.js, config/closingTime.js vanShow): the hazard relay's click, the
    // starter cranking (nine strokes), and the engine catching with a rev and a muffler pop.
    vanHazardTick: { volume: 0.22, layers: [
      { type: 'noise', filter: 'bandpass', freq: 2600, q: 3, gain: 0.5, attack: 0.001, decay: 0.03 },
      { type: 'tone', wave: 'square', freq: 1150, freqEnd: 900, gain: 0.08, attack: 0.001, decay: 0.025 },
    ] },
    vanStarter: { volume: 0.55, layers: Array.from({ length: 9 }, (_, i) => [
      { type: 'noise', filter: 'lowpass', freq: 520, q: 1.2, gain: 0.55, attack: 0.008, decay: 0.07, delay: i * 0.083 },
      { type: 'tone', wave: 'square', freq: 74, freqEnd: 58, gain: 0.16, attack: 0.006, decay: 0.06, delay: i * 0.083 },
    ]).flat() },
    vanEngine: { volume: 0.7, layers: [
      { type: 'tone', wave: 'sawtooth', freq: 34, freqEnd: 62, gain: 0.32, attack: 0.03, decay: 0.45 },
      { type: 'tone', wave: 'sawtooth', freq: 62, freqEnd: 118, gain: 0.26, attack: 0.08, decay: 0.5, delay: 0.32 },
      { type: 'tone', wave: 'sawtooth', freq: 110, freqEnd: 46, gain: 0.22, attack: 0.05, decay: 1.4, delay: 0.85 },
      { type: 'noise', filter: 'lowpass', freq: 240, q: 0.9, gain: 0.6, attack: 0.05, decay: 1.9 },
      { type: 'noise', filter: 'bandpass', freq: 900, q: 1.5, gain: 0.45, attack: 0.002, decay: 0.09, delay: 0.62 },
    ] },
    ...gunSounds, // (the overhaul's new gun recipes replace the old ones of the same name)
  },
};
