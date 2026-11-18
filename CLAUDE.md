# Sunset Galleria

A campy, absurd, COD Zombies-style wave survival shooter set in a shopping mall.
Solo, one life, stylized low-poly look, cartoonish Halo CE-style splatter (colored
particle bursts, no realistic gore).

**Tech:** Three.js (^0.169) + Vite (^5.4), plain JavaScript (ES modules, `"type": "module"`).
No physics engine: simple capsule/box collision against axis-aligned boxes.

## Core loop
Survive waves in the mall, earn points for hits/kills, spend points on doors, weapons,
wardrobe, mods and hazards, repeat until you die. Death shows a results screen.

## Commands
```
npm install           # once
npm run test:quick    # WHILE ITERATING and for small commits on your own branch: the tests your change touches + a fast core set (--list, --all)
npm test              # the FULL suite: before merging into main, and after changing a shared system (createGame, zombies, collision, vault)
npm test -- tests/x.test.js   # just these files. Always test through npm (tools/runTests.mjs caps files at once: 4, MALL_TEST_JOBS=n to change);
                      # a bare `node --test` on many files runs 19 at once, ~9 GB, and freezes a 16 GB PC. A run of more than 8 files waits
                      # for any other big run on this PC ("Waiting for the run from <worktree>..."): that is normal, give it a long timeout
npm run dev           # Vite dev server (hot reload)
npm run build         # production build into dist/; run after every change to catch errors (it only bundles: it does not run the game)
npm run preview       # serve the built dist/
npm run build:single  # dist-single/sunset-galleria.html: the WHOLE game in one file (no server, no Node, no internet)
npm run play          # JUST PLAYING: rebuilds that file only if the code changed, opens it in Firefox (play.cmd = the same by double-click)
npm run audition      # the gun sound audition (tools/audition.html) as one file in Firefox: listen, compare, Measure
```
Reports (tools/, headless): `npm run balance` (guns: dps by range, pulls to kill by round), `melee` (box cutter tiers), `kiosk` (Kiosk
Kevin's equipment), `balance:bab` (Build-A-Blaster builds), `perf` (tick time; `--profile`, `--root <folder>`), `sim:claw` (GRAB-A-GUN odds),
`sim:challenges` (weapon-skin challenges), `sim:economy` (a bot's income by round; ~90 min cold, `--quick` for a look), and `sim:closing`
(Closing Time's quest bot: COSTLY and it measures the bot, not players: ask first).
There is no linter. Docs-only changes need no tests. What each test file covers: docs/tests.md (relationships and rules, not exact values).
tests/docs.test.js fails if a new src/ file or test file isn't described in the docs.

## Rules for working on this project
- Game logic runs on a fixed 60Hz timestep; rendering is decoupled (render gets `alpha` to interpolate).
- Every tunable number lives in `src/config/` (`feel.js`, `economy.js`, `weapons.js`, `zombies.js`, `controls.js`,
  `audio.js`, `debug.js`, one file per area...), never hardcoded in logic.
- Guns: numbers only in `config/weapons.js`; they are COMBINED only in `weapons/gunStats.js` (hitDamage per hit,
  resolveGun for upgrades). Upgrades never edit config entries. After any weapon change run `npm run balance` and
  `npm test` (tests/balance.test.js checks each gun still does its job).
- All player stats live in one stats object (`src/player/stats.js`) so the wardrobe, power-ups and anything else that
  changes the player modify it in one place. Systems read stats, not config, at runtime.
- Death is handled in one function (`onPlayerDeath` in `game/createGame.js`); Second Chance (game/secondChance.js, the
  self-revive) is redeemed there. `player/health.js` calls it exactly once when health reaches 0.
- Gameplay systems are built and ticked in `game/createGame.js` (no DOM/WebGL there, so it runs headless in tests).
  `main.js` is only the browser side. A new gameplay system is created and wired in createGame.js, never in main.js.
- Systems ANNOUNCE what happened on the event bus (`g.events`, game/events.js lists every event); features LISTEN.
  Don't thread new callbacks through createGame for things like Flash Sales, PA lines, hazards or perk procs.
  All kill payouts and kill stats come from the 'kill' event (whatever killed the zombie). Once the player is dead nothing
  more is paid or counted (events still fire). A hit on a target that is already dead (killed earlier in the same shot,
  e.g. by a kill listener) is skipped: no +10 for corpses.
- Every price the player pays comes from `g.pricing.priceOf(category, id)` (game/pricing.js), never straight from
  config/economy.js, so discounts (Flash Sales) apply everywhere at once.
- Map things the player interacts with (besides doors) are DATA in `map.features` ({ kind, name, zone, position, normal, ...}),
  built by kind in `game/features/`. A new kind (claw machine, fitting room, hazard...) = a module there + one registry line
  + entries in the map; createGame doesn't change.
- Keep code modular, readable and commented. Prefer small, reviewable changes.
- Build in small steps. Do only the step the user asks for. Test it, then tell them how to try it.
- After changes, run `npm run build` to check for errors.
- **Go easy on the PC (16 GB, several agents at once).** While fixing a failure, rerun only the failing file (`npm test -- tests/x.test.js`),
  never the full suite. Run the full suite once, when you are done, not again to recheck one fix. Sub-agents never run the full suite.
  One browser preview at a time: stop your preview server when the check is done.
- Gameplay reads ACTIONS, never raw keys: `input.actionDown/consumeAction/actionPressed('jump')` and
  `input.moveAxis()`. Bindings (keyboard `KeyboardEvent.code` + controller `Pad*` codes) live in
  `config/controls.js`. Raw codes are only used for debug keys in `main.js`.

## Docs index (read on demand)
| When you... | read |
|---|---|
| change or add a module | its entry in docs/folder-structure.md (search for the file name) |
| work in an area or add a door/spawn/buy spot | its entry in docs/map.md (adding an area: its checklist at the top) |
| want the background of a past decision, a measured number, or how an area was built | docs/history.md (newest first; older: docs/archive/) |
| want to know what is still open, or plan something new | docs/open-ideas.md (unbuilt ideas and balance proposals); finished plans are in docs/archive/ (README lists them) |
| want to know how COD zombies does something | docs/research/ (BO1, BO3, BO4 and Cold War script analyses, and a balance comparison) |
| touch behaviour and want to know which test guards it | docs/tests.md |
| add or restyle a sign, poster, neon or label (fonts, roles) | docs/typefaces.md (the type system); docs/typefaces-ledger.md (the signs as of 13 November) |
| change a gun | `npm run balance`; the reasons behind today's numbers: docs/archive/balance-review.md and docs/history.md |
| change a gun's or a hit's sound | docs/gun-sounds.md (config/gunSounds.js; listen and measure: `npm run dev`, /tools/audition.html) |
| change a zombie's sound, or where sounds come from (3D, walls, the crowd) | docs/spatial-audio.md (config/spatialAudio.js; the audition page's 3D card) |
| change a price, a payout or how strong an upgrade is | docs/economy-report.md and `npm run sim:economy` |
| write or change any line of game text | docs/voice.md |
| touch a menu, a prompt or anything a controller does (one menu model: core/menuNav.js) | docs/controller-audit.md; HUD text sizes: docs/ui-readability.md |

## Folder map (every module: docs/folder-structure.md)
```
src/main.js     BROWSER SIDE ONLY: renderer, scene, camera, input + gamepad, HUD, sound, viewmodel, menus, pointer lock, loop, window.__mall
src/game/       ALL gameplay wiring, DOM-free (runs headless): createGame.js builds + ticks every system; features/ = map features by kind
src/config/     EVERY tunable number (feel, economy, weapons, zombies, controls, audio, settings, debug, look, one file per area...)
src/core/  src/player/  src/weapons/  src/zombies/  src/maps/ (index.js = THE MAP INTERFACE; mall/; testRange/ = debug only)
src/world/ (shared building blocks)  src/fx/  src/audio/  src/ui/
tests/          node:test files + helpers/headlessGame.js (the real game running headless)
tools/          the test runner, the single-file build + play, the reports above
docs/           history, folder-structure, map, tests, open-ideas, topic guides; archive/ (finished plans, old history); research/
```

## How the pieces connect (the full walkthrough: docs/folder-structure.md, "How the pieces connect")
- `main.js` owns the loop: look input first each frame, then fixed 60 Hz ticks of `g.update(dt)` (createGame.js), then `render(alpha)`.
  Tick order matters: player, interactions (before the gun, so a held buy wins over reload), melee, gun, zombies, rounds, health, map,
  features, and `player.updateView` last (recoil shows on the next frame).
- Buying: `map.doors` and `map.features` become interactions; every price comes from `g.pricing`; an area unlock owns one destination
  and opens every barrier between owned areas.
- Points: gun and melee `onHit` -> 'hit' (+10); a death -> 'kill' (every payout). Death: `onPlayerDeath`; Play again = `resetRun()`
  through createGame's `resetSteps` (a new system with per-run state adds a step there). Save & Quit (game/saveGame.js) saves the run
  as of the round's start: every reset step is also in `saveSteps` (serialize/restore) or `transientSteps`, or tests/saveGame.test.js fails.
  Bump `config/save.js` version when what a step saves changes shape.
- Collision: one shared `colliders` array of Box3 (+ `colliders.ramps` for escalators/stairs). The player is a cylinder. `ignoreShots`
  boxes block walking, not bullets; `ledge` boxes are balcony rails you can climb over (player/vault.js).
- Coordinates: metres, +Y up, yaw 0 faces -Z. Test hook: `window.__mall.step(n)` with `game.forceRun`; tests use
  tests/helpers/headlessGame.js (the real game, no browser).

## Map (short; coordinates, spawns, buy spots and details per area in docs/map.md)
The start room opens into the MAIN HALLWAY (the hub); each area is bought once through any accessible entrance (prices: economy.doors,
keyed by destination area, read through `g.pricing`). Connections open free when both adjoining areas are owned; no cascading unlocks.
Nine area purchases total 9500; 15 physical barriers. Player spawn (0, 0, 12); zombie spawn markers are tagged by zone and only used while it is open.
- **Start room** x -5..5, z 6..16 (owned at start): shutter 500 -> hallway, side door -> HOFFMAN'S.
- **Main hallway** x -20..20, z -2..6: doors to the Food Court, Mega Mart, Service Corridor, Grand Atrium and HOFFMAN'S; Customer Service (warranty tiers).
- **Food Court** x -20..20, z -14.3..-2.3 (four attachment stores). **Mega Mart** x 20..34, z -24..6. **Service Corridor** 3 m wide, west then south.
- **Grand Atrium** x 8..32, z 6.6..30.6, two storeys. **Sunset Promenade** (level 2, y 6.3) x -20..20, z -4.5..6, with Build-A-Blaster off it.
- **HOFFMAN'S** x -20..-5.3, z 6.3..26. **Sunset Cinema** upstairs x -42..-20.3. **Customer Parking** x 34.3..62.3, z -24..6 (outdoors, off Mega Mart).
- Wall buys: Price Gun (start room), Nail Gun (hallway), Foam Dart Blaster (Mega Mart), Confetti Cannon (Service Corridor), Rivet Rifle (Atrium),
  Heavy Coil Nailer (Cinema), Barcode Scanner (HOFFMAN'S). RESTOCK-O-MATICs (400, refill the held gun): Food Court, Atrium, Cinema.

## Gotchas that have cost time (read before changing the map or its tests)
- **Decoration** is static and has no collision (`collide:false`); the static batcher merges it. Hang things >= 2 cm proud of a wall, never on its plane:
  two faces within 4 mm facing the same way z-fight (flicker). `tests/coplanar.test.js` checks every room; `departmentStore.test.js` checks that no
  other wall ends flush on the store's wall faces. Mark anything shown/hidden/moved at runtime `userData.dynamic`, on a parent group: tests/staticBatch.test.js takes every directly flagged mesh for an escalator part.
  In the browser every other map object's matrix is frozen after batching (world/staticBatch.js `freezeStatic`): an unflagged thing that moves stands still there, with no error (`__mall.movedWhileFrozen()` lists them).
- **Anything standable must be**: a step (<= 0.35 m), a vaultable counter (<= 1.1 m, short side), or >= 2.1 m tall (a jump from a 0.95 m counter peaks ~2.0 m).
  The one way up or down besides stairs and escalators: balcony rails (`ledge`) can be climbed over to drop to the floor below (fall damage applies).
- **Tests: never seed `Math.random` before building the map.** Three.js makes object ids with it, so the scenario then depends on the map's mesh
  count and flips whenever anyone adds a mesh. Build first, seed after.
- **Adding an area or door** touches a dozen lists (mall.js, shutters, prices, mall.test.js counts, a coplanar region): follow the checklist at the top of docs/map.md.
- **Speed-ups must give the same result** (config/performance.js, docs/history.md 15 November 2026). Collision reads a grid of nearby boxes
  (world/colliderGrid.js): add / remove boxes and call `markCollidersChanged`, never move a box in place. A still prop a feature adds to the
  scene gets `userData.roomProp = true` so room culling can skip it. tests/drawBudget.test.js fails when a benchmark shot draws too much.
- **Several tools edit this repo at once.** Each tool works in its OWN worktree + branch (`.claude/worktrees/<tool>`, reused, not one per task) and only
  MERGES into main. Never switch branches in the main folder (another tool's commit lands on your branch and is lost), and before any commit in main check
  `git branch --show-current` says main. Commit only your own changes, never run a bare `git stash`, never overwrite another tool's uncommitted files.
  Say which shared files you changed (mall.js, economy.js, shutters.js, CLAUDE.md, tests).
  docs/history.md, tests.md and folder-structure.md merge with git's union driver (.gitattributes): a merge keeps both sides' lines and never conflicts there; after a merge, glance at the file for a doubled line.
- **Windows shell:** complicated quoting in Bash heredocs fails; write scripts with the file tools. Line endings are mixed (CRLF and LF): an edit script must keep each file's own.
- **Canvas fonts:** every sign in the 3D world asks for a ROLE (config/typefaces.js) through `world/typeKit.js` (`fontFor`, `drawType`); never a raw
  font string (tests/typefaces.test.js fails on one). Fonts are bundled locally (src/fonts/); adding a family: docs/typefaces.md. HUD/menu type (style.css) is separate.
- **Browser checks:** build first (`npm run build`) and use `npm run preview`, opening the address with `?debug` (DEBUG MODE: without it there
  is no `window.__mall`, no debug keys and no test range); a hidden pane shows stale frames (take two), and its frame times mean nothing
  (draw calls and triangles still count). `window.__mall` has `step(n)`, `g`, `game.forceRun`; `g.debug.run('doors'|'god')`.
- **Keep this file small.** It loads in every session. New history goes in docs/history.md, new per-module notes in docs/folder-structure.md, new
  coordinates in docs/map.md, new test descriptions in docs/tests.md, new ideas in docs/open-ideas.md; change this file only for rules, commands and the short maps above.

## Debug mode and the test range
Off for players. On for `npm run dev`, an address ending in `?debug`, or Settings > Debug (config/debug.js `mode`). It turns on the debug
keys (` lists them), window.__mall and the test range, the Staff Training Center (T goes there and back): a shooting gallery, an armory bench
(any gun, upgrade or item), a zombie pen (any zombie, costume or boss) and a movement course with a readout. A run that uses a debug command
is marked assisted and records nothing.

## The game as built (November 2026; what's still open: docs/open-ideas.md)
Everything below is built. The skill tree and meta progression were decided against (17 November 2026); so were elevators.
- **Zombies** (intro round): Shopper (1), Shoplifter (4: a hit steals points, kill it to get them back), Cart Pusher (6, telegraphed charge),
  Mannequin (8, frozen while looked at), Mascot (10, 5x HP). The Mascot is ONE slot in five costumes (config/zombies.js mascotVariants, each
  changing one beat: Sir Waffles, Captain Coupon, Poppy Corn, Scoops, Twisty the Pretzel), plus the rare gold Employee of the Month.
  A new costume = a config entry + a head kind in zombies/mascotHeads.js.
- **Bosses** (config/bosses.js; one extra zombie on a normal round, a health bar, a voucher): Mopwater Murray, Officer Doug Kettle,
  Dennis Fairweather, Skylar Sparkle, encores from round 20; the Last Customer (Lorraine Pruitt) is Closing Time's final boss.
- **Guns:** the Staple Gun you start with, seven wall buys (above), and the GRAB-A-GUN claw machine's prizes (wonder weapons). Upgrades:
  warranty tiers at Customer Service, attachments from the Food Court stores, and Build-A-Blaster (the Pack-a-Punch: a build is a
  stuffing + a heart + a quality, picked on an order form).
- **Perks = the Wardrobe:** 4 slots, one item each, a small upside and a downside; buy once, swap free at fitting rooms. Keep boosts small.
- **Kiosk Kevin** (lethals, tacticals, armor, a turret, rotating stock), pay-to-trigger **hazards**, **Flash Sales** (25-50% off one category,
  over the PA), power-ups, Second Chance, weapon skins and challenges, the Survival Guide, Lost and Found, Galleria FM.
- **Closing Time** is the run's goal and ending (Directed or Classic). **Extra Modes:** arena survival in one part of the mall (config/arenas.js).
- **Economy:** start with 500 points; zombie HP 150 at round 1, +75/round through round 9, then x1.075/round; zombie count
  `round(6 + 2.5*(round-1))`. Full values: `src/config/economy.js`.
