// =============================================================================
// GUN UPGRADES: Extended Warranty tiers + store attachments (config/upgrades.js) as MODS for
// weapons/gunStats.js resolveGun. Pure functions, no game state: a carried gun's upgrades live in its
// slot's mod list (playerGun.modsFor / setMods), next to any Build-A-Blaster mod, so they stay through
// ammo buys and go with the gun.
//
// Mod ids: 'tier' (one per gun) and 'attachment:<slot>' (one per slot); other ids (Build-A-Blaster)
// are left alone. Each mod also says what it is ({ tier } / { attachment }) so the HUD, shops and the
// gun model can read a gun's upgrades back.
//
//   tierOf(mods)                      'standard' | 'deluxe' | ...
//   nextTier(mods)                    the next tier's id, or null at the top
//   attachmentsOf(mods)               { barrel: 'sawnOff', sight: ... } (only fitted slots)
//   attachmentFits(base, attachmentId)   would it do anything on this gun?
//   withTier(base, mods, tierId)      a NEW mod list with the gun at that tier
//   withAttachment(base, mods, id)    a NEW mod list with that attachment in its slot (replacing the old one)
// `base` = the gun's config entry (resolved guns carry it as def.base).
// =============================================================================

import { upgrades } from '../config/upgrades.js';

export const TIER_IDS = upgrades.tiers.map((t) => t.id);

export function tierById(id) {
  const tier = upgrades.tiers.find((t) => t.id === id);
  if (!tier) throw new Error(`upgrades: unknown tier "${id}" (${TIER_IDS.join(', ')})`);
  return tier;
}

export function attachmentById(id) {
  if (!Object.hasOwn(upgrades.attachments, id)) throw new Error(`upgrades: unknown attachment "${id}"`);
  return upgrades.attachments[id];
}

export function tierOf(mods = []) {
  return mods.find((m) => m.id === 'tier')?.tier ?? 'standard';
}

export function nextTier(mods = []) {
  const i = TIER_IDS.indexOf(tierOf(mods));
  return i + 1 < TIER_IDS.length ? TIER_IDS[i + 1] : null;
}

export function attachmentsOf(mods = []) {
  const fitted = {};
  for (const m of mods) if (m.attachment) fitted[attachmentById(m.attachment).slot] = m.attachment;
  return fitted;
}

// --- Effects -> stat changes for ONE gun ---

const mul = (stat, value) => ({ stat, op: 'mul', value });

// Each effect: (value, gun) -> modifiers, or null when this gun has nothing for it to change.
const EFFECTS = {
  damage: (v) => [mul('damage', v)],
  magazine: (v) => [mul('magazineSize', v)],
  reload: (v, g) =>
    g.shellReload
      ? [mul('shellReload.startSeconds', v), mul('shellReload.shellSeconds', v), mul('shellReload.endSeconds', v)]
      : [mul('reloadTime', v)],
  falloffRange: (v, g) => (g.falloff ? [mul('falloff.start', v), mul('falloff.end', v)] : null),
  hipSpread: (v, g) => [
    ...['base', 'moving', 'airborne', 'perShot', 'maxBloom'].map((k) => mul(`spread.${k}`, v)),
    mul('spread.adsMultiplier', 1 / v), // (aimed spread = hip spread x adsMultiplier: keep it where it was)
    ...(g.pellets ? [mul('pellets.spreadDegrees', v), mul('pellets.adsMultiplier', 1 / v)] : []),
  ],
  adsSpread: (v, g) => [mul('spread.adsMultiplier', v), ...(g.pellets ? [mul('pellets.adsMultiplier', v)] : [])],
  adsTime: (v) => [mul('ads.seconds', v)],
  zoom: (v) => [mul('ads.fovMultiplier', v)],
  recoil: (v) => ['recoil.pitchDegrees', 'recoil.yawDegrees', 'recoil.model.back', 'recoil.model.pitchDegrees'].map((s) => mul(s, v)),
};

/** The modifiers for a set of effects on this gun. `onMissing(effect)` decides what an inapplicable effect does. */
function modifiersFor(base, effects, onMissing) {
  const out = [];
  for (const [effect, value] of Object.entries(effects)) {
    if (!Object.hasOwn(EFFECTS, effect)) throw new Error(`upgrades: unknown effect "${effect}"`);
    const mods = EFFECTS[effect](value, base);
    if (mods) out.push(...mods);
    else onMissing(effect);
  }
  return out;
}

function attachmentModifiers(base, attachment) {
  let missing = false;
  const modifiers = modifiersFor(base, attachment.effects, (effect) => {
    if (effect === 'falloffRange' && attachment.falloffIfNone) return; // handled below
    missing = true;
  });
  if (!base.falloff && attachment.falloffIfNone && 'falloffRange' in attachment.effects) {
    modifiers.push({ stat: 'falloff', op: 'set', value: attachment.falloffIfNone });
  }
  return missing ? null : modifiers;
}

export function attachmentFits(base, id) {
  return attachmentModifiers(base, attachmentById(id)) !== null;
}

export function withTier(base, mods, tierId) {
  const tier = tierById(tierId);
  const rest = mods.filter((m) => m.id !== 'tier');
  if (tier.id === 'standard') return rest;
  const modifiers = modifiersFor(base, tier.effects, (effect) => {
    throw new Error(`upgrades: tier "${tier.id}" effect "${effect}" does nothing on ${base.id}`);
  });
  return [...rest, { id: 'tier', tier: tier.id, modifiers }];
}

export function withAttachment(base, mods, id) {
  const attachment = attachmentById(id);
  const modifiers = attachmentModifiers(base, attachment);
  if (!modifiers) throw new Error(`upgrades: ${attachment.name} doesn't fit the ${base.name}`);
  const modId = `attachment:${attachment.slot}`;
  return [...mods.filter((m) => m.id !== modId), { id: modId, attachment: id, modifiers }];
}
