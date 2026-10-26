**Cold War script findings for Mall Zombies — 25 October 2026**

There is useful material here despite the hashes. The strongest additions to the BO4 analysis are a directly recoverable ammunition price ladder, separate weapon progression systems, escalating perk prices, a capped health curve built from round bands, and optional extraction objectives.

I surveyed `references/t9-src-main`, traced selected Zombies systems in `vm-38`, and cross-checked important helpers in `vm-37`. The collection contains 3,504 GSC and 780 CSC files: VM37 has 1,645/376 and VM38 has 1,859/404. These are file counts, not counts of unique systems. The README explicitly says this is a merge of multiple patches, with duplicate variants. I have not read every line of every script, and this was a source audit rather than a playtest. Gameplay code is unchanged. [Dump provenance][readme]

**How much to trust the findings**

- **Strong:** readable arithmetic and branches, followed through a relevant caller. The ammunition-price, perk-price, and segmented-health helper bodies are identical between the two VM folders.
- **Qualified:** coherent behavior with hashed identities or external assets. The system is visible, but exact item names, parameters, or mode coverage remain incomplete.
- **Unresolved:** decompiled parameters contradict their use, or a familiar helper has no confirmed active caller. These do not establish retail balance values.

The folders mix round-based Zombies, other Zombies modes, multiplayer, campaign, shared code, and client presentation. Some hashed files ending in `.gsc` import `.csc` modules and contain client-only functions. I checked imports and callers rather than assuming the extension identifies server gameplay. No conclusion below treats VM38 as a complete final-patch build.

**Recommended priorities**

P1 means important to evaluate in the next balance pass or before the named feature ships. P2 means a worthwhile prototype or controlled experiment. P3 means optional later work. A design concern is not proof that players currently experience a problem.

| Recommendation | Priority | Applies to | What Cold War adds to our earlier findings |
|---|---|---|---|
| Trial warranty-sensitive RESTOCK pricing | P1 | Current game | Its ammo cache explicitly charges more for more upgraded guns |
| Design health growth around the completed build | P1 | Current long runs | A concrete capped curve with different increments across round bands |
| Keep each progression system's purpose clear | P1 | Warranties now; workshop/Wardrobe later | Rarity, Pack-a-Punch, and ammo effects have distinct purchase paths |
| Define cooldowns and damage rules for every secondary effect | P1 | Before Build-A-Blaster | Effects have their own triggers, scaling, tiers, and enemy restrictions |
| Set a combined defense and mobility budget | P1 | Before Wardrobe/armor/vendor | Health, armor, perk skills, and utility equipment interact |
| Consider limited escalation for filling Wardrobe slots | P2 | Wardrobe | Acquisition order becomes an economic choice |
| Try a bankable employee-task reward | P2 | Optional objectives | Progress can build toward a better reward before claiming |
| Offer an optional end-of-shift escape | P2 | Later run structure | Gives a successful stopping point and a final combat task |
| Add another currency | P3; defer for now | Potential vendor/crafting expansion | Useful separation of budgets, with substantial added complexity |

**1. RESTOCK pricing can follow upgrade strength. Strong evidence; P1 current-game experiment.**

The Zombies ammo-cache implementation is in hashed `script_5a525a75a8f1f7e4.gsc`. It registers an `ammo_cache` location, computes a price from the held item's upgrade field, and uses that price when filling ammunition. The helper is identical in VM37 and VM38. [Cache registration][ammoreg], [price helper][ammocost], [purchase/refill][ammobuy]

| Item state in that helper | Ammo price |
|---|---:|
| Default/unupgraded | 250 |
| Upgrade level 1 | 1,000 |
| Upgrade level 2 | 2,500 |
| Upgrade level 3 | 5,000 |
| Weapon recognized as a wonder weapon | 10,000, overriding the above |

This is a much firmer comparison than inferring modern ammo-cache prices from inherited wall-buy helpers. It does not mean every mode always spawns the same cache or that these numbers fit Mall Zombies.

