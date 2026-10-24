// =============================================================================
// ZONE COLOUR GRADING (visual overhaul, zone lighting): each area of the map has a GRADE (exposure, tint, saturation,
// contrast; config/look.js `grading`), and the view eases towards the grade of the area the camera is in. The front of the
// mall stays bright; back of house goes dark and sickly, with the screen edges closing in (vignette). Visual only: nothing in the game reads it.
//
//   map.gradeZones  [{ grade, minX, maxX, minZ, maxZ, minY?, maxY? }]   first match wins (list small areas first);
//                   outside every zone = grading.fallback
//   const grading = createZoneGrading({ zones, grades, fallback, blendSeconds })
//   grading.update(dt, position, enabled) -> the current grade (eased; NEUTRAL_GRADE while disabled)
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
  const targetAt = (position) => gradeFor(gradeZoneAt(zones, position));

  return {
    get current() {
      return current;
    },
    update(dt, position, enabled = true) {
      const target = enabled ? targetAt(position) : NEUTRAL_GRADE;
      const k = blendSeconds > 0 ? 1 - Math.exp(-Math.max(0, dt) / blendSeconds) : 1;
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
