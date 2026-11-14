// =============================================================================
// GUN SOUNDS
// Every gun's sounds (fire, its own dry fire, each reload step, its impacts), the box cutter, the Kiosk Sentry and the hit
// feedback, all synthesized (the format: the top of config/audio.js). config/audio.js merges these over its own sounds,
// so the names config/weapons.js uses stay the same.
//
// Each fire sound is built from named PARTS, the same four for every gun so upgrades can work on them by name:
//   crack  the attack: a few ms of shaped noise or an impulse (what makes a shot feel loud)
//   body   the weight and pitch: small guns high and snappy, big guns low and boomy
//   mech   the toy/tool part: the stapler's spring, the labeler's ratchet, the nailer's air, the scanner's crackle
//   (tail) the room: each recipe's `send` into the shared reverb (config/audio.js rooms), plus any long part of its own
// Loudness (quietest first): Sentry ~ Staple Gun < Price Gun < Foam Dart < BOGO < Leaf Blower < Nail Gun < Rivet Rifle <
// Balloon < Tennis < Barcode Scanner < Coil Nailer < Confetti Cannon < Stargazer < Bottle Rocket < Return to Sender.
// The measured table: docs/gun-sounds.md (tools/audition.html, Measure).
//
// `soundUpgrades`: what a Customer Service tier, a Warranty Renewal, a Build-A-Blaster stuffing and the last few rounds
// of a magazine do to a gun's shot (audio/recipes.js resolveVariant; weapons/upgrades.js soundVariantOf picks them).
// =============================================================================

// ---- Small builders (they only fill in a layer's fields) ---------------------------------------------------------
const crack = (freq, gain, o = {}) => ({ type: 'click', shape: 'noise', ms: 2, filter: 'bandpass', freq, q: 0.8, gain, ...o });
// (an impulse carries very little energy, so a tick's gain is x TICK_LEVEL: then its gain reads like the other layers')
const TICK_LEVEL = 10;
const tick = (freq, gain, o = {}) => ({ type: 'click', shape: 'impulse', ms: 1, filter: 'bandpass', freq, q: 5, ...o, gain: gain * TICK_LEVEL });
const thump = (freq, freqEnd, gain, decay, o = {}) => ({ type: 'tone', wave: 'sine', freq, freqEnd, gain, attack: 0.001, decay, ...o });
const air = (filter, freq, gain, decay, o = {}) => ({ type: 'noise', filter, freq, q: 0.8, gain, attack: 0.001, decay, ...o });
const metal = (freq, ratios, gain, decay, o = {}) => ({ type: 'metal', freq, ratios, gain, attack: 0.0005, decay, partialDecay: 0.75, ...o });
const fm = (freq, ratio, index, gain, decay, o = {}) => ({ type: 'fm', freq, ratio, index, gain, attack: 0.001, decay, ...o });
const at = (delay, layer) => ({ ...layer, delay });
// PUNCH (round three): a kick = a sine that DROPS fast (in `drop` s) from `from` to `to` and then holds there, the thud you feel;
// a slap = a short band of noise in the low mids (200-700 Hz), the "smack" between the crack and the kick. Tuned for desktop
// speakers: the kick holds at 58-95 Hz, and its part's drive adds the overtones (x2, x3) small speakers can actually play.
const kick = (from, to, gain, decay, drop, o = {}) => ({ type: 'tone', wave: 'sine', freq: from, freqEnd: to, freqTime: drop, gain, attack: 0.001, decay, ...o });
const slap = (freq, gain, decay, o = {}) => ({ type: 'noise', filter: 'bandpass', freq, q: 1.2, gain, attack: 0.001, decay, ...o });

// Inharmonic partial sets (ratios to the fundamental).
const BAR = [1, 2.76, 5.4];          // a struck steel bar / rivet: a hard TANG
const SPRING = [1, 1.47, 2.09];      // a coil spring's ping
const BELL = [1, 2.4, 3.0, 4.5];     // a small desk bell
const PLATE = [1, 1.59, 2.14];       // a thin plate / sheet steel
const VARY = { pitch: 0.03, gain: 0.12, decay: 0.1, freq: 0.08 }; // per-layer wobble on every play (on top of the global one)

