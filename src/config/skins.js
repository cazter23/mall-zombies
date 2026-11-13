// Each skin belongs to one gun. Slot 1 = Mastery recolours, slot 2 = Role (a recolour plus one printed pattern), slot 3 = Feat (a recolour plus
// one shared glow or motion treatment, skinTreatments below): the base coat under every build and warranty. Slots 4 and 5 are the Closing Time
// REWARDS (closingRewards below): one look that fits every gun, earned once and unlocked on every gun.
// A challenge is data: `kind` picks its counter in game/challenges.js (one entry each there), `count` is what unlocks
// the skin, the other fields are that kind's numbers, and `text` is the locker's sentence ({gun} = the gun's name,
// {anyField} = that field). `needs` names a system the challenge depends on that could be cut (swap the challenge if it is).
//   kills            kills with the gun
//   headshotKills    headshot kills (minDistance: only from this many metres, by the kill's `distance`)
//   rangedKills      kills from minDistance metres or more
//   quickKills       kills where this gun drew first blood and the zombie died within `seconds` (the kill's firstWound)
//   typeKills        kills on zombies whose type id is in `types`
//   bossKills        bosses whose lethal hit was this gun's
//   bankShotKills    kills by a ball that had bounced minBounces times or more (the kill's `bounces`)
//   multiKillShots   shots (a blast, a beam) that each killed minKills or more zombies
//   cleanMagazines   magazines of at least minShots emptied with every shot hitting (a per-run count, saved with the run)
//   stoppedAttacks   zombies shoved out of an attack by a cone gun (the shot's hits[].interrupted)
// Slot 3 FEATS happen inside one run. Their progress is the best attempt (never a sum), and `track` is the challenge tracker's line for the
// attempt in progress ({value} = how it stands, plus any field). Round feats are decided when the round is cleared.
//   loyalty          reach round `count` having never bought, won or fired another gun (progress = the round reached)
//   soloBoss         finish a boss (in round minRound or later) that nothing but this gun ever hurt (the kill's woundedBy)
//   roundKills       `count` kills with the gun inside one round
//   headshotRound    a cleared round from minRound on in which every kill was a headshot kill with this gun
//   mascotFinish     finish a Mascot within maxBlasts blasts of the gun after its helmet comes off, nothing else hurting it in between
//   headshotStreak   `count` headshot kills in a row with the gun; a hit with it anywhere but the head starts again
//   bossKillsInRun   `count` bosses finished with the gun in one run
//   perfectRound     a cleared round in which the gun fired minShots times or more and every shot hit
//   calmRound        a cleared round from minRound on without being hurt, having blown minStopped zombies out of an attack with the gun
//   ballKills        `count` kills by one ball of the gun (the kill's projectile)
//   finishType       finish a zombie whose type id is in `types` with the gun
//   closingWin       (slots 4 and 5, shared by every gun) win the Closing Time shift in one of `modes` (the run summary's closingMode)
// Phase 8 (tools/challengeReport.mjs): a gun carried as the main gun clears 300 to 350 zombies in a run to round 15 and 530 to 580 by round 20,
// so 1000 is about three runs to round 15 (the plan's "three to five runs"). Return to Sender is rarer (the claw, or 10,000 at the Returns Desk).
const mastery = count => ({ kind: 'kills', count, text: 'Clear {count} zombies with the {gun} across all shifts.' });

