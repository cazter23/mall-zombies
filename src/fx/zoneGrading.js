// =============================================================================
// ZONE COLOUR GRADING (visual overhaul, zone lighting): each area of the map has a GRADE (exposure, tint, saturation,
// contrast; config/look.js `grading`), and the view eases towards the grade of the area the camera is in. The front of the
// mall stays bright; back of house goes dark and sickly, with the screen edges closing in (vignette). Visual only: nothing in the game reads it.
//
//   map.gradeZones  [{ grade, minX, maxX, minZ, maxZ, minY?, maxY? }]   first match wins (list small areas first);
//                   outside every zone = grading.fallback
//   const grading = createZoneGrading({ zones, grades, fallback, blendSeconds })
//   grading.update(dt, position, enabled, mood) -> the current grade (eased; NEUTRAL_GRADE while disabled)
//     mood (the horror layer, map.horror.state): { exposure (x every grade), decay (0..1: the `lateHours` grade multiplied
//     on by that much), cut: { grades, level } (those areas blend towards the `powerCut` grade by level) }
//   grading.snap(position)   jump straight to that spot's grade (no easing)
// fx/postProcessing.js applies a grade: exposure through the tone mapping, tint / saturation / contrast in its grade pass.
// =============================================================================

export const NEUTRAL_GRADE = Object.freeze({ exposure: 1, tint: Object.freeze([1, 1, 1]), saturation: 1, contrast: 1, vignette: 0 });

/** The id of the grade for a position (the first zone containing it), or null. */
export function gradeZoneAt(zones, p) {
  for (const z of zones) {
    if (p.x < z.minX || p.x > z.maxX || p.z < z.minZ || p.z > z.maxZ) continue;
    if (p.y < (z.minY ?? -Infinity) || p.y > (z.maxY ?? Infinity)) continue;
    return z.grade;
  }
  return null;
}

export function createZoneGrading({ zones = [], grades, fallback, blendSeconds = 0.8 }) {
  const full = (g) => ({ ...NEUTRAL_GRADE, ...g, tint: [...(g?.tint ?? NEUTRAL_GRADE.tint)] });
  const gradeFor = (id) => {
    const g = id != null ? grades[id] : null;
    if (id != null && !g) throw new Error(`zoneGrading: unknown grade "${id}"`);
    return full(g ?? grades[fallback] ?? NEUTRAL_GRADE);
  };
  for (const z of zones) gradeFor(z.grade); // (a typo in the map's zones fails at load, not on the first visit)

  const current = full(NEUTRAL_GRADE);
  const copy = (from) => {
    current.exposure = from.exposure;
    current.saturation = from.saturation;
    current.contrast = from.contrast;
    current.vignette = from.vignette;
    for (let i = 0; i < 3; i++) current.tint[i] = from.tint[i];
  };
  const targetAt = (position, mood) => {
    const id = gradeZoneAt(zones, position) ?? fallback;
    const target = gradeFor(id);
    // Late hours (mood.decay 0..1): the `lateHours` grade multiplied onto this area's own (vignette added), so a dark
    // back-of-house room gets darker too instead of being pulled towards an average.
    const decay = mood?.decay ?? 0;
    if (decay > 0 && grades.lateHours) {
      const late = gradeFor('lateHours');
      const toward = (value) => 1 + (value - 1) * decay;
      target.exposure *= toward(late.exposure);
      target.saturation *= toward(late.saturation);
      target.contrast *= toward(late.contrast);
      target.vignette += late.vignette * decay;
      for (let i = 0; i < 3; i++) target.tint[i] *= toward(late.tint[i]);
    }
    const cut = mood?.cut;
    if (cut && cut.level > 0 && grades.powerCut && cut.grades.includes(id)) {
      const red = gradeFor('powerCut');
      const k = cut.level;
      target.exposure += (red.exposure - target.exposure) * k;
      target.saturation += (red.saturation - target.saturation) * k;
      target.contrast += (red.contrast - target.contrast) * k;
      target.vignette += (red.vignette - target.vignette) * k;
      for (let i = 0; i < 3; i++) target.tint[i] += (red.tint[i] - target.tint[i]) * k;
    }
    target.exposure *= mood?.exposure ?? 1;
    return target;
  };

  return {
    get current() {
      return current;
    },
    update(dt, position, enabled = true, mood = null) {
      const target = enabled ? targetAt(position, mood) : NEUTRAL_GRADE;
      const blend = mood?.cut?.level > 0 ? Math.min(blendSeconds, 0.08) : blendSeconds; // (a power cut is instant)
      const k = blend > 0 ? 1 - Math.exp(-Math.max(0, dt) / blend) : 1;
      current.exposure += (target.exposure - current.exposure) * k;
      current.saturation += (target.saturation - current.saturation) * k;
      current.contrast += (target.contrast - current.contrast) * k;
      current.vignette += (target.vignette - current.vignette) * k;
      for (let i = 0; i < 3; i++) current.tint[i] += (target.tint[i] - current.tint[i]) * k;
      return current;
    },
    snap(position) {
      copy(targetAt(position));
      return current;
    },
  };
}
