**BO4 script findings and adaptations for Mall Zombies — 25 October 2026**

The strongest lessons in this snapshot concern controlling the economy, scheduling enemy pressure, making upgrades coexist, and giving players reasons to move around the map. Copying BO4's raw numbers would require its missing assets and would also import assumptions about its modes, difficulty settings, perks, and recovery systems.

I surveyed the supplied corpus of **1,529 GSC and 670 CSC files**, including the namespaces inside hashed root files, then traced the shared Zombies code and selected map, enemy, weapon, perk, and power-up implementations. This is a broad source audit, not a claim to have read every line of every map quest. The corpus also contains Multiplayer and Blackout code; findings below identify the Zombies paths used. I compared them with the current Mall Zombies source, including the recent weapon balance pass. No gameplay implementation changed and no gameplay playtest was performed for this report.

**Evidence limits.** The dump's author describes filenames as educated guesses and much of the code remains hashed. Difficulty values come from script bundles, ordinary gun tuning comes partly from weapon assets, and attacks depend on native functions and animation assets. Map scripts expose unlock logic but do not supply the complete playable geometry. Debug blocks, mode branches, and per-map overrides are present. Consequently, a visible default or branch is evidence for that implementation, not a guarantee about every retail build or map. [Repository explanation][readme]

**Weapon-stat result.** I found concrete special-weapon damage values and ordinary weapon pricing/upgrade rules, but no complete ordinary-gun damage/RPM/reload table. `load_weapon_spec_from_table` reads weapon names, upgrade mappings, purchase/ammo costs, box eligibility, limits, class, and tier from external tables; those columns do not provide base bullet damage. Even the named Ray Gun script largely registers effects and asset handles. Useful assets to extract next would be the `zm_base_difficulty` script bundle, the weapon definitions, and the external Zombies weapon tables referenced by `init_weapons` (three table names remain hashes). `gamedata/weapons/zm/zm_gunlevels.csv` concerns weapon-level lookup and should not be assumed to be a damage table. [Weapon table schema][weapontable], [table selection][weapontableselect], [Ray Gun script][raygun]

**Recommended order**

P1 means high priority for the next balance/design pass or before the named future feature ships. P2 means a worthwhile controlled experiment. P3 means an optional later addition. These priorities do not mean the current game has been demonstrated to be unfun or broken.

| Recommendation | Priority | Applies when | Why |
|---|---|---|---|
| Evaluate the point advantage of weaker guns and the income loss from upgrading | P1 | Current game | Stronger guns can earn substantially fewer points per enemy |
| Evaluate RESTOCK-O-MATIC value by weapon and warranty tier | P1 | Current game | A flat refill sells very different amounts of effective damage |
| Give Cart Pushers a concurrency limit and spacing rule | P1 | Current game | Independent spawn rolls allow uneven bursts of disruptive enemies |
| Define the intended late-game damage/health relationship | P1 | Current game, increasingly after round 24 | Warranties stop growing while health continues exponentially |
| Specify effect cooldowns, stacking, and reward attribution | P1 | Before Build-A-Blaster | Rapid fire, pellets, pierce, and damage over time can multiply triggers |
| Budget Wardrobe effects against existing attachment and warranty effects | P1 | Before Wardrobe | Combined bonuses can remove reload and movement commitments |
| Try a longer break before selected shopping rounds | P2 | Current game | Six seconds leaves little time for an expanding shopping circuit |
| Add simple, optional store challenges with bounded rewards | P2 | Current game or alongside new destinations | Gives shops repeat visits and short-term goals |
| Explore occasional announced supply/event rounds | P2 | After baseline pacing is settled | Changes the rhythm and creates a recognizable recovery beat |
| Preserve visible attack timing and authored spawn entrances | P2 | Ongoing map/enemy work | Pressure needs understandable causes and responses |
| Add one paid hazard with a real cooldown and explicit payout rules | P2 | Environmental hazard feature | Provides a spatial spending decision and emergency resource |
| Consider stronger drop rotation guarantees | P3 | If supply droughts appear in play | Existing useful-drop and no-repeat rules already solve much of this |

**Economy and weapon progression**

**1. BO4 limits an enemy's damage-point budget. P1: investigate our incentive structure.**

In `zm_score::function_82732ced`, an enemy receives a point pool and a damage threshold derived from maximum health. `function_89db94b3` accumulates player damage, awards points in tens as thresholds are crossed, and deducts them from that pool. A normal zombie's registered pool is 90. The death path awards remaining pool value and applies the appropriate finishing bonus; the visible defaults are 30 for a head finish and 60 for melee. This supports nominal ordinary totals of 90/120/150 before multipliers and special overrides. It is not the older unlimited ten-points-per-bullet model. The normal initialization and damage wrapper call these functions, so this is more than an unused helper. [Pool and damage payout][scorepool], [death and finishing bonuses][scoredeath], [defaults][defaults], [damage call site][damagewrapper], [initialization call site][scoreinit]