export const skins = {
  stapleGun: [{
    id: 'night-shift', name: 'Night Shift', slot: 1,
    palette: { body: 0x303e74, dark: 0x202846, metal: 0x8294aa, grip: 0x292b36, accent: 0xbfcce1, sight: 0xf8e1a3 },
    challenge: mastery(1000),
  }, {
    id: 'interoffice', name: 'Interoffice', slot: 2,
    palette: { body: 0x4a10b8, dark: 0x2c0a6e, metal: 0xb8b0d8, grip: 0x1e1830, accent: 0xf2ecff, sight: 0xffe39a },
    pattern: { kind: 'lines', ink: 0xd9d2ff, spacing: 0.009, width: 0.0012, margin: { color: 0xff6f8a, width: 0.0016, offset: 0.03, every: 0.16 } }, // ruled memo paper
    challenge: { kind: 'headshotKills', count: 100, text: 'Land {count} headshot kills with the {gun}.' },
  }, {
    id: 'company-man', name: 'Company Man', slot: 3,
    palette: { body: 0xeadcb6, dark: 0x5a4632, metal: 0xb59a62, grip: 0x3a2c22, accent: 0xd99a1e, sight: 0xffe39a },
    treatment: { kind: 'pulse', role: 'accent', color: 0xffb43a, low: 0.08, high: 0.4, period: 2.4 }, // a service pin catching the light
    challenge: { kind: 'loyalty', count: 12, track: 'Round {value} / {count}', // (even an immortal bot on the Staple Gun alone stalls at rounds 8 to 10)
      text: 'Reach round {count} without buying, winning or firing any gun but the {gun}.' },
  }],
  rivetRifle: [{
    id: 'carbon-copy', name: 'Carbon Copy', slot: 1,
    palette: { body: 0x353f42, dark: 0x242a30, metal: 0x8797a5, grip: 0x20242a, accent: 0x7086a0, sight: 0xe9eb9b },
    challenge: mastery(1000),
  }, {
    id: 'hard-hat-area', name: 'Hard Hat Area', slot: 2,
    palette: { body: 0x7a2000, dark: 0x461400, metal: 0xd2c2b2, grip: 0x221a16, accent: 0xffcc2e, sight: 0xfff2a0 },
    pattern: { kind: 'stripes', ink: 0xffcc2e, spacing: 0.03, width: 0.014, angle: 45 }, // hazard tape
    challenge: { kind: 'headshotKills', count: 150, minDistance: 10, text: 'Land {count} headshot kills from {minDistance} m or more with the {gun}.' },
  }, {
    id: 'gold-standard', name: 'Gold Standard', slot: 3,
    palette: { body: 0xd6a83a, dark: 0x4a3410, metal: 0xf0dca0, grip: 0x2a2014, accent: 0x7a1e14, sight: 0xfff2a0 },
    treatment: { kind: 'shimmer', role: 'body', color: 0xffe08a, low: 0, high: 0.38, period: 3.2, width: 0.22 }, // light running down polished brass
    challenge: { kind: 'headshotStreak', count: 15, track: '{value} / {count} in a row', // (a bot aiming every shot at the head: best 14)
      text: 'Land {count} headshot kills in a row with the {gun}, without a single hit anywhere else.' },
  }],
  priceGun: [{ id: 'red-tag', name: 'Red Tag', slot: 1,
    palette: { body: 0x612635, dark: 0x311922, metal: 0xb0a3aa, grip: 0x241c24, accent: 0xf6adbd, sight: 0xffe3a1, ammo: 0xf8ecd9 }, challenge: mastery(1000) }, {
    id: 'doorbuster', name: 'Doorbuster', slot: 2,
    palette: { body: 0x880812, dark: 0x4e050c, metal: 0xd7b8b8, grip: 0x24141a, accent: 0xffd84a, sight: 0xfff0a0, ammo: 0xfff4c8 },
    pattern: { kind: 'text', ink: 0xffd84a, words: ['% OFF', 'SALE'], font: 'clearance', height: 0.011, wordSpacing: 0.05, rowSpacing: 0.02 }, // sale banners
    challenge: { kind: 'quickKills', count: 400, seconds: 1, // (150 fell in one run to round 15 without trying: 176)
      text: 'Mark down {count} zombies from full price to nothing in {seconds} second or less with the {gun}.' },
  }, {
    id: 'final-markdown', name: 'Final Markdown', slot: 3,
    palette: { body: 0xffd23c, dark: 0x8a1410, metal: 0xf2e2c0, grip: 0x2a1614, accent: 0xe8202a, sight: 0xfff0a0, ammo: 0xfff4c8 },
    treatment: { kind: 'pulse', role: 'accent', color: 0xff3a30, low: 0.05, high: 0.42, period: 1.1 }, // a flashing sale sign
    challenge: { kind: 'soloBoss', count: 1, minRound: 9, track: 'Boss: {gun} only', // (any boss fell by accident: Murray, rounds 5 to 7)
      text: 'Finish a boss from round {minRound} on that nothing but the {gun} has hurt.' },
  }],
  nailGun: [{ id: 'aftermarket', name: 'Aftermarket', slot: 1,
    palette: { body: 0x393e35, dark: 0x20271f, metal: 0xaab4a0, grip: 0x24241d, accent: 0xe7b36b, sight: 0xf7e1a0 }, challenge: mastery(1000) }, {
    id: 'measure-twice', name: 'Measure Twice', slot: 2,
    palette: { body: 0x1a26c0, dark: 0x101878, metal: 0xc6d0ea, grip: 0x161a2e, accent: 0xe8f0ff, sight: 0xfff0a8 },
    pattern: { kind: 'grid', ink: 0xbcd4ff, spacing: 0.008, width: 0.0006, majorEvery: 5, majorWidth: 0.0015 }, // blueprint paper
    challenge: { kind: 'cleanMagazines', count: 25, minShots: 10,
      text: 'Empty {count} magazines of the {gun} ({minShots} nails or more) without a single nail missing.' },
  }, {
    id: 'rush-order', name: 'Rush Order', slot: 3,
    palette: { body: 0xff8c22, dark: 0x2a2622, metal: 0xd8d2c8, grip: 0x1e1c1a, accent: 0xfff0b8, sight: 0xfff0a8 },
    treatment: { kind: 'edgeGlow', role: 'dark', color: 0xff6a1a, low: 0.18, high: 0.34, period: 0.9 }, // a hot, ticking motor
    challenge: { kind: 'roundKills', count: 50, track: '{value} / {count} this round', // (40 fell by accident about round 16; 50 needs round 20 with every kill)
      text: 'Clear {count} zombies with the {gun} in one round.' },
  }],
  foamDartBlaster: [{ id: 'blue-ribbon', name: 'Blue Ribbon', slot: 1,
    palette: { body: 0x243c68, dark: 0x19243e, metal: 0x9bb7d8, grip: 0x202736, accent: 0xc7dcff, sight: 0xffe6a4, ammo: 0x9dd4f5 }, challenge: mastery(1000) }, {
    id: 'aisle-fifteen', name: 'Aisle Fifteen', slot: 2,
    palette: { body: 0x064a50, dark: 0x03292d, metal: 0xa8d4d4, grip: 0x14242a, accent: 0x9ff2ee, sight: 0xffe9a8 },
    pattern: { kind: 'dots', ink: 0x9ff2ee, spacing: 0.012, radius: 0.0034 }, // halftone dots
    challenge: { kind: 'rangedKills', count: 150, minDistance: 15, text: 'Clear {count} zombies from {minDistance} m or more with the {gun}.' },
  }, {
    id: 'bullseye', name: 'Bullseye', slot: 3,
    palette: { body: 0xf0eee8, dark: 0x22324a, metal: 0xb8c4d4, grip: 0x1c2232, accent: 0xe02a3a, sight: 0xffe9a8, ammo: 0xff5a64 },
    treatment: { kind: 'pulse', role: 'accent', color: 0xff3048, low: 0.06, high: 0.4, period: 1.8 }, // a target's red ring
    challenge: { kind: 'headshotRound', count: 1, minRound: 12, track: '{value} headshot kills, nothing else',
      text: 'Clear a whole round from round {minRound} on with every kill a {gun} headshot.' },
  }],
  confettiCannon: [{ id: 'encore', name: 'Encore', slot: 1,
    palette: { body: 0x512753, dark: 0x2c1a30, metal: 0xb1a0be, grip: 0x241b2b, accent: 0xe9b5f2, sight: 0xffe7ad, ammo: 0xf2ddaf }, challenge: mastery(1000) }, {
    id: 'party-size', name: 'Party Size', slot: 2,
    palette: { body: 0x7a0866, dark: 0x44043a, metal: 0xe0b8d8, grip: 0x26141f, accent: 0xffc0ec, sight: 0xfff0b0 },
    pattern: { kind: 'confetti', colors: [0xffe066, 0x7fe3ff, 0xffffff, 0xff9ad5, 0x9dff9a], perSquareMetre: 9000, minSize: 0.004, maxSize: 0.008, seed: 11 },
    challenge: { kind: 'multiKillShots', count: 40, minKills: 3, text: 'Fire {count} blasts of the {gun} that each clear {minKills} or more zombies.' },
  }, {
    id: 'grand-opening', name: 'Grand Opening', slot: 3,
    palette: { body: 0xffa6d4, dark: 0x5a1a4a, metal: 0xf2d8ea, grip: 0x2a1626, accent: 0xffe066, sight: 0xfff0b0 },
    treatment: { kind: 'drift', role: 'body', colors: [0xff5ab4, 0xffd23a, 0x5ad2ff, 0x9aff6a], low: 0.12, high: 0.3, period: 9 }, // party lights
    challenge: { kind: 'mascotFinish', count: 1, maxBlasts: 1, track: 'Mascot finishers {value} / {count}',
      text: 'Finish a Mascot with one blast of the {gun} after its helmet comes off.' },
  }],
  coilNailer: [{ id: 'factory-finish', name: 'Factory Finish', slot: 1,
    palette: { body: 0x38454a, dark: 0x202c32, metal: 0xb1c1ca, grip: 0x202428, accent: 0xddb480, sight: 0xf8e0a0 }, challenge: mastery(1000) }, {
    id: 'loading-dock', name: 'Loading Dock', slot: 2,
    palette: { body: 0x0a4a1e, dark: 0x052a10, metal: 0xc0d4c4, grip: 0x161f19, accent: 0xf4d35e, sight: 0xfff0a0 },
    pattern: { kind: 'tread', ink: 0xa9d4b4, spacing: 0.014, length: 0.009, width: 0.0026 }, // diamond plate
    challenge: { kind: 'typeKills', count: 100, types: ['mascot', 'cartPusher'], text: 'Clear {count} Mascots or Cart Pushers with the {gun}.' },
  }, {
    id: 'double-shift', name: 'Double Shift', slot: 3,
    palette: { body: 0x48c4b0, dark: 0x103a36, metal: 0xd4ece6, grip: 0x14201e, accent: 0xf4d35e, sight: 0xfff0a0 },
    treatment: { kind: 'edgeGlow', role: 'dark', color: 0x3affd8, low: 0.16, high: 0.32, period: 2.6 }, // a night-shift neon
    challenge: { kind: 'bossKillsInRun', count: 4, track: '{value} / {count} bosses', // (2 fell by accident by round 15; a main gun had 3.7 by round 20)
      text: 'Finish {count} bosses with the {gun} in one shift.' },
  }],
  barcodeScanner: [{ id: 'black-label', name: 'Black Label', slot: 1,
    palette: { body: 0x292636, dark: 0x171723, metal: 0xa8a2bb, grip: 0x201e29, accent: 0xd9b5de, sight: 0xc8f3b0, emitter: 0xf391b3 }, challenge: mastery(1000) }, {
    id: 'express-lane', name: 'Express Lane', slot: 2,
    palette: { body: 0x0c3a9a, dark: 0x07225c, metal: 0xc8d6f0, grip: 0x161b2a, accent: 0xf4f8ff, sight: 0xc8f3b0 },
    pattern: { kind: 'checker', ink: 0xf4f8ff, size: 0.008 }, // checkered flag
    challenge: { kind: 'multiKillShots', count: 40, minKills: 2, text: 'Fire {count} beams of the {gun} that each clear {minKills} or more zombies.' },
  }, {
    id: 'clean-scan', name: 'Clean Scan', slot: 3,
    palette: { body: 0xaaf0c8, dark: 0x163a2a, metal: 0xe0f4ea, grip: 0x14221c, accent: 0xff4a6a, sight: 0xff8aa0, emitter: 0xff4a6a },
    treatment: { kind: 'shimmer', role: 'body', color: 0x6affb0, low: 0, high: 0.32, period: 1.6, width: 0.16 }, // a scan line sweeping the gun
    challenge: { kind: 'perfectRound', count: 1, minShots: 25, track: '{value} / {minShots} shots, no misses',
      text: 'Clear a round having fired the {gun} {minShots} times or more without a single miss.' },
  }],
  leafBlower: [{ id: 'autumn-gold', name: 'Autumn Gold', slot: 1,
    palette: { body: 0x51402b, dark: 0x2d281e, metal: 0xbeb099, grip: 0x27231d, accent: 0xedc77f, sight: 0xffefb0 }, challenge: mastery(1000) }, {
    id: 'lawn-and-garden', name: 'Lawn & Garden', slot: 2,
    palette: { body: 0x2f4a06, dark: 0x1a2a03, metal: 0xd0d4b8, grip: 0x1e2116, accent: 0xfff4cc, sight: 0xfff0b0 },
    pattern: { kind: 'gingham', ink: 0xfff4cc, size: 0.011, alpha: 0.45 }, // picnic blanket
    challenge: { kind: 'stoppedAttacks', count: 100, needs: ['claw'], text: 'Blow {count} zombies out of an attack with the {gun}.' },
  }, {
    id: 'still-air', name: 'Still Air', slot: 3,
    palette: { body: 0xbfe2f2, dark: 0x1e3a4a, metal: 0xe6f2f8, grip: 0x18242c, accent: 0xffffff, sight: 0xfff0b0 },
    treatment: { kind: 'drift', role: 'body', colors: [0x8ad4ff, 0xd2b4ff, 0xb4ffe6], low: 0.1, high: 0.24, period: 12 }, // a calm sky
    challenge: { kind: 'calmRound', count: 1, minRound: 8, minStopped: 10, needs: ['claw'], track: '{value} / {minStopped} stopped, unhurt',
      text: 'Clear a round from round {minRound} on without taking a hit, blowing {minStopped} zombies out of an attack with the {gun}.' },
  }],
  tennisBallLauncher: [{ id: 'centre-court', name: 'Centre Court', slot: 1,
    palette: { body: 0x244838, dark: 0x192e26, metal: 0xa4bdb4, grip: 0x1c2723, accent: 0xe0e5c4, sight: 0xffe6a3, ammo: 0xe2ed91, glass: 0xc7e6d7 }, challenge: mastery(1000) }, {
    id: 'country-club', name: 'Country Club', slot: 2,
    palette: { body: 0x5a0a9a, dark: 0x34065a, metal: 0xd6c8e6, grip: 0x1e1828, accent: 0xd8f0a0, sight: 0xffe6a3 },
    pattern: { kind: 'argyle', ink: 0xf4f4e6, ink2: 0x2f8a46, width: 0.024, height: 0.036, line: 0.0012 }, // clubhouse sweater
    challenge: { kind: 'bankShotKills', count: 60, minBounces: 1, needs: ['claw'],
      text: 'Clear {count} zombies with a {gun} ball that had already bounced.' },
  }, {
    id: 'hat-trick', name: 'Hat Trick', slot: 3,
    palette: { body: 0xdff04a, dark: 0x2a3a12, metal: 0xf2f6d8, grip: 0x1c2214, accent: 0xffffff, sight: 0xffe6a3, ammo: 0xfff4a0 },
    treatment: { kind: 'pulse', role: 'accent', color: 0xf4ff9a, low: 0.06, high: 0.36, period: 1.4 }, // floodlit court lines
    challenge: { kind: 'ballKills', count: 3, needs: ['claw'], track: '{value} / {count} with one ball',
      text: 'Clear {count} zombies with a single {gun} ball.' },
  }],
  returnToSender: [{ id: 'final-notice', name: 'Final Notice', slot: 1,
    palette: { body: 0x492c3c, dark: 0x291d29, metal: 0xbba9ba, grip: 0x241c26, accent: 0xefb0c4, sight: 0xffe7a7, emitter: 0xf8c3d2, screen: 0xcdebc0 }, challenge: mastery(300) }, {
    id: 'handle-with-care', name: 'Handle With Care', slot: 2,
    palette: { body: 0x6a1a08, dark: 0x3c0e04, metal: 0xdcc8b8, grip: 0x24170f, accent: 0xf2e1b8, sight: 0xffe7a7 },
    pattern: { kind: 'text', ink: 0xf2e1b8, words: ['FRAGILE', 'THIS WAY UP'], font: 'stencil', height: 0.011, wordSpacing: 0.075, rowSpacing: 0.02 }, // parcel tape
    challenge: { kind: 'bossKills', count: 5, needs: ['claw'], text: 'Finish {count} bosses with a beam from the {gun}.' },
  }, {
    id: 'final-sale', name: 'Final Sale', slot: 3,
    palette: { body: 0xf4ece0, dark: 0x4a0e1e, metal: 0xe8d8d0, grip: 0x24121a, accent: 0xd81e4a, sight: 0xffe7a7, emitter: 0xff6a8a, screen: 0xffd0da },
    treatment: { kind: 'edgeGlow', role: 'dark', color: 0xff2a5a, low: 0.2, high: 0.4, period: 3 }, // a stamped red border, faintly lit
    challenge: { kind: 'finishType', count: 1, types: ['lastCustomer'], needs: ['claw', 'closingTime'], track: 'Last Customer returned {value} / {count}',
      text: 'Return the Last Customer with the {gun}.' },
  }],
  stargazer: [{ id: 'midnight-sky', name: 'Midnight Sky', slot: 1,
    palette: { body: 0x2c3044, dark: 0x0a0c1c, metal: 0x9aa3c0, grip: 0x2c2230, accent: 0xc9d4ff, sight: 0xffe58a, glass: 0xa98bff }, // (muted: the role skin is the saturated one)
    challenge: mastery(1000) }, {
    id: 'constellation', name: 'Constellation', slot: 2,
    palette: { body: 0x1a2a6b, dark: 0x0d1433, metal: 0xc7cde0, grip: 0x3a2618, accent: 0xffe08a, sight: 0xffe58a },
    pattern: { kind: 'dots', ink: 0xfff4c4, spacing: 0.017, radius: 0.0016 }, // a night sky of pinprick stars
    challenge: { kind: 'headshotKills', count: 150, minDistance: 25, needs: ['claw'],
      text: 'Land {count} headshot kills from {minDistance} m or more with the {gun}.' },
  }, {
    id: 'supernova', name: 'Supernova', slot: 3,
    palette: { body: 0xf4f0ff, dark: 0x241a3a, metal: 0xe6e2f4, grip: 0x1c1626, accent: 0xff9a3c, sight: 0xffe58a, glass: 0xffb36a },
    treatment: { kind: 'pulse', role: 'accent', color: 0xffb04a, low: 0.08, high: 0.45, period: 2.8 }, // a star flaring and settling
    challenge: { kind: 'perfectRound', count: 1, minShots: 15, needs: ['claw'], track: '{value} / {minShots} shots, no misses',
      text: 'Clear a round having fired the {gun} {minShots} times or more without a single miss.' },
  }],
  bottleRocket: [{ id: 'grand-finale', name: 'Grand Finale', slot: 1,
    palette: { body: 0x3a3448, dark: 0x141024, metal: 0xb8b4d0, grip: 0x1c1a26, accent: 0xffd23f, sight: 0xff5ec8, ammo: 0xff3b3b }, // (muted: the role skin is the saturated one)
    challenge: mastery(1000) }, {
    id: 'long-fuse', name: 'Long Fuse', slot: 2,
    palette: { body: 0xc8283a, dark: 0x1e2a5c, metal: 0xc8ccd8, grip: 0x232733, accent: 0xf4f1e8, sight: 0xffd23f },
    pattern: { kind: 'stripes', ink: 0xf4f1e8, spacing: 0.03, width: 0.012, angle: 30 }, // a firework wrapper's candy stripe
    challenge: { kind: 'rangedKills', count: 200, minDistance: 12, needs: ['claw'], text: 'Clear {count} zombies from {minDistance} m or more with the {gun}.' },
  }, {
    id: 'sparkler', name: 'Sparkler', slot: 3,
    palette: { body: 0x1a1a22, dark: 0x0e0e14, metal: 0xd8d4e0, grip: 0x141418, accent: 0xffb02e, sight: 0xfff0a8, ammo: 0xffd23f },
    treatment: { kind: 'pulse', role: 'accent', color: 0xffc04a, low: 0.06, high: 0.4, period: 0.7 }, // a lit fuse fizzing
    challenge: { kind: 'roundKills', count: 40, needs: ['claw'], track: '{value} / {count} this round',
      text: 'Clear {count} zombies with the {gun} in one round.' },
  }],
  balloonLauncher: [{ id: 'birthday-party', name: 'Birthday Party', slot: 1,
    palette: { body: 0xff8fc8, dark: 0x3a1a34, metal: 0xf0e4ec, grip: 0x2a1a28, accent: 0x3ad1ff, sight: 0xffd23f, ammo: 0x3ad1ff },
    challenge: mastery(1000) }, {
    id: 'polka-dot', name: 'Polka Dot', slot: 2,
    palette: { body: 0xffd23f, dark: 0x3a2a10, metal: 0xf4ecd8, grip: 0x2a2014, accent: 0xff3b3b, sight: 0xff5ec8, ammo: 0xff3b3b },
    pattern: { kind: 'dots', ink: 0xff3b3b, spacing: 0.02, radius: 0.005 }, // party-bag polka dots
    challenge: { kind: 'typeKills', count: 100, types: ['shoplifter'], needs: ['claw'], text: 'Clear {count} Shoplifters with the {gun}.' }, // (was Mall Walkers: they left the waves)
  }, {
    id: 'helium-high', name: 'Helium High', slot: 3,
    palette: { body: 0xb8f0ff, dark: 0x1c2c44, metal: 0xeef6fa, grip: 0x18202c, accent: 0xa070ff, sight: 0xffd23f, ammo: 0xa070ff },
    treatment: { kind: 'drift', role: 'accent', colors: [0xff5ec8, 0x3ad1ff, 0xffd23f], low: 0.1, high: 0.3, period: 5 }, // a bunch of balloons catching the light
    challenge: { kind: 'soloBoss', count: 1, minRound: 9, needs: ['claw'], track: 'Boss: {gun} only',
      text: 'Finish a boss from round {minRound} on that nothing but the {gun} has hurt.' },
  }],
};

