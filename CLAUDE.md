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
- Every tunable number lives in `src/config/` (`feel.js`, `economy.js`, `debug.js`), never hardcoded in logic.
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
  style.css             HUD, crosshair, sprint bar, start/pause overlay
  config/
    feel.js             Movement, sprint, look, camera, player size, sim tick rate, shutter speed
    economy.js          Points, payouts, kill values, door prices, wave scaling + helper functions
                        (zombieHealthForRound, zombieCountForRound, spawnDelayForRound, maxAliveForRound)
    debug.js            showMarkers, allowShutterToggle (O key), exposeToWindow
  core/
    loop.js             startLoop(): fixed-timestep accumulator, calls update(dt) and render(alpha, frameTime)
    input.js            Input class: held keys, one-shot presses (consumePress/endTick), mouse delta, pointer lock
  player/
    controller.js       PlayerController: WASD, jump (buffer + coyote time), sprint meter, gravity,
                        mouse look (applied per render frame), camera interpolation
    stats.js            createPlayerStats(): the single stats object (health, speeds, jump, sprint)
  world/
    map.js              buildMall(scene): all geometry, colliders, lights, signs, spawn/wall-buy markers,
                        player spawn. Exports LAYOUT. Returns { group, colliders, shutter, markers, playerSpawn, update }
    collision.js        moveAndCollide(): horizontal push-out then vertical landing/ceiling vs. Box3 list
    shutter.js          createShutter(): roll-up door with its own Box3 collider (open/close/toggle/update)
    textures.js         Procedural canvas textures (floor tile, shop sign, shutter). No image files.
  ui/
    hud.js              createHud(): crosshair, sprint bar, click-to-play/paused overlay (plain DOM)
```

## How the pieces connect
- `main.js` owns the loop. `update(dt)` (60Hz): if not running (pointer unlocked) it freezes the
  player and clears input; otherwise handles debug keys, `player.update(dt)`, `world.update(dt)`, `input.endTick()`.
  `render(alpha)`: applies accumulated mouse look, interpolates the camera, updates the HUD, renders.
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

## Current state
Build step 1 is done: start room + concourse, security shutter, pointer-lock look, WASD, jump,
limited sprint meter, wall/obstacle collision, config files, invisible spawn/wall-buy markers.
Nothing yet reads `economy.js` (data only), `stats.health`/`maxHealth` are unused, and there are
no weapons, zombies, waves, points or death handling.

## Planned build order
1. Walkable mall (done)
2. Staple gun: hitscan shooting, headshots, reload, ammo, hit feedback on static targets
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
