# Black Ops 1 Zombies source audit for Mall Zombies

## Scope and confidence

This folder is not a complete dump of Treyarch's stock Zombies scripts or weapon assets. It is a community reconstruction of the BO1 engine, with Zombies-specific behavior recovered from the single-player executable, plus clearly separated community mods. The repository itself describes the project as decompiled engine code ([README](references/bo1-zombies-decompiled-main/README.md#L3)), and its setup script expects the owner's original `zone` and `main/*.iwd` data ([setup.ps1](references/bo1-zombies-decompiled-main/setup.ps1#L5)). Those missing assets are where the per-gun numbers and much of the stock round/economy logic live.

I therefore use three confidence levels:

- **Engine-confirmed:** behavior visible in the reconstructed C/C++ path, often annotated with the original SP address.
- **Retail-derived:** a mod documents or calls a stock routine, but the original routine's GSC body is not present here.
- **Mod experiment:** useful evidence about what happens when BO1 rules are changed, not evidence that retail BO1 behaved that way.

This audit does **not** establish exact BO1 gun damage, wall prices, perk prices, zombie-health formulas, or power-up odds. It does reveal considerably more about how those values become gameplay than the BO2/BOCW script sets did.

## Main findings

### 1. A weapon is a performance envelope, not a damage number

The weapon definition format exposes base damage, minimum damage, the beginning and end of falloff, fire time, empty and tactical reload timing, magazine size, reserve capacity, penetration class, movement scale, ADS timing, and sprint-out timing ([weapon fields](references/bo1-zombies-decompiled-main/src/bgame/bg_weapons_load_obj.cpp#L441), [damage and falloff](references/bo1-zombies-decompiled-main/src/bgame/bg_weapons_load_obj.cpp#L459), [cadence and reload](references/bo1-zombies-decompiled-main/src/bgame/bg_weapons_load_obj.cpp#L483), [handling](references/bo1-zombies-decompiled-main/src/bgame/bg_weapons_load_obj.cpp#L504)).

BO1 linearly interpolates from base damage to minimum damage between two range thresholds, then applies the bullet's remaining damage multiplier ([Bullet_GetDamage](references/bo1-zombies-decompiled-main/src/game/bullet.cpp#L674)). Penetration is also continuous: material depth consumes a fraction of the bullet's multiplier, and the shot ends when that multiplier reaches zero ([penetration loop](references/bo1-zombies-decompiled-main/src/game/bullet.cpp#L991), [depth loss](references/bo1-zombies-decompiled-main/src/game/bullet.cpp#L1079)). This is a good model for Mall Zombies' `falloff` and `pierce` systems.

**Mall Zombies implication:** compare guns at close, medium, and long range; body and head; first magazine and sustained fire; then include total carried damage, handling, and ammo cost. A gun can have lower listed DPS yet dominate a hallway because it keeps damage, pierces, or spends less time reloading.

### 2. Locational damage is allowed to be weapon- and enemy-specific

Bullet weapons use their own hit-location multiplier table in Zombies, while projectiles and grenades use the global AI table ([location multiplier selection](references/bo1-zombies-decompiled-main/src/game_mp/g_combat_mp.cpp#L437)). BO1 also makes deliberate enemy exceptions: dogs cannot receive a location multiplier above 1, while an actor such as the Pentagon thief can ignore locational damage entirely ([actor damage](references/bo1-zombies-decompiled-main/src/game_mp/g_combat_mp.cpp#L737)).

**Mall Zombies implication:** headshot multiplier is a legitimate part of gun identity, not a universal constant. Price Gun at 1.5× and Rivet Rifle at 1.75× is directionally sound. Enemy-specific exceptions should be rare and strongly communicated. The Cart Pusher's crash vulnerability and hittable cart are more readable than silently suppressing headshot damage.

### 3. Penetration includes fairness rules, not only damage tuning

The penetration path checks surfaces in both directions, uses the weaker applicable material depth, allows perks to modify penetration, and prevents a player's penetrated shot from continuing into a co-op teammate ([penetration handling](references/bo1-zombies-decompiled-main/src/game/bullet.cpp#L991)).

**Mall Zombies implication:** Build-A-Blaster penetration should define target count, per-target loss, valid surfaces, and interactions with special enemies. Do not let an upgrade's crowd multiplier emerge accidentally from a vague “pierces” flag. The present explicit arrays such as `[1, 0.5]` and `[1, 0.85, 0.7, 0.55]` are easier to balance.

### 4. Handling is part of combat difficulty

BO1 has finite sprint time, a minimum charge required to re-enter sprint, strafe scaling while sprinting, and a 1.5× sprint speed default ([sprint dvars](references/bo1-zombies-decompiled-main/src/bgame/bg_misc.cpp#L1398)). Each gun can also have its own sprint-in/out, ADS transition, movement, raise, and drop timing ([weapon handling fields](references/bo1-zombies-decompiled-main/src/bgame/bg_weapons_load_obj.cpp#L504)).

Mall Zombies already has four seconds of sprint and weapon-specific ADS/recoil behavior. That is a useful balance surface. Rivet can feel meaningfully heavier than Price without losing its intended power advantage. However, movement penalties should remain secondary: players buy a 1,500-point rifle to feel stronger, not to receive the same combat output wrapped in inconvenience.

### 5. Melee uses a bounded volume and a committed damage path

Player melee has separate range, width, and height controls ([melee dvars](references/bo1-zombies-decompiled-main/src/bgame/bg_misc.cpp#L1699)). The damage routine traces that volume, rejects friendly AI hits, and applies base damage plus a tiny random 0–4 roll ([melee damage](references/bo1-zombies-decompiled-main/src/game/g_weapon.cpp#L330), [random roll](references/bo1-zombies-decompiled-main/src/game/g_weapon.cpp#L448)). Charging AI damage is capped before tracing ([charge cap](references/bo1-zombies-decompiled-main/src/game/g_weapon.cpp#L363)).

Mall Zombies' committed box-cutter lunge, limited steering, and obstruction check follow the valuable part of this design. I would not copy the hidden damage roll; deterministic thresholds make melee risk easier to learn. A cap on unavoidable charge damage is already reflected better by the Cart Pusher's one-hit-per-charge and crash recovery.

### 6. Crowd behavior is a system of waits, slowdowns, dodges, and pileups

BO1 does not merely path every actor independently. Team movement can return travel, wait, or slow-down states, attempts dodges, records which actors form a pileup, and applies short retry windows ([team movement selection](references/bo1-zombies-decompiled-main/src/game/actor_team_move.cpp#L175), [pileup handling](references/bo1-zombies-decompiled-main/src/game/actor_team_move.cpp#L494)). The Zombies-specific movement path consumes those results and changes animation/movement accordingly ([path movement](references/bo1-zombies-decompiled-main/src/game/actor_zombie_exposed.cpp#L1016)).

The horde mod is a useful stress test. At much higher than retail population, three barrier attack spots become a throughput bottleneck; zombies can wait outside indefinitely even after boards are gone ([horde window notes](references/bo1-zombies-decompiled-main/mods/horde/README.md#L67)). Its unjam logic disables actor blocking only briefly, far from the player, and restores it near the player ([unjam notes](references/bo1-zombies-decompiled-main/mods/horde/README.md#L83)).

**Mall Zombies implication:** its surround slots, lateral avoidance, and far-only stuck rescue are good architecture. Preserve collision near the player because readable body pressure is part of the game. Add diagnostics before adding more rescue behavior: count “approaching,” “close but waiting,” “unreachable,” and “rescued.” A rescue should preserve health and award no points, as it currently does.

### 7. The famous 24-enemy limit is contextual

The horde mod identifies retail's live-zombie limit as 24 and the engine actor capacity as 32; it can raise both and then encounters crowd, barrier, entity, and frame-time problems ([horde capacity notes](references/bo1-zombies-decompiled-main/mods/horde/README.md#L22)). This is useful engineering evidence, but 24 is not a universal fun constant.

Mall Zombies reaches 24 alive from round 15. Keep that cap for now. Its map scale, browser performance, collision model, and fast player movement matter more than nostalgia. Raise it only if telemetry shows that late rounds have long stretches below the cap despite fast kills and the frame budget remains healthy.

### 8. Doors alter the threat graph

The retail-derived spawning behavior described by the horde mod uses the player's occupied zones and connected adjacent zones. Its optional “spawn all” mode instead uses every opened zone connected to the player; disconnected floors are excluded because enemies placed there cannot reach the player ([spawn-zone experiment](references/bo1-zombies-decompiled-main/mods/horde/maps/horde/_horde.gsc#L212)).

Mall Zombies already requires an open zone and a finite navigation route, then favors a neighborhood near the cheapest routes ([spawn selection](src/zombies/zombieManager.js#L69)). This is fair and functional, but it means every door can add pressure as well as space.

**Door verdict:** the raw count is not presently the problem. Eleven purchases are reasonable for a multi-store, two-level map if most either open a major destination, create a loop, or unlock a strategic service. The risk is that several 1,000–1,500-point links feel like tolls after their destination is already reachable. Track purchase order and “never bought” doors. Merge, discount, or convert a door only when it repeatedly fails to change route choice, access, or spawn pressure.

### 9. Round completion provides closure; continuous carryover is a different mode

Mall Zombies and retail-derived BO1 round flow both wait until the quota has spawned and all enemies are dead. The horde mod deliberately removes the all-dead condition, so the next round begins when the spawn quota is exhausted and survivors carry over ([horde round rule](references/bo1-zombies-decompiled-main/mods/horde/maps/horde/_horde.gsc#L6), [retail comparison](references/bo1-zombies-decompiled-main/mods/horde/maps/horde/_horde.gsc#L465)).

The carryover experiment would increase pressure, but it sacrifices the clean relief-and-spend beat that makes the current six-second break useful. Keep conventional round closure for the main mode. Carryover would fit an explicitly labeled endless sale or overtime mode later.

### 10. Specials work best when they create a readable side objective

The included Nightmare mod is explicitly not original BO1 balance ([Nightmare README](references/bo1-zombies-decompiled-main/mods/nightmare/README.md#L1)), so its extreme cadence cannot justify Mall Zombies tuning. Its adaptations still expose useful encounter patterns: George is calm until provoked and pays out when defeated; a thief steals a held weapon but can return it plus ammo; monkeys attack owned perk machines and switch behavior when hurt ([special behavior](references/bo1-zombies-decompiled-main/mods/nightmare/README.md#L19), [thief](references/bo1-zombies-decompiled-main/mods/nightmare/README.md#L48), [monkeys](references/bo1-zombies-decompiled-main/mods/nightmare/README.md#L54)).

The transferable idea is **temporary objective pressure with a clear recovery path**. The bad version is frequent denial that removes a paid build. This distinction matters once Wardrobe Perks arrive: a special may threaten, disable, or ask the player to defend a perk source, but permanently deleting a purchased perk would feel punitive in a solo game.

## Evaluation of Mall Zombies now

### Gun balance: Price Gun versus Rivet Rifle

The current values now express the intended hierarchy:

| Measure, before upgrades | Price Gun | Rivet Rifle | Rivet advantage |
|---|---:|---:|---:|
| Damage per body hit | 28 | 58 | +107% |
| Close body DPS | ~337 | 435 | +29% |
| Close head DPS | ~506 | ~761 | +50% |
| Damage in one magazine | 784 | 1,392 | +78% |
| Total carried body damage | 5,488 | 9,744 | +78% |
| Reload | 1.3 s | 2.0 s | Price advantage |
| Purchase / wall ammo | 500 / 250 | 1,500 / 750 | Price advantage |

The Rivet is now plainly stronger in lethality and endurance, while Price retains its early-game identity through access, fast reload, and cheap wall ammo. I would **not** apply another direct Price nerf or Rivet damage buff yet. The remaining concern is reward efficiency: Mall Zombies grants 10 points for every nonlethal hit, so the weaker Price creates substantially more hit income per ordinary kill. At 675 health, a perfect body kill pays about 300 points with Price versus 170 with Rivet. That can be a deliberate “weak gun farms points” trait, but it should not combine with equally strong late-round combat performance.

The first balance test should therefore measure time-to-kill, damage taken, ammo spending, and net points earned with each gun over the same rounds. If Price still dominates player choice after round 6, reduce only one strength—most likely reserve from six magazines to five, or close DPS by roughly 5%—rather than undoing its quick-reload character. If Rivet still feels weak, improve recoil/accuracy feedback or reload slightly before increasing damage again.

### Economy and progression

The clearest current economy distortion is the flat 400-point RESTOCK-O-MATIC. It fully refills any held weapon ([ammo cache behavior](src/game/features/ammoCache.js#L1)), while wall-ammo prices range from 250 to 900 ([economy](src/config/economy.js#L70)). Once Food Court is open, it undercuts Rivet, Coil, and Scanner ammo heavily and makes their nominal ammo prices mostly decorative.

**Recommendation: high priority.** Price RESTOCK by weapon band, for example 400 / 550 / 700, or make it refill a fixed fraction with a minimum one-magazine guarantee. Keep it somewhat cheaper than a wall refill because opening Food Court and traveling to the machine are real costs. The machine should remain a useful destination, not the universally correct ammo source.

Extended Warranties are currently clean, predictable power checkpoints. Their damage tiers are absolute rather than compounding and are explicitly designed around round thresholds ([upgrade tiers](src/config/upgrades.js#L28)). Preserve that clarity. The balance risk is the interaction matrix: tier damage × attachment damage/range × future Build-A-Blaster behavior × future perk stats. Establish an effect order and caps before adding those systems.

### Enemy mix and fun

Mall Walkers are valuable because they interrupt a single comfortable kite speed. Their fragility and winded phase provide compensation. At round 9, however, Walkers occupy 30% of spawns and Cart Pushers another 15%, leaving only 55% base Shoppers ([mix](src/config/economy.js#L30), [selection](src/config/economy.js#L186)). Because both specials are rolled from one shared probability interval, that percentage is controlled, but random streaks are still possible.

**Recommendation: medium priority.** Add per-type live caps or a short anti-streak rule before adding another special. A cap of roughly one Cart Pusher early and two later would preserve the dodge encounter without turning multiple locked-direction charges into noise. Walkers can remain common, but use a rolling-window cap such as no more than three of five spawns. This becomes **high priority before adding more enemy types**.

The core loop appears fun on paper and from the existing systems: shoot, earn, open a route, reach a themed store, buy a more expressive weapon, and return stronger; fast traversal and telegraphed specials keep the downtime low. Its chief risk is progression dilution. Eleven doors, seven guns, three warranty purchases, attachments, flash sales, power-ups, and future perks/mods all compete for points and attention. Each system is individually readable; the combined run needs staged introductions.

## Priority recommendations

| Priority | Applies | Recommendation | Why |
|---|---|---|---|
| **High** | Current game | Reprice RESTOCK by weapon tier or refill fraction | The flat 400 price erases expensive guns' ammo-economy differences. |
| **High** | Current game | Run mirrored Price/Rivet trials and log combat plus net income | Current lethality hierarchy looks correct; the unresolved issue is Price's hit-income advantage. |
| **High** | Before Build-A-Blaster | Define modifier order and caps for damage, range, pierce, magazine, reload, and crowd effects | BO1 shows these dimensions multiply; uncontrolled combinations will dominate base tuning. |
| **High** | Before Wardrobe Perks | Prevent permanent loss of paid build components and define recovery rules | Objective pressure is fun when readable and recoverable. |
| **Medium** | Current game | Add special live caps or anti-streak spawning | Keeps Walkers and Carts as events rather than constant interference. |
| **Medium** | Current game | Log door order, never-bought doors, route choice, and post-door deaths | Door value depends on its change to space and pressure, not the raw count. |
| **Medium** | Current game | Add spawn/crowd diagnostics and rescue counts | BO1 stress tests show throughput failures hide behind a healthy total alive count. |
| **Medium** | Current game | Stage system tutorials and first availability across rounds | Prevents the growing economy from becoming a wall of simultaneous decisions. |
| **Low** | Optional mode | Prototype round carryover as an endless/overtime variant | It creates pressure but removes the satisfying clear-and-shop beat. |

## Suggested validation pass

Use fixed seeds and run the same route for Price and Rivet through rounds 1–12. Record per round: completion time, shots fired, accuracy, headshot rate, reload downtime, damage taken, ammo purchases, points earned from hits, kill rewards, door purchases, and points remaining. Repeat once with body-focused aim and once with head-focused aim. The decision metric is not simply DPS: Rivet should shorten dangerous exposure and require fewer ammo decisions, while Price should remain the better first purchase and point farmer.

For map pressure, run three routes: minimal doors, direct-to-Food-Court, and broad loop opening. Record spawn route cost, time from spawn to player contact, alive-but-not-advancing count, rescue count, and deaths within 15 seconds of opening a door. A door that expands space while sharply increasing unseen close spawns needs spawn tuning; a door that changes none of these and unlocks no valuable service is the candidate for removal or repricing.

For specials, test the worst legal compositions rather than average probability: three Walkers in five spawns, two simultaneous Carts, and the maximum mixture at the round-15 cap. If each threat is fair alone but unreadable together, solve composition first rather than weakening the individual enemy.

## Overall judgment

BO1's engine supports Mall Zombies' current direction: explicit range falloff, distinct headshot profiles, finite sprint, local reachable spawning, conventional round closure, and a moderate live-enemy cap. The current Price/Rivet numbers now reflect the intended progression; further raw-stat changes would be premature. The most actionable problems are the flat RESTOCK price, special-enemy streaks, and the lack of instrumentation showing how doors alter pressure. Future perks and Build-A-Blaster pose the larger balance risk because they will multiply systems that are currently well bounded.
