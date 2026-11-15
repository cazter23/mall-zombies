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
npm run audition      # the gun sound audition (tools/audition.html) as one file in Firefox, no dev server: listen, compare, Measure
npm run balance       # gun balance report (tools/gunReport.mjs): dps by range, pulls to kill by round, cannon blast table
npm run melee         # box cutter report (tools/meleeReport.mjs): swings to kill by round, plain vs the Customer Service tiers
npm run kiosk         # Kiosk Kevin report (tools/kioskReport.mjs): equipment damage by round and type, Bubble Wrap hits to death, the Sentry vs the Price Gun, prices in rounds of income
npm run sim:economy   # economy report (tools/economySim.mjs, ~90 min from an empty cache; --quick for a short look): a headless bot's income by round, what it can afford when, proposals before/after
npm run sim:claw      # GRAB-A-GUN odds tables (tools/clawSim.mjs)
npm run sim:challenges  # weapon-skin challenge report (tools/challengeReport.mjs): how many runs each challenge takes
npm run balance:bab   # Build-A-Blaster report (tools/babReport.mjs): plain gun vs warranty tiers vs builds
npm run sim:closing   # Closing Time quest bot (tools/closingTimeSim.mjs). COSTLY and it measures the bot, not players: ask first
```
There is no linter. Docs-only changes need no tests. What each test file covers: docs/tests.md (relationships and rules, not exact values).
tests/docs.test.js fails if a new src/ file or test file isn't described in the docs.

## Rules for working on this project
- Game logic runs on a fixed 60Hz timestep; rendering is decoupled (render gets `alpha` to interpolate).
- Every tunable number lives in `src/config/` (`feel.js`, `economy.js`, `weapons.js`, `zombies.js`, `controls.js`,
  `audio.js`, `debug.js`), never hardcoded in logic.
- Guns: numbers only in `config/weapons.js`; they are COMBINED only in `weapons/gunStats.js` (hitDamage per hit,
  resolveGun for upgrades). Upgrades never edit config entries. After any weapon change run `npm run balance` and
  `npm test` (tests/balance.test.js checks each gun still does its job).
- All player stats live in one stats object (`src/player/stats.js`) so perks, wardrobe and a
  future skill tree modify it in one place. Systems read stats, not config, at runtime.
- Death is handled in one function (`onPlayerDeath` in `game/createGame.js`) so a downed/revive system can be added
  later. `player/health.js` calls it exactly once when health reaches 0.
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
| work in an area or add a door/spawn/buy spot | its entry in docs/map.md |
| want the background of a past decision, a measured number, or how an area was built | docs/history.md (newest first; older: docs/archive/) |
| plan the next big system | the open plans: docs/closing-time-plan.md (all phases built), docs/kiosk-kevin-plan.md (all built: only its "Later" list), docs/arena-modes-plan.md (Extra Modes: arena survival, built); finished plans (claw machine, wardrobe, weapon skins, hazards, bosses...) are in docs/archive/ |
| want to know how COD zombies does something | docs/research/ (BO1, BO3, BO4 and Cold War script analyses, and a balance comparison) |
| touch behaviour and want to know which test guards it | docs/tests.md |
| add or restyle a sign, poster, neon or label (fonts, roles) | docs/typefaces.md (the type system) and docs/typefaces-ledger.md (every sign) |
| change a gun | docs/weapon-balance-pass.md and `npm run balance` |
| change a gun's or a hit's sound | docs/gun-sounds.md (config/gunSounds.js; listen and measure: `npm run dev`, /tools/audition.html) |
| change a price, a payout or how strong an upgrade is | docs/economy-report.md and `npm run sim:economy` |
| write or change any line of game text | docs/voice.md |
| touch a menu, a prompt or anything a controller does (one menu model: core/menuNav.js) | docs/controller-audit.md |

## Folder map (short; every module is described in docs/folder-structure.md)
```
index.html, package.json, vite.config.js (dev server only), play.cmd
src/main.js          BROWSER SIDE ONLY: renderer, scene, camera, input + gamepad, HUD, sound, viewmodel, menus, pointer lock, loop, window.__mall test hook
src/game/            ALL gameplay wiring, DOM-free so it runs headless in tests: createGame.js (builds + ticks every system), rounds, wallet, pricing,
                     events (the bus), interactions (buying), features/ (map features by kind: wall buys, ammo cache, upgrade desk, attachment
                     counters, Build-A-Blaster's ritual and builds, horror director), powerUps, careerStats, settings, debugCommands, ambience, shutterSounds
src/config/          EVERY tunable number: feel, economy (prices), weapons, zombies, controls, audio, settings, debug, look (art direction),
                     environment, plus one file per area (promenade, cinema, cinemaStairs, departmentStore, departmentStoreDetails, atrium...)
src/core/            fixed-step loop, input, gamepad, haptics, springs, keyframes, idle saver (title/pause screens draw slowly then stop: config/idle.js)
src/player/          controller (movement/stances/camera), vault, stats (THE stats object), health, body (first-person legs)
src/weapons/         weapon (ammo/fire state), aim, aimAssist, hitscan, melee, gunStats (THE damage maths), upgrades, playerGun (2-slot loadout), viewmodel,
                     models/ (one file per gun + upgradeParts), muzzleFlash
src/zombies/         zombie, zombieManager (spawning, crowds, failsafe), navigation (floors + ramp links), zombieModel, shopperAppearance, cartModel,
                     mascotModel/mascotHeads (the Mascot costumes), bosses/ (one behaviour + model per boss; game/bossDirector.js schedules them)
src/maps/            index.js (map registry + THE MAP INTERFACE), mall/ (mall.js = the layout + wiring; one module per area, its Details and Look),
                     testRange/ (debug only)
src/world/           shared building blocks: mapKit (boxes/walls/doors/slabs/corridors + dispose), corridor, door, shutter, collision (+ramps), textures,
                     neon, decor/scatter (clutter), staticBatch, wallBuy
src/fx/              post-processing, zone grading, light pool, room culling, effects, impact marks, contact shadows, power-up view, benchmark
src/audio/           synthesised sound, music worker
src/ui/              retail HUD pieces: hud, settings/controls menus, debug panel, announcements, incentive HUD, titleCamera
tests/               node:test files (one per system/area) + helpers/headlessGame.js (the real game running headless)
tools/               dev scripts: the test runner (runTests.mjs, testQuick.mjs), single-file build + play, the reports above, music export
docs/                history.md, folder-structure.md, map.md, tests.md, weapon-balance-pass.md, economy-report.md, ui-readability.md (HUD text
                     sizes and lanes), the open plans; archive/ (finished plans, old history); research/ (COD zombies script analyses)
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

## Map (short; coordinates, spawns and details per area in docs/map.md)
Metres, +Y up, yaw 0 faces -Z. The start room opens into the MAIN HALLWAY (the hub); each area is bought once through any accessible entrance (prices in
`config/economy.js` economy.doors, keyed by destination area, read through `g.pricing`). Connections open free when both
adjoining areas are owned. No cascading unlocks. Nine area purchases total 9500; 15 physical barriers remain.
- **Start room** x -5..5, z 6..16 (open at start). Start shutter 500 -> hallway. Side door 1250 (west wall) -> HOFFMAN'S.
- **Main hallway** x -20..20, z -2..6, 6 m. Doors: Food Court 1000 (south), Mega Mart 750 (east end), Service Corridor 1000 (west), Grand Atrium 1250
  (north, x 13..18), HOFFMAN'S 1250 (north, x -19.5..-15.5). Promenade unlock 1250 also repairs the escalator when Hallway is owned. Customer Service booth (gun tiers) on the north wall.
- **Food Court** x -20..20, z -14.3..-2.3: four stores (attachments), stalls, RESTOCK-O-MATIC (400 refill). **Mega Mart** x 20..34, z -24..6.
  **Service Corridor** 3 m wide, west of the hallway then south to z -14.
- **Connections:** Food Court <-> Mega Mart, Service Corridor <-> Food Court, Atrium <-> Mega Mart, Atrium <-> Promenade: free once both endpoints are owned; otherwise buy the unowned area at its destination price.
- **Grand Atrium** x 8..32, z 6.6..30.6, two storeys (upper ring y 6.3), second escalator.
- **Level 2 / Sunset Promenade** x -20..20, z -4.5..6 (+ shoe annex), floor y 6.3, zone 'upstairs'.
- **HOFFMAN'S department store** x -20..-5.3, z 6.3..26, 5 m (counters vaultable; everything else >= 2.1 m).
- **Sunset Cinema** upstairs x -42..-20.3: 1250 area unlock off the Promenade's west wall or Service Corridor's north end; the other connection opens free when its neighbouring area is owned.
- **Build-A-Blaster:** storefront + back hall off the Promenade (numbers: config/workshop.js, config/promenade.js workshop; docs/map.md). Hold F at the bench: an order form (pre-filled; F orders), fight in the room to fill the tank and finish it sooner, and the gun comes back to you named: game/features/workshop*.js. Party Trap and Clearance Rack drop from zombies with shopping bags (limitedEditions.js).
- **Wall buys:** Price Gun (start room), Nail Gun (hallway), Foam Dart Blaster (Mega Mart), Confetti Cannon (Service Corridor), Rivet Rifle (Atrium),
  Heavy Coil Nailer (Cinema projection passage, 2500), Barcode Scanner (HOFFMAN'S). Door count: 15.
- **Customer Parking** x 34.3..62.3, z -24..6, y 0: 1250 through Mega Mart's former east emergency exit (z 1..4).
  Three tall abandoned vans, four outdoor spawns, fenced perimeter, sunset sky; config/parkingLot.js and maps/mall/parkingLot.js.
- **RESTOCK-O-MATICs:** Food Court north wall, Grand Atrium ground-floor northeast corner, and Cinema lobby north wall.
  Each requires its area unlocked and refills the held gun for 400 points.
- **Player spawns** at (0, 0, 12). Zombie spawn markers are tagged by zone (carrying floor height in `position.y`) and only used while their zone is open.

## Gotchas that have cost time (read before changing the map or its tests)
- **Decoration** is static and has no collision (`collide:false`); the static batcher merges it. Hang things >= 2 cm proud of a wall, never on its plane:
  two faces within 4 mm facing the same way z-fight (flicker). `tests/coplanar.test.js` checks every room; `departmentStore.test.js` checks that no
  other wall ends flush on the store's wall faces. Mark anything shown/hidden/moved at runtime `userData.dynamic`, on a parent group: tests/staticBatch.test.js takes every directly flagged mesh for an escalator part.
  In the browser every other map object's matrix is frozen after batching (world/staticBatch.js `freezeStatic`): an unflagged thing that moves stands still there, with no error (`__mall.movedWhileFrozen()` lists them).
- **Anything standable must be**: a step (<= 0.35 m), a vaultable counter (<= 1.1 m, short side), or >= 2.1 m tall (a jump from a 0.95 m counter peaks ~2.0 m).
  The one way up or down besides stairs and escalators: balcony rails (`ledge`) can be climbed over to drop to the floor below (fall damage applies).
- **Tests: never seed `Math.random` before building the map.** Three.js makes object ids with it, so the scenario then depends on the map's mesh
  count and flips whenever anyone adds a mesh. Build first, seed after.
- **Adding an area or door** touches the same lists everywhere: LAYOUT + zones + doors + spawns + lamps + `cullAreas`/`cullPortals` + `gradeZones` + a horror
  area + a benchmark shot + ambience emitters (all in mall.js), a shutter finish (config/shutters.js), the price (economy.doors), the door counts and the
  "120 orders" exclusions in tests/mall.test.js, and a coplanar region. Use docs/archive/history-2026-10.md (HOFFMAN'S entry) as the worked example.
  Arena survival (config/arenas.js) seals an arena's zones: a new door into an arena area stays shut there; a fixture only for an arena goes in its entry.
- **Several tools edit this repo at once.** Each tool works in its OWN worktree + branch (`.claude/worktrees/<tool>`, reused, not one per task) and only
  MERGES into main. Never switch branches in the main folder (another tool's commit lands on your branch and is lost), and before any commit in main check
  `git branch --show-current` says main. Commit only your own changes, never run a bare `git stash`, never overwrite another tool's uncommitted files.
  Say which shared files you changed (mall.js, economy.js, shutters.js, CLAUDE.md, tests).
  docs/history.md, tests.md and folder-structure.md merge with git's union driver (.gitattributes): a merge keeps both sides' lines and never conflicts there; after a merge, glance at the file for a doubled line.
- **Windows shell:** complicated quoting in Bash heredocs fails; write scripts with the file tools. Line endings are mixed (CRLF and LF): an edit script must keep each file's own.
- **Canvas fonts / typefaces:** every sign, poster and label in the 3D world asks for a ROLE (config/typefaces.js: roles, families, sign kinds) through `world/typeKit.js` (`fontFor`, `drawType`); never write a raw font string (tests/typefaces.test.js fails on one). Fonts are bundled locally (src/fonts/, no network, they work in the single-file build): a new family = its .woff2 in src/fonts/files + an entry in `families` + `node tools/buildFontCss.mjs`. `src/boot.js` waits for them before main.js. HUD/menu type (style.css) is separate. The sign table: docs/typefaces.md.
- **Browser checks:** build first (`npm run build`) and use `npm run preview`; a hidden pane shows stale frames (take two), and its frame times mean nothing
  (draw calls and triangles still count). `window.__mall` has `step(n)`, `g`, `game.forceRun`; `g.debug.run('doors'|'god')`.
- **Keep this file small.** It loads in every session. New history goes in docs/history.md, new per-module notes in docs/folder-structure.md, new
  coordinates in docs/map.md, new test descriptions in docs/tests.md; change this file only for rules, commands and the short maps above.

## Movement test range (debug only)
Built when `debug.testArena` is true (it still is: turn it off before shipping); T teleports there. Layout: docs/folder-structure.md.

## Build order (status, November 2026)
1-4. Walkable mall, staple gun, Shopper zombies + box cutter, waves/points/doors/wall buys (done)
5. The roster: Mall Walker, Cart Pusher, Mannequin, Mascot (four costumes + gold) (done); bosses: Murray, Fairweather, Kettle, Skylar, with encores (done)
6. Build-A-Blaster and Flash Sales (done); Wardrobe and claw machine (done); Kiosk Kevin vendor (all eight phases done); hazards (done: docs/archive/hazards-plan.md)
7. Second floor, escalators, stairs, multi-floor navigation (done); elevators (dropped: escalators and stairs do the job)
8. Audio and UI polish (ongoing): Galleria FM radio, the minimap, weapon skins, the Survival Guide, Lost and Found (done)
9. Meta progression and skill tree (not started); the run goal / ending, Closing Time (all twelve phases done: docs/closing-time-plan.md)

## Design reference (decisions made so far)
- **Zombie roster, with intro rounds:** Shopper (round 1), Shoplifter (4: a hit steals points, then it flees; kill it to get them back; it replaced the Mall Walker, now only a boss's backup),
  Cart Pusher (6, telegraphed charge), Mannequin (8, frozen while looked at; implemented), Mascot (10, tanky, 5x HP; implemented).
  The Mascot is ONE slot in several costumes (config/zombies.js mascotVariants, each changing one beat): Sir Waffles (10, baseline),
  Captain Coupon (13, puts his head back on), Poppy Corn (16, the pop is a blast), Scoops (19, slowing melt trail), plus the
  rare gold Employee of the Month (15+, guaranteed power-up). A new costume = a config entry + a head kind in zombies/mascotHeads.js.
- **Bosses** (config/bosses.js; one extra zombie on a normal round, a health bar, a voucher reward): Mopwater Murray the Janitor (5 or 7),
  Officer Doug Kettle the Security Guard (9 or 11), Dennis Fairweather the Mall Manager (12-14), Skylar Sparkle the Influencer (15 or 17),
  and encores from round 20. Later ideas (Food Court Karen, Santa): docs/archive/boss-zombies-plan.md.
- **Weapons by store:** start with a staple gun pistol; wall buys like baseball bat, nail gun,
  foam dart blaster, confetti cannon, leaf blower, water cannon, taser rifle, condiment cannon,
  balloon launcher, tennis ball launcher.
- **Mystery box equivalent:** a claw machine (sometimes a plush toy appears and it relocates).
- **Perks = wardrobe system:** 4 slots (head, torso, feet, accessory), one item per slot, each with a
  small upside and downside; buy once, swap free at fitting rooms.
- **Pack-a-Punch equivalent: Build-A-Blaster (built: docs/archive/build-a-blaster-plan.md).** One build per weapon (fryer oil = burn, smoothie freeze = slow,
  neon sign = electric chain, glitter = confuse zombies).
- **Vendor: Kiosk Kevin** sells lethals, tacticals, armor plates and a turret, with rotating stock each round.
- **Environmental hazards** (pay to trigger, with cooldowns; built: docs/archive/hazards-plan.md): electrified fountain (Atrium), fryer blast (Food Court),
  fire sprinklers (Main Hallway), PA system lure (Service Corridor). Escalator reversal and toppling shelves were dropped (the plan says why).
- **Flash Sales:** random, announced over the mall PA (25-50% off one category).
- **Later:** meta progression and a skill tree (keep boosts small).
- **Economy highlights:** start with 500 points, start shutter 500, zombie HP 150 at round 1 then
  +75/round through round 9 then x1.075/round, zombie count `round(6 + 2.5*(round-1))`.
  Full values live in `src/config/economy.js`.
