// =============================================================================
// THE HORROR LAYER (map feature kind 'horror'): the mall falls apart as the rounds climb. Visual only: it never touches
// zombies, points or collision. From config/look.js `horror`, reading the map's hooks (map.horror):
//   round mood    past fromRound the whole mall darkens a little every round (state.exposure, read by zone lighting)
//   neon failure  a growing share of the flickering neon letters and tubes dies for good (slogans lose letters), and every
//                 tube, steady ones too, loses some brightness (brownout)
//   the sun sets  golden hour at the start of a run to a purple night by look.dusk.toRound (state.dusk; map.horror.setDusk)
//   late hours    the view drifts towards the `lateHours` grade (state.decay 0..1, read by zone lighting): greyer, harder,
//                 the screen edges closing in, on top of each area's own grade
//   dying lamps   one more lamp flickers out every few rounds, for the rest of the run
//   power cuts    now and then the area you're in loses power for a few seconds: its lamps and neon go dark and zone
//                 lighting drops it to emergency red (state.cut), then the power stutters back
// Listens to 'roundStart'; Play again (reset) puts every light back. Comfort > Horror lighting (look.runtime.horror) off
// = none of it. Random choices are seeded per run (feature.seed), so tests can follow them.
//
// map.horror = { state: { exposure, decay, dusk, cut }, setDusk(t), lamps: [PointLight], neons: { name: neon builder },
//               areas: [{ id, grades: [zone lighting grade ids], neons: [names] }] }   (a lamp's area = the grade where it hangs)
// =============================================================================

import { look } from '../../config/look.js';
import { gradeZoneAt } from '../../fx/zoneGrading.js';
import { seededRandom } from '../../world/textures.js';
import { buildRetailUnease } from './retailUnease.js';

const between = (rand, [a, b]) => a + (b - a) * rand();
// Flicker holds each on/off state at least this long: under 3 flashes a second (photosensitivity guidance).
const HOLD = [0.18, 0.4];