Mall Zombies pays ten for every nonlethal hit, then 60 for an ordinary Shopper kill. Using current unmodified guns against one round-8 Shopper at full damage, with every body shot connecting:

| Gun | Body hits to kill 675 HP | Total points |
|---|---:|---:|
| Price Gun, 28 damage | 25 | 300 |
| Rivet Rifle, 58 damage | 12 | 170 |
| Heavy Coil Nailer, 44 damage | 16 | 210 |

These are arithmetic examples, excluding misses, falloff, pierce, specials, sales, and incentives. They demonstrate a real tradeoff: Rivet's better killing power also reduces income from the same enemy. Price is now weaker in combat following the recent pass, yet it remains economically productive. That may be a desirable early-game role, but damage alone cannot settle its value. [Our payout formula][ourwallet], [current weapon pass][weaponpass]

Recommendation: compare two controlled variants: keep hit points but cap the amount earned from each enemy, or award points according to fractions of health removed. Preserve clear head/melee rewards. Retune purchase timings with either experiment; directly transplanting BO4's 90-point pool would change our entire economy. This is an existing incentive, not evidence that it must be removed.

**2. Damage upgrades currently reduce earning power per kill. P1: evaluate warranties as purchases.**

Under our payout formula, the same round-8 Price Gun body kill falls from 25 shots/300 points to seven shots/120 points with Platinum's 3.5 multiplier. This comparison isolates the effect of damage; it does not assume the player normally owns Platinum in round 8. Better survivability and faster kills are valuable, but an upgrade also removes future hit income. Additional Wardrobe damage or Build-A-Blaster damage will increase that effect. BO4's bounded health-damage pool largely decouples this particular income tradeoff from bullets fired. [Our tiers][ourtiers], [our payout formula][ourwallet]

Recommendation: include net earnings, ammunition expenditure, and time exposed per completed wave in warranty evaluations. Avoid judging an upgrade solely by its advertised damage multiplier.

**3. Ammunition availability is a major weapon stat. P1: audit the refill ladder.**

BO4's default regular wall-ammo price is approximately half the weapon cost. Upgraded wall ammunition has a separate default of 4,500. Another contextual ammo-pricing helper differentiates wall guns, other guns, wonder weapons, and upgraded versions; it is not one universal shop price. [Wall-ammo registration][weaponregistration], [upgraded default][ammo4500], [contextual ammo pricing][ammoprices]

Our machine refills any held weapon's magazine and reserve for 400, including upgraded guns. Price's wall refill is cheaper at 250, but the machine undercuts Rivet's 750, Coil's 650, and Scanner's 900. That creates a meaningful Food Court destination and a potential dominant resupply route.

The difference is also in what 400 buys: Rivet's 144 reserve bullets carry 8,352 nominal base body damage; Coil's 256 carry 11,264. At Platinum those reserve figures become 29,232 and 39,424 respectively, before falloff, accuracy, or Coil's second-target damage. The machine also fills the magazine, which is deliberately excluded from these reserve-only examples. [Our prices][oureconomy], [machine behavior][ourcache]

Recommendation: retain the machine's useful destination role, then compare effective kills and risk per refill. If it dominates, experiment with modest weapon/tier bands, a partial refill option, or better competing refill access. A blanket price increase could punish weak-ammo-economy weapons disproportionately. BO4's expensive upgraded ammunition is an example of separating power from running costs, not a suitable number to copy.

**4. BO4 separates initial weapon transformation, repeat damage upgrades, and alternate effects. P1 before Build-A-Blaster.**

The visible Pack-a-Punch pricing function defaults to 5,000 initially, 2,500 on an eligible repeat path, and 1,500 on a further eligible path. Sales and overrides alter those values. Repeat damage levels are clamped to four, with a multiplier `1 + repacks / 4`: 1.25, 1.5, 1.75, 2.0. This multiplier sits on the applicable upgraded-weapon damage path; it does not establish the original asset's Pack-a-Punch boost. [Pricing][papcost], [repack state][paprepacks], [damage multiplier][papmult]

Our warranties already provide a readable damage ladder: 1.4/2.1/3.5, with 2,000/4,000/8,000 incremental prices. Keep their purpose distinct from Build-A-Blaster's burn, slow, chain, or confusion. If the new workshop must also supply mandatory raw damage, two separate stations may both become compulsory purchases for the same progression requirement. A practical first design is warranties for raw strength and Build-A-Blaster for one behavior-changing choice per gun. [Our upgrade design][ourtiers], [planned systems][roadmap]