export const gunSounds = {
  // ===== STAPLE GUN (free starter pistol, semi ~8/s): an office stapler, "ka-chik". The quietest gun. =================
  stapleShot: { volume: 1.8, maxVoices: 4, send: 0.06, drive: 0.15, vary: VARY, parts: {
    crack: [crack(4200, 0.9, { q: 0.9 })],
    body: [thump(320, 170, 0.55, 0.05), air('lowpass', 1400, 0.35, 0.03)],
    mech: [at(0.004, metal(1850, SPRING, 0.2, 0.13)), at(0.026, tick(2600, 0.5, { q: 4 })), at(0.026, metal(2400, SPRING, 0.06, 0.05))], // "ka" ... "chik"
  } },
  stapleDry: { volume: 2.82, maxVoices: 2, vary: VARY, parts: {
    mech: [tick(3000, 0.7, { q: 3 }), at(0.004, metal(1850, SPRING, 0.08, 0.04))],
  } },
  stapleReloadOut: { volume: 1.5, vary: VARY, parts: { // pusher rod pulled back: a steel slide
    mech: [air('bandpass', 2600, 0.45, 0.06, { freqEnd: 3400, q: 2, attack: 0.004 }), at(0.06, tick(3600, 0.45))],
  } },
  stapleReloadIn: { volume: 0.72, vary: VARY, parts: { // a strip slapped into the channel
    body: [thump(340, 170, 0.35, 0.04), air('lowpass', 1500, 0.5, 0.04)],
    mech: [at(0.008, crack(3000, 0.4, { q: 1.5 })), at(0.012, metal(1850, SPRING, 0.06, 0.05))],
  } },
  stapleReloadReady: { volume: 2.17, vary: VARY, parts: { // the rod snaps shut
    mech: [tick(3800, 0.6), at(0.045, tick(2400, 0.55)), at(0.05, metal(1850, SPRING, 0.12, 0.08))],
  } },

  // ===== PRICE GUN (labeler, full auto 12/s): a plastic tick, a three-click ratchet and a sticker peeling off. ==========
  priceShot: { volume: 3.11, flavourEvery: 3, maxVoices: 4, send: 0.05, drive: 0.1, flavourGain: 0.5, vary: VARY, parts: {
    crack: [crack(3000, 0.7, { ms: 1.5, q: 1 })],
    body: [thump(420, 240, 0.4, 0.035), air('bandpass', 1200, 0.35, 0.02, { q: 0.9 })],
    mech: [at(0.008, tick(2200, 0.35, { q: 6 })), at(0.016, tick(2500, 0.35, { q: 6 })), at(0.024, tick(2800, 0.35, { q: 6 })),
      at(0.01, air('highpass', 5000, 0.12, 0.03, { freqEnd: 2500, attack: 0.004 }))],
  } },
  priceDry: { volume: 3.56, maxVoices: 2, vary: VARY, parts: { mech: [tick(2200, 0.4, { q: 6 }), at(0.01, tick(2500, 0.4, { q: 6 }))] } },
  priceReloadOut: { volume: 0.66, vary: VARY, parts: { // the empty roll popped off
    mech: [tick(1800, 0.5, { q: 3 }), at(0.01, thump(600, 300, 0.2, 0.04, { wave: 'triangle' }))],
  } },
  priceReloadIn: { volume: 0.8, vary: VARY, parts: { // a fresh roll pressed on: the ratchet winds
    body: [air('lowpass', 1200, 0.5, 0.04)],
    mech: [0, 0.02, 0.04, 0.06].map((d, i) => at(d, tick(2200 + i * 200, 0.3, { q: 6 }))),
  } },
  priceReloadReady: { volume: 0.59, vary: VARY, parts: { // the feed snapped shut
    mech: [crack(3200, 0.5, { q: 1.4, ms: 1.5 }), at(0.03, thump(300, 150, 0.25, 0.04))],
  } },

  // ===== NAIL GUN (framing nailer, semi 4/s, pierces): "pfft-CHUNK": air, a driver blade and a heavy thump. ============
  nailShot: { volume: 1.11, maxVoices: 3, send: 0.1, drive: 0.2, vary: VARY, parts: {
    crack: [crack(2400, 1, { ms: 3, q: 0.7 }), tick(5000, 0.25, { q: 1 })],
    body: [thump(130, 55, 0.9, 0.12, { drive: 0.3 }), air('lowpass', 700, 0.55, 0.07)],
    mech: [at(0.004, metal(880, BAR, 0.22, 0.09)), at(0.02, air('highpass', 6000, 0.28, 0.14, { freqEnd: 2500, attack: 0.006 }))],
  } },
  nailDry: { volume: 0.5, maxVoices: 2, vary: VARY, parts: {
    mech: [tick(1500, 0.5, { q: 2 }), at(0.005, air('highpass', 5000, 0.3, 0.08, { freqEnd: 3000, attack: 0.003 }))],
  } },
  nailReloadOut: { volume: 0.47, vary: VARY, parts: { // magazine latch flipped open
    mech: [tick(2200, 0.55, { q: 3 }), at(0.004, metal(880, BAR, 0.08, 0.05)), at(0.01, thump(500, 260, 0.2, 0.05, { wave: 'triangle' }))],
  } },
  nailReloadIn: { volume: 0.68, vary: VARY, parts: { // a nail strip slid in: a steel scrape
    mech: [air('bandpass', 3400, 0.45, 0.08, { q: 3, attack: 0.02, freqEnd: 2600 }), at(0.09, air('lowpass', 1000, 0.5, 0.05))],
  } },
  nailReloadReady: { volume: 0.41, vary: VARY, parts: { // the follower snaps shut, the line takes air
    mech: [tick(3600, 0.6), at(0.02, thump(260, 120, 0.3, 0.05)), at(0.03, air('highpass', 5000, 0.18, 0.12, { attack: 0.01 }))],
  } },

  // ===== FOAM DART BLASTER (burst of 3 darts, one sound per dart): "fwump": a soft puff and the plunger's boing. =======
  foamShot: { volume: 2.73, flavourEvery: 3, maxVoices: 4, send: 0.06, flavourGain: 0.5, vary: { ...VARY, pitch: 0.05 }, parts: {
    crack: [tick(2000, 0.35, { filter: 'lowpass', q: 0.7 })],
    body: [air('lowpass', 520, 0.8, 0.06, { freqEnd: 220, attack: 0.004 }), thump(190, 110, 0.45, 0.05)],
    mech: [at(0.004, fm(330, 1.5, 2, 0.14, 0.09, { indexEnd: 0 })), at(0.03, crack(1800, 0.25, { q: 3 }))],
  } },
  foamDry: { volume: 1.53, maxVoices: 2, vary: VARY, parts: {
    mech: [tick(1500, 0.6, { filter: 'lowpass', q: 0.7 }), fm(330, 1.5, 1.5, 0.1, 0.07, { indexEnd: 0 })],
  } },
  foamReloadOut: { volume: 0.48, vary: VARY, parts: { // the clip unlatched
    mech: [crack(2100, 0.5, { q: 1.4 }), at(0.006, thump(650, 260, 0.25, 0.05, { wave: 'triangle' }))],
  } },
  foamReloadIn: { volume: 1.11, vary: VARY, parts: { // a full clip of darts pushed home: plastic and foam
    body: [air('lowpass', 1200, 0.6, 0.06)],
    mech: [at(0.015, crack(2800, 0.35, { q: 1.5 }))],
  } },
  foamReloadReady: { volume: 0.33, vary: VARY, parts: { // the priming slide: pulled, then a boing
    mech: [crack(3400, 0.5, { q: 1.5 }), at(0.02, fm(330, 1.5, 2.5, 0.16, 0.12, { indexEnd: 0 })), at(0.025, thump(400, 170, 0.2, 0.04, { wave: 'triangle' }))],
  } },

  // ===== CONFETTI CANNON (shotgun, semi ~1.8/s): a party popper the size of a shotgun: a boom, then paper everywhere. ==
  confettiShot: { volume: 1.61, maxVoices: 2, send: 0.15, drive: 0.4, duck: { db: 6, seconds: 0.2 }, vary: VARY, parts: { // PUNCH B: a wide crack,
    // a kick that drops from 200 to 68 Hz in 20 ms, a low-mid slap, a blast of air and a low roll after it; everything else dips 6 dB
    crack: [crack(1800, 1.3, { ms: 6, q: 0.35 }), tick(3000, 0.4, { q: 0.8 }), air('bandpass', 3000, 0.6, 0.015, { q: 0.7 })],
    body: { drive: 0.7, layers: [kick(200, 68, 1.4, 0.16, 0.02), slap(280, 1.1, 0.022), slap(600, 0.6, 0.012),
      air('lowpass', 2200, 1, 0.06, { freqEnd: 500 }), thump(55, 45, 0.45, 0.3, { attack: 0.01 })] },
    mech: [
      ...[0.06, 0.085, 0.105, 0.13, 0.16, 0.19, 0.23].map((d, i) => at(d, air('highpass', 4500 - i * 250, 0.1, 0.025, { attack: 0.002, vary: { gain: 0.4, delay: 0.25, freq: 0.15 } }))),
      at(0.05, thump(1320, 1760, 0.05, 0.09, { wave: 'triangle', attack: 0.01 })), // the party-horn squeak
    ],
  } },
  confettiDry: { volume: 3.49, maxVoices: 2, vary: VARY, parts: {
    mech: [crack(1800, 0.6, { q: 2 }), at(0.005, air('lowpass', 600, 0.4, 0.04))],
  } },
  confettiReloadOut: { volume: 0.48, vary: VARY, parts: { // the breach broken open
    mech: [crack(1900, 0.6, { q: 1.5 }), at(0.008, thump(300, 140, 0.4, 0.07, { wave: 'triangle' }))],
  } },
  confettiReloadIn: { volume: 0.54, vary: VARY, parts: { // ONE cardboard shell pushed in (plays per shell): "thup"
    body: [air('lowpass', 650, 0.6, 0.05, { attack: 0.004 }), thump(350, 170, 0.3, 0.05)],
    mech: [at(0.01, air('highpass', 4000, 0.12, 0.03, { attack: 0.004 }))],
  } },
  confettiReloadReady: { volume: 0.74, vary: VARY, parts: { // snapped shut
    mech: [crack(3200, 0.7, { q: 1.3 }), at(0.004, metal(900, PLATE, 0.08, 0.06))],
    body: [thump(200, 65, 0.5, 0.1)],
  } },
  // The Party Trap limited edition going off (game/features/workshop.js): the cannon's boom without its paper, more streamers.
  partyTrapBlast: { volume: 1.14, duck: { db: 5, seconds: 0.2 }, maxVoices: 3, send: 0.16, drive: 0.4, vary: VARY, parts: {
    crack: [crack(2200, 1, { ms: 5, q: 0.5 })],
    body: [thump(85, 34, 1, 0.3), air('lowpass', 900, 0.9, 0.18, { freqEnd: 250 })],
    mech: [
      ...[0.04, 0.07, 0.1, 0.14, 0.19, 0.25, 0.32].map((d, i) => at(d, air('highpass', 5000 - i * 300, 0.16, 0.03, { attack: 0.002, vary: { gain: 0.4, delay: 0.25 } }))),
      at(0.05, thump(1046, 1568, 0.1, 0.18, { wave: 'triangle', attack: 0.015 })),
    ],
  } },

  // ===== RIVET RIFLE (light auto rifle, ~11.8/s): BRIGHT and RINGING: a sharp crack and a rivet's high steel TANG. =====
  rivetShot: { volume: 3.16, flavourEvery: 3, maxVoices: 4, send: 0.08, drive: 0.25, flavourGain: 0.5, vary: VARY, parts: { // PUNCH B: at 12 a
    // second the low end must stay short: a kick from 240 to 95 Hz in 10 ms, a tight slap, then the bright rivet TANG (no duck: it would pump)
    crack: [crack(4200, 1, { ms: 2.5, q: 0.7 }), tick(2500, 0.3, { q: 1 })],
    body: { drive: 0.6, layers: [kick(240, 95, 1.1, 0.065, 0.01), slap(380, 1, 0.014), air('bandpass', 2200, 0.5, 0.03, { q: 0.7 })] },
    mech: [metal(2100, BAR, 0.6, 0.12, { detune: 8 }), at(0.004, metal(3100, [1, 1.5, 2.2], 0.15, 0.06))],
  } },
  rivetDry: { volume: 2.59, maxVoices: 2, vary: VARY, parts: { mech: [tick(4000, 0.5, { q: 3 }), metal(2350, BAR, 0.15, 0.05)] } },
  rivetReloadOut: { volume: 1.79, vary: VARY, parts: { // the magazine drops: steel on steel
    mech: [crack(1500, 0.6, { q: 1.2, ms: 3 }), at(0.01, metal(1200, BAR, 0.1, 0.06))],
  } },
  rivetReloadIn: { volume: 0.92, vary: VARY, parts: { // a box of rivets seated
    body: [thump(180, 70, 0.5, 0.08), air('lowpass', 1000, 0.6, 0.07)],
    mech: [at(0.01, metal(2350, BAR, 0.1, 0.06))],
  } },
  rivetReloadReady: { volume: 0.79, vary: VARY, parts: { // the charging handle: back, and a ringing slam forward
    mech: [crack(2300, 0.5), at(0.03, tick(3000, 0.5)), at(0.03, metal(2350, BAR, 0.18, 0.1))],
  } },

  // ===== HEAVY COIL NAILER (industrial machine gun, 8/s, 64-nail drum): LOW and CHUGGY: a dull piston thump, the drum
  // rattling round a nail, and an exhaust after each shot. Nothing like the Rivet Rifle: darker, slower, heavier. =========
  coilShot: { volume: 1.67, flavourEvery: 2, maxVoices: 3, send: 0.1, drive: 0.45, flavourGain: 0.6, vary: VARY, parts: {
    crack: [crack(1400, 0.8, { ms: 4, q: 0.6 })],
    body: [thump(85, 40, 1, 0.13), thump(160, 70, 0.5, 0.09), air('lowpass', 450, 0.6, 0.08)],
    mech: [at(0.03, fm(260, 2.7, 5, 0.1, 0.05, { indexEnd: 0.5 })),
      at(0.035, air('bandpass', 3200, 0.22, 0.12, { freqEnd: 1800, q: 0.6, attack: 0.008 }))],
  } },
  coilDry: { volume: 1.36, maxVoices: 2, vary: VARY, parts: {
    mech: [tick(1000, 0.7, { filter: 'lowpass', q: 0.7 }), at(0.01, fm(260, 2.7, 4, 0.08, 0.05, { indexEnd: 0.5 }))],
  } },
  coilReloadOut: { volume: 0.43, vary: VARY, parts: { // the drum's lid unlatched, the spent coil pulled out
    mech: [crack(1450, 0.65, { q: 1.3, ms: 3 }), at(0.02, fm(220, 2.7, 6, 0.1, 0.12, { indexEnd: 1 })), at(0.01, thump(310, 130, 0.35, 0.08, { wave: 'triangle' }))],
  } },
  coilReloadIn: { volume: 0.68, vary: VARY, parts: { // a fresh coil dropped in: a heavy rattle of nails
    body: [thump(165, 58, 0.65, 0.1), air('lowpass', 950, 0.75, 0.1)],
    mech: [at(0.02, fm(300, 2.7, 7, 0.12, 0.14, { indexEnd: 1 })), at(0.02, crack(2600, 0.35, { q: 1.5 }))],
  } },
  coilReloadReady: { volume: 0.45, vary: VARY, parts: { // the lid slammed, the air line hissing back up
    mech: [crack(2950, 0.6, { q: 1.3 }), at(0.03, air('bandpass', 3200, 0.2, 0.18, { freqEnd: 2000, q: 0.6, attack: 0.02 }))],
    body: [at(0.018, thump(240, 95, 0.4, 0.06))],
  } },

  // ===== BARCODE SCANNER (hold to scan, fires itself when the scan completes, marks what it scanned): the whine rises
  // over the whole scan to exactly the checkout BEEP's note, so the beep IS the scan completing; the shot is a laser snap,
  // a sub drop and an electrical crackle. Let go early and the whine stops (weapons/playerGun.js). ======================
  scannerCharge: { volume: 0.39, maxVoices: 1, send: 0.03, pitchVariation: 0, parts: {
    body: [{ type: 'tone', wave: 'sine', freq: 490, freqEnd: 1960, gain: 0.35, attack: 0.43, decay: 0.05 },
      { type: 'tone', wave: 'sine', freq: 980, freqEnd: 3920, gain: 0.07, attack: 0.43, decay: 0.04 }],
    mech: [{ type: 'fm', freq: 245, freqEnd: 980, ratio: 2, index: 0.6, gain: 0.07, attack: 0.43, decay: 0.04 }],
  } },
  scannerBeep: { volume: 1.11, maxVoices: 2, send: 0.05, pitchVariation: 0, parts: {
    mech: [{ type: 'tone', wave: 'square', freq: 1960, gain: 0.28, attack: 0.002, decay: 0.11 },
      { type: 'tone', wave: 'sine', freq: 3920, gain: 0.1, attack: 0.002, decay: 0.08 }],
  } },
  scannerShot: { volume: 1.41, maxVoices: 2, send: 0.1, drive: 0.25, vary: VARY, parts: {
    crack: [tick(3500, 0.35, { q: 1 }), air('bandpass', 4500, 0.5, 0.02, { q: 1 })],
    body: [thump(200, 45, 0.9, 0.15), { type: 'tone', wave: 'sawtooth', freq: 1100, freqEnd: 220, gain: 0.18, attack: 0.001, decay: 0.08 }],
    mech: [0.02, 0.035, 0.055, 0.07, 0.1].map((d) => at(d, crack(5500, 0.25, { ms: 1, filter: 'highpass', q: 0.7, vary: { gain: 0.5, delay: 0.3 } }))),
  } },
  scannerDry: { volume: 0.37, maxVoices: 1, pitchVariation: 0, parts: { // the till's "please try again" buzz
    mech: [{ type: 'tone', wave: 'square', freq: 220, gain: 0.18, attack: 0.002, decay: 0.14 },
      { type: 'tone', wave: 'square', freq: 233, gain: 0.12, attack: 0.002, decay: 0.14 }],
  } },
  scannerReloadOut: { volume: 0.66, vary: VARY, parts: { // the battery pack out, a falling power-down
    mech: [crack(2200, 0.5, { q: 1.5 }), thump(780, 320, 0.3, 0.06)],
  } },
  scannerReloadIn: { volume: 0.72, vary: VARY, parts: { // a fresh pack in
    body: [air('lowpass', 1150, 0.65, 0.06)],
    mech: [at(0.015, thump(440, 880, 0.28, 0.07, { wave: 'triangle' }))],
  } },
  scannerReloadReady: { volume: 0.66, pitchVariation: 0, parts: { // the power-on chirp: two rising notes up to the beep's
    mech: [thump(1320, 1760, 0.32, 0.055), at(0.045, { type: 'tone', wave: 'square', freq: 1960, gain: 0.14, attack: 0.001, decay: 0.05 })],
  } },

  // ===== LEAF BLOWER (GRAB-A-GUN, a pulse every 0.15 s from a fuel tank): a two-stroke engine's "brap" and the wind. Each
  // pulse runs into the next, so held down it reads as one engine; 3 voices keep the overlap from stacking up. ===========
  leafBlowerPuff: { volume: 1.35, flavourEvery: 3, maxVoices: 3, send: 0.04, pitchVariation: 0.02, flavourGain: 0.4, vary: { pitch: 0.02, gain: 0.08, freq: 0.05 }, parts: {
    body: [fm(72, 0.5, 3, 0.16, 0.2, { wave: 'sawtooth', indexEnd: 2, attack: 0.02 }), air('lowpass', 300, 0.6, 0.2, { attack: 0.02 })],
    mech: [air('bandpass', 1100, 0.55, 0.18, { freqEnd: 1500, q: 0.5, attack: 0.03 })],
  } },
  leafBlowerDry: { volume: 0.53, maxVoices: 1, vary: VARY, parts: { // an empty tank: the engine sputters out
    body: [fm(60, 0.5, 3, 0.2, 0.15, { wave: 'sawtooth', indexEnd: 0 }), air('lowpass', 400, 0.5, 0.06), at(0.12, air('lowpass', 400, 0.35, 0.05))],
  } },

  // ===== TENNIS BALL LAUNCHER (GRAB-A-GUN, a ball that seeks the next zombie and bounces): a ball machine's "thoonk", and
  // a hollow rubber "pok" on every bounce that climbs in pitch as the ball chains from zombie to zombie. ===============
  tennisLaunch: { volume: 1.64, maxVoices: 2, send: 0.1, vary: VARY, parts: {
    crack: [tick(1500, 0.5, { filter: 'lowpass', q: 0.7 })],
    body: [thump(160, 60, 0.9, 0.12), air('lowpass', 1200, 0.7, 0.09, { freqEnd: 400, attack: 0.002 })],
    mech: [at(0.01, thump(620, 480, 0.3, 0.04)), at(0.01, air('bandpass', 1300, 0.25, 0.02, { q: 2 }))],
  } },
  tennisBounce: { volume: 0.9, maxVoices: 4, send: 0.07, pitchStep: 0.07, vary: VARY, parts: {
    body: [thump(700, 520, 0.55, 0.06), thump(1400, 1040, 0.1, 0.03, { wave: 'triangle' })],
    mech: [air('bandpass', 1600, 0.3, 0.015, { q: 1.5 })],
  } },
  tennisDry: { volume: 2.23, maxVoices: 2, vary: VARY, parts: {
    mech: [tick(1800, 0.4, { filter: 'lowpass', q: 0.7 }), air('lowpass', 900, 0.4, 0.06)],
  } },
  tennisReloadOut: { volume: 0.39, vary: VARY, parts: { // the hopper flap opened
    mech: [crack(1700, 0.55, { q: 1.4 }), at(0.008, thump(280, 150, 0.35, 0.07, { wave: 'triangle' }))],
  } },
  tennisReloadIn: { volume: 0.4, vary: VARY, parts: { // a ball dropped in: pok, then it rolls into the port
    body: [thump(620, 470, 0.45, 0.05), at(0.06, thump(560, 430, 0.25, 0.04))],
    mech: [at(0.07, air('lowpass', 900, 0.35, 0.06))],
  } },
  tennisReloadReady: { volume: 0.61, vary: VARY, parts: { // the air tank pressurised: a snap and a short pump
    mech: [crack(3000, 0.6, { q: 1.3 }), at(0.02, air('highpass', 3000, 0.2, 0.1, { attack: 0.01 }))],
    body: [thump(190, 70, 0.45, 0.09)],
  } },

  // ===== RETURN TO SENDER (the wonder weapon, an instant-kill cone): THE LOUDEST. A pneumatic mail tube's WHOOMP, a rush of
  // air and a rising whistle, the rubber stamp's KA-CHUNK, and a rainbow of bells as the parcels go. ====================
  returnBeam: { volume: 1.15, duck: { db: 8, seconds: 0.3 }, maxVoices: 2, send: 0.17, drive: 0.25, vary: VARY, parts: {
    crack: [crack(1800, 1, { ms: 5, q: 0.5 })],
    body: [thump(80, 30, 1.1, 0.38, { drive: 0.2 }), air('lowpass', 650, 0.9, 0.35, { freqEnd: 200, attack: 0.002 })],
    mech: [at(0.03, thump(400, 1600, 0.14, 0.3, { attack: 0.02 })), at(0.26, tick(1200, 0.8, { filter: 'lowpass', q: 0.7 })),
      at(0.26, thump(210, 90, 0.6, 0.08))],
    tail: [1047, 1319, 1568, 2093].map((freq, i) => at(0.05 + i * 0.05, fm(freq, 1.4, 2, 0.1, 0.35, { indexEnd: 0 }))),
  } },
  returnStamp: { volume: 0.84, maxVoices: 4, send: 0.07, vary: VARY, parts: { // one zombie boxed and stamped
    crack: [tick(1000, 0.8, { filter: 'lowpass', q: 0.7 })],
    body: [thump(200, 90, 0.7, 0.08), air('lowpass', 700, 0.5, 0.05)],
    mech: [at(0.05, metal(1320, [1, 2.76], 0.1, 0.15))],
  } },
  returnDry: { volume: 0.52, maxVoices: 2, vary: VARY, parts: { // an empty tube: a hollow suck
    body: [thump(300, 200, 0.3, 0.08)],
    mech: [tick(1200, 0.5, { filter: 'lowpass', q: 0.7 })],
  } },
  returnReloadOut: { volume: 0.41, vary: VARY, parts: { // the parcel canister unscrewed
    mech: [crack(1500, 0.6, { q: 1.4 }), at(0.006, thump(360, 180, 0.18, 0.07, { wave: 'square' }))],
  } },
  returnReloadIn: { volume: 0.59, vary: VARY, parts: { // a full canister in, sucked home by the tube
    body: [thump(300, 140, 0.55, 0.09), air('lowpass', 1100, 0.7, 0.07)],
    mech: [at(0.03, air('bandpass', 900, 0.25, 0.12, { freqEnd: 2200, q: 0.8, attack: 0.03 }))],
  } },
  returnReloadReady: { volume: 1.25, pitchVariation: 0.01, parts: { // the post-office chime: ready to send
    mech: [metal(880, BELL, 0.3, 0.14), at(0.09, metal(1320, BELL, 0.3, 0.18))],
  } },

  // ===== STARGAZER 3000 (GRAB-A-GUN scoped sniper, semi 0.8/s, pierces 4): a big crack, a deep boom and a long tail, a
  // star's glint from the telescope, then (delayed, as the bolt is worked) a telescope's ratchet and the bolt: up, back, forward, down.
  stargazerShot: { volume: 1.02, maxVoices: 2, send: 0.18, drive: 0.35, duck: { db: 7, seconds: 0.28 }, vary: VARY, parts: { // PUNCH B: a sniper's
    // SLAM: a big crack, a kick from 220 to 58 Hz in 22 ms, two slaps, a blast of air and a long low roll; everything else dips 7 dB
    crack: [crack(3000, 1.3, { ms: 5, q: 0.4 }), tick(4500, 0.3, { q: 1 }), air('bandpass', 4200, 0.5, 0.025, { q: 1 })],
    body: { drive: 0.7, layers: [kick(220, 58, 1.4, 0.24, 0.022), slap(260, 1.1, 0.024), slap(700, 0.5, 0.012),
      air('lowpass', 2500, 1, 0.09, { freqEnd: 400 }), at(0.02, thump(52, 42, 0.6, 0.55, { attack: 0.02 }))] },
    mech: [at(0.32, crack(1900, 0.45, { q: 3, ms: 3 })), at(0.32, metal(1300, [1, 1.8], 0.1, 0.03)), at(0.47, crack(1300, 0.5, { q: 3, ms: 4 })),
      ...[0.52, 0.55, 0.58].map((d) => at(d, tick(3000, 0.25))), at(0.66, crack(2200, 0.5, { q: 3 })),
      at(0.8, { type: 'tone', wave: 'square', freq: 420, freqEnd: 260, gain: 0.06, attack: 0.001, decay: 0.04 })],
    tail: [at(0.04, metal(2637, [1, 1.5, 2.0], 0.06, 0.4, { attack: 0.002 }))],
  } },
  stargazerDry: { volume: 5.12, maxVoices: 2, vary: VARY, parts: { mech: [crack(3200, 0.6, { q: 3 }), metal(1300, [1, 1.8], 0.08, 0.04)] } },
  stargazerReloadOut: { volume: 1.37, vary: VARY, parts: { // the bolt opened, the magazine out
    mech: [crack(1600, 0.6, { q: 1.5, ms: 3 }), at(0.1, crack(1100, 0.5, { q: 1.4, ms: 3 })), at(0.1, metal(1300, [1, 1.8], 0.06, 0.04))],
  } },
  stargazerReloadIn: { volume: 0.67, vary: VARY, parts: { // ball bearings rattling into the magazine
    mech: [[0, 2900], [0.05, 3100], [0.1, 2700]].map(([d, f]) => at(d, metal(f, [1, 1.33], 0.18, 0.04))),
    body: [at(0.12, air('lowpass', 900, 0.4, 0.06))],
  } },
  stargazerReloadReady: { volume: 1.58, vary: VARY, parts: { // the bolt run home
    mech: [crack(1300, 0.6, { q: 1.4, ms: 3 }), at(0.12, crack(2300, 0.6, { q: 1.6 })), at(0.12, metal(1300, [1, 1.8], 0.08, 0.05))],
  } },

  // ===== BOTTLE ROCKET BAZOOKA (GRAB-A-GUN gold, one rocket, a blast): a fuse hiss and a cardboard-tube whoomp with a
  // rising whistle as it leaves; the burst is the biggest bang in the mall, with firework crackle scattered after it. ==
  bottleRocketLaunch: { volume: 1.95, maxVoices: 2, send: 0.14, vary: VARY, parts: {
    crack: [tick(1500, 0.6, { filter: 'lowpass', q: 0.7 })],
    body: [air('lowpass', 900, 0.8, 0.13, { freqEnd: 300 }), thump(120, 50, 0.7, 0.15)],
    mech: [air('highpass', 4000, 0.18, 0.1, { attack: 0.002 }), at(0.02, air('bandpass', 900, 0.3, 0.45, { freqEnd: 3500, q: 0.7, attack: 0.05 })),
      at(0.04, thump(1000, 2800, 0.12, 0.5, { attack: 0.03 }))],
  } },
  bottleRocketBurst: { volume: 1.24, duck: { db: 7, seconds: 0.3 }, maxVoices: 3, send: 0.19, drive: 0.4, vary: VARY, parts: {
    crack: [crack(1500, 1, { ms: 6, q: 0.4 })],
    body: [thump(75, 28, 1.1, 0.45), air('lowpass', 1600, 1, 0.3, { freqEnd: 250 })],
    mech: [[0.1, 4200], [0.16, 3600], [0.21, 5200], [0.27, 3900], [0.33, 6000], [0.38, 4600], [0.45, 3400], [0.52, 5600], [0.6, 4100], [0.7, 4800]]
      .map(([d, f]) => at(d, crack(f, 0.3, { ms: 1.5, q: 1.5, vary: { gain: 0.4, delay: 0.15, freq: 0.2 } }))),
  } },
  bottleRocketDry: { volume: 0.35, maxVoices: 1, vary: VARY, parts: { // a damp fuse: a fizzle
    mech: [tick(1000, 0.4, { filter: 'lowpass', q: 0.7 }), air('highpass', 3000, 0.2, 0.25, { attack: 0.01 })],
  } },
  bottleRocketReloadOut: { volume: 0.65, vary: VARY, parts: { // the spent stick pulled out of the tube
    body: [air('bandpass', 900, 0.6, 0.08, { q: 1.2, attack: 0.01, freqEnd: 600 })],
    mech: [at(0.07, tick(1400, 0.35, { q: 2 }))],
  } },
  bottleRocketReloadIn: { volume: 0.37, vary: VARY, parts: { // a rocket sliding into a cardboard tube, then seated
    body: [air('bandpass', 700, 0.6, 0.16, { q: 1, attack: 0.02, freqEnd: 500 }), at(0.14, thump(180, 110, 0.5, 0.08))],
  } },
  bottleRocketReloadReady: { volume: 0.41, vary: VARY, parts: { // the fuse caught: a struck match
    mech: [crack(2400, 0.5, { q: 1 }), at(0.01, air('highpass', 4000, 0.25, 0.15, { attack: 0.005 }))],
  } },

  // ===== BALLOON LAUNCHER (GRAB-A-GUN, homing balloons that pop): a rubbery squeak and a hiss of helium as one lets go;
  // the pop is a sharp crack, the rubber flapping, and a little confetti rustle. ======================================
  balloonLaunch: { volume: 2.35, maxVoices: 3, send: 0.08, vary: { ...VARY, pitch: 0.06 }, parts: { // a balloon let go: the rubber's wobbly
    // "eek" (a squeak with a 25 Hz vibrato), the neck flapping "brrrp" as the air rushes out, and a hiss
    body: [thump(220, 160, 0.35, 0.05)],
    mech: [fm(760, 0.033, 3.3, 0.22, 0.14, { wave: 'triangle', freqEnd: 1050, attack: 0.008 }),
      at(0.02, fm(130, 0.18, 5, 0.16, 0.16, { wave: 'sawtooth', freqEnd: 175, indexEnd: 2, attack: 0.006 })),
      air('highpass', 3500, 0.22, 0.12, { attack: 0.005 })],
  } },
  balloonPop: { volume: 2.1, maxVoices: 4, send: 0.1, vary: VARY, parts: { // BANG: a balloon pop is very sharp and very short; then the
    // rubber snapping back, a flap, and a little confetti rustle
    crack: [crack(3000, 1.4, { ms: 2, q: 0.3 }), tick(5000, 0.3, { q: 1 })],
    body: [thump(300, 120, 0.5, 0.04)],
    mech: [at(0.004, air('bandpass', 1200, 0.5, 0.03, { q: 2, attack: 0.002 })), at(0.01, fm(420, 0.25, 4, 0.08, 0.05, { wave: 'triangle', indexEnd: 0 })),
      at(0.03, air('highpass', 5000, 0.15, 0.18, { attack: 0.01 }))],
  } },
  balloonDry: { volume: 0.57, maxVoices: 1, vary: VARY, parts: { // nothing left: a sad squeak
    mech: [thump(900, 600, 0.2, 0.12, { wave: 'triangle', attack: 0.01 }), tick(2000, 0.3, { q: 2 })],
  } },
  balloonReloadOut: { volume: 0.69, vary: VARY, parts: { // the empty cartridge unscrewed
    mech: [crack(1400, 0.5, { q: 1.3, ms: 3 }), at(0.02, thump(500, 380, 0.12, 0.05, { wave: 'triangle' }))],
  } },
  balloonReloadIn: { volume: 0.35, vary: VARY, parts: { // a cartridge twisted in, then the hiss of the tank filling
    mech: [crack(1800, 0.5, { q: 1.4 }), at(0.05, air('highpass', 3500, 0.35, 0.25, { attack: 0.02 }))],
  } },
  balloonReloadReady: { volume: 0.5, vary: VARY, parts: { // a test squeak
    mech: [thump(880, 1320, 0.2, 0.12, { wave: 'triangle', attack: 0.002 }), fm(1100, 0.5, 1, 0.06, 0.1, { indexEnd: 0 })],
  } },

  // ===== BOGO (GRAB-A-GUN, two cheap SMGs, ~18/s, the fastest gun): a tight "tk" from each hand in turn, panned left and
  // right by the gun that fired (sidePan), light enough to run together into a rattle. =================================================
  bogoShot: { volume: 2.2, flavourEvery: 4, maxVoices: 4, send: 0.04, drive: 0.35, sidePan: 0.3, flavourGain: 0.4, vary: { ...VARY, pitch: 0.05 }, parts: {
    // a cheap SMG's "pap": a 3 ms crack, a short driven body (it fires about every 55 ms, so each shot ends before the next), and a paper flick;
    // panned to the hand that fired it (playerGun passes `side`: left mouse = the left gun)
    crack: [crack(3800, 1, { ms: 3, q: 0.8 })],
    body: [thump(200, 95, 0.8, 0.04, { drive: 0.3 }), air('lowpass', 2200, 0.6, 0.03)],
    mech: [at(0.004, tick(1900, 0.2)), at(0.006, air('highpass', 6000, 0.12, 0.012))],
  } },
  bogoDry: { volume: 1.04, maxVoices: 2, vary: VARY, parts: { mech: [tick(3000, 0.6, { q: 3 }), at(0.035, tick(2700, 0.6, { q: 3 }))] } },
  bogoReloadOut: { volume: 1.61, vary: VARY, parts: { // both magazines let go
    mech: [crack(1600, 0.55, { q: 1.2, ms: 3 }), at(0.035, crack(1400, 0.45, { q: 1.2, ms: 3 }))],
  } },
  bogoReloadIn: { volume: 0.22, vary: VARY, parts: { // two fresh ones slapped home, a beat apart
    body: [air('lowpass', 1100, 0.7, 0.06), thump(190, 80, 0.5, 0.06), at(0.06, air('lowpass', 1000, 0.6, 0.06)), at(0.06, thump(200, 85, 0.4, 0.06))],
  } },
  bogoReloadReady: { volume: 1.06, vary: VARY, parts: { // both guns cocked
    mech: [crack(2500, 0.5, { q: 1 }), at(0.02, tick(2900, 0.4)), at(0.05, crack(2300, 0.45, { q: 1 }))],
  } },

  // ===== BOX CUTTER (melee): the blade's slider ratcheting out, a quick whoosh, and a thin steel snick. =================
  meleeSwing: { volume: 0.82, maxVoices: 3, send: 0.03, vary: VARY, parts: {
    mech: [tick(2600, 0.35, { q: 6 }), at(0.018, tick(2900, 0.35, { q: 6 })), at(0.04, metal(4200, [1, 1.6], 0.06, 0.03))],
    body: [at(0.02, air('bandpass', 900, 0.55, 0.1, { freqEnd: 2800, q: 1.2, attack: 0.03 }))],
  } },

  // ===== KIOSK SENTRY (Kiosk Kevin's SPIN-O-MATIC staple turret, 5/s; game/equipment/sentry.js plays it a little quieter):
  // a smaller staple clack than the Staple Gun's, and the servo whirring between shots. ===============================
  sentryShot: { volume: 4.12, maxVoices: 3, send: 0.07, vary: VARY, parts: {
    crack: [crack(4000, 0.7, { ms: 1.5, q: 0.9 })],
    body: [thump(360, 200, 0.4, 0.035)],
    mech: [at(0.005, metal(2100, SPRING, 0.1, 0.05)), at(0.03, thump(600, 900, 0.05, 0.06, { wave: 'triangle', attack: 0.01 }))],
  } },

  // The Clearance Rack limited edition (Price Gun): the price tags popping, in the Price Gun's own plastic and ratchet.
  clearanceStamp: { volume: 0.53, maxVoices: 4, send: 0.05, vary: VARY, parts: {
    crack: [crack(1800, 0.6, { q: 1.7 })],
    mech: [at(0.006, tick(2400, 0.35, { q: 6 })), at(0.014, tick(2700, 0.35, { q: 6 })), at(0.03, thump(680, 390, 0.25, 0.1, { wave: 'triangle' }))],
  } },

  // ===== HIT FEEDBACK: short, campy, dry (no room), high enough (2-5 kHz) to cut through a firefight. ====================
  // A shot lands: a quick dry thwack-tick.
  hitBody: { volume: 1.78, duckExempt: true, maxVoices: 3, pitchVariation: 0.08, vary: VARY, parts: {
    crack: [crack(1800, 0.7, { q: 1.2 })],
    body: [thump(200, 90, 0.35, 0.04), air('lowpass', 900, 0.25, 0.03)],
  } },
  // A headshot: a little desk-bell DING on top of the thwack.
  hitHead: { volume: 2.26, duckExempt: true, maxVoices: 3, pitchVariation: 0.02, parts: {
    crack: [crack(3000, 0.5, { ms: 1.5, q: 1 })],
    body: [thump(220, 100, 0.25, 0.04)],
    mech: [metal(2093, BELL, 0.3, 0.22, { partialDecay: 0.6 })],
  } },
  // A kill: the cash register's CHA-CHING (the drawer's ratchet, then the bell).
  killConfirm: { volume: 0.94, duckExempt: true, maxVoices: 3, pitchVariation: 0.02, parts: {
    crack: [air('bandpass', 3500, 0.4, 0.03, { q: 1.5, attack: 0.002 }), at(0.012, tick(3000, 0.3)), at(0.024, tick(3300, 0.3))],
    mech: [at(0.045, metal(2637, [1, 2.0, 2.76, 3.5], 0.35, 0.3, { partialDecay: 0.65 })), at(0.05, metal(3520, [1, 2], 0.15, 0.25))],
  } },
};