export function buildHorror(feature, { map, events, rounds, player }) {
  const hooks = map.horror;
  if (!hooks) return {};
  const cfg = look.horror;
  const unease = buildRetailUnease({ map, player, rounds });
  const { state } = hooks;
  const areas = hooks.areas.map((a) => ({ id: a.id, grades: a.grades, neons: a.neons.map((name) => hooks.neons[name]).filter(Boolean) }));
  const areaAt = (position) => {
    const id = gradeZoneAt(map.gradeZones ?? [], position) ?? look.grading.fallback;
    return areas.find((a) => a.grades.includes(id)) ?? null;
  };
  const lamps = hooks.lamps.map((light) => ({ light, area: areaAt(light.position), base: light.intensity, dead: false, dying: 0, hold: 0, on: true }));
  const neons = areas.flatMap((a) => a.neons);

  let runs = 0;
  let rand = seededRandom(feature.seed ?? 1);
  let deathOrder = [];
  let round = 0;
  let pendingCut = null; // seconds until this round's power cut
  let cut = null; // { area, timeLeft, stutter }
  let enabled = look.runtime.horror !== false;

  const shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const past = () => Math.max(0, round - cfg.fromRound + 1); // rounds into the horror (1 at fromRound)
  const lampOn = (l) => !l.dead && !(cut && cut.area === l.area && cut.level > 0);

  function setLamp(l, level) {
    l.light.intensity = l.base * level;
  }

  function endCut() {
    if (!cut) return;
    for (const n of cut.area.neons) n.setPower(1);
    for (const l of lamps) if (l.area === cut.area && !l.dead && l.dying <= 0) setLamp(l, 1);
    cut = null;
    state.cut = null;
  }

  // Everything that follows from the round number (called on each new round and when the setting flips).
  function apply() {
    if (!enabled) {
      restore();
      return;
    }
    const steps = past();
    state.exposure = 1 - Math.min(cfg.darkness.max, steps * cfg.darkness.perRound);
    const failure = Math.min(cfg.neonFailure.max, steps * cfg.neonFailure.perRound);
    const brownout = Math.min(cfg.neonBrownout.max, steps * cfg.neonBrownout.perRound);
    for (const n of neons) {
      n.setFailures(failure);
      n.setBrownout?.(brownout);
    }
    state.decay = Math.min(cfg.decay.max, steps * cfg.decay.perRound);
    const D = look.dusk; // the sun goes down from the start of the run (not just past fromRound)
    state.dusk = Math.min(1, Math.max(0, (round - D.fromRound) / (D.toRound - D.fromRound)));
    hooks.setDusk?.(state.dusk);
    const deadTarget = steps > 0
      ? Math.min(Math.floor(lamps.length * cfg.lampDeaths.maxShare), 1 + Math.floor((steps - 1) / cfg.lampDeaths.everyRounds))
      : 0;
    deathOrder.slice(0, deadTarget).forEach((l) => {
      if (!l.dead && l.dying <= 0) l.dying = cfg.lampDeaths.flickerSeconds;
    });
  }

  function restore() {
    endCut();
    pendingCut = null;
    state.exposure = 1;
    state.decay = 0;
    state.dusk = 0;
    hooks.setDusk?.(0);
    for (const n of neons) {
      n.setFailures(0);
      n.setBrownout?.(0);
      n.setPower(1);
    }
    for (const l of lamps) {
      l.dead = false;
      l.dying = 0;
      setLamp(l, 1);
    }
  }

  function startCut() {
    const area = areaAt(player.position);
    if (!area) return;
    const seconds = between(rand, cfg.powerCuts.seconds);
    cut = { area, timeLeft: seconds, level: 1, hold: 0 };
    for (const n of area.neons) n.setPower(0);
    for (const l of lamps) if (l.area === area) setLamp(l, 0);
    state.cut = { grades: area.grades, level: 1, area: area.id };
  }

  events.on('roundStart', ({ round: n }) => {
    round = n;
    apply();
    pendingCut = enabled && n >= cfg.powerCuts.fromRound && rand() < cfg.powerCuts.chance ? between(rand, cfg.powerCuts.delay) : null;
  });

  // A loaded save (game/saveGame.js) starts mid-run without a 'roundStart': darken to the saved round (no power cut pending).
  events.on('runLoaded', ({ round: n }) => {
    round = n;
    apply();
    pendingCut = null;
  });

  function newRun() {
    unease.reset();
    restore();
    runs += 1;
    rand = seededRandom((feature.seed ?? 1) + runs * 7919);
    deathOrder = shuffle(lamps);
    round = 0;
  }
  newRun();

  return {
    get state() {
      return { round, cut: cut && { area: cut.area.id, timeLeft: cut.timeLeft }, pendingCut, deadLamps: lamps.filter((l) => l.dead).length };
    },
    update(dt) {
      unease.update(dt);
      const want = look.runtime.horror !== false;
      if (want !== enabled) {
        enabled = want;
        apply();
      }
      if (!enabled) return;
      // Lamps on their way out: a few seconds of stutter, then dark for the rest of the run.
      for (const l of lamps) {
        if (l.dying <= 0) continue;
        l.dying -= dt;
        if (l.dying <= 0) {
          l.dead = true;
          l.on = false;
          setLamp(l, 0);
        } else if (lampOn(l)) {
          l.hold -= dt;
          if (l.hold <= 0) {
            l.on = !l.on;
            l.hold = between(rand, HOLD);
            setLamp(l, l.on ? 1 : 0.08);
          }
        }
      }
      // The power cut: counts down while the round is on, then dark, then a stutter back.
      if (pendingCut !== null && !rounds.inBreak) {
        pendingCut -= dt;
        if (pendingCut <= 0) {
          pendingCut = null;
          startCut();
        }
      }
      if (cut) {
        cut.timeLeft -= dt;
        const stutter = cfg.powerCuts.stutterSeconds;
        if (cut.timeLeft <= 0) endCut();
        else if (cut.timeLeft < stutter && (cut.hold -= dt) <= 0) {
          cut.hold = between(rand, HOLD);
          const on = cut.level > 0; // (flip: dark -> power back -> dark...)
          cut.level = on ? 0 : 1;
          state.cut.level = cut.level;
          for (const n of cut.area.neons) n.setPower(on ? 1 : 0);
          for (const l of lamps) if (l.area === cut.area && !l.dead && l.dying <= 0) setLamp(l, on ? 1 : 0);
        }
      }
    },
    reset() {
      newRun();
    },
    /** Debug / testing: cut the power where the player stands right now. */
    forceCut() {
      if (enabled && !cut) startCut();
    },
  };
}
