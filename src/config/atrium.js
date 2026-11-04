// Authored Grand Atrium dressing. at = metres along a wall from the room's min X/Z;
// the builder follows LAYOUT.atrium, so moving the room moves all of its dressing.
// Shops have real interiors behind sealed glazing; they are scenery, never walkable rooms.
export const atriumDetails = {
  restockMachine: { x: 30.5, wallInset: .2 }, // ground-floor northeast corner, facing the court
  palette: { cream: 0xf3e3bf, plum: 0x4b304e, mint: 0x84b9a7, coral: 0xdd7e85,
    gold: 0xd1ae62, blue: 0x689bb1, ink: 0x28303c, chrome: 0xa4b4b7, paper: 0xe5d4b2 },
  shopInterior: {
    depth: 2.35, openingHeight: 3.08, glassOpacity: 0.12,
    finishes: {
      fashion: { wall: 0xe6d9cf, floor: 0xa98265, font: 'Georgia, serif' },
      beauty: { wall: 0xe6d9df, floor: 0xd5dcd4, font: 'Georgia, serif' },
      luggage: { wall: 0xd5e1dc, floor: 0xbba78b, font: '"Space Grotesk", Arial, sans-serif' },
      television: { wall: 0xa6b9c5, floor: 0x727c86, font: '"Teko", "Arial Narrow", sans-serif' },
      portraits: { wall: 0xdcd0ba, floor: 0x99837d, font: 'Georgia, serif' },
      paper: { wall: 0xc4bdb0, floor: 0x9f9d92, font: 'Arial, sans-serif' },
    },
  },
  storefronts: [
    { wall: 'west', at: 4.1, width: 4.5, theme: 'fashion', name: 'SECOND SKIN', sub: 'A PERFECT FIT. EVENTUALLY.', color: 0xd382a1, awning: true },
    { wall: 'west', at: 20.8, width: 4.0, theme: 'paper', name: 'COMING SOON', sub: 'GRAND OPENING · SPRING 1986', color: 0x88b9ad },
    { wall: 'east', at: 8.7, width: 3.0, theme: 'beauty', name: 'FOREVER YOUNG', sub: 'AGE IS A POLICY VIOLATION.', color: 0xbb9ac7 },
    { wall: 'east', at: 14.7, width: 3.6, theme: 'luggage', name: 'DEPARTURES', sub: 'PACK FOR A LONGER STAY.', color: 0x83afbb },
    { wall: 'north', at: 8.5, width: 3.0, theme: 'portraits', name: 'PICTURE PERFECT', sub: 'YOUR BEST SELF. AGAIN.', color: 0xd6ad70 },
    { wall: 'north', at: 16, width: 3.0, theme: 'television', name: 'SOUND INVESTMENT', sub: 'THE FUTURE IS IN STOCK.', color: 0x789db6 },
    { wall: 'west', upper: true, at: 4.4, width: 4.6, theme: 'luggage', name: 'BAGGAGE CLAIM', sub: 'TAKE YOUR PROBLEMS WITH YOU.', color: 0x8bb5ae },
    { wall: 'west', upper: true, at: 11.5, width: 4.6, theme: 'fashion', name: 'DRESS CODE', sub: 'SMILE REQUIRED.', color: 0xb7a0ce, awning: true },
    { wall: 'west', upper: true, at: 19, width: 4.8, theme: 'paper', name: 'YOUR STORE HERE', sub: 'LEASE TERM: INDEFINITE', color: 0xd89778 },
    { wall: 'east', upper: true, at: 4.2, width: 3.9, theme: 'television', name: 'TOMORROW TODAY', sub: 'NOW IN LIVING COLOUR.', color: 0x88b3cb },
    { wall: 'east', upper: true, at: 12.4, width: 4.0, theme: 'beauty', name: 'ETERNAL ESSENCE', sub: 'MAKE AN EVERLASTING IMPRESSION.', color: 0xd18aa5, awning: true },
    { wall: 'east', upper: true, at: 21.6, width: 3.0, theme: 'portraits', name: 'MEMORY LANE', sub: 'WE REMEMBER YOU.', color: 0xd6b671 },
  ],
  floor: { lift: 0.006, textureSize: 1024, mosaicRadius: 5.8, seed: 410,
    colors: ['#d48194', '#85b4ad', '#d9b16e', '#957b9e'], wearCount: 90 },
  fountain: { coinCount: 52, seed: 580, waterOpacity: 0.76, rippleCount: 3, ripplePeriod: 3.8,
    rippleOpacity: 0.19, soundRange: 11, dedication: 'CELEBRATING ANOTHER YEAR OF UNPRECEDENTED GROWTH' },
  overhead: { bannerBottom: 4.25, bannerHeight: 3.6, mobileY: 7.65, swayRadians: 0.025, period: 13,
    banners: [
      { x: 0.27, z: 0.27, text: 'GRAND OPENING', sub: 'FOREVER & EVER', color: '#d382a1' },
      { x: 0.73, z: 0.31, text: 'SUNSET SAVINGS', sub: 'TIME STANDS STILL', color: '#79b6ab' },
      { x: 0.30, z: 0.73, text: 'SINCE 1986', sub: 'STILL CELEBRATING', color: '#b49aca' },
    ] },
  signage: { directory: 'YOU ARE HERE. PLEASE REMAIN HERE.',
    notice: 'ALL SHIFTS ARE MANDATORY · INCLUDING YOUR NEXT ONE',
    phoneDeal: 'FREE CONTRACT · TERMS LAST FOREVER', shadesDeal: 'LOOK ON THE BRIGHT SIDE' },
};
