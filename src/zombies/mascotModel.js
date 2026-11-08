import * as THREE from 'three';
import { buildMascotHead } from './mascotHeads.js';

// Each articulated foam piece supplies the same local box to the model and the
// shot test. The fixed tick places hitboxes, while render can interpolate the root.
// The body is shared by every costume; the helmet comes from the costume's head (zombies/mascotHeads.js).
// A helmet can come off more than once (Captain Coupon puts his back on: beginReclaim / finishReclaim).
const smooth = (t) => t * t * (3 - 2 * t);

export function createMascotModel(type, random) {
  const cfg = type.mascot;
  const root = new THREE.Group();
  root.name = type.id;
  const body = new THREE.Group();
  const upper = new THREE.Group();
  upper.position.y = cfg.hipY;
  root.add(body);
  body.add(upper);

  const geometry = new THREE.BoxGeometry();
  geometry.computeBoundingBox();
  const materials = new Map();
  const ownMaterials = []; // a head's own materials (textured print...), freed with the colour ones
  function colorMaterial(color) {
    if (!materials.has(color)) {
      materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: type.plastic.roughness }));
    }
    return materials.get(color);
  }
  function block(parent, color, size, at, tilt = 0) {
    const mesh = new THREE.Mesh(geometry, colorMaterial(color));
    mesh.scale.set(...size);
    mesh.position.set(...at);
    mesh.rotation.z = tilt;
    parent.add(mesh);
    return mesh;
  }
  // Any other shape a head needs. `material` is a colour (shared like the blocks) or a material made with kit.material.
  function shape(parent, shapeGeometry, material, at = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(shapeGeometry, typeof material === 'number' ? colorMaterial(material) : material);
    mesh.position.set(...at);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }
  function ownMaterial(params) {
    const made = new THREE.MeshStandardMaterial({ roughness: type.plastic.roughness, ...params });
    ownMaterials.push(made);
    return made;
  }

  function piece(parent, name, { size, at }, color) {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(...at);
    parent.add(group);
    block(group, color, size, [0, 0, 0]);
    return group;
  }

  function decorate(parent, parts) {
    for (const { color, size, at, tilt } of parts) block(parent, cfg.colors[color], size, at, tilt);
  }

  // The union of the group's meshes, in the group's own space. A head may nest groups and use more than boxes,
  // so each mesh brings its own geometry's bounds through the transforms between it and the group.
  function track(group, part) {
    const localBox = new THREE.Box3();
    const addMeshes = (node, toGroup) => {
      for (const child of node.children) {
        child.updateMatrix();
        const matrix = toGroup ? new THREE.Matrix4().multiplyMatrices(toGroup, child.matrix) : child.matrix;
        if (child.isMesh) {
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          localBox.union(child.geometry.boundingBox.clone().applyMatrix4(matrix));
        }
        if (child.children.length) addMeshes(child, matrix);
      }
    };
    addMeshes(group, null);
    return { part, box: new THREE.Box3(), localBox, group, toWorld: new THREE.Matrix4(), toLocal: new THREE.Matrix4() };
  }

  const torso = piece(upper, 'mascotTorso', cfg.torso, cfg.colors.suit);
  decorate(torso, cfg.uniform);
  const bodyBoxes = [track(torso, 'body')];
  const helmet = new THREE.Group();
  helmet.name = 'mascotHelmet';
  helmet.position.set(...cfg.helmet.at);
  upper.add(helmet);
  buildMascotHead(cfg.head, helmet, { block, shape, decorate, material: ownMaterial, colors: cfg.colors });
  const head = piece(upper, 'mascotHead', cfg.exposedHead, cfg.colors.skin);
  decorate(head, cfg.zombieFace);
  head.visible = false;

  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * cfg.legX, cfg.hipY, 0);
    body.add(leg);
    legs.push(leg);
    bodyBoxes.push(
      track(piece(leg, 'mascotLeg', cfg.thigh, cfg.colors.suit), 'body'),
      track(piece(leg, 'mascotBoot', cfg.boot, cfg.colors.boot), 'body'),
    );

    const arm = new THREE.Group();
    const [x, y, z] = cfg.shoulder;
    arm.position.set(side * x, y, z);
    upper.add(arm);
    arms.push(arm);
    bodyBoxes.push(
      track(piece(arm, 'mascotSleeve', cfg.sleeve, cfg.colors.suit), 'body'),
      track(piece(arm, 'mascotMitt', cfg.mitt, cfg.colors.trim), 'body'),
    );
  }
  const covered = [track(helmet, 'head'), ...bodyBoxes];
  const exposed = [track(head, 'head'), ...bodyBoxes];

  // Putting the helmet back on (Captain Coupon): it is held in the root's space while it travels from the floor to
  // the shoulders, then goes back into its own place on the upper body.
  const liftFrom = new THREE.Vector3();
  const liftFromTurn = new THREE.Quaternion();
  const socket = new THREE.Vector3(cfg.helmet.at[0], cfg.hipY + cfg.helmet.at[1], cfg.helmet.at[2]);
  const upright = new THREE.Quaternion();

  function poseLift(zombie) {
    const lift = cfg.reclaim.lift;
    const t = 1 - zombie.mascotLift / cfg.reclaim.reclaimSeconds; // 0 -> 1 over the lift
    const reaching = t < lift.reachShare;
    const k = reaching ? 0 : smooth((t - lift.reachShare) / (1 - lift.reachShare));
    const bend = reaching ? smooth(t / lift.reachShare) : 1 - k;
    upper.rotation.set(-bend * lift.bend, 0, 0);
    for (const arm of arms) arm.rotation.x = reaching ? bend * lift.armsReach : THREE.MathUtils.lerp(lift.armsReach, lift.armsHold, Math.sin(k * Math.PI));
    if (helmet.parent !== root) return; // (only while it is in his hands)
    helmet.position.lerpVectors(liftFrom, socket, k);
    helmet.position.y += Math.sin(k * Math.PI) * lift.rise; // up over the head, then down onto it
    helmet.quaternion.slerpQuaternions(liftFromTurn, upright, k);
  }

  function pose(zombie, alpha) {
    root.position.lerpVectors(zombie.prevPosition, zombie.position, alpha);
    const yaw = zombie.yaw - zombie.prevYaw;
    root.rotation.y = zombie.prevYaw + Math.atan2(Math.sin(yaw), Math.cos(yaw)) * alpha;

    const { pose: tuning } = cfg;
    const bare = zombie.mascotHeadOff;
    const stride = Math.sin(zombie.mascotWalkPhase) * Math.min(1, zombie.horizontalSpeed / zombie.speed);
    const legSwing = bare ? tuning.rushStride : tuning.shambleStride;
    const armSwing = bare ? tuning.rushArm : tuning.shambleArm;
    const flinch = zombie.flinchTimer / zombie.flinchDuration;
    upper.rotation.set(tuning.recoil * flinch - (bare ? tuning.rushLean : 0), 0, stride * tuning.sway);
    legs[0].rotation.x = stride * legSwing;
    legs[1].rotation.x = -stride * legSwing;
    arms[0].rotation.x = -stride * armSwing;
    arms[1].rotation.x = stride * armSwing;

    const { attack } = type;
    if (zombie.state === 'windup') {
      const raise = zombie.windupSeconds - attack.slamSeconds;
      const raised = Math.PI / 2 + attack.armsRaisedRadians;
      const slammed = Math.PI / 2 + attack.armsSlammedRadians;
      for (const arm of arms) {
        if (zombie.stateTime < raise) {
          arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, raised, zombie.stateTime / raise);
        } else {
          arm.rotation.x = THREE.MathUtils.lerp(raised, slammed, ((zombie.stateTime - raise) / attack.slamSeconds) ** 2);
        }
      }
    } else if (zombie.state === 'swing') {
      for (const arm of arms) arm.rotation.x = Math.PI / 2 + attack.armsSlammedRadians;
      upper.rotation.x -= tuning.attackLean;
    }
    if (zombie.mascotRage > 0 && zombie.isAlive) {
      upper.rotation.z = Math.sin(zombie.mascotRage * cfg.rage.shakeRate) * cfg.rage.shake;
      for (const arm of arms) arm.rotation.x = Math.PI / 2 + attack.armsRaisedRadians;
    }
    if (zombie.mascotLift > 0 && zombie.isAlive) poseLift(zombie);

    body.rotation.x = 0;
    if (zombie.state === 'spawning') {
      const t = Math.min(1, zombie.stateTime / type.spawnSeconds);
      const left = 1 - t * t * (3 - 2 * t);
      // Out of the Returns Chute it falls in, tumbling, instead of rising through the floor.
      root.position.y += zombie.dropHeight > 0 ? zombie.dropHeight * left : -cfg.spawnDepth * left;
      if (zombie.dropHeight > 0) body.rotation.x = left * tuning.dropTumble;
    } else if (!zombie.isAlive) {
      body.rotation.x = tuning.deathTip * Math.min(1, zombie.stateTime / type.fallSeconds);
      const sink = (zombie.stateTime - type.fallSeconds - type.corpseSeconds) / type.sinkSeconds;
      root.position.y -= tuning.sinkDepth * THREE.MathUtils.clamp(sink, 0, 1);
    }
  }

  const drop = cfg.drop;
  const debris = new THREE.Group();
  debris.name = 'mascotDebris';
  const launch = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const initialSpin = new THREE.Euler();
  const stuffing = [];
  let restYaw = 0;
  let floor = 0;
  let owners = 1; // the body, and the fallen helmet once there is one: they share a geometry and materials
  const free = () => {
    owners -= 1;
    if (owners > 0) return;
    geometry.dispose();
    for (const material of materials.values()) material.dispose();
    for (const material of ownMaterials) material.dispose();
  };

  function releaseHead(zombie) {
    pose(zombie, 1);
    root.updateWorldMatrix(true, true);
    helmet.getWorldPosition(launch);
    root.parent?.add(debris);
    debris.position.copy(launch);
    debris.attach(helmet);
    initialSpin.copy(helmet.rotation);
    head.visible = true;
    floor = zombie.position.y + drop.floorClearance;
    velocity.set(...drop.velocity).applyAxisAngle(THREE.Object3D.DEFAULT_UP, zombie.yaw);

    // The stuffing burst (the same pieces again if the helmet comes off a second time).
    for (let i = 0; i < drop.stuffingCount; i++) {
      if (!stuffing[i]) {
        const color = type.splatColors[i % type.splatColors.length];
        const mesh = block(debris, color, [drop.stuffingSize, drop.stuffingSize, drop.stuffingSize], [0, 0, 0]);
        stuffing.push({ mesh, scatter: new THREE.Vector3() });
      }
      const { scatter } = stuffing[i];
      scatter.set(random() * 2 - 1, random(), random() * 2 - 1).multiplyScalar(drop.stuffingSpeed);
      scatter.y += drop.stuffingUp;
    }
    return fallenHelmet();
  }

  // The helmet after it comes off. It outlives the body, so the zombie manager owns it: update() each tick, dispose() when the round ends.
  function fallenHelmet() {
    owners += 1;
    let age = 0, reach = 1;
    const seen = new THREE.Vector3();
    const landing = launch.clone().addScaledVector(velocity, drop.tumbleSeconds);
    const rest = landing.clone().setY(floor); // where it ends up lying (short of a wall: setReach)
    const handle = {
      landing, // where it would come down (the manager checks the way there for walls)
      rest,
      gone: false, // true once disposed (the round ended, a newer helmet took its place, it was picked up)
      setReach(fraction) {
        reach = fraction;
        rest.set(launch.x + (landing.x - launch.x) * reach, floor, launch.z + (landing.z - launch.z) * reach);
      },
      update(dt, target) {
        age += dt;
        animateDebris(age, reach);
        if (age < drop.tumbleSeconds) {
          restYaw = helmet.rotation.y;
          return;
        }
        // Down: it sits up and slowly turns to look at you.
        const settle = smooth(Math.min(1, (age - drop.tumbleSeconds) / cfg.leftHelmets.settleSeconds));
        helmet.rotation.x *= 1 - settle;
        helmet.rotation.z *= 1 - settle;
        helmet.getWorldPosition(seen);
        const wanted = Math.atan2(-(target.x - seen.x), -(target.z - seen.z));
        const turn = Math.atan2(Math.sin(wanted - restYaw), Math.cos(wanted - restYaw));
        restYaw += Math.sign(turn) * Math.min(Math.abs(turn), cfg.leftHelmets.turnSpeed * dt);
        helmet.rotation.y = restYaw;
      },
      dispose() {
        if (handle.gone) return;
        handle.gone = true;
        debris.removeFromParent();
        free();
      },
    };
    return handle;
  }

  function animateDebris(age, reach) {
    const t = Math.min(age, drop.tumbleSeconds);
    if (helmet.parent === debris) {
      helmet.position.copy(velocity).multiplyScalar(t);
      helmet.position.y = Math.max(floor - launch.y, helmet.position.y - drop.gravity * t * t / 2);
      helmet.position.x *= reach;
      helmet.position.z *= reach;
      helmet.rotation.set(initialSpin.x + drop.spin[0] * t, initialSpin.y + drop.spin[1] * t, initialSpin.z + drop.spin[2] * t);
    }

    const scale = drop.stuffingSize * Math.max(0, 1 - age / drop.stuffingSeconds);
    for (const { mesh, scatter } of stuffing) {
      mesh.visible = scale > 0;
      mesh.scale.setScalar(scale);
      mesh.position.copy(scatter).multiplyScalar(age);
      mesh.position.y -= drop.gravity * age * age / 2;
      mesh.rotation.set(scatter.z * age, scatter.x * age, 0);
    }
  }

  return {
    root,
    releaseHead,
    // Captain Coupon picks his helmet up off the floor: from here it rides in his hands (poseLift) until finishReclaim.
    beginReclaim(zombie) {
      pose(zombie, 1);
      root.updateWorldMatrix(true, true);
      root.attach(helmet); // (keeps it exactly where it lies)
      liftFrom.copy(helmet.position);
      liftFromTurn.copy(helmet.quaternion);
    },
    // ...and it is on again: back in its place, the green head hidden.
    finishReclaim() {
      upper.add(helmet);
      helmet.position.set(...cfg.helmet.at);
      helmet.quaternion.identity();
      head.visible = false;
    },
    // He died with it in his hands: it falls with the body (and goes when the body does).
    dropReclaim() {
      if (helmet.parent !== root) return;
      root.updateWorldMatrix(true, true);
      upper.attach(helmet);
    },
    updateHitboxes(zombie) {
      pose(zombie, 1);
      root.updateWorldMatrix(true, true);
      const hitboxes = zombie.mascotHeadOff ? exposed : covered;
      for (const hitbox of hitboxes) {
        hitbox.toWorld.copy(hitbox.group.matrixWorld);
        hitbox.box.copy(hitbox.localBox).applyMatrix4(hitbox.toWorld);
        hitbox.toLocal.copy(hitbox.toWorld).invert();
      }
      return hitboxes;
    },
    update(_frameTime, zombie, alpha) {
      pose(zombie, alpha);
    },
    dispose() {
      root.removeFromParent();
      free();
    },
  };
}
