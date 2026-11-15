import { closingTime } from '../../config/closingTime.js';

// Every missing key first, then the unfinished duties whose key is already held.
function prerequisites(closing) {
  const duties = closing.missingDuties.filter(({ bossId }) => closing.hasKey(bossId)).map(({ duty }) => duty);
  return [...closing.missingKeys, ...duties];
}

export function vanNeeds(closing) {
  return [...prerequisites(closing), ...(closing.validated ? [] : [closingTime.validation.missing]),
    ...(closing.lastCustomerDefeated ? [] : [closingTime.finale.missing])];
}

// Classic names one missing thing at a time, using the duty's place rather than the checklist line.
function prerequisiteClassic(closing) {
  const { needs, unfinished } = closingTime.classic;
  const [key] = closing.missingKeys;
  if (key) return needs + key;
  const [duty] = closing.missingDuties;
  return duty ? unfinished + duty.place : null;
}

export function vanNeedsClassic(closing) {
  return prerequisiteClassic(closing) ?? (closing.validated ? null : closingTime.classic.needs + closingTime.validation.missing)
    ?? (closing.lastCustomerDefeated ? null : closingTime.classic.needs + closingTime.finale.missing);
}

export function buildEscapeVan(feature, { map, closing, interactions, pricing, events, state }) {
  const { name, verb, blockedPrefix, priceLabel } = closingTime.van;
  // (Not in an arena run: Lot Full has no Closing Time, so no van to start and nothing to validate.)
  const available = () => map.zones[feature.zone].open && !state.over && !state.won && state.closingQuest !== false;
  const machine = closingTime.validation;
  interactions.add({
    id: 'validation',
    kind: 'closing',
    label: machine.name,
    verb: machine.verb,
    position: feature.validation.position,
    available,
    get cost() { return closing.validated ? 0 : pricing.priceOf('closing', 'validation'); },
    get priceLabel() { return closing.validated ? machine.done : null; },
    get blocked() {
      if (closing.validated) return closing.lastCustomerDefeated ? machine.cleared : machine.complete;
      if (closing.readyToValidate) return null;
      return state.showClosingGuidance ? blockedPrefix + prerequisites(closing).join(', ') : prerequisiteClassic(closing);
    },
    use() {}, // The paid purchase event validates once in g.closing and announces closingValidated.
  });
  interactions.add({
    id: feature.name,
    label: name,
    verb,
    cost: 0,
    priceLabel,
    quiet: true,
    position: feature.position,
    available,
    get blocked() {
      if (closing.readyToLeave) return null;
      return state.showClosingGuidance ? blockedPrefix + vanNeeds(closing).join(', ') : vanNeedsClassic(closing);
    },
    use: () => events.emit('escapeVanStart'),
  });
}
