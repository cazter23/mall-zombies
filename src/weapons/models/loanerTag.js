// The Courtesy Loaner's look: a shop security tag clamped to the top of the gun, with a paper "property of" tag swinging from it. Reversible, like
// the other upgrade visuals: show(false) hides it and the model itself is never changed. (Top of the gun: on the Staple Gun the hand covers the side.)
import * as THREE from 'three';

const CLAMP = { width: .026, height: .014, length: .05, dotRadius: .0045 };
const CORD = { length: .012, width: .0016, out: .018 };
const CARD = { width: .034, height: .026, thickness: .001, swing: .28, speed: 3.4 };

export function createLoanerTag(gun, mounts = {}) {
  const anchor = mounts.top;
  if (!anchor) return { show() {}, animate() {} };
  const root = new THREE.Group();
  root.name = 'loanerTag';
  root.visible = false;
  root.position.set(...anchor.position);
  root.position.y += CLAMP.height / 2;

  const plastic = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: .45 });
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(CLAMP.width, CLAMP.height, CLAMP.length), plastic);
  clamp.name = 'loanerClamp';
  root.add(clamp);
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(CLAMP.dotRadius, CLAMP.dotRadius, .002, 12),
    new THREE.MeshBasicMaterial({ color: 0xe0313a }));
  dot.position.y = CLAMP.height / 2 + .001;
  root.add(dot);

  // Hangs off the left side, clear of the gun and the hand, with its face to the camera so you can see it swing.
  const hanger = new THREE.Group();
  hanger.position.x = -CLAMP.width / 2 - CORD.out;
  const cord = new THREE.Mesh(new THREE.BoxGeometry(CORD.width, CORD.length, CORD.width), new THREE.MeshStandardMaterial({ color: 0xe0313a, roughness: .8 }));
  cord.position.y = -CORD.length / 2;
  const card = new THREE.Mesh(new THREE.BoxGeometry(CARD.width, CARD.height, CARD.thickness), new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: .85 }));
  card.name = 'loanerCard';
  card.position.y = -CORD.length - CARD.height / 2;
  hanger.add(cord, card);
  root.add(hanger);
  gun.add(root);

  return {
    show(on) { root.visible = on; },
    /** The card swings as you move. `time` in seconds. */
    animate(time) {
      if (root.visible) hanger.rotation.z = Math.sin(time * CARD.speed) * CARD.swing;
    },
  };
}
