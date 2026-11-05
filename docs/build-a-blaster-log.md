# Build-A-Blaster rebuild: running log

Branch `build-a-blaster`, worktree `.claude/worktrees/build-a-blaster`, cut from main at ee5a58a. The plan is docs/build-a-blaster-plan.md.
Baseline before any change: 623 tests, all passing.

## Phase 1: the room

**What changed.** The workshop now has a back hall behind the storefront: interior x -9.5..4.9, z 12..26.5, 4.8 m high, opening off the storefront through a mouth as
wide as the storefront. The tank, U-shaped conveyor, Naming Booth, lever and Returns Chute are plain blocks. The bench moved to the middle of the storefront and still sells
Party Trap and Clearance Rack. New test file: tests/workshopRoom.test.js.

**Verified.**
- Tests: lanes of at least 3 m, a player lap both ways, zombies can reach every floor point, a zombie follows round each side of the island, culling, grade, coplanar.
- Built game: walked the views with `window.__mall`, looked at screenshots of the hall and storefront, and bought Clearance Rack at the moved bench through the real input path (1000 spent, mod fitted).
- Performance, read from `renderer.info` in the built game (draw calls / triangles):

| View | Calls | Triangles |
|---|---|---|
| Hall, SW corner | 189 | 19k |
| Hall, SE corner | 144 | 17k |
| Hall, north lane looking out through the mouth | 876 | 106k |
| Storefront | 168 | 18k |
| Promenade at the window | 210 | 28k |
| Hallway | 1082 | 171k |
| Level 2 | 1397 | 260k |
| HOFFMAN'S | 515 | 80k |
| Atrium court | 305 | 40k |

The 876 view is the room looking out over the Promenade and down a balcony. It is still below the hallway and Level 2.

**Decisions made for you.**
- Hall height 4.8 m rather than the Promenade's 3.6 m, so the tank can be tall. The storefront stays 3.6 m, which gives a small reveal through the mouth.
- Hall runs to x 4.9, not 5: the Atrium's exterior wall starts at x 5.27 and the wall needs to fit before it. West goes to x -9.5 and north to z 26.5 (slightly past the 14 x 14 target) so the booth fits and every lane stays at least 3 m.
- The conveyor is a U open to the east instead of the plan's sketch, so it ends at the north-east corner beside the booth. The gun travels away from the doors, and the east side of the tank stays visible.
- Booth sits on the east wall with the lever further south along it, past the end of the conveyor.
- The island's guard is one bullet-through collider 2.2 m high. A separate conveyor at counter height would have been vaultable, and a player inside the ring could not be reached by zombies.

**Test changed on purpose.** tests/promenade.test.js: the walk-through used the old machine position, which no longer exists. It now crosses behind the bench. Same route check.

**Tooling note.** The preview tool's launch config only exists in the main checkout and runs from there, so `mall-zombies-preview` serves main's build. I did not edit that file. I run `npm run preview -- --port 4188` from the worktree instead and open that URL.