// ---- What upgrades do to a shot (audio/recipes.js resolveVariant) ---------------------------------------------------
// A modifier: { volume: x, drive: +x, send: +x, scale: { <part>: { gain, pitch, decay } }, add: { <part>: [layers] } }.
// Added layers are scaled by the recipe's volume like the rest, and stuffings' by its `flavourGain` (lower on automatic guns).
const sheen = (freq, gain, decay) => [metal(freq, [1, 1.5], gain, decay, { attack: 0.002 })];
export const soundUpgrades = {
  tiers: {
    // Each tier sounds a step heavier: a deeper, fuller body, a little more crunch and room; Premium adds a bright steel
    // sheen to the shot, Platinum a brighter one and a sub thump under it.
    deluxe: { volume: 1.04, drive: 0.05, scale: { body: { gain: 1.1, pitch: 0.98 } } },
    premium: { volume: 1.08, drive: 0.1, send: 0.03, scale: { body: { gain: 1.18, pitch: 0.96 } }, add: { sheen: sheen(3100, 0.07, 0.06) } },
    platinum: { volume: 1.12, drive: 0.15, send: 0.05, scale: { body: { gain: 1.25, pitch: 0.94 } },
      add: { sheen: sheen(3700, 0.09, 0.08), sub: [thump(60, 38, 0.35, 0.1)] } },
  },
  // Each Warranty Renewal past Platinum: a touch more body (up to maxRenewals).
  renewal: { volume: 1.01, scale: { body: { gain: 1.02 } } },
  maxRenewals: 5,
  // A Build-A-Blaster build adds its stuffing's flavour to every shot (the stuffing's own proc sound is separate:
  // config/workshop.js stuffings[].sound).
  stuffings: {
    fryerOil: { add: { flavour: [ // a sizzle and a few spitting pops
      at(0.01, air('highpass', 5000, 0.14, 0.22, { attack: 0.005 })),
      ...[0.05, 0.09, 0.14].map((d) => at(d, crack(6000, 0.12, { ms: 1, filter: 'highpass', q: 0.7, vary: { delay: 0.3, gain: 0.4 } }))),
    ] } },
    smoothie: { add: { flavour: [ // a slushy gurgle
      at(0.01, air('bandpass', 900, 0.16, 0.14, { freqEnd: 400, q: 2, attack: 0.01 })),
      at(0.02, fm(180, 0.5, 3, 0.06, 0.1, { indexEnd: 0 })),
    ] } },
    neonTube: { add: { flavour: [ // a mains buzz and a zap
      { type: 'tone', wave: 'sawtooth', freq: 120, gain: 0.06, attack: 0.002, decay: 0.1 },
      at(0.005, fm(2000, 0.13, 8, 0.05, 0.05)),
      air('highpass', 6000, 0.08, 0.04),
    ] } },
    glitter: { add: { flavour: [4186, 5274, 6272].map((f, i) => at(0.02 + i * 0.03, thump(f, f, 0.05, 0.12, { attack: 0.002 }))) } }, // shimmer
    popcornButter: { add: { flavour: [ // two kernels popping
      at(0.03, crack(1500, 0.3, { ms: 3, q: 2 })), at(0.07, crack(1800, 0.25, { ms: 3, q: 2, vary: { delay: 0.3 } })),
      at(0.03, thump(400, 250, 0.08, 0.02)),
    ] } },
    antifreeze: { add: { flavour: [ // an ice tinkle and a crunch of frost
      at(0.02, metal(3500, [1, 2.3, 3.7], 0.07, 0.15)), air('highpass', 7000, 0.08, 0.05),
    ] } },
  },
  // The last few rounds of a magazine (feel.effects.lowAmmoThreshold, as the HUD's red counter): the mechanism sounds
  // lighter and higher (less behind it), and a hollow tick says "nearly empty".
  lowAmmo: { scale: { mech: { gain: 0.6, pitch: 1.08 } }, add: { tick: [at(0.02, tick(1400, 0.25, { q: 8 }))] } },
  // Guns whose magazine is this small or smaller never get the low-ammo sound (the Bottle Rocket's 1, the Return to Sender's 2).
  lowAmmoMinMagazine: 5,
};

// The builders and partial sets above, for tools/auditionPunch.js (the audition's other punch versions).
export const soundKit = { crack, tick, thump, air, metal, fm, at, kick, slap, BAR, SPRING, BELL, PLATE, VARY };
