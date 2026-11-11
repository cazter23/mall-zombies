// =============================================================================
// DEATH REPORTS (FORM 109-C)
// Satirical OSHA / Mall HR copy detailing causes of death and loss prevention
// survival tips per lethal blow source.
// Follows the words-only rule: no %, multipliers or raw stat numbers.
// =============================================================================

export const deathReports = {
  fall: {
    cause: 'Traumatic deceleration from Level 2 railing',
    tip: 'Associate Tip: Use stairs and escalators between concourses; perimeter railings are not slides.',
  },

  zombies: {
    shopper: {
      cause: 'Fatal blunt force trauma from dissatisfied customer',
      tip: 'Associate Tip: Maintain active floor spacing and backpedal while delivering price markdowns.',
    },
    cartPusher: {
      cause: 'Unauthorized impact with moving shopping cart',
      tip: 'Associate Tip: A rattling cart is taking aim; sidestep as it charges, because it cannot turn.',
    },
    mallWalker: {
      cause: 'Aggressive pacing incident involving unsanctioned power-walking patron',
      tip: 'Associate Tip: Power walkers tire rapidly after swings; exploit their winded recovery window.',
    },
    mannequin: {
      cause: 'Unsupervised display movement during visual inspection lapse',
      tip: 'Associate Tip: Maintain constant visual contact; display mannequins freeze while observed.',
    },
    mascot: {
      cause: 'Hostile interaction with costumed entertainment personnel',
      tip: 'Associate Tip: Mascot foam dampens body damage; concentrate continuous fire on the helmet.',
    },
  },

  mascots: {
    sirWaffles: {
      cause: 'Severe blunt trauma from uncertified oversized breakfast knight',
      tip: 'Associate Tip: Target the syrup-soaked helmet to crack armor before engaging the torso.',
    },
    captainCoupon: {
      cause: 'Promotional bludgeoning by discount mascot',
      tip: 'Associate Tip: The coupon mascot pauses to re-affix detached headwear; press the attack while he retrieves it.',
    },
    poppyCorn: {
      cause: 'Concussive thermal kernel eruption within concession zone',
      tip: 'Associate Tip: Back out of blast radius when popcorn mascot begins violent thermal popping.',
    },
    scoops: {
      cause: 'Severe hypothermic slip and blunt force trauma from dairy mascot',
      tip: 'Associate Tip: Avoid melted dairy trails to maintain traction and prevent speed reduction.',
    },
  },

  bosses: {
    janitor: {
      cause: 'Slip and fall on unauthorized wet floor surface',
      tip: 'Associate Tip: Step around yellow caution cones to avoid janitorial slow zones.',
    },
    guard: {
      cause: 'Excessive corporate security intervention and unauthorized detention',
      tip: 'Associate Tip: Land consecutive headshots to disable emergency lockdown radios and reopen exits.',
    },
    manager: {
      cause: 'Mandatory all-hands performance intervention resulting in terminal downsizing',
      tip: 'Associate Tip: Concentrate fire during staff meetings to cancel presentations before employee buffs apply.',
    },
    influencer: {
      cause: 'Fatal flash overexposure and mobbing by unvetted brand followers',
      tip: 'Associate Tip: Look away during flash photography windup to prevent blinding and stay clear of stream fans.',
    },
  },

  // Your own hazard switch (config/hazards.js ids of hazards that hurt the player). Any other gets hazardDefault.
  hazards: {
    fountain: {
      cause: 'Unscheduled immersion in electrified decorative water feature',
      tip: 'Associate Tip: Throw the fountain breaker, then stand clear of the water until the current is off.',
    },
    fryer: {
      cause: 'Hot oil exposure during unauthorized fryer venting',
      tip: 'Associate Tip: Vented fryer oil does not check badges; vacate the spill zone before opening the valve.',
    },
  },
  hazardDefault: {
    cause: 'Self-inflicted facilities incident',
    tip: 'Associate Tip: Mall hazards cannot tell staff from shoppers; stand clear before you pull the switch.',
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