Our RESTOCK-O-MATIC charges 400 for every gun and every warranty tier. Platinum multiplies damage by 3.5 while ammunition costs remain fixed. That progressively increases the machine's firepower per point. It also undercuts most premium wall refills, while Price's 250-point wall refill retains its own advantage. [Our economy][oureconomy], [our warranties][ourtiers], [machine behavior][ourcache]

Recommendation: compare a modest price ladder by warranty tier against the flat 400. Preserve the machine's accessible resupply role and consider the gun's ammunition economy too. Evaluate refill frequency, net income, and which routes players use. A twentyfold price increase like the source's 250-to-5,000 ladder would be a major redesign of our economy, so it is not my suggested transplant.

**2. Supply access and supply value are separate decisions. Strong evidence; P1 alongside ammo pricing.**

Cold War's cache checks whether the selected gun needs ammunition and refuses inappropriate weapons such as killstreak weapons. Its normal purchase fills magazine and stock, with special handling for clip-only weapons. Therefore a refill buys immediate readiness as well as sustained supply. [Refill handling][ammobuy]

Our machine also fills magazine and reserve. A player can use it to bypass an otherwise dangerous reload, especially with Coil or a depleted Confetti Cannon. That can be a desirable paid escape tool. Evaluate its combat convenience separately from its points-per-bullet value; otherwise raising its price to address reserve value may accidentally make emergency recovery inaccessible. Our warranty desk already explicitly excludes ammunition, which keeps these purchases distinguishable.

**3. Weapon progression has several independent tracks. Strong structural evidence; P1 for future feature design.**

The arsenal menu spends scrap to change weapon rarity; the weapon-upgrade menu spends points on Pack-a-Punch and separately installs a selected ammo effect. The rarity path maps loadout/uncommon/rare/epic/legendary to white/green/blue/purple/orange item variants. The item system carries additional upgrade state and an `aat` effect. [Rarity purchase][arsenalbuy], [rarity mapping][raritymap], [Pack-a-Punch and effect purchases][pappurchase]

Mall Zombies already has warranties and attachments, with Wardrobe and Build-A-Blaster planned. Four systems can coexist if they create different decisions:

| Mall system | Suggested main purpose |
|---|---|
| Weapon purchase | Select a gun's firing behavior, handling, and role |
| Extended Warranty | Maintain the gun's raw combat strength as rounds rise |
| Attachments | Adjust handling or range through an explicit tradeoff |
| Build-A-Blaster | Choose one new combat behavior: burn, slow, chain, confusion |
| Wardrobe | Choose player utility and bounded survivability/mobility tradeoffs |

This preserves the intended hierarchy in which Rivet is a stronger purchase than early-game Price, while allowing an invested Price to remain usable. Avoid adding rarity as another mandatory raw-damage ladder unless the existing progression proves insufficient.

**4. The modern Pack-a-Punch menu differs from the inherited helper. Strong evidence; useful extraction warning.**

The actual menu module initializes costs `[0, 5000, 15000, 30000]`; its purchase branch indexes that array by requested upgrade level, updates the inventory item, and deducts the chosen price. Both VM folders contain this array. [Modern menu costs][papcost], [purchase branch][pappurchase]

An inherited `zm_pack_a_punch_util.gsc` still contains a 5,000/2,500/1,500 pricing path. Using that file alone would produce the wrong description of the newer menu. Its old-style repeat multiplier also does not establish the final damage multipliers of the modern upgraded weapon items. [Inherited helper][legacypap]

For our warranties, the useful comparison is the increasing commitment of later upgrades. Our 2,000/4,000/8,000 prices already achieve that. Cold War's absolute prices cannot establish ours are too cheap because payout rates, refill costs, enemy counts, and other purchase obligations differ.

**5. The health curve is built from round bands and a maximum. Strong evidence; P1 for long-run design.**

