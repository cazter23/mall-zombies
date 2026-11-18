// =============================================================================
// KIOSK KEVIN CONFIG: Kevin's five carts and the move rule, his stock and the equipment in your pockets.
// Prices live in config/economy.js and are applied by g.pricing.
//
// Every equipment damage is multiplied by ONE number, equipmentPower(round) (game/equipment/equipmentDamage.js):
//   (zombieHealthForRound(round) / power.baseHealth) ^ power.exponent
// so it grows with the round, but far slower than zombie health: strong early, weaker late, never useless.
// =============================================================================

export const kiosk = {
  // WHERE KEVIN IS (docs/archive/kiosk-kevin-plan.md, "Where Kevin is"). Every site has a cart in the map all the time (maps/mall/kioskCart.js);
  // only one is live, the others say "BACK IN 5 MIN" (no collider is added or moved at runtime). Every run starts at the FIRST site.
  // Every `moveEveryRounds` rounds after the opening round (`openingRound + 3, + 6...`) at 'roundStart' he moves to a random OTHER site
  // whose zone is open (none open: he stays put), never mid-purchase (the move waits until the hold is let go) and never into a locked zone. game/features/kiosk.js.
  //   x, z     the middle of the cart's footprint;  faces  the way its front (the products and the signs) looks: '+z', '-z', '+x', '-x'
  //   floorY   the floor it stands on;  where  the PA's name for the place
  // Each site passed the checks in tests/kiosk.test.js: one collider, a vaultable counter (<= 1.1 m) or >= 2.1 m tall, a clear stand
  // point zombies can reach, no zombie spawn within spawnClearance, zombie routes unchanged, no coplanar faces (tests/coplanar.test.js).
  sites: [
    // West half of the south wall, between the Service Corridor door and the Food Court gate. The first site.
    { id: 'hallway', zone: 'hallway', where: 'the Main Hallway', x: -8.5, z: -1.585, faces: '+z', floorY: 0 },
    // West of the door lane, facing the gate: 4.6 m clear of the Fryer Blast's grease apron (x 2.5..9.0, z -13.0..-6.5).
    { id: 'foodCourt', zone: 'foodCourt', where: 'the Food Court', x: -3.2, z: -6.5, faces: '+z', floorY: 0 },
    // The south arcade, in the corner west of the Hallway gate (the plan's CELL-OUT kiosk failed the check: the west vent
    // spawn is 4.7 m from its front, and its east face is inside the Electrified Fountain's apron). 15 m from the fountain.
    { id: 'atrium', zone: 'atrium', where: 'the Grand Atrium', x: 9.14, z: 7.015, faces: '+z', floorY: 0 },
    // The east lounge, between the south benches and the plinth, facing the Atrium link.
    { id: 'upstairs', zone: 'upstairs', where: 'the Sunset Promenade', x: 13, z: -1.5, faces: '+z', floorY: 6.3 },
    // Beside the family van, in the empty bay east of it: Kevin's "overflow stock".
    { id: 'parkingLot', zone: 'parkingLot', where: 'Customer Parking', x: 42.93, z: -11.05, faces: '+x', floorY: 0 },
  ],
  // A cart (maps/mall/kioskCart.js): a low counter under a canopy, with three slots along its front.
  // roofY = the canopy's underside (its roof and trim add 0.09 on top). The cart is ONE solid collider from the floor to the
  // roof's top over its footprint: with a canopy 1.35 m above the counter it can't be stood on, so it is not vaultable.
  cart: { width: 2.2, depth: 0.75, height: 1.05, roofY: 2.4, roofThickness: 0.09, slotSpacing: 0.72, signWidth: 1.9, productY: 0.83 },
  spawnClearance: 5, // m: no zombie spawn this close to a site's stand point (checked by the tests)
  // The mall PA, played when Kevin first opens in a run (`opened` + `stock`) and when he moves to another site (`moved` + `stock`),
  // in ONE banner ({where} = the site's `where`, {stock} = the block's three products, {pick} = Kevin's Pick). Entry 0 is the original line.
  // Rounds where he stays put keep the PA silent; keep `opened` short and `stock` near the original's length.
  pa: {
    kicker: "Kevin's cart",
    opened: [
      "Kevin's cart is open in {where}.",
      "Kevin's cart is open in {where}. Please approach calmly.",
      "Kevin's cart is open in {where}, while Kevin lasts.",
      "Kevin's cart is open in {where}. Management is neutral.",
      "Kevin's cart is open in {where}. Kevin is behind it.",
      "Kevin's cart is open in {where}. Mall hours remain suspended.",
      "Kevin's cart is open in {where}. Nod twice for a receipt.",
      "Kevin's cart is open in {where}. Business as usual.",
    ],
    // When he has moved: these take turns by move (the first move says the first), so the PA never needs Math.random.
    moved: [
      "Kevin's cart is now in {where}. He's asked us to say it's a limited time only.",
      "Kevin's cart is now in {where}. Kevin would like everyone to know he was not chased there.",
      "Kevin's cart has relocated to {where}. Mall management did not approve this. Mall management is a zombie.",
      "Kevin's cart is now in {where}. Please stop telling him where the zombies are. He knows.",
    ],
    stock: [
      "Today on Kevin's cart: {stock}. Kevin's Pick is {pick}.",
      "In stock at Kevin's cart: {stock}. Kevin's Pick: {pick}.",
      "Kevin is carrying {stock}. He personally vouches for {pick}.",
      "On the cart this round: {stock}. Kevin's Pick is {pick}.",
      "Kevin's inventory: {stock}. Staff preference: {pick}.",
      "Stocked today: {stock}. Kevin has circled {pick} in marker.",
      "Available from the cart: {stock}. Kevin insists on {pick}.",
      "Kevin's cart offers {stock}. Today's highlight is {pick}.",
    ],
  },
  openingRound: 2,
  stockEveryRounds: 3,
  moveEveryRounds: 3,
  duckRadius: 3,

  // KEVIN HIMSELF (phase 8: presentation only; nothing below changes a price, a damage or a rule).
  // He shouts (game/features/kiosk.js emits 'kioskHawk'; his cart shows the line in a speech bubble, maps/mall/kioskCart.js):
  //   lines   when you're within `radius` of his open cart (and within floorTolerance of its floor), at most once every
  //           `seconds`. {product} = one of the round's three, in turn.
  //   pitches product-specific shouts (about pitchChance of 'lines' shouts), only for this round's stock and preferring his Pick.
  //   duck    when a zombie sends him under the counter (at most once every duckSeconds);  back  when he comes back up.
  // Each list takes turns in order (no Math.random: the game's random numbers, and so the seeded tests, stay as they were).
  hawk: {
    radius: 8, // m (the plan's "within 8 m")
    floorTolerance: 2, // m
    seconds: 14,
    duckSeconds: 6,
    bubbleSeconds: 3.2, // how long a line stays over his head (the view)
    pitchChance: 0.35, // share of `lines` shouts replaced by a pitch for something he stocks this round
    lines: [
      'Excuse me! Can I ask you a question?',
      'You! You look like someone who needs a {product}!',
      'Free sample! It is not free.',
      '{product}! As seen on TV! The TV is on fire!',
      "Don't walk away! I can tell you're interested!",
      'Is that a zombie behind you? Great, two customers!',
      'Everything must go! Including me, ideally!',
      'Ask me about {product}! Please! Nobody asks!',
      'One day only! Every day!',
      'Stop! You forgot your {product}!',
      'Look at {product}! Peak engineering! Probably!',
      'Five stars! All from me! Buy {product}!',
      'Get {product} now! Prices rise when I panic!',
      'Wait! {product} matches your whole outfit!',
      'Demo right here! {product}! Stand back!',
      'Why run empty-handed when {product} exists!',
      'Buy {product}! Help me hit quota by noon!',
      'Hey! Running past still counts as browsing!',
      'Card! Cash! Points! I take anything!',
      'Slow down! I just yell louder when you sprint!',
      'Buy something! This cart has ZERO armor!',
      'Come closer! My mall rent is per hour!',
      'Hey! Wait up! I have been shouting all shift!',
      'Friend! Look over here! Pretend I am not scared!',
      'Deals! Bargains! Human conversation!',
    ],
    duck: [
      'Not today! NOT TODAY!',
      "We're closed! We're CLOSED!",
      "I'm on break! Union rules!",
      'Nobody here! Just a cart!',
      'Dropped a quarter! Looking for it!',
      'Take the cart! NOT THE KEVIN!',
      'Wrong stall! Try the food court!',
      'Do NOT bite the merchandise! Or me!',
      'Security! SECURITY! Anybody?!',
      'Counting inventory! Down on the floor!',
    ],
    back: [
      "And we're back! Did you miss me?",
      'Okay! Open! Never left!',
      'Where were we? Oh right, you were buying.',
      'Coast is clear! Wallet out!',
      'False alarm! Everything is fine! BUY NOW!',
      'Still alive! Still open! Still loud!',
      'Back in business! Slightly shaken! Come browse!',
      'Nothing happened! Look at my inventory!',
    ],
    pitches: {
      sodaBomb: [
        'Soda Bomb! Warm, shaken, ready to burst!',
        'Take a Soda Bomb! Please, my cooler is humming!',
        'Galleria Cola Soda Bomb! Do not point at face!',
        'Hot Soda Bomb deal! Fizz first, mop later!',
      ],
      sparklerCake: [
        'Sparkler Cake! Sets the whole welcome mat ablaze!',
        'Party aisle Sparkler Cake! Do NOT light indoors!',
        'Sparkler Cake! Burns the crowd right off your heels!',
        'Buy a Sparkler Cake! Warranty already voided!',
      ],
      bubbleWrap: [
        'Bubble Wrap! Let the plastic take the bite!',
        'Fresh Bubble Wrap! Very chewable, surprisingly tough!',
        'Bubble Wrap! Sounds fun when a zombie pops it!',
        'Need padding? Bubble Wrap keeps the teeth off!',
      ],
      airHorn: [
        'Stadium Air Horn! Shoves a whole doorway backward!',
        'Need breathing room? Try a Stadium Air Horn! HOOONK!',
        'Stadium Air Horn! Stops a rushing cart dead cold!',
        'Too close? Stadium Air Horn clears your personal space!',
      ],
      glitterBomb: [
        'Glitter Bomb! Make the zombies fight each other!',
        'Congrats! It is a Glitter Bomb! Never comes out!',
        'Mail a Glitter Bomb! Let the crowd swing at itself!',
        'Glitter Bomb card! Sparkles ruin friendships fast!',
      ],
      sentry: [
        'SPIN-O-MATIC Sentry! A staple gun taped to a stand!',
        'SPIN-O-MATIC Sentry! Spins round and staples the lot!',
        'SPIN-O-MATIC Sentry! Do not look down the display!',
        'Need backup? Grab a SPIN-O-MATIC Sentry! Tape holds!',
      ],
    },
  },
  // Kevin's look (maps/mall/kioskCart.js): his clothes, the lanyard and the lid that covers the cart while he's away.
  //   duckSeconds  how fast he drops (and springs back up);  peekSeconds  how often he peeks over the counter while hiding
  vendor: {
    skin: 0xd5a16e, hair: 0x4a2c1a, shirt: 0x34a9a1, collar: 0x2b8a83, trousers: 0x5a4f6e, lanyard: 0xd8323a, badge: 0xf4f1e8,
    headset: 0x1d1626, eyes: 0x1d1626, mouth: 0x7a2730,
    badgeText: ['KEVIN', 'ASK ME A QUESTION'],
    duckSeconds: 0.16, peekSeconds: 2.4, turnSpeed: 4, maxTurn: 1.0, // (turnSpeed: how fast he turns to you; maxTurn: radians either way)
  },
  // The lid: a slatted roll-top over the counter while he's away (or before he opens). Its notice takes turns each time a
  // cart is left; flipped open behind him (lidSeconds) when he arrives.
  lid: {
    seconds: 0.55,
    slats: 0x8d8a96, slatDark: 0x6c6976, ink: '#1d1626',
    notices: ['BACK IN 5 MIN', 'GONE TO GET CHANGE', 'ON BREAK · DO NOT TOUCH', 'BACK SOON · PROBABLY', 'CLOSED · ALL SALES FINAL'],
  },
  // THE SHOW (fx/kioskSpectacle.js, browser side; looks only). Every burst also draws a ring out to the reach it really has,
  // so you learn each product's size by watching. [a, b] = a random value between the two.
  spectacle: {
    maxParticles: 700,
    ringSeconds: 0.4,
    // The Soda Bomb: a cola geyser for `seconds` and a ring of foam skidding out across the floor.
    cola: {
      seconds: 0.45, perSecond: 170, speed: [6, 10], spread: 0.22, gravity: 12, drag: 0.3, size: 0.05, life: [0.7, 1.1],
      colors: [0x5a2a12, 0x7a3b1c, 0xf6efe0, 0xc98a4b],
      foam: { count: 50, speed: [3, 5.5], color: 0xf6efe0, size: 0.06, life: [0.5, 0.8], gravity: 6, drag: 2.2 },
      ring: 0xc98a4b,
    },
    // The Glitter Bomb: a cloud that hangs, twinkles and drifts down, and a pinch more on every zombie it confused.
    glitter: {
      count: 150, perTarget: 14, life: [2.2, 3.4], size: 0.03, gravity: 0.5, drag: 1.4, speed: [0.6, 2.2],
      colors: [0xe08bff, 0xff8bd8, 0xfff3d4, 0x8bd8ff, 0xffe14d], ring: 0xe08bff,
    },
    // The Air Horn: rings of sound rolling out from where you stand, on the floor and at chest height.
    horn: { rings: 3, gap: 0.08, color: 0xfff3d4, chestHeight: 1.1 },
    // Bubble Wrap: a layer popping just in front of you (white bits) when it's used up.
    wrap: { count: 16, speed: [1.2, 2.6], size: 0.011, life: [0.18, 0.35], gravity: 3, distance: 0.55, colors: [0xdcefff, 0xffffff, 0xbfe3ff] },
    // The Sentry: a muzzle flash per shot; when its time is up it comes apart in pieces.
    sentry: { debris: 28, speed: [2, 4.5], size: 0.07, life: [0.9, 1.4], gravity: 9, drag: 0.4, sputterSeconds: 3, colors: [0x45246e, 0xd8d2c4, 0x3a3f4a, 0xffe14d], flash: 0xfff1b8 },
    // Comic words over the action (role toyBrand); `seconds` on screen, `size` m wide.
    words: { seconds: 0.9, size: 1.1, sodaBomb: 'FSSSHH!', airHorn: 'HOOONK!', glitterBomb: 'CONGRATS!', bubbleWrap: 'POP!', sentry: 'BZZT!' },
  },
  // The cart's three slots, left to right. A slot with several products ROTATES through them one step per `stockEveryRounds` block from
  // the opening round (the user's choice, 10 November 2026: no random stock; calmer 3-round cadence): rounds 2-4 sell the first of each,
  // rounds 5-7 the second, and so on. Bubble Wrap is always there. Kevin's Pick is the product on the cart that has waited longest
  // to be the Pick across blocks (ties: left to right), staying the same for the whole block and never picking one marked noPick
  // (the Sentry): stockFor / pickFor below. (Moving the Pick along the slots instead would lock it onto the Soda Bomb: the Lethal
  // slot's three-block cycle and the Pick's would line up.)
  slots: [
    ['sodaBomb', 'sparklerCake', 'sentry'], // Lethal
    ['bubbleWrap'],
    ['airHorn', 'glitterBomb'], // Tactical
  ],
  bubbleWrap: {
    name: 'Bubble Wrap',
    // The armour (player/health.js absorb; the stats in player/stats.js start from these): each layer absorbs this much of a
    // zombie hit before your health, then pops; at most maxLayers at once. 30 (was 40, phase 7): a full wrap absorbs 90% of your
    // health, so it never doubles what you can take (Shopper hits to death 3 -> 5, not 6). npm run kiosk prints the table.
    layerStrength: 30,
    maxLayers: 3,
    detail: 'Absorbs zombie hits before they reach your health. FRAGILE. This side towards zombies.',
    look: { sheet: 0xdcefff, core: 0xc9a46b, bubble: 0xf4fbff }, // the roll on the counter (world/kioskProducts.js)
  },

  // Equipment power (decision 4): 1.0 at round 10 (806 health), about 0.54 at round 1 and 1.7 at round 30.
  power: { baseHealth: 800, exponent: 0.37 },

  // SHOPPING BAGS (game/bagDrops.js): a zombie carrying a shopping bag sometimes drops it, with one thing from Kevin's cart inside: a charge
  // of a product (it goes in its pocket) or a Bubble Wrap layer. Walk over the bag to take it. Only something you have ROOM for is ever
  // in a bag (an empty pocket, or the same product below a full pocket; Bubble Wrap below the most layers), so it never replaces what you
  // carry, and a bag you can't use yet waits on the floor until it runs out. One bag at a time. The Sentry is never in a bag (Kevin's
  // big-ticket item). (Replaced the Party Trap and Clearance Rack Limited Editions, 15 November 2026.)
  bagDrops: {
    fromRound: 3,
    dropChance: 0.15, // per kill of a zombie carrying a shopping bag
    lifetimeSeconds: 30, // how long a bag waits on the floor
    pickupRadius: 1.1, pickupHeight: 1.2,
    spinSpeed: 1.8, glow: 0.5,
    marker: { floorGap: 2, up: 'upstairs', down: 'downstairs' }, // the HUD says which floor once the bag is this many metres above or below you
    // What a bag can hold (product ids, and 'bubbleWrap'): how likely, and the bag's colour.
    contents: {
      sodaBomb: { weight: 3, color: 0xd62839 },
      sparklerCake: { weight: 3, color: 0xffb627 },
      airHorn: { weight: 2, color: 0x3a86ff },
      glitterBomb: { weight: 2, color: 0xff5ec8 },
      bubbleWrap: { weight: 3, color: 0xdcefff },
    },
    pa: {
      drop: { kicker: 'Lost property', text: 'A customer has dropped a bag with a {name} in it. Finders keepers.' },
      taken: { kicker: 'Lost property', text: '{name} added to your pocket. Kevin would like you to know he saw that.' },
      wrapped: { kicker: 'Lost property', text: 'Bubble Wrap applied. Kevin would like you to know he saw that.' },
    },
  },

  // The throw (a tap; no cooking). The gun is blocked for `blockSeconds` (a reload in progress is cancelled).
  throw: {
    blockSeconds: 0.4,
    lobDegrees: 14, // thrown this much above the crosshair (a lob)
    startOffset: 0.45, // m in front of the eye...
    startDrop: 0.18, // ...and this far below it (out of the hand)
  },

  // The two pockets. Each holds one product at a time (with charges). Products name their pocket below.
  pockets: ['lethal', 'tactical'],

  products: {
    // A shaken two-litre of Galleria Cola. Lobbed, bounces (off floors, walls AND zombies, without hurting them), and bursts
    // when its fuse runs out: everything within the blast takes damage, falling off from the centre to the edge.
    sodaBomb: {
      id: 'sodaBomb',
      name: 'Soda Bomb',
      pocket: 'lethal',
      charges: 3, // a full pocket
      detail: 'A shaken bottle with a wide blast. Do not shake. Do shake.',
      fuseSeconds: 1.8,
      blast: {
        radius: 4, // m
        centreDamage: 850, // x equipmentPower(round)
        edgeFraction: 0.3, // at the very edge: 0.3 of the centre damage (linear in between)
        bossShare: 0.06, // a boss takes this share of its MAX health at the centre instead (same falloff): boss health already scales
      },
      // The bottle in the air (weapons/ballistics.js projectile block). It bounces off zombies without hurting them.
      projectile: {
        speed: 14, gravity: 12, restitution: 0.42, maxBounces: 30, radius: 0.12, minSpeed: 1.4,
        lifeSeconds: 10, // (the fuse ends it long before this; a bottle that stops rolling sits there until the fuse)
        rehitSeconds: 0.25, seekRange: 0,
      },
      impact: { flinch: 1.6, knockback: 3.5, hitstopSeconds: 0.03, deathImpulse: 1.8 }, // how a zombie reacts to the blast (zombie.takeHit)
      sounds: { throw: 'meleeSwing', bounce: 'tennisBounce', burst: 'sodaBurst' },
      look: {
        model: 'bottle', bottle: 0x7a3b1c, label: 0xd8323a, cap: 0xf4f1e8, // the bottle drawn in the air (fx/throwableView.js)
        splat: [0x5a2a12, 0x7a3b1c, 0xf6efe0, 0xc98a4b], // the burst: cola, foam and caramel
        splatCount: 46,
      },
    },
    // The Grand Finale Sparkler Cake (the party store). Lobbed; it lands, sits up and sprays sparks for spraySeconds: every
    // pulseSeconds, each zombie within sprayRadius (and in sight of it) is set burning (zombie.applyBurn, the Fryer Oil burn).
    // A boss burns at bossFactor of that. Burns don't stack: standing in it keeps one burning.
    sparklerCake: {
      id: 'sparklerCake',
      name: 'Sparkler Cake',
      pocket: 'lethal',
      charges: 2,
      detail: 'Sits where it lands and sets everything round it on fire for a while. Bosses only half catch. Indoor use voids the warranty and the mall.',
      opens: 'floor', // starts spraying where it first touches the floor (or wherever it stops)
      landSeconds: 4, // still in the air (or on a ledge) this long after the throw: it starts anyway
      spray: {
        radius: 3, // m
        seconds: 4,
        pulseSeconds: 0.5,
        floorTolerance: 1.2, // zombies further above or below the cake than this are on another floor
        burn: { damage: 450, seconds: 3, tickSeconds: 0.5 }, // damage over `seconds`, x equipmentPower(round)
        bossFactor: 0.5,
      },
      projectile: {
        speed: 12, gravity: 12, restitution: 0.2, maxBounces: 6, radius: 0.14, minSpeed: 1.2,
        lifeSeconds: 6, rehitSeconds: 0.25, seekRange: 0,
      },
      sounds: { throw: 'meleeSwing', bounce: 'tennisBounce', spray: 'stuffingFryer' },
      look: {
        model: 'cake', cake: 0xf7d6e0, icing: 0xff6fa8, wick: 0xf4f1e8, doily: 0xfdf8ee, // the cake in the air, on the floor and on the counter
        sparks: { colors: [0xffe27a, 0xffb02e, 0xfff6d8], count: 10, speed: 3.2, size: 0.035 }, // each pulse (effects.confetti)
      },
    },
    airHorn: {
      id: 'airHorn',
      name: 'Stadium Air Horn',
      pocket: 'tactical',
      charges: 2,
      detail: 'Pushes zombies back and interrupts charges. Bosses ignore it.',
      horn: {
        radius: 6, floorTolerance: 1.2, chestHeight: 1.1,
        stagger: { seconds: 1.2, knockback: 7, drag: 5 },
        sound: 'stadiumAirHorn',
      },
      look: { can: 0xd8323a, valve: 0x1d1626, horn: 0xf4f1e8 }, // on the counter (world/kioskProducts.js)
    },
    // The Glitter Bomb Greeting Card. Lobbed; it opens where it first touches anything (floor, wall or zombie): up to
    // maxTargets zombies within radius of it (in sight, nearest first) are confused for `seconds` and fight each other
    // (zombie.applyConfusion, the same confusion as Build-A-Blaster's Glitter: zombies/confusion.js). Bosses refuse it.
    // The SPIN-O-MATIC Sentry: Kevin's own display stand with a staple gun taped on. Lobbed like the rest; where it first touches
    // the floor (or stops) it stands up and, for lifeSeconds, spins and fires at the nearest zombie it can see from its muzzle
    // (a hitscan shot every fireSeconds, damage x equipmentPower(round); bosses are hit normally). Then it falls apart. One out
    // at a time (no second throw while one is out), no collider (zombies walk through it: they can't target it, decision 5),
    // never Sunny or anything without a zombie type. Its kills carry weaponId 'sentry'. Never Kevin's Pick (noPick).
    sentry: {
      id: 'sentry',
      name: 'SPIN-O-MATIC Sentry',
      pocket: 'lethal',
      charges: 1,
      noPick: true,
      detail: 'Sets itself up where it lands and shoots the nearest zombie it can see for a while, then falls apart. One out at a time. Batteries not included. Neither is supervision.',
      opens: 'floor',
      landSeconds: 4,
      turret: {
        lifeSeconds: 30,
        warmupSeconds: 0.6, // from landing to its first shot (it stands up)
        fireSeconds: 0.2, // a shot every this many seconds (5 a second: under half a held Price Gun's rate)
        damage: 58, // a Price Gun sticker, x equipmentPower(round)
        range: 15, // m
        muzzleHeight: 0.95, // m above where it landed
        spinSpeed: 2.5, // turns a second while it hunts (the view)
        weaponId: 'sentry',
        impact: { flinch: 0.8, knockback: 0.6, hitstopSeconds: 0, deathImpulse: 1 },
      },
      projectile: {
        speed: 11, gravity: 12, restitution: 0.15, maxBounces: 6, radius: 0.16, minSpeed: 1.2,
        lifeSeconds: 6, rehitSeconds: 0.25, seekRange: 0,
      },
      sounds: { throw: 'meleeSwing', bounce: 'tennisBounce', deploy: 'dryClick', fire: 'sentryShot' },
      look: {
        model: 'sentry', stand: 0xd8d2c4, base: 0x45246e, gun: 0x3a3f4a, sign: 0xffe14d, tape: 0xb8b2a6, // the stand (world/kioskProducts.js)
        tracer: 0xe8eef5, // a silver staple streak
      },
    },
    glitterBomb: {
      id: 'glitterBomb',
      name: 'Glitter Bomb',
      pocket: 'tactical',
      charges: 2,
      detail: 'Opens where it lands: zombies round it turn on each other for a while. Bosses ignore it. Congratulations! It never comes out.',
      opens: 'touch',
      landSeconds: 3, // still in the air this long after the throw: it opens anyway
      confuse: {
        radius: 4, // m
        seconds: 6,
        maxTargets: 8,
        floorTolerance: 1.2,
        hitDamage: 75, // each swing a confused zombie lands on another, x equipmentPower(round)
      },
      projectile: {
        speed: 13, gravity: 12, restitution: 0.3, maxBounces: 4, radius: 0.1, minSpeed: 1.2,
        lifeSeconds: 6, rehitSeconds: 0.25, seekRange: 0,
      },
      sounds: { throw: 'meleeSwing', bounce: 'tennisBounce', open: 'stuffingGlitter' },
      look: {
        model: 'card', card: 0xfff3d4, envelope: 0xe08bff, // the card drawn in the air (fx/throwableView.js)
        burst: { colors: [0xe08bff, 0xff8bd8, 0xfff3d4, 0x8bd8ff], count: 40, speed: 3, size: 0.045 }, // the glitter when it opens
      },
    },
  },
};

