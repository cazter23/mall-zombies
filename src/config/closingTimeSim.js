// Developer measurement policy only; never imported by the playable game.
export const closingTimeSim = {
  seeds: 20, workers: 4, maxRound: 40, maxSeconds: 14400, overtimeRounds: 10,
  pollTicks: 60, interactionTicks: 50, handInteractionTicks: 120, pickupTicks: 3,
  shopSteps: 12,
  finisherBeams: 1,
  fountainCrowd: 4, fountainOrbit: 7.6, fountainAimAhead: 0.5,
  fountainFloorTolerance: 1,
  arena: { x: 48, y: 0, z: -8 },
  skills: {
    average: { sigma: 1.6, slew: 260, head: 0.2, stand: 7, panic: 2.2, fireCone: 2.2 },
    good: { sigma: 0.8, slew: 420, head: 0.5, stand: 6, panic: 2.0, fireCone: 1.4 },
  },
};
