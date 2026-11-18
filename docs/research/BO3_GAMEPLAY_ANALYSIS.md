# Mall Zombies: BO3 gameplay research and prototype recommendations

> **The COD scripts are not in this repo.** The decompiled scripts this analysis cites (once in `references/`) were removed
> on purpose in November 2026. Each citation below is kept as plain text, `file`:line, naming the script and line it came from.

Analysis date: October 12, 2026. Game commit: 5dceb92. Analysis only; I did not edit game files. Gameplay sources remained unchanged. The final audit observed a concurrent `.gitignore` addition of `references/`, which I did not write or revert.

The prototype's biggest problems are consistency and the ability to sustain its existing combat loop. Its short, moving zombie attacks, directional movement penalties, headshot incentives, and train-preserving crowd rules are worth keeping. The immediate work should make these systems reliable and readable, then tune how often they put the player under pressure.

This assessment follows your stated priorities: difficult waves, movement and combat mastery, powerful eventual loadouts, BO3 as an overall reference, trainable dense hordes that are not single file, and one life. New weapons, zombie types, perks, quests, power-up content, and meta progression are outside the proposed work.

## Evidence and limits

**GSC-confirmed** means an operation, constant, condition, or formula is visible in the supplied scripts. **Derived** means calculated from those scripts or the prototype's code. **Engine-dependent** means the scripts call a native engine function or read a weapon/animation asset whose implementation is absent. **Design judgment** identifies an expected feel outcome or proposed tuning; it is not a measured player preference.

The primary evidence is the local decompiled snapshot. I cross-checked health scaling, wave quota, spawn delay, gait selection, attacker suppression, and health timing against their mod-tools counterparts. These agree on the relevant logic. The repositories are snapshots without local Git revision metadata. The decompiled README (`README.md`:1) describes a partial asset dump and warns that the decompiler can produce strange code. Defaults below describe the generic, ordinary-round, solo code path; map callbacks, difficulty, special rounds, perks, and other modifiers can override it.

The scripts do **not** establish an exact universal BO3 ordinary swipe damage value, a universal wind-up/recovery duration, ordinary weapon damage/recoil/fire-rate/penetration tables, or exact base sprint and slide physics. Treating those as proven would give a false comparison. BO3 uses native coordinate units; Mall Zombies uses meters. I have not assumed a conversion to declare their reach numbers equivalent.

## Phase 1 — Research Black Ops 3

### 1. Zombie AI and interaction with players

**Targeting.** The registered `zombieFindFleshService` calls `zombiefindflesh`. It considers ignore-player rules, points of interest, designated targets, overrides, and the closest valid player. The closest-player helper checks validity and exclusions before selecting by distance. Default goal updates then go through the native `zombieupdategoal()` path. This is pursuit of a valid target; the visible default code does not establish a general system that predicts the player's future position and sends every zombie to intercept it. See _zm_behavior.gsc — zombiefindflesh (`_zm_behavior.gsc`:107), target selection (`_zm_behavior.gsc`:182), get_closest_valid_player (`_zm_utility.gsc`:1586), and native goal update (`_zm_behavior.gsc`:283).

**Optional route variation.** The shared `zombietargetservice` uses the player's last valid position. It calls `zombieupdatezigzaggoal` only when `level.zombie_use_zigzag_path` is defined and true. That helper refreshes on timer expiry, proximity within 250 native units, or closeness to its existing goal. Its distant-path branch samples a deviation along a path and a nearby unclaimed navigation point; default goal refresh time is randomized between 2,500 and 3,500 ms. This is a real implementation, but the branch is optional: finding the function is not proof that every retail map uses it. See zombietargetservice (`zombie.gsc`:595), zigzag enable gate (`zombie.gsc`:664), and zombieupdatezigzaggoal (`zombie.gsc`:689).

**Attack initiation.** `zombieshouldmeleecondition` rejects missing enemies, marked-for-death zombies, ignored melee, and an active enemy override. It requires 3D distance squared at most 4,096, corresponding to 64 native units, and a yaw difference at most 60 degrees. Attack properties also set `meleeattackdist = 64`. The GSC initiation condition itself does not include a wall trace; the subsequent native melee call can impose additional checks. See zombieshouldmeleecondition (`zombie.gsc`:961) and zombie_setup_attack_properties (`_zm_spawner.gsc`:2542).

**Attack execution and timing.** `initzombiebehaviorsandasm` registers an animation notetrack named `zombie_melee`; its handler is `zombienotetrackmeleefire`. The ordinary player-target branch calls native `entity melee()`. The script therefore confirms that an animation event triggers melee execution, but exact impact timing, native hit trace, ordinary swipe damage, movement compensation, and recovery duration need engine/animation/weapon evidence. See notetrack registration (`zombie.gsc`:83) and zombienotetrackmeleefire (`zombie.gsc`:525).

**Hit reactions and commitment.** Normal spawn initialization disables arrivals/exits, ignores suppression, disables dodge movement, sets `a.disablepain = 1`, and calls `disable_react`. Thus a guaranteed bullet stagger that cancels every incoming attack is not supported by this default setup. There are stumble and pain-related paths and exceptions; it would also be wrong to claim BO3 zombies can never react. See spawn movement/suppression setup (`_zm_spawner.gsc`:316), pain/react setup (`_zm_spawner.gsc`:343), and disable_react (`_zm_utility.gsc`:5136).