// --- The Closing Time rewards (plan: "The Closing Time rewards"). ONE look that fits every gun, so a win unlocks it on every gun at once
// (game/challenges.js: kind 'closingWin', announced once, not once a gun). Palettes use the shared roles only: a gun's own extra roles
// (emitter, screen, ammo, glass) keep that gun's colours. They add no stat, price or sound, like every skin.
//   Employee of the Month  polished brass, a dark grip and a name badge on the left face (weapons/models/skinBadge.js). Any win.
//   After Hours            near-black with sunset-coloured trims that glow and slowly change (a 'drift' treatment). A win on Classic,
//                          which also unlocks Employee of the Month ("better" = more striking, and both; nothing that affects play).
// A win counts when the shift is won (the van), whether you then clock out, stay for overtime or die. Not on a debug-assisted run.
export const closingRewards = [{
  id: 'employee-of-the-month', name: 'Employee of the Month', slot: 4, shared: true,
  palette: { body: 0xc6993a, dark: 0x6b4f1c, metal: 0xe9dcae, grip: 0x2a1d17, accent: 0xa8312b, sight: 0xffe7a3 },
  badge: { plate: 0xf3e9cf, stripe: 0xb4322c, ink: 0x2b2420 },
  challenge: { kind: 'closingWin', count: 1, modes: ['directed', 'classic'], track: 'Win the shift',
    text: 'Win the Closing Time shift, in any run mode.' },
}, {
  id: 'after-hours', name: 'After Hours', slot: 5, shared: true,
  palette: { body: 0x17141f, dark: 0x2b1a42, metal: 0x4b4560, grip: 0x0f0d15, accent: 0xff5e8c, sight: 0xffb56e },
  treatment: { kind: 'drift', role: 'dark', colors: [0xff7a3a, 0xff3d7f, 0x9a5cff], low: 0.15, high: 0.42, period: 7 }, // a sunset along the trims
  challenge: { kind: 'closingWin', count: 1, modes: ['classic'], track: 'Win on Classic',
    text: 'Win the Closing Time shift on Classic: no checklist, no key markers. Also unlocks Employee of the Month.' },
}];
// Each gun's list ends with the rewards (its own copy: nothing shares a skin object between guns).
for (const list of Object.values(skins)) for (const reward of closingRewards) list.push(structuredClone(reward));

