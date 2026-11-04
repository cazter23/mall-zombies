import { resolveGun } from './gunStats.js';
import { withAttachment } from './upgrades.js';

// Compare resolved builds, including warranty and all the other fitted slots.
export function attachmentComparison(current, mods, id) {
  const next = resolveGun(current.base, withAttachment(current.base, mods, id));
  const out = [], number = n => Number(n.toFixed(2)).toString();
  const row = (label, a, b, unit = '') => { if (Math.abs(a - b) > 1e-7) out.push(`${label}: ${number(a)}${unit} → ${number(b)}${unit}`); };
  row('Magazine', current.magazineSize, next.magazineSize);
  const reload = d => d.shellReload ? d.shellReload.startSeconds + d.magazineSize * d.shellReload.shellSeconds + d.shellReload.endSeconds : d.reloadTime;
  row('Empty reload', reload(current), reload(next), 's');
  row(current.pellets ? 'Damage/pellet' : 'Damage', current.damage, next.damage);
  if (current.falloff && next.falloff) row('Full damage to', current.falloff.start, next.falloff.start, 'm');
  else if (next.falloff) out.push(`Full damage: unlimited → ${number(next.falloff.start)}m`);
  if (current.falloff && next.falloff) row('Falloff ends', current.falloff.end, next.falloff.end, 'm');
  row('Aim time', current.ads.seconds, next.ads.seconds, 's');
  row('Kick', current.recoil.pitchDegrees, next.recoil.pitchDegrees, '°');
  const cone = (d, ads) => d.spread.base * (ads ? d.spread.adsMultiplier : 1) + (d.pellets ? d.pellets.spreadDegrees * (ads ? d.pellets.adsMultiplier : 1) : 0);
  row('Hip cone', cone(current, false), cone(next, false), '°');
  row('Aimed cone', cone(current, true), cone(next, true), '°');
  row('ADS FOV', current.ads.fovMultiplier * 100, next.ads.fovMultiplier * 100, '%');
  return out.join(' · ');
}