**5. BO4 deliberately limits high-round health in one common mode path. P1: choose our late-game target.**

`ai_calculate_health` uses additive growth before round 10 and percentage growth afterward. In `zclassic`, difficulty values below two clamp the calculation to round 35. Higher difficulty and other modes do not receive that condition automatically. The actual starting health and growth parameters come from `zm_base_difficulty` or a replacement bundle, which is missing here. Therefore this dump establishes the formula and cap condition, not exact base-health or capped-health totals. [Health calculation][health], [difficulty bundle loading][difficulty]

Our current health is 675 at round 8, 2,219 at 24, 3,425 at 30, 4,917 at 35, and 7,059 at 40. Platinum's 3.5 damage preserves approximately round-8 durability at round 24; at round 40, that same gun faces roughly three times the effective health it faced at round 8. More zombies also arrive per wave. [Our scaling][ourscaling], [tier targets][ourtiers]

Recommendation: decide whether rounds after the final warranty are intended to be endurance attrition, a sustained combat plateau, or a run approaching a finale. For a plateau, test a health ceiling or slower growth after the last intended upgrade window, keeping pressure through composition and spawn pacing. Do not automatically cap at BO4's round 35: our rounds, damage, and session length differ. This issue exists now in long runs and will become more consequential once players can assemble complete builds.

**Rounds, enemies, and combat fairness**

**6. Wave size and active crowd size are separate controls. Preserve that distinction.**

BO4 calculates a round's total enemy count separately from `zombie_ai_limit`, which throttles simultaneous actors. Its default total-count helper softens rounds 1–5 using fractions 0.25/0.3/0.5/0.7/0.9. Spawn delay falls by 5% per round, accounts for player count, floors at 0.1 seconds, and stops using rounds above 60 for that calculation. Exact population totals depend on external values and overrides. [Wave total][wavecount], [early wave reduction][earlycount], [active limit][activelimit], [spawn delay][spawndelay]

Mall Zombies already separates count, living cap, and spawn delay. Preserve that design. Increasing total wave count mainly adds work and ammunition use; increasing the active cap or accelerating arrivals changes immediate pressure. Use those controls intentionally rather than raising all of them together. Our health, movement mix, living cap, and special-enemy introductions overlap in the early rounds, so an isolated bad round needs diagnosis across those controls.

**7. BO4 plans special composition, rather than relying only on independent rolls. P1 for Cart Pusher consistency.**

The shared round spawner budgets special types, applies per-archetype quantity callbacks, places types into spawn positions, and shuffles their placement. A callback can restrict a computed quantity. This does not eliminate randomness; it constrains what can occur during a round. [Quantity calculation][specialquantities], [placement randomization][specialshuffle]

Our round manager guarantees first introductions, then independently samples the configured mix for later spawns. At round 20, 54 spawns at 15% Cart Pushers imply 8.1 carts on average, but neither their total nor their spacing is guaranteed. A player's hardest moment can depend on a cluster of charges rather than the average mix. [Our mix][oureconomy], [our round manager][ourrounds]

Recommendation: retain approximate proportions but draw from a shuffled round allocation, and add a separate active-cart limit. Start with one early Cart Pusher alive at a time; only raise it if overlapping warnings remain readable in human play. Round quotas alone will not prevent simultaneous carts when they survive a long time.

**8. BO4 also has explicit live limits for disruptive enemies. P1 as the roster expands.**

The Stoker spawn gate checks the current count against a helper returning 1/2/2/3 for one through four players in its normal branch. Force paths and special conditions can bypass it. This is direct evidence for an encounter limit, distinct from a per-round quota. [Stoker gate and limits][stokerlimit]

For Mall Zombies, apply this principle to charges and future Mannequins/Mascots. Limit simultaneous disruptive actions as well as enemy counts: two carts alive could still take turns charging. Preserve the Mall Walker's normal role unless play shows it needs an analogous limit. Its speed, reduced health, and winded opening already define a different interaction from a heavy charger.

**9. Special enemies can have their own capped health curves. P2 for future heavy enemies.**

The shared special-AI helper calculates health from minimum health plus a round increment, optionally scales it for additional players, and clamps to minimum/maximum values read from behavior data. The Stoker uses this helper. Catalyst health takes a different path based on ordinary round health and type multipliers. BO4 therefore does not use one health formula for every enemy. [Special health helper][specialhealth], [Stoker initialization][stokerhealth], [Catalyst initialization][catalysthealth]