/** The locker's sentence for a challenge, from its own data ({gun} and {field} filled in). */
export function challengeText(challenge, gunName) {
  return challenge.text.replace(/\{(\w+)\}/g, (_, key) => (key === 'gun' ? gunName : String(challenge[key])));
}

export function gunSkin(gunId, skinId) {
  return Object.hasOwn(skins, gunId) ? skins[gunId].find((skin) => skin.id === skinId) : undefined;
}

export const skinDebug = {
  usage: "Use g.debug.run('skin', gunId, skinId) or pass 'default' to clear it",
  unknownGun: 'No skins for that gun',
  unknownSkin: 'No such skin for that gun',
  equipped: (gun, skin) => `${gun}: wearing ${skin}`,
  cleared: (gun) => `${gun}: default colours`,
};

export const skinStorage = { key: 'sunsetGalleria.skins', version: 1 };

export const skinNotices = {
  toastSeconds: 6,
  toastTitle: 'Skin unlocked',
  toastText: (gunName, skinName) => `${skinName} · ${gunName}`,
  toastShared: skinName => `${skinName} · every gun`, // a Closing Time reward (one notice for every gun)
  sharedPa: skinName => ({
    kicker: 'Closing time commendation',
    text: `Attention associates. Thank you for closing. ${skinName} is now yours, for every piece of equipment in the building.`,
  }),
  // slot 1 = a mastery skin, slot 2 = a role skin, slot 3 = a feat skin
  pa: (gunName, skinName, slot = 1) => (slot === 3 ? {
    kicker: 'Employee commendation',
    text: `Attention associates. A commendation for outstanding work with the ${gunName}. ${skinName} is now yours.`,
  } : slot === 2 ? {
    kicker: 'Performance review passed',
    text: `Attention associates. ${gunName} performance review passed. ${skinName} is now yours.`,
  } : {
    kicker: 'Mastery certified',
    text: `Attention associates. ${gunName} mastery certified. ${skinName} is now yours.`,
  }),
};

