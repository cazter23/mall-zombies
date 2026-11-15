// =============================================================================
// SHOPPERS: what the basic Shopper (and the Cart Pusher behind its cart) wears. Looks only: no gameplay stats or hitboxes
// live here. Built by zombies/shopperModel.js, chosen by zombies/shopperAppearance.js, drawn by zombies/shopperBake.js.
//
// A Shopper is one of the ARCHETYPES below: a 1986 mall-goer you can name at a glance (the weekend shopper, the velour
// tracksuit, the teen, the office worker on lunch, the parent with a baby carrier, the retiree, the food-court worker,
// the rocker). Each archetype lists the tops, bottoms, shoes, hair, hats, glasses, things in hand and extras it may
// wear, plus a few coordinated PALETTES. Every colour comes from `colors` (a curated 1986 mall palette), never raw RGB.
// Tops stay a step darker or more saturated than the pastel walls (no near-white or pale-lilac tops), so a shopper
// reads against the mall at range.
//
// What a Shopper must NOT borrow (the other kinds' signatures): the Shoplifter's dark hoodie and knit beanie, the Mall
// Walker's headband, wristbands and striped matching tracksuit, the Mascot's big heads, the Mannequin's plastic.
// Nothing reaches far above the head hitbox (hair and hats stay under ~0.42 m above the neck; the hitbox is 0.36).
//
// Parts: p(role, [w, h, d], [x, y, z], rz, { rx, ry, geo, mirror }). Positions are local to the bone the part hangs on
// (legs: the hip, feet at y -0.8; torso: the hips, chest up to y 0.6, front at z -0.13; head: the neck, crown at
// y 0.32, face at z -0.147; arm: the shoulder, along -Z; forearm: the elbow, hand at z -0.305). Faces look toward -Z.
// `role` is a slot in the outfit's palette (top, accent, inner, pants, shoes), a body colour (skin, hair, eyes, stain),
// `torso` (whatever the top's body is), `item` (the colour rolled for that one accessory) or a name from `colors`.
// `geo`: the faceted shape to use (box by default; jaw, cranium, limbY, limbZ, torso, shoe, hand). `mirror`: x flips
// on the left limb.
// =============================================================================

const p = (role, size, position, rz = 0, opts = {}) => ({ role, size, position, rz, ...opts });
const palette = (id, top, accent, inner, pants, shoes) => ({ id, top, accent, inner, pants, shoes });
/** { a: 3, b: 1 } -> [{ id: 'a', weight: 3 }, { id: 'b', weight: 1 }] (insertion order, so picks are repeatable). */
const weights = (table) => Object.entries(table).map(([id, weight]) => ({ id, weight }));
const both = (part) => [part, { ...part, position: [-part.position[0], ...part.position.slice(1)], rz: -part.rz, ry: -(part.ry ?? 0) }];

// The palette (sRGB). Brights for the teens and tracksuits, office neutrals, denim washes, food-court brand colours.
export const colors = {
  // neutrals
  black: 0x25242b, charcoal: 0x3f414c, slate: 0x5b6375, grey: 0x8a8c93, silver: 0xb8bbc2, offWhite: 0xe4dfd3,
  cream: 0xe6dcc2, khaki: 0xb39d74, tan: 0xa4825a, kraft: 0xb08a5a, brown: 0x6a4a37, chocolate: 0x4a3328, tweed: 0x6d6352,
  // denim
  denim: 0x3f5f8f, darkDenim: 0x2c3c5c, acidWash: 0x87a2c4, acidLight: 0xbccbe0, blackDenim: 0x36373f,
  // 1986 brights
  hotPink: 0xec4f98, magenta: 0xc2357c, electricPurple: 0x7a45c2, grape: 0x5b3a8a, teal: 0x23968f, turquoise: 0x2fb5b0,
  mint: 0x72c4a0, royal: 0x2f5fc8, sky: 0x4a98d6, neonYellow: 0xd8de45, lime: 0x8cc63f, tangerine: 0xee862c,
  coral: 0xe5665a, red: 0xc5373d, burgundy: 0x7c2c45, mustard: 0xcd9c36, gold: 0xd4b04a, forest: 0x2f5d45,
  olive: 0x6e7650, navy: 0x28314f, lavender: 0x9580c6, peach: 0xe39e7a, mauve: 0x9c6b8a, dustyRose: 0xbf8189,
  powderBlue: 0x8fb0d6, maroon: 0x5e2632,
  // food court (the mall's own stalls: Corn Dog Corral, Burger Barn, Pretzel Palace, Wok This Way)
  ketchup: 0xd2372f, frankYellow: 0xefc036, barnBrown: 0x7a4a2c, pretzelGold: 0xc98f3a, wokRed: 0xb52a2a,
  // hair
  hairBlack: 0x1f1a17, hairDarkBrown: 0x3d2b1f, hairChestnut: 0x6b3e26, hairAuburn: 0x8c3b22, hairDirtyBlonde: 0xa58653,
  hairBlonde: 0xd2b061, hairPlatinum: 0xe1d4a6, hairGrey: 0x8d8d8f, hairWhite: 0xd9d8d2, hairBlueRinse: 0xa7b2d2,
  hairDyedPink: 0xe0589c,
  // bits and pieces
  babySkin: 0xf0c4a2, lensSmoke: 0x3a3236, chrome: 0xb7bcc4, foamOrange: 0xef8a2e, hardware: 0x3c373d, stain: 0x655344,
};

