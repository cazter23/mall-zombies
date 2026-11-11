// =============================================================================
// KIOSK KEVIN CONFIG: Kevin's five carts and the move rule, his stock and the equipment in your pockets.
// Prices live in config/economy.js and are applied by g.pricing.
//
// Every equipment damage is multiplied by ONE number, equipmentPower(round) (game/equipment/equipmentDamage.js):
//   (zombieHealthForRound(round) / power.baseHealth) ^ power.exponent
// so it grows with the round, but far slower than zombie health: strong early, weaker late, never useless.
// =============================================================================

export const kiosk = {
  // WHERE KEVIN IS (docs/kiosk-kevin-plan.md, "Where Kevin is"). Every site has a cart in the map all the time (maps/mall/kioskCart.js);
  // only one is live, the others say "BACK IN 5 MIN" (no collider is added or moved at runtime). Every run starts at the FIRST site.
  // At each 'roundStart' after the opening round he moves to a random OTHER site whose zone is open (none open: he stays put),
  // never mid-purchase (the move waits until the hold is let go) and never into a locked zone. game/features/kiosk.js.
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
  // A cart (maps/mall/kioskCart.js): a low counter, vaultable on its short side, with three slots along its front.
  cart: { width: 2.2, depth: 0.75, height: 1.05, slotSpacing: 0.72, signWidth: 1.9, productY: 0.83 },
  spawnClearance: 5, // m: no zombie spawn this close to a site's stand point (checked by the tests)
  // The mall PA, once per round when Kevin opens for the round ({where} = the site's `where`, {stock} = the round's three products,
  // {pick} = Kevin's Pick).
  pa: {
    kicker: "Kevin's cart",
    opened: "Kevin's cart is open in {where}.",
    moved: "Kevin's cart is now in {where}. He's asked us to say it's a limited time only.",
    stock: "Today on Kevin's cart: {stock}. Kevin's Pick is {pick}.",
  },
  openingRound: 2,
  duckRadius: 3,
  // The cart's three slots, left to right. A slot with several products ROTATES through them round by round from the opening
  // round (the user's choice, 10 November 2026: no random stock): round 2 sells the first of each, round 3 the second, and so on.
  // Bubble Wrap is always there. Kevin's Pick is the product on the cart that has waited longest to be the Pick (ties: left to
  // right), never one marked noPick (the Sentry): stockFor / pickFor below. (Moving the Pick along the slots instead would lock
  // it onto the Soda Bomb: the Lethal slot's three-round cycle and the Pick's would line up.)
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
  },

  // Equipment power (decision 4): 1.0 at round 10 (806 health), about 0.54 at round 1 and 1.7 at round 30.
  power: { baseHealth: 800, exponent: 0.37 },

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
        model: 'cake', cake: 0xf7d6e0, icing: 0xff6fa8, wick: 0xf4f1e8, // the cake drawn in the air and on the floor (fx/throwableView.js)
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
      sounds: { throw: 'meleeSwing', bounce: 'tennisBounce', deploy: 'dryClick', fire: 'stapleShot' },
      look: {
        model: 'sentry', stand: 0xd8d2c4, base: 0x45246e, gun: 0x3a3f4a, sign: 0xffe14d, // the stand (fx/throwableView.js)
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

/** The cart's three products in `round` (each slot's choices alternate from the opening round; before it, the first of each). */
export function stockFor(round) {
  const n = Math.max(0, round - kiosk.openingRound);
  return kiosk.slots.map((choices) => choices[n % choices.length]);
}

const pickCache = new Map(); // (pickFor replays the rounds from the opening one; the answer for a round never changes)
/** Kevin's Pick in `round`: the product on sale that has waited longest to be the Pick (never a noPick one), or null before he opens. */
export function pickFor(round) {
  if (round < kiosk.openingRound) return null;
  if (pickCache.has(round)) return pickCache.get(round);
  const last = new Map(); // product -> the last round it was the Pick
  let pick = null;
  for (let r = kiosk.openingRound; r <= round; r++) {
    const options = stockFor(r).filter((id) => !productOf(id)?.noPick);
    pick = options.reduce((best, id) => ((last.get(id) ?? -1) < (last.get(best) ?? -1) ? id : best), options[0] ?? null);
    last.set(pick, r);
  }
  pickCache.set(round, pick);
  return pick;
}
