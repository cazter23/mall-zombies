// A kill in the Build-A-Blaster room: the corpse lifts off, shrinks, and flies into the Stuffing Tank. The kill is paid on impact,
// as always; this owns only the flight. The model is posed here each frame, so it never reaches the normal corpse animation.
import * as THREE from 'three';
import { workshopRitual } from '../config/workshop.js';

const { tankDeathSeconds: seconds, tankDeathSpin: spin, tankDeathArc: arc } = workshopRitual.spectacle;

export function createTankDeaths() {
  const active = new Map();
  const at = new THREE.Vector3();

  function draw(state, zombie, age) {
    const t = Math.min(1, age / seconds), eased = t * t * (3 - 2 * t);
    at.lerpVectors(state.from, state.mouth, eased);
    at.y += Math.sin(t * Math.PI) * arc;
    const { root } = zombie.model;
    root.position.copy(at);
    root.rotation.set(spin * t, zombie.yaw, spin * .6 * t, 'YXZ');
    root.scale.setScalar(Math.max(.05, 1 - eased * .95));
  }

  return {
    start(zombie, mouth) {
      if (active.has(zombie)) return;
      zombie.flinchTimer = 0;
      zombie.model.update(0, zombie, 1);
      active.set(zombie, { from: zombie.position.clone(), mouth, age: 0, previousAge: 0 });
    },
    has: (zombie) => active.has(zombie),
    remove: (zombie) => active.delete(zombie),
    update(dt) {
      for (const [zombie, state] of active) {
        state.previousAge = state.age;
        state.age += dt;
        if (state.age >= seconds) {
          zombie.removed = true;
          active.delete(zombie);
        }
      }
    },
    render(alpha) {
      for (const [zombie, state] of active) draw(state, zombie, THREE.MathUtils.lerp(state.previousAge, state.age, alpha));
    },
    clear() {
      active.clear();
    },
  };
}
