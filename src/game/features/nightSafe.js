import { closingTime } from '../../config/closingTime.js';

export function buildNightSafe(feature, { map, closing, interactions, pricing, state }) {
  const { name, verb, done, complete, requires } = closingTime.nightSafe;
  const { key } = closingTime.lines.guard;
  const id = 'nightSafe';
  const isDone = () => closing.isDone('guard');
  interactions.add({
    id,
    kind: 'closing',
    label: name,
    verb,
    position: feature.position,
    available: () => map.zones[feature.zone].open && !state.over,
    get cost() { return isDone() ? 0 : pricing.priceOf('closing', id); },
    get priceLabel() { return isDone() ? done : null; },
    get blocked() {
      if (isDone()) return complete;
      return closing.hasKey('guard') ? null : requires + key;
    },
    use() {}, // The normal purchase event advances the checklist after payment.
  });
}
