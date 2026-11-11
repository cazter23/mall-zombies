import { kiosk, productOf } from '../../config/kiosk.js';

export function buildKiosk(feature, { map, rounds, zombies, pricing, interactions, equipment, health, events, state }) {
  let announcedRound = 0;
  const open = () => rounds.round >= kiosk.openingRound && map.zones[feature.zone].open;
  const hiding = () => open() && zombies.zombies.some((zombie) => zombie.isAlive
    && zombie.position.distanceToSquared(feature.stand) <= kiosk.duckRadius ** 2);
  const pick = () => rounds.round >= kiosk.openingRound
    ? kiosk.stock[(rounds.round - kiosk.openingRound) % kiosk.stock.length]
    : null;
  const nameOf = (id) => productOf(id)?.name ?? kiosk.bubbleWrap.name;

  for (const { id, position } of feature.slots) {
    const product = productOf(id);
    const target = () => (product?.charges ?? 1) + Number(pick() === id);
    const held = product ? equipment.pockets[product.pocket] : null;
    interactions.add({
      kind: 'kiosk', id, position, label: nameOf(id), verb: 'buy',
      available: () => !state.over && open() && !hiding(),
      get cost() { return pricing.priceOf('kiosk', id); },
      get title() { return pick() === id ? `Kevin's Pick · ${nameOf(id)}` : nameOf(id); },
      get detail() {
        const offer = product ? `Refills to ${target()}.` : `Adds up to ${target()} ${target() === 1 ? 'layer' : 'layers'}.`;
        const replacement = held?.id && held.id !== id
          ? ` Replaces ${held.count} ${nameOf(held.id)}${held.count === 1 ? '' : 's'}.` : '';
        return `${offer} ${(product ?? kiosk.bubbleWrap).detail}${replacement}`;
      },
      get blocked() {
        if (!product) return health.armour.length >= health.maxArmourLayers ? 'Bubble Wrap is full' : null;
        return held.id === id && held.count >= target() ? 'Pocket is full' : null;
      },
      use() {
        if (product) equipment.refill(id, target());
        else health.addArmour(target());
      },
    });
  }

  feature.show('closed');
  return {
    get status() {
      return { open: open(), hiding: hiding(), pick: pick(), stock: [...kiosk.stock] };
    },
    update() {
      const selling = open();
      const selected = pick();
      feature.show(!selling ? 'closed' : hiding() ? 'hiding' : selected);
      if (!selling || state.over || announcedRound === rounds.round) return;
      const first = announcedRound === 0;
      announcedRound = rounds.round;
      events.emit('kioskStock', {
        pick: selected,
        pa: {
          kicker: "Kevin's cart",
          text: `${first ? "Kevin's cart is open in the Main Hallway. " : ''}Kevin's Pick is ${nameOf(selected)}.`,
          priority: 1,
        },
      });
    },
    reset() {
      announcedRound = 0;
      feature.show('closed');
    },
  };
}
