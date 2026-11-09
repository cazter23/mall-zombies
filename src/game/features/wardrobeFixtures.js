import { wardrobeItems, wardrobeSlots } from '../../config/wardrobe.js';

function describe(id, wardrobe) {
  const item = wardrobeItems[id];
  const current = wardrobe.wearing(item.slot);
  const replacement = current ? `Replaces ${wardrobeItems[current].name}` : `${wardrobeSlots[item.slot]} slot`;
  return `${item.tradeoff} · ${replacement}`;
}

export function buildWardrobeRack(spot, { map, pricing, interactions, wardrobe }) {
  const { item: id, zone, position } = spot;
  const { name } = wardrobeItems[id];
  interactions.add({
    kind: 'wardrobe',
    id,
    label: name,
    verb: 'buy',
    position,
    get detail() { return describe(id, wardrobe); },
    get cost() { return pricing.priceOf('wardrobe', id); },
    available: () => map.zones[zone].open && !wardrobe.owns(id),
    use: () => wardrobe.buy(id),
  });
}

export function buildFittingRoom(spot, { map, interactions, wardrobe }) {
  interactions.add({
    kind: 'fittingRoom',
    get id() { return wardrobe.next; },
    get label() { return wardrobeItems[wardrobe.next].name; },
    get title() { return `Change into ${this.label}`; },
    get detail() { return describe(wardrobe.next, wardrobe); },
    verb: 'change',
    priceLabel: 'Free',
    cost: 0,
    position: spot.position,
    available: () => map.zones[spot.zone].open && wardrobe.next !== null,
    use: () => wardrobe.wearNext(),
  });
}
