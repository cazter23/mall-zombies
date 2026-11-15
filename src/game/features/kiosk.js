// =============================================================================
// KIOSK KEVIN'S CART (map feature kind 'kiosk'; numbers in config/kiosk.js; the plan: docs/kiosk-kevin-plan.md).
// Kevin sells three products a block (g.pricing 'kiosk') from the opening round, while his site's zone is open: a Lethal slot
// (Soda Bomb / Sparkler Cake / Sentry), Bubble Wrap, and a Tactical slot (Air Horn / Glitter Bomb); each slot advances once per
// `stockEveryRounds` block (config/kiosk.js slots, stockFor). Kevin's Pick (one extra charge or layer) is the product on sale that
// has waited longest for it across blocks, never the Sentry, and stays the same for the whole block (pickFor).
//
// WHERE KEVIN IS: every site's cart is in the map all the time (maps/mall/kioskCart.js) and only one is live; the others
// show "BACK IN 5 MIN". Every run starts at the first site. Every `moveEveryRounds` rounds after the opening round (`openingRound + 3,
// + 6...`) at 'roundStart' he moves to a random OTHER site whose zone is open, or stays where he is if there is none. He never moves
// mid-purchase: a site picked while a buy on his cart is being held waits (`pending`) until the hold ends. He never moves into a
// locked zone. He DUCKS while any live zombie is within duckRadius of his stand point: nothing on the cart can be bought until it's clear.
// The PA speaks once when he first opens (`opened` + `stock`) and again when he moves to another site (`moved` + `stock`); rounds
// where he stays put keep the PA silent.
//
// He SHOUTS (phase 8, presentation only): within kiosk.hawk.radius of his open cart he hawks a line now and then, ducking he
// yelps, and coming back up he says so ('kioskHawk'; the cart shows it in a speech bubble). Each list of lines takes turns
// (never Math.random, so the game's random numbers are untouched).
//
// DOM-free: announces 'kioskStock' (the PA line), 'kioskMoved' and 'kioskHawk' on g.events; main.js and tests read .status.
// Save & Quit: his site (and a pending move) is saved with the feature (serialize/restore), as it stood at the round's start.
//
// feature: { kind: 'kiosk', name, zone, position, normal, sites: [{ id, zone, where, floorY, cart: { position, stand, normal, slots, show } }] }
//   (zone/position/normal: the first site's, where every run starts)
// =============================================================================
import { kiosk, productOf, stockFor, pickFor } from '../../config/kiosk.js';
import { paRandom, pickPaLine } from '../announcer.js';

const nameOf = (id) => productOf(id)?.name ?? kiosk.bubbleWrap.name;
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');

