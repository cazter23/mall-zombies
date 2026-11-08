// =============================================================================
// MASCOT HEADS: the helmet each Mascot costume wears (config/zombies.js mascotVariants[id].head.kind).
// zombies/mascotModel.js makes the helmet group (its main foam block = head.helmet, in head.color) and then
// calls HEADS[kind](head, group, kit) to add the rest. Every mesh added to `group` is part of the head hitbox
// (the model unions their boxes), so keep decorations close to the main block.
//   kit.block(parent, color, size, at, tilt)   a coloured box (shared geometry, material per colour)
//   kit.decorate(parent, parts)                blocks from a [{ color: name, size, at, tilt }] list
//   kit.colors                                 the costume's resolved colours, by name
// A new head = one function here + its kind in a costume's `head`.
// =============================================================================

export const HEADS = {
  // Sir Waffles: a square waffle with a grid of toasted dents and a buttery cartoon face.
  waffle(head, group, { block, decorate, colors }) {
    const { grid } = head;
    for (const x of grid.centers) {
      for (const y of grid.rows) block(group, colors[grid.color], grid.size, [x, y, grid.z]);
    }
    decorate(group, head.face);
  },
};

/** Add the costume's head pieces to the helmet group. */
export function buildMascotHead(head, group, kit) {
  const build = HEADS[head.kind];
  if (!build) throw new Error(`mascot: no head of kind "${head.kind}"`);
  build(head, group, kit);
}
