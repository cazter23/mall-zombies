import * as THREE from 'three';
import { castShot } from '../../weapons/hitscan.js';

// Search actual reachable cell centres, never arbitrary world points or props.
// Small rooms can be narrower than the preferred 10–16 m band: use the safest
// visible cell available, keeping shootability and navigation as hard rules.
export function chooseFilmingSpot({ nav, player, zombie, colliders, config }) {
  const origin = player.position.clone(); origin.y += player.eyeHeight;
  const candidates = nav.reachablePoints(player.position.y).map(p => {
    const distance = Math.hypot(p.x-player.position.x,p.z-player.position.z);
    const relocate = Math.hypot(p.x-zombie.position.x,p.z-zombie.position.z);
    const inBand = distance >= config.minRange && distance <= config.maxRange;
    return { p, score: Math.abs(distance-config.preferredRange), inBand, relocate };
  }).sort((a,b) => Number(b.inBand)-Number(a.inBand)
    || Number(b.relocate >= config.minRelocate)-Number(a.relocate >= config.minRelocate) || a.score-b.score);
  for (const { p } of candidates) {
    const point = new THREE.Vector3(p.x,p.y,p.z);
    const direction = point.clone().setY(p.y+config.sightHeight).sub(origin);
    const length = direction.length();
    if (length === 0 || castShot(origin,direction.divideScalar(length),length,colliders,[]).worldHit) continue;
    const path = nav.pathTo(zombie.position,point);
    if (path) return { position: point, path };
  }
  return null;
}
