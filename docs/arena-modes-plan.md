# Arena Survival: the plan (`claude/arena-modes`, 15 November 2026)

Extra Modes on the run-mode screen: survive as many rounds as you can locked in ONE part of the mall. Three arenas: the Start
Room, the Sunset Cinema and Customer Parking. Everything below is a decision already made; the open questions for the user are
at the end.

## The rules of an arena

- You start inside the arena with the Staple Gun and the starting points (economy.startingPoints), like any run.
- The arena's exits are shut for the whole run. They are the normal shutters, closed, and the area system is SEALED
  (world/areaUnlocks.js `sealed`): no door or area purchase prompts, no door Flash Sales or Doorbusters, a door voucher is not
  eligible (it pays its points instead, like any voucher with nothing to buy).
- Zombies spawn only from the arena's spawn markers (only the arena's zones are open; every other zone is shut, the Start Room's
  too). The Start Room gets two extra markers, the parking lot one. Nothing ever spawns outside, so every zombie can reach you.
- Normal rounds, roster, HP scaling, power-ups, bosses on their usual rounds (the Last Customer never comes: she is Closing Time's).
- No Closing Time: no keys drop (game/closingTime.js `available` says no), no checklist briefing, no checklist on the pause card or
  HUD, no objective line from it, no van or validation prompts (game/features/escapeVan.js), no Night Safe (it is in the Hallway
  anyway). The HUD's objective line shows the arena's own line instead of "Open the shutter".
- Flash Sales and incentives run as normal: a sale group is only eligible where something of its kind is open (they already work
  by open zone), so an arena gets the sales its fixtures can use.
- Death shows the receipt, which names the arena. The best round per arena is saved in the career record and shown in the menu.
  Save & Quit works and Continue resumes in the same arena.

## Names (docs/voice.md: mall and retail jokes, deadpan)

| Arena | Name | Menu line | HUD line |
|---|---|---|---|
| Start Room | **Everything Must Go** | The closed-down store. A Price Gun, a refill machine and no exits. | Everything Must Go · Exits sealed |
| Sunset Cinema | **Last Showing** | Sealed in the Sunset Cinema. The feature runs until you stop. | Last Showing · Exits sealed |
| Customer Parking | **Lot Full** | Locked out in Customer Parking. Every space is taken. | Lot Full · Exits sealed |

"Extra Modes" stays the label (voice.md has no menu voice to say otherwise). Its sub-screen: kicker "Extra Modes", title
"Arena survival". The death receipt gets an "Arena" line; the pause card's kicker reads "Paused · Last Showing".
Round 1's PA opener is the arena's own line (config/arenas.js `pa`) instead of a random runIntro line.

## Each arena (coordinates in metres, +Y up; docs/map.md has the areas)

### Everything Must Go (zone `startRoom`, x -5..5, z 6.3..16, 4 m ceiling)
- Player spawn: the normal one, (0, 0, 12) facing +Z.
- Sealed: the start shutter (south wall, x -2..2) and HOFFMAN'S side door (west wall, z 11.6..13.5).
- Spawns: the two vents (-3.5 / 3.5, 0, 15.4) plus, arena only, `spawn_arena_startRoom_shutter` (0, 0, 6.9) (they squeeze under
  the shutter) and `spawn_arena_startRoom_sideDoor` (-4.3, 0, 12.55). Four markers round a 10 m room: with the 4 m spawn distance
  rule there is always one far enough from you.
- Fixtures: the Price Gun wall buy (existing) and, arena only, a RESTOCK-O-MATIC on the south wall west of the shutter: body
  x -4.45..-2.75, z 6.36..7.21 (centre x -3.6, clear of the wainscot rail), facing +Z.
- **No claw machine, no Customer Service.** The room is 10 x 10 m with a checkout counter, a shelf and crates already in it. The
  desk is 3.6 m wide, 1.9 m deep and 3.9 m tall with its sign: it would take a whole wall and the walls are where the zombies come
  from (vents north, shutter south, side door west, the Price Gun east). The claw machine fits (1.3 x 1.0 m) but a gun lottery from
  round 1 in a room with nothing else to buy turns the hard mode into a slot machine, and its stock and Sunny's walk need floor this
  room hasn't got. So: the Staple Gun, the Price Gun, the box cutter, refills, power-ups and whatever the bosses drop. That is the
  hard mode: no upgrades, only aim and movement.

### Last Showing (zone `cinema`: lobby, Screen 1, projection passage, the west stairwell and its return passage)
- Player spawn: (-29, 6.3, -4.5) facing -Z (the box office and the claw machine in view).
- Sealed: the Promenade shutter (east wall, z -4.1..-1.7) and the Service Corridor shutter at the bottom of the stairs.
- Spawns: the six cinema markers (no new ones: six is plenty for a wing this size).
- Fixtures already there: GRAB-A-GUN (its cinema site, lobby south wall at x -34.1), the RESTOCK-O-MATIC (lobby north wall,
  x -25.7), the Heavy Coil Nailer (projection passage, 2500), the 3D Glasses rack (lobby, by the concessions).
- Arena only: **Customer Service at the Box Office.** The lobby walls are full (posters, sealed screens, waiting seats, the
  concessions), so instead of a new booth the ticket booth (x -26.3..-22, z -10.35..-9.4) takes the desk's three windows:
  Extended Warranty in the middle (-24.15, 7.4, -9.0), Sharpening east (-22.9), Second Chance west (-25.4). Signs only (a
  CUSTOMER SERVICE board hung on two wires from the ceiling at y 6.3 + 4.12..4.58, z -9.3, above the office clock, and window
  labels on the glass at y 6.3 + 2.18): no new collider, so zombie routes in the cinema are the same even in the arena.
- Arena only: a **Nail Gun** wall buy (1000) on the lobby's east wall above the waiting seats, (-20.32, 8.05, -6.3) facing -X
  (north of the premiere programme poster, z -9.2..-7.4).
  The cinema's only gun was the 2500 Coil Nailer; the Nail Gun is the normal game's first real upgrade.

### Lot Full (zone `parkingLot`, x 34.3..62.3, z -24..6, ground y 0)
- Player spawn: (45, 0, 0) facing +Z (the row of stalls along the north fence).
- Sealed: the Mega Mart emergency-exit shutter (x 34..34.3, z 1..4).
- Spawns: the four lot markers plus, arena only, `spawn_arena_parkingLot_mallExit` (35.4, 0, 2.5) inside the entrance vestibule
  (they come out of the mall).
- Fixtures already there: GRAB-A-GUN (its parking site, on the facade at z -8) and Kiosk Kevin (his parking site from round 2).
- Arena only, all against the fences (the facade is covered in downpipes, vents, notices and a painted advert):
  - **Customer Service** desk (the Hallway's booth, built the same way) against the north fence: x 38.8..42.4, z 4.08..5.98,
    facing -Z, buy spots at z 3.98 (gun window x 40.6, Sharpening x 41.85, Second Chance x 39.35). One solid 3 m collider.
  - **RESTOCK-O-MATIC** against the north fence: x 53.65..55.35, z 5.13..5.98, facing -Z.
  - **Foam Dart Blaster** (1200) on a plywood board zip-tied to the north fence at x 45.2 (board x 44.5..45.9, y 0.9..2.1).
  - **Rivet Rifle** (1500) on a board on the east fence at z 0.5 (board z -0.2..1.2), facing -X.
  Everything clear of the north fence spawn (x 48), the vestibule and the lamp post.

## How a mode flows through the game

- `g.state.arena`: null (a normal run) or an arena id. `config/arenas.js` holds the names, text and per-arena data that is not
  geometry; `maps/mall/arenas.js` builds each arena's fixtures, spawns and player spawn from config/arenas.js and the area layouts,
  and the map exposes them as `map.arenas` + `map.setArena(id)`.
- Arena-only geometry is built into its own hidden group (`userData.dynamic`, so the static batcher and freezer leave it alone)
  with its own collider list. `map.setArena(id)` shows that arena's group and puts its colliders in the shared list (and takes the
  last arena's out), adds its spawn markers to `map.spawnPoints` and its features to `map.features`, opens exactly the arena's zones
  (the Start Room is shut unless it is the arena) and seals the area system. `map.setArena(null)` puts all of it back: in a normal
  run the map, colliders, spawns and features are exactly what they were.
- Arena-only features are built once with the rest (game/features/index.js), but each one's prompts are gated: they are only
  available while its arena is on, and anything it adds to the scene goes into its arena's group (hidden otherwise).
- createGame: a reset step `arena` (after `map`) applies `map.setArena(state.arena)`; the `player` step spawns you at the arena's
  spawn. `g.setArena(id)` sets the mode and resets the run if it changed. The claw machine and Kiosk Kevin start each run at their
  first site whose zone is open (a normal run: none is open at the start, so the first site, as before).
- Closing Time (`state.closingQuest` false in an arena): no key drops, no briefing; `showClosingGuidance` is false, so the pause
  card, HUD checklist, markers and the objective line skip it. The escape van's two prompts are unavailable.
- The run summary carries `arena`; the receipt, career record and menu read it.

## Menus (ui/screens.js, ui/runStart.js; one menu model: core/menuNav.js)

- Play -> the run-mode screen: Directed, Classic, **Extra Modes**, Back. Extra Modes opens `arenaMode`: the three arenas, each a
  button with its line and "Best round N" (or "No shifts filed yet"), then Back. Back (button, B, Esc) returns a level and puts the
  cursor back on what opened it. An arena button starts the run like a mode button (the chooser stays up until play starts).
- Remembered: the `closingMode` setting as now, plus a new `arenaChoice` setting ('none' or an arena id). The run-mode screen
  focuses Extra Modes when the last run was an arena, and the arena screen focuses that arena.
- Title: "Continue · Round 7 · Last Showing" when the save is an arena run.

## Saves

- A new save step `arena` (first in restore order): the arena id. Restoring it sets the arena and, if that differs from the
  current one, resets the run again before anything else is restored. Its reset step is the `arena` step above.
- Loading starts from a normal reset (a save without an `arena` entry is a normal run). Nothing else in a save changes shape, so
  `config/save.js` is not bumped.

## Stats (game/careerStats.js)

- An arena run counts in the career totals (shifts, time, kills, points) and the recent list (marked with the arena), but NOT in
  the main "Best shifts": those are the whole mall's. Each arena keeps its own best round (and its runs) under `arenas`. A new best
  is a new record on the receipt ("Best round · Last Showing"). Assisted runs save nothing, as now.
- The Statistics screen gains an "Arena survival" section with the three bests.

## Balance notes (no change to the main economy)

- The claw machine is playable from round 1 in the Cinema and the Parking Lot (in a normal run it costs a 500 shutter first). And
  with nothing to unlock, every point goes on guns and warranties. If that proves too strong: an arena price factor in g.pricing
  (an arena-only modifier on 'claw' and 'tier', like a permanent anti-sale), not a change to economy.js.
- Everything Must Go has no warranties: expect it to cap out early (the Price Gun, unupgraded, against round 15+ health). That is
  the point; if it is too short, the first thing to add is the box cutter's Sharpening window (a small sign on the counter).

## Test plan (tests/arenaModes.test.js, headless; npm run test:quick while building)

- Each arena: starts where it should; only its zones open; its exits never open (try buying at every door: nothing offered; a
  debug zone check after many rounds); zombies spawn only at its markers and reach the player (nav distance finite from each marker
  to the spawn, and a few rounds played with kills).
- Arena fixtures: the claw machine starts at the arena's site and works (pay, drop, take); the desk sells a warranty; the RESTOCK
  refills; the wall buys sell. Every arena-only spot is in plain sight and reachable from the player spawn; no arena collider
  overlaps a map collider or a spawn marker; standable rules hold with the arena's colliders in; coplanar (the arena groups are in
  the map group, so tests/coplanar.test.js covers them).
- Save & Quit in an arena and Continue: same arena, same round, same spawn rules.
- Best round: an arena death records it (and not in the main bests).
- A normal Directed/Classic run is unchanged: no arena colliders, fixtures, spawns or features; the same doors and zones; after an
  arena run, Play again in a normal mode gives the same colliders as a fresh game.
- Menus (tests/menus.test.js style): the run-mode screen has Extra Modes; Back returns a level; the arena choice is remembered.
- Full `npm test` once at the end; `npm run build`; a browser check of each arena and the menus with a fake controller.

## Phases (a commit after each)

1. The menu and a mode flag that reaches createGame and saves (no arena content yet: an arena run is the Start Room sealed).
2. The Cinema end to end.
3. The Parking Lot.
4. The Start Room.
5. Best rounds, the Statistics section, receipt and PA polish, docs.