export const challengeDebug = {
  usage: "Use g.debug.run('challenge', gunId, skinId, 'add', amount), 'complete', or 'clear'",
  unknownChallenge: 'No such challenge for that gun',
  invalidAmount: 'Progress must be a positive whole number',
  unavailable: 'This game has no challenges',
  changed: (skin, count, needed) => `${skin}: ${count} / ${needed}`,
  cleared: (skin) => `${skin}: progress cleared and skin locked`,
};

// Minimum WCAG relative-luminance ratio for body paint against stuffings and warranty tiers.
// (With today's six stuffings and four tiers this caps every body at luminance 0.0585: the darkest of them, the Standard tier,
// is 0.167, and the lightest, Popcorn Butter, 0.882, leaves no room above. Pattern skins are deep SATURATED colours for that reason.)
export const skinContrast = { minimum: 2 };

// Printed patterns (slot 2 skins; weapons/models/skinPattern.js). One canvas per skin (and layout), made the first time it is worn and shared by
// the gun in hand, the locker preview and the conveyor. The canvas is size wide and twice that tall: an upper region for faces pointing up or
// right, a lower one for faces pointing left (the side you see in your hands), each `metres` of gun across, centred on the gun's body; its
// top `blankFraction` stays body colour for every other face. faceDot = how squarely a face must point that way; leftLimit = a top face may
// lean left no more than this. keepOut: on the left face, a box this many metres either side of each named mount is painted plain, so the
// build patch and the warranty seal (both at the sticker mount) always sit on plain paint. A face already carrying a texture (the brand
// label) is never printed. A skin's `pattern`: { kind, ink, ...that kind's numbers in metres }. Kinds: lines, grid, dots, stripes, checker,
// gingham, confetti, tread, argyle, text (fonts from config/fonts.js).
export const skinPatterns = {
  size: 512, metres: 0.8, blankFraction: 0.06, faceDot: 0.6, leftLimit: -0.2, anisotropy: 4,
  keepOut: { mounts: ['sticker'], halfLength: 0.036, halfHeight: 0.026 },
};

