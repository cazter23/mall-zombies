// =============================================================================
// DEATH REPORTS (FORM 109-C)
// Satirical OSHA / Mall HR copy detailing causes of death and loss prevention
// survival tips per lethal blow source.
// Follows the words-only rule: no %, multipliers or raw stat numbers.
// =============================================================================

export const deathReports = {
  fall: {
    cause: 'Traumatic deceleration from upper-level railing',
    tip: 'Associate Tip: Use stairs and escalators between floors; perimeter railings are not slides.',
  },

  zombies: {
    shopper: {
      cause: 'Fatal blunt force trauma from dissatisfied customer',
      tip: 'Associate Tip: Later in the shift, shoppers start to run; turn and sprint rather than backpedal, and aim high.',
    },
    cartPusher: {
      cause: 'Unauthorized impact with moving shopping cart',
      tip: 'Associate Tip: It steers while the cart rattles; sidestep once it launches, then hit it hard while it sits stunned.',
    },
    mallWalker: {
      cause: 'Aggressive pacing incident involving unsanctioned power-walking patron',
      tip: 'Associate Tip: Power walkers outpace a backpedal; sprint clear, then fire while they stand panting after a swing.',
    },
    mannequin: {
      cause: 'Unsupervised display movement during visual inspection lapse',
      tip: 'Associate Tip: Keep display mannequins in sight while you drop them; the moment you look away, they move.',
    },
    mascot: {
      cause: 'Hostile interaction with costumed entertainment personnel',
      tip: 'Associate Tip: The helmet comes off at half health; expect a brief shake, then a rush faster than you walk.',
    },
  },

  mascots: {
    sirWaffles: {
      cause: 'Severe blunt trauma from uncertified oversized breakfast knight',
      tip: 'Associate Tip: Knock the helmet off with a headshot or the box cutter for a bonus, then back off: he rushes.',
    },
    captainCoupon: {
      cause: 'Promotional bludgeoning by discount mascot',
      tip: 'Associate Tip: When his helmet drops, finish him or stand on it; once it is back on, so is most of his health.',
    },
    poppyCorn: {
      cause: 'Post-kernel melee assault by pressurized concession mascot',
      tip: 'Associate Tip: Her pop at half health only shoves and butters you; the rush that follows is the dangerous part.',
    },
    scoops: {
      cause: 'Chilled blunt force trauma compounded by melted dairy slowdowns',
      tip: 'Associate Tip: Scoops leaves slowing puddles, twice as often once unmasked; do not retreat along his trail.',
    },
    twisty: {
      cause: 'Seasoned blunt force trauma from a freshly uncrusted pretzel ambassador',
      tip: 'Associate Tip: Twisty drops harmless salt when his helmet pops; hear it crunch and check behind you.',
    },
  },

  bosses: {
    janitor: {
      cause: 'Heavy janitorial mop impact following wet-floor entanglement',
      tip: 'Associate Tip: Murray mops as he runs; circle wide instead of backing through his trail. The stairs stay dry.',
    },
    guard: {
      cause: 'Excessive corporate security intervention and unauthorized detention',
      tip: 'Associate Tip: Sidestep his taser charge; during an alarm or lockdown, gun headshots break his radio for good.',
    },
    manager: {
      cause: 'Mandatory all-hands performance intervention resulting in terminal downsizing',
      tip: 'Associate Tip: In a staff meeting he stands still and takes extra damage; hurt him enough and the buff never happens.',
    },
    influencer: {
      cause: 'Fatal flash overexposure and mobbing by unvetted brand followers',
      tip: 'Associate Tip: Look away during her flash windup; every hit cuts her follower count, headshots most of all.',
    },
    lastCustomer: {
      cause: 'Terminal customer service escalation after advertised closing hours',
      tip: 'Associate Tip: Once she is Speechless, stamp her hand or use Return to Sender before she recovers.',
    },
  },

  // Your own hazard switch (config/hazards.js ids of hazards that hurt the player). Any other gets hazardDefault.
  hazards: {
    fountain: {
      cause: 'Contact with electrified decorative fountain runoff',
      tip: 'Associate Tip: Throw the breaker, then stay off the wet apron around the fountain until the current is off.',
    },
    fryer: {
      cause: 'Hot oil exposure during unauthorized fryer venting',
      tip: 'Associate Tip: Vented fryer oil does not check badges; stay off the counter apron until the spill clears.',
    },
  },
  // Your own rocket (the Bottle Rocket Bazooka: killedBy { type: 'ownBlast' }).
  ownBlast: {
    cause: 'Self-administered fireworks display, indoors, at close range',
    tip: 'Associate Tip: Bottle rockets are for the far end of the Hallway. The Hi-Vis Vest in the Service Corridor helps.',
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
