// =============================================================================
// TITLE CAMERA: the slow flyover behind the main menu. Plays the map's camera shots (map.titleShots) one after
// another, forever: each shot glides the camera from `from` to `to` while its gaze moves from `lookFrom` to
// `lookTo` (smoothly eased), and the picture fades to black and back at every cut. Pure math, no DOM, so it can be
// tested in Node; main.js applies the pose to the real camera and the fade to the title screen.
//
//   createTitleCamera(shots, { shotSeconds, fadeSeconds })
//     update(dt)                  advance (seconds)
//     apply(camera) -> fade 0..1  put the camera at the current pose; returns how black the screen should be
//     restart()                   back to the first shot (shown when returning to the title)
//     shotIndex, shotTime         where it is (for tests)
// A shot: { from: [x, y, z], to: [x, y, z], lookFrom: [x, y, z], lookTo: [x, y, z] }
// =============================================================================

import * as THREE from 'three';

const smooth = (t) => t * t * (3 - 2 * t);

export function createTitleCamera(shots, { shotSeconds = 9, fadeSeconds = 0.8 } = {}) {
  if (!shots?.length) throw new Error('titleCamera: the map has no titleShots');
  let index = 0;
  let time = 0;
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  function pose(out, outLook) {
    const shot = shots[index];
    const t = smooth(Math.min(1, time / shotSeconds));
    out.copy(a.fromArray(shot.from)).lerp(b.fromArray(shot.to), t);
    outLook.copy(a.fromArray(shot.lookFrom)).lerp(b.fromArray(shot.lookTo), t);
  }

  return {
    get shotIndex() {
      return index;
    },
    get shotTime() {
      return time;
    },

    update(dt) {
      time += dt;
      while (time >= shotSeconds) {
        time -= shotSeconds;
        index = (index + 1) % shots.length;
      }
    },

    /** Moves the camera to the current pose. Returns the black fade (1 at a cut, 0 mid-shot). */
    apply(camera) {
      pose(pos, look);
      camera.position.copy(pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(look);
      const edge = Math.min(time, shotSeconds - time);
      return edge >= fadeSeconds ? 0 : 1 - edge / fadeSeconds;
    },

    restart() {
      index = 0;
      time = 0;
    },
  };
}
