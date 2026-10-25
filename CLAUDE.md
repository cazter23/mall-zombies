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
npm install        # once
npm test           # gameplay regressions (Node's built-in test runner)
npm run dev        # Vite dev server (hot reload)
npm run build      # production build into dist/; run after every change to catch errors
npm run preview    # serve the built dist/
npm run build:single  # dist-single/sunset-galleria.html: the WHOLE game in one file (double-click it; no server, no Node, no internet)
npm run balance    # gun balance report (tools/gunReport.mjs): dps by range, pulls to kill by round, cannon blast table
```
Menu regressions: `tests/menus.test.js` covers modal inert/focus isolation, Tab/Escape, controller presets including
equal/custom values, reset buttons/confirmation and native-resolution readout. `tests/blood.test.js` also changes
splatter while paused, clearing flesh effects/pools immediately without removing dust or tracers.
`tests/retailUi.test.js` covers PA message priority, duplicates, bounded queues/cancellation, real purchase-ticket shortages,
sale/base prices, weapon/ammo distinctions, attachment replacement/tradeoff text and warranty transitions.
`tests/haptics.test.js` covers distinct gun pulses (including every dart in a real burst), damage priority, pickups,
intensity/off, unsupported/rejected actuator APIs, legacy pulse fallback, gamepad snapshots/unplug, focus/pause/death/reset
cleanup and keyboard suppression. Settings -> Controller -> Controller vibration is saved with the other settings.
`tests/prone.test.js` covers toggle controls, crawl speed from stats, smooth eye/collision lowering, low roofs,
safe stand/crouch recovery, slide/jump/melee/vault constraints, gun use, zombie damage, body clearance, controller sprint latch and run reset.
`tests/shopperAppearance.test.js` covers coordinated wardrobe choices and rarity, every clothing/hair/accessory/wear variant,
valid geometry and mesh budgets, animation, isolated hit flashes, owned-resource disposal, fixed hitboxes and unchanged Mall Walkers.
`tests/atmosphere.test.js` checks decorative triangles against protected routes/vaults and the escalator ceiling well,
zero added collision, batching/motion reset, interpolated supporting-surface shadows and disposal, spatial sound
occlusion/zones/panning/caps, pause/death/reset silence, closed-shutter rattles and Web Audio voice cleanup.
`tests/atriumDetails.test.js` checks the new authored atrium triangles against the fountain lap, all entrances/vents,
upper-ring walking lanes and the escalator; zero added collision/lights, varied displays/stock, geometry/batching budgets,
resource disposal, ripple/mobile animation/reset/settings and the fountain's existing spatial-ambience path.
`tests/shutters.test.js` checks both wall axes/upstairs, fixed frame clearance, physical slat pitch/UV cropping, original
collision timing/reversal/reset, finishes/aspects, static batching/disposal, real F purchases and motor/roll/stop sounds
(pause freezes progress; death/reset cancel; debug open-all is silent), and unobscured low destination signs.
`tests/promenade.test.js` checks independent upper-floor expansion/support, the widened southern route, sealed future
connections, a real two-entrance shoe-store loop in both directions, momentum vaults and live zombie entry paths.
`tests/careerStats.test.js` checks persistent lifetime totals, weighted accuracy, personal bests, bounded recent runs,
debug-run exclusion, reset, corrupt saves and unavailable browser storage.
`tests/music.test.js` also covers the End of Shift death sting: receipt-timed bell, music volume, cancellation of future
notes, replacement-voice cleanup, and real-game death/reset wiring.
`tests/powerUps.test.js` checks earned incentive thresholds, skill credit, single drops, caps/repeats, expiry, safe floor/ramp
placement, swept slide collection, wall/storey rejection, Blue Light payouts/timers, reserve delivery without bypassing
reloads/upgrades, Security Sweep through all zombie attack/charge states, visuals/disposal and HUD. fullRun.test.js also
earns and collects a drop with production tuning, then checks Play again cleanup.

Gameplay regression tests live in `tests/` (`gameplay.test.js` movement/melee/vault, `aim.test.js` spread
(including the Laser Pointer's hip benefit / ADS penalty through repeated shots and recovery),
`impactMarks.test.js` all six cosmetic signatures, visible-surface/edge checks, floor/ceiling/instanced normals,
misses/targets/pierce/shutters, shared cap/reuse/disposal, map unloading, startup preparation, debug sprites,
Cannon projection budget, unchanged wall-shot payouts/accuracy/ammo and Play-again cleanup,
`startRoom.test.js` clearance-store dressing adds no collision, leaves central/spawn/vault spaces visually clear,
and preserves a real checkout vault and the original Price Gun purchase,
`megaMartDetails.test.js` protects aisle/crossing/entrance/spawn/vault clearance against the actual decorative triangles,
validates geometry and trolley placement, and vaults all four checkouts plus buys the Foam Dart Blaster at its original price,
`zombies.test.js` zombie types/mix/rounds, `maps.test.js` wall pieces, single/multi-zone shared doors, nav rebuilds,
`mall.test.js` the REAL mall built in Node with a stub canvas: dispose leaves no colliders + frees everything, door ladder, spawn points on clear floor, zones
sealed until any connecting door is bought (all 120 orders after the start shutter), shortcut-only entrances,
short nav paths and standing-player crossings in both directions, clear approaches, vaultable counters, the sealed escalator (a real PlayerController sprint-jumping
at it never gets on; you can walk under its high end), the ceiling hole, Food Court stalls/tables (queue spots and
table lanes reachable, nobody gets onto or behind a counter), `corridor.test.js` the modular corridor builder (floors
never overlap, walls never intrude into the walkway, sealed except where asked, doorways/gaps/open ends/branches, a real
nav grid end to end and through a branch doorway), `interactions.test.js` buying against the real mall (every door and wall buy
works from where you stand, both shortcuts buy from either side but not through adjacent walls, the cannon cannot be
bought across its shortcut, the Nail Gun can't be bought through its wall, other floors are out of reach, facing matters),
`ammoCache.test.js` the vending machine (refills any gun in hand, flat price, label follows the gun, needs its area open, not
through the wall, solid + too tall to climb, zombies can reach its front), `balance.test.js` GUN ROLES on real measured numbers
(cannon strongest up close / weakest at range, Price Gun competitive within 10% of premium Foam at 5 m but beaten at 30 m, Foam Dart Blaster best
non-shotgun at 15 m, Nail Gun clearly best at 30 m (15%+), Staple Gun weakest at every range; relationships, not exact values), `gunStats.test.js` the per-hit formula + resolveGun (upgrades as data),
`fullRun.test.js` WHOLE RUNS of the real game headless (tests/helpers/headlessGame.js builds createGame with stand-in HUD/sound/
viewmodel: buy the shutter, rounds, shoot a zombie for exact payouts, die, results, and "Play again equals a freshly built game"
via snapshot(), which covers every stat incl. undeclared extras, run stats, features, prompt and reload; zombies keep walking
after you die; a natural round 1 -> 2; buy Food Court then its shortcut with real F holds and see natural Mega Mart spawns
while its hallway door stays shut; resetPlayerStats). New cross-system behaviour should get a full-run test there), `events.test.js` the event bus + every payout path
in the real game (body / headshot / box-cutter kills, a shotgun blast pays once per zombie, a non-player "hazard" kill still pays
and counts, purchase / round / player-hit / death / Play-again events, purchase kind/label as it was BEFORE buying, a kill
listener killing another zombie mid-shot pays each once (no +10 for a corpse), pierce/pellet multi-kills, dummies pay nothing,
nothing paid or counted after death), `pricing.test.js` prices = config exactly, discounts
(one category, rounded to economy.discountRoundTo, errors for unknown items incl. inherited names like toString), the real game
charges + shows the sale price for doors, guns, ammo and the cache, a sale starting mid-hold charges the price at completion, a new run clears it),
`upgrades.test.js` gun upgrades (tiers + attachments on every gun, whole magazines/bursts, each tier holds until its round,
one attachment per slot, what fits, roles hold at every tier (near-ties within 3%) and with any one attachment, upgrades live
with the carried gun in the real game), `upgradeDesk.test.js` the Customer Service desk in the real game/mall (one desk in the hallway, LAYOUT.serviceDesk moves
prop + collider + buy spot, solid and too tall to climb, tiers one at a time at pricing's price, gun in hand only, no refill,
nothing past Platinum (including the exact purchase frame and switching back to a Platinum gun), Flash Sale applies,
no prompt while closed / switching / facing away, Play again resets),
`attachmentCounter.test.js` the store counters in the real game/mall (every attachment at its store, real F buys fit the gun in
hand + replace its slot at pricing's price, no prompt when fitted / doesn't fit / area closed / mid switch, cases solid + too tall,
visible glass matches bullet collision, the four stores are real rooms (walls, solid wall-to-wall counter so nobody reaches the
clerk strip, windows are glass, you can walk in), a LAYOUT.stores entry moves a whole store),
`coplanar.test.js` no z-fighting (flicker) in the stores or the Customer Service booth: builds the real mall and checks every box face and
sign in those rooms for another face within 4 mm that faces the same way, overlaps and looks different (hidden faces pressed against a
solid are fine); run it after adding anything to a store (hang things on a wall 2cm+ proud, not on its plane),
`viewmodel.test.js` real player-gun/model recoil with attachments, including firing and dry-clicking immediately after fitting/removing one
before rendering, `weaponModels.test.js` also checks upgrade parts (every gun has every
mount, parts show only when fitted, the Extended Nozzle moves the muzzle + flash and back, tier sticker hidden at Standard, no part
floats), `features.test.js` map features (the mall's list, unknown kind = error, a new kind's update/reset hooks run, inert wall buy for a
gun that doesn't exist, inherited names aren't kinds, features get the game's systems and tick only while playing (not paused /
dead) + reset on Play again, buy a wall gun + refill at the RESTOCK-O-MATIC in the real game);
`spawning.test.js` covers local selection/safety/cooldowns/rescues plus the real mall at six positions with hallway
entrances only, shortcut entrances only, and both loops open. Mall tests also include the real debug range: shifting
grid bounds must not disconnect either shortcut; floor covers both shared walls. The Mart sign clears its brand stripes.
there is no linter yet.
`npm run build` is the compile check (it only bundles; it
does not run the game, so also try changes in `npm run dev`).

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

## Folder structure
```
index.html              Entry page; loads /src/main.js and the Bungee Google Font
package.json            scripts: dev / build / preview
src/
  main.js               Entry, BROWSER SIDE ONLY: renderer, scene, camera, Input + gamepad, HUD, sound, viewmodel, player body,
                        settings/controls menus, controller menus (handleControllerMenus), pointer lock, debug keys
                        (handleDebugKeys, run by the game each live tick), look input, render(alpha) + the death camera.
                        Its tick = gamepad.poll + controller menus + g.update(dt). Exposes window.__mall (same names as
                        before, plus `g` = the game) when debug.exposeToWindow
  style.css             HUD (crosshair, hit marker, health/stamina bars, ammo, prompt), start/pause overlay
  ui/retail.css         Retail presentation layer loaded after style.css: mall directory, distinct combat signs,
                        shelf tickets, personnel paperwork, facilities settings and handbook. Responsive + reduced motion.
  config/ui.js          Presentation timing, PA queue limit and brief weapon-role copy (no gameplay tuning)
  ui/announcements.js   Bounded PA queue: type introductions priority 2, incentives 1, routine messages 0;
                        clear on pause/death/reset; wall-clock presentation timers only
  config/
    haptics.js          Controller vibration intensity and per-gun/damage/pickup durations, motor strengths and priorities
    deathMusic.js       End of Shift: original seven-second death composition (piano/pad/bell/noise layers), gain and
                        stop fade. Bell anchors to feel.death.resultsDelay; played once through sound's music/master buses
    powerUps.js         Employee-incentive drop tuning, skill credit, round caps, pickup/zone durations, ammo top-up,
                        sweep strength, colors and PA lines. First round 2, 12-16 credit per drop, maximum 3 per round
    shoppers.js         Cosmetic-only Shopper wardrobe: coordinated palettes/profiles, shirts/layers, bottoms, hair,
                        modest width variations, accessories and wear. Parts are data; combat never reads this file.
    impacts.js          Cosmetic impact cap (200), Cannon budget (2 clusters), projection/edge tolerances and gun signatures
    environment.js      Cosmetic mall lighting/materials, ceiling spacing, subtle local motion, contact shadows,
                        ambient voice/distance/occlusion/fade tuning; fixed start-room and Mega Mart lamps
    feel.js             Movement, sprint, crouch, slide, prone, look (+ recoil spring: frequency/damping, roll), ADS
                        (move speed, sensitivity), camera, player size, sim tick rate, shutter speed, viewmodel
                        handling shared by all guns (fov, sway, walk bob, breathing, landing dip, reload
                        blend-out, dry-fire kick, box cutter slash path), hit effects, crosshair min gap,
                        body (colors + leg/pose tuning), health (regen, hurt edges), death camera, sprintFx,
                        weaponSwitch (lower/raise time, drop), interact (hold time, range, facing angle, denied
                        flash), world.wallBuyDisplay, melee lunge end
    economy.js          Points, payouts, kill values, door prices (startShutter 500, megaMart 750, foodCourt 1000,
                        serviceCorridor 1250, foodCourtMegaMart 1000, serviceCorridorFoodCourt 1250) +
                        wall-buy prices, ammoCache.price (400, flat, any gun), round timing, wave scaling + helpers
                        (zombieHealthForRound, zombieCountForRound, spawnDelayForRound, maxAliveForRound).
                        zombieMix: special types per round (mallWalker: from round 4, share 15% / 25% from 6 / 30% from 9,
                        healthMultiplier 0.65, introSpawnIndex) + zombieHealthFor(typeId, round), zombieTypeForRound(round)
    weapons.js          stapleGun (start pistol, semi), priceGun (wall buy, full auto), nailGun (wall buy, semi,
                        piercing: `pierce: { maxTargets, damageFalloff }`), foamDartBlaster (Mega Mart, burst),
                        confettiCannon (Service Corridor, 12 pellets, pellets pierce 2 zombies, six-shell tube, shell-by-shell
                        `shellReload`), rivetRifle (Grand Atrium wall buy 1500), coilNailer (Sunset Promenade wall buy 1250), barcodeScanner (Byte Me wall buy 1750; `fireMode: 'charge'`).
                        Optional `falloff: { start, end, minMultiplier }` on ANY gun (distance damage; every gun except
                        the Nail Gun has one). Each gun's ROLE is written above its entry. Per-weapon stats (fireMode
                        'semi' | 'auto' | 'burst', damage, headshot mult, mag, reserve (= max for ammo buys), fire interval, reload, spread
                        cone, ADS time/zoom/gun offset + optional moveSpeedMultiplier applied on top of stats.adsMoveSpeed),
                        recoil (camera pitch/yaw/roll + gun-model kick + spring),
                        muzzleFlash (size, colors, ADS shape, lights), sounds, viewmodel (model name, hip
                        offset/angles, colors, trigger anim, reload keyframes gunKeys/handKeys + timed events
                        with sounds/jolts), `melee.boxCutter` (damage, reach, cone, swing timing, lunge),
                        weaponStatDefaults for stats
    upgrades.js         GUN UPGRADES as effects (not stat paths): Extended Warranty `tiers` (standard / deluxe x1.4 dmg
                        +15% mag / premium x2.1 +15% mag -10% reload / platinum x3.5 +30% mag -20% reload; color,
                        holdsUntilRound) and store `attachments` (one per slot: barrel extendedNozzle|sawnOff, sight
                        laserPointer|zoomLens, grip gripTape|wristband, magazine jumboPack|speedLoader; effects + blurb;
                        sawnOff.falloffIfNone). Effect list in its header. Prices: economy.upgrades
    audio.js            Master volume, pitch variation, compressor, and sound recipes (layers of filtered noise
                        bursts and tones): staple / price / nail / foam / confetti gun shots and reloads, dry click, purchase, denied,
                        Mall Walker walkerSqueak / walkerHuff / walkerPant, paChime (announcements)
    zombies.js          zombieTypes (per-type speed, size, hitboxes, attack, timings, colors, splatter): `shopper`, and
                        `mallWalker` = { ...shopper, overrides } (speed 5.4 no gaits, modelScale + slimmer hitbox, winded,
                        powerWalk walkAnimation + windedAnimation, tracksuit `outfit`, introBanner, sounds). zombieCrowd
                        (spacing, lanes, queueing, surround rings + sector/still-wrap/circling, contact gap,
                        spawn dust, min spawn distance, soundMinGapSeconds),
                        zombieSpawn (local route-cost neighbourhood, nearest/random mix, body clearance + marker cooldown),
                        zombieNav (grid, soft wall clearance + wall penalty), zombieFailsafe (stuck-zombie rescue)
    controls.js         bindings (action -> keyboard/mouse + Pad* codes; interact = F / X; switchWeapon = wheel / Y,
                        weapon1/weapon2 = 1/2; menu-only: settings = Y, controlsScreen = X on the pause screen), buttonLabels
                        (prompts per device), controlsHelp (what the Controls screen shows; keep in sync with bindings),
                        gamepad (deadzones, look speed/curve, turn ramp, triggers, click-to-sprint release),
                        aimAssist (strength dial, range/cone, slowdown, rotational, ADS snap)
    settings.js         THE LIST of player settings (options menu): { id, tab, label, type toggle|slider|select, default,
                        min/max/step, format, apply(value, ctx) }. Most apply() functions write into the config objects the
                        game reads every frame (feel, controls, audio). New setting = one entry here (new tab = add to settingsTabs)
    debug.js            THE DEBUG KEYS as a table (`commands`: id, key, shift, group, label; keys must not clash with gameplay
                        bindings: tests check) + enabled (master switch), showMarkers, testArena, addPointsAmount, jumpRounds, panel,
                        dummies, exposeToWindow, keyLabel(). They work in a normal game (no debug mode): Z spawn the selected
                        zombie / Shift+Z next type / X clear / K kill all (pays), N next round / Shift+N +5 rounds / L Flash Sale,
                        P +5000 / ' points to 0, G god mode / H next wall gun / U free tier, O all doors / T test range / Shift+T Level 2, ` window
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
    controller.js       PlayerController: WASD, jump (buffer + coyote time), sprint meter, crouch/slide/prone
                        (stance: stand|crouch|slide|prone), gravity, mouse look (per render frame), camera interpolation.
                        View recoil: kickSpring (pitch, part of the aim; `viewKick` getter) + rollSpring (visual
                        only) + yawKickSpring (sideways, part of the aim; `viewKickYaw`). addRecoil(pitch, roll, yaw)
                        for shots, addViewKick() for instant jolts (hits, melee),
                        updateView(dt) at the END of each tick; syncCamera interpolates both
    vault.js            Opt-in low-obstacle vault: jump on approach, full-cylinder path/headroom/landing
                        checks (including live shootables), entry momentum on exit, interrupt on crowd shove
    stats.js            createPlayerStats(): the single stats object (health, speeds, jump, sprint, crouch/slide/prone,
                        regenDelay/regenRate, adsMoveSpeed, damageMultiplier, meleeDamageMultiplier,
                        reloadSpeed); resetPlayerStats(stats) puts every stat back to base (same object) on a new run and DELETES
                        anything not declared in createPlayerStats() (so a new stat must be declared there with its default)
    health.js           createPlayerHealth(): takeDamage, regen after a delay, `overlay` strength for the red
                        hurt edges (grows with damage, pulses when low, flashes on hit), calls onDeath once
    body.js             createPlayerBody(): first-person legs + lower torso in the world scene (visual only).
                        Tapered faceted waist/pelvis, belt buckle, tapered thighs/shins and faceted sneakers with tongue accent.
                        Hip height follows eye height; feet posed for walk cycle / slide (V) / air tuck, knees
                        solved with two-bone IK. Exports placeLimb()/makeBoxMesh()/makeFacetedLimbMesh()/buildDeformedBoxGeometry() (also used for the arms)
  weapons/
    weapon.js           Weapon class: ammo, fire cooldown + click buffer, reload. Pure state; update({ triggerPressed,
                        triggerHeld, reloadPressed, blocked }) returns 'fire' | 'empty' | null. fireMode 'auto' fires
                        while held (dry-clicks only on a fresh press; runs dry while held = reloads itself).
                        fireMode 'burst' starts 3 darts on one press (holding never repeats); reload requests queue
                        until the burst finishes. `blocked` / switching / reset / refill abort pending darts and input.
                        Guns with `shellReload` (Confetti Cannon) reload in phases (start -> one shell per cycle -> end);
                        the trigger interrupts that reload once magazine > 0 (normal guns can't fire mid-reload).
                        The cooldown carries the leftover fraction
                        of a tick into a queued next shot (real rate = fireInterval). refill(), isFull (ammo buys)
    aim.js              createAim(): ADS state (eased 0..1, blocks sprint, sprint cancels it) and hip-fire
                        spread (base + moving + airborne, smoothed, + per-shot bloom; x adsMultiplier).
                        Bloom recovers after spread.bloomRecoveryDelay (0.15s after the latest shot per gun),
                        so sustained fire builds spread; recovery then uses the existing bloomRecovery rate.
                        applySpread() picks a random direction inside the cone; applyConeSpread() also samples pellets;
                        pelletSpreadDegrees() blends their independent ADS cone. reset() (new run: hip, base spread).
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
    upgrades.js         Upgrades -> mods (pure): withTier(base, mods, tierId) / withAttachment(base, mods, id) return a NEW
                        mod list (mod ids 'tier' and 'attachment:<slot>'; other mods such as Build-A-Blaster untouched),
                        tierOf / nextTier / attachmentsOf read them back, attachmentFits(base, id) (Extended Nozzle doesn't
                        fit the Nail Gun). EFFECTS turns each effect into this gun's stat changes (shell-by-shell reload
                        phases, pellet cones, hip spread that leaves aimed accuracy alone). Apply: gun.setMods(id, ...)
    gunStats.js         THE gun maths: damageFalloff(distance, falloff), hitDamage(def, hit, index, stats) (damage x head x falloff x
                        pierce x player multiplier; the only place it's computed), resolveGun(base, mods) (upgrades as data:
                        { id, modifiers: [{ stat: 'falloff.start', op: 'set'|'add'|'mul', value }] }; set, then adds, then muls;
                        a bad stat path throws; counts (magazine, reserve, pellets...) are rounded whole after mods, a burst
                        gun's magazine to whole bursts; returns a copy with .base/.mods (ids)/.modList (the mods themselves)). Layers: base config -> mods -> player stats -> per hit
    playerGun.js        createPlayerGun(): the LOADOUT (2 slots, each { base, mods, def = resolveGun(base, mods), weapon, aim }); gameplay
                        reads slot.def. setMods(id, mods) re-resolves a carried gun (the Build-A-Blaster hook: weapon.setDef + aim.setDef,
                        ammo kept/clipped), modsFor(id); mods survive ammo buys, not replacement or a new run. Glue for the gun in hand
                        (`weapon`, `aim`, `def` getters). give(def): owned = refill; free slot = add + switch to it;
                        full = replace the gun in hand. Switching (switchWeapon / weapon1 / weapon2): the old gun drops
                        (shownDef, switchLower for the viewmodel), the new one rises; no shooting/aiming meanwhile;
                        cancels reloads. owns(id), weaponFor(id), requestReload(). Reads fire (press + held)/reload, onShot cb,
                        fires hitscan inside the spread cone, applies damage to every hit
                        (headshot x mult x pierce/distance falloff x stats.damageMultiplier). Pellets cast all rays before
                        damage; points/splatter once per zombie, killing pellet decides the head bonus, one hit marker,
                        max 4 wall puffs, one recoil/flash/sound/run-stat shot. Pellets can also pierce (`pierce` on a pellet gun): each pellet
                        goes through up to maxTargets zombies, damage = distance falloff x pierce falloff.
                        Same tick as the shot: player.addRecoil
                        (scaled by ADS), viewmodel.fire (gun kick + flash), shot sound, tracer, splatter, hit
                        marker. 'empty' -> viewmodel.dryFire + dry click. Runs viewmodel.reload.events as the
                        reload clock passes them (sound + viewmodel.jolt), so sounds match the animation
    viewmodel.js        Shared first-person rig in its own scene + own fixed-FOV camera (drawn after the world
                        with depth cleared). createViewmodel(allWeaponDefs, meleeDef) builds every gun's model up
                        front (only the shown one visible; one shared hand light + world light that each gun's
                        flash recolors, so lights never come and go), attaches each muzzle flash,
                        and adds up layers on a `holder` each frame: hip->ADS rest pose, reload pose
                        (gunKeys; eases out if cancelled), recoil springs (kickPos/kickRot: fire(aimAmount, resolvedDef), dryFire(resolvedDef),
                        jolt()), turn sway, walk bob ("smile"), breathing, landing dip, sprint pose, melee
                        (box cutter arm slashes while the gun drops aside). Re-resolved stats update on the same model without
                        resetting its animation; fire/dryFire also sync stats before the next rendered frame. Wiggles scale way down in ADS.
                        update(frameTime, camera, { weapon, shownDef, switchLower, aimAmount, meleeProgress, player }); `worldLight`
                        (added to the world scene by main); getMuzzleWorldPosition(); reset()
    models/             First-person weapon models. index.js = registry (viewmodel.model -> { model, display }
                        builders) + the model interface ({ root, muzzle, animate({ sinceFire, reloadProgress,
                        reloadWeight }), leftHandVisible }); buildWeaponDisplay(def) = the gun alone (wall buys).
                        arms.js = shared faceted first-person hands & arms (buildPistolArms -> leftArm, buildCuffedArmSegment):
                        shaped palms, distinct thumbs, readable right trigger finger + 3 grouped lower grip fingers, 4 curled
                        support fingers, tapered 8-sided forearms, polo sleeves with ribbed crimson cuffs and cream tipping stripes.
                        stapleGun.js = office heavy-duty tacker (faceted stamped-steel housing, hinged upper compression lever with
                        rubber palm pad, full-length chrome staple channel + animated rear spring-pusher rod, side staple window,
                        STAPLE-PRO T50 sticker). priceGun.js = supermarket price tagger (sloped housing, exposed red-bordered sticker
                        roll + visible feed ribbon, price-band dial, ink feed roller, emerging "$9.99" label, enclosed trigger guard,
                        PRICEMASTER plaque, roll/roller/sticker feed motion when firing). nailGun.js = pneumatic framing nailer
                        (cylindrical rear piston tower + bolted exhaust cap, exhaust vents, CAUTION 120 PSI decal, reciprocating
                        driver nose with brass serrated safety contact foot, steeply angled magazine with visible collated nails,
                        brass quick-connect air fitting + hose stub). foamDartBlaster.js = blue/yellow toy blaster (faceted clamshell
                        receiver with parting seam & screw bosses, ribbed foregrip, shaped skeletonized stock with orange buttpad,
                        FOAM STORM · AGES 8-80 plaque, indexing rotary dart drum). rivetRifle.js = teal industrial automatic rifle.
                        coilNailer.js = heavy automatic pneumatic coil nailer with round wire-collated drum. barcodeScanner.js =
                        charge-beam retail laser scanner with capacitor coils and Li-Ion battery pack. confettiCannon.js = pink/purple
                        double barrels, gold rims, PARTY POP! stock label and striped shells; hinge open, a shell per cycle, snap shut.
                        Each model also returns `mounts` (barrel / top / side / grip / magazine / sticker: where upgrade parts go).
                        upgradeParts.js = what upgrades LOOK like: buildAttachmentPart(id, mount) (mounting brackets/adapters on universal
                        parts, weapon-suited Jumbo Pack reservoirs/drums/packs via mount.gunId, Speed Loader cam latch + ribbed finger loop,
                        terrycloth wristband with woven tag) and createUpgradeVisuals(model): every part + a branded Extended Warranty service
                        seal built up front (hidden), show({ tier, attachments }) per frame; the Extended Nozzle moves the muzzle (and flash) to its tip.
                        New gun = new file + 1 line (+ its mounts)
    muzzleFlash.js      createMuzzleFlash(cfg): 2 sprites (normal-blended orange burst + additive core, random
                        twist/size), hand light + world light (always in the scene at 0 so no shader recompile).
                        Always depth-tested (the hands and gun hide whatever part of the burst is behind them),
                        sits 9cm in front of the muzzle so it shows past the left hand at the hip; in ADS it
                        goes wide/flat so the rays poke out around the gun, below the crosshair
  zombies/
    navigation.js       createNavigation(colliders, agent, { floors, links }): flow field on a 0.5m grid built from colliders, one LAYER per floor
                        (floors = their walking heights, default [0]: walkable where a box top sits at that height, blocked by anything solid
                        between ankle and head above it) joined by LINKS (a ramp/stairs: { lower: {x,z,floor}, upper: {x,z,floor}, halfWidth }):
                        in the field a link is one extra edge between its end cells; a mover ON a ramp (within zombieNav.rampTolerance of its
                        surface) walks to whichever end is closer to the player (or straight at a player on the same ramp); at a ramp's foot it
                        walks in when the route goes that way. layerOf(y), rampAt(x,y,z); distanceToTarget / isWalkableAt / clearLine take
                        an optional floor height y. Single-floor maps are unchanged. (Ground-floor description:) flow field on a 0.5m grid (floor =
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
    shopperAppearance.js  Weighted, coordinated Shopper wardrobe selection; optional seeded random for tests, one look per spawn
    cartModel.js        buildCart(cfg, mat): the Cart Pusher's shopping cart (wire basket, chassis, casters, red handle, shopping
                        inside), merged by material; on the model's root so it stays upright when the zombie dies
    zombieModel.js      Faceted low-poly zombie model built from the type: Shopper (config/shoppers.js wardrobe + 5 cartoon-undead
                        face profiles: sunkenEyes, offsetJaw, droopingEyelid, retailSmile, discolored), Mall Walker (type.outfit:
                        matching tracksuit + stripes, headband, wristbands, fanny pack; modelScale) or Cart Pusher. Shared indexed
                        ANATOMY_GEOMETRIES (faceted cranium + tapered jaw + brow/ears, V-tapered torso with shoulder caps, tapered
                        limbs, faceted shoes and recognizable hands with palm/fingers/thumb) batch per bone across all zombie types.
                        Also exports buildClerkFigure(apronColor, mat) for static store/service-booth clerks with isolated cloned
                        geometries so map disposal never touches live zombie singletons.
                        Arms have shoulder + elbow joints. Code animation (numbers in zombieTypes.<type>.walkAnimation):
                        shamble or style 'powerWalk' (bent arms pumping, hips twisting), arms-overhead wind-up, slam,
                        recovery, winded pose (bent over, hands at knees, breathing), flinch/flash, rise from floor, tip over and sink
    zombieManager.js    createZombieManager(): spawn(typeId) (open + reachable spawn points >= minSpawnDistance horizontally
                        away, clear of live bodies including risers; local pool <= cheapest eligible route cost + 30;
                        50% nearest 4 / 50% random local, prefer markers off their 3s reuse cooldown; returns null if none
                        safe, the round waits; health = zombieHealthFor(typeId, round)), onSound option (zombie
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
    pricing.js          createPricing(): priceOf('door'|'weapon'|'ammo'|'ammoCache'|'tier'|'attachment', id) = economy.js base price with any
                        discount applied (setDiscount(category, 0..1), rounded to the nearest economy.discountRoundTo (10); discountOf; reset() on a new
                        run). Unknown category/id throws. PRICE_CATEGORIES
    events.js           createEvents(): tiny synchronous bus (on -> unsubscribe fn, emit, count). The event list + payloads
                        are in its header: shot, hit (player attack hit; +10 if not lethal), kill (any zombie death, with
                        headshot / melee / source: 'gun' | 'melee' | future 'hazard'...; ALL kill payouts + kill stats),
                        playerHit, playerDeath, runEnd ({ summary }, one immutable final snapshot), roundStart, typeIntro,
                        purchase ({ label, cost, kind, id }, read before use()), runReset. 'shot' = one per staple / sticker / nail / dart / whole blast
    createGame.js       createGame({ scene, camera, input, hud, sound, viewmodel, mapId, buildTestRange, debugTick,
                        onPlayerDeath }): builds and wires EVERY gameplay system (map, stats, player, wallet, run stats,
                        effects, aim assist, gun, buyables, melee, health, zombies, rounds), owns update(dt) (the fixed tick,
                        in the order below), resetRun() (Play again: walks ONE ordered `resetSteps` list; a new system with
                        per-run state = one line there), onPlayerDeath, showResults, state { forceRun, over,
                        padPlaying, assisted, running }, death (including the frozen run summary), vaultPromptVisible.
                        No DOM: the browser parts are passed in
    careerStats.js      createCareerStats({ storage }): versioned persistent employee record with lifetime totals,
                        personal bests and the last 12 completed shifts. Assisted/debug runs are rejected; storage
                        failures fall back to memory. main.js supplies localStorage and records the runEnd event
    settings.js         createSettings(ctx): current value of every setting, saved in localStorage ('mallZombies.settings',
                        values are sanitized on load), applies them all at startup; get/set/reset(tab)/onChange. ctx = { renderer, sound, hud }
    runStats.js         createRunStats(): time alive, kills, headshot/melee kills, shots fired/hit, accuracy
    powerUps.js         createPowerUps(): listens to kill/round/death events; earned dynamic pickups on clear floor,
                        swept walk-through collection, 15s expiry, no repeats, per-round caps. Blue Light multiplies only
                        base kill credit, within its 4m radius, same floor and line of sight. reset/dispose; debugDrop(id, at)
                        marks the run assisted. createGame builds/ticks/resets it; exposed as g.powerUps
    wallet.js           createWallet(): points (start 500), earn/spend/canAfford, totalEarned, totalSpent, onChange cb (HUD
                        pop-ups). pointsForHit(): COD payouts (+10 hit; kill value +40 head / +70 melee; zombies only)
    interactions.js     createInteractions(): buyables (doors now, wall buys next). add({ label, verb, cost, position,
                        available(), use() }). Each tick: nearest available item within feel.interact.range and
                        roughly faced, in 3D range of the EYE and in plain sight (a ray vs the colliders; an item's `seeThrough` boxes, e.g. a door's own
                        shutter, don't block) = focus; holding interact for holdSeconds (hold must START while focused) spends
                        and calls use(), else red prompt + 'denied'. Buttons bound to both interact and reload
                        (controller X): the press is hidden from the gun near a buyable; let go before it buys =
                        onReloadTap (gun.requestReload()). `prompt` for the HUD; reset()
    features/           MAP FEATURES by kind. index.js = the registry (kind -> build(feature, ctx) returning optional
                        { update(dt), reset() }), buildFeatures(map, ctx) (unknown kind throws; createGame ticks/resets them),
                        featuresOf(map, kind), FEATURE_KINDS (own entries only). Built AFTER createGame's core event wiring (payouts/stats
                        listen first) with ctx = { scene, map, events, pricing, interactions, gun, player, stats, wallet,
                        health, zombies, rounds, state } (g.features.context). Ticked after map.update, only while playing.
                        wallBuy.js = chalk display + "buy <Gun>" / "<Gun> ammo" prompt (g.pricing weapon/ammo; inert for a gun
                        that doesn't exist yet). ammoCache.js = buildAmmoCache + ammoCacheItem({ cache, zones, gun, price }): the
                        RESTOCK-O-MATIC item: label "Ammo · <gun in hand>", available when its zone is open and the gun in hand
                        isn't full, use = gun.weapon.refill() (mag + reserve, ANY gun incl. the staple gun). upgradeDesk.js = Customer Service:
                        "upgrade <Gun> → <next tier>" (g.pricing 'tier', purchase kind 'tier'), gun in hand only, not while
                        switching, nothing past Platinum, NO ammo refill (the bigger magazine fills on the next reload/buy).
                        attachmentCounter.js = one attachment on a store counter: "fit <Attachment> on the <Gun> · <blurb>"
                        (g.pricing 'attachment', purchase kind 'attachment'), replaces that slot on the gun in hand; no prompt when
                        already fitted, when it doesn't fit (Extended Nozzle on the Nail Gun), area closed or mid switch
    debugCommands.js    createDebugCommands(game parts): the debug shortcuts as functions run(id) (spawn, cycleZombie, clearZombies,
                        killZombies, nextRound, jumpRounds, flashSale, addPoints, zeroPoints, god, giveGun, upgradeGun, doors, arena, panel);
                        resolve(code, shift), status(). g.debug. A new command = a table entry in config/debug.js + a function here.
                        God mode is health.invulnerable; debug state is not part of a run (Play again keeps it)
    rounds.js           createRounds(): announce(n, delay) flips the round number (and fires onRoundStart) the
                        moment the last zombie dies, then 'break' (6s, inBreak) -> 'active' (spawn quota at
                        spawnDelay, capped by maxAlive; quota only used when a zombie actually spawned, else retry
                        after spawnRetrySeconds). Each spawn's type: zombieTypeForRound, except a special type's
                        first possible round forces its introSpawnIndex-th spawn to be one. onTypeIntro(typeId) fires
                        the first time a type spawns in a run. start() on first play, skipRound() (debug), reset()
  maps/
    index.js            Map registry + loadMap(id, scene, colliders) + THE MAP INTERFACE (id, group, zones, doors,
                        spawnPoints, features (wall buys, ammo cache... by kind), playerSpawn, update, reset, dispose).
                        New map = new folder + 1 line
    mall/mall.js        buildMall(scene, colliders): the mall's LAYOUT only (rooms, doors, props, lights, markers), built
                        with the map kit + mall props. Zones startRoom (open) / hallway / megaMart / foodCourt /
                        serviceCorridor; doors: start shutter (500) -> hallway (the hub), Mega Mart shutter (750, hallway
                        east end) -> megaMart, Food Court shutter (1000, hallway south wall) -> foodCourt, Service
                        Corridor shutter (1250, hallway west wall) -> serviceCorridor (built with kit.corridor from a data
                        spec; its layout's pointAt places the dressing and spawns); shortcuts foodCourtMegaMart (1000)
                        and serviceCorridorFoodCourt (1250) each open both joined zones; wall buys priceGun (start room) +
                        nailGun (hallway south wall) + foamDartBlaster (Mega Mart) + confettiCannon (Service Corridor). All meshes, lights and debug markers live in its group. Exports LAYOUT
                        (startRoom, hallway, foodCourt, megaMart, doorway, foodCourtDoorway, megaMartDoorway, escalator,
                        elevator, serviceCorridor, foodCourtMegaMartDoorway, serviceCorridorFoodCourtDoorway). The hallway ceiling is a kit.slab with a hole where the escalator passes through
    mall/props.js       createMallProps(kit): shopFront({ along 'x'|'z', from, to, wallAt, facing, color, text }), pillar,
                        bench (vaultable), planter ({ tree }), lightPanel ({ dead }), gondola (solid double-sided shelf,
                        products = one seeded InstancedMesh), checkout (vaultable counter + register + lane light),
                        wallDoor (painted service/exit door + sign), boardedVent, wallStripe, escalator({ bottomX, dir,
                        minZ, maxZ, upperY, ceilingY }) (extruded body + instanced steps + glass/handrails; sealed: rope
                        barrier + OUT OF ORDER board, colliders stepped along the slope: solid to the floor where low, overhead
                        where its underside is above 2m so you can walk under; returns { hole, topLanding, barrier, ramp, link... }),
                        elevatorDoors (sealed, taped off),
                        foodStall (facade + name sign + menu board + striped awning + counter/sneeze guard/register/food +
                        gear behind: grill/fryer/wok/soda; ONE solid 1.2m block wall-to-counter: above jump peak + step-up),
                        tableSet (round table 0.75m + 4 stools 0.45m; colliders: table + a "plus" of two low stool strips),
                        trashCan, lockerBank (solid 1.9m), electricalPanel (+ DANGER sign; a future power switch spot),
                        pipeRun (exposed pipes), vendingMachine({ along, center, wallAt, facing }) (the ammo cache: solid 1.95m,
                        lit product window, keypad, header "RESTOCK-O-MATIC"; returns { position, normal } = its buy spot),
                        serviceDesk({ along, center, wallAt, facing, tierColors }) (the Customer Service BOOTH: a walled office
                        with a service window + counter, a zombie clerk, computer/cabinets/clock visible through the glass, a
                        CUSTOMER SERVICE sign on the roof, NOW SERVING above the window, a sticker per tier on the counter; ONE solid
                        full-height collider wall-to-counter, so nobody gets inside and moving it needs no room behind; returns its
                        buy spot), clerk({ along, center, wallAt, facing, depth, apron }) (a zombie in an apron behind a counter,
                        decoration), attachmentDisplay({ along, center, wallAt,
                        facing, style 'case'|'pegboard', items, title }) (a store's attachment counter: glass case in front of a
                        shopfront, visible top and ONE solid collider sharing height (default 1.25m), or a flat pegboard on a wall; shows each attachment as a big copy of the
                        gun part + a name card; returns a buy spot per attachment)
    mall/stores.js      THE FOOD COURT STORES as data -> real walk-in rooms. LAYOUT.stores entries { id, name, slot, side
                        'south'|'north', from, to, depth, doorWidth, theme, color, signColor, wall, floor, apron, title }:
                        'south' = RECESSED behind the Food Court's south wall (storeOpenings() gives that wall its front openings),
                        'north' = a POD against the hallway wall projecting into the Food Court (builds its own front wall + a
                        carpet overlay). Each store: colored piers + sign + striped awning, two glass display windows either side of
                        a 3m door (solid to walking/bullets, see-through), own floor/ceiling/walls/light panels, a full-width counter
                        (props.attachmentDisplay, gap 1.0 for the clerk strip) with the slot's attachments, a clerk, theme dressing
                        (byteMe: screen wall + laptops + neon; goodSports: wainscot, jerseys, trophies, bat rack, ball bin;
                        playTimeToys: rainbow, plush shelves, blocks; nutsAndBolts: pegboard of tools, paint cans, workbench) and a
                        zombie spawn just inside the door. buildStores({ kit, props, court, thickness, stores }) -> { spots, spawns }
    mall/atrium.js      buildAtrium({ kit, props, layout, upperY }) -> { spawns, lamps, link, ramp, emitters, update, reset }: THE GRAND ATRIUM (walls, ring
                        slab + skin + railings, escalator, fountain, kiosks, planters, benches, signs, vents). Doors are built by mall.js
    mall/atriumDetails.js  Authored display facades, kiosk merchandise, fountain/floor details, overhead decorations and small scenes.
                        Uses config/atrium.js; no colliders/lights/interactions. Only ripples/mobile animate; kit owns disposal.
    mall/levelTwo.js    buildLevelTwo({ kit, props, floorY, supportRects, hole, layout }) -> { spawns, lamps }: LEVEL 2 shell,
                        independently sized by config/promenade.js (merged into LAYOUT.level2); floor sections use existing downstairs
                        ceiling support where available and add structural slabs elsewhere. Main perimeter, roofs, reserved closed
                        connections, railings, furniture, shop frontages and upstairs spawns; mall.js hangs the existing lamps.
    mall/promenadeShop.js  SHOE-PER SALE interior: two entrances, perimeter shoe shelves, fitting mirror/bench, shoe boxes and a low
                        island with a clear momentum-vault crossing. Shares upper-floor unlock/navigation/reset/disposal.
    config/promenade.js  Independent upstairs bounds/sections, slab/wall dimensions, shoe-store geometry/finish data and three
                        reserved expansion connections (west/east wings, COMING SOON workshop). Closures are solid, not purchases.
    mall/restockMachine.js  buildRestockMachine({ kit, center, wallAt, facing }) -> { position, normal, screen }: the RESTOCK-O-MATIC
                        (north/south walls): body + hazard kick plate + glowing header and tagline, a lit window of ammo boxes, keypad,
                        card reader, live canvas screen (screen.show({ title, line, note, tone })), side signs, the AMMO blade sign, the
                        hazard stand pad and glow pool on the floor. One collider. (props.vendingMachine is the old RESTOCK-O-MATIC, unused)
    mall/startRoomDetails.js  Clearance-store dressing relative to the start room: register, receipt, bags, stock remnants,
                        vent frames/boards, sale remnants, pricing station, floor wear, damaged light fitting and lamps.
                        Decoration only (no collision or interactions); static boxes merged by material; map kit disposes resources.
    mall/megaMartDetails.js  Department stock and interrupted-shopping detail (batched static meshes), checkout groceries,
                        receiving hardware/signs, Foam Dart promotion, perimeter trolley, fluorescent housings and the two Mart lamps.
                        MART_FIXTURES shares gondola positions and checkout lanes with mall.js. Only the parked trolley adds collision.
    mall/martProducts.js  Low-poly shelf product models: Outdoor, Snacks, Holidays and Housewares (31 types).
                        The arranger fits whole models into irregular runs: crowded stock, disturbed patches, isolated leftovers and bare stretches;
                        geometry is merged by material alongside the rest of the Mart dressing (no per-product draw calls).
    mall/palette.js     COLORS shared by the mall's rooms and props
    testRange/          Debug add-on (not a map): testRange.js buildTestRange(scene, colliders) with own lights,
                        dummy.js practice mannequins (shootables)
  audio/
    sound.js            createSound(): Web Audio synth for config/audio.js recipes. play(name, { volume }),
                        unlock() (also on the first pointerdown/keydown; browsers block audio before that),
                        setMasterVolume(v) (used by Settings > Audio), setAmbience(mix) (up to three continuous spatial voices,
                        short crossfades), playAmbient(name, {volume, pan}); faded sources stop and disconnect
  fx/
    powerUpView.js      Reusable delivery carton, blue beacon and security badge (no lights/colliders); bob/spin/blink,
                        floor-projected Blue Light ring clipped at walls/voids, hide on reset/death, owned-resource disposal
    contactShadows.js   One instanced draw for soft zombie grounding; interpolates feet and finds supporting collider tops.
                        No collision, hitbox or navigation changes; clear on restart, dispose owned GPU resources on unload.
    impactMarks.js      Persistent world aftermath: visible-mesh ray + flat-face corner checks, ring of 200 marks shared
                        across instanced signature pools. Skips shutters/unsupported edges; follows rigid surface transforms,
                        removes marks when surfaces unload, clears on restart. prepare(renderer,camera) warms shared graphics.
    impactModels.js     Small shared staple/nail/dart/confetti meshes with vertex colours; three procedural price-sticker textures
    effects.js          Tracers (pooled) + particle bursts (one InstancedMesh): splat(), puff(), clear() (new run)
  (tools/)              Dev scripts (not bundled): buildSingle.mjs = `npm run build:single` (a normal Vite build into dist-single/, then the JS, CSS and
                        the music worker (as a Blob worker) pasted into ONE html file; the Google Fonts link loads non-blocking so a blocked
                        network just falls back to system fonts; tests/singleFile.test.js builds it and checks it is self-contained); balance.js = gun balance maths shared with the tests (seeded Monte Carlo of each
                        gun's real spread + pellets vs a Shopper's hitboxes at a range: expectedShotDamage, sustainedDps, burstDps,
                        shotsToKill); gunReport.mjs = `npm run balance`
  world/                Shared building blocks for maps
    mapKit.js           createMapKit(group, colliders): mat, addCollider, box, sign, tiledFloor, wall({ along, from, to,
                        at0, at1, height, openings: [{ from, to, top }] }) (doorways get lintels), shutterDoor({ id, label,
                        price, opensZone / opensZones, zones, doorway, text }), markers(), slab(rect, y0, y1, mat, { hole }) (a ceiling
                        with a hole), corridor(spec, { floor, wall, ceiling }) (a whole corridor from a data spec; returns
                        its layout), dispose() (unload: removes every collider it added, shutters' too, from the shared
                        list + frees geometries/materials/textures). wallSegments() / slabPieces(): the pure wall / slab math
                        (tested); wallSegments clips openings to the wall and THROWS on overlapping openings
    corridor.js         corridorLayout(spec): MODULAR CORRIDORS AS DATA (pure math). Spec: { width, height, thickness, start
                        { x, z }, segments: [{ dir 'north'|'south'|'east'|'west', length, noWall: ['left'|'right'], openings:
                        [{ side, at, width, top }] }], startCap / endCap: true | false | { opening } }; runs turn 90 deg.
                        Returns points, runs, floors (corner squares once; an open end reaches back under the doorway it
                        joins), walls + caps (kit.wall specs; walls extend past a turn only on its OUTSIDE), pointAt(run, at,
                        side, inset) (place props/spawns/doors; normal points into the corridor), branchStart(run, at, side)
                        (start a branch corridor through a side opening). left/right = as walked (right = (-dz, dx)).
                        THROWS if the corridor crosses itself or two runs are so close a wall lands in another's walkway
    door.js             createDoor(): buyable barrier (price, legacy opensZone or opensZones array, `verb` in the prompt: 'open', or 'repair' for the escalator) wrapping a shutter or any barrier { open, close, update, collider };
                        open/reset/toggle. A shortcut opens both zones. Every door exposes canonical opensZones;
                        a zone stays open while any holder is open (tracked per zone), reset seals all doors/zones.
                        toggleDoors(doors): debug O synchronizes the whole group, preserving bought doors on open-all
    wallBuy.js          createWallBuyDisplay(): chalk outline (textures.makeChalkTexture) + the gun on two pegs, side on
    collision.js        RAMPS (addRamp / removeRamp / rampHeightAt, `colliders.ramps`): a walkable slope that is only a SURFACE the feet follow
                        (never a wall or ceiling; add boxes beside/under it): up within rampStep 0.5 m, down within rampSnap 0.4 m, not while
                        jumping. kit.ramp(spec) registers one and dispose removes it. moveAndCollide(): horizontal push-out (also removes the velocity going into the wall, so
                        a pinned mover reads speed 0 and slides along walls) then vertical landing/ceiling vs. Box3 list;
                        hasHeadroom(): can the player stand up here? overlapsSolid(): would a body overlap a wall?
                        markCollidersChanged(colliders) after adding/removing a collider at runtime; colliderSignature()
    shutter.js          createShutter(): roll-up barrier with its own Box3 collider (open/close/toggle/update); marks
                        collider changes. mesh = cropped moving curtain + hardware; frame = fixed guides/housing (mapKit adds both).
                        Constant slat pitch in X/Z walls, hidden curtain when fully rolled up. config/shutters.js owns finishes/dimensions.
    textures.js         Procedural canvas textures (floor tile, shop sign, shutter, muzzle flash burst, wall-buy chalk). No image files.
    atmosphereTextures.js Soft footprint alpha and deterministic tile roughness (no image downloads)
                        seededRandom(seed): deterministic random (also used for shelf stock)
  ui/
    incentiveHud.js     Small employee punch card (drop progress), uncollected incentive countdown and Blue Light timer
    modal.js            Shared Settings/Controls dialog behavior: inert background, focus trap, Escape, restores focus on close
    settingsMenu.js     createSettingsMenu(settings): builds the options screen from the settings list (tabs, rows per type:
                        checkbox / range + readout / select). Opened by the pause screen's Settings button (controller: Y);
                        Esc / Back / B closes. padNav(input): D-pad moves + changes, A toggles, LB/RB tabs, B back
                        (main.js routes controller input to it while it's open)
    debugPanel.js       createDebugPanel({ status }): the small read-only debug window (the ` key): every debug key by group, live
                        round / points / zombies / spawn type / GOD / sale, and the last result; never takes clicks
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
                        setAmmoTier(tier): "<Tier> warranty" in the tier's color under the gun name
                        (hidden at Standard; main.js feeds it from tierOf(gun.modsFor(...))); showAnnouncement({ kicker, text }): PA-style banner under the round banner (new zombie types)
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
- Buying: createGame adds every `map.doors` entry to `interactions` (verb 'open', cost pricing.priceOf('door', id), use =
  door.open(), which opens its zone(s) so zombies start spawning there and the nav grid rebuilds when the shutter's collider
  goes), and builds every `map.features` entry by kind (game/features/): wall buys (display + "buy <Gun>" / "<Gun> ammo",
  hidden when its zone is closed or you own it with full ammo; use = gun.give(def)) and the ammo cache. Melee gets `getWeapon: () => gun.weapon` (the gun in hand).
- Map: createGame does `loadMap(mapId, scene, colliders)` and only uses the map interface (maps/index.js).
  The zombie manager gets `map.spawnPoints` + `isZoneOpen`, so zombies only spawn in opened zones.
- Zombie types: rounds picks each spawn's type (economy.zombieMix) and calls `zombies.spawn(typeId)`; health is
  `zombieHealthFor(typeId, round)`, kill value `economy.killValues[typeId]`. A type's first spawn in a run ->
  'typeIntro' event -> createGame shows `zombieTypes[id].introBanner` (hud.showAnnouncement) + plays 'paChime'. Zombie sounds:
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
- The game only runs while the pointer is locked; Esc pauses and shows the overlay.
- Collision: one shared flat array `colliders` of `THREE.Box3` (created in main, filled by the map and the
  test range). `box(..., {collide})` in `mall.js`
  makes a mesh and (optionally) a collider; some visuals use `collide:false` with a separate hand-sized
  `addCollider` (pillars, benches). Shutter adds/removes its own collider from the same array.
  Player is a cylinder (radius, height, feet position). Boxes whose top is within `stepTolerance`
  of the feet count as floor, not walls.
- Coordinates: meters, +Y up. Camera looks down -Z at yaw 0.
- Markers (invisible; shown if `debug.showMarkers`; wall-buy markers come from the 'wallBuy' features): `map.spawnPoints` (20: 4 level-2 vents with y = 6.3, tagged zone 'upstairs'; 2 start-room vents, 3 hallway vents,
  4 Food Court shopfronts, 4 Mega Mart: stockroom, receiving, back vent, emergency exit, 3 Service Corridor: two wall
  vents + the dead end; each tagged with its zone)
  and the 4 'wallBuy' features (outward `normal` + `weapon` id: Price Gun, Nail Gun, Mega Mart Foam Dart Blaster
  and Service Corridor Confetti Cannon; prices in economy.wallBuys via g.pricing).

## Map (current)
The start room opens into a MAIN HALLWAY (the hub). Each outer area has a hallway entrance; two buyable shortcuts
also join the outer areas into loops. A shortcut opens BOTH adjoining zones, and every shutter is bought separately.
- Start room: x -5..5, z 6..16, 4m ceiling, checkout counter, shelf, crates, boarded vents. Its 4m doorway at z=6
  is blocked by a security shutter door (500) that opens the hallway. Hold **F** (controller: hold **X**) near a
  door to buy it. Debug: press **O** to open all doors for free; if all are open, O closes them all.
  Dressed as a picked-over clearance store: register/receipt/bags at the left end of the vaultable checkout,
  open shelves with a few products and dusty stock outlines (original collision footprint), framed dark boarded vents,
  sale/tape remnants, missing employee photo, FINAL MARKDOWN pricing station around the Price Gun, restrained perimeter
  floor litter/scuffs, damaged dead ceiling fitting, warm checkout / cool shutter light. Central lane and both spawn bodies stay clear.
- Main hallway: x -20..20, z -2..6 (8m wide), 6m ceiling. Doors: Food Court (1000, south wall x -3.5..3.5, a 7m gate, straight
  across from the start door, under a FOOD COURT sign, framed by two planters), Mega Mart (750, east end z -1..5, 6m,
  under a MEGA MART sign), Service Corridor (1250, west wall z 0.5..3.5, under a "SERVICE CORRIDOR · STAFF ONLY"
  sign; the escalator's high end runs overhead just short of it). 3 boarded vents (zombie spawns).
  Escalator (SEALED until repaired for 2000, see Current state): west half, z 1..3, bottom end at x -4 facing the hub, rising west at 30 deg through a hole in
  the ceiling (x ~-16.5..-11.95) to level 2 (y 6.3, the top of the ceiling slab; see Level 2 below). Rope barrier + OUT OF ORDER board at the bottom; every collider you could
  reach from the floor is taller than a jump. Its low end (x -4..-10.4) is solid to the floor; under its high end
  (x -10.4..-17.5) there's >= 2m headroom, so players and zombies walk under it. Elevator (SEALED): doors in the north
  wall at x 10.5 (taped off, OUT OF ORDER, floor indicator "1", call button); painted on, the wall behind is solid.
- Level 2 (the Sunset Promenade; zone 'upstairs', opened by repairing the escalator for 2000): x -20..20, z -4.5..6,
  floor y 6.3, ceiling 9.9. You step off the escalator into a 2.5m west lobby; the escalator well (x -16.5..-11.95, z 0.7..3.3) is fenced by
  railings on its north, south and east sides. The southern passage gained 2.5m; the balcony holes and central bridge are unchanged.
  SHOE-PER SALE x -10..-4 is a real store extending north to z 11.3, with 2.1m entrances x -9.8..-7.7 and -6.3..-4.2,
  shoe shelves, fitting mirror/bench and a vaultable 0.65m display island. COMING SOON x -3..3 and PRETZEL PALACE x 4..10 remain closed.
  The bench-ring planter at (14.2, 1.6) remains for a later lounge pass. Southern benches, signs and two southern vents follow the
  new wall; all four existing upstairs spawn markers remain (east z 4.2, north x 16). Reserved solid connections at both ends
  (z -4.1..-1.7) and behind COMING SOON (x -1.3..1.3) prepare future wings/workshop. No new price or purchase path.
  Main floor and annex are sections in config/promenade.js, independent of the hallway; navigation/grade follow the upper sections.
  The elevator stays sealed. Data is exposed through LAYOUT.level2; see mall/levelTwo.js and mall/promenadeShop.js.
- The Grand Atrium (zone 'atrium'): x 8..32, z 6.6..30.6, behind a 5m gate (1500) in the hallway's north wall at x 13..18 under a
  GRAND ATRIUM sign. Two storeys (roof 9.9 under a big warm skylight): an open court x 11.5..28.5, z 10.1..27.1 with a square
  fountain (glass guard, solid to 2.2m) in the middle, CELL-OUT and SHADE SHACK kiosks, four tree planters, three benches; a 3.5m arcade
  round the edge under the UPPER RING (y 6.3), which is railed all round the court. A second escalator rises east from the court
  (x 16.5) to the ring's east side. The ring's south wall has the 'atriumPromenade' shutter (1000, x 11.5..14.5) into level 2.
  Five spawns: four ground vents (north x 13 / 27, west z 16, east z 12) and one on the ring's north wall. Data: LAYOUT.atrium.
- Food Court: x -20..20, z -14.3..-2.3, 6m ceiling, behind the 1000 shutter: the old concourse moved south (its four
  shops Good Sports / Nuts & Bolts / Play Time Toys / Byte Me are real stores now (see below), 2 pillars, 2 benches (north side), tree planter,
  end planters, ceiling lights, 4 spawns), placed relative to its center line FZ = -8.3. Three food stalls along the
  south wall between the shops: BURGER BARN (x -8.4..-3.1), WOK THIS WAY (-2.6..2.6), CORN DOG CORRAL (3.1..8.4); each
  is solid from the wall to its counter front (z -13.0), 1.2m tall, so you can't get onto or behind it. Eight round
  table sets (tables 0.75m you can hop onto via the 0.45m stools) at x +-9 / +-5.5 around the tree planter, leaving
  table lanes, a clear lane from the door to the planter and room to queue at the stalls; two trash cans (x +-11.2);
  an "EXIT · MAIN HALL" sign over the door inside.
- Mega Mart: x 20..34, z -24..6, 5m ceiling, behind the 750 shutter. Its west wall (x 20..20.3, 6m tall) is also the
  east wall of the hallway (door at z 0..4) and of the Food Court (shortcut at z -9.8..-6.8). Front: 4 checkout
  lanes (vaultable counters, x 24.5..27.5, 2m lanes, open ends to run round). Back: 3 stocked shelf gondolas
  (x 24 / 27.5 / 31, z -19.5..-8, solid, 2m tall) making 4 aisles, a 4.5m back walkway with stockroom/receiving
  doors + a boarded vent, an emergency exit on the east wall. Brand stripe, aisle signs, fluorescent strips (some
  dead), 2 point lights.
  Detail pass: recognisable Outdoor / Snacks / All Holidays / Housewares stock inside the original shelf footprints,
  looted stretches and shelf tickets, groceries/receipts/bags at register ends (vault lanes clear), receiving hardware and
  delivery/safety notices, TRY BEFORE YOU BUY Foam Dart promotion, dropped basket within a gondola, perimeter spill/scuffs,
  a solid parked trolley by the east wall at x 33.43..33.91, z -5.90..-5.08, framed fluorescent fittings. The two lamps now
  separate warm checkouts from cool aisles; no flashing. Entrances, crossings, spawn spaces and four main aisles stay clear.
- Service Corridor: behind the 1250 shutter, a 3m-wide back-of-house corridor built from a data spec with the
  corridor builder: in through the hallway's west wall (floor reaches under the doorway), a 1.5m run west, then 16m
  south along the Food Court's west side to a dead end at z -14 (x -23.3..-20.3, 3.5m ceiling). Its east side is the
  hallway's and Food Court's own west walls (noWall); the Food Court wall contains the shortcut at z -13.4..-11.
  Dressing on its west wall: EMPLOYEES MUST WASH HANDS sign, two boarded vents (spawns), an electrical panel
  with a DANGER · HIGH VOLTAGE sign, a bank of lockers (solid, narrows it to ~2.5m), exposed pipes the whole way;
  boxes + a vent (spawn) + NO LOITERING (ESPECIALLY THE UNDEAD) at the dead end; three ceiling strips (middle one
  dead), two warm point lights. Concrete-look floor, drab walls.
- Loop shortcuts (ordinary security shutters, buyable from either side, prices via g.pricing 'door'):
  Food Court <-> Mega Mart (1000), x 20..20.3, z -10.8..-5.8 (5m), height 3m, centered FZ = -8.3, signs MEGA MART / FOOD COURT.
  The east-end planter is split around the opening; clear approaches lead into the Mart's 3.2m west aisle.
  Service Corridor <-> Food Court (1250), x -20.3..-20, z -13.4..-11, height 3m, opposite the cannon at z -12.2;
  STAFF ONLY / EXIT · FOOD COURT signs. Lockers stay at z -11..-9, with 2.55m clear corridor width alongside/past them.
  The west planter, RESTOCK-O-MATIC and cannon buy spots are unchanged. The cannon is out of buying range from the Food Court.
  Main loop: hallway -> Food Court -> Mega Mart -> hallway. West loop: hallway -> Service Corridor -> Food Court -> hallway.
  Any open holder keeps its zone open; Play again closes every shutter and seals all outer areas.
- Customer Service booth (gun tiers): a small walled office on the hallway's north wall at x 5.2..8.8 (between the start doorway
  and the elevator), 1.6m deep + a 0.3m counter ledge; you buy at its service window (spot z ~4.1). Hold F/X to buy the next Extended
  Warranty tier for the gun in your hand. Its spot is ONE entry, LAYOUT.serviceDesk in mall.js (along/center/wallAt/facing/zone):
  change it to move the booth. A map feature of kind 'upgradeDesk'.
- The four Food Court STORES (gun attachments; see mall/stores.js): GOOD SPORTS (grips) x -17..-9 and NUTS & BOLTS (barrels) x 9..17
  are rooms 6m deep behind the south wall; PLAY TIME TOYS (magazines) x -16.4..-10.6 and BYTE ME ELECTRONICS (sights) x 10.6..16.4 are
  4.5m-deep pods against the hallway wall (the two north pillars are gone: the pods hold the ceiling up). 3m doors, glass windows, a
  zombie clerk behind a full-width counter, two attachments per counter (one buy spot each), a zombie spawn just inside each door. Each
  store is ONE entry in LAYOUT.stores (mall.js). Map features of kind 'attachmentCounter' (one per attachment). The Mega Mart's aisle
  4 is HOUSEWARES again (the barrels moved from the old hardware pegboard to Nuts & Bolts).
- Ammo cache: the RESTOCK-O-MATIC, a big hot-orange vending machine on the Food Court's NORTH wall just inside the door,
  east side (x 4.1..5.8, front at z -3.15 facing south; LAYOUT.restockMachine.x moves it along the wall), clear of the door
  lane, the east bench and the Byte Me pod. Hold F/X for 400 points to refill the gun in your hand (any gun, including the
  staple gun, which has no wall buy); no prompt when it's full or the Food Court is closed. Built to be seen: glowing header sign,
  an "AMMO" blade sign sticking out of the wall that reads down the wall both ways, "AMMO" on both sides, a yellow-and-black
  hazard pad on the floor where you stand and a soft warm glow on the tiles (unlit materials, no real lights, no flicker). Its LCD
  is live (the gun in hand, its ammo, the price / FULL / SALE). Solid 2.35 m body, one collider. A map feature of kind 'ammoCache'
  (game/features/ammoCache.js; mall/restockMachine.js builds it). It used to be a RESTOCK-O-MATIC on the west wall, which the
  Food Court stores made a far, awkward detour.
- Wall-buy spots: start room east wall (5, 1.5, 10) = Price Gun; hallway south wall (11, 1.5, -2) = Nail Gun;
  Mega Mart north wall (31.5, 1.5, 6) = Foam Dart Blaster, Service Corridor west wall near the dead end
  (-23.28, 1.5, -12.2) = Confetti Cannon; Grand Atrium west arcade wall (8.02, 1.5, 21.5) = Rivet Rifle; Sunset Promenade
  south wall (1.5, 7.8, -4.48) = Heavy Coil Nailer (zone 'upstairs'; the Promenade is still growing: one entry to move);
  Byte Me's pod, east face looking over the Food Court's east end (16.72, 1.5, -6.2) = Barcode Scanner.
- Lighting: room lamps (point lights) hang at ~60% of the ceiling height with intensity scaled to match, NOT just under
  the ceiling: a lamp 0.8m under it lit a small hard-edged bright disc on the ceiling ("big circles"); hung lower it's a soft
  glow. Keep that if you move or add lamps (mall.js, the `lamp()` calls).
- Atmosphere: `mall/atmosphere.js` adds ceiling seams/vents/sprinklers (excluding the escalator well), service cable
  trays/access panel, Sunset Galleria notices/directory and a gently swaying two-sided sign, interrupted lunches,
  a fallen seat, restocking carton, perimeter dust/spills/leak and static fixture contact shadows. Decorative boxes
  batch by material and add no colliders. `map.update/reset` owns the local sign/tube animation; `map.ambience`
  is emitter data. `game/ambience.js` selects zone-aware, distance/occlusion-attenuated and stereo-panned HVAC,
  fridge and muffled music voices; occasional rattles come from nearby closed shutters. It owns no Web Audio nodes.
  Pause/death/reset silence the mix; `audio/sound.js` owns browser audio and uses `audio.ambienceVolume`.
  No realtime shadow maps or global blur; zombie contact shadows render after interpolation in main. Post-processing (bloom, lens
  vignette/fringing, ACES tone mapping, MSAA) is fx/postProcessing.js with three levels, Settings > Video > Visual effects: High (default),
  Low (composer only: no bloom/lens/MSAA), Off (no composer: the world and the gun drawn straight to the screen). "Dust and
  flickering lights" (atmosphere.ambient.enabled) hides the dust motes and zeroes the flicker/emergency lights (kept in the scene).
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

Character and weapon model refresh ("faceted, not voxel"):
- First-person hands, arms and lower body (`weapons/models/arms.js`, `player/body.js`, `weapons/viewmodel.js`, `config/feel.js`):
  replaced rectangular palm/finger blocks with shaped faceted palms (`unitPalmGeo`), distinct thumbs (`unitThumbGeo`), a readable
  right trigger index finger (`rightIndexFinger`) plus 3 grouped grip fingers (`rightGripFingers`), 4 articulated curled support
  fingers (`unitSupportFingersGeo`) plus `supportThumb`, and tapered 8-sided forearms with employee polo sleeves, ribbed crimson
  cuffs (`rightCuff`/`leftCuff`) and cream uniform tipping stripes. Melee box-cutter arm shares `buildCuffedArmSegment` and has a
  faceted fist + trapezoid snap-off blade. First-person body adds a faceted waist, brass belt buckle, tapered legs and faceted sneakers.
- Shared zombie anatomy & static shop clerks (`zombies/zombieModel.js`, `config/shoppers.js`, `zombies/shopperAppearance.js`,
  `maps/mall/props.js`): shared indexed `ANATOMY_GEOMETRIES` give Shoppers, Mall Walkers and Cart Pushers a faceted cranium and
  tapered jaw (`head` stays comfortably inside the 0.25m headshot hitbox), brow ridge, ears, V-tapered torso with shoulder caps,
  tapered limbs, faceted shoes, recognizable hands (palm, curled fingers, inner thumb), and five restrained cartoon-undead face
  profiles (`sunkenEyes`, `offsetJaw`, `droopingEyelid`, `retailSmile`, `discolored`). Per-bone geometry batching now runs on all
  zombie types (~17-18 meshes / ~1.5k tris per Shopper or Mall Walker) with isolated per-zombie materials for hit flashes.
  `props.clerk()` uses `buildClerkFigure()` with cloned geometry instances so `map.dispose()` never disposes shared zombie geometry.
- Refreshed older weapons & upgrade parts (`priceGun.js`, `stapleGun.js`, `nailGun.js`, `foamDartBlaster.js`, `confettiCannon.js`,
  `upgradeParts.js`): Price Gun rebuilt as a sloped supermarket tagger with open cradle cheeks, red-bordered sticker roll, visible
  paper feed ribbon, price-band dial, ink roller, emerging `"$9.99"` label, enclosed trigger guard, `PRICEMASTER` plaque and firing
  roll/roller/label feed motion. Staple Gun rebuilt with a hinged upper compression lever + rubber palm pad, full-length chrome
  staple channel + animated rear spring-pusher rod, stepped driver nose, side staple inspection windows and `STAPLE-PRO T50` sticker.
  Nail Gun adds a cylindrical rear piston tower + bolted exhaust cap, exhaust louvres, fasteners, `CAUTION 120 PSI` decal, brass
  serrated safety contact foot + return spring on the punching nose, twin-rail angled magazine with visible collated nails, and a
  brass quick-connect air fitting + hose stub. Foam Dart Blaster adds a faceted clamshell receiver with parting seam and screw bosses,
  ribbed foregrip, shaped skeletonized stock with orange buttpad, `FOAM STORM · AGES 8-80` plaque and indexing rotary drum.
  `upgradeParts.js` adds mounting brackets/adapters on universal parts, weapon-tailored `jumboPack` reservoirs/drums/packs via
  `mount.gunId`, a cam-latch + finger-loop `speedLoader`, a woven-tag `wristband`, and a branded Extended Warranty service seal.

Promenade steps 1-3: independently authored upper bounds/floor sections and three sealed future connections; widened southern
route (+2.5m above the Food Court, no downstairs layout changes); SHOE-PER SALE becomes a two-entrance room with a vaultable
display and perimeter stock/fitting area. Existing upper unlock, balcony holes/rails, escalators, Atrium shutter, prices and four
spawn markers retained. Southern vents/decor follow the moved wall. Structural support is reused without doubled slabs;
new annex support/roof, floor-aware navigation and grading are integrated. tests/promenade.test.js covers traversal/vaults/live
zombies; mall.test.js now checks spawn floor heights instead of accidentally testing upstairs markers on the ground layer.
Eastern lounge, full decoration pass and future Build-A-Blaster destination are deferred.

Security shutters rebuilt: matte enamel slats, faded Galleria sunset/band, area-specific notices/stickers/wear; clearance
raspberry, Food Court teal, Mart blue-grey, Atrium lavender/brass, staff institutional green. config/shutters.js owns finishes,
door-ID assignments, slat pitch and hardware dimensions. Fixed side guides and roller cassettes stay after opening; a solid
bottom rail, lifting handles and lock plates move with the curtain. world/shutter.js shortens the visible curtain and crops
its UVs as it feeds upward (constant slat/letter size, top fixed at the housing; no slab rising through the lintel). Original
collider box, headroom threshold, 1.2s speed, prices/zone events and reset behaviour remain. Frames add no collision; existing
static batching leaves all moving pieces alone. Guide caps/edges and cassette undersides keep an 8mm clearance from adjacent
floor, jamb and lintel planes so the fixed frames do not z-fight after batching. Low staff-shortcut/Promenade destination signs are mounted forward of the
cassette on rigid plaques. game/shutterSounds.js listens to purchases: short motor start, tick-paced rolling rattle, clunk
on actual completion. No queued wall-clock finish sound; pause freezes it and death/runReset cancel; debug opens are silent.


Grand Atrium detail pass: twelve shallow decorative storefronts on the ground and upper perimeter (fashion mannequins,
perfume, luggage, TVs, repeated employee portraits, papered/closed displays). No new accessible rooms, collision, doors or
lights. CELL-OUT stocks phones/keypads/cables/packages; SHADE SHACK has a glasses rack, display head, mirror, register and
disordered stock. Fountain adds stone panels, submerged coins (water now translucent), dedication, hatch, stains/chips,
subtle ripples and a local fountain voice through the existing capped/occluded ambience system. A single floor overlay
adds a tiled medallion, entrance bands and traffic wear; below normal shadow/decal height, no floor collision changes.
Opening banners (readable both sides), sunset mobile, pennants, pilasters/brackets and a stranded balloon dress the height;
bench bags/drink, planter-integrated litter bin, cleaning kit, employee board and directory add small scenes. Existing
vents, doors, fountain loop, upper ring and escalator remain clear (actual-triangle tests + existing movement/nav tests).
Data/colours/counts/timing: config/atrium.js. Builder: maps/mall/atriumDetails.js, called by atrium.js; its update/reset run
from map.update/reset. Static pieces use the existing batcher; only three ripples + the mobile animate (ambientEffects off
sets a still pose). This pass adds about 10k triangles, no new lights. All resources belong to the map kit.


Retail UI: title directory with sunset emblem/arrow navigation over the live flyover; combat round sign, checkout credit
display, floating ammo/name/tier text and employee reward strip. Vitals are two unframed continuous lines (health above thinner
stamina, fading almost out when full). Purchases use a compact hold-button/name/price line with a thin progress underline;
only upgrade terms or a points shortage add detail. Warranty transitions, replacement attachments and crossed-out original
sale prices remain (pricing.basePriceOf; charged prices unchanged). Brief Purchased text appears near the points counter.
Purchase confirmations listen to the event bus in the browser. PA messages
queue instead of overwriting each other; new threats preempt routine copy. Round/PA/sale use separate HUD positions.
Pause and stats use cream personnel forms/ruled ledgers; settings a facilities console; controls/help an employee handbook.
Receipt retained, with sticky retry buttons outside its printing animation. Controls, focus/inert behavior and gameplay
unchanged. Presentation lives in ui/retail.css, ui/announcements.js and config/ui.js. Stats empty/content sections now correctly
hide each other; equal-ammo weapon switches refresh the HUD name. Browser QA includes real F purchases, keyboard/controller
navigation and 1440x900, 800x600 and narrow layouts. No map/weapon balance edits for the UI.

VISUAL OVERHAUL (neon 80s vaporwave mall, leaning hard into horror; every costly effect toggleable). Plan: 1) performance
foundation, 2) the hallway as the approved REFERENCE ROOM, 3) neon + painted light pools, 4) floors/haze/post, 5) clutter,
6) set pieces, 7) dynamic horror lighting, 8) presets/perf polish. Step 1 is DONE:
- 1a Graphics tab (was Video): every setting that costs performance has `cost` ('low'|'medium'|'high', a tag in the menu) and
  EVERY Graphics preset (Potato / Low / Medium / High; Ultra joins with the first Ultra-only effect) must set it (tested). New
  effect = one entry in config/settings.js + its value in each Graphics preset.
- 1b Benchmark: Shift+B on the title or pause screen (or `await __mall.benchmark()`): fx/benchmark.js flies map.benchmarkShots
  (8 named long views, mall.js), every door opened for the route then restored; report = draw ms (CPU, not vsync-capped: the
  number to compare), frame ms, draw calls, triangles, per shot + slowest. In the test browser use the PRODUCTION preview
  (launch config mall-zombies-preview, `npm run build` first): the dev page reloads whenever another tool saves a file.
  A hidden/background pane only draws ~1-5 fps: frame ms is meaningless there, draw ms and calls still count.
- 1c Light pool (fx/lightPool.js, setting `lampCount` All / 8 / 6 / 4): below All the map's PointLights become hidden sources and
  a fixed pool of real lights follows the camera (fade, copies flicker, skips lamps at 0). High = All (unchanged look).
- 1d Static batching (world/staticBatch.js, main.js before the first frame; `?nobatch` turns it off to compare): still, opaque
  meshes merged by material in 12m chunks, colour-only standard materials share one vertex-coloured material. NOT merged:
  userData.dynamic (set it on anything shown/hidden/moved at runtime, e.g. the escalator barrier parts), material.userData.animated
  (materials changed at runtime, e.g. the flickering tube), transparent, shutters, hidden, instanced, one-of-a-kind textured
  (signs). 1483 -> 436 meshes, pixel-identical (mean diff 0 in 4 views), draw calls 612 -> 190 average (atrium ring 1378 -> 519).
- 1e Auto graphics (game/autoGraphics.js): the FIRST launch only (nothing saved) measures the title flyover's frame rate (visible,
  focused, hitch-free frames after a warm-up) and picks a preset (config/settings.js autoGraphics tiers).
Step 2 REVISED after review: the user liked the neon but NOT the black, and missed the corporate-satire tone. New direction
"GRAND OPENING, FOREVER" (config/look.js header): a bright 80s pastel mall still cheerfully open around the zombies; horror in the
details, darkness only in back of house and in later rounds (step 7). Hallway now: cream terrazzo with pink grout, mint walls,
lavender wainscot + chrome rail + peach band, white ceiling, warm-white lamps/panels (x 16 panel dead), neon kept but BACKED (dark
panels) where it sits on pastel walls; satire layer: neon OPEN 24/7/365/FOREVER and SMILE! IT'S IN YOUR CONTRACT, canvas posters
(world/posterTextures.js: Sunny the sun mascot, EMPLOYEE OF THE MONTH = Dale the zombie x6, the YOU ARE HERE. YOU WILL STAY HERE. map,
banners, notices: lost children, Galleria Rewards, wet floor); copy in look.hallway.satire. APPROVED ("This is good. Keep going.").
Rolled out to every area (maps/mall/zoneLooks.js, one builder per area, all from config/look.js entries, one shared look kit):
Start room (faded butter / raspberry clearance store; THANK YOU FOR SHOPPING! over the shutter, CLEARANCE), Food Court (peach / teal /
coral; FRESH MEAT DAILY, EAT · SHOP · REPEAT, FREE REFILLS*), Mega Mart (cool white + brand blue / yellow; LOW PRICES. LOWER
STANDARDS., SAVE MONEY. LIVE LESS., dying red tube at the back), Service Corridor (back of house: green / cream institutional
two-tone, dying sick-green tube, red EXIT, staff notices, heavier clutter), Level 2 (pink trim, THE SUN NEVER SETS ON SAVINGS,
YOUR STORE HERE!), Grand Atrium (neon sunsets beside SUNSET GALLERIA, COME FOR THE SALES. STAY FOREVER., trim round the arcade
and ring). Walls an area borrows from a neighbour get a 1 cm paintPanel (paint is on both faces of a shared wall). Washes sit 1 cm
off a wall (behind 2 cm stripes), sign glows 2.6 cm (coplanar.test covers the atrium and part of the Mart). Back of house is darker
in DECOR only so far: real dimming is the zone lighting step.
Steps 4-8 done:
- Zone lighting (fx/zoneGrading.js, config/look.js grading, map.gradeZones): per-area grade (exposure, tint, saturation, contrast,
  vignette) eased by the CAMERA position; dark sick-green Service Corridor, dim red Mart stockroom walkway. Graphics > Zone lighting
  (low cost; Potato off). fx/postProcessing.js grade pass (exposure goes through the tone mapping, so Visual effects Off keeps it).
- VHS filter (postProcessing VhsShader, look.vhs): Graphics > VHS filter Off/Subtle/Full, off by default, a style choice with no cost
  tag so presets never change it; with Visual effects Off that frame is composed like Low.
- Set pieces (maps/mall/setPieces.js, SET_PIECES data): hallway arcade bank (south wall, west end), start room CRT TV wall (static +
  SALE ad), Mega Mart can pyramid (no collision), level 2 mannequins. One collider each; built BEFORE the look kit so clutter avoids them.
  Atrium set piece skipped (another tool owns atrium.js / atriumDetails.js); Food Court ball pit not done.
- Horror layer (game/features/horror.js, map feature kind 'horror', look.horror, map.horror): from round 5 darker each round, a growing
  share of flickering neon dies (neon.setFailures), lamps flicker out for the run; from round 6, 35%/round power cut in the player's area
  (neon.setPower(0), its lamps off, zone grade -> powerCut red), stutters back. All flicker holds >= 0.18 s (under 3 flashes/s).
  Comfort > Horror lighting (Calm off). forceCut() on the instance for testing. Start room / Mart detail lamps never die.
- Performance: measured in the (throttled) test pane at 1280x720 with gl.finish per frame: timings too noisy to tune from, except real
  lamps (all ~25 ms avg vs 6 lamps ~19 ms; a 12-lamp pool looks identical but isn't faster). Neon glow / clutter barely matter.
  Room culling (fx/roomCulling.js, map.cullAreas / map.cullPortals): meshes wholly inside a room go on that room's camera layer
  (tagged before static batching; batches key on the layer), each frame a portal walk (open doors only, screen-rect narrowing) enables
  the visible rooms' layers. Pixel-identical to no culling in 84 renders (all benchmark + title poses, doors shut and open). Doors shut:
  2416 -> 1797 draw calls, 650k -> 339k triangles over the 8 benchmark views (atrium ring 655 -> 396, level 2 437 -> 254); all doors
  open: up to -22%. ?noculling compares. Raycasters must use layers.enableAll() (impactMarks does).
(First version, superseded:)  config/look.js =
the art direction as data (palette rules, hallway colours, neon colours, pool strengths, clutter; look.runtime = what the
Graphics settings write: neonGlow, clutter). maps/mall/hallwayLook.js builds it on top of the hallway: plum wainscot + chrome
rail round every opening, neon signs (FOOD COURT dead U, MEGA MART, GRAND ATRIUM, dying red STAFF ONLY, "GO NG OUT OF BUS NESS"),
a SUNSET GALLERIA centrepiece (neon sun + two stars; palms read as stick figures at that size), cyan/pink trim tubes in pieces,
painted light pools (additive soft quads, no real lights; sign glows sit 6 mm in front of the trim wash so coplanar.test passes),
a paint panel over the Mega Mart's white end wall, and clutter (world/scatter.js) kept out of doorways / spawns / buy spots / the
centre lane. mall.js takes the hallway's wall / floor / ceiling colours, lamps and dim violet light panels (props.lightPanel tint/glow)
from look.js; the old flat hallway signs are gone. Neon, pools and clutter groups are userData.dynamic (never static-batched).
Graphics settings neonGlow (halos + pools) and clutter (none/some/full) in every preset. Shots for review were taken from the
production preview with a canvas capture (main menu HUD excluded).
Room/portal culling was planned for 1d but frustum culling of the 12m batch chunks already does most of it; revisit if needed.
Also merged: world/neon.js (neon tube builder) and world/decor.js + world/scatter.js (decoration kit), not placed yet.


LATE WALL GUNS: the Rivet Rifle, Heavy Coil Nailer and Barcode Scanner are now real wall buys (economy.wallBuys, 'debugOnly' gone;
H still cycles them). Prices from `npm run balance`: Rivet 1500 / ammo 750 (best sustained non-shotgun dps at 2-10 m, 246: priced with
the Cannon), Coil Nailer 1250 / 650 (Price Gun dps, 231, but a 64-nail drum and a 2-zombie pierce), Scanner 1750 / 900 (weak sustained
dps, 180, but pierces 4 in a line, ~3x: the top crowd gun). Spots (mall.js wallBuys, each probed against the built geometry: nothing within
a metre, 3 m+ from every spawn on its floor): see Map > Wall-buy spots. Buying follows the existing two-slot rule. The old assertions
that these guns stay off the map now check they are on it once. tests/lateWallGuns.test.js: priced + zoned + one feature each, real F
holds buy for the exact price and refill for the ammo price (also from level 2), nothing offered while the area is closed or from inside
Byte Me through its wall, spots clear of spawns, all three bought in a row replace the gun in hand, Play again takes them away.

Rivet Rifle (a wall buy now, see above; was a debug-only prototype): the notes below still describe its stats. Automatic 52 damage at 7.5 shots/s, 1.75x headshots, 24 + 144 ammo, 2s magazine reload. Full damage to
12m, falling to 60% at 28m. Steady body fire with slower ADS (0.26s) and 0.78x normal ADS movement, smaller magazine
and weaker headshots than Foam; Nail retains the long-range advantage. Own model, recoil, audio, impact marks and
controller pulse; supports existing tiers/attachments and cache refills. H marks the run assisted. tests/rivetRifle.test.js
covers cadence/reload, roles at every tier, bloom, real hits/payouts/no pierce, ADS/switch/reset, model reload and debug/cache
integration. Existing gun stats are unchanged. Play Again now immediately clears the previous gun's ADS state.

Controller vibration: core/haptics.js listens to shot (now includes weaponId), playerHit and powerUpCollect from the browser.
Five distinct gun pulses; damage overrides shots/pickups until its pulse ends. Uses the currently polled gamepad's dual-rumble
actuator, with legacy pulse fallback; missing/blocked devices are harmless no-ops. Settings -> Controller -> Controller
vibration adjusts strength (0 = off), saved normally. Stops immediately on pause, death, run reset, blur/hidden tab, unplug,
controller replacement or returning to keyboard/mouse. No queued feedback or changes to gameplay/visuals. Browser peripheral
built in main.js; createGame remains hardware-independent. Physical feel needs testing on the player's actual controller.

Atrium <-> Mega Mart shortcut 'atriumMegaMart' (1000, opens both zones, buyable from either side): a 3m shutter through the Mart's
north wall and the atrium's south wall at x 21.5..24.5 (LAYOUT.atrium.martLink), west of the checkouts, into the atrium's arcade;
GRAND ATRIUM / MEGA MART signs over it. 10 doors in all. tests/atrium.test.js covers both sides, walking through and Mart routes.

End of Shift death music: a quiet original seven-second sting (descending piano over Am -> F -> E7 -> Am/add9, a soft
falling thump, slightly detuning pad, register bell at receipt appearance, ending ventilation fade). Config in deathMusic.js;
sound.playDeathMusic({ receiptAt }) schedules a managed group of synthesized voices on the existing music/master volume
controls. playerDeath starts it after ambience is silenced; runReset (Play Again / Main Menu) cancels even future notes with
a short fade. Completed/cancelled voices disconnect their audio nodes; repeated starts replace the old group cleanly.

Employee incentives (power-ups): player gun/melee kills from round 2 fill a subtle performance meter (headshots/melee and
rapid multi-kills earn extra credit). At 12-16 credit a zombie drops a floating carton, blue beacon or security badge on
clear floor. One uncollected drop, 15s lifetime, no immediate repeats, maximum 3 drops per round; near-full inventories
exclude ammo drops. Walk through to collect (fast slides work; walls and other floors block collection). Stockroom Delivery
fills every carried reserve and tops the ready gun up to half a magazine; it never bypasses a running reload or the Cannon's
individual shells. Blue Light Special leaves a 4m zone for 20s: base kill credit doubles for zombies killed inside, with
same-floor/line-of-sight checks; +10 hits and headshot/melee bonuses are unchanged. Security Sweep knocks back and staggers
risen zombies for 2s, interrupting attacks and Cart Pusher charges, with collision but no damage or free points. HUD progress,
pickup/timer text, PA banners and distinct synthesized sounds; no added lights. Pausing freezes timers; death/Play again clear
pickups/zones. Debug testing: window.__mall.g.powerUps.debugDrop('stockroomDelivery'|'blueLightSpecial'|'securitySweep')
drops at the player's feet and marks the run assisted. Map source files are unchanged by this feature.

THE GRAND ATRIUM (maps/mall/atrium.js, see Map): the big open two-storey room north of the hallway. Gate 'atrium' (1500) in the
hallway's north wall (the north-east hallway vent moved to the south wall at x 16 for it), shortcut shutter 'atriumPromenade' (1000)
from its upper ring into the level 2 Promenade (opens both zones, buyable from either side, sits on the upper floor: shutters and
kit.wall take a floor height now, doorway.minY / wall bottom). 9 doors in all. Its escalator is props.escalator({ sealed: false,
hangingSign: false }) and is a second nav link (map.navigation.links). Found while building: a bench next to the fountain let you
jump onto it, out of every zombie's reach, so the fountain has a glass guard on its rim (one 2.2m collider) and the kiosks are solid
up to their canopies. Shared props.railing(x0, z0, x1, z1, floorY) builds every glass railing (level 2 and the atrium). Escalator
comb strip nudged 6mm off its plate's end (the two shared a face and flickered; the hallway escalator had it too). tests/atrium.test.js
(9): the real F-hold gate buy + Play again, sealed until bought (no route, no spawns) then every vent reachable incl. the ring's, a
running lap round the fountain with clear straight runs, the arcade corners, fountain/kiosks not standable even from a bench, ring
rails from four sides, a player rides the escalator up and down, zombies use it both ways, the Promenade link from both sides and
walkable through, no buying the gate from level 2; coplanar.test.js covers the whole atrium; mall.test.js counts 9 doors (its
120-orders test leaves out the escalator repair and both atrium doors, which have their own tests). The scene has 25 point lights
now (the atrium added 2, level 2 2): if the school computer struggles, the shelved light pool (git stash) is the fix to revisit.

Balcony ("less cramped" pass, part 2): level 2's floor (= the hallway ceiling) has two open BALCONY VOIDS over the hallway,
LAYOUT.level2.voids (x -9.5..-1.5 and 2.5..10, z 0.5..3.5), railed on all four sides (1.5m, ignoreShots: you can shoot down through
them), with a 4m bridge between them in front of the start room / Food Court doors. The hallway feels 10m tall: you see level 2's
skylights through the voids and zombies on the other floor. kit.slab takes `holes` (slabPiecesWithHoles in mapKit.js); the
atmosphere's ceiling seams/vents skip every hole (`ceilingHoles`), the hallway's centre light panels over the voids moved to the solid
strips beside them, the red promo banner and the swinging FOOD COURT / MEGA MART sign moved off the voids (the sign hangs under the
bridge), the old upper exit beacon/emergency light moved to level 2's west wall, the level 2 planter ring moved to x 14.2, and the
level 2 floor skin sits on the slab (it flickered against the void edges). tests: levelTwo.test.js balcony (open, sprint-jumping at each
void from all four sides never drops you, rails, ground nav under them), mall.test.js (ceiling solid round them, open in them).

Career statistics: the title menu's Statistics screen is an employee record with lifetime totals, personal bests and the
last 12 completed shifts, saved in browser localStorage. Death freezes one authoritative run summary for both the receipt
and the `runEnd` event. Gameplay-changing debug commands mark the run assisted, so its receipt still appears but it cannot
alter career totals or records. The receipt calls out new records, career totals, or a debug-run exclusion. Clear records
requires confirmation; controller navigation is supported.

Wider entrances ("less cramped" pass, part 1): the Food Court gate is 7m (was 4), the Mega Mart gate 6m (was 4), the Food Court <->
Mega Mart shortcut 5m (was 3); all are LAYOUT entries in mall.js. The RESTOCK-O-MATIC moved east to x 4.95 to stay clear of the wider
door lane, the east-end planters by the shortcut sit 0.6m from it (so the Food Court's south-east corner stays reachable), the
fallen wet-floor cone moved out of the door lane. Prices and doors unchanged. megaMartDetails.test.js reads the doorways from LAYOUT.

Second floor, step 5 of 6 (gameplay integration): level 2 ambience (atmosphere.js emitters level2_music + level2_hvac, zone 'upstairs';
the ceiling slab occludes them from the hallway), contact shadows follow ramp surfaces (a zombie on the escalator gets its shadow on
the steps, not on the blocks underneath), and debug Shift+T (`upstairs`, map.levelTwo { minY, arrival, below, repair }) teleports to
level 2's west lobby, repairing the escalator for free, and back to its foot. The Cart Pusher already only charges on the player's
floor (|dy| < 0.5) with lane rays at its own height. Tests in levelTwo.test.js (13 now).

Second floor, step 4 of 6: Level 2 is built (maps/mall/levelTwo.js, see Map). The old closed-off landing (props.upperLanding) is gone.
Done with it, because the first tests failed without it: the zombie manager treats spawn markers as standing on their own floor (spawn at
the marker's y, route cost and occupancy checked at that y; an explicit spawn spot still goes on the ground), surround slots are taken
only by zombies on the player's floor (slots and lines are checked at the player's y; a zombie on another floor follows the route to you,
it used to stand right above you pressing at an invisible slot), the stuck-zombie failsafe asks the route from the zombie's own floor, and
navigation.directionTo no longer cuts straight through a wall to a ramp's end from several cells away (zombies coming along either
passage pinned themselves on the escalator's side wall: now they head for the ramp end like any other cell and only walk in when close).
kit.tiledFloor takes { top, thickness, collide } (a thin tiled skin over the slab). Local spawning keeps zombies near you: with the
player on the ground only ~1.5% of spawns are upstairs, with the player on level 2 almost all are. NOT done yet (step 5): ambience zones
for level 2 (music/HVAC voices), contact shadows/Cart Pusher lanes on another floor, a debug teleport. tests/levelTwo.test.js (10 tests):
closed in, rails (3, too tall to jump, shots pass), nobody falls into the well from three sides, the walkway is connected and the planter
solid, every vent is a clean spawn on the floor, sealed until repaired (no upstairs spawn), spawn locality, a zombie from each vent comes
down to a player below, one crosses level 2 to a player up there, Play again reseals, and no pinning at the side wall for any lane.

Second floor, step 3 of 6: the escalator repair is a purchase. Door `escalatorRepair` (economy.doors.escalatorRepair 2000, ordinary
pricing / Flash Sale category 'door') with verb 'repair': prompt "Hold F to repair Escalator 2000" at the foot (door.position = props.escalator's
`foot`). Its barrier is an adapter in mall.js (`escalatorGate`): open() removes the escalator's barrier collider (+ markCollidersChanged, so
the nav grid rebuilds and zombies can route up) and hides the rope/posts/OUT OF ORDER board (props.escalator returns them as `barrierParts`);
close() (Play again) puts it all back. It opens the new zone `upstairs` ('Level 2', closed at the start, nothing spawns there yet).
The map has 7 doors now; debug O (open all doors) includes the repair. Verified in tests (real F hold: too poor / enough, Play again
reseals, the mall door ladder) and in the browser (prompt, 2000 spent, rope and board gone). Level 2 itself is still just the closed-off landing.

Second floor, step 2 of 6: the escalator is walkable. props.escalator now builds a ramp surface (plate, 30-degree slope, top plate),
tall side walls, blocks under the lane (kept 0.4 m below the surface at their start: a rider's body reaches ahead of the feet) and
still the barrier across its foot; it returns { hole, topLanding, barrier, ramp, link, upperY } and the map exposes
`navigation: { floors: [0, upperY], links: [escalator.link] }` (createGame passes it to the zombie manager) and
`escalator: { barrier, ramp }`. The barrier is a normal collider: while it stands the escalator is sealed exactly as before (the old
sprint-jump test passes unchanged apart from ignoring the enclosed lane blocks); REMOVING it (and markCollidersChanged) is what
"repairing" means, which step 3 will make a purchase. Verified with the real game: a player walks up to level 2 (y 6.3) and back
down, walking under the high end still keeps you on the ground, a zombie climbs to a player upstairs (~10 s) and comes down to one
on the ground, and with the barrier up zombies never route up. The ceiling hole runs 0.4 m past the top of the slope (the slab's edge
met a rider's body while the feet were still a little below it). tests/ramps.test.js, tests/escalatorWalk.test.js. Level 2 itself
is still just the closed-off landing.

Second floor, step 1 of 6 (the plan: multi-floor navigation core, walkable escalator, zone + repair purchase, build level 2, gameplay
integration, verification): zombies/navigation.js now supports several floors joined by ramp links (see the folder structure).
tests/navFloors.test.js on synthetic two-floor maps with a gentle staircase and the real collision code: zombies climb to a player
upstairs, come down to one on the ground, reach one standing on the stairs from both floors, and a floor with no link is unreachable.
Nothing in the mall uses it yet (floors default to [0]). NOTE for the next step: the collision code only walks over bumps under
5 cm and a circle of radius 0.32 sees steps ahead, so real stairs need a slope under ~9 degrees; the escalator (30 degrees) needs a
ramp collider type.

Visual effects settings (for weak computers): Settings > Video > Visual effects = High / Low / Off (fx/postProcessing.js
setQuality: flags + MSAA sample count only, nothing rebuilt, safe mid-run; Off draws straight to the screen) and "Dust and flickering
lights" (config/environment.js atmosphere.ambient.enabled, read each tick by maps/mall/atmosphere.js). The Video presets set them:
Low = half resolution + effects Off + no dust/lights, Medium = 75% + Low, High = native + High (the default; High's output is
unchanged from before: measured ~0.2 mean difference on 0-255). Measured in the software-rendered test browser (relative only):
High ~52 ms/frame, Off + no dust ~17 ms (about 3x faster); the dust motes alone were ~13 ms of that. Off/Low look the same colour and
brightness as High (mean difference ~5/255) minus the bloom glow, lens vignette/fringing and smooth edges.
tests/visualEffects.test.js: the three levels on a stand-in renderer, Off's draw order, settings + presets + saving, and the mall's
dust/lights switch.

Single-file build: `npm run build:single` writes dist-single/sunset-galleria.html (~1.1 MB, git-ignored), the whole game with no
other files, so it runs by double-clicking it (the normal dist/ needs a web server: browsers refuse separate module scripts and
workers from file://). No image/audio files exist (textures drawn, sounds and music synthesized), so nothing else has to travel
with it. Verified served from a plain static server (loads, title screen, a run, the music worker starts as a blob: worker, no
console errors); NOT yet opened through file:// in a real browser from here. Settings are saved per browser.

RESTOCK-O-MATIC (the ammo machine, renamed from STAPLE-O-MAT and moved from the far west wall to the Food Court's north wall just
inside the door; see Map). Same 400-point flat refill, same feature kind; new look and a live screen. The feature now returns an
update hook that keeps the screen on the gun in hand (ammoScreenText: price, FULL or SALE). tests/ammoCache.test.js has the new
position (beside the door, north wall, faces south), buying from the front and never through the wall from the hallway, solidity,
clear door lane and routes, and the screen text; tests/coplanar.test.js also covers its region (it caught the cap/body and
side-sign shared planes).

Weapon firing sounds use distinct, heavier procedural recipes: the Staple Gun has a metal/tool-body strike, the
Price Gun a short label-punch snap, the Nail Gun a pneumatic piston slam, the Foam Dart Blaster a compressed-air
burst, and the Confetti Cannon a pressure boom with paper flutter. The master compressor has explicit fast peak
control so automatic fire and the cannon retain headroom even when the volume slider is at 100%.

Original background music: "After Closing", a 43.64-second/16-bar stereo lounge loop at 88 BPM, with electric piano,
bass, soft drums, detuned pad, echoes and a borrowed-minor second-half turn. config/music.js owns score/timbres;
audio/mallMusic.js deterministically renders PCM in audio/musicWorker.js, off the gameplay thread. sound.js caches
one buffer and shares a single looping source between mall speakers; distance/occlusion/pan and speaker EQ apply.
Pause preserves the cursor; Play again rewinds. Settings > Audio > Background music saves an independent volume
(45% default, zero mutes), separate from Mall ambience and Master volume. No audio downloads or per-note timers.
tests/music.test.js covers PCM/headroom/seam/determinism, asynchronous loading/source reuse, pause/reset/mute,
speaker selection and saved settings. Preview export: node tools/exportMusic.mjs path/to/after-closing.wav.

Debug keys cleaned up: one table in config/debug.js (see the folder structure), run by game/debugCommands.js (headless, tested),
polled by main.js (raw key codes stay there) and listed by the debug window (` toggles it; ui/debugPanel.js). Still live in a
normal game, with `debug.enabled` as the master switch. Replaced the Alt+Z / Shift+Z combos and the per-feature flags
(allowShutterToggle, zombieKeys, cheatKeys): Z spawns the selected zombie type, Shift+Z cycles the type. New: K kill all (pays),
L Flash Sale now, Shift+N +5 rounds (rounds.jumpTo), G god mode (health.invulnerable), H give the next wall gun, U free tier
(upgrade the gun in hand). tests/debugCommands.test.js: table (unique, no gameplay clashes, every id implemented), key
resolution, every command in the real game/mall, god mode and the window state surviving Play again, and the window itself.

Foam Dart Blaster capacity pass: 30 darts (ten bursts), up from 24 (eight bursts). Damage, burst timing, reload,
reserve and prices are unchanged. Measured sustained DPS rises from 228 to 242 at 5-15 m; the cheaper Price Gun
remains competitive up close, and Nail Gun retains its long-range lead. Upgraded capacities remain whole bursts
(Platinum: 39 darts). Burst, cancellation, reload, base-role and upgrade-role tests cover the new capacity.

Cart Pusher (round 6+, config/zombies.js `cartPusher` + economy.zombieMix: 10% of spawns, 15% from round 10; 1.8x health;
worth 130; its 2nd spawn in round 6 is forced, with a PA banner). A Shopper-look zombie pushing a shopping cart
(zombies/cartModel.js, visual only: no collider/hitbox, shots go through the basket). Walks like a Shopper and slams like
one up close; with a clear 1.6 m-wide lane at 5-14 m (rays at cart height: walls, counters, benches and stools block it;
checked every 0.25 s) it TELEGRAPHS for 0.9 s (stands, rattles the cart, head down, rattle + squeal sound) while turning
to aim, LOCKS the direction it faces, then CHARGES straight at 9 m/s (faster than your sprint) up to 3 m past where you
stood (max 16 m). In its path (the cart's width + 0.27 m; a ~1 m sidestep clears it) = 60 damage + a 7 m/s shove
('playerHit' gets `knockback`), then a 1 s stop. A miss = it CRASHES (the nose ray hits a wall, or it runs out of charge):
stunned 2 s, cart tipped, taking 1.5x damage. 4 s cooldown between charges. Debug: Shift+Z until it is selected, then Z spawns one.
tests/cartPusher.test.js: mix/health/value/intro, telegraph -> charge -> hit + shove, hit width, sidestep -> overshoot ->
crash + stun + extra damage, wall crash stops at the nose, no charge too close/far, through a bench, a narrow doorway or a
wall (but through a wide doorway), the normal slam up close, the model (cart on the root, upright when dead, poses, dispose)
and a real charge in the real game's hallway. Verified in the browser (telegraph pose, a real hit for 60, a dodge + crash).

Cannon consistency pass: pellet cone 7 -> 6 degrees, full damage through 4 m (was 3 m), taper to 10% at 12 m
(was 5% at 10 m). Point-blank body damage remains 432, with the same ammunition, reload, fire rate and penetration.
Stationary chest simulations average 412/333/261 damage at 3/4/5 m hip, 394 aimed at 5 m; individual seeded blasts
check reliable round-3 kills at 3 m and aimed at 5 m, plus useful hip fire at 4 m. These are controlled simulations,
not promises for moving targets, off-centre aim or movement spread. Other guns are unchanged.

Mall atmosphere pass: cooler hallway, warm clearance store/Food Court, fluorescent Mart and utility corridor;
roughness contrast and scuffed tiles, soft fixture/zombie contact shadows, ceiling infrastructure, consistent
mall notices and small interrupted-shopping scenes. Subtle sign sway/tube variation and spatial HVAC/fridge/music
add life without changing routes, collision, purchases, spawning or combat. Ambient tuning is in environment.js
and audio.js; sound fades out on pause/death/reset. Decorative geometry is batched; the escalator well and combat
lanes stay clear. Regression coverage lives in atmosphere.test.js.

Shopper visual variety: coordinated weekend/office/teen/errand/summer outfits; seven top styles, trousers/shorts/skirts,
seven hairstyles, three subtle width builds, stripes/logos, occasional torn sleeves/stains/missing shoes. Most have
no accessory; others get one bag, backpack, sunglasses or headphones. Thirty clothing palettes span blues, violets/lilacs,
yellows, ivory/white, charcoal, tan and the original reds/greens; accessories also have brighter choices. Head position, hitboxes, health, speed and
attack behavior are unchanged. Mall Walkers retain their original tracksuit/headband design. Rigid details batch
by material on each animated bone; materials are shared only within one zombie so hit flashes stay isolated,
and per-model merged geometry is disposed with the corpse. Appearance is picked once per spawn.

Prone: Ctrl (either side) / controller LB (L1) toggles a grounded prone stance. Crawl speed 1.25 m/s,
collision height 0.55 m, eye height 0.38 m; lowering eases the camera and shrinks collision with it.
Space/A or the prone button gets up without jumping; C/B rises to crouch. Headroom checks fall back to crouch
or keep prone under low cover. No airborne dives, sprint, slide boost, vault or melee lunge while prone;
shooting, ADS, reloads and ordinary zombie damage still work. Prone speed is a player stat, reset each run.
The first-person body lies low with legs behind the view; Controls diagrams/list and How to play include prone.

Menu audit fixes: Settings/Controls isolate keyboard focus and make background menus inert. Hidden menus explicitly
clear backdrop blur; entering play also closes Settings/Controls, including after a delayed pointer-lock grant.
Controller Settings navigation includes Reset tab, Reset everything (two presses), and Back; closing cancels a pending confirmation.
Preset selection tracks the selected button, including equivalent values, and custom values step to either endpoint.
Splatter changes clear existing flesh effects and red pools on the next rendered frame even while paused; dust,
tracers and persistent gun marks are preserved. Video shows native percentage and actual render/display pixel sizes.
Low/Medium/High target 50%/75%/100% of capped display density (2x maximum); exact native default avoids rounding down.
Saved pixel-ratio values remain compatible; select High to undo a previously saved low-resolution setting.

Gun-specific world impacts: embedded staples, crooked price stickers, protruding nails, foam darts and confetti/streamer
clusters. Cosmetic only; uses hitscan worldHit metadata after pierce. A visual ray verifies real map/debug-range mesh
surfaces (never invisible collision proxies, sprite labels or moving shutters), with corner checks to avoid overhanging
edges. One global 200-mark cap; Cannon limited to 2 projection attempts per blast; startup warms the 13 shared variant
pools and sticker textures. Restart clears marks; unloading a surface removes its marks on the next effects update.
Browser verified each signature, 300 impacts recycling to 200, restart to zero; projection averaged ~0.26ms per attempt
in the local test browser. Damage/points/accuracy/ammo are unchanged; regression suite, build and balance report pass.

Mega Mart stock variety expanded to 31 product types: camping gear, snack packs/jars/cups, mixed holiday decorations,
and household bottles/tissues/towels/pans. Independent per-shelf seeds give each level unequal runs of tidy, disturbed and
heavily looted stock: varying group sizes/gaps, front-to-back placement, crooked or fallen items, and occasional stray products.
There is no fixed pair/bay grid. Actual model bounds space neighbours apart and keep stock supported, inside the shelf
footprint and below the next shelf. Placements stay the same between runs. Existing clearance/vault/purchase regressions
pass; no collision, lighting, economy or combat changes.

Mega Mart detail pass: department-specific stock replaces generic product cubes, with sparse bays, checkout clutter,
receiving/stockroom wear, toy promotion, perimeter trolley and fluorescent housings. Gondola/counter collision and prices
are unchanged; only the visible-size parked trolley adds one small collider away from the main routes. Both existing lamps
are retuned in environment.js, with no extra lights. New clearance tests plus real checkout-vault/purchase tests pass.
Browser verified all four checkout vaults, walking through both entrances, the 1200-point Foam Dart buy and trolley collision.

Start-room detail pass complete: clearance-store checkout, picked-over shelves, framed zombie vents, sale remnants,
Price Gun station, missing employee photo, floor wear and static warm/cool lighting. No new colliders, prices, spawns
or gameplay features; shelf visuals opened up within the original collision footprint. Small static boxes are batched
by material. Tests cover clear fighting/spawn/vault spaces, valid geometry, a real vault and the 500-point Price Gun buy.

Store flicker fix: z-fighting where my new geometry shared planes: the pod back-wall paint panel under the signs/screens, the door
frame posts against the window sills, the store ceilings against the wall edges, the Customer Service booth's desk against its filing
cabinets, and its warranty card against the tier stickers. Fixed (thinner panel, posts 2cm proud, ceilings inside the walls, no
overlaps) and pinned by tests/coplanar.test.js (verified to fail when two of the bugs are put back).

Real stores: the Food Court's four shops are walk-in rooms (maps/mall/stores.js) with the attachment counters inside (barrels moved
from the Mega Mart pegboard to Nuts & Bolts), each with a zombie clerk, its own look and a zombie spawn just inside its door; the
Customer Service desk is a walled booth with a service window and clerk. Two south shops are recessed into the wall (6m deep), two
north shops are pods (4.5m) against the hallway wall; the north pillars and the Mega Mart pegboard are gone. Found while building:
the west pod first sealed the ammo machine's corner off (0.7m gap beside the planter), so both pods sit 0.6m inward (1.3m gap), and
the spawning test now compares origins with the number of LOCAL markers (a far corner like the ammo cache has only two close ones).
Verified by tests (210) and in the browser: every store looks right from outside and at the counter, the booth too.

Upgrade audit fixes: Platinum purchases and switching to a Platinum gun no longer read an invalid next-tier price
and freeze rendering. The interaction prompt rechecks availability before reading dynamic fields. Laser Pointer scales
bloom recovery along with bloom, preserving its intended hip benefit / ADS penalty during repeated bursts. Gun-model recoil
reads resolved stats, including shots and dry clicks before the first render after an attachment change. Display cases now
visibly reach their 1.25m collision height, with parts and name cards raised to match. Regression suite: 208 passing;
build and balance report pass (base gun numbers unchanged). Browser checked all three tier purchases with live F holds,
continued animation after Platinum, switching to the Platinum gun, case prompts/geometry, and fitting/firing Grip Tape.

Gun upgrades steps 3 + 4 done: the four store attachment counters (see Map) and the upgrade parts on the gun models (every
attachment has a visible part on every gun it fits; the tier sticker shows on the gun from Deluxe up). Verified in tests and in the
browser (real F hold at Byte Me fits a Laser Pointer to the staple gun for 750 and its beam shows; all four counters display their
parts; parts checked from both sides and from the player's view on all five guns; the Zoom Lens stays clear of the sights in ADS;
the grip tape is wound round hand + grip because the hand hides the handle). Gun upgrades are complete.

Debug O opens all doors together (or closes all when every door is already open). It no longer inverts each door:
buying the start shutter and then pressing O used to close it, lock the hallway zone and hide both the Nail Gun and
Customer Service prompts. Regression tests cover mixed door states and actual purchases at round 7 after debug open-all.

Gun upgrades step 2 of 4 done: the Customer Service desk (see Map) + the tier under the ammo counter. Buying a tier never refills
ammo (the user's call). Verified in tests/upgradeDesk.test.js and in the browser (real F hold: Staple Gun -> Deluxe for 2000,
damage 30 -> 42, magazine 12 -> 14 without a refill, HUD "Deluxe warranty"; the desk, signs and green-to-gold stickers look right).
Gun upgrades step 1 of 4 (the system; branch claude/gun-upgrades, which also has Codex's loop shortcuts merged in): Extended Warranty tiers + store
attachments as data (config/upgrades.js, prices economy.upgrades: tiers 2000 / 4000 / 8000, attachments 750-1000) turned into
mods by weapons/upgrades.js and applied with playerGun.setMods. Tier damage x1.4 / x2.1 / x3.5 keeps round-8 shot counts until
rounds 12 / 17 / 24. Roles hold at every tier, but the tiers' magazine/reload bonuses help reload-heavy guns a little more, so
the Foam Dart Blaster's 15 m lead over the Nail Gun becomes a near-tie at Premium/Platinum (within ~2.5%). Next: 2) Customer
Service desk (map feature, hallway by the elevator, position as data) + tier on the HUD, 3) attachment counters, 4) tier sticker +
attachment parts on the gun models.

Range pass (Staple Gun, Foam Dart Blaster, Nail Gun): every gun now has a range role. Staple Gun falloff full to 10 m -> 70% at
25 m (weakest at every range: 128 dps up close, 89 at 30 m). Foam Dart Blaster 50 -> 52 damage + falloff full to 15 m -> 75% at
30 m: the mid-range gun (best non-shotgun at 15 m: 228 vs Nail 222 / Price 217; just under the Price Gun up close, 228 vs 231;
172 at 30 m). 55 was tried and rejected: it beat the Price Gun up close. Nail Gun unchanged, no falloff: the long-range gun,
222 at 30 m, now 29% ahead of the next gun (was 1.4%). tests/balance.test.js pins all of it; `npm run balance` shows 15 m.

Loop shortcuts implemented on codex/loop-shortcuts in four steps: multi-zone doors, Food Court / Mega Mart (1000),
Service Corridor / Food Court (1250), then full routing/spawn/purchase verification. Both use ordinary shutter doors,
existing pricing and map data; each opens both adjoining zones and buys from either side. Door/zone reset preserves
overlapping holders until all close. Sixteen spawn markers and weapon/buy-station positions are unchanged.
Tests cover every purchase order, shortcut-only entry, both-sided interaction/collision/nav, natural Mega Mart wave spawns,
and local spawn selection at six positions with entrances only, shortcuts only and both loops. No gun code changed.
Browser verification (Chrome, fixed 60Hz): real F holds buy both shortcuts from either side at 1000 / 1250; ordinary
movement completes the main loop in 12.92s and west loop in 14.98s along clear waypoints, without sprint/sliding.
Controlled Shopper travel at 3.4m/s (includes 1s emergence; stop within 2m of a stationary player): Mega Mart rear vent
(21.8,-23.2) -> east Food Court (18.4,-8.3), closed shortcuts 19.58s / open 5.50s; corridor end (-21.8,-13.2) -> west
Food Court (-17.3,-12.2), 17.32s / 1.98s. Food Court east shop -> hallway centre stays ~7.5-7.6s; hallway northeast vent ->
Food Court entrance stays ~6.1-6.3s. These are controlled route timings, not survival/difficulty benchmarks; normal
4m spawn exclusion remains in force (all these origins are outside it).
Twelve-Shopper groups at 3.4m/s all crossed each doorway: first/last 2.53/5.52s east, 1.68/4.53s west (includes emergence),
no rescues, no climbing. A 12-zombie Z/Shift+Z horde aimed at the Food Court used both routes: Mart 2 shortcut / 1 hallway;
corridor 1 shortcut / 1 hallway. Horde timing used extra player health to observe routing, not a survival run. Close crowd
pressure can still shove the player. The cannon still buys for 1500 from its original corridor spot, cannot buy across
the opening; RESTOCK-O-MATIC refills for 400 from its front, never through the wall. Within 1m of the cannon its existing
facing-free prompt can take priority over the shortcut; stand nearer the corridor centre to buy the shutter.
Keep the agreed door widths/prices.
Browser-found fixes: floor beneath the west shared wall (the debug range shifted grid centres and revealed a 30cm
unsupported strip; map-only nav had missed it), and Food Court sign 4cm off the Mart wall to clear its 2cm brand stripe.
Both have regression tests. Final verification: 176 tests and production build pass (existing bundle-size warning only).

Codex refactor-review fixes (no gameplay change): a pierced/pellet hit on a target that is already dead (e.g. killed by a
'kill' listener earlier in the same shot) no longer pays +10; the 'purchase' event reads label/kind/id BEFORE use() (buying a
gun reports the gun, not "<Gun> ammo"); once dead nothing more is paid or counted; the feature and price registries only
accept their own entries (no 'toString' kind/category); resetPlayerStats removes undeclared fields; features are built after
the core event wiring with a richer ctx (g.features.context); discount rounding is economy.discountRoundTo. Tests for each.

Codex playtest follow-up: Foam Dart Blaster damage 45 -> 50 (round 3: two body bursts; round 5: one head burst), Confetti
Cannon wall ammo 750 -> 500 (the 400 RESTOCK-O-MATIC was cheaper than the wall). Fixes: a shot ends any reload pose at once
(viewmodel.fire sets reloadWeight 0), so the cannon no longer fires with its barrels open when firing cuts a shell-by-shell
reload short; the balance report's magazine time no longer counts the last shot's recovery (it overlaps the reload, as in
weapon.js) and labels shots vs trigger pulls (Foam: darts (pulls)); the cannon ceiling check is "no single BODY blast kills
round 5" (a point-blank head blast can: deliberate risky reward). Corrected sustained dps: Price 231, Nail 222, Foam 219,
Cannon 439 at 2 m. Watch: Nail vs Foam at 30 m is now only ~1.4% apart (the role check still passes); if the Nail Gun's
long-range role feels blurred, give the Foam Dart Blaster a little very-long-range falloff.

Gun balance rework (roles + upgrade-ready structure): every hit's damage comes from weapons/gunStats.js hitDamage, falloff
is a per-gun option, gameplay reads each slot's RESOLVED gun (resolveGun: config + mods), so Build-A-Blaster / attachments
are data (playerGun.setMods). `npm run balance` prints every gun as it plays; tests/balance.test.js pins the ROLES.
Confetti Cannon (room-clearer, updated consistency pass): 12 pellets x 36 (432 point blank), 6 deg hip cone (x0.45 aimed),
full damage through 4 m then down to 10% at 12 m, 6 + 24 shells. Controlled chest simulations average
432 / 412 / 261 / 71 / 11 damage at 1.5 / 3 / 5 / 9 / 12 m hip (aimed: 394 at 5 m). No single all-body blast can kill
round 5. Hip sustained DPS is 439 at 2 m, 265 at 5 m and 45 at 10 m. Price Gun (cheap close-range sprayer): 28 dmg (was 25), 32-round
magazine (was 24), 1.3s reload (was 1.4), 192 reserve, falloff full to 12 m -> 60% at 30 m: sustained 226 dps up to 12 m
(best of the non-shotguns; Nail 209, Foam 186), 137 at 30 m (below Nail/Foam). Known balance smell left alone: the Foam Dart
Blaster (1200) out-damages nothing it costs more than (186 dps vs Nail 209 at 1000); its role pass is a later step.

Visual fixes: corridor caps extend across their own side walls only, so the Service Corridor end cap no longer
overlaps/flickers through the Food Court wall beside the RESTOCK-O-MATIC. The Price Gun front sight post is seated
in the housing (its tip/ADS position stays the same). Confetti Cannon has fitted support-hand/thumb geometry,
a hinge below and forward of the breech, open rear bores and a shell/hand path that clears the receiver. Its
closed muzzle position and gameplay/reload timing are preserved. The Foam Dart Blaster and Confetti Cannon front-sight
beads sit on posts (they used to float above the body). Tests/weaponModels.test.js checks sight
attachment and receiver clearance across the reload; corridor/mall tests cover the shared-wall cap.

Zombie health tuning: 150 HP in round 1, +75 per round through round 9, then +7.5% per round.
This reduces bullet-sponginess (round-8 Shopper: 675 HP, 27 Price Gun body hits / 8 Nail Gun body hits).
Mall Walkers retain 65% of Shopper health. Zombie damage, movement, spawning and weapon stats are unchanged.

Local zombie spawning implemented: eligible markers are ranked by the existing weighted navigation field (wall
penalties mean route cost is not literal walking meters). New spawns pick 50% from the nearest four and 50% from
markers within 30 cost units of the cheapest safe marker. Open zones and reachability still gate every choice.
Player distance (4m horizontally) and live-body clearance (both radii + 0.25m, including emerging zombies) are
mandatory; no safe point returns null so rounds retry without spending quota. Prefer markers off a 3s cooldown;
if all safe local markers are cooling, relax only cooldowns, inside that same neighbourhood. Successful spawns
and stuck rescues record reuse; clear/new-run resets it. Rescues exclude their own body and keep health. Explicit
debug spawn positions still bypass marker selection. Tests/spawning.test.js covers selection, safety, cooldowns,
round retries, rescue health/occupancy and the real mall at six player positions. Distant-zombie recycling deferred.

New wall guns implemented: Foam Dart Blaster (Mega Mart, 1200 / ammo 600), three-round burst, 45 damage,
3x heads, 24/144 ammo, 0.07s between darts then 0.35s recovery, 1.9s drum-swap reload. Confetti Cannon
(Service Corridor, 1500 / ammo 750), six-shell tube, eight 32-damage pellets per blast (256 point blank: one-shots rounds
1-2, two-shots rounds 3-5), 2x heads, 5.5deg hip / 2.75deg ADS pellet cone, full damage through 6m then linear falloff to
20% at 14m, each pellet goes through a second zombie at half damage, 6/30 ammo, 0.55s between blasts. SHELL-BY-SHELL
reload (`def.shellReload`: 0.4s open, 0.4s per shell, 0.35s close; ~3.2s from empty, ~1.2s for one shell) and firing
interrupts it as soon as a shell is in (shells already loaded stay). Weapon.reloadProgress maps the phases onto windows of
the reload animation (start 0-0.3, ONE shell 0.3-0.7 repeating per shell, close 0.7-1); one load sound per shell. Existing balance numbers and prices preserved. Burst reload requests
wait for the final dart; switching, melee and vaulting cancel remaining darts. Pellet scoring uses the usual
hit/kill payout once per zombie per blast (killing pellet decides head bonus); walls and front bodies stop pellets.
Tracer pool is now 16; max shotgun wall puffs is 4, both in feel.effects. Tests/newGuns.test.js covers burst cadence,
cancellation, queued reloads, pellet damage/headshots/walls/scoring/accuracy, round damage tables, model/sound
registration, the tracer pool, and both real-mall buy/refill spots. The only main.js change adds the ADS-scaled
pellet cone to the crosshair. Built by Codex on codex/new-guns (plan: docs/codex-new-guns-plan.md), integrated into main
alongside the ammo cache (RESTOCK-O-MATIC refills either new gun in hand for its flat price).

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
- **Vault:** move toward the start room's checkout counter, a Mega Mart checkout counter or a Food Court bench
  (the old concourse benches) and press jump (Space / A).
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
244 vs 375), same 40-damage slam and wind-up, same 60-point kill value. Winded after every swing (hit or miss):
stands bent over panting for 1.2s (no attacks), then follows at half speed for 0.6s: your opening. Squeaky
sneakers + huffing while chasing, panting when winded (louder when close, silent past ~12-14m). Spawn mix: 15% of
spawns from round 4, 25% from 6, 30% from 9 (part of the normal count); in its first round the 3rd spawn is forced
to be one if none came yet, and its first spawn in a run plays the PA chime + "Attention shoppers / Mall Walkers
have entered the building" banner. Debug: Shift+Z until it is selected, then Z spawns one. Verified in the browser (looks, power walk, a real
hit + winded pose, round-4 banner) and by tests/zombies.test.js.

Map expansion (before Cart Pusher / Mannequin / shop systems). Done earlier: map kit (world/mapKit.js) + mall
props/palette split out of mall.js (verified identical), doors can share a zone, the nav grid rebuilds on any marked
collider change; the Mega Mart + its 750 door.
REVISED PLAN (hub layout): the start shutter opens into a new MAIN HALLWAY (hub); Mega Mart (750), Food Court (1000)
and Service Corridor (1250) are each bought off it in any order; the hallway also gets an escalator + elevator
(sealed: "out of order" / "service only") as the way up to a second floor later; the Service Corridor is built from a
modular segment list so it can be extended. Steps: 1) hallway + the concourse becomes the Food Court (DONE),
2) escalator + elevator, sealed, 3) Food Court dressing (stalls, tables), 4) corridor segment builder, 5) Service
Corridor + 1250 door, 6) optional loop shortcuts (Food Court <-> Mega Mart, corridor <-> Food Court).
Step 1 done: hallway hub (see Map), the old concourse moved south as the Food Court behind a 1000 door, Mega Mart door
moved to the hallway's east end, Nail Gun wall buy moved onto the hallway wall (so it's still available right after
the 500 shutter). Verified: tests/mall.test.js (each area sealed until its own door is bought, in any order; Nail Gun
spot reachable after the start shutter; reset seals everything) and in the browser (real F-hold buys the start
shutter, the hallway/Food Court/Mega Mart look right, zombies reach the hallway from the Food Court in ~8s and from
the Mega Mart in ~10-14s).
Step 2 done: the escalator + elevator, both sealed (see Map). Verified: tests (sealed against a real sprint-jumping
player, walk-under clearance, ceiling open only above the escalator, the level-2 landing closed in, elevator wall
solid) and in the browser (escalator, hole + landing and elevator look right; zombies route round and under the
escalator and never leave the floor). Making them usable is step 7 (second floor, multi-floor navigation).
Step 3 done: Food Court dressing (see Map). Verified: tests (every stall queue spot + table lane reachable, nothing walkable
behind the counters, counters out of jump reach, a real player sprint-jumping at Burger Barn stays on the floor) and in
the browser (stalls, awnings, tables look right; zombies weave through the tables to the stalls and out to the
hallway in ~7-8s and never climb). Known nit: from the door the tree planter hides most of WOK THIS WAY's sign.
Step 4 done: the modular corridor builder (world/corridor.js + kit.corridor; no change to the map yet). Verified:
tests/corridor.test.js (straight / L / zig-zag / U-turn shapes: no floor overlaps, no wall pieces in the walkway, sealed on
every edge and corner; doorways + lintels, shared-wall gaps, open ends and branches exactly where asked; a real nav grid
walks a corridor end to end and through a branch doorway), and a throwaway sample corridor rendered in the browser.
Found + fixed while building it: walls extended at INSIDE corners poked a post into the walkway (now outside corners
only); an open end left no floor under the doorway it joins, so the nav grid couldn't cross (now the floor reaches
through); wallSegments stretched a wall when an opening hung off its end (openings are clipped now).
Step 5 done: the Service Corridor + its 1250 door (see Map), built with kit.corridor. Verified: tests (1250 in the
door ladder; sealed until bought, in any order; every part reachable after, lockers solid; no back way into the Food
Court through the shared wall; a real player walks in through the doorway to the dead end) and in the browser (a
real F-hold buys it for 1250; doorway + sign and the corridor's dressing look right; zombies from its 3 spawns reach
the hub in ~8-12s and never climb). The hub layout is now complete: start room -> hallway -> Mega Mart / Food Court /
Service Corridor, in any order.
Codex audit fixes, in steps: 1) light budget (SHELVED, see below), 2) sign textures cached + sized to the sign (low value on
a dedicated GPU), 3) merge static map meshes (fewer draw calls; low value for now), 4) no buying through walls (DONE),
5) map dispose removes its colliders + frees GPU memory, wall/corridor builders reject overlapping openings / self-crossing
corridors (DONE).
Step 1 shelved: a pool of 4 real point lights moved to the nearest lamps (world/lightPool.js) halved frame time on Intel
integrated graphics but made no difference on the user's NVIDIA card (Firefox), so it's in `git stash` ("step 1: light
budget"), not in the game. The "big circles on the ceiling" the user saw were the lamps themselves (hung 0.8m under the
ceiling = a hard bright disc); fixed by hanging lamps at ~60% of ceiling height with matching intensity (see Map > Lighting).
Step 4 done: buy spots need a clear line from the eye and 3D range (interactions.js; main passes `colliders`, doors pass their
shutter as `seeThrough`; shutter exposes `collider`). Fixes: the Nail Gun could be bought from the Food Court through the
wall; a second floor would have reached ground-floor buyables. Verified: tests/interactions.test.js (7) and in the browser
(real held F buys the start shutter and the Nail Gun; no prompt behind the wall).
Step 5 done: kit.dispose() (map.dispose calls it): unloading left all 117 colliders behind (a reload doubled them into
invisible walls) and never freed GPU memory; now the shared list is back to exactly what it was and every geometry/material/
texture is freed (tested, incl. reload). wallSegments throws on overlapping openings (one doorway's lintel used to hang into
the other); corridorLayout throws on a self-crossing loop or runs too close together (both used to build overlapping floors /
walls). None of these were triggered by the current mall; they protect future maps and rooms. Steps 2-3 remain optional.
Ammo cache done (first of the "flesh out the new areas" items): the vending machine above. Verified: tests/ammoCache.test.js (5) and
in the browser (real held F refills the staple gun for 400; no prompt when full, far away, or from the Service Corridor side of
the wall). Cover/funnels remain optional; loop shortcuts and the two new guns are in (see the top of Current state).
Step 6 done: loop shortcuts (Food Court <-> Mega Mart, Service Corridor <-> Food Court); see Map and the top of Current state.

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
  +75/round through round 9 then x1.075/round, zombie count `round(6 + 2.5*(round-1))`.
  Full values live in `src/config/economy.js`.