The active shared AI initialization calls `function_f7014c3d` to set maximum and current health. That function reads a behavior asset containing `start_round` entries and per-round increments. It sums the applicable segments, invokes a customization callback, caps the result at the asset's `maxhealth`, and can then apply additional player-count scaling. It caches the result by AI identity and round. The helper body matches between VM37 and VM38. [Health initialization][aiinit], [banded calculation][healthcurve]

The cap occurs before the shown cooperative scaling; it should not be presented as an unconditional final cap for every player count. The asset values are missing, so exact band boundaries and maximum ordinary-zombie health are not recoverable here.

Mall Zombies uses one additive segment through round 9 followed by unbounded 7.5% growth. Platinum is designed to preserve approximately round-8 shot counts through round 24, after which durability keeps increasing while damage upgrades stop. A banded curve could let us tune early onboarding, the warranty chase, and the completed-build phase separately. [Our scaling][ourscaling], [tier targets][ourtiers]

Recommendation: define the desired completed-build kill time first, then test a slower final segment or a cap. Preserve pressure through enemy composition, arrivals, and positioning. This is a more precise design tool than repeatedly increasing every gun's damage to chase late-round health.

**6. A familiar health function is not necessarily the active path. Strong evidence; affects interpretation.**

The shared zombie utility still contains an older additive/exponential `ai_calculate_health`. But the AI initialization above uses the segmented calculation, and the round-spawn code reads the cached ordinary-zombie health with a fallback. [Older calculation][legacyhealth], [round-spawn cache][roundhealth]

This reinforces the same caution as Pack-a-Punch: a recognizable function name is not sufficient evidence of current runtime tuning. I am not carrying the BO4 round-35 cap into the Cold War findings merely because related code remains in the collection.

**7. Equipment and secondary damage can scale independently of guns. Strong helper evidence; P1 before vendor and effects.**

`zm_equipment::function_379f6b5d` scales base damage over a bounded range of rounds. Its defaults include a 15% step, a starting round of three, and a last scaling round of 34; callers can override those parameters. Dead Wire's server implementation calls equipment-scaling helpers when producing its electrical damage, with different paths for different modes. [Equipment scaling][equipscale], [Dead Wire damage path][wiredamage]

For Mall Zombies, decide whether burns, explosives, turrets, and hazards scale with weapon tier, player stats, round, or an independent progression. A fixed tiny burn may become irrelevant; a percentage-of-enemy-health burn may remain powerful indefinitely. Neither should inherit a scaling policy accidentally. Specify caps and heavy-enemy handling before adding the first option.

**8. Separate resource budgets let offense compete with defense. Strong evidence; P2 principle, P3 extra currencies.**

`sr_scrap` maintains two resource balances, grants pickups to different balances, checks affordability, and deducts expenditure. In the examined path, ordinary scrap pickups commonly add 50 times the item amount, while the rare type adds ten times the amount, with named special cases. These are visible branches, not an inventory of every pickup value. [Scrap pickups][scrap], [spending functions][scrapspend]

The arsenal spends those resources on armor and weapon changes. Its rarity options include green/blue at 500/1,000 of the ordinary resource and purple/orange at 500/1,000 of the rarer resource. A separately listed hashed option is not identified here as a rarity tier. [Arsenal setup][arsenal], [transaction path][arsenalbuy]

This creates another spending decision: improve killing power or buy protection. We can create that tension using the existing point wallet and limited vendor stock. I would defer adding two scrap currencies until there is enough worthwhile equipment to justify the collection, HUD, balance, and explanation costs.

**9. Armor introduces maintenance as well as survival. Strong structural evidence; P1 before adding armor.**

The arsenal distinguishes armor repair from buying an armor item, refills armor on an appropriate purchase, and spends scrap. The shared armor implementation tracks current armor and maximum armor, routes damage according to damage type, and accounts for armor exhaustion and spillover. Some coefficients and item identities are hashed or asset-defined, so this report does not claim an exact universal absorption percentage. [Armor transactions][armorbuy], [damage processing][armordamage]