Our Cart Pusher is always 1.8 times ordinary round health. That maintains its relative durability but eventually makes it expensive to remove with exhausted weapon progression. For a future Mascot, prefer an explicit target kill time and bounded health curve over assuming a permanent five-times multiplier will stay entertaining. The current cart multiplier is not by itself evidence of a problem at ordinary rounds.

**10. Tough enemies offer more than extra health. P2: develop the cart opening before adding armor.**

Stoker and Gladiator scripts initialize or query weak points, track armor damage, and expose reactions to destruction. Numeric resistance and weak-point tuning depend on missing behavior assets. [Stoker weak-point path][stokerweak], [Gladiator damage path][gladiatorweak]

Our Cart Pusher already has a readable 0.9-second warning, a locked charge, a two-second crash, and 1.5 times damage taken during that crash. That is a strong foundation. Make the crash vulnerability unmistakable through pose, sound, and hit feedback, and assess whether players actually exploit it. Additional hidden resistance would make the enemy harder to understand; it should earn its complexity through a new decision.

**11. Attack fairness is governed by timing and geometry. P2: preserve and evaluate our implementation.**

The BO4 ordinary zombie attack fires on the `zombie_melee` animation notetrack and commonly calls native `melee()`. The melee eligibility code checks distance, height, and conditional facing/visibility/navigation constraints. It is not a universal unconditional line-of-sight check, and the script's `meleedamage = 60` field does not prove every native swipe deals 60. [Animation damage event][meleefire], [attack eligibility][meleecondition]

Our slam already checks the hit at the end of the windup and checks front/reach/obstruction. Keep the animation impact aligned with that decision. Assess moving attacks around counters and stairs, particularly with our faster movement and Mall Walkers. BO4 scripts cannot tell us whether our 0.3–0.35-second warning feels fair to a human.

**12. The visible repeated-attacker protection is not global immunity. Keep this distinction when designing recovery.**

BO4 uses one `ignoreattacker` slot with a default 0.4-second timer. A matching attacker is blocked; another attacker replaces that slot. This permits a crowd to remain dangerous and does not establish a general immunity period after every hit. [Attacker gate][attacker], [timer][attackertimer]

Our damage system accepts each landed enemy attack, while the enemy's own recovery regulates repeat swings. Do not add blanket invulnerability as a supposed fidelity correction. If multi-attacker deaths prove unreadable, compare crowd contact rules and attack coordination first, then explicitly evaluate any grace window as our own design choice.

**13. The round break is part of the shopping economy. P2: trial selected longer breaks.**

The BO4 default between-round delay is 15 seconds, read through a replaceable callback. Our break is six seconds. A larger map with warranty, attachment, ammo, and future Wardrobe trips asks the player to do much more during that interval. [BO4 default][defaults], [break callback][roundbreak], [our pacing][oureconomy]

Recommendation: compare a modest 8–10-second break, or a longer announced break every few rounds, against the current six seconds. Measure whether the player can complete a useful shopping trip and return, rather than assuming all downtime is wasted. Avoid a flat 15-second copy across every early wave. This pressure exists now and will grow with additional shops.

**14. Different enemy rounds can supply a recognizable rhythm. P2, after baseline pacing.**

BO4 has explicit special-round registration and per-map special-round modules, separate from mixed ordinary waves. The shared code can schedule and activate types at specific rounds. [Special-round registration][specialregistration], [map special rounds][mansionspecial]

An announced mall inventory audit or stockroom event could use a smaller, distinct enemy composition and a completion reward. Make it an occasional change in the player's task, with clear pacing and a bounded supply reward. Merely increasing Mall Walker share for a whole round could make the fastest enemy monotonous rather than refreshing. Exact interval and reward need testing in our session length.

**Spawns, doors, and the map**

**15. Spawn pressure follows occupied and adjacent spaces. Much of the principle already exists here.**

BO4's zone manager defaults to `occupied_and_adjacent`. Quick spawning considers player direction/velocity, queries eligible zones, and rejects a selected spot when a sight trace from any player succeeds. Other spawning paths exist, so this is not proof that every BO4 spawn is hidden. [Zone manager][zones], [quick-spawn zone selection][quickzones], [visibility rejection][quickvisibility]

Our spawn selector already ranks open, reachable markers by navigation cost, uses a local neighborhood, avoids player/body proximity, and prefers cooled-down markers. It has no equivalent visibility rejection in that selector. Authored floor/vent entries can intentionally be visible and telegraphed, so invisibility should not become a universal rule. For new markers or rescue relocations, evaluate visible arrival time and audibility. Preserve local pressure when opening more of the mall rather than scattering arrivals across every unlocked room. [Our selector][ourspawns]

