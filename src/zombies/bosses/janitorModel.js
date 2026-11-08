// Mounted on the existing animated bones so the mop swings with the hand and all
// props fall with Murray. The regular model owns and disposes the batched pieces.
export function dressJanitor(type, { upper, neck, arms, mat, block }) {
  function add(parent, pieces) {
    for (const { color, size, at, tilt = 0 } of pieces) {
      const mesh = block(mat(color), ...size, ...at, parent);
      mesh.rotation.z = tilt;
    }
  }
  add(upper, type.uniform);
  add(neck, type.cap);
  add(arms[1].elbow, type.mop);
}