export const shoppers = {
  // ---------------------------------------------------------------------------------------------------------------
  // WHO WEARS WHAT. Every Shopper is first rolled a presentation (its archetype's `presentations` weights), and then
  // only wears pieces that agree with it: a piece listed below is worn ONLY by that presentation, anything not listed by
  // anyone. So a skirt only ever goes on a feminine-presenting Shopper, and never with a tie, a flat-top or a bald head.
  // The keys are the archetype list names. Every archetype must leave each presentation at least one choice per list
  // (tests/shopperAppearance.test.js checks, and that every piece still turns up). A new piece that reads as one
  // presentation (a beard, a dress) goes in here.
  onlyFor: {
    masculine: {
      hair: ['bald', 'receding', 'crop', 'sidePart', 'slickBack', 'flatTop', 'spiky', 'mullet'],
      tops: ['shirtTie', 'looseTie', 'shortSleeveTie'],
      builds: ['broad'],
      headwear: ['flatCap'],
    },
    feminine: {
      hair: ['bob', 'ponytail', 'sidePony', 'perm', 'bigHair'],
      tops: ['powerSuit'], // (the 1986 women's suit: shoulder pads, a bow at the blouse collar)
      bottoms: ['skirt', 'pencilSkirt', 'miniSkirt'],
      held: ['purse'],
    },
  },

  // ---------------------------------------------------------------------------------------------------------------
  // ARCHETYPES. weight = how common; presentations = its mix of men and women (see onlyFor). Every list is picked from
  // evenly unless it is a weights table, among the pieces that fit the Shopper's presentation.
  archetypes: [
    {
      id: 'weekend', name: 'Weekend Shopper', weight: 3, presentations: weights({ masculine: 1, feminine: 1 }),
      tops: ['tee', 'polo', 'raglan', 'rugby'], bottoms: ['jeans', 'chinos', 'shorts', 'skirt'], shoes: ['sneaker', 'boatShoe'],
      patterns: ['plain', 'stripes', 'logo'], builds: ['slight', 'regular', 'broad'],
      hair: weights({ crop: 3, sidePart: 2, bob: 2, ponytail: 1.5, curls: 1.5, feathered: 1.5, receding: 1, bald: 0.6 }),
      hairColors: ['hairBlack', 'hairDarkBrown', 'hairChestnut', 'hairDirtyBlonde', 'hairBlonde', 'hairAuburn'],
      headwear: weights({ none: 7, ballCap: 1.5 }),
      eyewear: weights({ none: 6, shades: 1, glasses: 1 }),
      held: weights({ none: 5, shoppingBag: 4, slushie: 1 }),
      extras: weights({ none: 6, backpack: 1, shoulderBag: 1, walkman: 0.8 }),
      palettes: [
        palette('berryDenim', 'magenta', 'cream', 'cream', 'denim', 'offWhite'),
        palette('tealKhaki', 'teal', 'cream', 'cream', 'khaki', 'brown'),
        palette('mustardNavy', 'mustard', 'cream', 'cream', 'navy', 'offWhite'),
        palette('royalWeekend', 'royal', 'offWhite', 'offWhite', 'khaki', 'offWhite'),
        palette('purpleDenim', 'electricPurple', 'lavender', 'cream', 'darkDenim', 'offWhite'),
        palette('coralDenim', 'coral', 'cream', 'cream', 'denim', 'tan'),
        palette('forestKhaki', 'forest', 'mustard', 'cream', 'khaki', 'brown'),
      ],
    },
    {
      // The Sunday velour suit: colour-blocked shoulders and cuffs, a zip, matching trousers. (Not the Mall Walker's
      // striped one: no side stripes, no headband, no wristbands.)
      id: 'velour', name: 'Velour Tracksuit', weight: 1.4, presentations: weights({ masculine: 1, feminine: 1 }),
      tops: ['velourYoke', 'velourPanel'], bottoms: ['trackPants'], shoes: ['sneaker', 'hiTop'],
      patterns: ['plain'], builds: ['slight', 'regular', 'broad'],
      hair: weights({ perm: 3, feathered: 2, crop: 2, ponytail: 1.5, receding: 1 }),
      hairColors: ['hairBlack', 'hairDarkBrown', 'hairBlonde', 'hairPlatinum', 'hairAuburn', 'hairGrey'],
      headwear: weights({ none: 5, visor: 1.5 }),
      eyewear: weights({ none: 4, shades: 2, aviators: 1.5 }),
      held: weights({ none: 4, slushie: 2, shoppingBag: 3 }),
      extras: weights({ none: 3, walkman: 2 }),
      palettes: [
        palette('royalVelour', 'royal', 'turquoise', 'offWhite', 'royal', 'offWhite'),
        palette('magentaVelour', 'magenta', 'electricPurple', 'offWhite', 'magenta', 'offWhite'),
        palette('tealVelour', 'teal', 'hotPink', 'offWhite', 'teal', 'offWhite'),
        palette('maroonVelour', 'maroon', 'gold', 'cream', 'maroon', 'offWhite'),
        palette('grapeVelour', 'grape', 'mint', 'offWhite', 'grape', 'offWhite'),
        palette('forestVelour', 'forest', 'tangerine', 'cream', 'forest', 'offWhite'),
      ],
    },
    {
      id: 'teen', name: 'Mall Rat', weight: 2, presentations: weights({ masculine: 1, feminine: 1 }),
      tops: ['windbreaker', 'neonTee', 'jeanJacket'], bottoms: ['acidJeans', 'jeans', 'miniSkirt'], shoes: ['hiTop', 'sneaker'],
      patterns: ['plain'], builds: ['slight', 'regular'],
      hair: weights({ bigHair: 2.5, spiky: 1.5, sidePony: 2, mullet: 1.5, flatTop: 1, feathered: 1 }),
      hairColors: ['hairBlack', 'hairDarkBrown', 'hairBlonde', 'hairPlatinum', 'hairChestnut', 'hairDyedPink'],
      headwear: weights({ none: 1 }),
      eyewear: weights({ none: 5, shades: 1.5 }),
      held: weights({ none: 4, slushie: 2.5, shoppingBag: 2.5 }),
      extras: weights({ none: 3, walkman: 2 }),
      palettes: [
        palette('hotPinkTeal', 'hotPink', 'turquoise', 'neonYellow', 'acidWash', 'offWhite'),
        palette('purpleLime', 'electricPurple', 'lime', 'hotPink', 'acidWash', 'black'),
        palette('tealTangerine', 'teal', 'tangerine', 'neonYellow', 'denim', 'offWhite'),
        palette('royalYellow', 'royal', 'neonYellow', 'hotPink', 'acidWash', 'offWhite'),
        palette('blackNeon', 'black', 'hotPink', 'turquoise', 'acidWash', 'offWhite'),
        palette('coralMint', 'coral', 'mint', 'electricPurple', 'darkDenim', 'offWhite'),
      ],
    },
    {
      id: 'office', name: 'Lunch Break', weight: 1.4, presentations: weights({ masculine: 1.5, feminine: 1 }),
      tops: ['shirtTie', 'looseTie', 'shortSleeveTie', 'powerSuit'], bottoms: ['slacks', 'pencilSkirt'], shoes: ['dress'],
      patterns: ['plain'], builds: ['slight', 'regular', 'broad'],
      hair: weights({ sidePart: 3, receding: 2, bald: 1, bob: 1.5, feathered: 1.5, slickBack: 1.5 }),
      hairColors: ['hairBlack', 'hairDarkBrown', 'hairChestnut', 'hairDirtyBlonde', 'hairGrey'],
      headwear: weights({ none: 1 }),
      eyewear: weights({ none: 3, glasses: 3, aviators: 1 }),
      held: weights({ none: 4, briefcase: 2.5, shoppingBag: 2 }),
      extras: weights({ none: 3, idBadge: 1.5 }),
      palettes: [
        palette('blueOxford', 'powderBlue', 'burgundy', 'offWhite', 'charcoal', 'chocolate'),
        palette('whiteNavy', 'cream', 'navy', 'offWhite', 'navy', 'black'),
        palette('pinkGrey', 'dustyRose', 'navy', 'offWhite', 'slate', 'black'),
        palette('navySuit', 'navy', 'red', 'offWhite', 'navy', 'black'),
        palette('greySuit', 'slate', 'mustard', 'powderBlue', 'slate', 'chocolate'),
        palette('tanSuit', 'tan', 'forest', 'cream', 'brown', 'chocolate'),
      ],
    },
    {
      // A sleeping baby rides along in the carrier (it's fine: it slept through all of it).
      id: 'parent', name: 'Parent with Carrier', weight: 1.2, presentations: weights({ masculine: 1, feminine: 1.2 }),
      tops: ['sweater', 'polo', 'tee'], bottoms: ['momJeans', 'chinos'], shoes: ['sneaker', 'boatShoe'],
      patterns: ['plain', 'stripes'], builds: ['slight', 'regular', 'broad'],
      hair: weights({ perm: 2, sidePony: 1.5, crop: 2, bob: 1.5, feathered: 1.5, sidePart: 1 }),
      hairColors: ['hairBlack', 'hairDarkBrown', 'hairChestnut', 'hairDirtyBlonde', 'hairBlonde', 'hairAuburn'],
      headwear: weights({ none: 1 }),
      eyewear: weights({ none: 4, glasses: 1.5 }),
      held: weights({ none: 3, shoppingBag: 3, purse: 1 }),
      extras: weights({ babyCarrier: 1 }),
      palettes: [
        palette('dustyRoseDenim', 'dustyRose', 'cream', 'cream', 'denim', 'offWhite'),
        palette('mintKhaki', 'mint', 'cream', 'cream', 'khaki', 'brown'),
        palette('periwinkle', 'lavender', 'navy', 'cream', 'denim', 'offWhite'),
        palette('mustardBrown', 'mustard', 'brown', 'cream', 'darkDenim', 'tan'),
        palette('tealCream', 'teal', 'peach', 'cream', 'khaki', 'offWhite'),
      ],
    },
    {
      id: 'retiree', name: 'Retiree', weight: 1.2, presentations: weights({ masculine: 1, feminine: 1 }),
      tops: ['cardigan', 'sweaterVest'], bottoms: ['slacks'], shoes: ['orthopedic', 'dress'],
      patterns: ['plain'], builds: ['slight', 'regular'],
      hair: weights({ bald: 2, receding: 2, perm: 2.5, bob: 1.5, slickBack: 1 }),
      hairColors: ['hairGrey', 'hairWhite', 'hairBlueRinse', 'hairGrey'],
      headwear: weights({ none: 4, flatCap: 1.5, bucketHat: 1 }),
      eyewear: weights({ glasses: 4, none: 1.5 }),
      held: weights({ purse: 3, shoppingBag: 2.5, none: 2 }),
      extras: weights({ none: 1 }),
      palettes: [
        palette('oatmealBrown', 'khaki', 'brown', 'powderBlue', 'brown', 'offWhite'),
        palette('mauveGrey', 'mauve', 'cream', 'cream', 'slate', 'offWhite'),
        palette('forestTan', 'forest', 'cream', 'offWhite', 'tan', 'chocolate'),
        palette('burgundyGrey', 'burgundy', 'cream', 'cream', 'grey', 'black'),
        palette('powderNavy', 'powderBlue', 'navy', 'offWhite', 'navy', 'offWhite'),
        palette('mustardSlate', 'mustard', 'brown', 'cream', 'slate', 'brown'),
      ],
    },
    {
      // Still in uniform from one of the food court's stalls: paper hat or visor, apron, name badge.
      id: 'foodCourt', name: 'Food Court Crew', weight: 1, presentations: weights({ masculine: 1, feminine: 1 }),
      tops: ['uniformPolo', 'uniformStripes'], bottoms: ['slacks'], shoes: ['dress', 'sneaker'],
      patterns: ['plain'], builds: ['slight', 'regular', 'broad'],
      hair: weights({ crop: 2, ponytail: 2, bob: 1.5, sidePart: 1.5, mullet: 1 }),
      hairColors: ['hairBlack', 'hairDarkBrown', 'hairChestnut', 'hairBlonde', 'hairAuburn'],
      headwear: weights({ paperHat: 2, visor: 1 }),
      eyewear: weights({ none: 6, glasses: 1 }),
      held: weights({ none: 3, spatula: 2, slushie: 1 }),
      extras: weights({ none: 1 }),
      palettes: [
        palette('cornDogCorral', 'ketchup', 'frankYellow', 'offWhite', 'black', 'black'),
        palette('burgerBarn', 'barnBrown', 'tangerine', 'cream', 'charcoal', 'black'),
        palette('pretzelPalace', 'navy', 'pretzelGold', 'offWhite', 'navy', 'black'),
        palette('wokThisWay', 'wokRed', 'gold', 'offWhite', 'black', 'black'),
      ],
    },
    {
      id: 'rocker', name: 'Rocker', weight: 1, presentations: weights({ masculine: 2, feminine: 1 }),
      tops: ['denimVest', 'studdedVest'], bottoms: ['blackJeans', 'rippedJeans'], shoes: ['hiTop', 'boot'],
      patterns: ['plain'], builds: ['slight', 'regular', 'broad'],
      hair: weights({ longStraight: 3, mullet: 2.5, spiky: 1, bigHair: 1 }),
      hairColors: ['hairBlack', 'hairDarkBrown', 'hairBlonde', 'hairPlatinum', 'hairChestnut'],
      headwear: weights({ none: 1 }),
      eyewear: weights({ none: 3, shades: 2 }),
      held: weights({ none: 4, slushie: 1.5, shoppingBag: 1.5 }),
      extras: weights({ none: 2, chainWallet: 2, walkman: 0.6 }),
      palettes: [
        palette('denimBlackTee', 'denim', 'red', 'black', 'blackDenim', 'black'),
        palette('acidVest', 'acidWash', 'neonYellow', 'charcoal', 'blackDenim', 'black'),
        palette('blackVest', 'black', 'red', 'grey', 'denim', 'black'),
        palette('darkDenimMaroon', 'darkDenim', 'gold', 'maroon', 'blackDenim', 'chocolate'),
      ],
    },
  ],

  // Body width within a small range (height never changes: the head hitbox is fixed).
  builds: { slight: { width: 0.92 }, regular: { width: 1 }, broad: { width: 1.08 } },

  // Damage, rarely: a stain, a torn sleeve, a shoe gone.
  wearWeights: weights({ clean: 7, stain: 1.5, tornSleeve: 1, missingShoe: 0.5 }),

  // The colour rolled for each accessory (`item` in its parts).
  itemColors: {
    shoppingBag: ['hotPink', 'teal', 'mustard', 'royal', 'cream', 'red', 'electricPurple', 'kraft'],
    slushie: ['red', 'sky', 'lime', 'electricPurple'],
    purse: ['chocolate', 'burgundy', 'navy', 'tan', 'cream'],
    briefcase: ['chocolate', 'black', 'tan'],
    spatula: ['black'],
    backpack: ['navy', 'red', 'teal', 'electricPurple', 'forest', 'charcoal'],
    shoulderBag: ['brown', 'tan', 'navy', 'burgundy', 'khaki'],
    walkman: ['silver', 'black', 'neonYellow'],
    babyCarrier: ['navy', 'denim', 'burgundy', 'khaki', 'forest'],
    idBadge: ['offWhite'],
    chainWallet: ['black', 'brown'],
    ballCap: ['red', 'royal', 'navy', 'teal', 'black', 'cream'],
    visor: ['offWhite', 'hotPink', 'turquoise', 'neonYellow'],
    flatCap: ['tweed', 'grey', 'brown', 'navy'],
    bucketHat: ['khaki', 'cream', 'olive'],
    glasses: ['black', 'chocolate', 'gold', 'burgundy'],
    aviators: ['gold', 'silver'],
    shades: ['black'],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // CLOTHES. A top: its sleeves ('short' | 'long'), what colour its body and sleeves are (default 'top'), parts on the
  // torso, on the upper arm (arm) and forearm (forearm). stainForward: how far out a stain sits over its front panels.
  tops: {
    tee: { sleeve: 'short', parts: [] },
    raglan: { sleeve: 'short', sleeveRole: 'accent', parts: [p('accent', [0.17, 0.025, 0.02], [0, 0.585, -0.128])] },
    polo: { sleeve: 'short', parts: [
      p('accent', [0.1, 0.07, 0.025], [-0.052, 0.56, -0.14], -0.35),
      p('accent', [0.1, 0.07, 0.025], [0.052, 0.56, -0.14], 0.35),
      p('accent', [0.025, 0.1, 0.012], [0, 0.49, -0.138]),
    ] },
    rugby: { sleeve: 'long', parts: [
      p('accent', [0.44, 0.07, 0.272], [0, 0.22, 0]),
      p('accent', [0.455, 0.07, 0.272], [0, 0.38, 0]),
      p('inner', [0.1, 0.07, 0.025], [-0.052, 0.56, -0.14], -0.35),
      p('inner', [0.1, 0.07, 0.025], [0.052, 0.56, -0.14], 0.35),
    ] },
    sweater: { sleeve: 'long', parts: [
      p('accent', [0.44, 0.05, 0.272], [0, 0.03, 0]), // ribbed hem
      p('accent', [0.06, 0.06, 0.012], [-0.12, 0.4, -0.142], Math.PI / 4), // a row of diamonds
      p('accent', [0.06, 0.06, 0.012], [0, 0.4, -0.142], Math.PI / 4),
      p('accent', [0.06, 0.06, 0.012], [0.12, 0.4, -0.142], Math.PI / 4),
      p('inner', [0.17, 0.03, 0.2], [0, 0.585, 0]),
    ], forearm: [p('accent', [0.15, 0.15, 0.05], [0, 0, -0.245])] },
    // (the shirt and tie: tie in the accent colour; the loose one hangs crooked from an open collar)
    shirtTie: { sleeve: 'long', parts: [
      p('top', [0.1, 0.07, 0.025], [-0.052, 0.56, -0.14], -0.4),
      p('top', [0.1, 0.07, 0.025], [0.052, 0.56, -0.14], 0.4),
      p('accent', [0.05, 0.045, 0.03], [0, 0.53, -0.145]),
      p('accent', [0.06, 0.3, 0.012], [0, 0.35, -0.142]),
      p('accent', [0.043, 0.043, 0.012], [0, 0.2, -0.142], Math.PI / 4),
      p('inner', [0.012, 0.012, 0.008], [0, 0.3, -0.151]), // tie clip
    ] },
    looseTie: { sleeve: 'long', stainForward: 0.01, parts: [
      p('top', [0.1, 0.07, 0.025], [-0.06, 0.56, -0.14], -0.7),
      p('top', [0.1, 0.07, 0.025], [0.06, 0.56, -0.14], 0.7),
      p('skin', [0.06, 0.06, 0.012], [0, 0.55, -0.135], Math.PI / 4),
      p('accent', [0.05, 0.045, 0.03], [0.008, 0.48, -0.147], 0.15),
      p('accent', [0.06, 0.27, 0.012], [0.02, 0.32, -0.142], 0.1),
      p('accent', [0.043, 0.043, 0.012], [0.033, 0.185, -0.142], Math.PI / 4 + 0.1),
    ] },
    shortSleeveTie: { sleeve: 'short', parts: [
      p('top', [0.1, 0.07, 0.025], [-0.052, 0.56, -0.14], -0.4),
      p('top', [0.1, 0.07, 0.025], [0.052, 0.56, -0.14], 0.4),
      p('accent', [0.05, 0.045, 0.03], [0, 0.53, -0.145]),
      p('accent', [0.05, 0.26, 0.012], [0, 0.37, -0.142]),
      p('inner', [0.085, 0.09, 0.012], [0.12, 0.4, -0.138]), // pocket protector...
      p('red', [0.012, 0.05, 0.012], [0.1, 0.45, -0.146]), // ...with pens
      p('royal', [0.012, 0.045, 0.012], [0.12, 0.45, -0.146]),
      p('black', [0.012, 0.055, 0.012], [0.14, 0.45, -0.146]),
    ] },
    // (power suit: big shoulder pads, lapels, a bow at the blouse collar)
    powerSuit: { sleeve: 'long', torsoRole: 'inner', stainForward: 0.02, parts: [
      p('top', [0.17, 0.58, 0.04], [-0.145, 0.29, -0.133]),
      p('top', [0.17, 0.58, 0.04], [0.145, 0.29, -0.133]),
      p('top', [0.46, 0.6, 0.07], [0, 0.3, 0.105]),
      p('top', [0.05, 0.24, 0.015], [-0.085, 0.47, -0.158], 0.32),
      p('top', [0.05, 0.24, 0.015], [0.085, 0.47, -0.158], -0.32),
      p('top', [0.17, 0.07, 0.24], [-0.26, 0.6, 0], 0.12, { geo: 'jaw' }), // shoulder pads
      p('top', [0.17, 0.07, 0.24], [0.26, 0.6, 0], -0.12, { geo: 'jaw' }),
      p('accent', [0.1, 0.04, 0.025], [0, 0.55, -0.15]),
      p('accent', [0.03, 0.08, 0.015], [-0.02, 0.5, -0.152], 0.2),
      p('accent', [0.03, 0.08, 0.015], [0.02, 0.5, -0.152], -0.2),
      p('accent', [0.012, 0.012, 0.01], [-0.06, 0.3, -0.158]), // buttons
      p('accent', [0.012, 0.012, 0.01], [-0.06, 0.2, -0.158]),
    ] },
    cardigan: { sleeve: 'long', torsoRole: 'inner', stainForward: 0.02, parts: [
      p('top', [0.185, 0.53, 0.035], [-0.14, 0.265, -0.135]),
      p('top', [0.185, 0.53, 0.035], [0.14, 0.265, -0.135]),
      p('top', [0.46, 0.6, 0.06], [0, 0.3, 0.11]),
      p('accent', [0.025, 0.47, 0.012], [-0.045, 0.25, -0.158]),
      p('accent', [0.025, 0.47, 0.012], [0.045, 0.25, -0.158]),
      p('accent', [0.014, 0.014, 0.01], [-0.06, 0.38, -0.165]),
      p('accent', [0.014, 0.014, 0.01], [-0.06, 0.26, -0.165]),
      p('accent', [0.014, 0.014, 0.01], [-0.06, 0.14, -0.165]),
      p('accent', [0.08, 0.07, 0.012], [0.13, 0.15, -0.155]), // a pocket with a tissue in it
      p('offWhite', [0.03, 0.03, 0.012], [0.12, 0.195, -0.152], 0.3),
    ] },
    sweaterVest: { sleeve: 'long', torsoRole: 'inner', sleeveRole: 'inner', shoulderRole: 'inner', parts: [
      p('top', [0.4, 0.42, 0.275], [0, 0.21, 0], 0, { geo: 'torso' }),
      p('top', [0.07, 0.17, 0.015], [-0.045, 0.47, -0.135], 0.35),
      p('top', [0.07, 0.17, 0.015], [0.045, 0.47, -0.135], -0.35),
      p('accent', [0.06, 0.06, 0.012], [-0.09, 0.25, -0.143], Math.PI / 4),
      p('accent', [0.06, 0.06, 0.012], [0.09, 0.25, -0.143], Math.PI / 4),
      p('accent', [0.06, 0.06, 0.012], [0, 0.17, -0.143], Math.PI / 4),
      p('inner', [0.1, 0.07, 0.025], [-0.052, 0.565, -0.14], -0.4),
      p('inner', [0.1, 0.07, 0.025], [0.052, 0.565, -0.14], 0.4),
    ] },
    // (windbreaker: colour-blocked chevron front and back, stand-up collar, puffy sleeves with a band)
    windbreaker: { sleeve: 'long', sleevePadding: 0.03, stainForward: 0.01, parts: [
      p('accent', [0.5, 0.13, 0.014], [0, 0.38, -0.14], -0.32),
      p('inner', [0.42, 0.06, 0.014], [0, 0.25, -0.14], -0.32),
      p('accent', [0.5, 0.13, 0.014], [0, 0.38, 0.14], 0.32),
      p('accent', [0.24, 0.07, 0.21], [0, 0.6, 0.005]),
      p('black', [0.014, 0.5, 0.012], [0, 0.29, -0.156]),
      p('accent', [0.43, 0.05, 0.272], [0, 0.025, 0]),
    ], arm: [p('accent', [0.17, 0.17, 0.07], [0, 0, -0.12])], forearm: [p('accent', [0.16, 0.16, 0.05], [0, 0, -0.245])] },
    // (an oversized tee with a big geometric print)
    neonTee: { sleeve: 'short', sleevePadding: 0.03, parts: [
      p('accent', [0.2, 0.05, 0.012], [-0.07, 0.42, -0.138], 0.6),
      p('accent', [0.2, 0.05, 0.012], [0.07, 0.42, -0.138], -0.6),
      p('inner', [0.11, 0.11, 0.012], [0.03, 0.25, -0.138], Math.PI / 4),
      p('accent', [0.05, 0.05, 0.014], [-0.1, 0.22, -0.139]),
      p('inner', [0.17, 0.025, 0.02], [0, 0.585, -0.128]),
    ] },
    jeanJacket: { sleeve: 'long', torsoRole: 'inner', stainForward: 0.02, parts: [
      p('denim', [0.18, 0.58, 0.04], [-0.142, 0.29, -0.135]),
      p('denim', [0.18, 0.58, 0.04], [0.142, 0.29, -0.135]),
      p('denim', [0.46, 0.6, 0.07], [0, 0.3, 0.105]),
      p('denim', [0.1, 0.07, 0.025], [-0.08, 0.57, -0.15], -0.5),
      p('denim', [0.1, 0.07, 0.025], [0.08, 0.57, -0.15], 0.5),
      p('acidLight', [0.08, 0.06, 0.012], [-0.14, 0.4, -0.161]),
      p('acidLight', [0.08, 0.06, 0.012], [0.14, 0.4, -0.161]),
      p('accent', [0.04, 0.04, 0.012], [0.15, 0.32, -0.161], 0.3), // an enamel pin
    ], sleeveRole: 'denim' },
    // (velour: colour-blocked shoulders and cuffs, a zip; the trousers match the top)
    velourYoke: { sleeve: 'long', parts: [
      p('accent', [0.48, 0.13, 0.276], [0, 0.515, 0]),
      p('inner', [0.016, 0.5, 0.012], [0, 0.29, -0.146]),
      p('inner', [0.02, 0.035, 0.016], [0, 0.48, -0.152]),
      p('accent', [0.43, 0.05, 0.272], [0, 0.025, 0]),
    ], forearm: [p('accent', [0.15, 0.15, 0.06], [0, 0, -0.24])] },
    velourPanel: { sleeve: 'long', parts: [
      p('accent', [0.17, 0.32, 0.014], [-0.1, 0.36, -0.139]),
      p('inner', [0.016, 0.5, 0.012], [0, 0.29, -0.146]),
      p('accent', [0.17, 0.32, 0.014], [0.1, 0.36, 0.139]),
      p('accent', [0.43, 0.05, 0.272], [0, 0.025, 0]),
    ], arm: [p('accent', [0.03, 0.155, 0.24], [0, 0.002, -0.12])], forearm: [p('accent', [0.15, 0.15, 0.06], [0, 0, -0.24])] },
    // (food court: a uniform with an apron and name badge, in the stall's colours)
    uniformPolo: { sleeve: 'short', sleeveRole: 'top', stainForward: 0.01, parts: [
      p('accent', [0.1, 0.07, 0.025], [-0.052, 0.56, -0.14], -0.35),
      p('accent', [0.1, 0.07, 0.025], [0.052, 0.56, -0.14], 0.35),
      p('inner', [0.38, 0.44, 0.014], [0, 0.22, -0.142], 0, { geo: 'torso' }),
      p('inner', [0.03, 0.15, 0.012], [-0.11, 0.49, -0.142], 0.2),
      p('inner', [0.03, 0.15, 0.012], [0.11, 0.49, -0.142], -0.2),
      p('inner', [0.48, 0.04, 0.274], [0, 0.1, 0]),
      p('offWhite', [0.1, 0.06, 0.008], [-0.1, 0.36, -0.153]),
      p('accent', [0.08, 0.016, 0.006], [-0.1, 0.375, -0.158]),
    ] },
    uniformStripes: { sleeve: 'short', sleeveRole: 'accent', stainForward: 0.01, parts: [
      p('accent', [0.05, 0.6, 0.012], [-0.13, 0.3, -0.137]),
      p('accent', [0.05, 0.6, 0.012], [0, 0.3, -0.137]),
      p('accent', [0.05, 0.6, 0.012], [0.13, 0.3, -0.137]),
      p('inner', [0.46, 0.26, 0.016], [0, 0.07, -0.147], 0, { geo: 'torso' }),
      p('inner', [0.48, 0.04, 0.276], [0, 0.18, 0]),
      p('offWhite', [0.1, 0.06, 0.008], [0.1, 0.42, -0.148]),
      p('top', [0.08, 0.016, 0.006], [0.1, 0.435, -0.153]),
    ] },
    // (rocker: a denim vest over a tee, a big patch on the back; the studded one has pins and studs)
    denimVest: { sleeve: 'short', torsoRole: 'inner', sleeveRole: 'inner', shoulderRole: 'top', stainForward: 0.02, parts: [
      p('top', [0.17, 0.56, 0.035], [-0.145, 0.28, -0.134]),
      p('top', [0.17, 0.56, 0.035], [0.145, 0.28, -0.134]),
      p('top', [0.47, 0.6, 0.06], [0, 0.3, 0.108]),
      p('accent', [0.25, 0.2, 0.012], [0, 0.36, 0.145]),
      p('black', [0.14, 0.09, 0.012], [0, 0.36, 0.152]),
      p('accent', [0.035, 0.035, 0.012], [-0.15, 0.42, -0.157]),
      p('neonYellow', [0.035, 0.035, 0.012], [0.14, 0.36, -0.157], 0.4),
    ] },
    studdedVest: { sleeve: 'short', torsoRole: 'inner', sleeveRole: 'inner', shoulderRole: 'top', stainForward: 0.02, parts: [
      p('top', [0.17, 0.56, 0.035], [-0.145, 0.28, -0.134]),
      p('top', [0.17, 0.56, 0.035], [0.145, 0.28, -0.134]),
      p('top', [0.47, 0.6, 0.06], [0, 0.3, 0.108]),
      p('accent', [0.22, 0.22, 0.012], [0, 0.34, 0.145], Math.PI / 4),
      ...[-0.17, -0.12, 0.12, 0.17].flatMap((x) => [0.5, 0.42].map((y) => p('chrome', [0.02, 0.02, 0.012], [x, y, -0.157]))),
      p('accent', [0.2, 0.03, 0.012], [0, 0.48, -0.132]), // band tee print showing between the panels
      p('accent', [0.03, 0.12, 0.012], [0, 0.38, -0.132]),
    ] },
  },

  // Patterns printed on some tees and polos.
  patterns: {
    plain: [],
    stripes: [p('accent', [0.43, 0.035, 0.014], [0, 0.25, -0.14]), p('accent', [0.43, 0.035, 0.014], [0, 0.39, -0.14])],
    logo: [p('accent', [0.12, 0.025, 0.014], [-0.08, 0.42, -0.14]), p('accent', [0.025, 0.09, 0.014], [-0.08, 0.42, -0.142])],
  },
  stain: [p('stain', [0.09, 0.065, 0.014], [0.08, 0.19, -0.142]), p('stain', [0.045, 0.04, 0.015], [0.04, 0.15, -0.142])],

  // A bottom: what the legs are ('pants' | 'bare' | 'shorts'), its skirt (if any), parts on each leg and at the waist.
  bottoms: {
    jeans: { legs: 'pants', waist: [p('brown', [0.47, 0.04, 0.275], [0, 0.03, 0])] },
    chinos: { legs: 'pants' },
    slacks: { legs: 'pants', waist: [p('black', [0.47, 0.035, 0.275], [0, 0.03, 0]), p('chrome', [0.04, 0.03, 0.01], [0, 0.03, -0.143])] },
    trackPants: { legs: 'pants', leg: [p('accent', [0.15, 0.06, 0.17], [0, -0.7, 0], 0, { geo: 'limbY' })] },
    shorts: { legs: 'shorts' },
    // (acid wash: bleached blotches, pegged cuffs)
    acidJeans: { legs: 'pants', pantsColor: 'acidWash', leg: [
      p('acidLight', [0.1, 0.14, 0.012], [0.01, -0.22, -0.095], 0.3),
      p('acidLight', [0.07, 0.09, 0.012], [-0.02, -0.5, -0.084], -0.4),
      p('acidLight', [0.06, 0.1, 0.012], [0.08, -0.35, 0.02], 0, { ry: Math.PI / 2, mirror: true }),
      p('acidLight', [0.14, 0.035, 0.155], [0, -0.69, 0], 0, { geo: 'limbY' }),
    ] },
    momJeans: { legs: 'pants', waist: [p('brown', [0.47, 0.05, 0.275], [0, 0.04, 0]), p('gold', [0.04, 0.035, 0.01], [0, 0.04, -0.143])] },
    blackJeans: { legs: 'pants', waist: [p('black', [0.47, 0.045, 0.275], [0, 0.03, 0]), p('chrome', [0.05, 0.035, 0.01], [0, 0.03, -0.143])] },
    rippedJeans: { legs: 'pants', pantsColor: 'denim', leg: [
      p('skin', [0.1, 0.05, 0.012], [0, -0.42, -0.088]),
      p('offWhite', [0.11, 0.008, 0.012], [0, -0.393, -0.09]),
      p('offWhite', [0.11, 0.008, 0.012], [0, -0.447, -0.088]),
    ], waist: [p('black', [0.47, 0.045, 0.275], [0, 0.03, 0]), p('chrome', [0.05, 0.035, 0.01], [0, 0.03, -0.143])] },
    skirt: { legs: 'bare', skirt: { width: 0.48, height: 0.4, depth: 0.3, taper: 0.86 } },
    pencilSkirt: { legs: 'bare', skirt: { width: 0.47, height: 0.48, depth: 0.29, taper: 0.97 } },
    // (a short ra-ra skirt with scrunched leg warmers)
    miniSkirt: { legs: 'bare', skirt: { width: 0.5, height: 0.27, depth: 0.32, taper: 0.8 }, leg: [
      p('accent', [0.2, 0.2, 0.215], [0, -0.62, 0], 0, { geo: 'limbY' }),
      p('accent', [0.215, 0.035, 0.225], [0, -0.53, 0]),
    ] },
  },
  shortsLength: 0.4,
  clothingPadding: 0.012, // sleeves/shorts sit proud of bare limbs instead of sharing their faces
  shortSleeveLength: 0.24,
  tornSleeveLength: 0.12,
  longSleeveLength: 0.26,
  tornLongSleeveLength: 0.12,

  // Shoes: parts on each foot over the base shoe (in the outfit's shoe colour). Foot bottom at y -0.8.
  shoes: {
    sneaker: [p('offWhite', [0.185, 0.022, 0.27], [0, -0.787, -0.04])],
    hiTop: [p('shoes', [0.18, 0.11, 0.17], [0, -0.69, 0.01], 0, { geo: 'limbY' }),
      p('offWhite', [0.185, 0.022, 0.27], [0, -0.787, -0.04]),
      p('accent', [0.012, 0.04, 0.09], [0.093, -0.75, 0], 0.3, { mirror: true })],
    boatShoe: [p('tan', [0.185, 0.02, 0.268], [0, -0.788, -0.04])],
    dress: [],
    orthopedic: [p('cream', [0.19, 0.035, 0.272], [0, -0.782, -0.04])],
    boot: [p('shoes', [0.19, 0.17, 0.2], [0, -0.68, 0.0], 0, { geo: 'limbY' }), p('chrome', [0.012, 0.03, 0.03], [0.096, -0.73, 0.02], 0, { mirror: true })],
  },

  // Hair styles (on the head). Kept under the hats' brims and below ~0.42 m.
  hair: {
    bald: [],
    receding: [p('hair', [0.31, 0.13, 0.045], [0, 0.23, 0.15]),
      p('hair', [0.025, 0.12, 0.19], [-0.15, 0.23, 0.055]), p('hair', [0.025, 0.12, 0.19], [0.15, 0.23, 0.055])],
    crop: [p('hair', [0.315, 0.055, 0.31], [0, 0.335, 0]), p('hair', [0.31, 0.13, 0.045], [0, 0.23, 0.15])],
    sidePart: [p('hair', [0.315, 0.045, 0.31], [0, 0.332, 0]), p('hair', [0.13, 0.025, 0.24], [-0.08, 0.36, 0]),
      p('hair', [0.31, 0.13, 0.045], [0, 0.23, 0.15])],
    bob: [p('hair', [0.32, 0.045, 0.32], [0, 0.335, 0]), p('hair', [0.32, 0.22, 0.055], [0, 0.19, 0.15]),
      p('hair', [0.035, 0.23, 0.24], [-0.153, 0.19, 0.02]), p('hair', [0.035, 0.23, 0.24], [0.153, 0.19, 0.02])],
    ponytail: [p('hair', [0.31, 0.045, 0.31], [0, 0.333, 0]), p('hair', [0.31, 0.16, 0.045], [0, 0.23, 0.15]),
      p('hair', [0.085, 0.16, 0.075], [0, 0.18, 0.205])],
    curls: [p('hair', [0.12, 0.075, 0.13], [-0.1, 0.328, -0.08]), p('hair', [0.12, 0.075, 0.13], [0.1, 0.328, -0.08]),
      p('hair', [0.13, 0.07, 0.14], [0, 0.338, 0]), p('hair', [0.12, 0.075, 0.13], [-0.1, 0.328, 0.08]),
      p('hair', [0.12, 0.075, 0.13], [0.1, 0.328, 0.08]), p('hair', [0.3, 0.14, 0.06], [0, 0.235, 0.145])],
    // (feathered: winged sides flicking back)
    feathered: [p('hair', [0.32, 0.05, 0.32], [0, 0.336, 0]), p('hair', [0.32, 0.2, 0.055], [0, 0.2, 0.15]),
      ...both(p('hair', [0.04, 0.17, 0.2], [0.155, 0.22, 0.01], -0.12)),
      ...both(p('hair', [0.05, 0.06, 0.15], [0.17, 0.14, 0.04], -0.5))],
    // (big hair: volume on top, at the sides and behind, with bangs)
    bigHair: [p('hair', [0.36, 0.08, 0.35], [0, 0.35, 0.005], 0, { geo: 'cranium' }),
      ...both(p('hair', [0.06, 0.27, 0.29], [0.168, 0.22, 0.03])),
      p('hair', [0.36, 0.29, 0.07], [0, 0.2, 0.165]),
      p('hair', [0.3, 0.05, 0.045], [0, 0.32, -0.15], 0, { rx: 0.2 })],
    // (a perm: a cloud of tight curls)
    perm: [p('hair', [0.14, 0.1, 0.14], [-0.1, 0.34, -0.07]), p('hair', [0.14, 0.1, 0.14], [0.1, 0.34, -0.07]),
      p('hair', [0.15, 0.1, 0.15], [0, 0.36, 0.02]), p('hair', [0.14, 0.1, 0.14], [-0.1, 0.33, 0.09]),
      p('hair', [0.14, 0.1, 0.14], [0.1, 0.33, 0.09]), ...both(p('hair', [0.08, 0.15, 0.17], [0.165, 0.24, 0.05])),
      p('hair', [0.32, 0.18, 0.08], [0, 0.22, 0.15])],
    spiky: [p('hair', [0.315, 0.05, 0.31], [0, 0.335, 0]), p('hair', [0.31, 0.13, 0.045], [0, 0.23, 0.15]),
      p('hair', [0.06, 0.09, 0.06], [0, 0.38, -0.06], 0, { rx: -0.35 }),
      ...both(p('hair', [0.06, 0.08, 0.06], [0.09, 0.385, -0.04], -0.4)),
      ...both(p('hair', [0.06, 0.08, 0.06], [0.06, 0.385, 0.08], -0.3, { rx: 0.3 }))],
    // (a side ponytail with a scrunchie in the outfit's accent colour)
    sidePony: [p('hair', [0.32, 0.05, 0.32], [0, 0.335, 0]), p('hair', [0.32, 0.17, 0.05], [0, 0.23, 0.15]),
      p('hair', [0.3, 0.045, 0.04], [0, 0.32, -0.15], 0, { rx: 0.2 }),
      p('hair', [0.08, 0.2, 0.08], [0.18, 0.22, 0.08], -0.45), p('accent', [0.1, 0.045, 0.1], [0.165, 0.3, 0.08], -0.45)],
    // (business in front, party at the back)
    mullet: [p('hair', [0.315, 0.06, 0.31], [0, 0.335, 0]), p('hair', [0.31, 0.32, 0.05], [0, 0.13, 0.155]),
      ...both(p('hair', [0.025, 0.1, 0.12], [0.152, 0.25, 0.08]))],
    flatTop: [p('hair', [0.3, 0.08, 0.29], [0, 0.36, 0.005]), p('hair', [0.3, 0.1, 0.045], [0, 0.26, 0.148])],
    longStraight: [p('hair', [0.32, 0.045, 0.32], [0, 0.335, 0]), p('hair', [0.33, 0.4, 0.06], [0, 0.14, 0.158]),
      ...both(p('hair', [0.035, 0.3, 0.22], [0.16, 0.17, 0.04])),
      p('hair', [0.29, 0.045, 0.045], [0, 0.315, -0.148])],
    slickBack: [p('hair', [0.31, 0.04, 0.33], [0, 0.334, 0.005]), p('hair', [0.31, 0.15, 0.05], [0, 0.23, 0.152]),
      p('hair', [0.28, 0.05, 0.06], [0, 0.337, -0.125], 0, { rx: -0.3 })],
  },

  // Hats (on the head). `item` = the hat's rolled colour. Brims make them read as hats, not the Mall Walker's headband.
  headwear: {
    none: [],
    ballCap: [p('item', [0.33, 0.085, 0.33], [0, 0.35, 0.005], 0, { geo: 'cranium' }),
      p('item', [0.24, 0.018, 0.14], [0, 0.318, -0.22], 0, { rx: -0.12 }), p('offWhite', [0.12, 0.05, 0.012], [0, 0.35, -0.168])],
    visor: [p('item', [0.33, 0.045, 0.33], [0, 0.29, 0]), p('item', [0.28, 0.016, 0.15], [0, 0.285, -0.225], 0, { rx: -0.18 })],
    // (a folded paper hat in the stall's colours)
    paperHat: [...both(p('offWhite', [0.014, 0.08, 0.3], [0.046, 0.388, 0], 0.35)),
      p('offWhite', [0.17, 0.035, 0.31], [0, 0.363, 0]), p('accent', [0.178, 0.014, 0.318], [0, 0.352, 0]),
      p('accent', [0.05, 0.03, 0.012], [0, 0.39, -0.157])],
    flatCap: [p('item', [0.335, 0.06, 0.34], [0, 0.35, 0.01], 0, { geo: 'cranium' }),
      p('item', [0.27, 0.02, 0.1], [0, 0.33, -0.2], 0, { rx: -0.25 })],
    bucketHat: [p('item', [0.3, 0.1, 0.3], [0, 0.37, 0], 0, { geo: 'cranium' }), p('item', [0.42, 0.018, 0.42], [0, 0.32, 0])],
  },

  // Glasses (on the head; eyes sit at x +-0.07, y 0.186, the face at z -0.15). `item` = the frames' colour.
  eyewear: {
    none: [],
    // (big square 1986 frames, the eyes still showing through)
    glasses: [...both(p('item', [0.1, 0.018, 0.01], [0.07, 0.225, -0.172])), ...both(p('item', [0.1, 0.012, 0.01], [0.07, 0.148, -0.172])),
      ...both(p('item', [0.012, 0.088, 0.01], [0.12, 0.187, -0.172])), ...both(p('item', [0.012, 0.088, 0.01], [0.02, 0.187, -0.172])),
      p('item', [0.03, 0.012, 0.01], [0, 0.2, -0.172]), ...both(p('item', [0.01, 0.014, 0.17], [0.157, 0.205, -0.09]))],
    aviators: [...both(p('lensSmoke', [0.085, 0.07, 0.006], [0.068, 0.188, -0.166], -0.08)),
      ...both(p('item', [0.095, 0.01, 0.01], [0.068, 0.225, -0.17])), p('item', [0.03, 0.01, 0.01], [0, 0.215, -0.17]),
      ...both(p('item', [0.008, 0.012, 0.17], [0.157, 0.205, -0.09]))],
    shades: [...both(p('item', [0.12, 0.065, 0.035], [0.075, 0.2, -0.165])), p('item', [0.04, 0.018, 0.035], [0, 0.2, -0.165])],
  },

  // In the right hand (forearm bone; the hand is at z -0.305). Only `shoppingBag` can drop a bag with one of
  // Kevin's items in it (game/bagDrops.js reads model.hasBag).
  held: {
    none: [],
    shoppingBag: [p('item', [0.2, 0.26, 0.11], [0, -0.22, -0.32]), p('accent', [0.21, 0.05, 0.115], [0, -0.13, -0.32]),
      ...both(p('item', [0.012, 0.08, 0.012], [0.04, -0.06, -0.32]))],
    // (a slushie: a tapered cup, a dome lid in the flavour's colour, a pink straw)
    slushie: [p('offWhite', [0.075, 0.13, 0.075], [0, 0.03, -0.335], 0, { geo: 'limbY' }), p('item', [0.08, 0.035, 0.08], [0, 0.04, -0.335]),
      p('item', [0.08, 0.04, 0.08], [0, 0.105, -0.335], 0, { geo: 'cranium' }), p('hotPink', [0.012, 0.09, 0.012], [0.015, 0.155, -0.33], -0.2)],
    purse: [...both(p('item', [0.012, 0.11, 0.012], [0.035, -0.06, -0.15])), p('item', [0.2, 0.15, 0.075], [0, -0.17, -0.15], 0, { geo: 'jaw' }),
      p('gold', [0.04, 0.02, 0.078], [0, -0.1, -0.15])],
    briefcase: [p('black', [0.03, 0.025, 0.07], [0, -0.04, -0.32]), p('item', [0.08, 0.28, 0.38], [0, -0.19, -0.32]),
      ...[-0.1, 0.1].map((z) => p('gold', [0.084, 0.03, 0.025], [0, -0.07, -0.32 + z]))],
    spatula: [p('item', [0.025, 0.025, 0.16], [0, 0, -0.39]), p('chrome', [0.09, 0.008, 0.1], [0, 0.005, -0.51])],
  },

  // Extras (on the torso; `head` parts go on the head). An extra with head parts means no hat.
  extras: {
    none: {},
    backpack: { torso: [p('item', [0.29, 0.37, 0.15], [0, 0.29, 0.2]),
      p('hardware', [0.045, 0.47, 0.015], [-0.16, 0.31, -0.142]), p('hardware', [0.045, 0.47, 0.015], [0.16, 0.31, -0.142])] },
    shoulderBag: { torso: [p('item', [0.14, 0.21, 0.2], [0.24, -0.01, 0]), p('hardware', [0.025, 0.65, 0.016], [0.03, 0.3, -0.15], -0.5)] },
    // (a cassette player on the belt and orange foam headphones)
    walkman: {
      torso: [p('item', [0.09, 0.12, 0.035], [0.15, 0.07, -0.152]), p('black', [0.06, 0.04, 0.01], [0.15, 0.09, -0.172]),
        p('black', [0.012, 0.18, 0.012], [0.14, 0.25, -0.148], 0.25)],
      head: [...both(p('foamOrange', [0.035, 0.075, 0.075], [0.168, 0.19, 0.01])), ...both(p('chrome', [0.015, 0.17, 0.025], [0.172, 0.29, 0.01])),
        p('chrome', [0.3, 0.018, 0.025], [0, 0.385, 0.01])],
    },
    // (a front carrier with a sleeping baby in a bonnet)
    babyCarrier: { torso: [
      ...both(p('item', [0.045, 0.32, 0.014], [0.1, 0.42, -0.142])),
      p('item', [0.29, 0.24, 0.12], [0, 0.24, -0.2], 0, { geo: 'jaw', rx: Math.PI }),
      p('accent', [0.24, 0.05, 0.1], [0, 0.35, -0.205]), // the blanket's edge
      p('babySkin', [0.11, 0.1, 0.1], [0, 0.42, -0.215], 0, { geo: 'cranium' }),
      p('offWhite', [0.135, 0.12, 0.09], [0, 0.435, -0.198], 0, { geo: 'cranium' }), // the bonnet frames the face
      ...both(p('black', [0.025, 0.006, 0.006], [0.022, 0.425, -0.267])),
    ] },
    idBadge: { torso: [p('item', [0.06, 0.08, 0.008], [0.12, 0.42, -0.15]), p('royal', [0.025, 0.03, 0.006], [0.105, 0.43, -0.155]),
      p('chrome', [0.02, 0.012, 0.01], [0.12, 0.465, -0.15])] },
    chainWallet: { torso: [p('chrome', [0.012, 0.1, 0.012], [0.21, -0.03, -0.07], 0, { rx: 0.9 }),
      p('chrome', [0.012, 0.1, 0.012], [0.21, -0.07, 0.03], 0, { rx: -0.6 }), p('item', [0.09, 0.1, 0.02], [0.1, -0.04, 0.142])] },
  },

  // Undead faces (eyes, mouths, stains), as before.
  faceProfiles: [
    { id: 'sunkenEyes', jawOffset: [0, 0, 0], jawTilt: 0, parts: [
      p('stain', [0.088, 0.072, 0.018], [-0.07, 0.184, -0.146]), p('stain', [0.088, 0.072, 0.018], [0.07, 0.184, -0.146]),
      p('eyes', [0.056, 0.048, 0.02], [-0.07, 0.186, -0.151]), p('eyes', [0.056, 0.048, 0.02], [0.07, 0.186, -0.151]),
      p('eyes', [0.11, 0.036, 0.02], [0, 0.082, -0.148])] },
    { id: 'offsetJaw', jawOffset: [0.018, -0.008, -0.006], jawTilt: 0.08, parts: [
      p('eyes', [0.06, 0.05, 0.02], [-0.07, 0.188, -0.15]), p('eyes', [0.056, 0.044, 0.02], [0.07, 0.182, -0.15]),
      p('eyes', [0.115, 0.042, 0.02], [0.014, 0.078, -0.15], 0.08), p('offWhite', [0.035, 0.016, 0.018], [-0.015, 0.09, -0.153], 0.06)] },
    { id: 'droopingEyelid', jawOffset: [-0.008, -0.004, 0], jawTilt: -0.04, parts: [
      p('eyes', [0.06, 0.052, 0.02], [-0.07, 0.186, -0.15]), p('eyes', [0.06, 0.032, 0.02], [0.07, 0.176, -0.15]),
      p('stain', [0.068, 0.026, 0.022], [0.07, 0.202, -0.152], -0.12), p('eyes', [0.105, 0.032, 0.02], [-0.008, 0.082, -0.148], -0.06)] },
    { id: 'retailSmile', jawOffset: [0, -0.006, -0.004], jawTilt: 0, parts: [
      p('stain', [0.072, 0.02, 0.018], [-0.07, 0.156, -0.147]), p('stain', [0.072, 0.02, 0.018], [0.07, 0.156, -0.147]),
      p('eyes', [0.06, 0.05, 0.02], [-0.07, 0.188, -0.15]), p('eyes', [0.06, 0.05, 0.02], [0.07, 0.188, -0.15]),
      p('eyes', [0.145, 0.046, 0.02], [0, 0.084, -0.148]), p('offWhite', [0.12, 0.022, 0.018], [0, 0.086, -0.152])] },
    { id: 'discolored', jawOffset: [0.006, -0.004, 0], jawTilt: 0.03, parts: [
      p('stain', [0.075, 0.085, 0.016], [-0.095, 0.145, -0.144], 0.15), p('stain', [0.06, 0.055, 0.016], [0.085, 0.235, -0.144], -0.1),
      p('eyes', [0.06, 0.05, 0.02], [-0.07, 0.186, -0.15]), p('eyes', [0.06, 0.05, 0.02], [0.07, 0.186, -0.15]),
      p('eyes', [0.115, 0.035, 0.02], [0.005, 0.082, -0.148], 0.04)] },
  ],
};