For Kiosk Kevin's planned armor plates, choose whether they are an emergency consumable, upkeep for a permanent armor capacity, or another health progression track. Each has different economics. Combine the design with Wardrobe health, healing, and movement; tuning them independently could make a previously dangerous horde trivial or make armor mandatory. [Planned systems][roadmap]

**10. Perk cost rises with the number already owned. Strong evidence; P2 for Wardrobe.**

The current perk helper returns `2500 + 500 × owned-perk-count`. The acquisition function adds distinct perks to that same array, and the machine purchase logic calls the cost helper. This is confirmed across the two VM folders. [Price calculation][perkprice], [acquisition state][perkacquire], [purchase caller][perkcaller]

That makes purchase order meaningful: the player prioritizes the benefit they want earliest. A modest equivalent could work when filling our four Wardrobe slots. However, our plan allows buying clothing once and swapping freely at fitting rooms. Do not tax experimentation by continuously raising prices for every alternate garment collected, and do not charge for an authorized free swap. Prefer fixed item prices initially, or a capped surcharge tied to occupied slots if order needs more weight.

**11. The purchased perk and its skill tier are separate state. Qualified evidence; P1 when considering meta progression.**

The perk support module registers a base identity and multiple tier identities, selects a tier with an override path, and maps the acquired perk into its concrete effects. The ammo-mod module likewise recognizes base names and tiers one through five. The complete persistence/unlock economy is outside the traced paths. [Perk tier mapping][perktiers], [ammo-effect tiers][aattiers]

For Wardrobe, an item upgraded outside the run is a different balance promise from an item purchased during the run. If persistent skills arrive later, evaluate the first-run experience and the fully upgraded experience separately. The current project roadmap already calls for small persistent boosts; this audit gives no reason to turn them into mandatory prerequisites for ordinary survival.

**12. Economic perks are compound power. Strong evidence; P1 before any income-bonus clothing.**

Death Perception's pickup callback can grant an additional 20% of the applicable scrap amount at a qualifying skill tier, with different branches for resource types and special pickups. [Resource bonus][deathperception]

An income bonus affects more than the end-of-run score: bought early, it can accelerate a gun, warranty, ammo purchase, and subsequent survival. If Wardrobe offers a discount or point bonus, account for those earlier power purchases when pricing it. Prefer bounded benefits or category-specific coupons if the intention is a small optional advantage. The benefit should not quietly become the first purchase in every run.

**13. Ammo effects combine chance with cooldown. Strong example; P1 before Build-A-Blaster.**

The server Dead Wire file registers the examined variants with a 0.2 probability and 15-second attacker and global cooldown parameters. The AAT framework names and checks the corresponding cooldown fields. A related helper applies a 0.8 cooldown multiplier under a qualifying perk condition. These describe the supplied implementation; they are not a guarantee about the final retail patch. [Server registration][wire], [AAT checks][aatframework], [perk cooldown adjustment][aatcooldown]

This gives rapid-fire weapons a chance to trigger the effect promptly after it becomes available, while bounding its long-term frequency. Our Price fires more often than Rivet, and piercing/pellets create additional target hits. For a first workshop version, use a clear cooldown plus bounded targets and specify whether opportunities occur per shot, target, or damage tick. Prevent switching guns from resetting the intended restriction. Chance alone is an unreliable balancing tool for our roster.

**14. Effects have compatibility and enemy-class restrictions. Strong structural evidence; P1 for future specials.**

The modern menu refuses ammo mods for recognized exempt weapons, wonder weapons, and certain special weapons. The AAT code checks trigger immunity, while an enemy module registers explicit immunity to several effects for `mechz`. [Shop restrictions][pappurchase], [AAT framework][aatframework], [enemy immunities][immunities]

For our burn/slow/chain/confusion effects, define behavior for Cart Pushers and future Mascots before release. A short interrupt or partial slow may be appropriate where full conversion or permanent stun is not. Display the difference in feedback so the player can learn it. Avoid unexplained immunity as a substitute for designing an interaction.

