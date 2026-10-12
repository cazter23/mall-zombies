# Mall Zombies

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
npm install        # once
npm run dev        # Vite dev server (hot reload)
npm run build      # production build into dist/; run after every change to catch errors
npm run preview    # serve the built dist/
```
There are no tests or linter yet. `npm run build` is the compile check (it only bundles; it
does not run the game, so also try changes in `npm run dev`).

## Rules for working on this project
- Game logic runs on a fixed 60Hz timestep; rendering is decoupled (render gets `alpha` to interpolate).
- Every tunable number lives in `src/config/` (`feel.js`, `economy.js`, `weapons.js`, `debug.js`), never hardcoded in logic.
- All player stats live in one stats object (`src/player/stats.js`) so perks, wardrobe and a
  future skill tree modify it in one place. Systems read stats, not config, at runtime.
- Death is handled in one function (`onPlayerDeath`) so a downed/revive system can be added later.
  (Not written yet: create it in the zombies step.)
- Keep code modular, readable and commented. Prefer small, reviewable changes.
- Build in small steps. Do only the step the user asks for. Test it, then tell them how to try it.
- After changes, run `npm run build` to check for errors.
- Use `KeyboardEvent.code` for keys (layout independent). Add held/pressed checks via `core/input.js`.

## Folder structure
```
index.html              Entry page; loads /src/main.js and the Bungee Google Font
package.json            scripts: dev / build / preview
src/
  main.js               Entry: renderer, scene, camera, wires input/world/player/HUD, pause logic,
                        update(dt) + render(alpha); exposes window.__mall when debug.exposeToWindow
  style.css             HUD (crosshair, hit marker, health/stamina bars, ammo, prompt), start/pause overlay
  config/
    feel.js             Movement, sprint, crouch, slide, look (+ view kick recovery), ADS (key, move speed,
                        sensitivity), camera, player size, sim tick rate, shutter speed, viewmodel
                        placement/animation/fov, hit effects, crosshair min gap, body (colors + leg/pose tuning)
    economy.js          Points, payouts, kill values, door prices, wave scaling + helper functions
                        (zombieHealthForRound, zombieCountForRound, spawnDelayForRound, maxAliveForRound)
    weapons.js          Per-weapon stats (damage, headshot mult, mag, reserve, fire interval, reload, kick,
                        spread cone, ADS time/zoom/gun offset, colors) + weaponStatDefaults for stats
    debug.js            showMarkers, allowShutterToggle (O key), testArena (T key), dummies, exposeToWindow
  core/
    loop.js             startLoop(): fixed-timestep accumulator, calls update(dt) and render(alpha, frameTime)
    input.js            Input class: held keys, one-shot presses (consumePress/endTick), mouse delta, pointer lock
  player/
    controller.js       PlayerController: WASD, jump (buffer + coyote time), sprint meter, crouch/slide
                        (stance: stand|crouch|slide), gravity, mouse look (per render frame), camera interpolation
    stats.js            createPlayerStats(): the single stats object (health, speeds, jump, sprint, crouch/slide,
                        adsMoveSpeed, damageMultiplier, reloadSpeed)
    body.js             createPlayerBody(): first-person legs + lower torso in the world scene (visual only).
                        Hip height follows eye height; feet posed for walk cycle / slide (V) / air tuck, knees
                        solved with two-bone IK. Exports placeLimb()/makeBoxMesh() (also used for the arms)
  weapons/
    weapon.js           Weapon class: ammo, fire cooldown + click buffer, reload. Pure state; update() returns
                        'fire' | 'empty' | null
    aim.js              createAim(): ADS state (eased 0..1, blocks sprint, sprint cancels it) and hip-fire
                        spread (base + moving + airborne, smoothed, + per-shot bloom; x adsMultiplier).
                        applySpread() picks a random direction inside the cone
    hitscan.js          castShot(): one ray vs world colliders and shootables' hitboxes; defines the
                        "shootable" interface (hitboxes, isAlive, takeHit, splatColors)
    playerGun.js        createPlayerGun(): glue. Updates aim, reads Mouse0/KeyR, fires hitscan inside the spread cone, applies damage
                        (headshot x mult x stats.damageMultiplier), recoil, tracer, splatter, hit marker
    viewmodel.js        First-person staple gun model in its own scene + own fixed-FOV camera (drawn after the
                        world with depth cleared); hands + forearms attached to the gun (left hand fetches a staple
                        strip on reload); slides to center in ADS; kick + reload animations; muzzle pos
  fx/
    effects.js          Tracers (pooled) + particle bursts (one InstancedMesh): splat() and puff()
  world/
    map.js              buildMall(scene): all geometry, colliders, lights, signs, spawn/wall-buy markers,
                        player spawn. Exports LAYOUT. Returns { group, colliders, shutter, markers, playerSpawn, update }
    collision.js        moveAndCollide(): horizontal push-out then vertical landing/ceiling vs. Box3 list;
                        hasHeadroom(): can the player stand up here?
    shutter.js          createShutter(): roll-up door with its own Box3 collider (open/close/toggle/update)
    textures.js         Procedural canvas textures (floor tile, shop sign, shutter). No image files.
    testArena.js        Debug-only movement test range (buildTestArena). Not part of the real game.
    dummy.js            createDummy(): practice mannequin (shootable) with head/body hitboxes, health bar,
                        tips over when killed and pops back up. Test range only.
  ui/
    hud.js              createHud(): 4-line crosshair whose gap = spread cone (dot in ADS) + hit marker (white body, big yellow head, red kill),
                        bottom-left health (white) + stamina (green) bars, bottom-right ammo counter,
                        reload prompt under the crosshair, click-to-play/paused overlay (plain DOM)
