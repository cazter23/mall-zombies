// =============================================================================
// PRIZE TICKETS: GRAB-A-GUN's second, small currency for the run (createGame makes one: g.tickets; numbers in
// config/clawMachine.js tickets and prizeCounter). Every grab prints some (a bad grab prints more), popping Sunny pays a few,
// and the Prize Counter (game/features/prizeCounter.js) takes them for small things.
//
// Tickets are NOT points: not the wallet, not g.pricing (Flash Sales and vouchers never touch them), never paid on 'kill', and
// never income on the results screen. They're lost on death (nothing is paid once you're dead) and reset on Play again.
// It also holds the TOKENS the counter sells, used up by the claw machine: 'slowClaw' (the next grab sweeps at half speed),
// 'freeGrab' (the next grab costs nothing) and 'keychain' (a Sunny keychain: a joke for the receipt until the Wardrobe exists).
//
//   tickets.count / won           tickets in hand / won this run (the receipt)
//   tickets.add(amount, reason)   pays out (0 once dead); emits 'ticketsWon' { amount, total, reason }; returns what it paid
//   tickets.spend(amount)         true and deducts if you have enough, else false and nothing changes
//   tickets.hold(id) / has(id) / use(id)   a token: give one / do you have one / use one up (true if you had one)
//   tickets.tokens                { slowClaw, freeGrab, keychain } (a copy)
//   tickets.reset()               Play again
// =============================================================================

const TOKENS = ['slowClaw', 'freeGrab', 'keychain'];

export function createTickets({ events, state }) {
  let count = 0;
  let won = 0;
  const tokens = Object.fromEntries(TOKENS.map((id) => [id, 0]));

  return {
    get count() { return count; },
    get won() { return won; },
    get tokens() { return { ...tokens }; },

    add(amount, reason = 'other') {
      if (state?.over || !(amount > 0)) return 0;
      count += amount;
      won += amount;
      events?.emit('ticketsWon', { amount, total: count, reason });
      return amount;
    },

    spend(amount) {
      if (!(amount >= 0) || amount > count) return false;
      count -= amount;
      return true;
    },

    hold(id) {
      if (!TOKENS.includes(id)) throw new Error(`tickets: unknown token "${id}"`);
      tokens[id] += 1;
    },
    has: (id) => tokens[id] > 0,
    use(id) {
      if (!(tokens[id] > 0)) return false;
      tokens[id] -= 1;
      return true;
    },

    reset() {
      count = 0;
      won = 0;
      for (const id of TOKENS) tokens[id] = 0;
    },
  };
}