**15. Upgrading a gun should preserve unrelated investment. Strong evidence; P1 correctness requirement for workshop work.**

The rarity transaction captures magazine and stock counts before replacing the item variant. The weapon transformation retains relevant item state, and the Pack-a-Punch inventory path stores and restores the ammo effect when it changes the underlying item. [Rarity transaction][arsenalbuy], [rarity transformation][raritychange], [upgrade inventory path][inventorypap]

Mall Zombies already stores warranties and attachments with the carried gun. Preserve that model when adding Build-A-Blaster: ammo purchases, fitting a new attachment, or upgrading a warranty must not remove the chosen effect or silently refill ammunition. Also define cooldown persistence through those changes so an upgrade is not an unlimited effect reset. [Our upgrade model][ourupgrades]

**16. A status effect can create a coordinated damage opportunity. Qualified but coherent evidence; P2 workshop option.**

The Cryofreeze server path marks a target as affected and later clears the marker. A separate ammo-mod helper adds 25% damage for listed Cryofreeze tiers when the marker is set. Its callers and exact tier conditions need further tracing before treating that as a universal frozen-target damage bonus. [Freeze state][freeze], [conditional damage helper][freezebonus]

The transferable idea is a short setup-and-follow-through interaction: slowing an enemy can make a charged Scanner shot or controlled Rivet burst easier. Keep the initial slow useful on its own. Additional damage amplification multiplies warranty and headshot benefits, so it should be costed as another offensive bonus rather than described as free utility.

**17. Challenges can let players claim now or build toward a stronger reward. Qualified system evidence; P2.**

The reward module stores tribute, maps progress into four reward levels, updates reward availability, and selects different reward pools by level. It also filters rewards using player state, such as limiting certain self-revive outcomes. Much of the actual objective text and tuning remains hashed. [Reward progress][tribute], [reward pools and filtering][rewardpool]

For the mall, an optional Employee of the Month terminal could offer one useful reward now or let completed tasks build toward a better one. Use a small number of visible reward levels and bounded rewards such as ammo or a coupon. This creates a decision beyond clearing the next wave without making a large quest mandatory. Prevent reward income from financing its own unlimited repetition.

**18. Exfil provides a successful stopping point. Strong structural evidence; P2 later feature.**

The round-based `zclassic` callback checks five-round intervals after round five, waits for exfil permission when necessary, activates a beacon under its settings condition, and later closes the availability window after 120 seconds. That is the availability timer, not proof of the mission's time limit. The extraction objective separately starts a timer and manages completion, enemies, and transport. [Availability window][exfilwindow], [objective timer][exfiltimer], [objective setup][exfilsetup]

An optional end-of-shift escape could give Mall Zombies players a satisfying result other than eventual death. A PA announcement and a clearly marked exit could offer a final clearance fight; declining would continue survival. It needs no helicopter fiction. Choose the first offer around our actual run length, not Cold War's round numbers.

**19. A timed finale needs its own encounter rules. Strong structural evidence; P1 if extraction is built.**

The exfil module interrupts ordinary round logic, reads an extraction encounter bundle, counts its planned enemies, manages a landing region, and tracks a dedicated completion state. It also marks some extraction actors to ignore the ordinary round-spawn failsafe. Those specialized lifecycle rules matter as much as the timer. [Objective setup][exfilsetup], [encounter budget][exfilbudget], [spawn lifecycle][exfilspawns]

For our own timed escape, make the required enemies reachable and the remaining task visible. Stop adding ordinary-wave enemies to the required kill count once the finale's budget is set. Handle stuck enemies and incomplete spawns explicitly; a hidden or unreachable last enemy should not cause an otherwise successful escape to fail. This is a design requirement for a future feature, not a demonstrated current bug.

**20. Secondary-effect credit needs deliberate ownership. Strong evidence; P1 for workshop and hazards.**

