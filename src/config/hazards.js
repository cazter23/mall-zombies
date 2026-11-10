// =============================================================================
// ENVIRONMENTAL HAZARDS (docs/hazards-plan.md): pay-to-trigger mall traps with cooldowns.
// Every tunable number and player-facing prompt string for hazards lives here; base prices
// live in config/economy.js (`economy.hazards`) and are read through `g.pricing.priceOf('hazard', id)`.
// =============================================================================

export const hazards = {
  // Status words shown on the interaction prompt when a switch cannot be triggered yet.
  status: {
    active: 'Active',
    cooldown: 'Recharging',
  },

  // Switch box dimensions and indicator colors shared by hazard breaker boxes.
  switchBox: {
    width: 0.32,
    height: 0.42,
    depth: 0.14,
    postWidth: 0.08,
    cabinetColor: 0x3b4248,
    trimColor: 0xd4a238,
    handleColor: 0xb83228,
    readyColor: 0x38e078,
    activeColor: 0x48e8ff,
    cooldownColor: 0xd9822b,
  },

  // --- Phase 1: Grand Atrium Electrified Fountain (game/features/fountainHazard.js) ---
  fountain: {
    id: 'fountain',
    zone: 'atrium',
    label: 'Fountain Breaker',
    title: 'Electrify Fountain',
    verb: 'trigger',
    detail: 'Energizes the fountain basin and surrounding wet floor',
    // Switch box on the south fountain rim, facing -Z toward the Atrium gate (clear of the y=0.38 sign).
    position: { x: 20, y: 1.05, z: 15.95 },
    normal: { x: 0, y: 0, z: -1 },
    postBottomY: 0.65, // sits on top of the 0.65 m fountain rim wall
    // Active zone: the fountain basin (half-width 2.6 m) + the conductive wet floor ring around it.
    center: { x: 20, y: 0.42, z: 18.6 },
    radius: 6.2,
    innerRadius: 2.6,
    durationSeconds: 8,
    cooldownSeconds: 25,
    pulseInterval: 0.5,
    // Zombie effect per pulse (`source: 'hazard'`). Bosses and Mascots cap each pulse by `maxHealthCap`.
    zombieDamage: 55,
    maxHealthCap: 0.06,
    slowDuration: 0.7,
    slowFactor: 0.55,
    // Player standing in the energized ring: light shock per pulse + wet-floor taser slow while inside.
    playerDamage: 6,
    playerViewJoltDegrees: 1.2,
    playerSlowFactor: 0.75,
    // Visuals & audio.
    arcColor: 0x5ceeff,
    ringColor: 0x38d8ff,
    ringOpacity: 0.34,
    waterGlowOpacity: 0.5,
    arcOriginY: 1.85, // arcs leap from the brass fountain rings
    flashRadius: 1.4,
    flashDuration: 0.14,
    triggerSound: 'incentiveSecurity',
    pulseSound: 'hit',
  },

  // --- Planned hazards (docs/hazards-plan.md; built in later phases) ---
  fryer: {
    id: 'fryer',
    zone: 'foodCourt',
    label: 'Fryer Valve',
    title: 'Vent Fryer Oil',
    verb: 'trigger',
    detail: 'Blasts scalding oil across the counter apron',
    position: { x: 5.75, y: 1.05, z: -13.0 },
    normal: { x: 0, y: 0, z: 1 },
    bounds: { minX: 2.5, maxX: 9.0, minZ: -13.0, maxZ: -6.5 },
    durationSeconds: 6,
    cooldownSeconds: 25,
    pulseInterval: 0.5,
    burstDamage: 90,
    zombieDamage: 35,
    maxHealthCap: 0.06,
    slipDuration: 0.9,
    playerDamage: 5,
    playerSlowFactor: 0.8,
  },

  sprinklers: {
    id: 'sprinklers',
    zone: 'hallway',
    label: 'Fire Alarm Pull',
    title: 'Trigger Fire Sprinklers',
    verb: 'trigger',
    detail: 'Drenches the concourse to chill and soak the horde',
    position: { x: -3.9, y: 1.35, z: -1.95 },
    normal: { x: 0, y: 0, z: 1 },
    bounds: { minX: -12, maxX: 12, minZ: -2, maxZ: 6 },
    durationSeconds: 10,
    cooldownSeconds: 30,
    pulseInterval: 0.5,
    zombieDamage: 20,
    maxHealthCap: 0.03,
    slowDuration: 1.0,
    slowFactor: 0.55,
    vulnerableDuration: 1.2,
    vulnerableMultiplier: 1.35,
    playerDamage: 0,
    playerSlowFactor: 0.9,
  },

  paLure: {
    id: 'paLure',
    zone: 'serviceHall',
    label: 'Paging Panel',
    title: 'Broadcast Clearance Lure',
    verb: 'trigger',
    detail: 'Transfixes nearby shoppers with a clearance chime before a feedback pop',
    position: { x: -23.1, y: 1.35, z: -4.5 },
    normal: { x: 1, y: 0, z: 0 },
    center: { x: -21.5, y: 0, z: -4.5 },
    radius: 10,
    durationSeconds: 8,
    cooldownSeconds: 30,
    pulseInterval: 0.5,
    holdDuration: 1.2,
    popDamage: 70,
    maxHealthCap: 0.05,
    playerDamage: 0,
    playerSlowFactor: 1,
  },
};
