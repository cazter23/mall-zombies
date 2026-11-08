# Sunset Galleria: folder structure (every module)

> Moved out of CLAUDE.md (verbatim) so the file every session loads stays small. One entry per module: what it is for and its interface. Read the entries for the modules you are about to change (grep for the file name).

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
  config/attachmentVisuals.js Per-weapon attachment sizing, near-side rail placement, short-barrel spans and held reload copies.
  weapons/attachmentComparison.js Compares fully resolved builds: magazine, reload, damage, range, accuracy, aim time and recoil.
  weapons/models/shortBarrel.js Reversible front-segment geometry variants, preserving moving-parent transforms and owning both variants.
  config/retailUnease.js Rare atrium display changes and localized back-room sound timings/ranges; no gameplay tuning.
  game/features/retailUnease.js Called by the existing horror feature: unseen mannequin turn, shared empty-concourse TV feed,
                        distant upstairs silhouette. Quiet intervals, comfort gates, reset and static-batching-safe hooks.
  boot.js               The page's entry point: waits for the web fonts (core/fontsReady.js, list and time limit in config/fonts.js), then imports main.js.
  config/workshop.js    Build-A-Blaster: Limited Edition numbers (workshopBuilds), the ritual (workshopRitual: time, qualities, stages, loaner, PA), Stuffings and Hearts, buildOf reads a gun's finished build.
  ui/bagMarker.js       The HUD arrow to a dropped Limited Edition: name, distance, floor, time left.
  weapons/models/loanerTag.js The Courtesy Loaner's security tag and swinging card (reversible, like the other upgrade visuals).
  game/features/workshop.js The workshop feature: builds the ritual, its effects and the Limited Edition drops, runs Party Trap charges.
  game/features/limitedEditions.js The bag a shopping-bag zombie sometimes drops: walk over it and Party Trap or Clearance Rack fits a gun you carry, free.
  game/features/workshopRitual.js The Build-A-Blaster ritual: idle, running, ready. Bench, gun on the conveyor, gauge, lever, maximum time, Naming Booth, chute steering. Built by workshop.js.
  game/features/workshopStuffings.js What a finished build does: one function per Stuffing, one per Heart. Hearts read 'shot' and hand off to the stuffing; nothing here emits 'shot', so a stuffing's kills can't fire a Heart.
  game/features/workshopSpectacle.js Ritual mode: tank fill, party colours on the hall's two lamps, bulb string, belt, arm, flap, lever, jingle. Show only; reset() puts every part back.
  zombies/confusion.js  Glitter's AI: a confused zombie forgets the player and fights the nearest other zombie with its normal attack.
  zombies/tankDeath.js  A kill in the room flying into the Stuffing Tank (visual; the kill is already paid).
  weapons/models/buildVisual.js A finished gun's look: seam, patch and stitches in the stuffing's colour, lumps and leaking tufts when Overstuffed. Instanced, placed from the sticker and top mounts.
  ui/birthCertificate.js The Birth Certificate notice at collection. Clears itself; nothing pauses.
  ui/ritualHud.js       The order ticket on the HUD: your picks, then the gun's stage, gauge and time (reads the ritual's status).
  game/features/clearanceRack.js Clearance Rack tags on up to three zombies; a headshot on a tagged zombie pops them all.
  game/features/clearanceSticker.js The canvas sticker drawn on tagged zombies.
  zombies/partyTrapDeath.js The pose, ribbon and confetti after a trap kill. The kill is paid on impact; this is visual only.
  weapons/models/workshopBuilds.js The reversible model changes for each workshop build.
  maps/mall/workshopRoom.js The Build-A-Blaster storefront and back hall (island, booth, lever, chute) and their dressing. Layout numbers: config/promenade.js workshop.
  ui/announcements.js   Bounded PA queue: type introductions priority 2, incentives 1, routine messages 0;
                        clear on pause/death/reset; wall-clock presentation timers only
  config/
    haptics.js          Controller vibration intensity and per-gun/damage/pickup durations, motor strengths and priorities
    bosses.js           Boss debut windows, wave timing, combat and control tuning, PA lines, and the Janitor's costume
                        and Wet Floor settings. Boss kill values and health scaling go through economy.js.
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
                        serviceCorridor 1250, foodCourtMegaMart 1000, serviceCorridorFoodCourt 1250, departmentStore 1250,
                        departmentStoreStartRoom 1250) +
                        wall-buy prices, ammoCache.price (400, flat, any gun), round timing, wave scaling + helpers
                        (zombieHealthForRound, zombieCountForRound, spawnDelayForRound, maxAliveForRound).
                        zombieMix: special types per round (mallWalker: from round 4, share 15% / 25% from 6 / 30% from 9,
                        healthMultiplier 0.65, introSpawnIndex) + zombieHealthFor(typeId, round), zombieTypeForRound(round).
                        Mascot enters at round 10 with 5x Shopper health and a two-alive cap.
    weapons.js          stapleGun (start pistol, semi), priceGun (wall buy, full auto), nailGun (wall buy, semi,
                        piercing: `pierce: { maxTargets, damageFalloff }`), foamDartBlaster (Mega Mart, burst),
                        confettiCannon (Service Corridor, 12 pellets, pellets pierce 2 zombies, six-shell tube, shell-by-shell
                        `shellReload`), rivetRifle (Grand Atrium wall buy 1500), coilNailer (Cinema projection-passage wall buy 2500), barcodeScanner (HOFFMAN'S wall buy 1750; `fireMode: 'charge'`).
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
    observation.js     Fixed-tick head/chest sight rays against world colliders with base FOV/aspect and edge hysteresis.
    mannequinModel.js  Articulated faceless plastic model, joint seams/inventory tag, frozen pose retention and owned disposal.
    mascotModel.js      Sir Waffles' articulated foam costume and smaller zombie head. Places fixed-tick hitboxes from the
                        posed pieces. Owns the detached helmet, stuffing burst and their cleanup.
    bosses/janitor.js   Places, ages and disposes Wet Floor patches on clear floor. Slows the player on contact and
                        calls into the incentive system to mop Spill Cleanup.
    bosses/janitorModel.js  Adds Murray's uniform, bucket, wet floor sign and animated mop to the standard skeleton.
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
                        distance through ctx.onSound. The Mascot sheds its helmet at half health, immediately swaps head
                        hitboxes, and accelerates into a rush.
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
    runStats.js         createRunStats(): time alive, kills, headshot/melee kills, bosses defeated, shots fired/hit, accuracy
    bossDirector.js     Picks debut rounds, retries a normal-marker spawn partway through the wave, and blocks round
                        completion while a boss is pending. Owns encounter behavior and emits boss lifecycle events.
    powerUps.js         createPowerUps(): listens to kill/round/death events; earned dynamic pickups on clear floor,
                        swept walk-through collection, 15s expiry, no repeats, per-round caps. Blue Light multiplies only
                        base kill credit, within its 4m radius, same floor and line of sight. reset/dispose; debugDrop(id, at)
                        marks the run assisted. Boss rewards wait for the pickup slot, survive natural wave progression
                        and clear on death, Play again or debug skips. createGame builds/ticks/resets it as g.powerUps.
    incentiveEffects.js Temporary employee benefits: concurrent timers, reversible stat modifiers, finite healing,
                        deferred non-recursive liquidation damage, one-purchase coupons, target marks, slow patches,
                        overtime extensions, melee charges and sprint pulses. Owned/reset/disposed by powerUps.js.
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
                        already fitted, when it doesn't fit (Extended Nozzle on the Nail Gun), area closed or busy. First purchase
                        unlocks free refitting across compatible carried/replacement guns for the run; reset clears ownership.
                        Counters display resolved comparisons and preserve ammunition. Fully owned attachments are ineligible for Flash Sales.
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
    mall/atriumDetails.js  Authored shop interiors, kiosk merchandise, fountain/floor details, overhead decorations and small scenes.
                        Uses config/atrium.js; no colliders/lights/interactions. Only ripples/mobile animate; kit owns disposal.
    mall/atriumStorefronts.js  Twelve sealed shops with real shells behind wall openings, glazing/locked doors, themed stock and
                        fixtures on both floors. Shared lettering atlas; returns wall-opening data to atrium.js, which seals each with a collider.
    mall/levelTwo.js    buildLevelTwo({ kit, props, floorY, supportRects, hole, layout }) -> { spawns, lamps }: LEVEL 2 shell,
                        independently sized by config/promenade.js (merged into LAYOUT.level2); floor sections use existing downstairs
                        ceiling support where available and add structural slabs elsewhere. Main perimeter, roofs, reserved closed
                        connections, railings, furniture, shop frontages and upstairs spawns; mall.js hangs the existing lamps.
    mall/parkingLot.js  Customer Parking through Mega Mart's former emergency exit. config/parkingLot.js holds its footprint,
                        entrance, vehicle row, fences, lamps, spawns, sky, ambience and benchmark shot. Builder returns its shutter,
                        spawns, lamps and culling room/portal; mall.js wires ownership, grades, horror and reset. Kit owns disposal.
    mall/parkingSurroundings.js  Scenic intersection, sidewalks, planted verges, roadside shops, distant buildings/cars,
                        utility poles/wires and mall pylon. Uses config/parkingLot.js; no colliders or additional real lights.
    mall/parkingDetails.js  Worn asphalt/paint, repairs, engine stains, puddles, drains/weeds; RV fittings, wall services and
                        three abandoned scenes. Adds solid vaultable trolley/chair collision and a tall electrical cabinet.
                        Painted light uses lookKit; local haze and a gently moving sign respect ambient-effects settings/reset.
    mall/parkingStreetDetails.js  Bus shelter/timetable, bins, street names, roadworks, stopped car, warm shop windows and
                        delivery notices. Scenic geometry only; uses config/parkingDetails.js alongside parkingLot.js.
    mall/parkingDetailKit.js  Shared boxes, rods, signs, planes and canvas decal materials; all resources owned by mapKit.
    config/parkingDetails.js  Authored wear/scene/service/street locations, RV labels, haze/sway settings, ambient loops/events.
    mall/mallExterior.js  Opaque outer Atrium facades, roof and returns close the building beyond Mega Mart. Meshes opt into
                        userData.alwaysVisible so room culling preserves the building silhouette while hiding its interior.
    mall/promenadeShop.js  SHOE-PER SALE interior: two entrances, perimeter shoe shelves, fitting mirror/bench, shoe boxes and a low
                        island with a clear momentum-vault crossing. Shares upper-floor unlock/navigation/reset/disposal.
    mall/departmentStore.js  HOFFMAN'S room (floor, walls, roof, panels, stockroom door + west vent, spawns); config/departmentStore.js
                        has every number. mall/departmentStoreFixtures.js: vaultable cosmetics/fragrance/layaway counters, round
                        clothing racks (see-through topper colliders), mannequins on plinths, fitting rooms, shoe wall. Its look:
                        zoneLooks.js buildDepartmentStoreLook + look.departmentStore. mall/departmentStoreDetails.js (data: config/
                        departmentStoreDetails.js): the detail pass: wall shelving (knits west, layaway bags north: the only colliders), counter-top
                        scenes, fitting-room scene, wall mirror + busts, brass beams + hung banner + sprinklers, interrupted-shopping litter, ambience
                        emitters. mall/seamDetails.js: the receiving door on the stair connector's east wall and the Promenade side of the cinema's
                        front (now-showing one-sheets, ticket stubs).
    mall/promenadeDetails.js  Fixed upper-floor dressing: low sunset medallion, perimeter upholstery, directory/phones/magazines,
                        overhead signs/diffuser, Build-A-Blaster renovation frontage, closed Pretzel Palace counter and shoe tickets.
                        Called with the existing look kit; no new collision/lights/purchases/timers. Kit owns resources; static parts batch.
    config/promenade.js  Independent upstairs bounds/sections, slab/wall dimensions, shoe-store geometry/finish data and three
                        expansion connections (west/east wings, COMING SOON workshop). West connects to the live cinema door;
                        the east wing and workshop remain solid reserved closures.
    config/cinema.js     Independent upstairs lobby, Screen 1, passage, seat blocks, future sealed connections, spawn markers,
                        colors, two pooled lamps, spatial ambience and procedural slide data. Entrance price: economy.doors.cinema.
    mall/cinema.js       Physical cinema wing, shutter, upper-floor spawns and room/portal/grade/ambience metadata. The Promenade
                        owns their shared wall. Lobby -> auditorium -> projection passage -> lobby is a flat-floor fighting loop.
    mall/cinemaDetails.js  Patterned carpet on the actual floor, velvet curtains, concessions/box office cases, exit signs,
                        acoustic panels and one reusable slide texture/projector beam. Orchestrates cinemaArchitecture,
                        cinemaLobbyDetails, cinemaAuditoriumDetails and cinemaStoryDetails; shared geometry/canvas helpers
                        live in cinemaDecorKit, authored cosmetic data in config/cinemaDetails.js. No colliders or real lights.
                        Ambient extras freezes slides/poster motion and hides beam/dust; screen animation uploads at most
                        five times per second while rendered. Clutter controls litter. Map owns update/reset/disposal;
                        static parts batch by room. cinemaServiceDetails dresses the passage/stairs/return without collision.
    config/cinemaFinish.js  Second cinema pass: service runs, equipment landmarks, lobby entrances, carpet bounds and fabric bays.
    mall/cinemaPublicFinish.js  Lobby carpet borders, waiting seats, premiere banners, concession frontage/packaging, usher station,
                        poster cases and letter-board showtimes; auditorium fabric panels, aisle strips, pelmet and chamfered seats.
    mall/cinemaServiceFinish.js  Projection tile/dado, conduit, guarded lights, rewind bench/transport cases and access cabinet;
                        return blockwork, meter bank, delivery/checklist scenes, overhead channels and stair concrete joints.
    mall/cinemaPrint.js  Map-local canvas print sheet shared by row letters, forms, packaging and cinema identity signs so they
                        batch with the existing static system. Each map owns its sheet/material; no runtime canvas updates.
    config/cinemaStairs.js  West stairwell/return-passage bounds, ramp plateaus, tread count, lower door opening and painted light.
    mall/cinemaStairs.js  Physical service stairs with a smooth ramp under visible treads, solid supports, handrails, two culling
                        rooms and the floor-to-floor nav link. Lower shutter (1500) opens cinema + serviceCorridor; the original
                        cinema shutter now opens cinema + upstairs. No real lights, guns or spawn markers added.
    mall/restockMachine.js  buildRestockMachine({ kit, center, wallAt, facing, floorY = 0 }) -> { position, normal, screen }: the RESTOCK-O-MATIC
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
    game/ambience.js     Spatial loop selection with optional emitter gain/smooth pulses; local map.ambientEvents play
                        occasional one-shots only in audible unlocked areas. Timers freeze on pause and restart on reset.
  fx/
    powerUpView.js      Reusable delivery carton, blue beacon and security badge (no lights/colliders); bob/spin/blink,
                        floor-projected Blue Light ring clipped at walls/voids, hide on reset/death, owned-resource disposal
    contactShadows.js   One instanced draw for soft zombie grounding; interpolates feet and finds supporting collider tops.
                        No collision, hitbox or navigation changes; clear on restart, dispose owned GPU resources on unload.
    impactMarks.js      Persistent world aftermath: visible-mesh ray + flat-face corner checks, ring of 200 marks shared
                        across instanced signature pools. Skips shutters/unsupported edges; follows rigid surface transforms,
                        removes marks when surfaces unload, clears on restart. prepare(renderer,camera) warms shared graphics.
    impactModels.js     Small shared staple/nail/dart/confetti meshes with vertex colours; three procedural price-sticker textures
    effects.js          Tracers (pooled) + particle bursts (one InstancedMesh): splat(), puff(), clear() (new run).
                        The Mascot's foam palette bypasses flesh splatter settings.
  vite.config.js        Dev server only: compiles the game at server start (warmup) and skips .claude, dist, dist-single, references and scratch. Paths are absolute from this checkout, so a worktree keeps its own hot reload.
  play.cmd              Double-click version of `npm run play`. tools/play.mjs rebuilds the single file if the source is newer, keeps the last good build if that fails, and opens it in Firefox (the Windows default for .html may be another browser).
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
    areaUnlocks.js      createAreaUnlocks({ zones, doors, connections }): destination(door) identifies the one locked
                        endpoint. unlock(areaId) owns only that area and opens all connections whose endpoints are owned,
                        returning their barrier ids for sound feedback. openAll/reset support debug and Play again.
                        Mall's 15 barriers connect nine purchasable areas plus the initially owned Start Room.
    door.js             createDoor(): physical barrier wrapping open/close/update/collider. Raw open/reset retains
                        legacy zone-holder behavior for standalone maps and geometry tests. Mall gameplay purchases
                        go through areaUnlocks, never directly through door.open. toggleDoors delegates to area ownership.
    wallBuy.js          createWallBuyDisplay(): chalk outline (textures.makeChalkTexture) + the gun on two pegs, side on
    collision.js        RAMPS (addRamp / removeRamp / rampHeightAt, `colliders.ramps`): a walkable slope that is only a SURFACE the feet follow
                        (never a wall or ceiling; add boxes beside/under it): up within rampStep 0.5 m, down within rampSnap 0.4 m, not while
                        jumping. kit.ramp(spec) registers one and dispose removes it. moveAndCollide(): horizontal push-out (also removes the velocity going into the wall, so
                        a pinned mover reads speed 0 and slides along walls) then vertical landing/ceiling vs. Box3 list;
                        hasHeadroom(): can the player stand up here? overlapsSolid(): would a body overlap a wall?
                        markCollidersChanged(colliders) after adding/removing a collider at runtime; colliderSignature()
    shutter.js          createShutter(): roll-up barrier with its own Box3 collider (open/close/toggle/update); marks
                        collider changes. mesh = cropped moving curtain + hardware; frame = fixed guides/housing (mapKit adds both).
                        Constant slat pitch in X/Z walls, hidden curtain when fully rolled up. Curtain and frame stay on the always-drawn
                        layer so a closed doorway cannot cull its own barrier. config/shutters.js owns finishes/dimensions.
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
                        round / points / enemies / sale, selected spawn type, next gun, god mode and active boss.
                        Commands are grouped into columns with a responsive layout; the last result stays at the bottom.
                        Visibility is mirrored to aria-hidden. The overlay never takes clicks.
    controlsMenu.js     createControlsMenu(): the Controls screen (pause screen > Controls, controller X): tabs Keyboard & mouse /
                        Controller, each as a Diagram (default) or List (controller Y toggles), from `controlsHelp` (config/controls.js:
                        { keys, text, short, anchors }; update it when bindings change) + debug-key hints
    controlsDiagram.js  buildControlsDiagram(device, entries): SVG keyboard + mouse / controller; colored labels placed AROUND the
                        drawing (hand-set `slots` per part in drawKeyboard/drawController: x, y, align end|start|middle) with elbow lines
                        drawn on top to the first of each entry's `anchors` (ids of drawn parts: key names, 'mouse', 'lmb', 'ls', 'rt'...);
                        all anchors get tinted. New part = id + slot there, then list it in controlsHelp
    hud.js              createHud(): 4-line crosshair whose gap = spread cone (dot in ADS) + hit marker (white body, big yellow head, red kill),
                        boss name, job title and health bar while an encounter is active. Murray's bar uses caution
                        stripes, a Cleaning in progress notice and a turquoise water gauge (retail.css),
                        bottom-left health (white) + stamina (green) bars, bottom-right ammo counter,
                        reload prompt under the crosshair, buy prompt below it (setInteract: "Hold F to open X 500",
                        red cost when unaffordable, shake when denied, hold-progress bar), red hurt edges, click-to-play/paused overlay,
                        "Clocked Out" results screen with Play again (plain DOM). Pause screen: Click to play + Settings (left) /
                        Controls (right) buttons (onOpenSettings/onOpenControls); FPS counter top right (setFpsVisible/setFps);
                        setAmmoTier(tier): "<Tier> warranty" in the tier's color under the gun name
                        (hidden at Standard; main.js feeds it from tierOf(gun.modsFor(...))); showAnnouncement({ kicker, text }): PA-style banner under the round banner (new zombie types)
```
