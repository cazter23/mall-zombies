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

## Phase 2: the ritual

**What changed.** New game/features/workshopRitual.js with states idle, running and ready. Hand your gun over at the bench and it rides the conveyor; kills in the room fill the gauge; the lever or the 45 s limit ends it; collect at the Naming Booth. New HUD order ticket. Effects are still a placeholder: the gun gets a build record (quality and kills) that does nothing yet.

**Verified.**
- tests/workshopRitual.test.js (20 tests) covers everything in the plan's "Done when": death and Play again mid-ritual, walking away and returning, the loaner returning, gun purchases mid-ritual, the chute adding no zombies, the round still ending.
- Built game, real ritual start to finish through `window.__mall`: paid 1500 at the bench, Courtesy Loaner came up, zombies landed at the chute, real shots from the loaner filled the gauge to 3, ticket read "Being stuffed · 34s, 3 in the tank · 4 for Regular", lever gave Understuffed, booth returned the Staple Gun with a full magazine and the build, ticket cleared. Then Play again mid-ritual left nothing behind. No console errors from the game.

**Decisions made for you.**
- Kills count anywhere in the workshop, storefront as well as hall.
- Spawns steer to the chute only while you are inside the room. If they stayed steered after you left, you could start a ritual and walk off, and every zombie would have a long trek to reach you.
- If you stand on the chute, spawns fall back to the normal markers rather than dropping a zombie on you.
- The clock keeps running after you leave. The gun then waits at the booth with no deadline.
- The gun comes back with a full magazine; its reserve is unchanged. Handing over an empty gun and collecting it empty mid-fight felt bad.
- Collecting with a full loadout replaces the gun in your hand, the same rule as a wall buy, and the booth ticket warns you first ("Replaces your Foam Dart Blaster"). Buying the same gun again mid-ritual is allowed; the finished gun replaces that copy.
- The loaner shows on the HUD as "Courtesy Loaner". Customer Service and attachment counters ignore it, so nobody pays to upgrade a gun that gets taken back.
- Limited Editions needed their own spot now the bench takes guns for the ritual, so they moved to a shelf behind the display window. Price unchanged.
- A gun can hold a Limited Edition and a ritual build at once.
- New debug key Y teleports to the bench and opens the Promenade. (J was my first choice, but tests/debugCommands.test.js relies on J being unbound, so I took Y.)

**Test changed on purpose.** tests/workshop.test.js: the first test now stands at the Limited Editions shelf rather than the bench. Same checks, new spot.

