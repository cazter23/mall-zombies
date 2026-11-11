# Sunset Galleria: folder structure (every module)

> Moved out of CLAUDE.md (verbatim) so the file every session loads stays small. One entry per module: what it is for and its interface. Read the entries for the modules you are about to change (grep for the file name).

Each module has one entry under its folder (grep for the file name). Notes that span several modules are at the end.
tests/docs.test.js checks that every file in src/ has an entry here.

```
index.html              Entry page: the web fonts (Google Fonts; list kept in step with config/fonts.js) and src/boot.js
package.json            scripts: test, test:quick, dev, build, build:single, play, preview, balance, melee (see CLAUDE.md Commands)
src/
  main.js               Entry, BROWSER SIDE ONLY: renderer, scene, camera, Input + gamepad, HUD, sound, viewmodel, player body,
                        settings/controls menus, controller menus (handleControllerMenus), pointer lock, debug keys
                        (handleDebugKeys, run by the game each live tick), look input, render(alpha) + the death camera.
                        Its tick = gamepad.poll + controller menus + g.update(dt). Exposes window.__mall (same names as
                        before, plus `g` = the game) when debug.exposeToWindow
  style.css             HUD (crosshair, hit marker, health/stamina bars, ammo, prompt), start/pause overlay
  boot.js               The page's entry point: waits for the web fonts (core/fontsReady.js, list and time limit in config/fonts.js), then imports main.js.
  config/
    idle.js             Idle saver numbers: delays (short / normal / long: dim and sleep seconds), dimFps, muteWhenAsleep, pollSeconds
    haptics.js          Controller vibration intensity and per-gun/damage/pickup durations, motor strengths and priorities
    bosses.js           Boss debut windows, wave timing, combat and control tuning, PA lines, and the Janitor's costume
                        and Wet Floor settings. Boss kill values and health scaling go through economy.js.
    deathMusic.js       End of Shift: original seven-second death composition (piano/pad/bell/noise layers), gain and
                        stop fade. Bell anchors to feel.death.resultsDelay; played once through sound's music/master buses
    careerStats.js      Career schema versions, recent-run limit and accuracy record threshold.
    closingTime.js      Four closing duties and their keys, fountain, night-safe and last-orders targets, PA copy (the once-per-run briefing and its delay; `keep` marks the lines the PA queue never drops), the win receipt's words, the OVERTIME tag, Statistics labels, key marker and prop tuning, and escape van prompt data. Also the run modes (order, default, chooser words), Classic's prompt words, each duty's place and the fountain prompt's count.
    powerUps.js         Employee-incentive drop tuning, skill credit, round caps, pickup/zone durations, ammo top-up,
                        sweep strength, colors and PA lines. First round 2, 12-16 credit per drop, maximum 3 per round
    effectWords.js      THE WORDS-ONLY RULE: players never see an upgrade's effect as a number. The fixed size bands (a little / noticeably / much), sizeWord / fillSize
                        for the `{size}` / `{Size}` tokens in a config line, describeEffects and hasStatNumber (the detector the tests use).
    wardrobe.js         Apparel items, four slots, stat multipliers, joke line, signature colour, icon id and `lines` (the words for each upside / downside) per item,
                        `statBetter` (which direction of a stat is good), rack locations, fitting-room placards and the picker's close distance.
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
                        Mascot enters at round 10 with 5x Shopper health and a two-alive cap (every costume shares that slot).
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
                        zombieNav (grid, soft wall clearance + wall penalty), zombieFailsafe (stuck-zombie rescue).
                        The Mascot is a shared base type plus `mascotVariants` (the costumes: name, unlockRound, homeZones,
                        introBanner, helmetPopLine, colors, uniform, head, + one tuning block: reclaim / popBlast / melt),
                        `mascotPicking` (home weight) and `mascotGold` (Employee of the Month). Each costume resolves ONCE into
                        `mascotTypes[id]` (id 'mascot', variant, name) and `mascotGoldTypes[id]`; zombieTypes.mascot = Sir Waffles
    controls.js         bindings (action -> keyboard/mouse + Pad* codes; interact = F / X; switchWeapon = wheel / Y,
                        weapon1/weapon2 = 1/2; menu-only: settings = Y, controlsScreen = X on the pause screen), buttonLabels
                        (prompts per device), controlsHelp (what the Controls screen shows; keep in sync with bindings),
                        gamepad (deadzones, look speed/curve, turn ramp, triggers, click-to-sprint release),
                        aimAssist (strength dial, range/cone, slowdown, rotational, ADS snap). Equipment: lethal = G / RB, tactical = middle
                        click (Mouse1) / D-pad right; melee = V / R3 (RB moved to the Lethal throw, COD's layout)
    settings.js         THE LIST of player settings (options menu; an entry with tab null is a remembered choice that is never shown: closingMode, the run mode): { id, tab, label, type toggle|slider|select, default,
                        min/max/step, format, apply(value, ctx) }. Most apply() functions write into the config objects the
                        game reads every frame (feel, controls, audio). New setting = one entry here (new tab = add to settingsTabs)
    debug.js            THE DEBUG KEYS as a table (`commands`: id, key, shift, group, label; keys must not clash with gameplay
                        bindings: tests check) + enabled (master switch), showMarkers, testArena, addPointsAmount, jumpRounds, panel,
                        dummies, exposeToWindow, keyLabel(). They work in a normal game (no debug mode): Z spawn the selected
                        zombie / Shift+Z next type / X clear / K kill all (pays), N next round / Shift+N +5 rounds / L Flash Sale,
                        P +5000 / ' points to 0, B god mode / H next wall gun / U free tier, O all doors / T test range / Shift+T Level 2, ` window,
                        E Sunny in the next GRAB-A-GUN grab / Shift+E move GRAB-A-GUN to another open area now
    ui.js               Presentation timing, PA queue limit and brief weapon-role copy (no gameplay tuning)
    deathReports.js     Satirical OSHA / Mall HR incident reports and loss prevention survival tips per lethal source (Form 109-C).
                        health.takeDamage(amount, source) records the killing blow: { type: 'zombie', id, variant?, boss? },
                        { type: 'fall' } or { type: 'hazard', id } (a hazard that hurts the player needs a hazards entry).
    attachmentVisuals.js Per-weapon attachment sizing, near-side rail placement, short-barrel spans and held reload copies.
    retailUnease.js     Rare atrium display changes and localized back-room sound timings/ranges; no gameplay tuning.
    kiosk.js            Kiosk Kevin (docs/kiosk-kevin-plan.md; phase 1 built): the equipment power curve (power: baseHealth 800, exponent 0.37), the throw
                        (blockSeconds 0.4, lob, start offset), the two pockets, and the products: so far the Soda Bomb (Lethal, 3 charges, 1.8 s fuse,
                        4 m blast, 850 x power at the centre, 0.3 of that at the edge, a boss's share 6% of its max health, its bottle projectile and look). productOf(id).
    clawMachine.js      GRAB-A-GUN, the claw machine: the prize weights and capsule colours, the sweep (2.4 s, 0.2 s quicker a grab, 1.4 s
                        floor), auto-drop, lift and take times, stock (6 a site) and plush odds, the cabinet's size, its six sites and the
                        PA lines. Price: economy.claw (through g.pricing 'claw').
    hazards.js          Environmental hazards (docs/hazards-plan.md): switch box sizing/colours, status labels, and tuning for the Grand Atrium
                        Electrified Fountain (plus planned fryer, sprinkler and PA lure hazards). Prices: economy.hazards (through g.pricing 'hazard').
    workshop.js         Build-A-Blaster: Limited Edition numbers (workshopBuilds), the ritual (workshopRitual: time, qualities, stages, loaner, PA), Stuffings and Hearts, buildOf reads a gun's finished build.
    decor.js            Decoration kit + clutter scatter numbers (world/decor.js, world/scatter.js). Cosmetic only.
    concourse.js        The real-mall pass as data (maps/mall/concourse.js): Level 2 shopfronts, hallway display windows, soffits and
                        cornice, floor bands / medallions / worn lanes, painted light under panels and neon, fixtures, little stories,
                        the FALL INTO SAVINGS '86 campaign, a directory totem; `wayfinding` = the one style for new direction signs.
    look.js             Art direction, "Grand Opening, Forever": palette, zone grading, the horror layer, set pieces.
    music.js            The 16-bar lounge loop "After Closing" as data (pitches, beats, timbres).
    neon.js             Neon tube builder tuning (world/neon.js): palette, tube sizes, flicker.
  core/
    loop.js             startLoop(): fixed-timestep accumulator; each frame calls beforeUpdate(frameTime) (look
                        input), then update(dt) per tick, then render(alpha, frameTime). Returns a handle:
                        setMaxFps(n|null), pause(), resume() (the clock restarts), paused, maxFps
    idleGovernor.js     createIdleGovernor(): pure. Which stage ('awake' | 'dim' | 'asleep') the game should be in from
                        activity, focus and the time; thresholds read live from config/idle.js. Always awake while
                        eligible() is false (a live run)
    idleSaver.js        createIdleSaver(): the browser half (main.js builds one). Listens for keys / clicks / pointer /
                        wheel / focus / visibility and polls the controller; dim = loop.setMaxFps(dimFps), asleep =
                        loop.pause() + sound.setSleeping(true); any input wakes it at once
    spring.js           createSpring / createSpring3: damped springs back to 0 (exact solution, frame-rate
                        independent). kick(peak) (impulse sized so it peaks at `peak`), displace(), update(dt)
    keyframes.js        samplePose(keys, t, outPos, outRot): eased pose keyframes ({ t, pos: [m], rot: [deg] })
    input.js            Input class: held keys/buttons, one-shot presses (mouse wheel = 'WheelUp'/'WheelDown'), actions (actionDown/consumeAction/
                        actionPressed), moveAxis() (WASD + left stick), padMove/padLook, `device`
                        ('keyboard' | 'gamepad', last used), mouse delta, pointer lock. A middle mousedown is always preventDefault'ed (the Tactical
                        throw must never start the browser's autoscroll, even before the lock)
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
    vault.js            (blocksVault(body): a live body blocks a vault unless flagged ignoreVault, like Sunny.) Opt-in low-obstacle vault: jump on approach, full-cylinder path/headroom/landing
                        checks (including live shootables), entry momentum on exit, interrupt on crowd shove
                        Balcony rails (collider.ledge, set by props.railing): always climbed straight over along the rail's
                        normal (up to 70 degrees off; pushing into it from a standstill counts), then a drop with no steering
                        (controller.dropVelocity). chooseDrop picks how far out to land (0 to 3 m) on floor, a bench, a counter
                        or an escalator's walkway with the whole fall line clear, cached per release point; feel.vault.ledge.
                        controller.trackFall then applies feel.fall damage.
    stats.js            createPlayerStats(): the single stats object (health, speeds, jump, sprint, crouch/slide/prone,
                        regenDelay/regenRate, adsMoveSpeed, damageMultiplier, meleeDamageMultiplier,
                        reloadSpeed); resetPlayerStats(stats) puts every stat back to base (same object) on a new run and DELETES
                        anything not declared in createPlayerStats() (so a new stat must be declared there with its default)
    health.js           createPlayerHealth(): takeDamage, regen after a delay, `overlay` strength for the red
                        hurt edges (grows with damage, pulses when low, flashes on hit), calls onDeath once and onRegenStart
                        once per recovery ('regenStart'). takeDamage takes the final amount: clothes scale zombie hits in createGame's 'playerHit'.
                        revive(seconds) = full health again plus that long with no damage at all (`isReviveProtected`; it counts down in update, so it pauses
                        with the game): Second Chance (game/secondChance.js) calls it from inside onDeath, so the death never registers.
    body.js             createPlayerBody(): first-person legs + lower torso in the world scene (visual only).
    wardrobeAppearance.js  Browser equip and reset wiring for body and gun cosmetics. Tags the active sleeve style across all models and generates the cable-knit texture.
                        Tapered faceted waist/pelvis, belt buckle, tapered thighs/shins and faceted sneakers with tongue accent.
                        Hip height follows eye height; feet posed for walk cycle / slide (V) / air tuck, knees
                        solved with two-bone IK. Exports placeLimb()/makeBoxMesh()/makeFacetedLimbMesh()/buildDeformedBoxGeometry() (also used for the arms)
  weapons/
    ballistics.js       The bouncing projectile of a gun with `projectile` (the Tennis Ball Launcher): createBalls({ colliders, shootables }) -> { list, launch({ position,
                        direction, projectile, damageOf, impact, onHit, onBounce, onEnd }), update(dt), clear() }. A ball flies under gravity and is swept against the world and the
                        zombies (castShot); every wall, floor or zombie contact is a BOUNCE (spent at maxBounces, lifeSeconds, or slower than minSpeed); a zombie it touches is hit
                        (damageOf) and the ball is thrown on, lifted for gravity, at the nearest OTHER zombie within seekRange in view, passing through the one it just hit for rehitSeconds.
                        DOM-free: createGame ticks it (after the zombies) and clears it on death and Play again ('balls' reset step); fx/ballView.js draws it.
                        createBalls({ ..., zombies: 'bounce' }): a zombie is bounced off WITHOUT being hit (no takeHit, no onHit): the second instance
                        createGame makes for thrown equipment (g.throwables, game/equipment.js).
    fuel.js             The fuel tank of a gun with `fuel` (the Leaf Blower): createFuel(), tickFuel(state, cfg, dt, { fired, level, capacity }) -> units to add
                        (it refills by itself regenDelay after the last pulse, at regenPerSecond; running dry LOCKS the trigger until the tank holds restartAt),
                        resetFuel(). Pure timing: the tank's LEVEL is the weapon's `magazine`, so the HUD, RESTOCK-O-MATIC, Refurbished grabs and
                        Build-A-Blaster work on it unchanged. weapon.js owns one (`weapon.fuel`) and runs updateFuel instead of the magazine/reload path.
    coneBlast.js        The cone attack of a gun with `cone` (the Leaf Blower): findInCone(origin, dir, cone, colliders, shootables) (in range, inside the
                        angle, no wall between, height forgiving: it aims at the height the aim line passes the body), blowAway(zombie, origin, cone,
                        distance) (the zombies' own staggerAway, plus applySlip close up; bosses refuse both, a Mascot is shoved at mascotScale, a zombie
                        already sliding is left alone), createBlastPay(everyPulses) (the +10 hit points once per payEverySeconds per zombie, not per pulse).
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
    aimAssist.js        (assistable(shootable): never a dead or spawning one, or one flagged ignoreAimAssist, like Sunny.) createAimAssist(): controller-only (input.device). Picks the visible target nearest the
                        crosshair (sticky), aims at its chest. Slowdown multiplier (read per frame for stick
                        look), rotational follow of the target's angular motion while a stick is in use, and
                        a 40% ADS snap within 5 deg with a cooldown. Runs inside playerGun.update after aim
    hitscan.js          castShot(origin, dir, range, colliders, shootables, maxTargets = 1): one ray vs world colliders
                        and shootables' hitboxes. Returns the first hit (target/part/point/normal) plus `hits` (every
                        shootable hit, nearest first, up to maxTargets, all in front of the first wall), `end` (where
                        the tracer stops) and `endNormal`. Defines the "shootable" interface (hitboxes, isAlive,
                        takeHit, splatColors)
    melee.js            createMelee(): box cutter. V = swing; lunges at a target 1.08-3m away; hit at 0.15s on the
                        nearest target in a 40deg cone within 1.8m (walls block; stats.meleeHalfAngleDegrees, wider after the
                        Box Cutter Pro, which also hits the nearest stats.meleeMaxTargets = 2, each with its own hit/kill; damage =
                        150 x meleeDamageMultiplier x meleeUpgradeDamage); cancels reload; isBusy blocks
                        the gun; takeHit({ melee: true }) so kills count as melee. Attack heading is committed
                        until impact; hit recovery 0.22s, miss recovery 0.5s (total 0.37/0.65s)
    upgrades.js         Upgrades -> mods (pure); attachmentLines(id) / tierLines(id) / renewalLines() = what an upgrade does in words; withTier(base, mods, tierId) / withAttachment(base, mods, id) return a NEW
                        mod list (mod ids 'tier' and 'attachment:<slot>'; other mods such as Build-A-Blaster untouched),
                        tierOf / nextTier / attachmentsOf read them back, attachmentFits(base, id) (Extended Nozzle doesn't
                        fit the Nail Gun). EFFECTS turns each effect into this gun's stat changes (shell-by-shell reload
                        phases, pellet cones, hip spread that leaves aimed accuracy alone). Apply: gun.setMods(id, ...)
    gunStats.js         THE gun maths: damageFalloff(distance, falloff), hitDamage(def, hit, index, stats, chargeScale, target) (damage x head x falloff x
                        pierce x player multiplier; the only place it's computed; with a `target`, a gun with `instantKill` (Return to Sender) deals INSTANT_KILL_DAMAGE to any returnable zombie and `bigFraction` of a boss's or Mascot's max health instead, x its tier damage: isReturnable(target)), resolveGun(base, mods) (upgrades as data:
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
                        returnToSender.js = the wonder weapon: a returns-desk scanner gun in blue and white with a lit green screen, a rainbow stripe, a pink emitter ring and a battery pack that the support hand slaps in to reload.
                        tennisBallLauncher.js = sporting-goods blue pump launcher: fat ringed barrel, loading port, clear hopper with balls, a support hand that fetches a ball to reload.
                        leafBlower.js = orange motor housing, red fuel tank with a level window, ribbed flared nozzle (the claw-only Leaf Blower).
                        Each model also returns `mounts` (barrel / top / side / grip / magazine / sticker: where upgrade parts go).
                        upgradeParts.js = what upgrades LOOK like: buildAttachmentPart(id, mount) (mounting brackets/adapters on universal
                        parts, weapon-suited Jumbo Pack reservoirs/drums/packs via mount.gunId, Speed Loader cam latch + ribbed finger loop,
                        terrycloth wristband with woven tag) and createUpgradeVisuals(model): every part + a branded Extended Warranty service
                        seal built up front (hidden), show({ tier, attachments }) per frame; the Extended Nozzle moves the muzzle (and flash) to its tip.
                        warrantyTrim.js = the Extended Warranty on the gun: barrel collar (rings that get chunkier by tier, studs for Renewals) and a swinging grip tag; buildVisual.js also puffs the body (pillows). Sizes: config/gunStyle.js.
                        New gun = new file + 1 line (+ its mounts)
      shortBarrel.js    Reversible front-segment geometry variants, preserving moving-parent transforms and owning both variants.
      loanerTag.js      The Courtesy Loaner's security tag and swinging card (reversible, like the other upgrade visuals).
      buildVisual.js    A finished gun's look: seam, patch and stitches in the stuffing's colour, lumps and leaking tufts when Overstuffed. Instanced, placed from the sticker and top mounts.
      workshopBuilds.js The reversible model changes for each workshop build.
    muzzleFlash.js      createMuzzleFlash(cfg): 2 sprites (normal-blended orange burst + additive core, random
                        twist/size), hand light + world light (always in the scene at 0 so no shader recompile).
                        Always depth-tested (the hands and gun hide whatever part of the burst is behind them),
                        sits 9cm in front of the muzzle so it shows past the left hand at the hip; in ADS it
                        goes wide/flat so the rays poke out around the gun, below the crosshair
  zombies/
    observation.js      Fixed-tick head/chest sight rays against world colliders with base FOV/aspect and edge hysteresis.
    mannequinModel.js   Articulated faceless plastic model, joint seams/inventory tag, frozen pose retention and owned disposal.
    mascotModel.js      The Mascot's articulated foam body (every costume) and smaller zombie head; the helmet comes from
                        mascotHeads.js. Places fixed-tick hitboxes from the posed pieces (any mesh, nested). Owns the detached
                        helmet, stuffing burst and their cleanup; a helmet can come off more than once, and beginReclaim /
                        finishReclaim / dropReclaim carry it from the floor back onto the shoulders (Captain Coupon)
    mascotHeads.js      HEADS[kind] fills a costume's helmet group (waffle, priceTag, popcornBucket, iceCreamCone; face pieces
                        follow a curved surface) + buildMascotBadge; shared geometry and canvas prints made once (sharedOnce)
    mascotVariants.js   pickMascotVariant(round, zone, random): weight 1 per unlocked costume, x homeWeight in a home zone,
                        no dice with one costume; mascotDebutIn(round). Both take an optional costume table (tests)
    bosses/janitor.js   Places, ages and disposes Wet Floor patches on clear floor. Slows the player on contact and
                        calls into the incentive system to mop Spill Cleanup.
    bosses/janitorModel.js Adds Murray's uniform, bucket, wet floor sign and animated mop to the standard skeleton.
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
                        hitboxes, and accelerates into a rush. Captain Coupon (type.mascot.reclaim): updateReclaim walks back
                        to mascotHelmet.rest, lifts it on (mascotLift), restores health once; gives up when it is gone, guarded
                        or too slow (mascotWantsHelmet = still going back for it)
    shopperAppearance.js Weighted, coordinated Shopper wardrobe selection; optional seeded random for tests, one look per spawn
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
    zombieManager.js    createZombieManager(): spawn(typeId, at, { variant, gold, nearest }): a Mascot's costume is picked AFTER
                        the spawn point (its zone sets the home bias; none out of the chute), then the gold roll (never two
                        alive), health x mascotGold.healthMultiplier for gold. Fallen helmets know their owner (eviction
                        skips a helmet its Coupon still wants); onHeadPop / onReclaim / onGold callbacks.
                        spawn(typeId) (open + reachable spawn points >= minSpawnDistance horizontally
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
    statusTint.js       What a Build-A-Blaster effect on a zombie looks like: the glow (flames, ice, goo, butter, rainbow) the model gets, read by zombieModel.js each frame. Looks in config/workshop.js stuffingLook.
    zombieRim.js        The soft edge glow round each zombie (config/look.js zombieRim; colour by kind, bosses their own): a few lines added to
                        the standard shader once per material, no draw calls, unaffected by hit flashes.
    confusion.js        Glitter's AI: a confused zombie forgets the player and fights the nearest other zombie with its normal attack.
    tankDeath.js        A kill in the room flying into the Stuffing Tank (visual; the kill is already paid).
    partyTrapDeath.js   The pose, ribbon and confetti after a trap kill. The kill is paid on impact; this is visual only.
    cartPose.js         The Cart Pusher's pose drives its hitboxes (hunched, telegraph, charge, slumped).
  game/
    equipment.js        createEquipment(): Kiosk Kevin's equipment, a player system like melee (DOM-free, g.equipment). Two pockets (lethal: G / RB,
                        tactical: middle click / D-pad right), each ONE product with charges; give(id, count) (same kind adds, another replaces), fill()
                        (the 'pockets' debug command). A tap throws along the view with a lob on `throwables` (weapons/ballistics.js, zombies 'bounce');
                        one throw at a time; isBusy blocks the gun (gun.update's `blocked`) and the box cutter for blockSeconds; a throw cancels a reload;
                        refused while switching, vaulting, swinging, in a menu (the buttons aren't read there, so the menu keeps D-pad right) or dead.
                        updateThrown(dt) runs the fuses: the Soda Bomb bursts on every zombie in range and in view (takeHit source 'equipment':
                        pays only through 'kill', never 'hit'; skips anything without a type or with noRewards, so never Sunny). live (fx/throwableView.js
                        draws it), status (HUD), detonate(id, position) (tests), clearThrown() (death), reset() (the 'equipment' step, right after 'balls').
    equipment/
      equipmentDamage.js equipmentPower(round) = (zombieHealthForRound / 800) ^ 0.37 (multiplies every equipment damage), blastFalloff (1 at
                        the centre to edgeFraction at the radius), blastDamage(target, distance, blast, round) (a boss: its fixed share of max health).
    pricing.js          createPricing(): priceOf('door'|'weapon'|'ammo'|'ammoCache'|'tier'|'attachment'|'closing', id) = economy.js base price with any
                        discount applied (setDiscount(category, 0..1), rounded to the nearest economy.discountRoundTo (10); discountOf; reset() on a new
                        run). Unknown category/id throws. PRICE_CATEGORIES
    events.js           createEvents(): tiny synchronous bus (on -> unsubscribe fn, emit, count). The event list + payloads
                        are in its header: shot, hit (player attack hit; +10 if not lethal), kill (any zombie death, with
                        headshot / melee / source: 'gun' | 'melee' | future 'hazard'...; ALL kill payouts + kill stats),
                        playerHit, playerDeath, runEnd ({ summary }, one immutable final snapshot), roundStart, typeIntro,
                        the Mascot's (mascotHeadPop, mascotVariantIntro, mascotReclaim, mascotPopBlast, mascotGold),
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
                        failures fall back to memory. A save from a newer version is never written over (blank ledger for the session). main.js supplies localStorage and records the runEnd event
    settings.js         createSettings(ctx): current value of every setting (and of remembered choices with no tab, like the run mode: "Reset everything" keeps those), saved in localStorage ('mallZombies.settings',
                        values are sanitized on load), applies them all at startup; get/set/reset(tab)/onChange. ctx = { renderer, sound, hud }
    runStats.js         createRunStats(): time alive, kills, headshot/melee kills, bosses defeated, shots fired/hit, accuracy
    bossDirector.js     Picks debut rounds (never a zombie type's or a Mascot costume's), retries a normal-marker spawn partway
                        through the wave, and blocks round completion while a boss is pending. Owns encounter behavior and
                        emits boss lifecycle events. The active boss's slow (behavior.surfaceSpeed) reports 'boss' to surfaceSlows.js.
    surfaceSlows.js     createSurfaceSlows(stats): the ONLY writer of stats.surfaceSpeed. Each slow floor reports its own factor
                        (set / clear by source id); the stat is the lowest, so two never stack. g.surfaces; reset on Play again
    mascotCostumes.js   createMascotCostumes(): the costume twists past the zombie itself, on the bus. Poppy Corn's pop blast
                        (staggers zombies, shoves + butters the player, 'mascotPopBlast'); owns meltTrail (cleared at round
                        end, death, Play again). g.mascotCostumes
    meltTrail.js        Scoops' puddles: one fixed pool for every Scoops (oldest gives way, own material to fade), drops every
                        dropEvery where he walks; a grounded player in one reports 'melt' to surfaceSlows
    closingTime.js      g.closing owns persistent boss key drops, collection, checklist progress (fountain kills, night-safe purchases and workshop collections) and Play again reset.
                        A key never ticks a line: lines 1 to 3 tick on their duty, line 4 on the win (completeLeaving, called by onRunWon). readyToLeave = four keys and
                        lines 1 to 3 (what the van asks for); missingKeys / missingDuties say what is left. Emits the once-per-run 'closingBriefing'.
    floorPickups.js     Shared clear-floor placement and swept collection for incentives and closing keys; direction for HUD markers.
    powerUps.js         createPowerUps(): listens to kill/round/death events; earned dynamic pickups on clear floor,
                        swept walk-through collection, 15s expiry, no repeats, per-round caps. Blue Light multiplies only
                        base kill credit, within its 4m radius, same floor and line of sight. reset/dispose; debugDrop(id, at)
                        marks the run assisted. Boss rewards wait for the pickup slot, survive natural wave progression
                        and clear on death, Play again or debug skips. createGame builds/ticks/resets it as g.powerUps.
                        A kill whose type has guaranteedDrop (Employee of the Month) queues a reward the same way, any
                        useful type by weight, outside the meter and its rotation.
    wardrobe.js         g.wardrobe: per-run ownership, equipped slots and reversible player stat factors. buy(id), wear(id) (anything owned),
                        ownedIn(slot), grantAll() (debug), and the ticket words: statLines(id) / ticketDetail(id) from the item's own `lines` (no numbers);
                        wornLines(id) = the same words for a WORN item, for the pause screen's rail.
    outfitRail.js       g.outfitRail: the DOM-free half of the outfit rail. Decides when a WORN item's tag pulses (each item names its trigger in
                        config/wardrobe.js `pulse`; `triggers` lists the ten: regenStart, playerHit, hitCushioned, payingKill, meleeHit, headshot,
                        sprintStart, slideStart, aimStart, ammoRefill), counts pulses (pulseCount / pulses), announces 'outfitPulse', and gives
                        snapshot() (four slots with the worn item, its colour/icon and its lines). Nothing pulses once you are dead.
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
    autoGraphics.js     First launch only: measures frame times during the title flyover and picks a Graphics preset.
    tickets.js          GRAB-A-GUN's prize tickets (g.tickets): their own currency, never the wallet, pricing or income. add(amount, reason)
                        (nothing once dead; 'ticketsWon'), spend, won (the receipt), and the Prize Counter's tokens (slowClaw, freeGrab,
                        keychain: hold / has / use). A resetStep ('tickets'), so Play again starts at 0.
    flashSales.js       Flash Sales: a random PA-announced discount on one category, set through pricing so every price in it drops.
    runIntro.js         The PA's opening announcement on a run's first round (listens to 'roundStart').
    shutterSounds.js    Purchase sounds that follow the real shutter motion; pausing stops them, death and reset cancel them.
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
                        meleeDeskItem = the desk's SECOND window (feature.meleePosition, 1.25 m along the counter, a SHARPENING sign):
                        "Box Cutter → <tier>" (g.pricing 'melee', purchase kind 'melee'), not tied to the gun in hand, not while switching.
                        attachmentCounter.js = one attachment on a store counter: "fit <Attachment> on the <Gun> · <blurb>"
                        (g.pricing 'attachment', purchase kind 'attachment'), replaces that slot on the gun in hand; no prompt when
                        already fitted, when it doesn't fit (Extended Nozzle on the Nail Gun), area closed or busy. First purchase
                        unlocks free refitting across compatible carried/replacement guns for the run; reset clears ownership.
                        unlockAttachment(gun, id) marks one owned from outside (GRAB-A-GUN's Refurbished prizes).
                        Counters display resolved comparisons and preserve ammunition. Fully owned attachments are ineligible for Flash Sales.
      retailUnease.js   Called by the existing horror feature: unseen mannequin turn, shared empty-concourse TV feed,
                        distant upstairs silhouette. Quiet intervals, comfort gates, reset and static-batching-safe hooks.
      workshop.js       The workshop feature: builds the ritual, its effects and the Limited Edition drops, runs Party Trap charges.
      nightSafe.js      Customer Service deposit prompt. Gates payments on Kettle’s Safe Key and completion, and charges the live closing price. Without the key: "Requires <key>" in Directed, "Needs <key>" in Classic.
      escapeVan.js      Customer Parking hold prompt. Blocked until g.closing.readyToLeave: Directed lists missing keys, then the unfinished duties whose key is held (vanNeeds); Classic names one thing at a time, the first missing key or an unfinished duty by its place (vanNeedsClassic). Emits the van start.
      limitedEditions.js The bag a shopping-bag zombie sometimes drops: walk over it and Party Trap or Clearance Rack fits a gun you carry, free.
      workshopRitual.js The Build-A-Blaster ritual: idle, running, ready. Bench opens the order form, gun on the conveyor, gauge (kills also shorten the clock), maximum time, the gun coming back by itself, chute steering. Built by workshop.js.
      workshopStuffings.js What a finished build does (and its looks: flashes, flames, ice, drips, hearts): one function per Stuffing, one per Heart. Hearts read 'shot' and hand off to the stuffing; nothing here emits 'shot', so a stuffing's kills can't fire a Heart.
      workshopSpectacle.js Ritual mode: tank fill, party colours on the hall's two lamps, bulb string, belt, arm, flap, lever, jingle. Show only; reset() puts every part back.
      workshopOrderForm.js The bench's order form: every Stuffing and Heart on one sheet, pre-filled, driven by menu actions. Sets state.menu while open (the player stands still, the world doesn't).
      clearanceRack.js  Clearance Rack tags on up to three zombies; a headshot on a tagged zombie pops them all.
      clearanceSticker.js The canvas sticker drawn on tagged zombies.
      wardrobeFixtures.js Wardrobe racks (buy: the generated ticket) and fitting rooms (free: the hold opens that room's picker; its instance has `view`).
                          A rack with a `showpiece` also syncs the sold-out state to its fixture each tick, hums its motif (config/audio.js) while you are within
                          config/wardrobe.js showpieces.motifRange, and on a buy strikes the pose and emits 'wardrobeBuy' (the PA line).
      fittingRoomPicker.js The fitting-room picker: slots side by side, menu actions pick a slot and an owned item, confirm wears it (wardrobe.wear).
                        Sets state.menu while open; closes on back, a 'playerHit', being moved away, death, reset. DOM-free; `view` is what the UI draws.
      clawMachine.js    Feature kind 'clawMachine', GRAB-A-GUN: idle -> sweeping -> lifting -> ready. Hold to pay ('claw' 'grab'), PRESS to
                        drop (an `instant` interaction: a fresh press, never a held button, never a reload on controller X), the capsule under
                        the claw at the press is the prize; it drops by itself after 6 s and the prize leaves the chute after 15 s, so a grab
                        can't hang. Pure helpers: rollCapsules (by weight, no repeats; each gun's attachment is rolled with it), sweepPosition /
                        laneAt / sweepSeconds, prizePool (never the Staple Gun or a gun at Build-A-Blaster; a CARRIED gun comes Refurbished with
                        a free attachment for an empty slot, or not at all), takeOutcome (the take checks again: 'new' plain copy, 'refurbish'
                        refill + attachment, or 'refill'; never replaces a fitted attachment), plushChanceFor, describeCarried. Stock and relocation:
                        6 grabs a site; a plush (Sunny) refunds that grab's actual charge (wallet.refund) and closes it, with the next site picked
                        right then; a sell-out closes once the last prize is gone; it reopens at the next 'roundStart' at another open-zone site
                        (or restocks in place). Only one cabinet is live; the others are dust-sheeted. Events 'clawGrab' / 'clawDrop' /
                        'clawPrize' / 'clawClosed' / 'clawMoved' (the last two are PA lines, picked from cfg.pa's lists, played by createGame).
                        forcePlush / moveNow (debug). The show (cfg.show, never the prize): prongs open and shut, the carried capsule swings,
                        the chute flap, an attract screen, sounds that fade with distance (jingle, a tick into each lane, motor, grab,
                        fanfare, Sunny's slide whistle) and a hum: an emitter it adds to map.ambience that follows the live machine.
      kiosk.js          Kevin's fixed Hallway feature: three priced buy spots, round gating, Kevin's Pick, hiding and PA.
      clawSunny.js      Sunny runs away (built by clawMachine.js): out of the chute, a look round, a waddle along g.zombies.nav.pathTo to the
                        next site's front (open areas only; a lap round his own machine if no other site is open), into that cabinet, which
                        shakes (its rig group; colliders never move). His shootable (one body box) pops on any hit: stuffing and confetti,
                        tickets.popSunny, and the machine re-picks its next site. Flags: ignoreAimAssist, ignoreVault, noRewards; no collider.
                        Events 'sunnyEscape' / 'sunnyArrived' / 'sunnyPopped'.
      prizeCounter.js   Feature kind 'prizeCounter', REDEMPTION: five prizes paid in tickets (an ammo refill, a Slow Claw token, an attachment
                        voucher for an empty slot of the gun in hand, a free grab token, a Sunny keychain). Normal hold-to-buy items costing 0
                        points with a "100 tickets" label, quiet (not a 'purchase'), refused like too few points when you're short.
                        voucherChoices(gun). 'prizeRedeemed'.
      horror.js         Feature kind 'horror': the mall decays as the rounds climb (config/look.js horror). Visual only, never gameplay.
                        Darker every round, flickering neon dies, every tube browns out, lamps die, the view drifts to the lateHours grade, power cuts.
      hazards.js        Shared environmental hazard lifecycle (docs/hazards-plan.md): buildHazardSwitchBox (dynamic parent group, status lamp + throw lever),
                        createHazard (ready -> active -> cooldown, 'hazard' pricing prompt, player-inside slow/hurt, reset), dealHazardDamage (source 'hazard', boss/Mascot maxHealthCap).
      fountainHazard.js Feature kind 'fountainHazard': Grand Atrium center fountain breaker switch; energizes the basin and conductive floor ring, pulsing electric arcs (source 'hazard') and slows. Emits 'fountainKill' for each killing blow.
    debugCommands.js    createDebugCommands(game parts): the debug shortcuts as functions run(id) (spawn, cycleZombie, clearZombies,
                        killZombies, nextRound, jumpRounds, flashSale, addPoints, zeroPoints, god, giveGun, upgradeGun, doors, arena, panel,
                        spawnMascot / spawnGoldMascot: each costume in turn at the spawn point nearest you);
                        resolve(code, shift), status(). g.debug. A new command = a table entry in config/debug.js + a function here.
                        KEYLESS commands (no key to spare; keylessIds): 'pockets' fills Kiosk Kevin's equipment pockets (window.__mall.g.debug.run('pockets')).
                        God mode is health.invulnerable; debug state is not part of a run (Play again keeps it)
    rounds.js           createRounds(): announce(n, delay) flips the round number (and fires onRoundStart) the
                        moment the last zombie dies, then 'break' (economy.rounds.breakSeconds, inBreak; breakRemaining; endBreak(lead) cuts it short) -> 'active' (spawn quota at
                        spawnDelay, capped by maxAlive; quota only used when a zombie actually spawned, else retry
                        after spawnRetrySeconds). Each spawn's type: zombieTypeForRound, except a special type's
                        first possible round forces its introSpawnIndex-th spawn to be one. onTypeIntro(typeId, zombie) fires
                        the first time a type spawns in a run. A Mascot costume's unlock round forces its debut the same way
                        (the forced spawn still rolls, so the rest of the wave is unchanged); onVariantIntro for each later costume. start() on first play, skipRound() (debug), reset()
    clockIn.js          createClockIn({ input, rounds, events }): the SHOPPING WINDOW's early exit. During the break before round 2 and later
                        (economy.rounds.clockIn: action, holdSeconds, leadSeconds, fromRound, pa) a fresh hold of the Clock in action
                        (Inspect: I / D-pad down; read with actionDown only, so a tap still inspects the gun) calls rounds.endBreak(leadSeconds)
                        and emits 'clockIn' { round, skipped }. Once per break; ignored behind a menu; prompt = { action, progress } for the
                        HUD (hud.setClockIn, under the round box). createGame's 'clockIn' listener reads the PA line. Reset step 'clockIn'
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
                        serviceDesk({ along, center, wallAt, facing, meleeOffset, tierColors }) (the Customer Service BOOTH: a walled office
                        with a service window + counter, a zombie clerk, computer/cabinets/clock visible through the glass, a
                        CUSTOMER SERVICE sign on the roof, NOW SERVING above the window, a sticker per tier on the counter; ONE solid
                        full-height collider wall-to-counter, so nobody gets inside and moving it needs no room behind; returns its
                        buy spot and the box cutter window's meleePosition), clerk({ along, center, wallAt, facing, depth, apron }) (a zombie in an apron behind a counter,
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
    mall/atriumDetails.js Authored shop interiors, kiosk merchandise, fountain/floor details, overhead decorations and small scenes.
                        Uses config/atrium.js; no colliders/lights/interactions. Only ripples/mobile animate; kit owns disposal.
    mall/atriumStorefronts.js Twelve sealed shops with real shells behind wall openings, glazing/locked doors, themed stock and
                        fixtures on both floors. Shared lettering atlas; returns wall-opening data to atrium.js, which seals each with a collider.
    mall/levelTwo.js    buildLevelTwo({ kit, props, floorY, supportRects, hole, layout }) -> { spawns, lamps }: LEVEL 2 shell,
                        independently sized by config/promenade.js (merged into LAYOUT.level2); floor sections use existing downstairs
                        ceiling support where available and add structural slabs elsewhere. Main perimeter, roofs, reserved closed
                        connections, railings, furniture, shop frontages and upstairs spawns; mall.js hangs the existing lamps.
    mall/parkingLot.js  Customer Parking through Mega Mart's former emergency exit. config/parkingLot.js holds its footprint,
                        entrance, vehicle row, fences, lamps, spawns, sky, ambience and benchmark shot. Builder returns its shutter,
                        spawns, lamps and culling room/portal; mall.js wires ownership, grades, horror and reset. Kit owns disposal.
    mall/parkingSurroundings.js Scenic intersection, sidewalks, planted verges, roadside shops, distant buildings/cars,
                        utility poles/wires and mall pylon. Uses config/parkingLot.js; no colliders or additional real lights.
    mall/parkingDetails.js Worn asphalt/paint, repairs, engine stains, puddles, drains/weeds; RV fittings, wall services and
                        three abandoned scenes. Adds solid vaultable trolley/chair collision and a tall electrical cabinet.
                        Painted light uses lookKit; local haze and a gently moving sign respect ambient-effects settings/reset.
    mall/parkingStreetDetails.js Bus shelter/timetable, bins, street names, roadworks, stopped car, warm shop windows and
                        delivery notices. Scenic geometry only; uses config/parkingDetails.js alongside parkingLot.js.
    mall/parkingDetailKit.js Shared boxes, rods, signs, planes and canvas decal materials; all resources owned by mapKit.
    config/parkingDetails.js Authored wear/scene/service/street locations, RV labels, haze/sway settings, ambient loops/events.
    config/save.js      Save & Quit: the save format's version (bump it when a step's saved data changes shape or map.features changes order: older saves are dropped), the localStorage key, the greyed-button reasons, the PA line on a load and the dropped-save notice.
    config/gunStyle.js  How upgrades change a gun's shape and colour: attachment scale, the warranty collar and tag sizes and METAL finish per tier (Platinum shimmers), the build's pillows, quality vividness and glow, the Heart badge colours and shapes, the seam glow. Looks only.
    mall/mallExterior.js Opaque outer Atrium facades, roof and returns close the building beyond Mega Mart. Meshes opt into
                        userData.alwaysVisible so room culling preserves the building silhouette while hiding its interior.
    mall/promenadeShop.js SHOE-PER SALE interior: two entrances, perimeter shoe shelves, fitting mirror/bench, shoe boxes and a low
                        island with a clear momentum-vault crossing. Shares upper-floor unlock/navigation/reset/disposal.
    mall/departmentStore.js HOFFMAN'S room (floor, walls, roof, panels, stockroom door + west vent, spawns); config/departmentStore.js
                        has every number. mall/departmentStoreFixtures.js: vaultable cosmetics/fragrance/layaway counters, round
                        clothing racks (see-through topper colliders), mannequins on plinths, fitting rooms, shoe wall. Its look:
                        zoneLooks.js buildDepartmentStoreLook + look.departmentStore. mall/departmentStoreDetails.js (data: config/
                        departmentStoreDetails.js): the detail pass: wall shelving (knits west, layaway bags north: the only colliders), counter-top
                        scenes, fitting-room scene, wall mirror + busts, brass beams + hung banner + sprinklers, interrupted-shopping litter, ambience
                        emitters. mall/seamDetails.js: the receiving door on the stair connector's east wall and the Promenade side of the cinema's
                        front (now-showing one-sheets, ticket stubs).
    mall/promenadeDetails.js Fixed upper-floor dressing: low sunset medallion, perimeter upholstery, directory/phones/magazines,
                        overhead signs/diffuser, Build-A-Blaster renovation frontage, closed Pretzel Palace counter and shoe tickets.
                        Called with the existing look kit; no new collision/lights/purchases/timers. Kit owns resources; static parts batch.
    config/promenade.js Independent upstairs bounds/sections, slab/wall dimensions, shoe-store geometry/finish data and three
                        expansion connections (west/east wings, COMING SOON workshop). West connects to the live cinema door;
                        the east wing and workshop remain solid reserved closures.
    config/cinema.js    Independent upstairs lobby, Screen 1, passage, seat blocks, future sealed connections, spawn markers,
                        colors, two pooled lamps, spatial ambience and procedural slide data. Entrance price: economy.doors.cinema.
    mall/cinema.js      Physical cinema wing, shutter, upper-floor spawns and room/portal/grade/ambience metadata. The Promenade
                        owns their shared wall. Lobby -> auditorium -> projection passage -> lobby is a flat-floor fighting loop.
    mall/cinemaDetails.js Patterned carpet on the actual floor, velvet curtains, concessions/box office cases, exit signs,
                        acoustic panels and one reusable slide texture/projector beam. Orchestrates cinemaArchitecture,
                        cinemaLobbyDetails, cinemaAuditoriumDetails and cinemaStoryDetails; shared geometry/canvas helpers
                        live in cinemaDecorKit, authored cosmetic data in config/cinemaDetails.js. No colliders or real lights.
                        Ambient extras freezes slides/poster motion and hides beam/dust; screen animation uploads at most
                        five times per second while rendered. Clutter controls litter. Map owns update/reset/disposal;
                        static parts batch by room. cinemaServiceDetails dresses the passage/stairs/return without collision.
    config/cinemaFinish.js Second cinema pass: service runs, equipment landmarks, lobby entrances, carpet bounds and fabric bays.
    mall/cinemaPublicFinish.js Lobby carpet borders, waiting seats, premiere banners, concession frontage/packaging, usher station,
                        poster cases and letter-board showtimes; auditorium fabric panels, aisle strips, pelmet and chamfered seats.
    mall/cinemaServiceFinish.js Projection tile/dado, conduit, guarded lights, rewind bench/transport cases and access cabinet;
                        return blockwork, meter bank, delivery/checklist scenes, overhead channels and stair concrete joints.
    mall/cinemaPrint.js Map-local canvas print sheet shared by row letters, forms, packaging and cinema identity signs so they
                        batch with the existing static system. Each map owns its sheet/material; no runtime canvas updates.
    config/cinemaStairs.js West stairwell/return-passage bounds, ramp plateaus, tread count, lower door opening and painted light.
    mall/cinemaStairs.js Physical service stairs with a smooth ramp under visible treads, solid supports, handrails, two culling
                        rooms and the floor-to-floor nav link. Lower shutter (1500) opens cinema + serviceCorridor; the original
                        cinema shutter now opens cinema + upstairs. No real lights, guns or spawn markers added.
    mall/kioskCart.js   Kevin's low counter, vendor, three buy spots and changing notices.
    mall/restockMachine.js buildRestockMachine({ kit, center, wallAt, facing, floorY = 0 }) -> { position, normal, screen }: the RESTOCK-O-MATIC
                        (north/south walls): body + hazard kick plate + glowing header and tagline, a lit window of ammo boxes, keypad,
                        card reader, live canvas screen (screen.show({ title, line, note, tone })), side signs, the AMMO blade sign, the
                        hazard stand pad and glow pool on the floor. One collider. (props.vendingMachine is the old RESTOCK-O-MATIC, unused)
    mall/clawCabinet.js buildClawCabinet({ kit, back, faces, floorY }) -> { position, normal, screen, rig }: GRAB-A-GUN's cabinet,
                        world-space boxes facing any of the four ways: base (live screen with capsule dots, DROP button, coin door, prize
                        chute with a hinged flap and a tray, small print on the chrome kick plate, Sunny on both sides), glass case (three
                        lanes, rail, a lit strip, a printed backdrop), header (a marquee with painted bulbs, "EVERYONE'S A WINNER*", Sunny
                        standing on top). Canvas art drawn once and shared (drawSunny: the mascot). ONE collider, 2.2 m; unlit, no real
                        lights. The rig (dynamic group) moves: setCapsule, setClaw(u, drop, open, sway), carry(lane), setFlap(open),
                        setLive(live) (a stepped cloth dust sheet with a taped "BACK SOON" note; the claw hides under it), chute, reset.
                        Exports wallFrame (building against a wall in local u / a coordinates, any facing) and drawSunny (the mascot).
    mall/prizeCounter.js buildPrizeCounter({ kit, back, faces, floorY }) -> { position, normal, slots }: the Prize Counter's booth,
                        2.6 m of counter with five prize cards and ticket tags, a wall of display-only plush, a bored teenage animatronic
                        (static), the REDEMPTION header. One collider, 2.3 m. Built with clawCabinet.js's wallFrame.
    mall/startRoomDetails.js Clearance-store dressing relative to the start room: register, receipt, bags, stock remnants,
                        vent frames/boards, sale remnants, pricing station, floor wear, damaged light fitting and lamps.
                        Decoration only (no collision or interactions); static boxes merged by material; map kit disposes resources.
    mall/megaMartDetails.js Department stock and interrupted-shopping detail (batched static meshes), checkout groceries,
                        receiving hardware/signs, Foam Dart promotion, perimeter trolley, fluorescent housings and the two Mart lamps.
                        MART_FIXTURES shares gondola positions and checkout lanes with mall.js. Only the parked trolley adds collision.
    mall/martProducts.js Low-poly shelf product models: Outdoor, Snacks, Holidays and Housewares (31 types).
                        The arranger fits whole models into irregular runs: crowded stock, disturbed patches, isolated leftovers and bare stretches;
                        geometry is merged by material alongside the rest of the Mart dressing (no per-product draw calls).
    mall/palette.js     COLORS shared by the mall's rooms and props
    mall/wardrobeDisplays.js Plain apparel and fitting-room badge builders. Showpiece spots use their own builders and keep the same wardrobe interactions.
    mall/wardrobeShowpieces/showpiece.js  The base every Wardrobe showpiece shares: a Group named after the map feature with a `still` half (merged by the static batcher) and a `live` half (userData.dynamic: idle motion, own glow materials, signs, the buying cone); returns a handle (update / setSold / pose / reset) that game/features/wardrobeFixtures.js drives.
    mall/wardrobeShowpieces/foodCourt.js  The first three showpieces: Paper Hat (burger on Burger Barn's roof + a hat chute), Wheelie Sneakers (skate ramp with spinning heels, in front of Good Sports' east window) and Giant Foam Finger (waggling out of a pennant bin on the open court floor). mall.js uses them instead of the plain rack display (wardrobeSpot).
    mall/wardrobeShowpieces/groundFloor.js  Six showpieces for Hallway, Mega Mart, Service Corridor, HOFFMAN’S and the Atrium. Builds local +Z-facing geometry, transforms base colliders with the fixture, and keeps the live animations and emissive effects under the shared showpiece handle.
    mall/wardrobeShowpieces/upperFloor.js  The Cinema monster cut-out and Shoe-Per Sale’s disco sneaker and walking treadmill. Shared floor showpiece helpers live in showpiece.js.
    mall/workshopDetails.js Build-A-Blaster's detail pass: skins wall, heart shelf, till, footprints, window, plush, ceiling grid (storefront); hoppers and pipes, QC desk, rollers, booth props, portraits, lockers, safety signs, corner clutter, floor markings, beams, wainscot, neon (hall). Numbers: config/promenade.js workshop.details.
    mall/workshopRoom.js The Build-A-Blaster storefront and back hall (island, booth, lever, chute) and their dressing. Layout numbers: config/promenade.js workshop.
    mall/atmosphere.js  Cosmetic map dressing, batched by material; adds no colliders.
    mall/cinemaArchitecture.js buildCinemaArchitecture: the cinema's shell (walls, floors, openings, structure).
    mall/cinemaAuditoriumDetails.js The cinema auditorium's detail pass.
    mall/cinemaLobbyDetails.js The cinema lobby's detail pass.
    mall/cinemaServiceDetails.js The cinema's service passage and stairs detail pass.
    mall/cinemaStoryDetails.js The cinema's story props.
    mall/cinemaDecorKit.js Small primitives for cinema dressing (world coordinates, no collision).
    mall/hallwayLook.js The hallway's dressing, the reference room of the visual overhaul (neon, slogans, wall bands, posters).
    mall/lookKit.js     The visual overhaul's shared tools (wall bands, neon, light pools), used by every area's Look. glowSet(name, kind):
                        many glows merged into ONE additive mesh; parts.neonPlacements records every neon sign placed.
    mall/concourse.js   The concourse pass (config/concourse.js), built last in mall.js: a shopfront run on Level 2 (painted interiors
                        and signs on one atlas, one glass mesh, blade signs, light spill), display windows, soffits with the trim on their
                        edge and a ceiling cove, the hallway cornice, floor bands and medallions, panel pools and neon reflections (two
                        glow meshes in all), ceiling fixtures, fountain, ATM, fire pulls, urns, kiddie ride, gumball, stories, campaign.
    mall/setPieces.js   One signature scene per area (dead arcade cabinets in the hallway, and so on).
    testRange/          Debug add-on (not a map): testRange.js buildTestRange(scene, colliders) with own lights,
                        dummy.js practice mannequins (shootables)
  audio/
    sound.js            createSound(): Web Audio synth for config/audio.js recipes. play(name, { volume }),
                        unlock() (also on the first pointerdown/keydown; browsers block audio before that),
                        setMasterVolume(v) (used by Settings > Audio), setAmbience(mix) (up to three continuous spatial voices,
                        short crossfades), playAmbient(name, {volume, pan}); faded sources stop and disconnect
    game/ambience.js    Spatial loop selection with optional emitter gain/smooth pulses; local map.ambientEvents play
    game/secondChance.js  The one automatic self-revive per run, sold at Customer Service's third window (upgradeDesk.js secondChanceItem, opposite Sharpening; economy.secondChance through g.pricing 'secondChance'). status 'available' | 'held' | 'used'; buy() (the desk has charged); redeem() is called by createGame's onPlayerDeath on every lethal hit: held = health.revive (full health in place, feel.health.secondChance.protectionSeconds of immunity) + zombies.staggerNearby (the shove: same floor, in reach, never a boss) and true, so the run goes on; otherwise false and the death stands. reset() is Play again's 'secondChance' step. Announces 'secondChance' { status } on every change: createGame's listener shows the HUD tag while held and reads the PA line on 'used'. While the protection lasts createGame announces no 'playerHit' or 'playerFall' (a swing that cannot hurt gets no arrow, rumble, outfit tag or boss effect). The receipt's "Second Chance · Used" line comes from summary.secondChanceUsed. createGame exposes g.secondChance.
    game/saveGame.js  Save & Quit, Black Ops 6 style: one slot (localStorage in the browser, any { getItem, setItem, removeItem } in tests via createGame's saveStorage). Each 'roundStart' raises a flag and createGame's update() takes the snapshot at the END of that tick, after every roundStart listener rolled its draws (boss schedule, Flash Sale, claw site, today's bins): every createGame saveSteps entry's serialize(), as JSON. canSave() { ok, reason }: a round has started, alive, full health. saveAndQuit() writes { version, round, savedAt, data } and announces 'runSaved'; main.js then goes to the title (not a death: no runEnd, no career record). peek() for the title's Continue; a save of another version is removed and `dropped` turns true. load() removes the slot FIRST, runs resetRun, then each step's restore in order (rounds.restore puts the run at the start of that round's break without a 'roundStart'), and announces 'runLoaded' { round } (horror relights, the PA welcomes you back); a restore that throws drops the save and resets. Systems with saved state have serialize()/restore(data) next to reset(): wallet, runStats, tickets, secondChance, rounds, pricing, flashSales, bossDirector, powerUps, wardrobe (restores WITHOUT re-applying factors: the stats are saved as they are), warranty, outfitRail, equipment, playerGun (each slot as config id + mods + ammo, the gun away at Build-A-Blaster, the loaner), features/index.js (by feature index: workshop's ritual order, the claw machine's site and stock). Not kept: zombies, power-ups on the floor or running, traps, puddles, hazard cooldowns, a grab under way (createGame's transientSteps).
    game/meleeUpgrades.js  The box cutter tiers sold at Customer Service's second window (config/upgrades.js melee: Sharpened Blade x3 damage, Box Cutter Pro x5 + a wider cone + two targets): offer() = the next tier or null, accept() writes stats.meleeTier / meleeUpgradeDamage / meleeHalfAngleDegrees / meleeMaxTargets and announces 'meleeUpgrade' (the viewmodel recolours the cutter). Nothing run-scoped lives here: Play again's stats reset puts it back. Prices: economy.upgrades.melee through g.pricing 'melee'. createGame exposes g.meleeUpgrades.
    game/warranty.js    The Extended Warranty rules that are not a stat change: what the Customer Service desk offers (next tier, a Renewal past Platinum, or a warranty on file moved onto this gun for a fee), the warranty a replaced gun leaves on file, and the Platinum claim (a dry gun gets its ammo back once per round). Numbers: config/upgrades.js.
                        occasional one-shots only in audible unlocked areas. Timers freeze on pause and restart on reset.
    ambientPulse.js     Sparse mechanical ticks mixed into a looping ambience buffer (reuses the noise grain: no gameplay random draws).
    mallMusic.js        Pure, deterministic PCM composition of the lounge loop; used by the music worker and the export/preview tests.
    musicWorker.js      Web Worker that renders mallMusic once, off the main thread (inlined as a Blob worker in the single-file build).
  fx/
    ballView.js         Browser side only: draws `balls.list` (the Tennis Ball Launcher's balls) as a pool of tumbling tennis balls between last tick's and this tick's position (alpha).
    throwableView.js    Browser side only: draws `equipment.live` (Kiosk Kevin's thrown things) as a pool of cola bottles: tumbling in the air, lying and
                        rattling on the floor, swelling as the fuse runs out; a mesh is hidden when its item is gone; dispose() frees the pool.
    closingKeyView.js   Reusable spinning key and signature props for the four closing pickups.
    powerUpView.js      Reusable delivery carton, blue beacon and security badge (no lights/colliders); bob/spin/blink,
                        floor-projected Blue Light ring clipped at walls/voids, hide on reset/death, owned-resource disposal
    contactShadows.js   One instanced draw for soft zombie grounding; interpolates feet and finds supporting collider tops.
                        No collision, hitbox or navigation changes; clear on restart, dispose owned GPU resources on unload.
    impactMarks.js      Persistent world aftermath: visible-mesh ray + flat-face corner checks, ring of 200 marks shared
                        across instanced signature pools. Skips shutters/unsupported edges; follows rigid surface transforms,
                        removes marks when surfaces unload, clears on restart. prepare(renderer,camera) warms shared graphics.
    impactModels.js     Small shared staple/nail/dart/confetti meshes with vertex colours; three procedural price-sticker textures
    effects.js          Tracers (pooled) + particle bursts (one InstancedMesh): splat(), puff(), clear() (new run). A splat palette flagged
                        `foam` (or the Mascot's) keeps its colours in Red splatter mode (Sunny is stuffing, not blood).
                        The Mascot's foam palette bypasses flesh splatter settings.
    benchmark.js        Times a fixed camera route (map.benchmarkShots) so a visual change can say what it costs (Shift+B on the title or pause screen).
    lightPool.js        A fixed number of real point lights shared out among the map's lamps.
    metalSheen.js       Something for metal to reflect: a tiny gradient (config/look.js metalSheen) baked once and given to metal materials only
                        (metalness >= minMetalness, no envMap of their own), after static batching. Without it steel, chrome and brass render nearly black.
    postProcessing.js   The render pipeline: the world pass, then the depth-cleared first-person viewmodel pass, plus post effects.
    roomCulling.js      Skips drawing rooms the camera can't see (the map's cullAreas / cullPortals).
    zoneGrading.js      Per-area colour grade (exposure, tint, saturation, contrast; config/look.js grading), eased as the camera moves.
                        The horror layer's mood darkens it (exposure), multiplies the lateHours grade on by its decay, and turns a cut area red.
  vite.config.js        Dev server only: compiles the game at server start (warmup) and skips .claude, dist, dist-single, references and scratch. Paths are absolute from this checkout, so a worktree keeps its own hot reload.
  play.cmd              Double-click version of `npm run play`. tools/play.mjs rebuilds the single file if the source is newer, keeps the last good build if that fails, and opens it in Firefox (the Windows default for .html may be another browser).
  (tools/)              Dev scripts (not bundled): buildSingle.mjs = `npm run build:single` (a normal Vite build into dist-single/, then the JS, CSS and
                        the music worker (as a Blob worker) pasted into ONE html file; the Google Fonts link loads non-blocking so a blocked
                        network just falls back to system fonts; tests/singleFile.test.js builds it and checks it is self-contained); balance.js = gun balance maths shared with the tests (seeded Monte Carlo of each
                        gun's real spread + pellets vs a Shopper's hitboxes at a range: expectedShotDamage, sustainedDps, burstDps,
                        shotsToKill); gunReport.mjs = `npm run balance`; meleeReport.mjs = `npm run melee` (swings to kill by round, plain box cutter vs the Customer Service tiers); gunSheet.html/.js = a contact sheet of one gun in eight upgrade states (`npm run dev`, /tools/gunSheet.html?gun=nailGun&view=left); babReport.mjs = `npm run balance:bab` (headless horde bot: plain gun vs warranty tiers vs builds); clawOdds.js = GRAB-A-GUN's odds
                        simulation (seeded; the game's own roll; perfect / 3-in-4 / random / timed presses; sites, plush closes, wall value,
                        points per specific gun vs its cheapest wall route); clawSim.mjs = `npm run sim:claw [price]` prints it (the plan's odds tables);
                        economySim.mjs = `npm run sim:economy` (docs/economy-report.md is written from its tables): plays the real game headless, many seeds in parallel
                        child processes, with economyBot.js (the bot: aims with error, kites, shops by TELEPORT from a buy order, immortal or mortal; records income by
                        source, purchases and the loadout each round) following economyPlans.js (PLANS = buy orders; PROPOSALS = config changes applied in memory only,
                        so a before/after is measured without touching src/config), beside economyModel.js (the maths: wave mix, points a zombie, the upgrade ladder);
                        finished runs are kept in scratch/economy-sim/ (git-ignored) until the game's code or that plan changes; --quick for a short, noisy look
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
    sunnyModel.js       buildSunnyModel(size) -> { root, legs, body }: Sunny the plush, low-poly (body, merged rays, a staring eye, a button
                        eye, a crooked smile, two legs), feet at the origin, facing -Z; disposeSunnyModel(root).
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
    neonDemo.js         Debug only: a sample wall of everything world/neon.js can make.
    posterTextures.js   The mall's posters, drawn on canvas (upbeat slogans, something wrong in each); 'ghost' = a faded advert painted on a wall.
    canvasAtlas.js      Many painted panels on one canvas texture (createCanvasAtlas, atlasQuad), so an area's signs draw as one mesh.
    paintedInteriors.js Flat canvas art for the concourse pass: shop interiors in one-point perspective by kind, shop signs, the campaign
                        art, the floor medallion, the accessible-bay symbol.
    scatter.js          Places decor-kit clutter on a floor area, deterministic per seed, merged into one mesh per material.
    staticBatch.js      Merges still, opaque map meshes into a few big ones (fewer draw calls); userData.dynamic opts a mesh out.
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
                        boss name, job title and health bar while an encounter is active. retail.css gives each employee
                        a department design: Murray's caution sign, Kettle's security badge, Dennis's clipboard and
                        Skylar's livestream frame. data-boss changes and clears with the encounter; follower text updates live,
                        bottom-left health (white) + stamina (green) bars, bottom-right ammo counter (with setPockets: Kiosk Kevin's two
                        equipment pockets left of the count, icon + charges + button, an empty one a faint dashed outline),
                        reload prompt under the crosshair, buy prompt below it (setInteract: "Hold F to open X 500",
                        red cost when unaffordable, shake when denied, hold-progress bar), red hurt edges, click-to-play/paused overlay,
                        "Clocked Out" results screen with Play again (plain DOM). Pause screen: Click to play + Settings (left) /
                        Controls (right) buttons (onOpenSettings/onOpenControls); FPS counter top right (setFpsVisible/setFps);
                        setAmmoTier(tier): "<Tier> warranty" in the tier's color under the gun name
                        (hidden at Standard; main.js feeds it from tierOf(gun.modsFor(...))); showAnnouncement({ kicker, text }): PA-style banner under the round banner (new zombie types)
    damageDirection.js  Computes relative damage angle (0° = front, 90° = right, 180° = behind, 270° = left) and queues damage indicators for the HUD.
    retail.css          Retail presentation layer loaded after style.css: mall directory, distinct combat signs,
                        shelf tickets, personnel paperwork, facilities settings and handbook. Responsive + reduced motion.
    bagMarker.js        The HUD arrow to a Limited Edition or closing key: name, distance, floor and time left when applicable.
    birthCertificate.js The Birth Certificate notice at collection. Clears itself; nothing pauses.
    orderForm.js        Draws the order form from its view. Only draws: choices come in on the fixed tick. Sized from the screen height (retail.css --order-base,
                        everything in em), left of centre; keys drawn as keycaps (keycaps()), one line on what the order does (orderSummary()), stuffings
                        you can't pick folded into a short "Not in stock" list.
    fittingRoomPicker.js Draws the fitting-room picker from its view (hud.setFittingRoom): four slot columns on the order form's paper and keycaps, the
                        highlighted item's stat lines in green and red. Only draws.
    ritualHud.js        The order ticket on the HUD: the gun's stage, one progress bar, the gauge and time (reads the ritual's status).
    announcements.js    Bounded PA queue: type introductions priority 2, incentives 1, routine messages 0; a message flagged `keep` is never trimmed and is re-queued if cut off;
                        clear on pause/death/reset; wall-clock presentation timers only
    noticeHistory.js    The run's PA notices, kept for the Notices menu (queued and pre-empted ones too); pausing never clears it.
    noticesMenu.js      createNoticesMenu(history): the pause screen's list of this run's PA notices.
    readability.css     Readability and layout over retail.css: text sizes, the corner lanes, the centred boss/round lane.
    outfitRail.js       Draws the outfit rail (createOutfitRail({ variant })): a chrome hanger rail with four price tags in the items' colours, dashed
                        silhouettes for empty slots, a swing + glow on pulse. Variants: 'hud' (over the health bar, from round 1), 'pause' (large, with each item's
                        lines) and 'receipt' (the death receipt's DIED WEARING row).
    outfitIcons.js      The rail's SVG pictures: one icon per item (`icon` ids in config/wardrobe.js) and one dashed silhouette per slot.
    screens.js          The menus around a run (title, run mode, statistics, pause, results) as plain DOM over the canvas. The run mode chooser lists config/closingTime.js modes
                        (Directed first), focuses the remembered mode (setRunMode) and stays up after a mode is confirmed until play starts (startRequested).
    runStart.js         createRunStart({ game, screens, settings, play }): a mode confirmed on the chooser is stored (game.closingMode, the 'closingMode' setting) and play() is
                        asked once. No reset (the title already reset the run) and no pause screen; acceptsLock() tells main.js whether an arriving pointer lock may start play.
    titleCamera.js      The title flyover: plays map.titleShots forever behind the main menu.
```

## How the pieces connect (moved from CLAUDE.md)
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

## The movement test range (debug only; moved from CLAUDE.md)
- Built when `debug.testArena` is true; press **T** in-game to teleport between the mall and the range
  (`player.teleport({ position, yaw })`). Its colliders go into the same shared `colliders` list.
- 60x60m open floor centered at (0, -100), far south of the mall, 2m border walls, 1m floor tiles.
- Shooting range: 5 practice dummies (3 at local z=17 near spawn, 2 at (+-9, 0)) with round-1 zombie health.
- Contents: runway with a line every 5m; slide bars + an 8m low tunnel (underside 1.2m: crouch fits,
  standing doesn't); pillars; stairs (0.5m steps) to a 2m platform; jump boxes 0.3-1.2m (1.2 is
  deliberately unreachable); 0.6m platforms with 2/3/4/5m gaps for sprint-jumps.
- Turn `debug.testArena` off before shipping. Don't build game features into it.

## Notes by system

Skylar's appearance: config/influencerLook.js owns her outfit, palette, ponytail, accessories, phone rig and pose tuning.
zombies/bosses/influencerModel.js dresses and poses the shared zombie skeleton, with zombieModel owning batching and disposal.
The influencer behavior exposes its existing phone wind-up to the visual pose through phoneFlashWindup.

Boss spectacle: bossSpectacle in config/bosses.js owns death confetti and employee poses; audio.js owns unique synthesized stings. zombieManager emits the same single kill event after the cartoon boss death burst. zombieModel applies bone poses and disposes costume geometry. debugCommands/debugPanel expose the next selected boss. tools/gunReport.mjs includes a boss encounter table.

Boss scheduling: bossDirector exports bossIntroRounds/isEncoreRound, skips optional mascotVariants.unlockRound values in both debut/encore choices, and remembers actual encounters until reset. Cadence is bossTiming.encores.

Influencer: bosses/influencer.js owns filming movement, follower thresholds, fan requests/departure and phone windup. bosses/filmingSpots.js selects reachable shootable cell centres; navigation.pathTo uses an independent breadth-first route without replacing the shared horde flow field. ui/bossFlash.js presents the event, obeys the Comfort setting, and cancels on death/reset. Fans use zombieManager spawn metadata and delayed no-kill dismissal.

Guard: zombies/bosses/guard.js owns alarm, physical shutter closure, radio headshots, reinforcement retries and taser slowdown. maps/areaBarriers.js supplies areaAt and barriersAround through loadMap. Shutters expose kind; ownership is never reset by lockdown. rounds.spawnBackup consumes the existing toSpawn budget and respects maxAlive.

Boss encounters: bosses/manager.js owns meetings/reports; bosses/employeeModel.js mounts configured costume parts and owns the temporary whiteboard. game/bossVouchers.js wires carried-gun/area eligibility and points conversion into pricing. powerUps.js and powerUpView.js deliver voucher pickups through the existing reward queue.

Boss groundwork: zombie.js owns timed buffs, source-bound holds and a behavior control function. pricing.js owns a separate one-use voucher, eligibility conversion and sale/coupon/voucher order. debug.run('summonBoss', id) selects a boss explicitly.
