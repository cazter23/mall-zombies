// One workshop build per carried gun, separate from tiers and attachments.
export const workshopBuilds = {
  partyTrap: {
    weapon: 'confettiCannon', name: 'Party Trap', color: 0xff59a9,
    instructions: 'Aim down sights and shoot the floor to plant a charge.',
    aimAmount: 0.8, placementRange: 6, armSeconds: 0.5, lifetimeSeconds: 35,
    maxActive: 2, triggerRadius: 0.7, blastRadius: 2.3, damage: 650, maxTargets: 5,
    footTolerance: 0.5, blastHeight: 0.16,
    pop: { delaySeconds: .18, count: 54, speed: 5.6, size: .083,
      colors: [0xff4e92, 0xffcf51, 0x54e4cd, 0x8b79fd, 0xfff3d4] },
  },
  skateFeed: {
    weapon: 'priceGun', name: 'Skate Feed', color: 0x54e4cd,
    instructions: 'Start a slide to feed rounds from reserve into the magazine.',
    rounds: 6, cooldownSeconds: 2.5,
  },
};

export const workshopModOf = (mods) => mods?.find(m => m.id === 'workshop')?.workshop;
