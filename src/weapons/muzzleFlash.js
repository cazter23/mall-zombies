// =============================================================================
// MUZZLE FLASH
// A short, bright cartoon burst at the gun's muzzle (two additive sprites with a
// random twist and size each shot), plus two flashes of light: one in the gun's
// own scene so the gun and hands light up, one in the world so nearby walls and
// zombies flicker. Lasts a few frames. Config: weapons.<id>.muzzleFlash.
//
// The lights always exist (at zero brightness when idle): adding/removing lights
// at runtime makes three.js recompile shaders, which would hitch on the first shot.
// =============================================================================

import * as THREE from 'three';
import { makeFlashTexture } from '../world/textures.js';

// `lights` (optional): { handLight, worldLight } shared by every gun's flash, so switching guns
// never changes how many lights exist (see the note above). The flash recolors them when it fires.
export function createMuzzleFlash(cfg, lights = null) {
  const texture = makeFlashTexture();
  // The outer burst is drawn normally so its color holds up against bright walls; the core glows
  // (additive) on top of it.
  const sprite = (color, blending) => {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      blending,
      transparent: true,
      depthWrite: false, // depth-TESTED, so the hands and gun hide the parts of the burst behind them
    });
    const s = new THREE.Sprite(material);
    s.renderOrder = 10;
    return s;
  };

  // Attach `object` to the gun's muzzle point. It stays visible; only the burst inside toggles
  // (a light inside a hidden group drops out of the scene's light list, causing a recompile).
  const object = new THREE.Group();
  object.position.z = -cfg.forwardOffset; // a little in front of the muzzle
  const burst = new THREE.Group();
  const outer = sprite(cfg.outerColor, THREE.NormalBlending);
  const core = sprite(cfg.coreColor, THREE.AdditiveBlending);
  burst.add(outer, core);
  burst.visible = false;
  object.add(burst);

  // Lights the gun and hands (lives in the viewmodel scene, on the muzzle).
  const handLight = lights ? lights.handLight : new THREE.PointLight(cfg.lightColor, 0, cfg.handLightRange, 1);
  if (!lights) object.add(handLight);
  // Lights the world around the player (add to the world scene; placed every frame).
  const worldLight = lights ? lights.worldLight : new THREE.PointLight(cfg.lightColor, 0, cfg.worldLightRange, 2);

  let life = 0; // seconds left
  let scaleX = 1;
  let scaleY = 1;

  return {
    object,
    worldLight,

    // A shot just fired. `aimAmount` 0..1: down the sights the burst is wide and flat, so it
    // blasts out both sides of the gun's nose and stays below the crosshair.
    trigger(aimAmount = 0, tint = null) {
      life = cfg.seconds;
      outer.material.color.setHex(tint ?? cfg.outerColor); // (a Build-A-Blaster gun's flash takes its stuffing's colour)
      handLight.color.setHex(cfg.lightColor);
      handLight.distance = cfg.handLightRange;
      worldLight.color.setHex(cfg.lightColor);
      worldLight.distance = cfg.worldLightRange;
      const jitter = 1 - cfg.sizeJitter + Math.random() * cfg.sizeJitter * 2;
      scaleX = (1 + (cfg.adsWidth - 1) * aimAmount) * jitter;
      scaleY = (1 + (cfg.adsHeight - 1) * aimAmount) * jitter;
      // Random twist each shot. (A sprite's twist turns its whole quad, so the flat ADS burst only
      // gets a small one, or it would end up diagonal.)
      const twist = Math.PI * (1 - aimAmount * (1 - cfg.adsTwistFraction));
      outer.material.rotation = (Math.random() * 2 - 1) * twist;
      core.material.rotation = (Math.random() * 2 - 1) * twist;
    },

    // Call every rendered frame. The first frame after a shot shows the flash at full strength.
    update(dt) {
      if (life <= 0) {
        burst.visible = false;
        handLight.intensity = 0;
        worldLight.intensity = 0;
        return;
      }
      const t = life / cfg.seconds; // 1 -> 0
      burst.visible = true;
      const grow = 0.75 + 0.25 * t; // shrinks a little as it fades
      outer.scale.set(cfg.size * scaleX * grow, cfg.size * scaleY * grow, 1);
      core.scale.set(cfg.coreSize * scaleX * grow, cfg.coreSize * scaleY * grow, 1);
      outer.material.opacity = Math.min(1, t * 1.3) * cfg.outerOpacity;
      core.material.opacity = Math.min(1, t * 1.5);
      handLight.intensity = cfg.handLightIntensity * t;
      worldLight.intensity = cfg.worldLightIntensity * t;
      life -= dt;
    },

    reset() {
      life = 0;
      burst.visible = false;
    },
  };
}
