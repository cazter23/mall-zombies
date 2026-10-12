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
- Every tunable number lives in `src/config/` (`feel.js`, `economy.js`, `weapons.js`, `zombies.js`, `controls.js`,
  `debug.js`), never hardcoded in logic.
- All player stats live in one stats object (`src/player/stats.js`) so perks, wardrobe and a
  future skill tree modify it in one place. Systems read stats, not config, at runtime.
- Death is handled in one function (`onPlayerDeath` in `main.js`) so a downed/revive system can be added
  later. `player/health.js` calls it exactly once when health reaches 0.
- Keep code modular, readable and commented. Prefer small, reviewable changes.
- Build in small steps. Do only the step the user asks for. Test it, then tell them how to try it.
- After changes, run `npm run build` to check for errors.
- Gameplay reads ACTIONS, never raw keys: `input.actionDown/consumeAction/actionPressed('jump')` and
  `input.moveAxis()`. Bindings (keyboard `KeyboardEvent.code` + controller `Pad*` codes) live in
  `config/controls.js`. Raw codes are only used for debug keys in `main.js`.

## Folder structure
```
index.html              Entry page; loads /src/main.js and the Bungee Google Font
package.json            scripts: dev / build / preview
src/
  main.js               Entry: renderer, scene, camera, wires input/world/player/HUD, pause logic,
                        update(dt) + render(alpha); exposes window.__mall when debug.exposeToWindow
  style.css             HUD (crosshair, hit marker, health/stamina bars, ammo, prompt), start/pause overlay
  config/
    feel.js             Movement, sprint, crouch, slide, look (+ view kick recovery), ADS (move speed,
                        sensitivity), camera, player size, sim tick rate, shutter speed, viewmodel
                        placement/animation/fov (+ box cutter slash path), hit effects, crosshair min gap,
                        body (colors + leg/pose tuning), health (regen, hurt edges), death camera, sprintFx,
                        melee lunge end
    economy.js          Points, payouts, kill values, door + wall-buy prices, round timing, wave scaling + helpers
                        (zombieHealthForRound, zombieCountForRound, spawnDelayForRound, maxAliveForRound)
    weapons.js          Per-weapon stats (damage, headshot mult, mag, reserve, fire interval, reload, kick,
                        spread cone, ADS time/zoom/gun offset, colors), `melee.boxCutter` (damage, reach,
                        cone, swing timing, lunge), weaponStatDefaults for stats
    zombies.js          zombieTypes (per-type speed, size, hitboxes, attack, timings, colors, splatter), zombieCrowd
                        (separation, contact gap, spawn dust, min spawn distance), zombieNav (grid settings)
    controls.js         bindings (action -> keyboard/mouse + Pad* codes), buttonLabels (prompts per device),
                        gamepad (deadzones, look speed/curve, turn ramp, triggers, click-to-sprint release),
                        aimAssist (strength dial, range/cone, slowdown, rotational, ADS snap)
    debug.js            showMarkers, allowShutterToggle (O key: doors free), testArena (T key), zombieKeys
                        (Z spawn / X clear), cheatKeys (N next round / P +5000 points), dummies, exposeToWindow
  core/
    loop.js             startLoop(): fixed-timestep accumulator, calls update(dt) and render(alpha, frameTime)
    input.js            Input class: held keys/buttons, one-shot presses, actions (actionDown/consumeAction/
                        actionPressed), moveAxis() (WASD + left stick), padMove/padLook, `device`
                        ('keyboard' | 'gamepad', last used), mouse delta, pointer lock
    gamepad.js          createGamepad(input): polls the first controller each tick (standard layout), writes
                        Pad* held/pressed codes + sticks (radial deadzones, look response curve) into input,
                        click-to-sprint latch (PadSprint), Xbox/PlayStation detection, lookRate() w/ turn ramp
  player/
    controller.js       PlayerController: WASD, jump (buffer + coyote time), sprint meter, crouch/slide
                        (stance: stand|crouch|slide), gravity, mouse look (per render frame), camera interpolation
    stats.js            createPlayerStats(): the single stats object (health, speeds, jump, sprint, crouch/slide,
                        regenDelay/regenRate, adsMoveSpeed, damageMultiplier, meleeDamageMultiplier,
                        reloadSpeed)
    health.js           createPlayerHealth(): takeDamage, regen after a delay, `overlay` strength for the red
                        hurt edges (grows with damage, pulses when low, flashes on hit), calls onDeath once
    body.js             createPlayerBody(): first-person legs + lower torso in the world scene (visual only).
                        Hip height follows eye height; feet posed for walk cycle / slide (V) / air tuck, knees
                        solved with two-bone IK. Exports placeLimb()/makeBoxMesh() (also used for the arms)
  weapons/
    weapon.js           Weapon class: ammo, fire cooldown + click buffer, reload. Pure state; update() returns
                        'fire' | 'empty' | null
    aim.js              createAim(): ADS state (eased 0..1, blocks sprint, sprint cancels it) and hip-fire
                        spread (base + moving + airborne, smoothed, + per-shot bloom; x adsMultiplier).
                        applySpread() picks a random direction inside the cone
    aimAssist.js        createAimAssist(): controller-only (input.device). Picks the visible target nearest the
                        crosshair (sticky), aims at its chest. Slowdown multiplier (read per frame for stick
                        look), rotational follow of the target's angular motion while a stick is in use, and
                        a 40% ADS snap within 5 deg with a cooldown. Runs inside playerGun.update after aim
    hitscan.js          castShot(): one ray vs world colliders and shootables' hitboxes; defines the
                        "shootable" interface (hitboxes, isAlive, takeHit, splatColors)
    melee.js            createMelee(): box cutter. V = swing; lunges at a target 1.08-3m away; hit at 0.15s on the
                        nearest target in a 40deg cone within 1.8m (walls block); cancels reload; isBusy blocks
                        the gun; takeHit({ melee: true }) so kills count as melee
    playerGun.js        createPlayerGun(): glue. Updates aim, reads Mouse0/KeyR (ignored while `blocked`), onShot cb,
                        fires hitscan inside the spread cone, applies damage
                        (headshot x mult x stats.damageMultiplier), recoil, tracer, splatter, hit marker
    viewmodel.js        First-person staple gun model in its own scene + own fixed-FOV camera (drawn after the
                        world with depth cleared); hands + forearms attached to the gun (left hand fetches a staple
                        strip on reload); slides to center in ADS; kick + reload animations; muzzle pos;
                        box cutter arm slashes across while the gun drops aside (meleeProgress)
  zombies/
    navigation.js       createNavigation(): flow field on a 0.5m ground-floor grid built from colliders (floor =
                        box top at y~0; obstacles padded by zombie radius). Dijkstra from the player every 0.2s;
                        rebuilds when colliders.length changes (shutter). directionTo() walks straight if the
                        line is clear, else follows the field with look-ahead. distanceToTarget() for spawning
    zombie.js           Zombie class (shootable): states spawning -> chasing -> windup -> swing -> chasing (with
                        attackCooldown) / dead; path + crowd separation + arrive braking; moveAndCollide;
                        keeps chasing (slower) during windup/swing; hit needs player within range + in front
    zombieModel.js      Blocky shopper model (random outfit, maybe a shopping bag) + code animation: shamble,
                        arms-overhead wind-up, slam, recovery, flinch/flash, rise from floor, tip over and sink
    zombieManager.js    createZombieManager(): spawn (reachable spawn points >= minSpawnDistance away), update,
                        keep the player out of zombies, death splatter, shootables bookkeeping, clear().
                        Options canAttack(), onPlayerHit(damage), onKill(zombie)
  game/
    runStats.js         createRunStats(): time alive, kills, headshot/melee kills, shots fired/hit, accuracy
    wallet.js           createWallet(): points (start 500), earn/spend/canAfford, totalEarned, onChange cb (HUD
                        pop-ups). pointsForHit(): COD payouts (+10 hit; kill value +40 head / +70 melee; zombies only)
    rounds.js           createRounds(): idle -> active (spawn quota at spawnDelay, capped by maxAlive) -> break
                        (10s) -> next round. start() on first play, skipRound() (debug), reset()
  maps/
    index.js            Map registry + loadMap(id, scene, colliders) + THE MAP INTERFACE (id, group, zones, doors,
                        spawnPoints, wallBuys, playerSpawn, update, reset, dispose). New map = new folder + 1 line
    mall/mall.js        buildMall(scene, colliders): the mall. Zones startRoom (open) / concourse; shutter door
                        (500) opens the concourse; wall buys priceGun (start room) + nailGun (outside Nuts & Bolts).
                        All meshes, lights and debug markers live in its group. Exports LAYOUT
    testRange/          Debug add-on (not a map): testRange.js buildTestRange(scene, colliders) with own lights,
                        dummy.js practice mannequins (shootables)
  fx/
    effects.js          Tracers (pooled) + particle bursts (one InstancedMesh): splat() and puff()
  world/                Shared building blocks for maps
    door.js             createDoor(): buyable barrier (price, opensZone) wrapping a shutter; open/reset/toggle
    collision.js        moveAndCollide(): horizontal push-out then vertical landing/ceiling vs. Box3 list;
                        hasHeadroom(): can the player stand up here?
    shutter.js          createShutter(): roll-up barrier with its own Box3 collider (open/close/toggle/update)
    textures.js         Procedural canvas textures (floor tile, shop sign, shutter). No image files.
  ui/
    hud.js              createHud(): 4-line crosshair whose gap = spread cone (dot in ADS) + hit marker (white body, big yellow head, red kill),
                        bottom-left health (white) + stamina (green) bars, bottom-right ammo counter,
                        reload prompt under the crosshair, red hurt edges, click-to-play/paused overlay,
                        "Clocked Out" results screen with Play again (plain DOM)
```

