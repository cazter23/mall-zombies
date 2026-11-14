// =============================================================================
// GUN SOUNDS (work in progress: the audio overhaul, branch claude/audio-overhaul)
// The new gun recipes (merged into audio.sounds by config/audio.js) and the data that changes a gun's sound per play:
// its Customer Service tier, renewals, Build-A-Blaster stuffing and low ammo (read by audio/recipes.js resolveVariant).
// The per-gun recipes are not written yet: every gun still plays its old recipe from config/audio.js.
// =============================================================================

export const gunSounds = {};

export const soundUpgrades = {
  tiers: {},
  renewal: null,
  maxRenewals: 5,
  stuffings: {},
  lowAmmo: null,
};
