// A NO REFUNDS floor sign (config/returnQuest.js `signs`; the map lists one feature per sign, `sign` = its id).
// Step 1 of the Return to Sender quest (game/returnQuest.js): shoot every one. A yellow A-frame that can be shot (or
// cut) and falls flat. It pays nothing, is not a zombie, and has no collision: you and they walk through it.
// What it shows always follows the quest's own state, so Play again and Save & Quit stand it up or lay it down.
import * as THREE from 'three';
import { returnQuest as cfg } from '../../config/returnQuest.js';
import { makeSignTexture } from '../../world/textures.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const plane = new THREE.PlaneGeometry(1, 1);

export function buildRefundSign(feature, { scene, shootables, sound, returnQuest }) {
  const sign = cfg.signs.find(({ id }) => id === feature.sign);
  if (!sign) throw new Error(`refundSign "${feature.name}": no sign "${feature.sign}" in config/returnQuest.js`);
  const { board, print, hitbox } = cfg.sign;

  // Two leaning boards hinged at the top, a print on each outer face. `hinge` is what falls over.
  const group = new THREE.Group();
  group.name = feature.name;
  group.position.copy(feature.position);
  group.rotation.y = sign.facing ?? 0;
  group.userData.dynamic = true; // (it falls: keep it out of the static batch)
  const hinge = new THREE.Group();
  group.add(hinge);
  const boardMaterial = new THREE.MeshStandardMaterial({ color: board.color, roughness: 0.6, flatShading: true });
  const printMaterial = new THREE.MeshBasicMaterial({
    map: makeSignTexture(cfg.sign.text, { background: print.background, color: print.color, aspect: print.aspect, subtext: cfg.sign.subtext }),
  });
  for (const side of [1, -1]) {
    const leaf = new THREE.Group();
    leaf.position.set(0, board.height * Math.cos(board.lean), 0); // the hinge line, at the top
    leaf.rotation.x = side * board.lean;
    const panel = new THREE.Mesh(box, boardMaterial);
    panel.scale.set(board.width, board.height, board.thickness);
    panel.position.y = -board.height / 2;
    const face = new THREE.Mesh(plane, printMaterial);
    face.scale.set(print.width, print.height, 1);
    face.position.set(0, -(board.height - print.y), side * (board.thickness / 2 + print.lift));
    if (side < 0) face.rotation.y = Math.PI;
    leaf.add(panel, face);
    hinge.add(leaf);
  }
  scene.add(group);

  const target = {
    isRefundSign: true,
    ignoreAimAssist: true,
    ignoreVault: true,
    noRewards: true, // (no +10 for a sign)
    isAlive: false,
    position: feature.position.clone(),
    hitboxes: [{ part: 'body', box: new THREE.Box3(
      new THREE.Vector3(feature.position.x - hitbox.halfWidth, feature.position.y, feature.position.z - hitbox.halfWidth),
      new THREE.Vector3(feature.position.x + hitbox.halfWidth, feature.position.y + hitbox.height, feature.position.z + hitbox.halfWidth),
    ) }],
    splatColors: cfg.sign.splat,
    takeHit() {
      if (!target.isAlive || !returnQuest.shootSign(sign.id)) return { killed: false };
      sound?.play(cfg.sign.sound);
      show(true);
      return { killed: true };
    },
  };

  let down = null, fall = 0; // fall: 0 standing .. 1 flat
  function show(isDown, instant = false) {
    if (down === isDown) return;
    down = isDown;
    target.isAlive = !isDown;
    const at = shootables.indexOf(target);
    if (isDown && at !== -1) shootables.splice(at, 1);
    if (!isDown && at === -1) shootables.push(target);
    if (instant || !isDown) { fall = isDown ? 1 : 0; pose(); }
  }
  function pose() {
    const eased = fall * fall * (3 - 2 * fall);
    hinge.rotation.x = -eased * cfg.sign.fallAngle;
    hinge.position.y = -eased * 0.04;
  }
  show(returnQuest.signDown(sign.id), true);

  return {
    sign,
    group,
    target,
    update(dt) {
      show(returnQuest.signDown(sign.id), true); // (a reset, a load or the debug shortcut changed it: no animation)
      if (down && fall < 1) { fall = Math.min(1, fall + dt / cfg.sign.fallSeconds); pose(); }
    },
  };
}