export function buildKiosk(feature, { map, rounds, zombies, pricing, interactions, equipment, health, events, state, player, lineRandom = paRandom }) {
  const sites = feature.sites;
  let site = sites[0];
  let pending = null; // a site picked at 'roundStart' during a purchase: he goes there once it's let go
  let lastSite = null; // the site of the last PA line (null before his first open; PA fires on open or move)
  // His shouting (kiosk.hawk): a clock, when each kind of line may come again, and whose turn it is (populated by setUp).
  const shout = {};

  const cart = () => site.cart;
  const zoneOpen = (s) => map.zones[s.zone].open;
  const open = () => rounds.round >= kiosk.openingRound && zoneOpen(site);
  const hiding = () => open() && zombies.zombies.some((zombie) => zombie.isAlive
    && zombie.position.distanceToSquared(cart().stand) <= kiosk.duckRadius ** 2);
  const stock = () => stockFor(rounds.round); // (this block's three: advances every stockEveryRounds rounds)
  const pick = () => pickFor(rounds.round);
  // A buy on his cart is being held right now (the hold has started and not finished).
  const midPurchase = () => {
    const prompt = interactions.prompt;
    return prompt?.kind === 'kiosk' && prompt.progress > 0;
  };

  // One buy spot per slot; what it sells is read live (a slot's product changes each stockEveryRounds block).
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

  // Product pitches for this round's stock: prefer Kevin's Pick (twice per cycle) while alternating other stocked items.
  function pitchPool() {
    const table = kiosk.hawk.pitches ?? {};
    const available = stock().filter((id) => table[id]?.length);
    if (!available.length) return [];
    const selected = pick();
    if (!selected || !available.includes(selected)) return available;
    const others = available.filter((id) => id !== selected);
    if (!others.length) return [selected];
    const order = [];
    for (const id of others) order.push(selected, id);
    return order;
  }

  function nextPitch() {
    const order = pitchPool();
    if (!order.length) return null;
    const id = order[shout.pitchOrder++ % order.length];
    const list = kiosk.hawk.pitches[id];
    const turn = shout.pitches[id] ?? 0;
    shout.pitches[id] = turn + 1;
    return list[turn % list.length];
  }

  // The next line of one of his lists (they take turns).
  function nextLine(kind) {
    if (kind === 'lines') {
      const chance = Math.max(0, Math.min(1, kiosk.hawk.pitchChance ?? 0));
      if (chance > 0) {
        // Epsilon keeps decimal cadences (like 0.35 over 20 shouts) free of IEEE-754 drift.
        const usePitch = shout.pitchCredit + chance >= 1 - 1e-9;
        shout.pitchCredit += chance - (usePitch ? 1 : 0);
        if (usePitch) {
          const pitch = nextPitch();
          if (pitch) return pitch;
        }
      }
    }
    const list = kiosk.hawk[kind];
    const text = list[shout.turns[kind]++ % list.length];
    if (!text.includes('{product}')) return text;
    const products = stock();
    return fill(text, { product: nameOf(products[shout.products++ % products.length]) });
  }
  function say(kind) {
    events.emit('kioskHawk', { siteId: site.id, kind, line: nextLine(kind) });
  }
  // One tick of his shouting: a yelp as he ducks, a word as he comes back up, and a hawk while you're near his open cart.
  function hawk(dt) {
    shout.clock += dt;
    if (!open() || state.over) {
      shout.wasHiding = false; // (shut, or you're dead: he says nothing)
      return;
    }
    const ducking = hiding();
    if (ducking !== shout.wasHiding) {
      shout.wasHiding = ducking;
      if (shout.clock >= shout.duckAt) {
        shout.duckAt = shout.clock + kiosk.hawk.duckSeconds;
        say(ducking ? 'duck' : 'back');
        shout.hawkAt = Math.max(shout.hawkAt, shout.clock + kiosk.hawk.bubbleSeconds); // (no hawk over the top of it)
        return;
      }
    }
    if (ducking || !player || shout.clock < shout.hawkAt) return;
    const { stand } = cart();
    const p = player.position;
    if (Math.abs(p.y - stand.y) > kiosk.hawk.floorTolerance
      || Math.hypot(p.x - stand.x, p.z - stand.z) > kiosk.hawk.radius) return;
    shout.hawkAt = shout.clock + kiosk.hawk.seconds;
    say('lines');
  }

  function moveTo(target) {
    pending = null;
    const moved = target !== site;
    if (moved) {
      cart().show('away');
      site = target;
      shout.wasHiding = false; // (the new cart starts with him standing)
    }
    events.emit('kioskMoved', { siteId: site.id, area: site.where, moved });
  }

  const moveEvery = () => Math.max(1, kiosk.moveEveryRounds);
  const isMoveRound = (round) => round > kiosk.openingRound && (round - kiosk.openingRound) % moveEvery() === 0;

  // He moves every moveEveryRounds rounds after the opening round. The pick is made now even if the move has to wait.
  events.on('roundStart', () => {
    if (state.over || !isMoveRound(rounds.round)) return;
    const target = pickSite() ?? site;
    if (target !== site && midPurchase()) pending = target;
    else moveTo(target);
  });

  // Every cart shut, Kevin at the first site whose zone is open, else the first site (a new run, or the start of a load). In a
  // whole-mall run none is open yet, so that is the first; an arena run (Lot Full) starts him at the arena's own site.
  function setUp() {
    site = sites.find((s) => zoneOpen(s)) ?? sites[0];
    pending = null;
    lastSite = null;
    Object.assign(shout, { clock: 0, hawkAt: 0, duckAt: 0, wasHiding: false, turns: { lines: 0, duck: 0, back: 0 }, pitchCredit: 0, pitchOrder: 0, pitches: {}, products: 0 });
    sites.forEach((s) => s.cart.show(s === site ? 'closed' : 'away', stockFor(kiosk.openingRound)));
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
    update(dt = 0) {
      if (pending && !midPurchase()) moveTo(pending);
      const selling = open();
      const selected = pick();
      const products = stock();
      cart().show(!selling ? 'closed' : hiding() ? 'hiding' : selected, products);
      hawk(dt);
      if (!selling || state.over || lastSite === site) return;
      const moveIndex = Math.max(0, Math.floor(Math.max(0, rounds.round - kiosk.openingRound) / moveEvery()) - 1);
      const text = lastSite === null
        ? pickPaLine(kiosk.pa.opened, lineRandom)
        : kiosk.pa.moved[moveIndex % kiosk.pa.moved.length];
      lastSite = site;
      const names = products.map(nameOf);
      const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      const stockLine = pickPaLine(kiosk.pa.stock, lineRandom);
      events.emit('kioskStock', {
        siteId: site.id,
        stock: products,
        pick: selected,
        pa: {
          kicker: kiosk.pa.kicker,
          text: `${fill(text, { where: site.where })} ${fill(stockLine, { stock: list, pick: nameOf(selected) })}`,
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