**Crowd interaction.** Scripts expose actor-pushing controls and navigation goals, but much of actor collision, path following, and crowd resolution belongs to the engine. The evidence does not justify copying a supposed exact BO3 separation radius or replacing our crowd system with a universal interception ring. `round_spawning` also disables the `can_juke` behavior attribute for spawned AI when present: spawned AI juke setting (`_zm.gsc`:3849).

The jumping-melee condition is gated by `low_gravity` and additional airborne/distance checks. It is not evidence that ordinary zombies should routinely jump-attack in our prototype: zombieshouldjumpmeleecondition (`zombie.gsc`:1002).

### 2. Lethality, consecutive hits, and poor positioning

**Base health is a confirmed default; ordinary swipe damage is not.** `init_levelvars` sets `player_base_health = 100`; the player spawn path calls `perk_set_max_health_if_jugg("health_reboot", ...)`, which starts with that base and applies eligible boosts. See player_base_health (`_zm.gsc`:1259), on_player_spawned (`_zm_playerhealth.gsc`:88), and health_reboot branch (`_zm_perks.gsc`:819).

The spawner sets `self.meleedamage = 60`, but its confirmed direct use includes attacking through boards. The ordinary player melee path calls the engine instead. Consequently, this 60 does **not** establish that every ordinary BO3 swipe does 60 damage. It also does not prove our chosen 40 damage is an exact BO3 asset match. See meleedamage field (`_zm_spawner.gsc`:407), through-boards direct damage (`_zm_spawner.gsc`:1127), and ordinary native melee (`zombie.gsc`:567).

**Repeated-attacker suppression.** `player_damage_override` returns zero when the attacker equals `self.ignoreattacker`. A successful zombie damage path replaces that field and launches `remove_ignore_attacker`, whose default timer is 0.4 seconds. This is one most-recent-attacker slot, not global immunity and not a separate timer for every zombie. A different attacker replaces the slot, so an A–B–A sequence is not the same as three blocked hits from A. See player_damage_override attacker gate (`_zm.gsc`:5215) and remove_ignore_attacker (`_zm.gsc`:5137).

**Invulnerability bookkeeping requires caution.** The health module has pre-critical, entering-critical, and post-critical timing values of 0.35/0.5/0.3 seconds and sets a flag named `player_is_invulnerable`. However, the supplied zombie damage override does not visibly use that flag as a damage gate. I found its bookkeeping in both snapshots, not a confirmed general immunity implementation. Its presence is insufficient to recommend adding blanket half-second immunity as a BO3 fidelity fix. See health timing constants (`_zm_playerhealth.gsc`:66), invulnerability flag bookkeeping (`_zm_playerhealth.gsc`:311), and playerinvul (`_zm_playerhealth.gsc`:348).

**Positioning pressure.** Distinct nearby attackers can pass the visible attacker gate. Normal zombies are not reliably stopped by every bullet; melee execution is coupled to animation events; and the spawn loop can sustain a large living crowd. The inference is that crowd geometry and committed attacks matter at least as much as a single attacker's cadence. Exact simultaneous-hit outcomes still depend on the original damage pipeline.

The player damage callback applies a no-knockback flag before native damage completion. That supports preserving the distinction between camera hurt feedback and physically throwing the player backward: callback_playerdamage no-knockback flag (`_zm.gsc`:1525).

### 3. Player movement, regeneration, and recovering from mistakes

**Regeneration is severity-dependent.** The health loop waits 0.05 seconds plus a network-frame synchronization. Its regular delay is 2,400 ms. Above the critical state, it restores normalized health to 1 after that delay. At health ratio at most 0.2, it enters a critical state that remains latched until full recovery. In that state, healing does not advance until more than 5,000 ms after the last hurt time, then adds 0.1 of maximum health per iteration. From 20% health this is approximately eight healing iterations, about 0.4 seconds plus scheduling overhead. A 5.4-second full-recovery estimate is derived, not an exact wall-clock guarantee. Every new hurt event resets the timer. See regeneration constants (`_zm_playerhealth.gsc`:66), playerhealthregen (`_zm_playerhealth.gsc`:133), critical-state latch (`_zm_playerhealth.gsc`:211), and healing branch (`_zm_playerhealth.gsc`:231).

This creates a useful difference between an ordinary scrape and a near-fatal mistake. It does not imply that we must copy instantaneous ordinary healing or every threshold.

**Movement limits of the evidence.** Startup explicitly disables `sprintLeap_enabled`, and Stamin-Up is registered as an engine perk. Those calls do not supply the base sprint duration, sprint speed, directional movement multipliers, slide acceleration, or a slide-cancel formula. I cannot verify those numerical movement parameters from the supplied GSC alone. Our movement-tech decisions should therefore be evaluated against your vision and our own behavior. See sprintLeap startup setting (`_zm.gsc`:207) and Stamin-Up registration (`_zm_perk_staminup.gsc`:39).

### 4. Weapon mechanics, reactions, and ammunition

**Damage and handling are partly asset/engine driven.** The damage callbacks receive an already-computed damage amount, hit location, weapon, and modifiers. GSC routes these through game-specific callbacks and handles feedback, scoring, special weapon cases, and perks. It does not provide a universal 3x head multiplier or a complete ordinary-gun recoil, magazine, reload, spread, penetration, and rate-of-fire table. Exact starting-pistol equivalence cannot be established from these repositories. See actor_damage_override (`_zm.gsc`:5676) and zombie_damage (`_zm_spawner.gsc`:1945).

