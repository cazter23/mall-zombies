// Presentation only. Timers never affect purchases, round pacing or player input.
export const ui = {
  announcementSeconds: 4.5,
  announcementMaxSeconds: 12,
  announcementWordsPerSecond: 3,
  announcementQueueSize: 3,
  noticeHistorySize: 30,
  certificateHistorySize: 8,
  purchaseSeconds: 3,
  roundSeconds: 2.2,
  certificateSeconds: 12, // also retained in the pause menu's notices archive
  // The first-minute objective under the round box, shown until the `until` area is owned. {price} = its price now (g.pricing).
  startObjective: { text: 'Open the shutter · {price}', until: 'hallway' },
  clawBannerSeconds: 5,
  weaponRoles: {
    stapleGun: 'Precision sidearm · Aim for heads',
    priceGun: 'Close-range automatic · Fast reload',
    nailGun: 'Long-range punch · Pierces a line of shoppers',
    foamDartBlaster: 'Accurate burst fire · Mid-range precision',
    confettiCannon: 'Close-range crowd clearance · Reloads one shell at a time',
    rivetRifle: 'Steady automatic · Controlled body fire',
    coilNailer: 'Heavy automatic · Sustained crowd pressure',
    barcodeScanner: 'Hold to scan · Fires itself when the scan completes · Rings up what it hits: more damage from everything, bonus points',
    returnToSender: 'The wonder weapon · A blast of packing wind returns every zombie in front of you: an instant kill · Two shots a tube · Bosses and Mascots only take a big hit',
    tennisBallLauncher: 'Tight spaces · Balls bounce off walls and between zombies, each bounce a hit · Keeps up with the rounds',
    stargazer: 'The sniper · Hits harder the further away it lands · Huge headshots through a real scope · Pierces a line',
    bottleRocket: 'Blast at range · The rocket bursts on whatever it hits, hurting every zombie around it · Too close and it hurts you too',
    balloonLauncher: 'Hits what you do not aim at · Slow balloons home in on the nearest zombie and pop · Fire while you back away',
    leafBlower: 'Crowd control · Blows zombies back and knocks them down · Runs on a tank that refills',
  },
};
