import { closingTime } from '../../config/closingTime.js';

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
      const missing = closing.missingKeys;
      if (!missing.length) return null;
      return state.showClosingGuidance ? blockedPrefix + missing.join(', ') : 'Locked';
    },
    use: () => events.emit('escapeVanStart'),
  });
}
