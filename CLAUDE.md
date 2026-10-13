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
  `audio.js`, `debug.js`), never hardcoded in logic.
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
    feel.js             Movement, sprint, crouch, slide, look (+ recoil spring: frequency/damping, roll), ADS
                        (move speed, sensitivity), camera, player size, sim tick rate, shutter speed, viewmodel
                        handling shared by all guns (fov, sway, walk bob, breathing, landing dip, reload
                        blend-out, dry-fire kick, box cutter slash path), hit effects, crosshair min gap,
                        body (colors + leg/pose tuning), health (regen, hurt edges), death camera, sprintFx,
                        melee lunge end
    economy.js          Points, payouts, kill values, door + wall-buy prices, round timing, wave scaling + helpers
                        (zombieHealthForRound, zombieCountForRound, spawnDelayForRound, maxAliveForRound)
    weapons.js          Per-weapon stats (damage, headshot mult, mag, reserve, fire interval, reload, spread
                        cone, ADS time/zoom/gun offset), recoil (camera pitch/roll + gun-model kick + spring),
                        muzzleFlash (size, colors, ADS shape, lights), sounds, viewmodel (model name, hip
                        offset/angles, colors, trigger anim, reload keyframes gunKeys/handKeys + timed events
                        with sounds/jolts), `melee.boxCutter` (damage, reach, cone, swing timing, lunge),
                        weaponStatDefaults for stats
    audio.js            Master volume, pitch variation, compressor, and sound recipes (layers of filtered noise
                        bursts and tones) for the staple gun shot, dry click and reload sounds
    zombies.js          zombieTypes (per-type speed, size, hitboxes, attack, timings, colors, splatter), zombieCrowd
                        (spacing, lanes, queueing, surround rings + sector/still-wrap/circling, contact gap,
                        spawn dust, min spawn distance),
                        zombieNav (grid, soft wall clearance + wall penalty)
    controls.js         bindings (action -> keyboard/mouse + Pad* codes), buttonLabels (prompts per device),
                        gamepad (deadzones, look speed/curve, turn ramp, triggers, click-to-sprint release),
                        aimAssist (strength dial, range/cone, slowdown, rotational, ADS snap)
    debug.js            showMarkers, allowShutterToggle (O key: doors free), testArena (T key), zombieKeys
                        (Z spawn / X clear), cheatKeys (N next round / P +5000 points), dummies, exposeToWindow
  core/
    loop.js             startLoop(): fixed-timestep accumulator, calls update(dt) and render(alpha, frameTime)
    spring.js           createSpring / createSpring3: damped springs back to 0 (exact solution, frame-rate
                        independent). kick(peak) (impulse sized so it peaks at `peak`), displace(), update(dt)
    keyframes.js        samplePose(keys, t, outPos, outRot): eased pose keyframes ({ t, pos: [m], rot: [deg] })
    input.js            Input class: held keys/buttons, one-shot presses, actions (actionDown/consumeAction/
                        actionPressed), moveAxis() (WASD + left stick), padMove/padLook, `device`
                        ('keyboard' | 'gamepad', last used), mouse delta, pointer lock
    gamepad.js          createGamepad(input): polls the first controller each tick (standard layout), writes
                        Pad* held/pressed codes + sticks (radial deadzones, look response curve) into input,
                        click-to-sprint latch (PadSprint; ended by stick release or a FRESH aim/crouch action
                        press, so L3 while holding LT drops ADS and sprints), Xbox/PlayStation detection,
                        `connected`, lookRate() w/ turn ramp
  player/
    controller.js       PlayerController: WASD, jump (buffer + coyote time), sprint meter, crouch/slide
                        (stance: stand|crouch|slide), gravity, mouse look (per render frame), camera interpolation.
                        View recoil: kickSpring (pitch, part of the aim; `viewKick` getter) + rollSpring (visual
                        only). addRecoil(pitch, roll) for shots, addViewKick() for instant jolts (hits, melee),
                        updateView(dt) at the END of each tick; syncCamera interpolates both
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
                        'fire' | 'empty' | null. `blocked` (melee swing) drops a queued click
    aim.js              createAim(): ADS state (eased 0..1, blocks sprint, sprint cancels it) and hip-fire
                        spread (base + moving + airborne, smoothed, + per-shot bloom; x adsMultiplier).
                        applySpread() picks a random direction inside the cone; reset() (new run: hip, base spread)
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
                        (headshot x mult x stats.damageMultiplier). Same tick as the shot: player.addRecoil
                        (scaled by ADS), viewmodel.fire (gun kick + flash), shot sound, tracer, splatter, hit
                        marker. 'empty' -> viewmodel.dryFire + dry click. Runs viewmodel.reload.events as the
                        reload clock passes them (sound + viewmodel.jolt), so sounds match the animation
    viewmodel.js        Shared first-person rig in its own scene + own fixed-FOV camera (drawn after the world
                        with depth cleared). Builds the gun from weapons/models/, attaches the muzzle flash,
                        and adds up layers on a `holder` each frame: hip->ADS rest pose, reload pose
                        (gunKeys; eases out if cancelled), recoil springs (kickPos/kickRot: fire(), dryFire(),
                        jolt()), turn sway, walk bob ("smile"), breathing, landing dip, sprint pose, melee
                        (box cutter arm slashes while the gun drops aside). Wiggles scale way down in ADS.
                        update(frameTime, camera, { weapon, aimAmount, meleeProgress, player }); `worldLight`
                        (added to the world scene by main); getMuzzleWorldPosition(); reset()
    models/             First-person weapon models. index.js = registry (viewmodel.model -> builder) + the model
                        interface ({ root, muzzle, animate({ sinceFire, reloadProgress, reloadWeight }),
                        leftHandVisible }). stapleGun.js = the gun + hands, squeeze lever on fire, left hand
                        fetching a staple strip (handKeys). New gun = new file + 1 line
    muzzleFlash.js      createMuzzleFlash(cfg): 2 sprites (normal-blended orange burst + additive core, random
                        twist/size), hand light + world light (always in the scene at 0 so no shader recompile).
                        Always depth-tested (the hands and gun hide whatever part of the burst is behind them),
                        sits 9cm in front of the muzzle so it shows past the left hand at the hip; in ADS it
                        goes wide/flat so the rays poke out around the gun, below the crosshair
  zombies/
    navigation.js       createNavigation(): flow field on a 0.5m ground-floor grid built from colliders (floor =
                        box top at y~0; obstacles padded by zombie radius; cells within extraClearance cost extra
                        so routes stay off walls but narrow gaps still connect). Dijkstra from the player every
                        0.2s; rebuilds when colliders.length changes (shutter). directionTo(from, target, out,
                        { laneOffset, laneFade, lookAhead }) walks straight if the line is clear, else follows the
                        field; each zombie's own lane offset shifts its aim sideways. Also clearLine(), isWalkableAt()
    zombie.js           Zombie class (shootable): states spawning -> chasing -> windup -> swing -> chasing (with
                        attackCooldown) / dead. Steering: goal = its surround slot (if assigned) else the route
                        along its own lane; spacing push (quadratic, capped); queueing (slow + sidestep around a
                        zombie ahead); arrive braking; faces where it's trying to go. Personal laneOffset,
                        lookAhead, sideBias. During windup/swing it heads straight at the player (not its slot). circleAroundPlayer(): if
                        the player's body is in the way partway to its slot, it walks round them (not the last stretch)
    zombieModel.js      Blocky shopper model (random outfit, maybe a shopping bag) + code animation (walk cycle
                        numbers in zombieTypes.<type>.walkAnimation): shamble,
                        arms-overhead wind-up, slam, recovery, flinch/flash, rise from floor, tip over and sink
    zombieManager.js    createZombieManager(): spawn (reachable spawn points >= minSpawnDistance away), update
                        (assign surround slots -> zombie updates -> resolve zombie overlaps -> keep the player out
                        of zombies -> refresh hitboxes, since the shoves moved bodies), death splatter, shootables bookkeeping, clear(). Surround slots: rings around
                        the player (inner at arm's length), innermost ring fills first, zombies keep their slot.
                        A zombie only takes slots within surroundSectorDegrees (50) of its own side of the player,
                        so a horde chasing you stays behind you; after you stand still for wrapAfterStillSeconds
                        the sector widens to the full circle over wrapSeconds and they surround you.
                        Crowd shoves never move anyone into a wall (overlapsSolid); a pinned player pushes the
                        zombie back instead. Options canAttack(), onPlayerHit(damage), onKill(zombie)
  game/
    runStats.js         createRunStats(): time alive, kills, headshot/melee kills, shots fired/hit, accuracy
    wallet.js           createWallet(): points (start 500), earn/spend/canAfford, totalEarned, onChange cb (HUD
                        pop-ups). pointsForHit(): COD payouts (+10 hit; kill value +40 head / +70 melee; zombies only)
    rounds.js           createRounds(): announce(n, delay) flips the round number (and fires onRoundStart) the
                        moment the last zombie dies, then 'break' (6s, inBreak) -> 'active' (spawn quota at
                        spawnDelay, capped by maxAlive). start() on first play, skipRound() (debug), reset()
  maps/
    index.js            Map registry + loadMap(id, scene, colliders) + THE MAP INTERFACE (id, group, zones, doors,
                        spawnPoints, wallBuys, playerSpawn, update, reset, dispose). New map = new folder + 1 line
    mall/mall.js        buildMall(scene, colliders): the mall. Zones startRoom (open) / concourse; shutter door
                        (500) opens the concourse; wall buys priceGun (start room) + nailGun (outside Nuts & Bolts).
                        All meshes, lights and debug markers live in its group. Exports LAYOUT
    testRange/          Debug add-on (not a map): testRange.js buildTestRange(scene, colliders) with own lights,
                        dummy.js practice mannequins (shootables)
  audio/
    sound.js            createSound(): Web Audio synth for config/audio.js recipes. play(name, { volume }),
                        unlock() (also on the first pointerdown/keydown; browsers block audio before that)
  fx/
    effects.js          Tracers (pooled) + particle bursts (one InstancedMesh): splat(), puff(), clear() (new run)
  world/                Shared building blocks for maps
    door.js             createDoor(): buyable barrier (price, opensZone) wrapping a shutter; open/reset/toggle
    collision.js        moveAndCollide(): horizontal push-out then vertical landing/ceiling vs. Box3 list;
                        hasHeadroom(): can the player stand up here? overlapsSolid(): would a body overlap a wall?
    shutter.js          createShutter(): roll-up barrier with its own Box3 collider (open/close/toggle/update)
    textures.js         Procedural canvas textures (floor tile, shop sign, shutter, muzzle flash burst). No image files.
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
  `arena.update`, `player.updateView` (recoil springs last, so a shot's kick shows on the very next frame),
  `input.endTick()`. `rounds.start()` happens the first tick the game actually runs.
- Map: `main.js` does `loadMap('mall', scene, colliders)` and only uses the map interface (maps/index.js).
  The zombie manager gets `map.spawnPoints` + `isZoneOpen`, so zombies only spawn in opened zones.
- Points: gun and melee call `onHit({ target, killed, headshot, melee })` -> `wallet.earn(pointsForHit(...))`.
  HUD: points above the ammo with +N pop-ups, round number top-left (blinks in the break), "ROUND N" banner.
- Death flow: `onPlayerDeath()` sets `game.over`, hides the combat HUD, releases the mouse. Render then runs the
  death camera (drop + roll) and skips the gun pass; after `feel.death.resultsDelay` the results screen shows.
  Play again -> `resetRun()` (zombies, health, run stats, ammo + aim, viewmodel, effects, melee, player position,
  shutter) -> re-lock.
- Testing hook: `window.__mall.step(n)` advances the real loop n ticks and draws a frame (use with
  `game.forceRun = true`; set it back to false before screenshots, or the live loop keeps playing).
  `render(alpha, frameTime)`: applies mouse look, interpolates the camera, updates effects + viewmodel, updates the
  HUD, then draws two passes: the world, then (after `clearDepth`) the viewmodel scene. `renderer.autoClear` is false.
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

Build step 2 is done: staple gun (hitscan, semi-auto, 40 dmg (now 30), 3x headshots, 12/60 ammo, 1.5s reload, R or
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
spacing in a crowd, stop at arm's length, block the player, and can be shot (150 HP round 1: 5 body / 2 head
with the staple gun, now 30 dmg) with green/purple splatter, then fall over and sink. Attacks (COD-style, swing
on the way in): start within 1.5m with no wall between (low stuff like counters doesn't block; `wallBetween`), no
braking first; arms-overhead wind-up (0.35s in round 1, shrinking to 0.3s by round 9; `zombie.windupSeconds`)
while stepping straight at you at full speed and turning fast (attack.turnSpeed 12), then a swing that hits for
40 if you're within 1.7m (a bit past the 1.5m start range = the lunge) and in front (3 hits = dead); 0.8s recovery
after a hit, only 0.3s after a miss (no free reset by stepping back). Standing still, strafing or walking up to
one = hit; backing off or jump-backing from a walker only works if you leave the instant its arms go up (or
earlier), never vs a jogger up close; a quick sprint-away (~0.1s reaction) still works. Player moves slower backwards (70%) and sideways (85%), stats.backpedalSpeed/strafeSpeed,
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

Crowd behaviour (fixed chains/stacking/identical paths): measured with a 12-zombie horde through the doorway,
overlap time 53% -> 0%, conga lines 68% -> ~20%, doorway crossing spots 2 -> 8-12, zombies surround the player in
rings (several at arm's length all around), and a crowd can no longer shove the player through a wall (it used to
push you out of the map). Attack difficulty unchanged (same dodge-test results).

Gunplay polish (staple gun, reusable for every gun): camera recoil is a critically damped spring (1.0 deg peak
~35ms after the shot, x0.7 in ADS, back to exactly where you aimed; spamming climbs ~1.1 deg max) plus a 0.3 deg
visual-only roll; the gun model kicks on its own springs (4.5cm back, 7 deg flip, random twist/roll, slight forward
settle, x0.4 in ADS); squeeze lever animates; cartoon muzzle flash (orange burst + white core, ~3 frames) lights the
gun and the room; keyframed reload (gun tips up and rolls to show the staple channel, left hand drops away and
brings a strip, slap-in and snap-shut jolts) with synced sounds; a reload cancelled by the box cutter eases out;
turn sway (~2.5 deg, 0.25 in ADS), walk bob, breathing, landing dip. Synthesized sounds (shot, dry click, 3 reload
sounds) with no audio files. Gun sits a bit closer/higher and angled in so you see its side. Shot, kick, flash and
sound all happen on the same tick and show on the next frame; the crosshair still matches the shot exactly.

Step 4 in progress. Done: part A (map package + zones + doors, see maps/index.js) and part B (rounds and
points): round 1 starts on first play (3s delay), zombies spawn from open zones at the economy pace, the round
ends when all are dead, short break, next round. Zombie HP scales per round; Shoppers pick walk/jog/run gaits
(2.0/3.4/4.6 m/s) from `zombieTypes.shopper.gaitsByRound` (all walkers in rounds 1-2, runners from round 7).
COD payouts; results show round reached + points earned.
BO2-inspired tuning (after part B): wind-up 0.35s -> 0.3s; round number flips the instant the last zombie dies,
6s break, then zombies trickle in (early rounds slower: `spawnDelay.earlyRounds` 3.0/2.6/2.2/1.9s, max alive
5/6/9/12 in rounds 1-4); staple gun 30 dmg; a horde chasing you stays on its own side (behind you) and only
wraps all the way round when you stand still. Next: part C (hold F / X to buy: the shutter first),
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