## How the pieces connect
- `main.js` owns the loop. `update(dt)` (60Hz): if `game.over` (dead) only zombies/health/death timer run (checked
  first: the mouse is released on death); if not running (pointer unlocked) it freezes the player; otherwise debug
  keys, `player.update`, `melee.update`, `gun.update(dt, melee.isBusy)` (after the player so shots use this tick's
  eye), `zombies.update`, `rounds.update` (paused while in the test range), `health.update`, `map.update`,
  `arena.update`, `input.endTick()`. `rounds.start()` happens the first tick the game actually runs.
- Map: `main.js` does `loadMap('mall', scene, colliders)` and only uses the map interface (maps/index.js).
  The zombie manager gets `map.spawnPoints` + `isZoneOpen`, so zombies only spawn in opened zones.
- Points: gun and melee call `onHit({ target, killed, headshot, melee })` -> `wallet.earn(pointsForHit(...))`.
  HUD: points above the ammo with +N pop-ups, round number top-left (blinks in the break), "ROUND N" banner.
- Death flow: `onPlayerDeath()` sets `game.over`, hides the combat HUD, releases the mouse. Render then runs the
  death camera (drop + roll) and skips the gun pass; after `feel.death.resultsDelay` the results screen shows.
  Play again -> `resetRun()` (zombies, health, run stats, ammo, melee, player position, shutter) -> re-lock.
