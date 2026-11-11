// =============================================================================
// KIOSK KEVIN'S CART (map feature kind 'kiosk'; numbers in config/kiosk.js; the plan: docs/kiosk-kevin-plan.md).
// Kevin sells Soda Bombs, Bubble Wrap and Air Horns (g.pricing 'kiosk') from the opening round, while his site's zone is open.
// Kevin's Pick (one extra charge or layer) cycles through the stock, one product a round.
//
// WHERE KEVIN IS: every site's cart is in the map all the time (maps/mall/kioskCart.js) and only one is live; the others
// show "BACK IN 5 MIN". Every run starts at the first site. At each 'roundStart' after the opening round he moves to a random
// OTHER site whose zone is open, or stays where he is if there is none. He never moves mid-purchase: a site picked while a buy
// on his cart is being held waits (`pending`) until the hold ends. He never moves into a locked zone.
// He DUCKS while any live zombie is within duckRadius of his stand point: nothing on the cart can be bought until it's clear.
// The PA speaks once a round, when he first sells in it (or after a move): where he is if he's new there, and his Pick.
//
// DOM-free: announces 'kioskStock' (the PA line) and 'kioskMoved' on g.events; main.js and tests read .status.
// Save & Quit: his site (and a pending move) is saved with the feature (serialize/restore), as it stood at the round's start.
//
// feature: { kind: 'kiosk', name, zone, position, normal, sites: [{ id, zone, where, floorY, cart: { position, stand, normal, slots, show } }] }
//   (zone/position/normal: the first site's, where every run starts)
// =============================================================================
import { kiosk, productOf } from '../../config/kiosk.js';

const nameOf = (id) => productOf(id)?.name ?? kiosk.bubbleWrap.name;
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');

export function buildKiosk(feature, { map, rounds, zombies, pricing, interactions, equipment, health, events, state }) {
  const sites = feature.sites;
  let site = sites[0];
  let pending = null; // a site picked at 'roundStart' during a purchase: he goes there once it's let go
  let lastRound = 0; // the round and site of the last PA line (one a round, again after a move)
  let lastSite = null;

  const cart = () => site.cart;
  const zoneOpen = (s) => map.zones[s.zone].open;
  const open = () => rounds.round >= kiosk.openingRound && zoneOpen(site);
  const hiding = () => open() && zombies.zombies.some((zombie) => zombie.isAlive
    && zombie.position.distanceToSquared(cart().stand) <= kiosk.duckRadius ** 2);
  const pick = () => rounds.round >= kiosk.openingRound
    ? kiosk.stock[(rounds.round - kiosk.openingRound) % kiosk.stock.length]
    : null;
  // A buy on his cart is being held right now (the hold has started and not finished).
  const midPurchase = () => {
    const prompt = interactions.prompt;
    return prompt?.kind === 'kiosk' && prompt.progress > 0;
  };

  kiosk.stock.forEach((id, index) => {
    const product = productOf(id);
    const target = () => (product?.charges ?? 1) + Number(pick() === id);
    const held = product ? equipment.pockets[product.pocket] : null;
    interactions.add({
      kind: 'kiosk', id, label: nameOf(id), verb: 'buy',
      get position() { return cart().slots[index].position; }, // (the live cart's slot)
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
  });

  // Another site whose zone is open, at random (null: none). Uniform, like the claw's.
  function pickSite() {
    const options = sites.filter((s) => s !== site && zoneOpen(s));
    return options.length ? options[Math.floor(Math.random() * options.length)] : null;
  }

  function moveTo(target) {
    pending = null;
    const moved = target !== site;
    if (moved) {
      cart().show('away');
      site = target;
    }
    events.emit('kioskMoved', { siteId: site.id, area: site.where, moved });
  }

  // He moves with the round (from the round after he opens). The pick is made now even if the move has to wait.
  events.on('roundStart', () => {
    if (state.over || rounds.round <= kiosk.openingRound) return;
    const target = pickSite() ?? site;
    if (target !== site && midPurchase()) pending = target;
    else moveTo(target);
  });

  // Every cart shut, Kevin at the first site (a new run, or the start of a load).
  function setUp() {
    site = sites[0];
    pending = null;
    lastRound = 0;
    lastSite = null;
    sites.forEach((s, i) => s.cart.show(i === 0 ? 'closed' : 'away'));
  }
  setUp();

  return {
    get site() { return site; },
    sites,
    get status() {
      return {
        siteId: site.id, zone: site.zone, area: site.where, pending: pending?.id ?? null,
        open: open(), hiding: hiding(), pick: pick(), stock: [...kiosk.stock],
      };
    },
    /** Debug: move him now (to `siteId`, or a random other open site). Refused mid-purchase or into a locked zone. Returns the site, or null. */
    moveNow(siteId = null) {
      const target = siteId ? sites.find((s) => s.id === siteId) : pickSite();
      if (!target || !zoneOpen(target) || midPurchase()) return null;
      moveTo(target);
      return site;
    },
    update() {
      if (pending && !midPurchase()) moveTo(pending);
      const selling = open();
      const selected = pick();
      cart().show(!selling ? 'closed' : hiding() ? 'hiding' : selected);
      if (!selling || state.over || (lastRound === rounds.round && lastSite === site)) return;
      const text = lastSite === null ? kiosk.pa.opened : lastSite !== site ? kiosk.pa.moved : '';
      lastRound = rounds.round;
      lastSite = site;
      events.emit('kioskStock', {
        siteId: site.id,
        pick: selected,
        pa: {
          kicker: kiosk.pa.kicker,
          text: `${text ? `${fill(text, { where: site.where })} ` : ''}${fill(kiosk.pa.pick, { pick: nameOf(selected) })}`,
          priority: 1,
        },
      });
    },
    // Save & Quit (game/saveGame.js): where he stands at the round's start (and a move still waiting on a purchase). The
    // snapshot is taken after every 'roundStart' listener, so this round's move is already in it.
    serialize() {
      return { siteId: site.id, pendingId: pending?.id ?? null };
    },
    restore(data) {
      setUp();
      const saved = sites.find((s) => s.id === data.siteId);
      if (saved && saved !== site) {
        site.cart.show('away');
        site = saved;
      }
      pending = sites.find((s) => s.id === data.pendingId) ?? null; // (no purchase survives a load: it moves on the first tick)
    },
    reset: setUp,
  };
}
