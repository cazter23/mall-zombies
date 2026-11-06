import * as THREE from 'three';

// Each articulated foam piece supplies the same local box to the model and the
// shot test. The fixed tick places hitboxes, while render can interpolate the root.
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
  function block(parent, color, size, at, tilt = 0) {
    if (!materials.has(color)) {
      materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: type.plastic.roughness }));
    }
    const mesh = new THREE.Mesh(geometry, materials.get(color));
    mesh.scale.set(...size);
    mesh.position.set(...at);
    mesh.rotation.z = tilt;
    parent.add(mesh);
    return mesh;
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

  function track(group, part) {
    const localBox = new THREE.Box3();
    for (const mesh of group.children) {
      mesh.updateMatrix();
      localBox.union(geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
    }
    return { part, box: new THREE.Box3(), localBox, group, toWorld: new THREE.Matrix4(), toLocal: new THREE.Matrix4() };
  }

  const torso = piece(upper, 'mascotTorso', cfg.torso, cfg.colors.suit);
  decorate(torso, cfg.uniform);
  const bodyBoxes = [track(torso, 'body')];
  const helmet = piece(upper, 'mascotHelmet', cfg.helmet, type.plastic.color);
  for (const x of cfg.grid.centers) {
    for (const y of cfg.grid.rows) block(helmet, cfg.colors.toast, cfg.grid.size, [x, y, cfg.grid.z]);
  }
  decorate(helmet, cfg.waffleFace);
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
      track(piece(leg, 'mascotBoot', cfg.boot, cfg.colors.crust), 'body'),
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
  let floor = 0;

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

    for (let i = 0; i < drop.stuffingCount; i++) {
      const color = type.splatColors[i % type.splatColors.length];
      const mesh = block(debris, color, [drop.stuffingSize, drop.stuffingSize, drop.stuffingSize], [0, 0, 0]);
      const scatter = new THREE.Vector3(random() * 2 - 1, random(), random() * 2 - 1).multiplyScalar(drop.stuffingSpeed);
      scatter.y += drop.stuffingUp;
      stuffing.push({ mesh, scatter });
    }
  }

  function animateDebris(age) {
    if (age >= drop.seconds) {
      debris.removeFromParent();
      return;
    }
    const t = Math.min(age, drop.tumbleSeconds);
    helmet.position.copy(velocity).multiplyScalar(t);
    helmet.position.y = Math.max(floor - launch.y, helmet.position.y - drop.gravity * t * t / 2);
    helmet.rotation.set(initialSpin.x + drop.spin[0] * t, initialSpin.y + drop.spin[1] * t, initialSpin.z + drop.spin[2] * t);

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
      if (zombie.mascotHeadOff) animateDebris(zombie.mascotDropAge ?? 0);
    },
    dispose() {
      root.removeFromParent();
      debris.removeFromParent();
      geometry.dispose();
      for (const material of materials.values()) material.dispose();
    },
  };
}
