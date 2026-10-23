// Employee incentives. Gameplay and presentation tuning live here; no map entries needed.
export const powerUps = {
  firstRound: 2,
  threshold: { min: 12, max: 16 },
  credit: { kill: 1, headshot: 1.25, melee: 1.5, multiKillBonus: 0.25, multiKillSeconds: 0.6 },
  maxPerRound: 3,
  lifetime: 15,
  pickupRadius: 0.85,
  floorTolerance: 0.65,
  clearRadius: 0.38,
  clearHeight: 1.1,
  sightHeight: 0.5,
  nearFullFraction: 0.9,
  placementRadii: [0, 0.7, 1.4],
  placementDirections: 8,
  visual: { hover: 0.8, bob: 0.09, bobSpeed: 2.8, spinSpeed: 1.2, blinkLastSeconds: 4, blinkHz: 5, floorOffset: 0.035 },
  types: {
    stockroomDelivery: {
      name: 'STOCKROOM DELIVERY', color: 0xffc04d, weight: 1,
      magazineFraction: 0.5,
      sound: 'incentiveRestock',
      pa: { kicker: 'Employee incentive', text: 'Unscheduled stockroom delivery authorized. Please retain all packaging.' },
    },
    blueLightSpecial: {
      name: 'BLUE LIGHT SPECIAL', color: 0x54b9ff, weight: 1,
      seconds: 20, radius: 4, killMultiplier: 2,
      sound: 'incentiveBlueLight',
      pa: { kicker: 'Blue Light Special', text: 'Double clearance credit inside the blue circle. Survival is entirely your responsibility.' },
    },
    securitySweep: {
      name: 'SECURITY SWEEP', color: 0xff627a, weight: 1,
      seconds: 2, knockback: 5, drag: 8,
      sound: 'incentiveSecurity',
      pa: { kicker: 'Security assistance', text: 'Shoppers, please step back. Management assumes no liability.' },
    },
  },
};