- Testing hook: `window.__mall.step(n)` advances the real loop n ticks and draws a frame (use with
  `game.forceRun = true`; set it back to false before screenshots, or the live loop keeps playing).
  `render(alpha, frameTime)`: applies mouse look, interpolates the camera, updates effects + viewmodel, updates the
  HUD, then draws two passes: the world, then (after `clearDepth`) the viewmodel scene. `renderer.autoClear` is false.
- Input: mouse buttons are tracked like keys as `Mouse0`/`Mouse1`/`Mouse2`, only while pointer-locked.
  Controller buttons are `PadA`.. codes written by `gamepad.poll()` (first thing in `update`).
- Controller flow: `game.running` = pointer locked OR `game.padPlaying` OR forceRun. `handleControllerMenus()`
  in main: A/Start starts or resumes (no pointer lock needed), Start pauses, A on the results screen plays
  again. Stick look is applied per frame in render (`player.applyStickLook`) x `aimAssist.slowdown`.
- Shooting: `player.getAim()` gives eye + direction including view kick; `aim.applySpread()` then randomizes it
  inside the spread cone. The crosshair gap is computed in `main.js` render from `aim.spreadDegrees` and the
  current camera FOV (gap px = tan(spread) / tan(fov/2) * screenHeight/2), so every shot lands inside the lines.
- ADS: `aim` sets `player.isAiming` / `player.aimAmount` each tick (blocks sprint, scales walk speed by
  `stats.adsMoveSpeed`). Render zooms `camera.fov` by `def.ads.fovMultiplier` and sets `player.lookScale`.
  `main.js` keeps a `shootables` array (test-range dummies now; zombies should be pushed into it). A collider
  Box3 with `ignoreShots = true` blocks walking but not bullets.
- The game only runs while the pointer is locked; Esc pauses and shows the overlay.
- Collision: one shared flat array `colliders` of `THREE.Box3` (created in main, filled by the map and the
  test range). `box(..., {collide})` in `mall.js`
  makes a mesh and (optionally) a collider; some visuals use `collide:false` with a separate hand-sized
  `addCollider` (pillars, benches). Shutter adds/removes its own collider from the same array.
  Player is a cylinder (radius, height, feet position). Boxes whose top is within `stepTolerance`
  of the feet count as floor, not walls.