**16. Doors change the encounter network, not just the player's bank balance. P2: judge value by route changes.**

BO4 door activation changes traversal links while zone systems manage enabled spaces. Separate scripts implement local power doors, blockers, travel, and other map-specific behavior. The dump cannot establish an ideal door count or whether a particular room is a good training loop without geometry. [Door traversal changes][doors], [zone state][zones]

For our shutters, evaluate what each purchase creates: a new destination, a return loop, safer resupply, or another enemy approach. A shortcut can be valuable even when it unlocks no new room. Conversely, a paid connection that barely changes travel or combat is weak value. The useful adaptation is a route/value audit, not adding BO4-style prerequisite chains to every door.

**17. Optional local objectives can make shops worth revisiting. P2: start small.**

`zm_orange_challenges` builds location-specific challenge stations with progress, setup/cleanup callbacks, a sequence of challenges, and named rewards. Visible rewards include ammunition, points, armor, temporary benefits, and discounts. Many objective descriptions are hashes, so their exact text is not recoverable here. This system is distinct from the separate trial-mode infrastructure. [Local challenge registration][challenges], [challenge progression][challengeprogress]

Adaptation: one optional employee task per destination, such as a limited headshot target in Mega Mart or a Cart Pusher crash task in the service area. Rewards could be one refill or a bounded coupon, with a displayed objective and progress. Avoid requiring the task for basic survival equipment. The goal is to change where or how the player fights, giving the existing map more uses. Route-bound challenges can complement Blue Light Special's existing risk/reward circle.

**18. Core unlock quests need careful scope. P3 for elaborate quest chains.**

BO4's map Pack-a-Punch quests have explicit power, location, completion, and custom-game branches. These create map identity, but scripts alone do not prove that searching for hidden prerequisites feels good. [Example Pack-a-Punch quest][papquest]

For Build-A-Blaster, a short, legible activation objective could work. A long mandatory scavenger hunt would add a knowledge requirement to our compact solo survival loop. Prefer a visible destination and understandable unlock, with deeper secrets as optional rewards. Our current Customer Service warranty access already supplies straightforward combat progression.

**19. Stuck-enemy recovery is a system, with bookkeeping consequences. Preserve ours; P2 for diagnostics.**

BO4's failsafe defaults to a 30-second check, handles falling out of the world, considers insufficient movement, supports custom callbacks, and can requeue enemies while saving their health. A separate round timeout can clean up a stalled round; its visible default is 600 seconds, with conditional pause/stagnation behavior. This is not a universal 20-second final-zombie skip. [Actor failsafe][failsafe], [round timeout][roundtimeout]

Mall Zombies already rescues distant stuck enemies while preserving health. Retain that progress, keep rescues out of immediate combat, and record why they occur by location. If a navigation failure repeatedly triggers rescue, fix the route. When damage-point pools or effects are added, preserve their state too: relocation must not reset point budgets, grant free kills, or create an endless reward source.

**Perks, weapon effects, and power-ups**

**20. Effect frequency needs several independent limits. P1 before Build-A-Blaster.**

BO4's alternate-ammo framework supports per-enemy, per-attacker, and global cooldowns, chance rolls, validation callbacks, per-weapon chance restrictions, and archetype immunity. The trigger filter accepts selected damage types; effect damage tagged `MOD_AAT` is outside that accepted list, helping prevent recursive triggers. Brain Decay's visible registration uses a 25% roll, a 48-second attacker cooldown, and five-second global cooldown. These values describe this snapshot, not every shipped balance update. [Framework and trigger filter][aat], [Brain Decay registration][brain]

For each Build-A-Blaster effect, specify: the eligible event; whether a shotgun blast gets one opportunity or one per target; cooldown ownership; maximum targets; damage/slow refresh versus stacking; immunity or reduced effect on heavies; source attribution; and whether secondary damage can trigger other effects. Our event bus emits one `hit` per target per shot and one `shot` per dart for Foam, so simply subscribing to `hit` would inherently favor multi-target and rapid-fire guns. [Our event semantics][ourevents]

For an initial design, use a cooldown per carried gun or player plus a target cap, forbid secondary-effect recursion, and retain a distinct source on all damage. Choose the ownership deliberately so weapon swapping cannot reset the restriction.

**21. Status effects can change decisions without becoming another damage multiplier. P2 for the workshop's first options.**

The freeze weapon supports damage at different ranges, freezing, crumpling, and shatter interactions. Its script exposes base/upgraded inner damage of 1,500/3,000 and outer damage of 750/1,500; those are special scripted values, not an ordinary rifle table. [Freeze damage and follow-up behavior][freezegun]