// The Employee of the Month name badge (weapons/models/skinBadge.js): one small plate, one draw call, laid flat on the gun's left face beside
// the sticker mount (where the build patch and the warranty seal sit). It is tried at each of `tries` ([metres along the gun toward the back,
// metres up] from that mount, in this order); a ray from the left finds the face, and the plate goes where the first-hit surface is within
// `tolerance` of the mount's own x. A gun with no such spot goes without (a hand or an arm in the way is never mistaken for the face).
export const skinBadges = {
  size: [0.003, 0.02, 0.036], // metres: how far it stands off the face, its height, its length along the gun
  tries: [[0.056, 0], [-0.056, 0], [0.112, 0], [-0.112, 0], [0, 0.042], [0, -0.042], [0.056, 0.042], [-0.056, 0.042], [0.056, -0.042], [-0.056, -0.042]],
  tolerance: 0.012, rayStart: 0.3,
  canvas: { width: 72, height: 40, stripe: 0.36, lines: 2 }, // the printed plate (a name tag: a coloured top band and two ruled lines)
};

// Glow and motion treatments (slot 3 skins; weapons/models/skinTreatments.js). Emissive light on the meshes painted in one palette ROLE
// (body, dark, accent...), animated from the model's own animate(); no lights, no textures, no draw calls. A skin's `treatment`:
//   { kind, role, color | colors, low, high, period, ...that kind's numbers }: the glow swings between low and high (emissive intensity)
//   once per `period` seconds.
//   pulse      the role breathes, all together (a smooth sine)
//   edgeGlow   a steady glow with a slight flicker of `high - low` (trims and edges: use role 'dark')
//   shimmer    a band of light runs from the back of the gun to the muzzle; width = the band's share of the gun's length
//   drift      the glow's colour wanders through `colors`, one after another, over `period` seconds each
// maxGlow: no treatment may glow brighter than this share of full, unlit colour (its brightest channel x high). The build's seam is
// drawn unlit at full colour, so a treatment always stays clearly dimmer than a glowing seam (plan: "dimmer than a glowing seam").
export const skinTreatments = { maxGlow: 0.45 };

