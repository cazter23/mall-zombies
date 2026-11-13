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
//   ceiling panels the lit light panels follow their area's lamps (dying, dead, cut), so a dark room has dark panels
// Listens to 'roundStart'; Play again (reset) puts every light back. Comfort > Horror lighting (look.runtime.horror) off
// = none of it. Random choices are seeded per run (feature.seed), so tests can follow them.
//
// map.horror = { state: { exposure, decay, dusk, cut }, setDusk(t), lamps: [PointLight], panels: [Mesh] (lit ceiling panels),
//               neons: { name: neon builder }, areas: [{ id, grades: [zone lighting grade ids], neons: [names] }] }
//               (a lamp's or panel's area = the grade where it hangs; each area's panels get their own material, flagged
//               userData.animated so static batching keeps it, and its glow follows the mean level of the area's lamps)
// =============================================================================

import { bossComfort } from '../../config/bosses.js';
import { look } from '../../config/look.js';
import { powerUps } from '../../config/powerUps.js';
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
  // Lit ceiling panels, per area: one material per area and original material (cloned once, before static batching).
  const panelSets = new Map(); // area -> [{ material, base }]
  const panelMaterials = new Map(); // `${area id}|${material uuid}` -> entry
  for (const mesh of hooks.panels ?? []) {
    const area = areaAt(mesh.getWorldPosition(mesh.position.clone()));
    if (!area || !mesh.material?.emissive) continue;
    const key = `${area.id}|${mesh.material.uuid}`;
    if (!panelMaterials.has(key)) {
      const material = mesh.material.clone();
      material.userData.animated = true;
      const entry = { material, base: material.emissiveIntensity };
      panelMaterials.set(key, entry);
      if (!panelSets.has(area)) panelSets.set(area, []);
      panelSets.get(area).push(entry);
    }
    mesh.material = panelMaterials.get(key).material;
  }

  let runs = 0;
  let rand = seededRandom(feature.seed ?? 1);
  let deathOrder = [];
  let round = 0;
  let pendingCut = null; // seconds until this round's power cut
  let cut = null; // { area, timeLeft, stutter }
  let clearanceFlicker = null; // { area, timeLeft, hold, on }
  const flickerRand = seededRandom((feature.seed ?? 1) + 4099);
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

  // Each area's panels glow at the mean level of its lamps (0 = all dark); an area without lamps only goes dark in a cut.
  function syncPanels() {
    for (const [area, entries] of panelSets) {
      const mine = lamps.filter((l) => l.area === area);
      let level = mine.length ? mine.reduce((sum, l) => sum + (l.base > 0 ? l.light.intensity / l.base : 1), 0) / mine.length : 1;
      if (cut && cut.area === area && cut.level > 0) level = 0;
      const glow = cfg.panels.dark + (1 - cfg.panels.dark) * Math.min(1, Math.max(0, level));
      for (const e of entries) e.material.emissiveIntensity = e.base * glow;
    }
  }

  function endCut() {
    if (!cut) return;
    for (const n of cut.area.neons) n.setPower(1);
    for (const l of lamps) if (l.area === cut.area && !l.dead && l.dying <= 0) setLamp(l, 1);
    cut = null;
    state.cut = null;
  }

  function endClearanceFlicker() {
    if (!clearanceFlicker) return;
    const { area } = clearanceFlicker;
    clearanceFlicker = null;
    if (!cut || cut.area !== area) {
      for (const n of area.neons) n.setPower(1);
      for (const l of lamps) if (l.area === area && !l.dead && l.dying <= 0) setLamp(l, 1);
    }
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
    endClearanceFlicker();
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
    syncPanels();
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

  events.on('clearanceDetonated', ({ position }) => {
    if (!enabled || bossComfort.dimPhoneFlash) return;
    const area = areaAt(position) ?? areaAt(player.position);
    if (!area || (cut && cut.area === area)) return;
    clearanceFlicker = { area, timeLeft: powerUps.visual.clearanceFlicker.seconds, hold: 0, on: false };
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
      syncPanels(); // (last frame's lamp levels: one tick behind is invisible)
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
      if (clearanceFlicker) {
        clearanceFlicker.timeLeft -= dt;
        if (clearanceFlicker.timeLeft <= 0 || (cut && cut.area === clearanceFlicker.area)) {
          endClearanceFlicker();
        } else if ((clearanceFlicker.hold -= dt) <= 0) {
          clearanceFlicker.hold = between(flickerRand, HOLD);
          clearanceFlicker.on = !clearanceFlicker.on;
          const level = clearanceFlicker.on ? 1 : 0.12;
          for (const n of clearanceFlicker.area.neons) n.setPower(clearanceFlicker.on ? 1 : 0.15);
          for (const l of lamps) if (l.area === clearanceFlicker.area && !l.dead && l.dying <= 0) setLamp(l, level);
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
