import { closingTime } from '../../config/closingTime.js';

// What the van still needs, in the order the prompt reads it: every missing key first, then the unfinished duties
// by name. A duty whose key is still missing is not listed as well (its key already stands for it), so the prompt
// stays short enough to read.
export function vanNeeds(closing) {
  const duties = closing.missingDuties.filter(({ bossId }) => closing.hasKey(bossId)).map(({ duty }) => duty);
  return [...closing.missingKeys, ...duties];
}

export function buildEscapeVan(feature, { map, closing, interactions, events, state }) {
  const { name, verb, blockedPrefix, priceLabel } = closingTime.van;
  interactions.add({
    id: feature.name,
    label: name,
    verb,
    cost: 0,
    priceLabel,
    quiet: true,
    position: feature.position,
    available: () => map.zones[feature.zone].open && !state.over && !state.won,
    get blocked() {
      if (closing.readyToLeave) return null;
      return blockedPrefix + vanNeeds(closing).join(', ');
    },
    use: () => events.emit('escapeVanStart'),
  });
}
