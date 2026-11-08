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
npm run test:quick    # WHILE ITERATING: only the tests your change touches + a fast core set (tools/testQuick.mjs; --list shows the plan, --all = everything)
npm test              # the FULL suite (~90 s): run it, with the build, before every commit
npm run dev           # Vite dev server (hot reload)
npm run build         # production build into dist/; run after every change to catch errors (it only bundles: it does not run the game)
npm run preview       # serve the built dist/
npm run build:single  # dist-single/sunset-galleria.html: the WHOLE game in one file (no server, no Node, no internet)
npm run play          # JUST PLAYING: rebuilds that file only if the code changed, opens it in Firefox (play.cmd = the same by double-click)
npm run balance       # gun balance report (tools/gunReport.mjs): dps by range, pulls to kill by round, cannon blast table
```
There is no linter. What each test file covers: docs/tests.md (relationships and rules, not exact values).

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
- Gameplay reads ACTIONS, never raw keys: `input.actionDown/consumeAction/actionPressed('jump')` and
  `input.moveAxis()`. Bindings (keyboard `KeyboardEvent.code` + controller `Pad*` codes) live in
  `config/controls.js`. Raw codes are only used for debug keys in `main.js`.

## Docs index (read on demand)
| When you... | read |
|---|---|
| change or add a module | its entry in docs/folder-structure.md (search for the file name) |
| work in an area or add a door/spawn/buy spot | its entry in docs/map.md |
| want the background of a past decision, a measured number, or how an area was built | docs/history.md (newest first) |
| touch behaviour and want to know which test guards it | docs/tests.md |
| change a gun | docs/weapon-balance-pass.md and `npm run balance` |

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
src/zombies/         zombie, zombieManager (spawning, crowds, failsafe), navigation (floors + ramp links), zombieModel, shopperAppearance, cartModel
src/maps/            index.js (map registry + THE MAP INTERFACE), mall/ (mall.js = the layout + wiring; one module per area, its Details and Look),
                     testRange/ (debug only)
src/world/           shared building blocks: mapKit (boxes/walls/doors/slabs/corridors + dispose), corridor, door, shutter, collision (+ramps), textures,
                     neon, decor/scatter (clutter), staticBatch, wallBuy
src/fx/              post-processing, zone grading, light pool, room culling, effects, impact marks, contact shadows, power-up view, benchmark
src/audio/           synthesised sound, music worker
src/ui/              retail HUD pieces: hud, settings/controls menus, debug panel, announcements, incentive HUD, titleCamera
tests/               node:test files (one per system/area) + helpers/headlessGame.js (the real game running headless)
tools/               dev scripts: balance report, single-file build, test selection (testQuick.mjs), music export
docs/                history.md, folder-structure.md, map.md, tests.md + older plans
```

