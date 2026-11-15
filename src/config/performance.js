// =============================================================================
// PERFORMANCE CONFIG: the knobs of the speed-ups, and the budgets the tests hold the game to.
// Nothing here changes what the game does: a speed-up must give the same result as the slow way
// (tests/colliderGrid.test.js compares them), it only gets there sooner.
// History and the measured numbers: docs/history.md (15 November 2026, the performance pass).
// =============================================================================

export const perf = {
  // world/colliderGrid.js: the collision boxes sorted into a grid, so a body reads the few boxes near it, not all ~670.
  collisionGrid: {
    cellSize: 2, // metres per cell (the mall is about 110 x 55 m: about 1,500 cells)
    reach: 1, // metres: a cell also lists every box within this of it, so one cell answers for any body up to this radius
    minBoxes: 48, // a shorter list is read whole (a test's handful of boxes, a single hitbox)
    buildAfterQueries: 8, // a list is only sorted once it has been asked this often (a throwaway list never is)
    maxCells: 200000, // a list spread wider than this many cells is read whole (a stray box a kilometre away)
  },

  // fx/shaderWarmup.js: after the shaders are compiled in the background, every object is drawn once into one pixel so its
  // textures are uploaded before you first look at it. That work is spread over frames:
  warmup: {
    budgetMs: 6, // milliseconds of it per frame (a frame at 60 fps has 16.7)
    firstBatch: 24, // objects in the first draw; the batch then grows or shrinks to fit the budget
  },

  // tests/drawBudget.test.js: the most things any benchmark shot may ask the graphics card to draw (counted headless: the
  // map and its props, no gun, zombies or post-processing), every door open. Set a little over what the mall draws today.
  drawBudget: {
    perShot: 900, // (15 November 2026: the worst is one end of the Food Court dolly, 829; the hallway 668, Level 2 678)
    average: 400, // over the 14 shots (356 today; 590 before a room seen through a doorway stopped being drawn whole)
    potatoPerShot: 540, // with Far objects and Small detail at Close (the worst today: 483)
  },
};