**Ammo has sustainable acquisition paths.** `weapon_spawn_think` distinguishes weapon ownership/purchases from ammo purchases; after `ammo_give` reports success, it deducts the ammo cost. `ammo_give` reads `weapon.maxammo`, clip/ammo engine queries, and invokes `givemaxammo`. `full_ammo_powerup` invokes `givemaxammo` for eligible owned weapons. The calls are confirmed; their exact clip-versus-stock semantics are engine-dependent here. See weapon_spawn_think (`_zm_weapons.gsc`:2192), ammo purchase completion (`_zm_weapons.gsc`:2470), ammo_give (`_zm_weapons.gsc`:3171), and full_ammo_powerup (`_zm_powerup_full_ammo.gsc`:54).

For our scope, the useful lesson is maintaining a combat loop with the existing gun. Implementing random drops, an armory, or weapon tiers is unnecessary to test it.

### 5. Round progression and escalation

**Health formula, confirmed.**

- Round 1: 150.
- Rounds 2–9: add 100 each round.
- From round 10: `H[r] = H[r-1] + int(0.1 * H[r-1])`.
- The function includes signed-overflow protection.

This means 950 at round 9, 1,045 at round 10, 1,679 at round 15, and 2,701 at round 20. See ai_calculate_health (`zombie_utility.gsc`:2293); cross-check mod-tools counterpart (`zombie_utility.gsc`:1906).

**Solo ordinary-round quota, confirmed default and derived simplification.** With default `zombie_max_ai = 24` and `zombie_ai_per_player = 6`:

```text
M = max(1, round / 5)
if round >= 10: M *= round * 0.15
base = 24 + int(3 * M)

rounds 1–5: quota = int(base * [0.25, 0.30, 0.50, 0.70, 0.90][round-1])
round 6 onward: quota = base
```

At round 10 onward this is approximately `24 + floor(0.09 * round²)`: **quadratic quota growth**, unlike exponential health growth. See get_zombie_count_for_round (`_zm.gsc`:3872), default_max_zombie_func (`zombie_utility.gsc`:2321), and default wave constants (`_zm.gsc`:1244).

**Concurrent limits are separate.** The ordinary default living-AI limit is 24; the actor limit is 31, with corpse-budget handling in the spawn loop. The `zombie_max_ai` value used above is a quota input, not the only limiter. Special maps can override these values. See AI and actor limits (`_zm.gsc`:308) and round_spawning capacity gates (`_zm.gsc`:3772).

**Spawn cadence.** Solo default delay is `max(0.1, 2 * 0.95^(min(round,60)-1))`. Multiplayer starting delays are 1.5, 0.89, and 0.67 seconds for two, three, and four players. Successful spawn creation decrements quota; the loop also waits for AI/actor capacity, valid locations, and game/map gates. Formula delay is therefore not guaranteed time between zombies reaching the player. See get_zombie_spawn_delay (`_zm.gsc`:4626) and successful-spawn accounting (`_zm.gsc`:3834).

**Movement escalation.** `set_run_speed` samples an integer between the movement index and index + 35, then chooses walk at values <=35, run at <=70, otherwise sprint. Those are gait/animation categories; numerical world speed remains asset/engine-driven. Initial round 1 forces index 1. Normal progression updates the index from the old round number before incrementing the round; an index of `4 * round` for every newly entered round would therefore misdescribe this code path. See set_run_speed (`zombie_utility.gsc`:2575) and movement index and round-number update ordering (`_zm.gsc`:4521).

**Round transitions.** `round_wait` requires the living round-enemy array and remaining quota to empty, with intermission/override exceptions, and polls at one-second intervals. `round_over` waits the configured default 10 seconds. The next ordinary `round_one_up` adds 2.5 seconds before subsequent setup/spawning; the generic combat-to-combat gap is thus about 12.5 seconds plus polling and other gates, not simply 10. First-round intro waits differ. See round_wait (`_zm.gsc`:4730), round_over (`_zm.gsc`:4257), and round_one_up (`_zm.gsc`:4195).

**Tail cleanup and failsafes.** The default early-round speed-up thread returns in rounds 1–3, then waits until remaining spawn quota is <=4; when exactly one zombie is alive, it can switch that zombie to sprint. The default spawning path starts this thread before round 10 or under another speed-change condition. This is not “all last four zombies always sprint.” Separately, `round_spawn_failsafe` checks every 30 seconds by default, has crawler/inert/barrier exceptions, and kills/requeues appropriate actors that fall below the world or move less than 24 native units between checks. See zombie_speed_up (`zombie_utility.gsc`:2362), speed-up thread gate (`_zm.gsc`:3763), and round_spawn_failsafe (`zombie_utility.gsc`:2205).

### 6. Combat economy

With default scoring and no modifiers:

| Event | BO3 points | Mall Zombies points |
| --- | ---: | ---: |
| Nonlethal ordinary hit | 10 | 10 |
| Torso kill | 50 base + 10 = 60 | 60 |
| Head/helmet kill | 50 base + 50 = 100 | 60 + 40 = 100 |
| Melee kill | 50 base + 80 = 130 | 60 + 70 = 130 |
| Neck kill | 50 base + 20 = 70 | Uses simplified body/head hitboxes |
| Limb/default kill | 50 | Uses simplified body/head hitboxes |

