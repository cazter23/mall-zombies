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
npm test           # gameplay regressions (Node's built-in test runner)
npm run dev        # Vite dev server (hot reload)
npm run build      # production build into dist/; run after every change to catch errors
npm run preview    # serve the built dist/
```
Gameplay regression tests live in `tests/` (`gameplay.test.js` movement/melee/vault, `aim.test.js` spread,
`zombies.test.js` zombie types/mix/rounds, `maps.test.js` wall pieces, shared-zone doors, nav rebuilds,
`mall.test.js` the REAL mall built in Node with a stub canvas: door ladder, spawn points on clear floor, zones
sealed until their door is bought, vaultable counters); there is no linter yet.
`npm run build` is the compile check (it only bundles; it
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
                        weaponSwitch (lower/raise time, drop), interact (hold time, range, facing angle, denied
                        flash), world.wallBuyDisplay, melee lunge end
    economy.js          Points, payouts, kill values, door + wall-buy prices, round timing, wave scaling + helpers
                        (zombieHealthForRound, zombieCountForRound, spawnDelayForRound, maxAliveForRound).
                        zombieMix: special types per round (mallWalker: from round 4, share 15% / 25% from 6 / 30% from 9,
                        healthMultiplier 0.65, introSpawnIndex) + zombieHealthFor(typeId, round), zombieTypeForRound(round)
    weapons.js          stapleGun (start pistol, semi), priceGun (wall buy, full auto), nailGun (wall buy, semi,
                        piercing: `pierce: { maxTargets, damageFalloff }`). Per-weapon stats (fireMode
                        'semi' | 'auto', damage, headshot mult, mag, reserve (= max for ammo buys), fire interval, reload, spread
                        cone, ADS time/zoom/gun offset), recoil (camera pitch/yaw/roll + gun-model kick + spring),
                        muzzleFlash (size, colors, ADS shape, lights), sounds, viewmodel (model name, hip
                        offset/angles, colors, trigger anim, reload keyframes gunKeys/handKeys + timed events
                        with sounds/jolts), `melee.boxCutter` (damage, reach, cone, swing timing, lunge),
                        weaponStatDefaults for stats
    audio.js            Master volume, pitch variation, compressor, and sound recipes (layers of filtered noise
                        bursts and tones): staple / price / nail gun shots and reloads, dry click, purchase, denied,
                        Mall Walker walkerSqueak / walkerHuff / walkerPant, paChime (announcements)
    zombies.js          zombieTypes (per-type speed, size, hitboxes, attack, timings, colors, splatter): `shopper`, and
                        `mallWalker` = { ...shopper, overrides } (speed 5.4 no gaits, modelScale + slimmer hitbox, winded,
                        powerWalk walkAnimation + windedAnimation, tracksuit `outfit`, introBanner, sounds). zombieCrowd
                        (spacing, lanes, queueing, surround rings + sector/still-wrap/circling, contact gap,
                        spawn dust, min spawn distance, soundMinGapSeconds),
                        zombieNav (grid, soft wall clearance + wall penalty), zombieFailsafe (stuck-zombie rescue)
    controls.js         bindings (action -> keyboard/mouse + Pad* codes; interact = F / X; switchWeapon = wheel / Y,
                        weapon1/weapon2 = 1/2; menu-only: settings = Y, controlsScreen = X on the pause screen), buttonLabels
                        (prompts per device), controlsHelp (what the Controls screen shows; keep in sync with bindings),
                        gamepad (deadzones, look speed/curve, turn ramp, triggers, click-to-sprint release),
                        aimAssist (strength dial, range/cone, slowdown, rotational, ADS snap)
    settings.js         THE LIST of player settings (options menu): { id, tab, label, type toggle|slider|select, default,
                        min/max/step, format, apply(value, ctx) }. Most apply() functions write into the config objects the
                        game reads every frame (feel, controls, audio). New setting = one entry here (new tab = add to settingsTabs)
    debug.js            showMarkers, allowShutterToggle (O key: every door open/closed for free), testArena (T key), zombieKeys
                        (Z spawn Shopper / Shift+Z Mall Walker / X clear), cheatKeys (N next round / P +5000 points / ' points to 0), dummies, exposeToWindow
  core/
    loop.js             startLoop(): fixed-timestep accumulator; each frame calls beforeUpdate(frameTime) (look
                        input), then update(dt) per tick, then render(alpha, frameTime)
    spring.js           createSpring / createSpring3: damped springs back to 0 (exact solution, frame-rate
                        independent). kick(peak) (impulse sized so it peaks at `peak`), displace(), update(dt)
    keyframes.js        samplePose(keys, t, outPos, outRot): eased pose keyframes ({ t, pos: [m], rot: [deg] })
    input.js            Input class: held keys/buttons, one-shot presses (mouse wheel = 'WheelUp'/'WheelDown'), actions (actionDown/consumeAction/
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
                        only) + yawKickSpring (sideways, part of the aim; `viewKickYaw`). addRecoil(pitch, roll, yaw)
                        for shots, addViewKick() for instant jolts (hits, melee),
                        updateView(dt) at the END of each tick; syncCamera interpolates both
    vault.js            Opt-in low-obstacle vault: jump on approach, full-cylinder path/headroom/landing
                        checks (including live shootables), entry momentum on exit, interrupt on crowd shove
    stats.js            createPlayerStats(): the single stats object (health, speeds, jump, sprint, crouch/slide,
                        regenDelay/regenRate, adsMoveSpeed, damageMultiplier, meleeDamageMultiplier,
                        reloadSpeed)
    health.js           createPlayerHealth(): takeDamage, regen after a delay, `overlay` strength for the red
                        hurt edges (grows with damage, pulses when low, flashes on hit), calls onDeath once
    body.js             createPlayerBody(): first-person legs + lower torso in the world scene (visual only).
                        Hip height follows eye height; feet posed for walk cycle / slide (V) / air tuck, knees
                        solved with two-bone IK. Exports placeLimb()/makeBoxMesh() (also used for the arms)
  weapons/
    weapon.js           Weapon class: ammo, fire cooldown + click buffer, reload. Pure state; update({ triggerPressed,
                        triggerHeld, reloadPressed, blocked }) returns 'fire' | 'empty' | null. fireMode 'auto' fires
                        while held (dry-clicks only on a fresh press; runs dry while held = reloads itself).
                        `blocked` (melee, switching) drops a queued click. The cooldown carries the leftover fraction
                        of a tick into a queued next shot (real rate = fireInterval). refill(), isFull (ammo buys)
    aim.js              createAim(): ADS state (eased 0..1, blocks sprint, sprint cancels it) and hip-fire
                        spread (base + moving + airborne, smoothed, + per-shot bloom; x adsMultiplier).
                        Bloom recovers after spread.bloomRecoveryDelay (0.15s after the latest shot per gun),
                        so sustained fire builds spread; recovery then uses the existing bloomRecovery rate.
                        applySpread() picks a random direction inside the cone; reset() (new run: hip, base spread).
                        update(dt, allowAim) (false mid weapon switch). One aim per carried gun
    aimAssist.js        createAimAssist(): controller-only (input.device). Picks the visible target nearest the
                        crosshair (sticky), aims at its chest. Slowdown multiplier (read per frame for stick
                        look), rotational follow of the target's angular motion while a stick is in use, and
                        a 40% ADS snap within 5 deg with a cooldown. Runs inside playerGun.update after aim
    hitscan.js          castShot(origin, dir, range, colliders, shootables, maxTargets = 1): one ray vs world colliders
                        and shootables' hitboxes. Returns the first hit (target/part/point/normal) plus `hits` (every
                        shootable hit, nearest first, up to maxTargets, all in front of the first wall), `end` (where
                        the tracer stops) and `endNormal`. Defines the "shootable" interface (hitboxes, isAlive,
                        takeHit, splatColors)
    melee.js            createMelee(): box cutter. V = swing; lunges at a target 1.08-3m away; hit at 0.15s on the
                        nearest target in a 40deg cone within 1.8m (walls block); cancels reload; isBusy blocks
                        the gun; takeHit({ melee: true }) so kills count as melee. Attack heading is committed
                        until impact; hit recovery 0.22s, miss recovery 0.5s (total 0.37/0.65s)
    playerGun.js        createPlayerGun(): the LOADOUT (2 slots, each { def, weapon, aim }) + glue for the gun in hand
                        (`weapon`, `aim`, `def` getters). give(def): owned = refill; free slot = add + switch to it;
                        full = replace the gun in hand. Switching (switchWeapon / weapon1 / weapon2): the old gun drops
                        (shownDef, switchLower for the viewmodel), the new one rises; no shooting/aiming meanwhile;
                        cancels reloads. owns(id), weaponFor(id), requestReload(). Reads fire (press + held)/reload, onShot cb,
                        fires hitscan inside the spread cone, applies damage to every hit
                        (headshot x mult x pierce falloff x stats.damageMultiplier; points per zombie hit). Same tick as the shot: player.addRecoil
                        (scaled by ADS), viewmodel.fire (gun kick + flash), shot sound, tracer, splatter, hit
                        marker. 'empty' -> viewmodel.dryFire + dry click. Runs viewmodel.reload.events as the
                        reload clock passes them (sound + viewmodel.jolt), so sounds match the animation
    viewmodel.js        Shared first-person rig in its own scene + own fixed-FOV camera (drawn after the world
                        with depth cleared). createViewmodel(allWeaponDefs, meleeDef) builds every gun's model up
                        front (only the shown one visible; one shared hand light + world light that each gun's
                        flash recolors, so lights never come and go), attaches each muzzle flash,
                        and adds up layers on a `holder` each frame: hip->ADS rest pose, reload pose
                        (gunKeys; eases out if cancelled), recoil springs (kickPos/kickRot: fire(), dryFire(),
                        jolt()), turn sway, walk bob ("smile"), breathing, landing dip, sprint pose, melee
                        (box cutter arm slashes while the gun drops aside). Wiggles scale way down in ADS.
                        update(frameTime, camera, { weapon, shownDef, switchLower, aimAmount, meleeProgress, player }); `worldLight`
                        (added to the world scene by main); getMuzzleWorldPosition(); reset()
    models/             First-person weapon models. index.js = registry (viewmodel.model -> { model, display }
                        builders) + the model interface ({ root, muzzle, animate({ sinceFire, reloadProgress,
                        reloadWeight }), leftHandVisible }); buildWeaponDisplay(def) = the gun alone (wall buys).
                        arms.js = shared pistol hands (buildPistolArms -> leftArm). stapleGun.js = staple gun,
                        squeeze lever, left hand fetching a staple strip. priceGun.js = orange label gun with a
                        sticker roll on top; lever; reload swaps the roll (rollGone / newRollVisible windows).
                        nailGun.js = yellow/black framing nailer (piston cap, steel nose that punches forward on each
                        shot, angled nail magazine); reload slides a fresh strip into the magazine.
                        New gun = new file + 1 line
    muzzleFlash.js      createMuzzleFlash(cfg): 2 sprites (normal-blended orange burst + additive core, random
                        twist/size), hand light + world light (always in the scene at 0 so no shader recompile).
                        Always depth-tested (the hands and gun hide whatever part of the burst is behind them),
                        sits 9cm in front of the muzzle so it shows past the left hand at the hip; in ADS it
                        goes wide/flat so the rays poke out around the gun, below the crosshair
  zombies/
    navigation.js       createNavigation(): flow field on a 0.5m ground-floor grid built from colliders (floor =
                        box top at y~0; obstacles padded by zombie radius; cells within extraClearance cost extra
                        so routes stay off walls but narrow gaps still connect). Dijkstra from the player every
                        0.2s; rebuilds when colliderSignature() changes (count + version, see collision.js). The grid
                        covers every collider's footprint, so bigger maps need no settings. directionTo(from, target, out,
                        { laneOffset, laneFade, lookAhead }) walks straight if the line is clear, else follows the
                        field; each zombie's own lane offset shifts its aim sideways. Also clearLine(), isWalkableAt().
                        The field is seeded only from cells near the player with no wall in between (a real ray vs
                        the colliders, wallBetween), and bestCellNear() never picks a cell across a wall, so there
                        are no phantom routes through thin walls
    zombie.js           Zombie class (shootable): states spawning -> chasing -> windup -> swing -> chasing (with
                        attackCooldown) / dead. Steering: goal = its surround slot (if assigned) else the route
                        along its own lane; spacing push (quadratic, capped); queueing (slow + sidestep around a
                        zombie ahead); arrive braking; faces where it's trying to go. Personal laneOffset,
                        lookAhead, sideBias. During windup/swing it heads straight at the player (not its slot). circleAroundPlayer(): if
                        the player's body is in the way partway to its slot, it walks round them (not the last stretch).
                        Types with `winded` (Mall Walker): after every swing windedTimer = stand + slow seconds; it stays
                        'chasing' but windedSpeedScale() is 0 then slowSpeedFraction, and attackCooldown >= standSeconds.
                        Types with `sounds`: chaseSounds() (step squeaks / huffs on timers) + playSound(): volume by
                        distance through ctx.onSound
    zombieModel.js      Blocky zombie model built from the type: shopper (random outfit, maybe a shopping bag) or Mall
                        Walker (type.outfit: matching tracksuit + stripes, headband, wristbands, fanny pack; modelScale).
                        Arms have shoulder + elbow joints. Code animation (numbers in zombieTypes.<type>.walkAnimation):
                        shamble or style 'powerWalk' (bent arms pumping, hips twisting), arms-overhead wind-up, slam,
                        recovery, winded pose (bent over, hands at knees, breathing), flinch/flash, rise from floor, tip over and sink
    zombieManager.js    createZombieManager(): spawn(typeId) (open + reachable spawn points >= minSpawnDistance away; returns
                        null if none, the round waits; health = zombieHealthFor(typeId, round)), onSound option (zombie
                        sounds, the same sound never within zombieCrowd.soundMinGapSeconds), update
                        (assign surround slots -> zombie updates -> resolve zombie overlaps -> keep the player out
                        of zombies -> stuck-zombie failsafe -> refresh hitboxes, since the shoves moved bodies). Failsafe:
                        a zombie > ignoreWithinMeters away that moved < minMoveMeters (or can't reach the player) in
                        checkSeconds, or fell below fallOutHeight, rises again at a spawn point (zombie.respawnAt,
                        same health, no points); death splatter, shootables bookkeeping, clear(). Surround slots: rings around
                        the player (inner at arm's length), innermost ring fills first, zombies keep their slot.
                        A zombie only takes slots within surroundSectorDegrees (50) of its own side of the player,
                        so a horde chasing you stays behind you; after you stand still for wrapAfterStillSeconds
                        the sector widens to the full circle over wrapSeconds and they surround you.
                        Crowd shoves never move anyone into a wall (overlapsSolid); a pinned player pushes the
                        zombie back instead. Options canAttack(), onPlayerHit(damage), onKill(zombie)
  game/
    settings.js         createSettings(ctx): current value of every setting, saved in localStorage ('mallZombies.settings',
                        values are sanitized on load), applies them all at startup; get/set/reset(tab)/onChange. ctx = { renderer, sound, hud }
    runStats.js         createRunStats(): time alive, kills, headshot/melee kills, shots fired/hit, accuracy
    wallet.js           createWallet(): points (start 500), earn/spend/canAfford, totalEarned, onChange cb (HUD
                        pop-ups). pointsForHit(): COD payouts (+10 hit; kill value +40 head / +70 melee; zombies only)
    interactions.js     createInteractions(): buyables (doors now, wall buys next). add({ label, verb, cost, position,
                        available(), use() }). Each tick: nearest available item within feel.interact.range and
                        roughly faced = focus; holding interact for holdSeconds (hold must START while focused) spends
                        and calls use(), else red prompt + 'denied'. Buttons bound to both interact and reload
                        (controller X): the press is hidden from the gun near a buyable; let go before it buys =
                        onReloadTap (gun.requestReload()). `prompt` for the HUD; reset()
    rounds.js           createRounds(): announce(n, delay) flips the round number (and fires onRoundStart) the
                        moment the last zombie dies, then 'break' (6s, inBreak) -> 'active' (spawn quota at
                        spawnDelay, capped by maxAlive; quota only used when a zombie actually spawned, else retry
                        after spawnRetrySeconds). Each spawn's type: zombieTypeForRound, except a special type's
                        first possible round forces its introSpawnIndex-th spawn to be one. onTypeIntro(typeId) fires
                        the first time a type spawns in a run. start() on first play, skipRound() (debug), reset()
  maps/
    index.js            Map registry + loadMap(id, scene, colliders) + THE MAP INTERFACE (id, group, zones, doors,
                        spawnPoints, wallBuys, playerSpawn, update, reset, dispose). New map = new folder + 1 line
    mall/mall.js        buildMall(scene, colliders): the mall's LAYOUT only (rooms, doors, props, lights, markers), built
                        with the map kit + mall props. Zones startRoom (open) / concourse / megaMart; doors: start
                        shutter (500) -> concourse, Mega Mart shutter (750, concourse east wall) -> megaMart; wall buys
                        priceGun (start room) + nailGun (outside Nuts & Bolts) + a reserved spot in the Mega Mart
                        (weapon 'foamDartBlaster', inert until that gun exists). All meshes, lights and debug markers
                        live in its group. Exports LAYOUT (concourse, startRoom, doorway, megaMart, megaMartDoorway)
    mall/props.js       createMallProps(kit): shopFront({ along 'x'|'z', from, to, wallAt, facing, color, text }), pillar,
                        bench (vaultable), planter ({ tree }), lightPanel ({ dead }), gondola (solid double-sided shelf,
                        products = one seeded InstancedMesh), checkout (vaultable counter + register + lane light),
                        wallDoor (painted service/exit door + sign), boardedVent, wallStripe
    mall/palette.js     COLORS shared by the mall's rooms and props
    testRange/          Debug add-on (not a map): testRange.js buildTestRange(scene, colliders) with own lights,
                        dummy.js practice mannequins (shootables)
  audio/
    sound.js            createSound(): Web Audio synth for config/audio.js recipes. play(name, { volume }),
                        unlock() (also on the first pointerdown/keydown; browsers block audio before that),
                        setMasterVolume(v) (used by Settings > Audio)
  fx/
    effects.js          Tracers (pooled) + particle bursts (one InstancedMesh): splat(), puff(), clear() (new run)
  world/                Shared building blocks for maps
    mapKit.js           createMapKit(group, colliders): mat, addCollider, box, sign, tiledFloor, wall({ along, from, to,
                        at0, at1, height, openings: [{ from, to, top }] }) (doorways get lintels), shutterDoor({ id, label,
                        price, opensZone, zones, doorway, text }), markers(). wallSegments(): the pure wall math (tested)
    door.js             createDoor(): buyable barrier (price, opensZone) wrapping a shutter; open/reset/toggle. Several
                        doors may open the same zone: it stays open while any of them is open (tracked per zone)
    wallBuy.js          createWallBuyDisplay(): chalk outline (textures.makeChalkTexture) + the gun on two pegs, side on
    collision.js        moveAndCollide(): horizontal push-out (also removes the velocity going into the wall, so
                        a pinned mover reads speed 0 and slides along walls) then vertical landing/ceiling vs. Box3 list;
                        hasHeadroom(): can the player stand up here? overlapsSolid(): would a body overlap a wall?
                        markCollidersChanged(colliders) after adding/removing a collider at runtime; colliderSignature()
    shutter.js          createShutter(): roll-up barrier with its own Box3 collider (open/close/toggle/update); marks
                        collider changes; the slab is thin along the wall's thickness (doorways in X or Z walls)
    textures.js         Procedural canvas textures (floor tile, shop sign, shutter, muzzle flash burst, wall-buy chalk). No image files.
                        seededRandom(seed): deterministic random (also used for shelf stock)
  ui/
    settingsMenu.js     createSettingsMenu(settings): builds the options screen from the settings list (tabs, rows per type:
                        checkbox / range + readout / select). Opened by the pause screen's Settings button (controller: Y);
                        Esc / Back / B closes. padNav(input): D-pad moves + changes, A toggles, LB/RB tabs, B back
                        (main.js routes controller input to it while it's open)
    controlsMenu.js     createControlsMenu(): the Controls screen (pause screen > Controls, controller X): tabs Keyboard & mouse /
                        Controller, each as a Diagram (default) or List (controller Y toggles), from `controlsHelp` (config/controls.js:
                        { keys, text, short, anchors }; update it when bindings change) + debug-key hints
    controlsDiagram.js  buildControlsDiagram(device, entries): SVG keyboard + mouse / controller; colored labels placed AROUND the
                        drawing (hand-set `slots` per part in drawKeyboard/drawController: x, y, align end|start|middle) with elbow lines
                        drawn on top to the first of each entry's `anchors` (ids of drawn parts: key names, 'mouse', 'lmb', 'ls', 'rt'...);
                        all anchors get tinted. New part = id + slot there, then list it in controlsHelp
    hud.js              createHud(): 4-line crosshair whose gap = spread cone (dot in ADS) + hit marker (white body, big yellow head, red kill),
                        bottom-left health (white) + stamina (green) bars, bottom-right ammo counter,
                        reload prompt under the crosshair, buy prompt below it (setInteract: "Hold F to open X 500",
                        red cost when unaffordable, shake when denied, hold-progress bar), red hurt edges, click-to-play/paused overlay,
                        "Clocked Out" results screen with Play again (plain DOM). Pause screen: Click to play + Settings (left) /
                        Controls (right) buttons (onOpenSettings/onOpenControls); FPS counter top right (setFpsVisible/setFps);
                        showAnnouncement({ kicker, text }): PA-style banner under the round banner (new zombie types)
```