```

## How the pieces connect
- `main.js` owns the loop. `update(dt)` (60Hz): if not running (pointer unlocked) it freezes the
  player and clears input; otherwise handles debug keys, `player.update(dt)`, `gun.update(dt)` (after the player so
  shots use this tick's eye), `world.update(dt)`, `arena.update(dt)`, `input.endTick()`.
  `render(alpha, frameTime)`: applies mouse look, interpolates the camera, updates effects + viewmodel, updates the
  HUD, then draws two passes: the world, then (after `clearDepth`) the viewmodel scene. `renderer.autoClear` is false.
- Input: mouse buttons are tracked like keys as `Mouse0`/`Mouse1`/`Mouse2`, only while pointer-locked.
- Shooting: `player.getAim()` gives eye + direction including view kick; `aim.applySpread()` then randomizes it
  inside the spread cone. The crosshair gap is computed in `main.js` render from `aim.spreadDegrees` and the
  current camera FOV (gap px = tan(spread) / tan(fov/2) * screenHeight/2), so every shot lands inside the lines.
- ADS: `aim` sets `player.isAiming` / `player.aimAmount` each tick (blocks sprint, scales walk speed by
  `stats.adsMoveSpeed`). Render zooms `camera.fov` by `def.ads.fovMultiplier` and sets `player.lookScale`.
  `main.js` keeps a `shootables` array (test-range dummies now; zombies should be pushed into it). A collider
  Box3 with `ignoreShots = true` blocks walking but not bullets.
- The game only runs while the pointer is locked; Esc pauses and shows the overlay.
- Collision: world is a flat array `world.colliders` of `THREE.Box3`. `box(..., {collide})` in `map.js`
  makes a mesh and (optionally) a collider; some visuals use `collide:false` with a separate hand-sized
  `addCollider` (pillars, benches). Shutter adds/removes its own collider from the same array.
  Player is a cylinder (radius, height, feet position). Boxes whose top is within `stepTolerance`
  of the feet count as floor, not walls.
- Coordinates: meters, +Y up. Camera looks down -Z at yaw 0.
- Markers (invisible; shown if `debug.showMarkers`): `world.markers.spawnPoints` (6: 2 start-room vents,
  4 concourse shopfronts) and `world.markers.wallBuys` (2, with an outward `normal`).

## Map (current)
- Main concourse: x -20..20, z -6..6, 6m ceiling. Four decorative shopfronts (Good Sports, Nuts & Bolts,
  Play Time Toys, Byte Me Electronics), pillars, benches, planters, ceiling lights.
- Start room: x -5..5, z 6..16 (north of concourse), 4m ceiling, checkout counter, shelf, crates, boarded vents.
- 4m doorway at z=6 blocked by a security shutter (cost 500 in economy.js). Debug: press **O** to toggle.
- Player spawns at (0, 0, 12) facing the shutter.

## Movement test range (debug only)
- Built when `debug.testArena` is true; press **T** in-game to teleport between the mall and the range
  (`player.teleport({ position, yaw })`). Its colliders go into the same `world.colliders` list.
- 60x60m open floor centered at (0, -100), far south of the mall, 2m border walls, 1m floor tiles.
- Shooting range: 5 practice dummies (3 at local z=17 near spawn, 2 at (+-9, 0)) with round-1 zombie health.
- Contents: runway with a line every 5m; slide bars + an 8m low tunnel (underside 1.2m: crouch fits,
  standing doesn't); pillars; stairs (0.5m steps) to a 2m platform; jump boxes 0.3-1.2m (1.2 is
  deliberately unreachable); 0.6m platforms with 2/3/4/5m gaps for sprint-jumps.
- Turn `debug.testArena` off before shipping. Don't build game features into it.

## Current state
Build step 1 is done: start room + concourse, security shutter, pointer-lock look, WASD, jump,
limited sprint meter, wall/obstacle collision, config files, invisible spawn/wall-buy markers.
Added after step 1: crouch (hold C) and slide (tap C while sprinting). Slide locks direction, starts
fast and decays over ~0.9s, has a 1s cooldown, can be jumped out of, and drops into a crouch that stands
up when C is released and there's headroom. Landing/chain slides: jump while sprinting or sliding (or slide off a
ledge) and press C, and a slide starts on landing, skipping the cooldown and sprint requirement. C counts if
tapped in the air, held through landing, pressed up to `slide.chainPressBefore` before the jump, or up to
`slide.chainPressAfterLanding` after landing. Airborne movement never slows you below your current speed
(steering only), so slide-jumps keep their momentum. Crouch/slide tuning is in `feel.crouch` / `feel.slide`.
HUD: white health bar above green stamina bar, bottom-left.

Build step 2 is done: staple gun (hitscan, semi-auto, 40 dmg, 3x headshots, 12/60 ammo, 1.5s reload, R or
dry-click to reload, view kick), first-person model, silver tracer, confetti splatter, wall puffs, hit markers,
ammo HUD, practice dummies in the test range. Only `zombieHealthForRound` from `economy.js` is used so far;
`stats.health` never changes, and there are no zombies, waves, points or death handling.
Added after step 2: hip-fire spread with a dynamic 4-line crosshair, and ADS (hold right mouse): 0.18s eased
transition, spread x0.08, 20% zoom, gun centered with sight just below the crosshair, 75% walk speed.
Player look: last mall employee (red polo, khakis, white sneakers). Hands/forearms on the gun; legs and lower
torso visible when looking down, animated for walk/crouch/slide/air. The body sits `body.backOffset` behind
the camera so you look past the belly; only the lower torso is drawn (a full chest fills the screen).

## Planned build order
1. Walkable mall (done)
2. Staple gun: hitscan shooting, headshots, reload, ammo, hit feedback on static targets (done)
3. Shopper zombies, chasing, attacking with a wind-up, regenerating health, death screen
4. Waves, rounds, points, shutter purchase, first wall buy
5. Mall Walker, then the rest of the roster
6. Wardrobe, claw machine, vendor, Build-A-Blaster, hazards, Flash Sales
7. Second floor, elevators, navmesh pathfinding
8. Audio and UI polish
9. Meta progression and skill tree

## Design reference (decisions made so far)
- **Zombie roster, with intro rounds:** Shopper (round 1), Mall Walker (4, fast, low HP),
  Cart Pusher (6, telegraphed charge), Mannequin (8, frozen while looked at), Mascot (10, tanky, 5x HP).
- **Weapons by store:** start with a staple gun pistol; wall buys like baseball bat, nail gun,
  foam dart blaster, confetti cannon, leaf blower, water cannon, taser rifle, condiment cannon,
  balloon launcher, tennis ball launcher.
- **Mystery box equivalent:** a claw machine (sometimes a plush toy appears and it relocates).
- **Perks = wardrobe system:** 4 slots (head, torso, feet, accessory), one item per slot, each with a
  small upside and downside; buy once, swap free at fitting rooms.
- **Pack-a-Punch equivalent: Build-A-Blaster.** One mod per weapon (fryer oil = burn, smoothie freeze = slow,
  neon sign = electric chain, glitter = confuse zombies).
- **Vendor: Kiosk Kevin** sells lethals, tacticals, armor plates and a turret, with rotating stock each round.
- **Environmental hazards** (pay to trigger, with cooldowns): fire sprinklers, electrified fountain,
  fryer blast, escalator reversal, toppling shelves, PA system lure.
- **Flash Sales:** random, announced over the mall PA (25-50% off one category).
- **Later:** multiple floors with escalators/elevators (needs a navmesh); meta progression and a skill
  tree (keep boosts small).
- **Economy highlights:** start with 500 points, start shutter 500, zombie HP 150 at round 1 then
  +100/round through round 9 then x1.1/round, zombie count `round(6 + 2.5*(round-1))`.
  Full values live in `src/config/economy.js`.
