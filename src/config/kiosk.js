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
  // The mall PA, once per round when Kevin opens for the round ({where} = the site's `where`, {pick} = Kevin's Pick).
  pa: {
    kicker: "Kevin's cart",
    opened: "Kevin's cart is open in {where}.",
    moved: "Kevin's cart is now in {where}. He's asked us to say it's a limited time only.",
    pick: "Kevin's Pick is {pick}.",
  },
  openingRound: 2,
  duckRadius: 3,
  stock: ['sodaBomb', 'bubbleWrap', 'airHorn'], // also the order of Kevin's Pick
  bubbleWrap: {
    name: 'Bubble Wrap',
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
        bottle: 0x7a3b1c, label: 0xd8323a, cap: 0xf4f1e8, // the bottle drawn in the air (fx/throwableView.js)
        splat: [0x5a2a12, 0x7a3b1c, 0xf6efe0, 0xc98a4b], // the burst: cola, foam and caramel
        splatCount: 46,
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
  },
};

/** The product config for an id (or null). */
export function productOf(id) {
  return kiosk.products[id] ?? null;
}