Our smoothie freeze can provide a short, readable movement slow that creates a firing or escape window. Fryer-oil burn can trade immediate damage for delayed damage; neon chain can reward grouping with a strict jump cap; glitter can briefly redirect a limited target. Keep their utility different. If all four primarily increase aggregate damage, one will become the preferred mathematical upgrade and the workshop's choices will narrow.

**22. Powerful crowd tools have enemy-class exceptions. P1 before bosses or strong effects.**

The Chakram melee path kills basic/enhanced targets using their current health, deals 20% maximum health to heavies, 10% to minibosses, and a fixed 2,500 to bosses. The AAT framework separately supports trigger and result immunity by archetype. [Chakram class rules][chakram], [AAT immunity support][aatimmunity]

Adapt the principle rather than its exact percentages: confusion might briefly interrupt a Cart Pusher but not convert a future boss for its entire lifetime; freezes may slow a heavy instead of completely locking it. Keep these differences visible. Strong effects that delete normal crowds should not automatically delete the one enemy intended to make the player change plans.

**23. Wardrobe's four slots need a total power budget. P1 before release.**

BO4's four-perk acquisition path can activate a modifier for the fourth slot and enables a fast-reload perk. Individual perks range from ammo utility to movement, damage, healing, and death prevention. A modifier such as Deadshot builds on five qualifying headshot kills, resets on a qualifying non-head kill, and applies a 25% damage increase while active. [Fourth-slot activation][fourperks], [reload enablement][fastreload], [Deadshot chain][deadshot]

Our roadmap already specifies head/torso/feet/accessory slots, one item per slot, small upsides and downsides, and free swaps at fitting rooms. This is a good basis for choices. Evaluate the complete build against Platinum, four attachments, and one workshop effect. For example, Platinum's 0.8 reload-time multiplier combined with Speed Loader's 0.75 already produces 0.6 times base reload duration before any Wardrobe benefit. More reload reductions could erase Coil's major cost; more speed can erase ADS commitment or enemy pursuit pressure. [Our Wardrobe plan][roadmap], [our attachment effects][ourtiers]

Start with utility or conditional benefits and tradeoffs that remain noticeable. Define minimum reload/handling durations and maximum control uptime before adding a large catalogue. Check health changes by actual hits survived: raising maximum health from 100 to 120 still takes three 40-damage swipes to die; a fourth requires more than 120 health, absent mitigation or healing.

**24. Recovery perks substantially change the stakes of a run. P2 as a deliberate future choice.**

The newer health path gives Quick Revive a 1.5 regeneration-rate multiplier and modifies regeneration delay through an external dvar. Dying Wish intercepts lethal damage when available, leaves one health, blocks damage during its active state, and starts an increasing cooldown afterward. In this snapshot its active wait is ten seconds and its initial cooldown is 540 seconds. Those are source values with possible external/build differences. [Healing path][healing], [Dying Wish activation][dyingwish], [cooldown initialization][dyingwishinit]

Our run is one life, with three ordinary swipes lethal from full health and no automatic death rescue. Do not import BO4's density or heavy-enemy assumptions while ignoring those recovery layers. If Wardrobe adds a rescue item, make it an explicit choice with a clear ready/spent indicator and a bounded use or cooldown. General regeneration utility is a smaller initial addition than a reusable ten-second invulnerability state.

**25. BO4's drops combine earned thresholds, caps, eligibility, and rotation. Much is already implemented here.**

The shared power-up module schedules drops from total kills, applies a default maximum of four regular drops per round, checks whether a candidate is eligible, and rotates through a shuffled array with overrides. The cycle is not a universal guarantee that every type will appear, because eligibility and forced outcomes intervene. [Drop threshold][dropthreshold], [round cap][dropdefaults], [rotation][droprotation]

Our incentives already use 12–16 earned credit, skill bonuses, a three-per-round cap, useful-ammo filtering, one live pickup, and no immediate repeated type. Keep these. A shuffled eligible pool or a maximum gap between useful ammo opportunities is a later experiment if actual runs show prolonged droughts. Do not add more randomness simply because BO4 has more drop types. [Our incentives][ourdrops], [our eligibility and rotation][ourdropcode]

**26. Triggered bonuses can deliberately resist spam. P1 for any reload/kill-chain Wardrobe effect.**

Electric Cherry scales radius and damage with magazine emptiness. In a rapid consecutive sequence, its permitted targets diminish from unrestricted to eight, four, two, then zero; the counter resets after a quiet timer. It also tracks weapons awaiting reload completion. This is concrete protection against repeatedly exploiting a cheap trigger. [Reload effect][cherry], [reset timer][cherrytimer]

