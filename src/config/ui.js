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
    barcodeScanner: 'Charge and release · Piercing precision laser',
    returnToSender: 'The wonder weapon · Boxes one zombie and returns it: an instant kill · Bosses and Mascots only take a big hit',
    tennisBallLauncher: 'Tight spaces · Lobbed balls bounce off walls and between zombies, each bounce a hit',
    leafBlower: 'Crowd control · Blows zombies back and knocks them down · Runs on a tank that refills',
  },
};
