// Quiet anomalies inside inaccessible shops. No combat, collision or global lighting changes.
export const retailUnease = {
  range: 15, seenDot: .65, hiddenDot: -.2, awaySeconds: 3,
  headCooldown: 95, headAngle: -.7, feedSeconds: 75,
  silhouetteSeconds: 140, silhouetteDuration: 1.8, silhouetteMinRange: 7,
  sounds: [
    { id: 'atrium_backroom_phone', wall: 'west', at: 20.8, height: .9, sound: 'backroomPhone', minSeconds: 55, maxSeconds: 100, gain: .35, range: 13 },
    { id: 'atrium_unseen_cart', wall: 'east', at: 14.7, height: .5, sound: 'unseenCart', minSeconds: 85, maxSeconds: 145, gain: .3, range: 12 },
    { id: 'atrium_upper_steps', wall: 'west', at: 11.5, upper: true, height: .2, sound: 'distantSteps', minSeconds: 65, maxSeconds: 120, gain: .4, range: 14 },
  ],
};