For our own reload pulse or slide shock, prevent single-shot reloads or repeated movement actions from becoming the best weapon. Reward commitment—such as substantial ammunition spent—and apply a cooldown shared across reload cancels and weapon switches. The exact BO4 damage, radius, and target counts are unnecessary to copy.

**Hazards, presentation, and expanding the loop**

**27. Paid hazards are purchases of space and time. P2 when adding the first one.**

BO4's trap framework has purchase, activation, duration, cooldown, ready sound, and state transitions. Some trap death paths deal an enemy's current health or more, so their usefulness can survive ordinary health scaling; special callbacks can alter that behavior. [Trap lifecycle][traps], [health-relative trap kills][trapdamage]

An electrified fountain or toppling shelf could offer a useful emergency choice and a reason to route a horde through a particular area. Start with one well-signposted hazard. Specify player safety, activation delay, duration, cooldown, affected enemy classes, kill credit, and points. Full ordinary kill payout could let a cheap trap earn back its own cost against a large crowd, especially during incentives; an alternative is reduced hazard points while preserving kill credit and statistics. Our central kill event already provides a place to make that policy consistent. [Our kill event][ourevents]

**28. A rescue pickup should create an actual recovery window. P2 for Security Sweep evaluation.**

The BO4 nuke path pauses spawning for three seconds and initially stuns enemies before processing kills and exceptions. Its 400-point award is a separate event. The system creates a breathing interval as well as a damage event. [Nuke flow][nuke]

Security Sweep already stuns and pushes enemies without deleting the crowd. Preserve that distinct role, then evaluate whether new arrivals or overlapping charge recoveries consume the whole escape window. A short spawn hold is one experiment if the pickup routinely fails to give usable space. It is not required simply to match BO4, and a full screen clear would be a much larger change to the loop.

**29. Audio and HUD convey gameplay state, with controls on repetition. Preserve ours and extend with features.**

BO4's dialogue data includes probability and cooldown, while speaker checks avoid conflicting speech and announcer overlap. Perk UI state includes charge counts, active timers, and modifier activation. [Dialogue registration][audio], [speaker gate][audiogate], [perk state][perkui]

Our announcement queue already prioritizes enemy introductions and bounds queued messages. Add concise state feedback for future effects: cooldown ready, status duration, vulnerability, and a completed task. Keep urgent attack cues audible during sales and jokes. This is a stronger adaptation than adding more HUD ornament: it helps the player understand why a build or enemy behaves differently. [Our announcements][ourannouncements]

**30. Random rewards are curated systems. P3 for the claw machine.**

The Mystery Box selection path randomizes candidates, permits weighting overrides, chooses weapon-tier groups in its default path, validates eligibility, and has a fallback selection pass. Relocation can refund the purchase. It is not simply an equal random draw from every weapon. [Selection][boxselection], [refund branch][boxrefund]

For our future claw machine, define whether it offers cheaper access, unusual weapons, or surprise. Respect owned-weapon and availability rules, bound repeated useless outcomes, and refund a relocation result. With only eight current guns, an elaborate tier lottery is low priority; first make sure a random offer is useful relative to existing wall buys.

**What I would adapt first**

The first experiment should constrain Cart Pusher scheduling, keeping damage, prices, and round breaks fixed so the change is interpretable. Try the shopping-break change separately. Then compare our current point model with a capped per-enemy version and track when players can afford the same doors, ammo, and warranties. Before implementing the workshop or Wardrobe, write down the effect-trigger and combined-stat rules above. Those changes address the strongest interactions exposed by the BO4 scripts while preserving the mall's own movement, retail economy, and weapon identities.

The source audit does not establish that Mall Zombies is fun or that a proposed number is balanced. Human runs should measure perceived unfair deaths, time spent shopping versus fighting, successful use of special-enemy openings, repeated routes, dry-ammo situations, and whether purchases feel like meaningful choices. Script analysis tells us which relationships deserve those trials.

**Source links**