- Coordinates: meters, +Y up. Camera looks down -Z at yaw 0.
- Markers (invisible; shown if `debug.showMarkers`): `map.spawnPoints` (6: 2 start-room vents, 4 concourse
  shopfronts, each tagged with its zone) and `map.wallBuys` (2, with an outward `normal` and a `weapon` id).

## Map (current)
- Main concourse: x -20..20, z -6..6, 6m ceiling. Four decorative shopfronts (Good Sports, Nuts & Bolts,
  Play Time Toys, Byte Me Electronics), pillars, benches, planters, ceiling lights.
- Start room: x -5..5, z 6..16 (north of concourse), 4m ceiling, checkout counter, shelf, crates, boarded vents.
- 4m doorway at z=6 blocked by a security shutter door (500 in economy.js) that opens the concourse zone.
  Debug: press **O** to toggle doors for free.
- Wall-buy spots: start room east wall (5, 1.5, 10) = Price Gun; concourse south wall (7.7, 1.5, -6) = Nail Gun.
- Player spawns at (0, 0, 12) facing the shutter.

## Movement test range (debug only)
- Built when `debug.testArena` is true; press **T** in-game to teleport between the mall and the range
  (`player.teleport({ position, yaw })`). Its colliders go into the same shared `colliders` list.
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

Build step 3 is done. Shopper zombies (2.0 m/s) rise out of the floor at reachable spawn markers, path to the
player with a flow field (around pillars/benches/planters, through the doorway once the shutter is open), keep
spacing in a crowd, stop at arm's length, block the player, and can be shot (150 HP round 1: 4 body / 2 head)
with green/purple splatter, then fall over and sink. Attacks: start within 1.0m; arms-overhead wind-up (0.45s in round 1,
-0.02s per round, min 0.3s from round 9; `zombie.windupSeconds`) while still coming at you at 80% speed and
turning fast (attack.turnSpeed 12), then a swing that hits for 40 if you're within 1.4m and in front (3 hits =
dead), 0.8s recovery. Player moves slower backwards (70%) and sideways (85%), stats.backpedalSpeed/strafeSpeed,
so retreating while shooting costs you; sprinting away still escapes if you react fast. Health regens after 3s at
50/s; red screen edges grow with damage, pulse below 40%, flash on hits. Box cutter (V): 150 dmg, lunge, cancels
reload. Death: camera tips over, "Clocked Out" results (time, round, kills, headshot/box cutter kills, accuracy),
Play again resets the run. Spawning is still debug Z (X clears); round is fixed at 1 until waves (step 4).
Sprint feedback (`feel.sprintFx`): head bob + slight roll (camera only, aim unaffected), the gun drops into a
running pose and swings with steps, and white/dark speed lines streak at the screen edges. Driven by
`player.sprintAmount` (0..1, smoothed) and `player.bobPhase`. Low health (<40%) = strong throbbing red edges.

Controller support + aim assist: Xbox/PlayStation via the Gamepad API. LS move (analog walk speed, click =
latched sprint), RS look (200/140 deg/s, curve 2, turn ramp to +80%), LT aim, RT fire, A jump, B crouch/slide,
X reload, RB/R3 box cutter, Start pause/resume. Prompts follow the last device. Aim assist (controller only,
chest-targeted): slowdown 60% hip / 50% ADS, rotational 15% hip / 25% ADS (only with stick input, full strength
except the outer 30% of the zone), ADS snap 40% within 5 deg (0.6s cooldown); master dial
`controls.aimAssist.strength`. Tested with a simulated controller; feel still needs real-hardware tuning.

Step 4 in progress. Done: part A (map package + zones + doors, see maps/index.js) and part B (rounds and
points): round 1 starts on first play (3s delay), zombies spawn from open zones at the economy pace, the round
ends when all are dead, 10s break, next round. Zombie HP scales per round; Shoppers pick walk/jog/run gaits
(2.0/3.4/4.6 m/s) from `zombieTypes.shopper.gaitsByRound` (all walkers in rounds 1-2, runners from round 7).
COD payouts; results show round reached + points earned. Next: part C (hold F / X to buy: the shutter first),
part D (two weapon slots, Price Gun 500 full-auto pistol in the start room, Nail Gun 1000 in the concourse).

## Planned build order
1. Walkable mall (done)
2. Staple gun: hitscan shooting, headshots, reload, ammo, hit feedback on static targets (done)
3. Shopper zombies, chasing, attacking with a wind-up, regenerating health, death screen (done, + box cutter melee)
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
