// =============================================================================
// KIOSK KEVIN CONFIG: the equipment you carry in your two pockets, and (later) Kevin's cart.
// Phase 1 (docs/kiosk-kevin-plan.md): the Lethal and Tactical pockets, the throw, and the Soda Bomb. Kevin, his cart,
// the other products and their prices come in later phases (prices will live in config/economy.js economy.kiosk).
//
// Every equipment damage is multiplied by ONE number, equipmentPower(round) (game/equipment/equipmentDamage.js):
//   (zombieHealthForRound(round) / power.baseHealth) ^ power.exponent
// so it grows with the round, but far slower than zombie health: strong early, weaker late, never useless.
// =============================================================================

export const kiosk = {
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
  },
};

/** The product config for an id (or null). */
export function productOf(id) {
  return kiosk.products[id] ?? null;
}