## How the pieces connect
- `main.js` owns the loop. Every frame starts with `applyLookInput(frameTime)` (mouse + stick look, aim-assist
  slowdown) BEFORE the ticks, so shots/movement in this frame's ticks use where you're looking now.
  Each tick main polls the controller, runs the controller menus, then `g.update(dt)` (game/createGame.js).
  `g.update(dt)` (60Hz): if `game.over` (dead) only zombies/health/death timer run (checked
  first: the mouse is released on death); if not running (pointer unlocked) it freezes the player; otherwise debug
  keys (main's handleDebugKeys via the debugTick hook), `player.update`, `interactions.update` (before the gun, so a controller-X hold near a buyable buys instead
  of reloading), `melee.update` (no new swing while switching/vaulting),
  `gun.update(dt, melee.isBusy || player.vault.active)` (after the player so shots use this tick's
  eye), `zombies.update`, `rounds.update` (paused while in the test range), `health.update`, `map.update`,
  `features.update`, `arena.update`, `player.updateView` (recoil springs last, so a shot's kick shows on the very next frame),
  `input.endTick()`. `rounds.start()` happens the first tick the game actually runs.
- Buying: createGame adds every `map.doors` entry to `interactions` (verb 'unlock', cost pricing.priceOf('door', destinationAreaId), use =
  map.areaUnlocks.unlock(destinationAreaId), which owns only that destination and opens all barriers between owned areas;
  zombies start spawning there and the nav grid rebuilds when each shutter's collider goes), and builds every `map.features` entry by kind (game/features/): wall buys (display + "buy <Gun>" / "<Gun> ammo",
  hidden when its zone is closed or you own it with full ammo; use = gun.give(def)) and the ammo cache. Melee gets `getWeapon: () => gun.weapon` (the gun in hand).
- Map: createGame does `loadMap(mapId, scene, colliders)` and only uses the map interface (maps/index.js).
  The zombie manager gets `map.spawnPoints` + `isZoneOpen`, so zombies only spawn in opened zones.
- Zombie types: rounds picks each spawn's type (economy.zombieMix) and calls `zombies.spawn(typeId)`; health is
  `zombieHealthFor(typeId, round)`, kill value `economy.killValues[typeId]`. A type's first spawn in a run ->
  'typeIntro' event -> createGame shows the spawned zombie's `type.introBanner` (hud.showAnnouncement) + plays 'paChime'. Zombie sounds:
  zombie -> ctx.onSound -> manager (dedupe) -> createGame `sound.play(name, { volume })`.
- Points: gun and melee call `onHit({ target, killed, headshot, melee })` -> createGame emits 'hit' (non-lethal zombie hit:
  +10); a zombie dying (zombie.takeHit records `killedBy`; the manager's onKill) -> 'kill' -> kill value + head/melee bonus
  (`pointsForHit`) and run stats. Same totals as COD, whatever made the kill.
  HUD: points above the ammo with +N pop-ups, round number top-left (blinks in the break), "ROUND N" banner.
- Death flow: `onPlayerDeath()` (createGame.js) sets `game.over`, hides the combat HUD, and main's hook releases the mouse. Render then runs the
  death camera (drop + roll) and skips the gun pass; after `feel.death.resultsDelay` the results screen shows.
  Play again -> `resetRun()` (createGame's resetSteps: zombies, player stats, health, run stats, guns + upgrades, interactions,
  viewmodel, effects, melee, aim assist, wallet, rounds, player position, doors/zones, death state, HUD) -> re-lock.
- Testing hook: `window.__mall.step(n)` advances the real loop n ticks and draws a frame (use with
  `game.forceRun = true`; set it back to false before screenshots, or the live loop keeps playing).
  `step` also applies pending look first. `render(alpha, frameTime)`: interpolates the camera, updates effects + viewmodel, updates the
  HUD, then draws two passes: the world, then (after `clearDepth`) the viewmodel scene. `renderer.autoClear` is false.
- Settings/Controls menus: `main.js` creates `createSettings({ renderer, sound, hud })` (loads saved values, applies all) and the two
  menus after the HUD + sound exist. While either menu is open, `handleControllerMenus()` hands controller input to its `padNav`
  and returns (so A/Start don't start the game). On the pause screen, controller Y opens Settings and X opens Controls. Settings
  write straight into the config objects (feel/controls/audio), so everything that reads config each frame picks them up live.
  `render()` also feeds the FPS counter.
- Input: mouse buttons are tracked like keys as `Mouse0`/`Mouse1`/`Mouse2`, only while pointer-locked.
  Controller buttons are `PadA`.. codes written by `gamepad.poll()` (first thing in `update`).
- Controller flow: `game.running` = pointer locked OR `game.padPlaying` OR forceRun. `handleControllerMenus()`
  in main: A/Start starts or resumes (no pointer lock needed; also tries `sound.unlock()`), Start pauses, A on the
  results screen plays again, unplugging the controller mid-game pauses. Stick look is applied per frame in
  render (`player.applyStickLook`) x `aimAssist.slowdown`.
- Render timing: while paused (not running, not dead) render uses alpha = 1 and zero visual time, so nothing
  twitches; after death visual time keeps flowing (zombies animate, particles fall, the flash fades).
- Shooting: `player.getAim()` gives eye + direction including view kick; `aim.applySpread()` then randomizes it
  inside the spread cone. The crosshair gap is computed in `main.js` render from `aim.spreadDegrees` and the
  current camera FOV (gap px = tan(spread) / tan(fov/2) * screenHeight/2), so every shot lands inside the lines.
- Recoil/feel: camera pitch kick is in the aim (and springs back to exactly where you aimed, no permanent climb);
  camera roll, gun kick, sway, bob and the muzzle flash are visual only (shots never come from the gun model).
  Audio starts on the first click/key (main also calls `sound.unlock()` on Click to play).
- ADS: `aim` sets `player.isAiming` / `player.aimAmount` each tick (blocks sprint, scales walk speed by
  `stats.adsMoveSpeed`). Render zooms `camera.fov` by `def.ads.fovMultiplier` and sets `player.lookScale`.
  `main.js` keeps a `shootables` array (test-range dummies now; zombies should be pushed into it). A collider
  Box3 with `ignoreShots = true` blocks walking but not bullets.
- The game only runs while the pointer is locked; Esc pauses and shows the overlay. An in-game menu a feature opens (`state.menu`, e.g. the Build-A-Blaster
  order form) stops the player (no moving, shooting or buying) but not the world; the feature reads menu actions (config/controls.js menu*) in features.update.
- Collision: one shared flat array `colliders` of `THREE.Box3` (created in main, filled by the map and the
  test range). `box(..., {collide})` in `mall.js`
  makes a mesh and (optionally) a collider; some visuals use `collide:false` with a separate hand-sized
  `addCollider` (pillars, benches). Shutter adds/removes its own collider from the same array.
  Player is a cylinder (radius, height, feet position). Boxes whose top is within `stepTolerance`
  of the feet count as floor, not walls.
- Coordinates: meters, +Y up. Camera looks down -Z at yaw 0.
- Markers (invisible; shown if `debug.showMarkers`; wall-buy markers come from the 'wallBuy' features): `map.spawnPoints`
  (38: 2 start-room, 3 hallway, 5 Atrium, 4 Food Court, 4 Promenade, 3 HOFFMAN'S, 6 cinema, 4 Mega Mart, 4 Parking, 3 Service Corridor;
  each tagged with its zone and actual floor height). The service stairs add no markers.
  The seven 'wallBuy' features have outward `normal` + `weapon` id: Price Gun, Nail Gun, Foam Dart Blaster, Confetti Cannon,
  Rivet Rifle, Heavy Coil Nailer and Barcode Scanner; prices in economy.wallBuys via g.pricing.

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
- **Player spawns** at (0, 0, 12). Zombie spawn markers are tagged by zone and floor height and only used while their zone is open.

## Gotchas that have cost time (read before changing the map or its tests)
- **Decoration** is static and has no collision (`collide:false`); the static batcher merges it. Hang things >= 2 cm proud of a wall, never on its plane:
  two faces within 4 mm facing the same way z-fight (flicker). `tests/coplanar.test.js` checks every room; `departmentStore.test.js` checks that no
  other wall ends flush on the store's wall faces. Mark anything shown/hidden/moved at runtime `userData.dynamic`, on a parent group: tests/staticBatch.test.js takes every directly flagged mesh for an escalator part.
- **Anything standable must be**: a step (<= 0.35 m), a vaultable counter (<= 1.1 m, short side), or >= 2.1 m tall (a jump from a 0.95 m counter peaks ~2.0 m).
- **Tests: never seed `Math.random` before building the map.** Three.js makes object ids with it, so the scenario then depends on the map's mesh
  count and flips whenever anyone adds a mesh. Build first, seed after.
- **Adding an area or door** touches the same lists everywhere: LAYOUT + zones + doors + spawns + lamps + `cullAreas`/`cullPortals` + `gradeZones` + a horror
  area + a benchmark shot + ambience emitters (all in mall.js), a shutter finish (config/shutters.js), the price (economy.doors), the door counts and the
  "120 orders" exclusions in tests/mall.test.js, and a coplanar region. Use docs/history.md (HOFFMAN'S entry) as the worked example.
- **Several tools edit this repo at once.** Work in your own git worktree + branch (`.claude/worktrees/`), commit only your own changes, never run a bare
  `git stash`, and never overwrite another tool's uncommitted files. Say which shared files you changed (mall.js, economy.js, shutters.js, CLAUDE.md, tests).
- **Windows shell:** complicated quoting in Bash heredocs fails; write scripts with the file tools. Files are CRLF: edit scripts must be CRLF-safe.
- **Canvas fonts:** `src/boot.js` waits for the web fonts, then imports main.js. A new font on a sign goes in index.html AND config/fonts.js, or it stays on the fallback.
- **Browser checks:** build first (`npm run build`) and use `npm run preview`; a hidden pane shows stale frames (take two), and its frame times mean nothing
  (draw calls and triangles still count). `window.__mall` has `step(n)`, `g`, `game.forceRun`; `g.debug.run('doors'|'god')`.
- **Keep this file small.** It loads in every session. New history goes in docs/history.md, new per-module notes in docs/folder-structure.md, new
  coordinates in docs/map.md, new test descriptions in docs/tests.md; change this file only for rules, commands and the short maps above.

## Movement test range (debug only)
- Built when `debug.testArena` is true; press **T** in-game to teleport between the mall and the range
  (`player.teleport({ position, yaw })`). Its colliders go into the same shared `colliders` list.
- 60x60m open floor centered at (0, -100), far south of the mall, 2m border walls, 1m floor tiles.
- Shooting range: 5 practice dummies (3 at local z=17 near spawn, 2 at (+-9, 0)) with round-1 zombie health.
- Contents: runway with a line every 5m; slide bars + an 8m low tunnel (underside 1.2m: crouch fits,
  standing doesn't); pillars; stairs (0.5m steps) to a 2m platform; jump boxes 0.3-1.2m (1.2 is
  deliberately unreachable); 0.6m platforms with 2/3/4/5m gaps for sprint-jumps.
- Turn `debug.testArena` off before shipping. Don't build game features into it.

## Planned build order
1. Walkable mall (done)
2. Staple gun: hitscan shooting, headshots, reload, ammo, hit feedback on static targets (done)
3. Shopper zombies, chasing, attacking with a wind-up, regenerating health, death screen (done, + box cutter melee)
4. Waves, rounds, points, shutter purchase, wall buys (done)
5. Mall Walker, then the rest of the roster
6. Wardrobe, claw machine, vendor, Build-A-Blaster, hazards, Flash Sales
7. Second floor, elevators, navmesh pathfinding
8. Audio and UI polish
9. Meta progression and skill tree

## Design reference (decisions made so far)
- **Zombie roster, with intro rounds:** Shopper (round 1), Mall Walker (4, fast, low HP),
  Cart Pusher (6, telegraphed charge), Mannequin (8, frozen while looked at; implemented), Mascot (10, tanky, 5x HP; implemented).
  The Mascot is ONE slot in several costumes (config/zombies.js mascotVariants, each changing one beat): Sir Waffles (10, baseline),
  Captain Coupon (13, puts his head back on), Poppy Corn (16, the pop is a blast), Scoops (19, slowing melt trail), plus the
  rare gold Employee of the Month (15+, guaranteed power-up). A new costume = a config entry + a head kind in zombies/mascotHeads.js.
- **Weapons by store:** start with a staple gun pistol; wall buys like baseball bat, nail gun,
  foam dart blaster, confetti cannon, leaf blower, water cannon, taser rifle, condiment cannon,
  balloon launcher, tennis ball launcher.
- **Mystery box equivalent:** a claw machine (sometimes a plush toy appears and it relocates).
- **Perks = wardrobe system:** 4 slots (head, torso, feet, accessory), one item per slot, each with a
  small upside and downside; buy once, swap free at fitting rooms.
- **Pack-a-Punch equivalent: Build-A-Blaster (built: docs/build-a-blaster-plan.md).** One build per weapon (fryer oil = burn, smoothie freeze = slow,
  neon sign = electric chain, glitter = confuse zombies).
- **Vendor: Kiosk Kevin** sells lethals, tacticals, armor plates and a turret, with rotating stock each round.
- **Environmental hazards** (pay to trigger, with cooldowns): fire sprinklers, electrified fountain,
  fryer blast, escalator reversal, toppling shelves, PA system lure.
- **Flash Sales:** random, announced over the mall PA (25-50% off one category).
- **Later:** multiple floors with escalators/elevators (needs a navmesh); meta progression and a skill
  tree (keep boosts small).
- **Economy highlights:** start with 500 points, start shutter 500, zombie HP 150 at round 1 then
  +75/round through round 9 then x1.075/round, zombie count `round(6 + 2.5*(round-1))`.
  Full values live in `src/config/economy.js`.
