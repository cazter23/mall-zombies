// =============================================================================
// ENVIRONMENTAL HAZARDS (docs/archive/hazards-plan.md): pay-to-trigger mall traps with cooldowns.
// Every tunable number and player-facing prompt string for hazards lives here; base prices
// live in config/economy.js (`economy.hazards`) and are read through `g.pricing.priceOf('hazard', id)`.
// Switch models: game/features/hazardSwitches.js (one style per hazard, `switchStyle` below).
// =============================================================================

export const hazards = {
  // Status words shown on the interaction prompt when a switch cannot be triggered yet.
  status: {
    active: 'Active',
    cooldown: 'Recharging',
  },

  // What every switch shares: its status lamp (green ready, a blinking active colour while it runs, amber while it
  // recharges) and a recharge strip under it (full when ready, runs down while active, refills over the cooldown).
  switchStatus: {
    readyColor: 0x38e078,
    activeColor: 0x5ceeff,
    activeBlinkColor: 0xffffff,
    cooldownColor: 0xd9822b,
    stripBackColor: 0x15181c,
    activeBlinkHz: 2, // (slow: a soft pulse, not a strobe)
    sparkColors: [0x6cf6ff, 0xffffff, 0xffd23f], // the burst off the switch as it is thrown
    sparkCount: 12,
    flashSize: 1.1,
    flashSeconds: 0.15,
  },

  // The Electrified Fountain's industrial breaker box (style 'breaker').
  switchBox: {
    width: 0.38,
    height: 0.48,
    depth: 0.16,
    postWidth: 0.09,
    cabinetColor: 0x2f363d,
    trimColor: 0xf4b41a,
    stripeDarkColor: 0x181b1f,
    meterBgColor: 0xeae6df,
    needleColor: 0xd93829,
    handleColor: 0xd93829,
    metalColor: 0x9aa4ad,
    strip: { x: 0, y: -0.135, width: 0.28, height: 0.025 },
    handleAngles: { ready: -0.35, active: 2.15, cooldown: 0.45 },
    needleAngles: { ready: 0.55, active: -0.65, cooldown: 0.25 },
  },

  // The Fire Sprinklers' wall pull station with a horn/strobe above it (style 'firePull'). The strobe lens is its lamp.
  firePull: {
    width: 0.2,
    height: 0.28,
    depth: 0.07,
    bodyColor: 0xd6262b,
    bezelColor: 0x9c1a1e,
    bandColor: 0xf6f2ea,
    handleColor: 0xf6f2ea,
    handlePulledAngle: 0.95,
    strobe: { y: 0.27, width: 0.14, height: 0.09, depth: 0.06, housingColor: 0xf1ede4, grilleColor: 0x9c1a1e },
    strip: { x: 0, y: -0.105, width: 0.14, height: 0.02 },
  },

  // The Fryer Blast's gas-line valve on a riser pipe (style 'valve'): the red handwheel spins while it vents.
  valve: {
    pipeRadius: 0.045,
    pipeColor: 0x666b72,
    collarColor: 0xf4b41a,
    collarDarkColor: 0x181b1f,
    flangeRadius: 0.09,
    body: { width: 0.17, height: 0.16, depth: 0.12, color: 0xb08a3a },
    wheel: { radius: 0.14, tube: 0.022, z: 0.075, color: 0xc8302a, spinPerSecond: 7 },
    gauge: { y: 0.2, radius: 0.065, depth: 0.03, faceColor: 0xf4efe4, rimColor: 0x8e949b, needleColor: 0xd93829 },
    needleAngles: { ready: 0.9, active: -0.9, cooldown: 0.1 },
    lamp: { y: 0.3, size: 0.05 },
    strip: { x: 0, y: -0.2, width: 0.14, height: 0.022 }, // on a clamp plate on the riser, under the wheel
  },

  // The PA System Lure's paging panel (style 'paging'): ALL CALL button, speaker grille, gooseneck mic, ON AIR lamp.
  paging: {
    width: 0.3,
    height: 0.4,
    depth: 0.08,
    housingColor: 0xd9d1bd,
    grilleColor: 0x2b2f35,
    plateColor: 0xf4b41a,
    buttonColor: 0xd8312b,
    micColor: 0x24272c,
    buttonPress: 0.012,
    micLean: 0.55,
    lamp: { x: -0.08, y: 0.135, width: 0.09, height: 0.04 },
    strip: { x: 0, y: -0.155, width: 0.2, height: 0.022 },
  },

  // --- Phase 1: Grand Atrium Electrified Fountain (game/features/fountainHazard.js) ---
  fountain: {
    id: 'fountain',
    zone: 'atrium',
    label: 'Fountain Breaker',
    title: 'Electrify Fountain',
    verb: 'trigger',
    detail: 'Energizes the fountain basin and surrounding wet floor',
    switchStyle: 'breaker',
    // Switch box on the south fountain rim, facing -Z toward the Atrium gate (clear of the y=0.55 sign).
    position: { x: 20, y: 1.28, z: 15.92 },
    normal: { x: 0, y: 0, z: -1 },
    postBottomY: 0.95, // sits on top of the stone fountain rim
    // Active zone: the fountain basin (half-width 2.6 m) + the conductive wet floor ring around it.
    center: { x: 20, y: 1.06, z: 18.6 },
    radius: 7.0,
    innerRadius: 2.6,
    durationSeconds: 8,
    cooldownSeconds: 25,
    pulseInterval: 0.4,
    // Zombie effect per pulse (`source: 'hazard'`). Normal zombies take at least `zombieDamage` or
    // `normalHealthFraction` of their maxHealth (1-shot early rounds, 2-shot at any high round).
    // Bosses and Mascots cap each pulse at `maxHealthCap` of their maxHealth.
    zombieDamage: 200,
    normalHealthFraction: 0.55,
    maxHealthCap: 0.1,
    slowDuration: 0.65,
    slowFactor: 0.25,
    openingSurge: {
      seconds: 0.55,
      knockback: 3.2,
      drag: 6,
    },
    // Player standing in the energized ring: light shock per pulse + wet-floor taser slow while inside.
    // The switch stands inside the ring, so for `playerGraceSeconds` after it is thrown the ring spares the player
    // (time to step clear); zombies are hit from the first pulse.
    playerDamage: 6,
    playerViewJoltDegrees: 1.4,
    playerSlowFactor: 0.75,
    playerGraceSeconds: 1.0,
    // Visuals & audio.
    arcColor: 0x48eeff,
    arcCoreColor: 0xe8ffff,
    ringColor: 0x28d0ff,
    ringEdgeColor: 0x9cfaff,
    ringOpacity: 0.32,
    ringSegments: 48,
    ringY: 0.03, // (floor layers stacked 5 mm apart: no z-fighting with the floor or each other)
    edgeY: 0.035,
    rippleY: 0.04,
    edgeWidth: 0.14,
    edgeOpacity: 0.75,
    rippleOpacity: 0.85,
    rippleWidth: 0.06, // of a ring scaled to its radius
    waterGlowOpacity: 0.68,
    jetGlowOpacity: 0.78,
    shimmer: { base: 0.78, amplitude: 0.22, speed: 22 }, // ring and water opacity wobble while energized
    jetFlicker: { base: 0.85, amplitude: 0.15, speed: 30 },
    // The glowing copy of the fountain's water (matches maps/mall/atrium.js's fountain).
    glow: {
      basinY: 1.08, basinInset: 0.28, basinThickness: 0.045,
      bowl: { y: 2.48, radiusTop: 1.27, radiusBottom: 1.24, height: 0.04 },
      jet: { y: 3.12, radiusTop: 0.22, radiusBottom: 0.34, height: 1.32 },
      sheets: { y: 1.64, offset: 1.3, width: 0.74, thickness: 0.07, height: 1.15 },
      cornerNodeSize: 0.16,
    },
    arcOriginY: 3.45, // arcs leap from the fountain's top spout and corner brass posts
    cornerPostY: 2.24,
    arcSegments: 4,
    arcJitter: 0.42,
    arcForkLength: 0.75,
    idleArcCount: 3,
    idleArcTurn: { base: 2.15, random: 0.4 }, // radians the next ambient arc moves round the ring
    hitSparkColors: [0x6cf6ff, 0xffffff, 0xffd23f],
    hitSparkCount: 10,
    idleSparkCount: 4,
    zombieTargetYOffset: 0.95,
    flashRadius: 1.4, // (the spout)
    flashDuration: 0.16,
    hitFlashRadius: 1.25,
    hitFlashDuration: 0.12,
    triggerSound: 'incentiveSecurity',
    pulseSound: 'hit',
  },

  // --- Phase 2: Food Court Fryer Blast (game/features/fryerHazard.js) ---
  fryer: {
    id: 'fryer',
    zone: 'foodCourt',
    label: 'Fryer Valve',
    title: 'Vent Fryer Oil',
    verb: 'trigger',
    detail: 'Blasts scalding oil across the counter apron',
    switchStyle: 'valve',
    position: { x: 5.75, y: 1.05, z: -13.0 },
    normal: { x: 0, y: 0, z: 1 },
    postBottomY: 0,
    switchOffset: 0.21, // proud of the Corn Dog Corral counter face (z = -13.0) and stainless lip (z = -12.95)
    bounds: { minX: 2.5, maxX: 9.0, minZ: -13.0, maxZ: -6.5 },
    maxHeight: 1.2,
    durationSeconds: 6,
    cooldownSeconds: 25,
    pulseInterval: 0.5,
    burstDamage: 180,
    zombieDamage: 120,
    normalHealthFraction: 0.45,
    maxHealthCap: 0.1,
    slipDuration: 0.9,
    slipDrag: 0.8,
    playerDamage: 5,
    playerViewJoltDegrees: 1.0,
    playerSlowFactor: 0.8,
    playerGraceSeconds: 1.0, // (the valve stands on the apron: time to step off it)
    // Visuals & audio. The slick is dark, glossy hot oil with a bright rim so it reads on the warm Food Court tiles.
    slickColor: 0x6e3208,
    slickEdgeColor: 0xffa21f,
    waveColor: 0xffd27a,
    slickOpacity: 0.62,
    edgeOpacity: 0.9,
    waveOpacity: 0.85,
    vatGlowOpacity: 0.8,
    slickY: 0.03,
    edgeY: 0.035,
    waveY: 0.04,
    edgeWidth: 0.2,
    waveDepth: 0.26,
    simmer: { base: 0.85, amplitude: 0.15, speed: 20 },
    vatCenters: [
      { x: 4.12, y: 0.93, z: -13.92 },
      { x: 5.75, y: 0.93, z: -13.92 },
    ],
    vatSize: { width: 1.24, height: 0.04, depth: 0.38 },
    nozzlePositions: [
      { x: 4.12, y: 1.24, z: -12.96 },
      { x: 5.75, y: 1.24, z: -12.96 },
    ],
    nozzleSize: { width: 0.22, height: 0.12, depth: 0.14 },
    // Bubbles that swell and pop all over the slick, and boil in the vats (one instanced mesh each: one draw call).
    floorBubbles: { count: 26, color: 0xffcf5c, minSize: 0.06, maxSize: 0.2, seconds: 0.75, y: 0.045, segments: 10 },
    vatBubbles: { perVat: 7, color: 0xffe9a8, size: 0.05, rise: 0.09, hz: 2.6, y: 0.95 },
    steam: { colors: [0xf4f1ea, 0xd9d3c9, 0xfff6e0], perVat: 5, onApron: 2 }, // puffs per pulse
    jetSegments: 4,
    jetArcHeight: 0.55,
    jetJitter: 0.18,
    idleJetCount: 3,
    zombieTargetYOffset: 0.85,
    hitSparkColors: [0xff8a1f, 0xffd24a, 0xff4d1f],
    hitSparkCount: 10,
    idleSparkCount: 4,
    flashRadius: 0.5, // (at each nozzle: one sits just behind the valve, which must stay readable)
    flashDuration: 0.16,
    hitFlashRadius: 1.15,
    hitFlashDuration: 0.12,
    triggerSound: 'stuffingFryer',
    pulseSound: 'stuffingFryer',
  },

  // --- Phase 3: Main Hallway Fire Sprinklers (game/features/sprinklerHazard.js) ---
  sprinklers: {
    id: 'sprinklers',
    zone: 'hallway',
    label: 'Fire Alarm Pull',
    title: 'Trigger Fire Sprinklers',
    verb: 'trigger',
    detail: 'Drenches the concourse to chill and soak the horde',
    switchStyle: 'firePull',
    // South hallway wall between Kiosk Kevin's cart (x -9.6..-7.4) and the planter (x -5.9..-4.5), under the notice
    // poster (bottom y 1.59): out of reach from anywhere along the Food Court gate (x -3.5..3.5), so it never takes
    // the gate's prompt.
    position: { x: -6.6, y: 1.25, z: -1.95 },
    normal: { x: 0, y: 0, z: 1 },
    switchOffset: 0.08, // its back 2 cm in front of the wainscot rail (z -1.96)
    bounds: { minX: -12, maxX: 12, minZ: -2, maxZ: 6 },
    maxHeight: 1.2,
    durationSeconds: 10,
    cooldownSeconds: 30,
    pulseInterval: 0.5,
    zombieDamage: 60,
    normalHealthFraction: 0.25,
    maxHealthCap: 0.06,
    slowDuration: 1.0,
    slowFactor: 0.45,
    slowKind: 'smoothie',
    vulnerableDuration: 1.2,
    vulnerableMultiplier: 1.35,
    playerDamage: 0,
    playerSlowFactor: 0.9,
    // Visuals & audio.
    slickColor: 0x38b8ff,
    slickEdgeColor: 0x8ef2ff,
    waveColor: 0xc8faff,
    slickOpacity: 0.3,
    edgeOpacity: 0.72,
    waveOpacity: 0.76,
    slickY: 0.03,
    edgeY: 0.035,
    waveY: 0.04,
    edgeWidth: 0.14,
    waveDepth: 0.28,
    shimmer: { base: 0.8, amplitude: 0.2, speed: 18 },
    // Ceiling sprinkler heads, always there (one merged mesh): they turn cyan while they spray.
    nozzlePositions: [
      { x: -10, y: 5.92, z: -0.8 },
      { x: -5, y: 5.92, z: -0.8 },
      { x: 0, y: 5.92, z: -0.8 },
      { x: 5, y: 5.92, z: -0.8 },
      { x: 10, y: 5.92, z: -0.8 },
      { x: -10, y: 5.92, z: 4.8 },
      { x: -5, y: 5.92, z: 4.8 },
      { x: 0, y: 5.92, z: 4.8 },
      { x: 5, y: 5.92, z: 4.8 },
      { x: 10, y: 5.92, z: 4.8 },
    ],
    ceilingY: 6.0,
    head: { stemRadius: 0.018, deflectorRadius: 0.06, deflectorHeight: 0.012, segments: 10, color: 0xc9ccd1, sprayColor: 0x8ef2ff },
    // Falling water: a cone of drops under each head (one instanced mesh), and splash rings where they land.
    rain: { perHead: 18, width: 0.024, length: 0.5, color: 0xcff4ff, opacity: 0.72, fallSeconds: 0.55, minSpread: 0.3, maxSpread: 2.6, floorY: 0.05 },
    splash: { perHead: 2, radius: 1.5, seconds: 0.6, color: 0xdffaff, opacity: 0.45, y: 0.045, segments: 24 },
    spraySegments: 3,
    sprayJitter: 0.22,
    idleStreakCount: 6,
    zombieTargetYOffset: 0.9,
    hitSparkColors: [0x6cf6ff, 0xc8faff, 0x38b8ff],
    hitSparkCount: 8,
    idleSparkCount: 4,
    flashRadius: 0.8, // (where a streak lands)
    flashDuration: 0.14,
    hitFlashRadius: 1.1,
    hitFlashDuration: 0.11,
    triggerSound: 'paChime',
    pulseSound: 'stuffingFreeze',
  },

  // --- Phase 4: Service Corridor PA System Lure (game/features/paLureHazard.js) ---
  paLure: {
    id: 'paLure',
    zone: 'serviceCorridor',
    label: 'Paging Panel',
    title: 'Broadcast Clearance Lure',
    verb: 'trigger',
    detail: 'Transfixes nearby shoppers with a clearance chime before a feedback pop',
    switchStyle: 'paging',
    position: { x: -23.1, y: 1.35, z: -4.5 },
    normal: { x: 1, y: 0, z: 0 },
    switchOffset: 0.18, // proud of the west-wall electrical panel (x = -23.08)
    center: { x: -21.5, y: 0, z: -4.5 },
    radius: 10,
    maxHeight: 1.2,
    durationSeconds: 8,
    cooldownSeconds: 30,
    pulseInterval: 0.5,
    holdDuration: 1.2,
    popDamage: 220,
    normalHealthFraction: 0.6,
    maxHealthCap: 0.1,
    playerDamage: 0,
    playerSlowFactor: 1,
    // Visuals & audio.
    beaconCenter: { x: -21.8, y: 0, z: -4.5 },
    beaconInnerRadius: 0.32,
    beaconRadius: 1.25,
    corridorBounds: { minX: -23.1, maxX: -20.5, minZ: -13.8, maxZ: 1.8 },
    // The ceiling speaker horn, always mounted; its mouth glows while it broadcasts.
    speakerPosition: { x: -21.2, y: 3.42, z: -4.5 },
    ceilingY: 3.5,
    horn: { mouthRadius: 0.12, throatRadius: 0.04, length: 0.2, tilt: 0.45, driverRadius: 0.055, driverHeight: 0.07, color: 0x80868d, segments: 14 },
    // Sound waves that run out along the floor to the lure's real reach (`radius`), and spinning sale tags over
    // every shopper it holds (one instanced mesh).
    reachWaves: { count: 3, sweepSeconds: 1.4, width: 0.025, opacity: 0.55, segments: 64, y: 0.05 },
    tags: { max: 24, width: 0.2, height: 0.28, depth: 0.015, color: 0xff3b5c, above: 0.3, spinPerSecond: 3, bob: 0.06, bobHz: 2 },
    ringColor: 0xffa826,
    ringEdgeColor: 0xffdf6b,
    waveColor: 0xfff1b0,
    ringOpacity: 0.3,
    runnerOpacity: 0.14,
    edgeOpacity: 0.78,
    waveOpacity: 0.85,
    speakerGlowOpacity: 0.85,
    ringSegments: 40,
    edgeWidth: 0.1,
    rippleWidth: 0.1, // of a ring scaled to its radius
    pulseWobble: { base: 0.78, amplitude: 0.22, speed: 20 },
    speakerWobble: { base: 0.82, amplitude: 0.18, speed: 26 },
    runnerY: 0.03,
    ringY: 0.035,
    edgeY: 0.04,
    waveY: 0.045,
    beamSegments: 3,
    beamJitter: 0.18,
    idleBeamCount: 4,
    zombieTargetYOffset: 0.95,
    hitSparkColors: [0xffdf6b, 0xffa826, 0xfff1b0],
    hitSparkCount: 6,
    popSparkCount: 12,
    idleSparkCount: 4,
    flashRadius: 0.55, // (a glow at the speaker: anything bigger is cut by the 3.5 m ceiling)
    flashDuration: 0.14,
    popFlashRadius: 1.2,
    popFlashDuration: 0.24,
    triggerSound: 'paChime',
    pulseSound: 'paChime',
    popSound: 'stuffingNeon',
  },
};
