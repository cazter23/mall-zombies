// One workshop build per carried gun, separate from tiers and attachments.
export const workshopBuilds = {
  partyTrap: {
    weapon: 'confettiCannon', name: 'Party Trap', color: 0xff59a9,
    instructions: 'Aim down sights and shoot the floor to plant a charge.',
    aimAmount: 0.8, placementRange: 6, armSeconds: 0.5, lifetimeSeconds: 35,
    maxActive: 2, triggerRadius: 0.7, blastRadius: 2.3, damage: 650, maxTargets: 5,
    footTolerance: 0.5, blastHeight: 0.16,
    pop: { delaySeconds: .36, ribbonSeconds: .52, pullMeters: .46, liftMeters: .27, count: 54, speed: 5.6, size: .083,
      colors: [0xff4e92, 0xffcf51, 0x54e4cd, 0x8b79fd, 0xfff3d4] },
  },
  clearanceRack: {
    weapon: 'priceGun', name: 'Clearance Rack', color: 0xff6b36,
    instructions: 'Tag up to three zombies with body shots. Headshot a tagged zombie to pop all tags.',
    maxTags: 3, damageMultiplier: 3,
    pop: { count: 16, speed: 3.1, size: .059, colors: [0xff5933, 0xffd657, 0xfff2ca] },
  },
};

export const workshopModOf = (mods) => mods?.find(m => m.id === 'workshop')?.workshop;