The normal damage listener exits when the zombie is no longer alive; fatal-hit scoring is handled separately and death-point duplication is guarded. Our “+10 nonlethal, otherwise kill payout” design matches that distinction. See score constants (`_zm.gsc`:1263), player_add_points (`_zm_score.gsc`:153), player_add_points_kill_bonus (`_zm_score.gsc`:393), enemy_death_detection (`_zm_spawner.gsc`:203), death payout guard (`_zm_spawner.gsc`:1637), and [pointsForHit](../../src/game/wallet.js#L45).

The existing payouts already create a points-versus-ammo tradeoff: with our gun, a round-2 body kill earns 140 points from eight nonlethal hits and the kill, while a headshot kill earns 120 from two nonlethal hits and the kill. Body shooting uses nine rounds versus three for headshots. Preserve this distinction when evaluating the eventual refill cost; more income does not necessarily mean more efficient combat.

A `damage_ads` branch can round a boosted value up to a multiple of 10, but ordinary ADS bullet damage in `zombie_damage_ads` still uses `damage`/`damage_light`. The boosted branch appears in a flame-specific path here. There is no basis for adding a universal ADS point bonus. See zombie_damage_ads (`_zm_spawner.gsc`:2085).

Other scoring events include barrier repair, revive, and power-up rewards. The generic round setup caps barrier-repair earnings at `min(50 * round, 500)`. Those mechanics are deferred content for this prototype, not prerequisites for tuning its existing gun, movement, and horde.

## Phase 2 — Compare the current prototype

### Quantitative wave comparison

These are script/config defaults, not measurements of a retail BO3 map's arrival pressure. “Cap” is a ceiling; it cannot exceed the wave's total quota.

| Round | BO3 quota / alive cap | Mall quota / alive cap | BO3 spawn delay | Mall spawn delay | BO3 HP / Mall HP |
| --- | --- | --- | ---: | ---: | --- |
| 1 | 6 / 24 | 6 / 5 | 2.00s | 3.00s | 150 / 150 |
| 2 | 8 / 24 | 9 / 6 | 1.90s | 2.60s | 250 / 250 |
| 3 | 13 / 24 | 11 / 9 | 1.81s | 2.20s | 350 / 350 |
| 4 | 18 / 24 | 14 / 12 | 1.71s | 1.90s | 450 / 450 |
| 5 | 24 / 24 | 16 / 12 | 1.63s | 1.63s | 550 / 550 |
| 10 | 33 / 24 | 29 / 20 | 1.26s | 1.26s | 1045 / 1045 |
| 15 | 44 / 24 | 41 / 24 | 0.98s | 0.98s | 1679 / 1683 |
| 20 | 60 / 24 | 54 / 24 | 0.75s | 0.75s | 2701 / 2710 |
| 30 | 105 / 24 | 79 / 24 | 0.45s | 0.50s | 7000 / 7030 |

Our health helper uses a closed-form power and one final rounding, rather than repeated integer additions. The resulting difference is tiny in the prototype's relevant rounds; copying BO3's rounding is low value. Our early concurrency caps and slower initial spawning are much more likely to explain gentler pressure. Our six-second breaks are substantially shorter, and are a reasonable deliberate choice for a prototype without lengthy between-round shopping.

Sources: [round and wave tuning](../../src/config/economy.js#L33), [wave helper formulas](../../src/config/economy.js#L65), and the BO3 round functions above.

### Combat and movement envelope

| Prototype mechanic | Current behavior | Practical implication |
| --- | --- | --- |
| Health/lethality | 100 HP; 40 per shopper hit | Three accepted hits kill; several zombies can kill within one tick |
| Zombie successful-hit cadence | 1.30s in round 1; 1.25s by round 10 in controlled 60Hz probes | Preserve the current commitment and punishment for allowing contact |
| Attack initiation / reach | 1.5m start; 1.7m hit reach; 60° half-cone | Rechecking range/facing/walls at impact makes escape spatially meaningful |
| Attack wind-up | 0.35s, decreasing to 0.30s by round 9 | Already a short, demanding telegraph |
| Forward / backward / sideways walking | 5 / 3.5 / 4.25m/s | Turning to run is meaningfully different from backpedaling |
| Fully aimed walking | 3.75 forward; 2.625 backward; 3.1875 sideways | Accurate fire has a substantial movement cost |
| Sprint | 8m/s for a four-second meter; one-second refill delay; 1.25 units/s refill | Escape consumes a renewable resource |
| Slide | Starts at 10.5m/s; landing chains skip ordinary cooldown | This can support the movement mastery you want |
| Gaits | 2 / 3.4 / 4.6m/s, with ±15% individual variation | Close-range joggers/runners are a different positional problem |
| Crowd steering speed cap | 1.35 times individual zombie speed | Fastest configured upper bound is 4.6 * 1.15 * 1.35 = 7.14m/s, excluding post-step positional shoves |
| Gun | 30 body, 90 head; 12-magazine, 60 reserve, 1.5s reload | Strong accuracy reward, but finite starting ammo |
| Gun cadence | Configured 0.12s; actual saturation ceiling 0.1333s at 60Hz | 7.5 rather than 8.33 shots/s |
| Shot reactions | Visual flinch, no guaranteed attack interruption | Preserves committed attacks rather than making rapid shooting a universal stun |
| Regeneration | Three-second delay; 50 HP/s | Full recovery after one hit ~3.8s; after two hits ~4.6s |
| Bullet traversal | One nearest hit; no multi-target traversal | A packed horde does not itself create multikill efficiency |

Sources: [health/movement/sprint/slide](../../src/config/feel.js#L13), [gaits and attacks](../../src/config/zombies.js#L10), [attack state machine](../../src/zombies/zombie.js#L132), [crowd velocity composition](../../src/zombies/zombie.js#L266), [staple gun](../../src/config/weapons.js#L10), [castShot](../../src/weapons/hitscan.js#L25), and [damage and regeneration](../../src/player/health.js#L28).

The 7.14m/s figure is an upper bound under crowd steering, not a measured sustained pursuit speed. The 1.35 multiplier allows crowd correction to affect approach speed during wind-up too. Before making runners faster, inspect actual closing speed in dense crowds; otherwise pressure may become less predictable rather than more skillful.

### Confirmed implementation problems

1. Same-frame turn/fire ordering can use old aim for a new shot.
2. Zombie damage fires at the start of the visible slam, while the arms remain raised.
3. Air steering reduces momentum while a direction is held, contradicting the documented movement rule.
4. Collision leaves horizontal velocity intact; the surround “still” test reads that velocity instead of physical movement.
5. Navigation seeds can cross a wall, creating false reachability.
6. Spawn fallbacks can ignore closed zones or route failure, and there is no zombie stuck/below-world recovery.
7. The gun has no refill path; later combat becomes forced melee.
8. The normal interaction flow does not yet open the existing shutter; concourse access is currently through debugging.

Items 7 and 8 are missing prototype functionality, not regressions in completed purchasing features.

### Differences that are design choices or need playtesting

- The currently accepted close-range attack timing should stay. BO3's absent animation data cannot justify arbitrary replacement values.
- Our moving-horde sector restriction is a deliberate aid to training; a “smarter” full-circle interception policy could undermine your goal.
- Smaller early hordes can teach controls, but prolonged low concurrency can leave movement mastery underused.
- Ordinary damage takes longer to fully recover from here than in the GSC default; critical damage recovers sooner. This may weaken the distinction between a scrape and a serious mistake.
- Firing is allowed during sprinting, sliding, and airborne movement; hip spread penalizes those actions, and ADS blocks sprint. That fits a movement-focused game. Adding an unconditional sprint-fire ban would need its own design case.
- Our gun's recoil spring returns to its starting aim and its viewmodel effects are separate. Exact BO3 recoil equivalence is unproven, and not necessary for good handling.
- No penetration, distance falloff, armor, or guaranteed bullet stun is required simply for BO3 similarity. Their benefit must be established for this gun and map.
- Points are earned but currently have few functional spending choices. Full economy balancing can wait; ammo availability and access to the already-built play space directly affect core testing.

## Phase 3 — Prioritized recommendations

The ordering places proven combat defects and blockers before provisional balance changes.

### 1. Give the existing staple gun a sustainable ammo path

**Priority: Critical. Complexity: Medium.**

**Finding:** BO3's `weapon_spawn_think` and `ammo_give` implement owned-weapon ammo purchases, with payment only after a successful refill. Max Ammo provides another route, but copying that content is unnecessary. Sources: ammo purchase handling (`_zm_weapons.gsc`:2470) and ammo_give (`_zm_weapons.gsc`:3171).

**Current implementation:** The staple gun starts with 72 total rounds. Reloading only transfers reserve into the magazine. `reset` refills for a new run; there is no in-run supply source. The existing start-room wall-buy marker refers to an unimplemented Price Gun, not the current staple gun. Sources: [damage and ammo](../../src/config/weapons.js#L13), [reset / finishReload](../../src/weapons/weapon.js#L46), and [current wall-buy markers](../../src/maps/mall/mall.js#L348).

**Difference:** Perfect headshot-only kills require 12 bullets in round 1, 27 in round 2, and 44 in round 3: 83 total. Ammo therefore empties during round 3 even without misses. Body-only kills need 30 in round 1 plus 81 in round 2, emptying during round 2. Free melee keeps survival theoretically possible, but the gun ceases to participate in the sustained loop.

**Recommendation:** Add a reserve-refill interaction for the current staple gun at an existing start-room location, using the current wallet/config system. Keep magazine loading and reload vulnerability. For isolated balance tests, a temporary between-round reserve refill preset is a simpler alternative. Choose the refill cost after measuring consumption; the planned Price Gun's ammo cost is not automatically the correct staple-gun price.

**Expected impact:** Gunplay remains available long enough to test horde management, aim, reload decisions, and movement. Scarcity can still punish waste without becoming an unavoidable switch to repetitive melee. This introduces no additional weapon or power-up content.

### 2. Make shots and movement consume the same current look input

**Priority: High. Complexity: Medium.**

**Finding:** BO3 hands ordinary weapon/attack execution to engine systems; its GSC does not establish the original frame-input pipeline. The relevant comparison is the broader need for coherent combat timing, not a claimed BO3 latency constant. The native boundary is visible in native melee execution (`zombie.gsc`:567).

**Current implementation:** The loop performs fixed updates, then render. Gun fire reads `player.getAim` during update; mouse and ordinary stick look are applied later inside render. The movement controller also uses the pre-render yaw. Sources: [update-before-render ordering](../../src/core/loop.js#L23), [movement and shooting updates](../../src/main.js#L299), [look consumption in render](../../src/main.js#L331), and [fire](../../src/weapons/playerGun.js#L42).

**Difference:** A controlled zero-spread probe with a 100-pixel mouse turn and shot in the same frame fired along the old direction while the rendered camera turned 12.61°. This is an ordering defect; it is not a measurement of a universal 12.61° miss or retail BO3 latency.

**Recommendation:** Apply pending look input once before the simulation batch that consumes movement/fire, or use a timestamped input/aim snapshot shared by those actions. Retain smooth display-rate look if desired, but define how any additional visual look differs from the authoritative shot snapshot. Avoid consuming or integrating the same input twice.

**Expected impact:** Flick shots, quick turn-and-sprint escapes, and controller tracking behave more consistently across render rates. Misses become easier to attribute to aim and spread.

### 3. Align zombie impact animation with the existing damage deadline

**Priority: High. Complexity: Low.**

**Finding:** BO3 registers `zombie_melee` as an animation event and executes melee in its notetrack handler. Exact event time is asset-dependent. Sources: notetrack registration (`zombie.gsc`:83) and zombienotetrackmeleefire (`zombie.gsc`:525).

**Current implementation:** Entering `swing` resets `stateTime` to zero and immediately applies damage. The model then begins interpolating its arms from the raised pose to the slammed pose over 0.15s. Sources: [damage on swing entry](../../src/zombies/zombie.js#L152) and [visible slam](../../src/zombies/zombieModel.js#L151).

**Difference:** Damage arrives while the model is still at the raised-arm pose. The final visible strike occurs after the authoritative hit.

**Recommendation:** Drive the pose, impact cue, and damage from one attack timeline. Preserve the current 0.35–0.30s time-to-impact by reworking the visible attack phases. Simply moving damage to the end of the existing 0.15s slam would give players extra escape time and change the close-range behavior you already approved.

**Expected impact:** Hits feel readable and fair while retaining present lethality and attack commitment.

### 4. Preserve horizontal speed when steering in the air

**Priority: High. Complexity: Low.**

**Finding:** BO3's exact air acceleration and slide physics are engine-dependent; the supplied GSC does not justify a replacement movement model. Our own documented movement rule is sufficient evidence for this fix. BO3's visible movement setup boundary is sprintLeap setting (`_zm.gsc`:207).

**Current implementation:** Airborne target speed is at least the current speed, but acceleration blends the velocity vector toward a differently directed target. Sources: [air target speed and vector steering](../../src/player/controller.js#L260) and [game rules and movement intent](../../CLAUDE.md).

**Difference:** Taking a 10.5m/s airborne velocity and steering 90° with a held direction reduced speed to 9.47m/s after six ticks, about 0.10s. Equal-length vectors blended by a chord still lose magnitude.

**Recommendation:** Separate airborne steering direction from preserved speed, with a bounded turning response. Keep the intended speed loss on released movement input and define collision behavior separately. Preserve existing slide-chain windows.

**Expected impact:** Practiced slide-jumps retain their reward through turns; movement mastery relies less on hidden speed loss.

### 5. Base stationary surround behavior on physical movement

**Priority: High. Complexity: Low.**

**Finding:** BO3 selects valid positional goals and uses engine actor/collision behavior; no visible default GSC rule gives immunity from flanking just because movement input remains held. Sources: target selection (`_zm_behavior.gsc`:182) and last-valid-position goals (`zombie.gsc`:660). This recommendation corrects our explicit surround design, rather than copying an unproven BO3 algorithm.

**Current implementation:** `assignSurroundSlots` decides whether to widen the sector from `player.velocity`. Horizontal world collision pushes position back but does not remove horizontal velocity. Sources: [stillness test](../../src/zombies/zombieManager.js#L179) and [horizontal collision resolution](../../src/world/collision.js#L106).

**Difference:** In a three-second wall-pinning probe, physical displacement was effectively zero while reported lateral velocity stayed 4.25m/s. The player never counted as stationary. Holding into a wall can therefore retain the narrow sector intended for a moving train.

**Recommendation:** Use smoothed actual horizontal displacement after movement/collision, with tolerance for tiny contact corrections, to drive stillness. Keep the current moving-horde sector and delayed widening.

**Expected impact:** Pinning yourself becomes dangerous even with movement held, while active training remains predictable and dense.

### 6. Repair reachability, spawn eligibility, and zombie recovery together

**Priority: High. Complexity: Medium.**

**Finding:** BO3 waits on valid spawning/capacity, decrements quota only after a successful spawn, and runs a 30s-default stuck/below-world failsafe with requeue rules. Sources: spawn accounting (`_zm.gsc`:3834) and round_spawn_failsafe (`zombie_utility.gsc`:2205).

**Current implementation:** The navigation field seeds every walkable cell within 1.5m of the player without checking wall connectivity. Spawn selection falls back to all markers when no zone is open, and to a random marker when no route is reachable. The round manager unconditionally decrements quota after `spawn`; there is no zombie stuck/fall recovery. Sources: [field seeds](../../src/zombies/navigation.js#L149), [spawn fallbacks](../../src/zombies/zombieManager.js#L54), [quota consumption](../../src/game/rounds.js#L76), and [movement without zombie fall rescue](../../src/zombies/zombie.js#L287).

**Difference:** A full-width-wall probe reported a finite 2.37m route where no physical route existed. A separate manager probe spawned at a closed, unreachable marker. These establish invalid fallback behavior; they do not establish that ordinary play on the current mall always stalls.

**Recommendation:** Restrict field seeds to the player's physically reachable ground region, while supporting legitimate elevated player positions. Apply physical-clearance checks to nearby-cell recovery too, so it cannot select a goal across a thin wall. Wait/retry when no eligible open, reachable, unoccupied spawn is available; consume quota only on success. Add a conservative recovery path for persistently unreachable, below-world, or genuinely stalled distant zombies. Preserve remaining health and quota, grant no free kill/points, and do not treat an attacking or deliberately crowded zombie as stuck.

**Expected impact:** Avoids phantom routes, invalid spawns, accidental safe positions, and potential rounds that cannot finish. Higher-pressure tests become trustworthy.

### 7. Make the existing concourse accessible in normal prototype runs

**Priority: High. Complexity: Medium.**

**Finding:** BO3's `door_buy` checks the use action and affordability, deducts points, and permits the door-opening flow. Source: door_buy (`_zm_blockers.gsc`:257).

**Current implementation:** The shutter wrapper, its 500-point price, zone unlocking, and collision updates exist, but the normal interaction action/purchase flow is unfinished. The current opening path in the main loop is debug O. Sources: [door wrapper](../../src/world/door.js#L18), [existing shutter](../../src/maps/mall/mall.js#L170) and [debug opening](../../src/main.js#L286).

**Difference:** Normal runs remain in the start room; movement and horde training in the already-built concourse require debugging. This is a known incomplete step, not a new regression.

**Recommendation:** Complete only this existing shutter interaction. It can share a minimal interaction framework with the current-gun ammo refill. Until then, use an explicitly configured open-concourse playtest preset. Add a gameplay action in controls rather than a raw-key feature, and resolve controller interact/reload priority.

**Expected impact:** Players can use meaningful routes and space without debug knowledge. Crowd/movement conclusions reflect the intended available arena. This adds no map area.

### 8. Add minimal positional threat and impact audio

**Priority: High. Complexity: Medium.**

**Finding:** BO3 starts ambient zombie vocal threads, assigns an attack-vocal event, and invokes swipe/hurt feedback in the player-damage path. Sources: zombie vocal setup (`_zm_spawner.gsc`:299) and swipe feedback (`_zm.gsc`:5243).

**Current implementation:** The synthesizer has gun/dry-fire/reload sounds; zombie attacks and player damage provide visual feedback but no corresponding threat/impact sound. Sources: [current sound recipes](../../src/config/audio.js#L20) and [player-hit callback](../../src/main.js#L200).

**Difference:** A horde can arrive or begin attacks outside the view without a comparable auditory warning. This matters particularly while facing away to train.

**Recommendation:** Add a short nearby wind-up tell, an impact cue synchronized to accepted damage, and sparse nearby zombie presence sounds using the existing audio system. Give threat sounds distance attenuation and directional information; limit concurrent voices.

**Expected impact:** Improves situational awareness without lengthening wind-up or reducing damage. Surprises can remain dangerous while being more learnable.

### 9. Tune crowd pressure and gun effectiveness together

**Priority: Medium. Complexity: Low.**

**Finding:** BO3 separates quota, concurrency, spawn cadence, health, gait, and ammo supply. Round 5 defaults support 24 total/living zombies, while health remains 550. Sources: quota (`_zm.gsc`:3872), concurrency (`_zm.gsc`:3772) and health (`zombie_utility.gsc`:2293).

**Current implementation:** Our round 5 is 16 total/12 concurrent, despite matching its default solo spawn cadence and health. With the only gun, round 4 takes 15 body shots, exceeding one magazine; round 10 takes 35 body or 12 headshots; round 15 takes 57 body or 19 headshots. Sources: [wave tuning](../../src/config/economy.js#L41), [current weapon output](../../src/config/weapons.js#L13), and [single-target shot](../../src/weapons/hitscan.js#L49).

**Difference:** There can be fewer simultaneous positional decisions but growing per-zombie shooting/reload work. That can create repetition rather than the movement challenge you want. This is a design inference, not a completed playtest finding. BO3 can support this scaling with an arsenal; our prototype currently cannot.

**Recommendation:** After the fixes and ammo supply, test round-5 cap 16, round-8 cap 20, and round-10 cap 24 as an experimental pressure preset, within existing wave quotas. Preserve the gentle first two rounds. Keep HP unchanged in the first comparison; then adjust existing gun output or prototype health escalation only if measured headshot/body time-to-kill becomes repetitive. Test a bounded early/middle-round envelope before attempting endless single-starter balance.

**Expected impact:** More decisions about gathering, turning, firing, reloading, and escaping; less reliance on longer health bars for difficulty. The figures are trial settings, not established optimal values. Profile CPU/GPU/frame pacing before retaining higher concurrency; BO3's 24-actor budget is not automatically a browser performance target.

### 10. Test a clearer distinction between ordinary and critical recovery

**Priority: Medium. Complexity: Low.**

**Finding:** BO3 ordinary recovery begins after 2.4s and snaps to full, while <=20% critical damage delays progress until after 5s and then restores 10% per health-loop iteration. Source: playerhealthregen healing branch (`_zm_playerhealth.gsc`:231).

**Current implementation:** Every accepted hit selects the same three-second delay and 50 HP/s rate. Controlled probes reached full after one hit at 3.82s and after two at 4.62s. Source: [damage and regen](../../src/player/health.js#L28) and [health tuning](../../src/config/feel.js#L21).

**Difference:** A scrape lingers longer than the default GSC ordinary recovery, while a near-death event resolves sooner. The practical distinction is mainly the amount to refill.

**Recommendation:** Trial a 2.4s ordinary delay and a four-second critical delay while retaining visible 50 HP/s healing. With current 40 damage, this gives roughly 3.2s full recovery after one hit and 5.6s after two. Latch critical status until full recovery; expose tuning through config/stats. Compare against the present baseline before adopting.

**Expected impact:** Small mistakes interrupt play for less time; major mistakes demand a longer successful escape. Preserve 100 HP and 40 damage initially, and do not add blanket immunity on the basis of an unproven GSC flag.

### 11. Preserve fractional fire timing during queued rapid clicks

**Priority: Medium. Complexity: Low.**

**Finding:** Exact BO3 weapon cadence is engine/asset-dependent; there is no verified GSC value to copy. This is a local discrepancy between configured handling and its implementation, not a claim that BO3 uses our proposed timer algorithm.

**Current implementation:** Cooldown is clamped to zero each tick and reset to 0.12s after a shot. Source: [cooldown update](../../src/weapons/weapon.js#L68) and [cooldown reset](../../src/weapons/weapon.js#L92).

**Difference:** In a saturation probe, shots occur every eight 60Hz ticks: 0.1333s, or 7.5 shots/s. The configured interval implies 8.33 shots/s. Actual maximum cadence is 10% lower.

**Recommendation:** Carry the sub-tick remainder or use appropriately bounded simulation-time deadlines while clicks remain queued. Discard stale accumulated debt after idle periods. Preserve one shot per accepted semi-auto click and at most one shot per simulation tick; do not accidentally introduce burst catch-up or automatic fire.

**Expected impact:** Maximum fire speed and time-to-kill align with the configured value while retaining the fixed 60Hz simulation.

### 12. Consider a restrained round-tail speed-up

**Priority: Low. Complexity: Low.**

**Finding:** BO3's default speed-up can promote the sole living zombie once the remaining spawn quota is small, with early-round/thread gates. Source: zombie_speed_up (`zombie_utility.gsc`:2362).

**Current implementation:** Gait is selected at spawn and remains unchanged; the round waits for all living zombies and quota to clear. Sources: [gait selection](../../src/zombies/zombieManager.js#L69) and [round completion](../../src/game/rounds.js#L81).

**Difference:** A final slow shopper can create a longer cleanup phase, especially when the concourse is open.

**Recommendation:** Only if playtests show tedious tails, speed up a distant final walker after quota is fully exhausted and a grace period has elapsed, from round 4 onward. Preserve an intentional last-zombie breather; do not kill it automatically.

**Expected impact:** Shorter uninteresting cleanup without changing the main horde or removing player control over round timing.

## What should be preserved

- **The current moving, committed attack baseline:** short wind-up, impact-time range/facing/wall rechecks, 40 damage, longer recovery after a hit, faster retry after a miss.
- **Train-preserving lanes, queueing, and sector limits:** correct the stillness measurement instead of replacing the horde with full-circle interception.
- **Movement tech:** slide-jumps, landing chains, jump buffering, coyote time, and the directional/ADS tradeoffs. Repair momentum retention first.
- **Visual flinch without universal stun:** bullets provide feedback without guaranteeing that the closest zombie stops its attack.
- **Accuracy rewards:** 3x headshot damage and generous, refreshed head hitboxes give clear feedback in a stylized shooter. Their BO3 numerical equivalence is not required.
- **Weapon feedback architecture:** recoil affects authoritative aim; roll/model kick are visual; shots, muzzle flash, audio, and hit markers are coupled. Repair look ordering while retaining this separation.
- **Existing payouts:** +10 nonlethal, 60 body, 100 headshot, 130 melee. Limb/neck score distinctions are unnecessary for this prototype.
- **Separate wave quota, concurrency, delay, and health:** this is the right structure for tuning. The six-second breaks and immediate next-round announcement can stay.
- **One death path and one life:** no revive system is needed for this phase.

## Validation and suggested implementation sequence

Read-only headless probes instantiate the actual game modules and fresh in-memory Three.js objects; they do not load the browser UI or render WebGL. I checked formulas, saturated gun cadence, air steering, health recovery/death callback behavior, impact state, wall-pinned velocity, false navigation reachability, invalid spawn fallback, same-frame look/fire ordering, and repeated zombie hit times. They establish implementation behavior, not human feel, hardware-controller quality, browser input-event latency, or GPU performance.

The numeric wave values are derived from the displayed GSC formulas, using ordinary solo defaults; BO3 scripts were not executed in the original engine. Probe artifacts are outside the game workspace:

- Numeric probe source (`mall-gameplay-numeric-probes.mjs`, not in the repo) and results (`mall-gameplay-numeric-probes.json`, not in the repo).
- Behavior probe source (`mall-gameplay-behavior-probes.mjs`, not in the repo) and results (`mall-gameplay-behavior-probes.json`, not in the repo).
- Attack cadence probe source (`mall-gameplay-attack-probes.mjs`, not in the repo) and results (`mall-gameplay-attack-probes.json`, not in the repo).

For a later authorized implementation pass, first repair authoritative aim, attack presentation, momentum, stillness, and navigation/spawn accounting. Add minimal existing-gun resupply and existing-shutter access so normal runs exercise the full available prototype. Then compare pressure/recovery presets one variable at a time, with normal and expert movement, body and headshot shooting, stationary corners, and dense doorway crowds. Judge how deaths occur, how much time is spent training versus firing/reloading, and whether the player understands the mistake. Do not simultaneously boost zombie damage, speed, quota, and health.

All future tunables should live in `src/config/`, runtime player modifiers in the stats object, gameplay input through actions, and logic on the existing fixed timestep, as required by CLAUDE.md. No build was run because this analysis required no game changes and a build writes generated files.

File preservation was checked against the 51-file SHA-256 game baseline from the reference index. Fifty files, including every gameplay source, matched. The sole observed difference was `.gitignore` gaining `references/` during the analysis; I did not write that change and left it untouched. Git status likewise showed only that modification at the final check. See validation record (`mall-gameplay-analysis-validation.json`, not in the repo).

