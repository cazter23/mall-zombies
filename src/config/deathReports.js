// =============================================================================
// DEATH REPORTS (FORM 109-C)
// Satirical OSHA / Mall HR copy detailing causes of death and loss prevention
// survival tips per lethal blow source.
// Follows the words-only rule: no %, multipliers or raw stat numbers.
// =============================================================================

export const deathReports = {
  fall: {
    cause: 'Traumatic deceleration from upper-level railing',
    tip: 'Associate Tip: Use stairs and escalators between floors instead of vaulting over upper railings.',
  },

  zombies: {
    shopper: {
      cause: 'Fatal blunt force trauma from dissatisfied customer',
      tip: 'Associate Tip: Do not rely on backpedaling once shoppers start sprinting; break away at a run, aim for heads, and funnel packs through doorways.',
    },
    cartPusher: {
      cause: 'Unauthorized impact with moving shopping cart',
      tip: 'Associate Tip: It still steers while the cart rattles; wait for the charge to launch before sidestepping, and let solid cover stun it for bonus damage.',
    },
    mallWalker: {
      cause: 'Aggressive pacing incident involving unsanctioned power-walking patron',
      tip: 'Associate Tip: Mall walkers outpace normal backing up; sprint out of arm reach to bait a swing, then fire while they bend over panting.',
    },
    mannequin: {
      cause: 'Unsupervised display movement during visual inspection lapse',
      tip: 'Associate Tip: Keep mannequins in clear sight while dropping them first; looking away or ducking behind pillars releases them immediately.',
    },
    mascot: {
      cause: 'Hostile interaction with costumed entertainment personnel',
      tip: 'Associate Tip: Soften mascots from range before the helmet pops at half health; once unmasked, they shake briefly and rush faster than a walk.',
    },
  },

  mascots: {
    sirWaffles: {
      cause: 'Severe blunt trauma from uncertified oversized breakfast knight',
      tip: 'Associate Tip: Wear down Sir Waffles from range; once the helmet pops at half health he rushes hard, and helmet hits earn a pop bonus.',
    },
    captainCoupon: {
      cause: 'Promotional bludgeoning by discount mascot',
      tip: 'Associate Tip: Finish him while he walks back to retrieve his dropped helmet; letting him put it back on restores most of his health.',
    },
    poppyCorn: {
      cause: 'Post-kernel melee assault by pressurized concession mascot',
      tip: 'Associate Tip: Expect a harmless instant shove and butter splatter when her helmet pops at half health, then sprint clear of her rush.',
    },
    scoops: {
      cause: 'Chilled blunt force trauma compounded by melted dairy slowdowns',
      tip: 'Associate Tip: Keep moving forward instead of backing along his path; Scoops drips slowing puddles steadily and twice as often unmasked.',
    },
  },

  bosses: {
    janitor: {
      cause: 'Heavy janitorial mop impact following wet-floor entanglement',
      tip: 'Associate Tip: Fight in wide loops rather than backing straight up; Murray leaves slowing blue puddles behind him that cannot form on stairs.',
    },
    guard: {
      cause: 'Excessive corporate security intervention and unauthorized detention',
      tip: 'Associate Tip: Sidestep his taser charge into cover, move into an open area when the alarm sounds, and land gun headshots to break his radio.',
    },
    manager: {
      cause: 'Mandatory all-hands performance intervention resulting in terminal downsizing',
      tip: 'Associate Tip: Save magazines for staff meetings; shoppers freeze and Fairweather takes extra damage, letting you cancel his mall-wide buff.',
    },
    influencer: {
      cause: 'Fatal flash overexposure and mobbing by unvetted brand followers',
      tip: 'Associate Tip: Look away during her flash windup to avoid blinding, headshot Skylar to drop follower count, and defeat her to disperse fans.',
    },
    lastCustomer: {
      cause: 'Terminal customer service escalation after advertised closing hours',
      tip: 'Associate Tip: Crash her charge into the vans to reach Speechless, then finish her with Return to Sender or a hand stamp before she heals.',
    },
  },

  // Your own hazard switch (config/hazards.js ids of hazards that hurt the player). Any other gets hazardDefault.
  hazards: {
    fountain: {
      cause: 'Contact with electrified decorative fountain runoff',
      tip: 'Associate Tip: Pull the breaker and immediately step off the flooded stone apron; electrified water damages and slows staff until the cycle ends.',
    },
    fryer: {
      cause: 'Hot oil exposure during unauthorized fryer venting',
      tip: 'Associate Tip: Deep-fryer oil slows and scalds anyone inside the kitchen spill zone; clear the line immediately after turning the valve.',
    },
  },
  // Your own rocket (the Bottle Rocket Bazooka: killedBy { type: 'ownBlast' }).
  ownBlast: {
    cause: 'Self-administered fireworks display, indoors, at close range',
    tip: 'Associate Tip: Give Bottle Rocket bursts plenty of room or solid cover, or wear the Hi-Vis Vest hanging in the Service Corridor.',
  },
  hazardDefault: {
    cause: 'Self-inflicted facilities incident',
    tip: 'Associate Tip: Mall hazards cannot tell staff from shoppers; pull the control and clear the marked zone immediately.',
  },

  default: {
    cause: 'Unclassified workplace casualty under review by regional risk assessment',
    tip: 'Associate Tip: Report all unsafe retail floor hazards to Loss Prevention before expiring.',
  },
};

/**
 * Resolves the incident report (cause of death and loss prevention tip) for a given lethal blow source.
 * @param {object|null} killedBy - { type, id, variant, boss, fall }
 * @returns {{ cause: string, tip: string }}
 */
export function getDeathReport(killedBy) {
  if (!killedBy) return deathReports.default;
  if (killedBy.fall || killedBy.type === 'fall') return deathReports.fall;
  if (killedBy.type === 'ownBlast') return deathReports.ownBlast;
  if (killedBy.type === 'hazard') return deathReports.hazards[killedBy.id] ?? deathReports.hazardDefault;
  if (killedBy.boss && deathReports.bosses[killedBy.boss]) {
    return deathReports.bosses[killedBy.boss];
  }
  if (killedBy.id && deathReports.bosses[killedBy.id]) {
    return deathReports.bosses[killedBy.id];
  }
  if (killedBy.id === 'mascot' && killedBy.variant && deathReports.mascots[killedBy.variant]) {
    return deathReports.mascots[killedBy.variant];
  }
  if (killedBy.id && deathReports.zombies[killedBy.id]) {
    return deathReports.zombies[killedBy.id];
  }
  return deathReports.default;
}
