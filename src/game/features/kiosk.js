// =============================================================================
// KIOSK KEVIN'S CART (map feature kind 'kiosk'; numbers in config/kiosk.js; the plan: docs/kiosk-kevin-plan.md).
// Kevin sells three products a round (g.pricing 'kiosk') from the opening round, while his site's zone is open: a Lethal slot
// (Soda Bomb / Sparkler Cake), Bubble Wrap, and a Tactical slot (Air Horn / Glitter Bomb); the two-product slots alternate
// round by round (config/kiosk.js slots, stockFor). Kevin's Pick (one extra charge or layer) moves along the slots, one a round.
//
// WHERE KEVIN IS: every site's cart is in the map all the time (maps/mall/kioskCart.js) and only one is live; the others
// show "BACK IN 5 MIN". Every run starts at the first site. At each 'roundStart' after the opening round he moves to a random
// OTHER site whose zone is open, or stays where he is if there is none. He never moves mid-purchase: a site picked while a buy
// on his cart is being held waits (`pending`) until the hold ends. He never moves into a locked zone.
// He DUCKS while any live zombie is within duckRadius of his stand point: nothing on the cart can be bought until it's clear.
// The PA speaks once a round, when he first sells in it (or after a move): where he is if he's new there, the round's three
// products and his Pick.
//
// DOM-free: announces 'kioskStock' (the PA line) and 'kioskMoved' on g.events; main.js and tests read .status.
// Save & Quit: his site (and a pending move) is saved with the feature (serialize/restore), as it stood at the round's start.
//
// feature: { kind: 'kiosk', name, zone, position, normal, sites: [{ id, zone, where, floorY, cart: { position, stand, normal, slots, show } }] }
//   (zone/position/normal: the first site's, where every run starts)
// =============================================================================
import { kiosk, productOf, stockFor, pickFor } from '../../config/kiosk.js';

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
  const stock = () => stockFor(rounds.round); // (this round's three: the two-product slots alternate)
  const pick = () => pickFor(rounds.round);
  // A buy on his cart is being held right now (the hold has started and not finished).
  const midPurchase = () => {
    const prompt = interactions.prompt;
    return prompt?.kind === 'kiosk' && prompt.progress > 0;
  };

  // One buy spot per slot; what it sells is read live (a slot's product changes with the round).
  kiosk.slots.forEach((choices, index) => {
    const idNow = () => stock()[index];
    const productNow = () => productOf(idNow());
    const target = () => (productNow()?.charges ?? 1) + Number(pick() === idNow());
    const held = () => (productNow() ? equipment.pockets[productNow().pocket] : null);
    interactions.add({
      kind: 'kiosk', verb: 'buy',
      get id() { return idNow(); },
      get label() { return nameOf(idNow()); },
      get position() { return cart().slots[index].position; }, // (the live cart's slot)
      available: () => !state.over && open() && !hiding(),
      get cost() { return pricing.priceOf('kiosk', idNow()); },
      get title() { return pick() === idNow() ? `Kevin's Pick · ${nameOf(idNow())}` : nameOf(idNow()); },
      get detail() {
        const id = idNow(), product = productNow(), pocket = held();
        const offer = product ? `Refills to ${target()}.` : `Adds up to ${target()} ${target() === 1 ? 'layer' : 'layers'}.`;
        const replacement = pocket?.id && pocket.id !== id
          ? ` Replaces ${pocket.count} ${nameOf(pocket.id)}${pocket.count === 1 ? '' : 's'}.` : '';
        return `${offer} ${(product ?? kiosk.bubbleWrap).detail}${replacement}`;
      },
      get blocked() {
        if (!productNow()) return health.armour.length >= health.maxArmourLayers ? 'Bubble Wrap is full' : null;
        return held().id === idNow() && held().count >= target() ? 'Pocket is full' : null;
      },
      use() {
        if (productNow()) equipment.refill(idNow(), target());
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
    sites.forEach((s, i) => s.cart.show(i === 0 ? 'closed' : 'away', stockFor(kiosk.openingRound)));
  }
  setUp();

  return {
    get site() { return site; },
    sites,
    get status() {
      return {
        siteId: site.id, zone: site.zone, area: site.where, pending: pending?.id ?? null,
        open: open(), hiding: hiding(), pick: pick(), stock: stock(),
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
      const products = stock();
      cart().show(!selling ? 'closed' : hiding() ? 'hiding' : selected, products);
      if (!selling || state.over || (lastRound === rounds.round && lastSite === site)) return;
      const text = lastSite === null ? kiosk.pa.opened : lastSite !== site ? kiosk.pa.moved : '';
      lastRound = rounds.round;
      lastSite = site;
      const names = products.map(nameOf);
      const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      events.emit('kioskStock', {
        siteId: site.id,
        stock: products,
        pick: selected,
        pa: {
          kicker: kiosk.pa.kicker,
          text: `${text ? `${fill(text, { where: site.where })} ` : ''}${fill(kiosk.pa.stock, { stock: list, pick: nameOf(selected) })}`,
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
