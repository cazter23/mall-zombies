// Controlled combat, not a human playtest: real game, hitboxes, bloom, recoil,
// burst/reload timing and ammo. Targets stand still; aim tracks their centre
// with perfect recoil compensation. No perks, drops, movement or purchases.
import * as THREE from 'three';
import { headlessGame } from './headlessGame.js';
import { weapons } from '../../src/config/weapons.js';
import { zombieHealthFor } from '../../src/config/economy.js';
import { withTier } from '../../src/weapons/upgrades.js';
import { seededRandom } from '../../src/world/textures.js';

export function createWeaponTrial() {
  const t = headlessGame(), { g, input } = t;
  g.rounds.update = () => {};
  // Incentives would contaminate the weapon comparison after several kills.
  g.powerUps.update = () => {};
  function run({ id, round, range = 5, part = 'body', ads = true, tier = 'standard', type = 'shopper', count = 1, seed = 1986 }) {
    g.resetRun(); g.state.forceRun = true; g.health.invulnerable = true;
    g.debug.run('doors'); g.rounds.jumpTo(round); g.zombies.clear();
    g.gun.give(weapons[id]);
    g.gun.setMods(id, withTier(weapons[id], [], tier));
    g.gun.give(weapons[id]); // refill the resolved capacity, just like an ammo buy
    g.player.teleport({ position: new THREE.Vector3(19, 0, 0), yaw: Math.PI / 2 });
    if (ads) input.held.add('Mouse2'); t.tick(60);
    let z, kills = 0, first = null, last = null, reloads = 0, reloading = false;
    const spawn = () => {
      z = g.zombies.spawn(type, new THREE.Vector3(19 - range, 0, 0));
      z.setState('chasing'); z.health = zombieHealthFor(type, round); z.updateHitboxes();
      z.update = () => {}; // exclude pursuit/knockback without changing shootability
    };
    spawn();
    const shotsBefore = g.runStats.shotsFired, hitsBefore = g.runStats.shotsHit;
    const headBefore = g.runStats.headshotKills;
    const realRandom = Math.random; Math.random = seededRandom(seed);
    input.held.add('Mouse0');
    try {
      for (let tick = 0; tick < 60 * 60; tick++) {
        const hb = z.type.hitbox;
        const height = part === 'head' ? (hb.headBottom + hb.headTop) / 2 : hb.bodyTop * .7;
        g.player.yaw = Math.PI / 2 - g.player.viewKickYaw;
        g.player.pitch = Math.atan2(height - g.player.eyeHeight, range) - g.player.viewKick;
        if (weapons[id].fireMode === 'semi' || weapons[id].fireMode === 'burst') input.pressed.add('Mouse0');
        t.tick();
        if (first === null && g.runStats.shotsFired > shotsBefore) first = tick;
        if (g.gun.weapon.isReloading && !reloading) reloads++;
        reloading = g.gun.weapon.isReloading;
        if (!z.isAlive) {
          kills++; last = tick;
          if (kills === count) break;
          spawn();
        }
        if (!g.gun.weapon.magazine && !g.gun.weapon.reserve && !g.gun.weapon.isReloading) break;
      }
    } finally { Math.random = realRandom; input.clear(); }
    return { id, round, range, part, ads, tier, type, targets: count, kills,
      seconds: last === null ? null : +(Math.max(0, last - first) / 60).toFixed(3),
      shots: g.runStats.shotsFired - shotsBefore, hits: g.runStats.shotsHit - hitsBefore,
      headKills: g.runStats.headshotKills - headBefore, reloads,
      magazineLeft: g.gun.weapon.magazine, reserveLeft: g.gun.weapon.reserve };
  }
  return { run, dispose: () => g.map.dispose() };
}
