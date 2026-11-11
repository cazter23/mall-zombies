// =============================================================================
// SURFACE SLOWS: what the floor under the player does to their speed (stats.surfaceSpeed, read by player/controller.js
// for walking and sliding). Several things slow the player: a boss ('boss': the Janitor's wet floor, the Guard's taser),
// Scoops' melt puddles ('melt') and a hazard the player stands in ('hazard:<id>', game/features/hazards.js), so no system writes the stat itself: each SOURCE reports its own factor
// (1 = no effect) every tick it runs, and the stat is the lowest of them. Two slows never stack below the worst one.
// A source that stops (its boss gone, its puddles cleared) clears its slot. createGame owns one; Play again resets it.
//   surfaces.set('boss', 0.7)   surfaces.clear('boss')   surfaces.reset()
//   surfaces.factorOf('melt')      what one source reports now (1 if nothing)
// =============================================================================

export function createSurfaceSlows(stats) {
  const factors = new Map(); // source -> its factor this tick

  function apply() {
    let lowest = 1;
    for (const factor of factors.values()) if (factor < lowest) lowest = factor;
    stats.surfaceSpeed = lowest;
  }

  return {
    set(source, factor) {
      factors.set(source, factor);
      apply();
    },
    clear(source) {
      factors.delete(source);
      apply();
    },
    factorOf(source) {
      return factors.get(source) ?? 1;
    },
    reset() {
      factors.clear();
      apply();
    },
  };
}