export const locker = {
  title: 'Associate locker', menu: 'Weapon locker', kicker: 'Personnel · Approved self-expression',
  form: 'SG / PROPERTY · FORM 11-C', guns: 'Issued equipment', skins: 'Approved finishes',
  defaultName: 'Default', defaultDescription: 'Factory issue. No paperwork required.',
  back: 'Back', locked: 'Locked', equipped: 'Equipped', available: 'Equip',
  hint: 'Arrow keys / D-pad to browse · Enter / A to equip · Escape / B to return',
  previewLabel: 'Gun finish preview',
  theme: { ink: '#302b30', paper: '#f4ead7', edge: '#b8a98e', stamp: '#9a3f53', selected: '#e8d9c1', highlight: '#93556a', lockedPaper: '#dedbd4', lockedInk: '#625e59' },
  progress: (count, needed) => count + ' / ' + needed,
  // A feat (slot 3) or a reward (slots 4 and 5) shows its best attempt; a one-off shows whether it is done.
  featProgress: (count, needed) => (needed === 1 ? (count >= 1 ? 'Done' : 'Not yet') : 'Best ' + count + ' / ' + needed),
  receiptLabel: 'Skins unlocked',
  receiptNames: names => names.join(' · '),
  preview: {
    width: 520, height: 320, pixelRatio: 1.5, background: 0x211c2b,
    fov: 35, near: 0.01, far: 20, framing: 1.45, rotationSpeed: 0.22,
    pitch: -0.12, initialYaw: -0.6, camera: [1, 0.65, 1.6],
    sky: 0xfff0d8, ground: 0x655474, ambientIntensity: 2,
    key: 0xffffff, keyIntensity: 3, keyPosition: [2, 3, 2],
  },
};