Cold War tracks damage contributors, weapons, times, and effect-related ownership. Its score-event code distinguishes direct kills, assists, and kills involving freeze, electrical stun, converted enemies, equipment, and field effects. The concrete point/XP amounts live partly in external score data. [Contributor tracking][contributors], [effect credit][effectcredit], [enemy kill event][killevent]

Our event bus already distinguishes `shot`, `hit`, and `kill`, with all kill payouts centralized. Extend the provenance for a burn tick or chain jump: original weapon, owning player, direct or secondary source, and whether it can trigger another effect. Count one death once. Decide separately which sources earn skill credit, headshot bonuses, incentive progress, and normal kill points. [Our event semantics][ourevents]

**21. Readable state can support complexity without crowding combat. Strong presentation evidence; P2.**

The ammo-cache prompt distinguishes full ammo, unavailable purchase, and a valid refill for the relevant weapon. Armor updates publish its remaining fraction, while effect presentation registers proc indicators and tier states. These are actionable states rather than decorative indicators. [Cache prompts][ammoprompt], [armor state][armorui], [effect presentation][aattiers]

Our existing retail tickets and bounded PA queue provide a suitable presentation style. For new systems, show the price and useful effect at the counter, then provide concise ready/active/spent feedback during combat. Keep full descriptions in the shop. The useful adaptation is better information about decisions, not a larger permanent HUD.

**22. Weapon and economy values still require additional assets. Unresolved exact tuning; useful next extraction targets.**

I found actual transaction prices, scaling formulas, effect logic, and item-state handling. I did not find a complete table of ordinary-gun base damage, RPM, reload duration, head multipliers, and rarity damage multipliers. Weapon registration still reads external tables; modern rarity and upgrades also refer to item/weapon definitions. [Weapon table reader][weapontable], [rarity transformation][raritychange]

The inherited score module contains BO4-like point-pool helpers, but I did not establish a normal modern damage caller for the payout helper in this snapshot. The modern kill path dispatches an enemy behavior asset's score event, and score definitions are loaded externally. I therefore would not claim Cold War uses BO4's exact point model or infer exact ordinary payouts from those inherited helpers. [Inherited point helper][legacyscore], [modern kill dispatch][killevent], [score table loading][scoretables]

Useful additional assets would be:

- `zombie_vars_settings`, plus `zombie_onslaught_vars_settings` for that mode: score defaults, breaks, player health, difficulty parameters, and other settings. The resolver explicitly names these bundles. [Settings resolver][settings]
- Enemy behavior data supplying `maxhealth`, `category`, `scoreevent`, and the array of `start_round`/increment entries. [Initialization and asset fields][aiinit]
- Weapon and rarity item definitions, upgraded variants, and the external weapon tables. These would allow the raw gun comparison the scripts alone cannot complete.
- Score-event tables and unlockable item metadata for exact earnings, ammo-effect purchase prices, and crafting prices.

Some perk damage callbacks have visibly inconsistent reconstructed arguments. For example, the Deadshot callback treats an argument named `vpoint` as a player and returns an argument named `vdir` as damage; a counter comparison even compares a value to itself. Its body suggests full-health weak-point and repeated-target bonuses, but I have not promoted its apparent numbers to verified balance facts. [Ambiguous callback][deadshot]

**What this changes relative to the BO4 report**

The recommendation to inspect RESTOCK-O-MATIC is now supported by a directly traced upgrade-sensitive ammo cache in Cold War, not just BO4 wall-ammo prices. The late-game health recommendation also has a more flexible model: capped round bands. Both are worth evaluating in the current game.

For future work, Cold War reinforces the importance of budgeting the complete build and retaining per-gun investment. Its extra currencies and layered defense solve problems created by a larger equipment economy; they do not need to be imported wholesale. The most distinctive optional additions are bankable shop challenges and an end-of-shift escape. I would settle ammo value and the intended late-game kill time before adding either.

**Source links**