[readme]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/README.md:1
[weapontable]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_weapons.gsc:2741
[weapontableselect]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_weapons.gsc:847
[raygun]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/weapons/zm_weap_ray_gun.gsc:35
[scorepool]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_score.gsc:819
[scoredeath]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_score.gsc:225
[defaults]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm.gsc:962
[damagewrapper]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm.gsc:1740
[scoreinit]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_behavior.gsc:188
[ourwallet]: C:/Users/User/Projects/mall-zombies/src/game/wallet.js:48
[weaponpass]: C:/Users/User/Projects/mall-zombies/docs/weapon-balance-pass.md:1
[ourtiers]: C:/Users/User/Projects/mall-zombies/src/config/upgrades.js:26
[weaponregistration]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_weapons.gsc:714
[ammo4500]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_weapons.gsc:1128
[ammoprices]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_weapons.gsc:1151
[oureconomy]: C:/Users/User/Projects/mall-zombies/src/config/economy.js:8
[ourcache]: C:/Users/User/Projects/mall-zombies/src/game/features/ammoCache.js:35
[papcost]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_pack_a_punch_util.gsc:361
[paprepacks]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_pack_a_punch_util.gsc:526
[papmult]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_pack_a_punch_util.gsc:646
[roadmap]: C:/Users/User/Projects/mall-zombies/CLAUDE.md:1673
[health]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/core_common/ai/zombie_utility.gsc:2672
[difficulty]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm.gsc:1052
[ourscaling]: C:/Users/User/Projects/mall-zombies/src/config/economy.js:148
[wavecount]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_round_logic.gsc:488
[earlycount]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/core_common/ai/zombie_utility.gsc:2714
[activelimit]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_round_logic.gsc:348
[spawndelay]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_round_logic.gsc:1321
[specialquantities]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_round_spawning.gsc:1632
[specialshuffle]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_round_spawning.gsc:1247
[ourrounds]: C:/Users/User/Projects/mall-zombies/src/game/rounds.js:1
[stokerlimit]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/ai/zm_ai_stoker.gsc:1554
[specialhealth]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/ai/zm_ai_utility.gsc:351
[stokerhealth]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/ai/zm_ai_stoker.gsc:391
[catalysthealth]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/ai/zm_ai_catalyst.gsc:263
[stokerweak]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/ai/zm_ai_stoker.gsc:495
[gladiatorweak]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/ai/zm_ai_gladiator.gsc:1658
[meleefire]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/core_common/ai/zombie.gsc:545
[meleecondition]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/core_common/ai/zombie.gsc:1036
[attacker]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_player.gsc:2191
[attackertimer]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_player.gsc:2155
[roundbreak]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_round_logic.gsc:913
[specialregistration]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_round_spawning.gsc:134
[mansionspecial]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/zm_mansion_special_rounds.gsc:43
[zones]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_zonemgr.gsc:41
[quickzones]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_quick_spawning.gsc:331
[quickvisibility]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_quick_spawning.gsc:440
[ourspawns]: C:/Users/User/Projects/mall-zombies/src/zombies/zombieManager.js:69
[doors]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_blockers.gsc:529
[challenges]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/zm_orange_challenges.gsc:120
[challengeprogress]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/zm_orange_challenges.gsc:418
[papquest]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/zm_escape_pap_quest.gsc:142
[failsafe]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/core_common/ai/zombie_utility.gsc:2562
[roundtimeout]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_round_logic.gsc:1232
[aat]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/core_common/aat_shared.gsc:304
[brain]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/aats/zm_aat_brain_decay.gsc:38
[ourevents]: C:/Users/User/Projects/mall-zombies/src/game/events.js:12
[freezegun]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/weapons/zm_weap_freezegun.gsc:698
[chakram]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/weapons/zm_weap_chakram.gsc:298
[aatimmunity]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/core_common/aat_shared.gsc:526
[fourperks]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_perks.gsc:3587
[fastreload]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_perks.gsc:4608
[deadshot]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/perk/zm_perk_mod_deadshot.gsc:99
[healing]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/core_common/healthoverlay.gsc:442
[dyingwish]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/perk/zm_perk_dying_wish.gsc:247
[dyingwishinit]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/perk/zm_perk_dying_wish.gsc:192
[dropthreshold]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_powerups.gsc:467
[dropdefaults]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_powerups.gsc:40
[droprotation]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_powerups.gsc:330
[ourdrops]: C:/Users/User/Projects/mall-zombies/src/config/powerUps.js:2
[ourdropcode]: C:/Users/User/Projects/mall-zombies/src/game/powerUps.js:66
[cherry]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/perk/zm_perk_electric_cherry.gsc:355
[cherrytimer]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/perk/zm_perk_electric_cherry.gsc:482
[traps]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_traps.gsc:441
[trapdamage]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_traps.gsc:970
[nuke]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm/powerup/zm_powerup_nuke.gsc:75
[audio]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_audio.gsc:1334
[audiogate]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_audio.gsc:1930
[perkui]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_perks.gsc:2090
[ourannouncements]: C:/Users/User/Projects/mall-zombies/src/ui/announcements.js:1
[boxselection]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_magicbox.gsc:1690
[boxrefund]: C:/Users/User/Projects/mall-zombies/references/t8-src-main/scripts/zm_common/zm_magicbox.gsc:987