/** The product config for an id (or null). */
export function productOf(id) {
  return kiosk.products[id] ?? null;
}

/** Block index from `openingRound` for `round` (each block lasts `stockEveryRounds` rounds). */
function stockBlock(round) {
  const every = Math.max(1, kiosk.stockEveryRounds);
  return Math.floor(Math.max(0, round - kiosk.openingRound) / every);
}

/** The cart's three products in `round` (each slot advances once per `stockEveryRounds` block from the opening round; before it, the first of each). */
export function stockFor(round) {
  const block = stockBlock(round);
  return kiosk.slots.map((choices) => choices[block % choices.length]);
}

const pickCache = new Map(); // (pickFor replays the blocks from the opening one; the answer for a block never changes)
/** Kevin's Pick in `round`: the product on sale that has waited longest to be the Pick (never a noPick one), or null before he opens. */
export function pickFor(round) {
  if (round < kiosk.openingRound) return null;
  const every = Math.max(1, kiosk.stockEveryRounds);
  const block = stockBlock(round);
  const key = `${kiosk.openingRound}:${every}:${block}`;
  if (pickCache.has(key)) return pickCache.get(key);
  const last = new Map(); // product -> the last block it was the Pick
  let pick = null;
  for (let b = 0; b <= block; b++) {
    const r = kiosk.openingRound + b * every;
    const options = stockFor(r).filter((id) => !productOf(id)?.noPick);
    pick = options.reduce((best, id) => ((last.get(id) ?? -1) < (last.get(best) ?? -1) ? id : best), options[0] ?? null);
    last.set(pick, b);
  }
  pickCache.set(key, pick);
  return pick;
}