[readme]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/README.md:1
[ammoreg]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_5a525a75a8f1f7e4.gsc:59
[ammocost]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_5a525a75a8f1f7e4.gsc:126
[ammobuy]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_5a525a75a8f1f7e4.gsc:469
[ammoprompt]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_5a525a75a8f1f7e4.gsc:205
[oureconomy]: C:/Users/User/Projects/mall-zombies/src/config/economy.js:68
[ourtiers]: C:/Users/User/Projects/mall-zombies/src/config/upgrades.js:26
[ourcache]: C:/Users/User/Projects/mall-zombies/src/game/features/ammoCache.js:35
[arsenal]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_7a5293d92c61c788.gsc:70
[arsenalbuy]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_7a5293d92c61c788.gsc:574
[raritymap]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/zm_weapons.gsc:582
[raritychange]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/zm_weapons.gsc:631
[papcost]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_6fc2be37feeb317b.gsc:65
[pappurchase]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_6fc2be37feeb317b.gsc:590
[legacypap]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/zm_pack_a_punch_util.gsc:377
[aiinit]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/ai/zm_ai_utility.gsc:165
[healthcurve]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/ai/zm_ai_utility.gsc:464
[ourscaling]: C:/Users/User/Projects/mall-zombies/src/config/economy.js:148
[legacyhealth]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/core_common/ai/zombie_utility.gsc:2344
[roundhealth]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/zm_round_logic.gsc:317
[equipscale]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/zm_equipment.gsc:1365
[wiredamage]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_3fbe90dd521a8e2d.gsc:403
[scrap]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_18077945bb84ede7.gsc:67
[scrapspend]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_18077945bb84ede7.gsc:180
[armorbuy]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_7a5293d92c61c788.gsc:497
[armordamage]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/core_common/armor.gsc:600
[roadmap]: C:/Users/User/Projects/mall-zombies/CLAUDE.md:1673
[perkprice]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_3751b21462a54a7d.gsc:348
[perkacquire]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_3751b21462a54a7d.gsc:367
[perkcaller]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/zm_perks.gsc:863
[perktiers]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_3751b21462a54a7d.gsc:138
[aattiers]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/aats/zm_aat.gsc:134
[deathperception]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm/perk/zm_perk_death_perception.gsc:98
[wire]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_3fbe90dd521a8e2d.gsc:38
[aatframework]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/core_common/aat_shared.gsc:413
[aatcooldown]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/aats/zm_aat.gsc:567
[immunities]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_2cc90e725816de14.gsc:71
[inventorypap]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/core_common/item_inventory.gsc:6912
[ourupgrades]: C:/Users/User/Projects/mall-zombies/src/weapons/upgrades.js:1
[freeze]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_6b1f7ff883ed7f20.gsc:257
[freezebonus]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/aats/zm_aat.gsc:605
[tribute]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_2f560596a9a134ab.gsc:429
[rewardpool]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_2f560596a9a134ab.gsc:173
[exfilwindow]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/gametypes/zclassic.gsc:333
[exfiltimer]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_7b1cd3908a825fdd.gsc:748
[exfilsetup]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_7b1cd3908a825fdd.gsc:89
[exfilbudget]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_7b1cd3908a825fdd.gsc:1745
[exfilspawns]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_7b1cd3908a825fdd.gsc:1500
[contributors]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/scoreevents.gsc:906
[effectcredit]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/scoreevents.gsc:486
[killevent]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/scoreevents.gsc:837
[ourevents]: C:/Users/User/Projects/mall-zombies/src/game/events.js:12
[armorui]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/script_7a5293d92c61c788.gsc:285
[weapontable]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/zm_weapons.gsc:4018
[legacyscore]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/zm_score.gsc:964
[scoretables]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/core_common/scoreevents_shared.gsc:560
[settings]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm_common/zm_utility.gsc:8030
[deadshot]: C:/Users/User/Projects/mall-zombies/references/t9-src-main/vm-38/scripts/zm/perk/zm_perk_deadshot.gsc:191
