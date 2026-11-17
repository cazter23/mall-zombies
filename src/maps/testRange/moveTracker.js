// =============================================================================
// THE MOVEMENT READOUT'S NUMBERS (debug mode: the test range's movement course). Watches the player each tick and keeps what the
// last move did, for ui/movementReadout.js:
//   speed now and the best of the last second (m/s, flat); the stance
//   the last time in the air: how high it rose above the take-off, how far it went, how far it dropped (take-off to landing)
//   the last fall damage (the controller's own number: player.onFall, feel.fall)
//   the last slide: distance and seconds;  the last vault: distance
// DOM-free (the tests read it).
//
//   const tracker = createMoveTracker()
//   tracker.connect(player)     (wraps player.onFall, keeping whatever was there)
//   tracker.update(dt) / tracker.view
// =============================================================================

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createMoveTracker() {
  let player = null;
  let time = 0;
  let speeds = []; // [{ t, speed }] over the last second
  let air = null; // the stretch in the air under way: { from, peak }
  let slide = null; // the slide under way: { from, t }
  let vault = null; // the vault under way: { from }
  let wasGrounded = true;
  let groundY = 0; // the floor last stood on (a drop counts from there, not from a jump's rise before a climb)
  const last = { air: null, fall: null, slide: null, vault: null };

  return {
    connect(target) {
      player = target;
      const before = player.onFall;
      player.onFall = (fall) => {
        last.fall = { drop: fall.drop, damage: fall.damage, at: time };
        before?.(fall);
      };
    },

    update(dt) {
      if (!player) return;
      time += dt;
      const p = player.position;
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      speeds.push({ t: time, speed });
      speeds = speeds.filter((s) => s.t > time - 1);

      // In the air: from leaving the ground (or starting a vault) to landing.
      const grounded = player.grounded && !player.vault?.active;
      if (grounded) groundY = p.y;
      if (wasGrounded && !grounded) air = { from: p.clone().setY(groundY), peak: p.y };
      if (air) air.peak = Math.max(air.peak, p.y);
      if (!wasGrounded && grounded && air) {
        last.air = { rise: air.peak - air.from.y, distance: flat(p, air.from), drop: air.from.y - p.y, at: time };
        air = null;
      }
      wasGrounded = grounded;

      if (player.stance === 'slide' && !slide) slide = { from: p.clone(), t: time };
      if (player.stance !== 'slide' && slide) {
        last.slide = { distance: flat(p, slide.from), seconds: time - slide.t };
        slide = null;
      }
      if (player.vault?.active && !vault) vault = { from: p.clone() };
      if (!player.vault?.active && vault) {
        last.vault = { distance: flat(p, vault.from) };
        vault = null;
      }
    },

    /** What ui/movementReadout.js draws. */
    get view() {
      if (!player) return null;
      return {
        speed: speeds.at(-1)?.speed ?? 0,
        topSpeed: Math.max(0, ...speeds.map((s) => s.speed)),
        stance: player.stance,
        air: last.air && { ...last.air },
        // The fall damage that belongs to the last landing (a later, free landing clears it from the readout).
        // (the controller reports the damage during the landing tick, before this tracker's update counts the landing: allow that)
        fall: last.fall && (!last.air || last.fall.at >= last.air.at - 0.1) ? { ...last.fall } : null,
        slide: last.slide && { ...last.slide },
        vault: last.vault && { ...last.vault },
      };
    },
  };
}
