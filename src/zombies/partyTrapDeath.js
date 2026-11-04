import * as THREE from 'three';
import { workshopBuilds } from '../config/workshop.js';

const cfg = workshopBuilds.partyTrap.pop;
const segments = 12;

// The trap pays the kill on impact. This owns only the brief pose and ribbon that follow it.
export function createPartyTrapDeaths({ scene, effects, playPop }) {
  const active = new Map();
  const endpoint = new THREE.Vector3(), plume = new THREE.Vector3();
  const fan = new THREE.Vector3();

  function start(zombie, trapPosition) {
    const feet = zombie.position.clone();
    const toward = trapPosition.clone().sub(feet).setY(0);
    if (toward.lengthSq() < .0001) toward.set(-Math.sin(zombie.yaw), 0, -Math.cos(zombie.yaw));
    toward.normalize();
    const anchor = trapPosition.clone().add(new THREE.Vector3(0, .07, 0));
    // Give a point-blank kill a visible length of ribbon as well.
    if (feet.distanceTo(anchor) < .35) anchor.copy(feet).addScaledVector(toward, .48).add(new THREE.Vector3(0, .07, 0));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((segments + 1) * 6), 3));
    const indices = [];
    for (let i = 0; i < segments * 2; i += 2) indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    geometry.setIndex(indices);
    const ribbon = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: 0xff438d, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    }));
    ribbon.name = 'partyTrapRibbon';
    ribbon.frustumCulled = false;
    scene.add(ribbon);
    zombie.flinchTimer = 0; // Freeze the pose in its own colors, after the usual white hit flash.
    zombie.model.update(0, zombie, 1);
    active.set(zombie, { feet, toward, anchor, ribbon, age: 0, previousAge: 0, popped: false });
    draw(active.get(zombie), zombie, 0);
  }

  function ankle(state, t) {
    const pull = Math.min(1, t * 2.4);
    endpoint.copy(state.feet).addScaledVector(state.toward, cfg.pullMeters * (1 - (1 - pull) ** 2));
    endpoint.y += .08 + Math.sin(Math.PI * t) * cfg.liftMeters;
    return endpoint;
  }

  function draw(state, zombie, age) {
    const t = Math.min(1, age / cfg.delaySeconds);
    const foot = ankle(state, t);
    if (!state.popped) {
      zombie.model.root.position.copy(foot).y -= .07;
      zombie.model.root.rotation.set(1.4 * t ** 1.5, Math.atan2(-state.toward.x, -state.toward.z), .18 * t, 'YXZ');
    }
    const linger = THREE.MathUtils.clamp((age - cfg.delaySeconds) / cfg.ribbonSeconds, 0, 1);
    const vertices = state.ribbon.geometry.attributes.position;
    for (let i = 0; i <= segments; i++) {
      const f = i / segments, bow = Math.sin(f * Math.PI);
      const x = THREE.MathUtils.lerp(state.anchor.x, foot.x, f);
      const y = THREE.MathUtils.lerp(state.anchor.y, foot.y, f) + bow * (.30 + .54 * linger) + f * linger * .42;
      const z = THREE.MathUtils.lerp(state.anchor.z, foot.z, f);
      const wave = Math.sin(f * 9 - age * 13) * bow * (.05 + .16 * linger);
      for (const side of [-1, 1]) vertices.setXYZ(2 * i + (side + 1) / 2,
        x - state.toward.z * (wave + side * .045), y + side * .025, z + state.toward.x * (wave + side * .045));
    }
    vertices.needsUpdate = true;
    state.ribbon.material.opacity = 1 - linger;
  }

  function remove(state) {
    state.ribbon.removeFromParent();
    state.ribbon.geometry.dispose();
    state.ribbon.material.dispose();
  }

  return {
    start,
    has: (zombie) => active.has(zombie),
    update(dt) {
      for (const [zombie, state] of active) {
        state.previousAge = state.age;
        state.age += dt;
        if (!state.popped && state.age >= cfg.delaySeconds) {
          const foot = ankle(state, 1);
          plume.copy(foot).addScaledVector(state.toward, -.55);
          plume.y += .48;
          fan.copy(state.toward).multiplyScalar(-.58).setY(.82).normalize();
          effects.confetti(plume, fan, cfg);
          playPop(plume);
          zombie.removed = true;
          state.popped = true;
        }
        if (state.age >= cfg.delaySeconds + cfg.ribbonSeconds) {
          remove(state);
          active.delete(zombie);
        }
      }
    },
    render(alpha) {
      for (const [zombie, state] of active) draw(state, zombie, THREE.MathUtils.lerp(state.previousAge, state.age, alpha));
    },
    clear() {
      for (const state of active.values()) remove(state);
      active.clear();
    },
  };
}