## How the pieces connect
- `main.js` owns the loop. Every frame starts with `applyLookInput(frameTime)` (mouse + stick look, aim-assist
  slowdown) BEFORE the ticks, so shots/movement in this frame's ticks use where you're looking now.
  `update(dt)` (60Hz): if `game.over` (dead) only zombies/health/death timer run (checked
  first: the mouse is released on death); if not running (pointer unlocked) it freezes the player; otherwise debug
  keys, `player.update`, `interactions.update` (before the gun, so a controller-X hold near a buyable buys instead
  of reloading), `melee.update` (no new swing while switching/vaulting),
  `gun.update(dt, melee.isBusy || player.vault.active)` (after the player so shots use this tick's
  eye), `zombies.update`, `rounds.update` (paused while in the test range), `health.update`, `map.update`,
  `arena.update`, `player.updateView` (recoil springs last, so a shot's kick shows on the very next frame),
  `input.endTick()`. `rounds.start()` happens the first tick the game actually runs.
- Buying: main adds every `map.doors` entry to `interactions` (verb 'open', cost door.price, use = door.open(), which
  opens its zone so zombies start spawning there and the nav grid rebuilds when the shutter's collider goes), and
  every `map.wallBuys` marker whose weapon exists in config/weapons.js (display built + an interactable: "buy
  <Gun> <economy.wallBuys.x.weapon>", or once owned "buy <Gun> ammo <...ammo>"; hidden when its zone is closed or
  you own it with full ammo; use = gun.give(def)). Melee gets `getWeapon: () => gun.weapon` (the gun in hand).
- Map: `main.js` does `loadMap('mall', scene, colliders)` and only uses the map interface (maps/index.js).
  The zombie manager gets `map.spawnPoints` + `isZoneOpen`, so zombies only spawn in opened zones.
- Zombie types: rounds picks each spawn's type (economy.zombieMix) and calls `zombies.spawn(typeId)`; health is
  `zombieHealthFor(typeId, round)`, kill value `economy.killValues[typeId]`. A type's first spawn in a run ->
  `onTypeIntro` -> main shows `zombieTypes[id].introBanner` (hud.showAnnouncement) + plays 'paChime'. Zombie sounds:
  zombie -> ctx.onSound -> manager (dedupe) -> main `sound.play(name, { volume })`.
- Points: gun and melee call `onHit({ target, killed, headshot, melee })` -> `wallet.earn(pointsForHit(...))`.
  HUD: points above the ammo with +N pop-ups, round number top-left (blinks in the break), "ROUND N" banner.
- Death flow: `onPlayerDeath()` sets `game.over`, hides the combat HUD, releases the mouse. Render then runs the
  death camera (drop + roll) and skips the gun pass; after `feel.death.resultsDelay` the results screen shows.
  Play again -> `resetRun()` (zombies, health, run stats, ammo + aim, interactions, viewmodel, effects, melee, player position,
  shutter) -> re-lock.
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
- The game only runs while the pointer is locked; Esc pauses and shows the overlay.
- Collision: one shared flat array `colliders` of `THREE.Box3` (created in main, filled by the map and the
  test range). `box(..., {collide})` in `mall.js`
  makes a mesh and (optionally) a collider; some visuals use `collide:false` with a separate hand-sized
  `addCollider` (pillars, benches). Shutter adds/removes its own collider from the same array.
  Player is a cylinder (radius, height, feet position). Boxes whose top is within `stepTolerance`
  of the feet count as floor, not walls.
- Coordinates: meters, +Y up. Camera looks down -Z at yaw 0.
- Markers (invisible; shown if `debug.showMarkers`): `map.spawnPoints` (10: 2 start-room vents, 4 concourse
  shopfronts, 4 Mega Mart: stockroom, receiving, back vent, emergency exit; each tagged with its zone) and
  `map.wallBuys` (3, with an outward `normal` and a `weapon` id; the Mega Mart one is reserved/inert).

## Map (current)
- Main concourse: x -20..20, z -6..6, 6m ceiling. Four decorative shopfronts (Good Sports, Nuts & Bolts,
  Play Time Toys, Byte Me Electronics), pillars, benches, planters (two flank the Mega Mart entrance), ceiling
  lights. East wall: the Mega Mart entrance (4m shutter, z -2..2) under a MEGA MART sign.
- Start room: x -5..5, z 6..16 (north of concourse), 4m ceiling, checkout counter, shelf, crates, boarded vents.
- 4m doorway at z=6 blocked by a security shutter door (500 in economy.js) that opens the concourse zone.
  Hold **F** (controller: hold **X**) near it to buy it. Debug: press **O** to toggle doors for free.
- Mega Mart: x 20..34, z -24..6, 5m ceiling, behind the 750 shutter. Front: 4 checkout lanes (vaultable counters,
  x 24.5..27.5, 2m lanes, open ends to run round). Back: 3 stocked shelf gondolas (x 24 / 27.5 / 31, z -19.5..-8,
  solid, 2m tall) making 4 aisles (west one 3.2m wide: the future Food Court door goes on that wall), a 4.5m back
  walkway with stockroom/receiving doors + a boarded vent, an emergency exit on the east wall. Brand stripe,
  aisle signs, fluorescent strips (some dead), 2 point lights.
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
(steering only: turning within 90 deg of your travel direction keeps your exact speed; holding the opposite
way still brakes), so slide-jumps keep their momentum. Chain nerf: each chained (landing) slide in a row, incl.
after a vault, starts slower: 10.5 -> 9.2 -> 8.0 -> 6.8 -> 5.8 -> 5.0 -> 4.5 m/s (floor; past ~5 chains it's slower
than walking); a normal sprint slide is always 100%, and 1s on your feet resets the count (`slide.chainSpeed`, `chainResetSeconds`).
Firing while sprinting drops you to a walk: the running pose snaps away (sprintFx.fireBlendOutSpeed), the shot goes
off after `sprint.sprintOutSeconds` (0.08s from a full sprint; the click is buffered), and sprint can't resume until
`sprint.fireBlocksSprintSeconds` (0.3s) after the last pull (player.blockSprint). Crouch/slide tuning is in
`feel.crouch` / `feel.slide`.
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
braking first; arms-overhead wind-up (0.35s in round 1, shrinking to 0.3s by round 9; `zombie.windupSeconds`;
its last `attack.slamSeconds` (0.1) are the slam, landing exactly when the hit is checked)
while stepping straight at you at full speed and turning fast (attack.turnSpeed 12), then a swing that hits for
40 if you're within 1.7m (a bit past the 1.5m start range = the lunge) and in front (3 hits = dead); 0.8s recovery
after a hit, only 0.3s after a miss (no free reset by stepping back). Standing still, strafing or walking up to
one = hit; backing off or jump-backing from a walker only works if you leave the instant its arms go up (or
earlier), never vs a jogger up close; a quick sprint-away (~0.1s reaction) still works. Player moves slower backwards (70%) and sideways (85%), stats.backpedalSpeed/strafeSpeed,
so retreating while shooting costs you; sprinting away still escapes if you react fast. Health regens after 3.5s at
40/s; red screen edges grow with damage, pulse below 40%, flash on hits. Box cutter (V): 150 dmg, lunge, cancels
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
wraps all the way round when you stand still.
Part C done: interaction system (game/interactions.js). Hold F / X for 0.25s near and facing the shutter to buy it
(500): ka-ching, points pop-up, shutter rolls up, concourse zone opens. Not enough points: red cost, shake, buzz.
Controller X near a buyable: tap = reload, hold = buy.
Part D1 done: two weapon slots (COD rules: buying fills the empty slot, else replaces the gun in hand; each gun keeps
its ammo), switching with 1/2, mouse wheel or controller Y (0.18s drop + 0.32s raise, no firing/ADS, cancels
reloads). Price Gun wall buy on the start room's east wall: chalk outline + the gun on pegs; 500 to buy, 250 for
ammo (refills mag + reserve; no prompt when full). Price Gun: full-auto label gun, 25 dmg (x3 head; was 22, buffed after the balance playtest), ~12 shots/s,
24/180, 1.4s reload, bloom grows while held, small pitch + random sideways camera kick, pink sticker flash, its own
model/sounds/reload (swaps the label roll). The staple gun has no ammo refill (by design; maybe an ammo cache later).
Part D2 done (step 4 complete): Nail Gun wall buy on the concourse wall next to Nuts & Bolts (1000, ammo 500; only
offered once the shutter is open). Semi-auto framing nailer: 90 dmg (x3 head), nails pierce up to 3 zombies in a
line (100% / 80% / 60% damage; walls still stop them; +10 points per zombie hit), 10/60, 0.25s between shots, 1.8s
reload, big kick (1.8 deg + sideways wander), tight when you take your time but rushing opens the spread, 28%
zoom in ADS, dust-and-spark flash, pneumatic THUNK + hiss. Round 1: 2 body shots / 1 headshot (one headshot nail
can kill a line of round-1 zombies).

Core movement/combat additions: deliberate momentum vaults and committed box-cutter swings.
- **Vault:** move toward the checkout counter or a concourse bench and press jump (Space / A).
  Only those colliders are marked `vaultable`; crossing the short side must fit `feel.vault.maxDepth`.
  Requires a standing, grounded approach, suitable height/speed, full standing-body clearance and a
  supported, unoccupied landing. Raises before the near edge, crosses above the top, lowers beyond
  the far edge, and exits with the entry horizontal speed (no added speed). Horizontal speed is constant the
  whole way (the rise takes near/speed, min one tick; the drop covers `landingDistance` at full speed), so a
  vault never slows you (measured: sprint 8.00, walk 5.00, slide-in 10.3 m/s in, during and out). C / B during the vault
  queues the existing landing slide. The whole path is checked before starting and again every tick;
  a crowd shove or newly blocked path interrupts it. No invulnerability. The shutter cannot be vaulted.
  The gun lowers, ADS/shooting/reloading/switch input are blocked, and a reload in progress PAUSES
  (gun.update(dt, blocked, reloadPaused) -> weapon.update({ reloadPaused })) and carries on after.
  Forgiving trigger (sprinting/walking at it + jump = vault): a press with a vaultable obstacle on your path
  within `magnetRange` 3m holds (up to `magnetSeconds` 0.4) and vaults once in `reach` (1.7m) instead of
  jumping early; a jump that started < `airGraceSeconds` 0.2 ago still turns into a vault in the air; your
  path can cross up to `maxApproachDegrees` 75 off straight-on, and where you LOOK barely matters
  (`maxLookDegrees` 100); a blocked straight landing tries paths angled `directionSearchDegrees`
  (0, +-12, +-24). From 1.5 m/s. HUD "[Space] Vault" prompt (vault.preview(): the full plan checked from
  where you'll be when in reach) whenever a press would vault. `vault.lastResult` says why the last try failed (or
  "vaulted") for testing in the console. Animation: a speed vault: both legs swing up and out to one side over it (body.js,
  feel.body.vault*), and the view dips/tilts so you see them (controller.syncCamera, feel.vault.camera*;
  visual only, the gun is tucked away anyway).
  Tuning is `feel.vault`; `stats.vaultMaxHeight` and `stats.vaultMomentumRetention` are player modifiers.
- **Committed melee:** V / RB / R3 fixes the attack direction at swing start. Until the 0.15s impact,
  turning is limited to +/-12 degrees and new jumps/slides/steering are blocked (existing motion continues).
  Hit range, target life and walls are rechecked at impact, so a target can evade the slash. Movement returns
  at impact; gunfire/reload/switching/another slash wait until 0.37s on hit or 0.65s on miss. Inputs during
  recovery do not queue another slash. Lunges keep some entry speed on exit (85%, at least the existing
  stationary-lunge carry), end at impact, and use normal collision. Damage and points are unchanged.
  No melee starts during a vault or weapon switch. Teleport/reset clears pending actions.
  Timing/turn limit live in `melee.boxCutter`; entry carry is `stats.meleeLungeMomentumRetention`.
- **Checks:** `npm test` covers vault paths/landings/momentum, interruptions, existing jump/slide behavior,
  melee commitment/hit validation/recovery, weapon blocking, and reset/pause behavior. Browser smoke checks
  also verified the actual counter/three benches, shutter purchase, both wall buys, and a real-zombie lunge.

Settings screen: pause screen > Settings (video: FOV, FPS counter, render scale; mouse: sensitivity, invert Y, slower when
zoomed; controller: look speed, invert Y, deadzone, aim assist; audio: master volume; comfort: head bob, speed lines).
"Reset this tab" restores defaults. Adding more: see config/settings.js.
Health regen nerfed slightly: 3.5s delay (was 3), 40 HP/s (was 50; empty to full ~2.5s).

Step 5 in progress. Done: the Mall Walker (round 4+). A power-walking retiree in a matching tracksuit (stripes,
headband, wristbands, white sneakers, silver hair, maybe a fanny pack), slimmer than a shopper (model + hitbox).
5.4 m/s always (outpaces your walk 5 and backpedal 3.5, not your sprint 8), 65% of the round's health (round 4:
293 vs 450), same 40-damage slam and wind-up, same 60-point kill value. Winded after every swing (hit or miss):
stands bent over panting for 1.2s (no attacks), then follows at half speed for 0.6s: your opening. Squeaky
sneakers + huffing while chasing, panting when winded (louder when close, silent past ~12-14m). Spawn mix: 15% of
spawns from round 4, 25% from 6, 30% from 9 (part of the normal count); in its first round the 3rd spawn is forced
to be one if none came yet, and its first spawn in a run plays the PA chime + "Attention shoppers / Mall Walkers
have entered the building" banner. Debug: Shift+Z spawns one. Verified in the browser (looks, power walk, a real
hit + winded pose, round-4 banner) and by tests/zombies.test.js.

Map expansion planned (before Cart Pusher / Mannequin / shop systems): a ground-floor loop. Mega Mart (east, door
750), Food Court (south, door 1000 from the Mega Mart AND a second 1000 door from the corridor; one zone),
Service Corridor (west, door 1250). Step 1 done (groundwork, no visible change): map kit (world/mapKit.js) + mall
props/palette split out of mall.js (verified identical: same 105 objects, 71 colliders, spawns, wall buys, door, in
the same order); doors can share a zone; the nav grid rebuilds on any marked collider change (count + version).
Step 2 done: the Mega Mart + its 750 door (see Map). Verified: tests/mall.test.js (sealed until bought, all 4 spawns +
every aisle reachable after, reset seals it again), and in the browser (entrance + shutter look right, a real F-hold
is refused at 500 points and buys at 750, the player walks in, zombies from all 3 back spawns reach the front in
~8s and from the far concourse in ~12s). Next: step 3 = Food Court + its 1000 door from the Mega Mart.

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
