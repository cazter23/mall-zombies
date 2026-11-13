# Sunset Galleria: build history ("Current state")

## 12 November 2026 - Jackpots: clocks that wait for a fight, and a Clearance that clears its area

Three changes proposed after the incentives review, on `claude/incentive-meter` (game/incentiveEffects.js, config/powerUps.js):
- **Jackpot clocks hold while nobody is up (`holdWhileQuiet`):** Commission Day and Black Friday only count down while a zombie is up to fight (one still rising out of its spawn does not count). Grabbed at the end of a wave, they keep their seconds for the next one instead of running out in the break. `effect.held` is shown as `ON HOLD` on the HUD row. Commons never hold.
- **Store-Wide Clearance clears its area:** every non-boss zombie in the map area the pickup lies in (`map.areaAt`, passed in from createGame), on its floor. The old 28 m circle reached through walls into the next room and stopped short in the 40 m Hallway; the radius is now only the fallback for a map without areas. `clearanceDetonated` gained `area`.
- **Its bonus grows with the round:** still one flat credit with no per-kill pay, now `bonus.perRoundZombie` (30) x the round's wave size, rounded to 10 (`clearanceBonus(round)`): 420 at round 4, 870 at round 10, 1,620 at round 20, about a fifth of a round's income all game where a fixed 400 faded to nothing.
- **Checks:** tests in tests/powerUps.test.js (the Hallway cleared past the old radius while the Food Court 8 m away, the start room and the Promenade overhead survive; the bonus table; the radius fallback; the hold, a rising zombie, ON HOLD, commons never holding). Browser: the same Hallway clear paid 870 at round 10; Commission Day sat at 20 s `ON HOLD`, then ran once a shopper was up. Full suite 1,645 passing.
- **Economy (`--quick`):** the bot does not go after pickups, so its runs barely see a jackpot: the income table is unchanged from the run before these changes and the mortal rounds moved within noise (10.3 -> 9.8 good, 7.5 -> 7.5 average). Judge these three by playing.

## 12 November 2026 - Incentives review: the trim, jackpots, weights, looks and meter checked and fixed

A second model reviewed the four stacked incentive branches (`claude/incentives` -> `incentive-weights` -> `incentive-looks` -> `incentive-meter`, all in `.claude/worktrees/incentives`) against the trim/jackpot spec. The uncommitted meter work went in as one snapshot commit first, then small fixes on top:
- **Bug:** an Employee of the Month drop with every common busy fell back to the whole catalogue, so a jackpot could drop before `jackpot.firstRound` or right after another jackpot. It now falls back to any common (`chooseRewardType`, game/powerUps.js); a test pins it.
- **Weakened test:** the trim rewrote the Paid Break test and lost its other-floor, wall and max-health checks (its title still said walls). Main's test is back beside the new one.
- **Weak tests:** Black Friday's boss check passed even with no multiplier (a gunStats unit test now pins one-hit damage, exactly 3x on bosses, nothing without the flag); Commission Day's test named the helmet pop but never checked it; the Clearance light stutter in horror.js had no test (tests/horror.test.js now has one).
- **Config rule:** the Clearance flash's dim opacity (ui/bossFlash.js) and the stutter's lamp/neon levels (horror.js) were hardcoded; they live in `config/powerUps.js` visual now.
- **Words:** three stale "Security Sweep" comments (feel.js, zombies.js, mascotCostumes.js) and Loss Prevention's summary ("strikes": its charges count melee hits, so a multi-target swing spends several).
- **Checked and kept:** reset order (powerUps resets before stats, so every modifier is divided out of the run's stats, never fresh ones), death and Save & Quit stripping (`stripEffectModifiers`, save version 9), clearance kills skipping the per-kill payout and the outfit rail, the shared-model cache, the edits to ballistics/melee/playerGun (Black Friday reaches projectiles and the box cutter), zombieManager (the removed `securitySweep`), returnQuest/wallet (`award`: the Commission Day path), headlessGame's snapshot (more fields compared, not fewer), scoops.test.js (`gold: false` pins a coin flip). `npm run balance` is byte-identical to main.
- **Economy (`--quick`, 2 seeds, noisy):** rounds 1-3 identical; round 10 total 23,430 -> 23,205 (good) and 22,025 -> 23,175 (average); mortal mean round 10.0 -> 10.3 and 7.0 -> 7.5.
- **Left as decisions:** 11 types (8 common + 3 jackpot) against the spec's 8-10; Clearance's 28 m radius ignores walls; Commission Day does not double boss-voucher point conversions (`wallet.earn`).

## 12 November 2026 - Employee of the Hour meter and Guide incentive discovery
- Branch `claude/incentive-meter` stacked on `claude/incentive-looks` (`ef2c6cd`) adds the `EMPLOYEE OF THE HOUR` meter to the HUD and a persistent `Employee Incentives` discovery section to the Staff Survival Guide.
- `src/game/powerUps.js` announces `'powerUpMeter'` snapshots (`progress`, `round`, `unlocked`, `available`, `capped`, `nearFull`, `dropped`, `maxPerRound`, `silent`) across round starts, kills, drop spawns, save restores and run resets; `src/ui/hud.js` forwards `'powerUpMeter'` to `src/ui/incentiveHud.js` without reading `powerUps` internals.
- `src/ui/incentiveHud.js` renders the `.incentive-meter` card inside `.hud-left-stack` (hidden before `powerUps.firstRound` and when Comfort toggle `settings.incentiveMeter` is off, while keeping drops/benefits visible), highlights `.is-near-full` + triggers one-shot chime `incentiveMeterReady` at `nearFullFraction: 0.8` per cycle, and dims as `ROUND CAP · CAPPED` when the round drop limit is reached.
- `src/game/guideSave.js` (`discovered` map), `src/game/guide.js` (`'powerUpCollect'` listener ignoring assisted/dead runs, `'incentiveDiscovered'` event, `debugIncentive`), `src/config/guide.js`, `src/fx/powerUpView.js` (`buildIncentiveModel`), and `src/ui/guide.js` add the 11-entry `incentives` section (`???` lock until first genuine pickup, `X/11 incentives found`, icon + summary + PA quote + shared-mesh 3D exhibit) and `"NEW INCENTIVE"` toast.

## 12 November 2026 - Distinct 3D shapes, standout jackpots, and shared pickup models

Branch `claude/incentive-looks` (branched from `claude/incentive-weights` `049cb88` so the trimmed 11-type roster, jackpots, and HUD icons are present; `main` at `a013f9a` untouched):

- **Shape-first pickup models (`src/fx/powerUpView.js`, `src/config/powerUps.js`):** replaced shared silhouettes with distinct merged low-poly models for all 8 common incentives (stacked cartons, first-aid kit briefcase + `+`, winged punch clock, shield + baton, trapezoid shopping bag + starburst, tilted `%` hang tag, eye loupe + handle, mop bucket + diagonal pole), 3 jackpots (gold-trimmed bomb warhead, notched `$` medallion coin, gold-armored crimson tag + crossed cleavers), and 3 boss vouchers (`masterKey` bow/blade, `discountCode` stencil coupon, `signedApproval` seal + nib). Tuned high-contrast dark trims (`darkColor: 0x202437`, `darkEmissive: 0.25`) and warm non-reflective gold (`metalness: 0.15` + emissive) for readability in both lit corridors and horror/power-cut dark rooms without needing an `envMap`.
- **HUD alignment (`src/ui/incentiveHud.js`):** updated SVG silhouettes (`burst`, `ticket`, `spill`, `cross`, `door`) to match each 3D pickup prop.
- **Standout jackpots:** higher hover (`0.98` vs `0.82`), larger prop/glow scale (`1.38`), faster spin with tilt precession, gold bezel + rotating halo ring, and scaled beacon (`widthScale: 1.65, heightScale: 1.4`).
- **Shared model & material cache + draw-call reduction:** built each model and prop material once at module level (`userData.shared = true`), merging parts per material via `mergeGeometries` (`.toNonIndexed()` + stripped `uv`). Measured across all 14 types via Three.js scene-graph inspection: per-view owned geometries dropped `21 -> 2` (beacon pulse rings only), owned materials `34 -> 16` (`benefitZones` + pulses only), `propMeshes` `3..10 -> 3..4`, and active `prop + beacon` meshes `5..12 -> 5..6` (`12 -> 6` on `storeWideClearance`, `11 -> 6` on `commissionDay`). `view.dispose()` never disposes shared assets.
- **Checks & browser note:** extended `tests/powerUps.test.js`, updated `docs/folder-structure.md` and `docs/tests.md`, and verified `npm run build` + full `npm test`. `npm run preview` loaded cleanly at `http://localhost:4173`, while live `window.__mall` spawning and `renderer.info` inspection in the built-in browser subagent were blocked by its Web Worker sandbox (`page.evaluate` disabled and Pointer Lock unavailable on click).

## 12 November 2026 - Need-weighted employee incentive drops (and Paid Break restored)

On branch `claude/incentive-weights` (stacked on `claude/incentives` `70fd8f5` in `.claude/worktrees/incentives`, leaving `main` untouched), `game/powerUps.js` now shapes common drop probabilities toward what the player actively needs while keeping every existing bag, no-repeat, and jackpot rule intact:
- **Paid Break restored (`paidBreak`, 8th common type -> 11 total):** The trimmed catalog had removed all healing incentives, so `paidBreak` (`20 s`, `2.5 m` green circle, `60 HP` budget at `15 HP/s`, cross icon + `HP LEFT` HUD/floor ring) was restored in `config/powerUps.js`, `game/incentiveEffects.js`, `fx/powerUpView.js`, and `ui/incentiveHud.js`.
- **Config-driven need curves and cap (`config/powerUps.js`):** Global bounds `needWeight: { minFactor: 1, maxFactor: 4 }` cap how far any type can scale so no single incentive takes over:
  - **Healing (`paidBreak`):** Linear deficit curve from `1x` at `90%` health down to `4x` at `25%` health (`need: { startBelowFraction: 0.9, maxAtFraction: 0.25, maxMultiplier: 4 }`), still ineligible at full health.
  - **Ammo restock (`stockroomDelivery`):** Sums held rounds (`magazine + reserve`) divided by total capacity (`magazineSize + reserveCap`) across all carried `gun.slots`, ramping linearly from `1x` at `85%` combined ammo up to `4x` at `15%` (`need: { startBelowFraction: 0.85, maxAtFraction: 0.15, maxMultiplier: 4 }`).
  - **Discount (`employeeDiscount`):** `interactions.buyables()` (`game/interactions.js`, passed from `createGame.js`) inspects live unbought `PRICE_CATEGORIES` entries (`available()`, non-quiet, non-blocked, unowned, `cost > 0`), skipping repeatable `['ammo', 'ammoCache', 'hazard']`. Tent curve over `wallet.points / cost` on `[0.65, 0.9, 1.15]` peaks at `maxMultiplier: 3` at `idealRatio: 0.9`.
- **Bag & jackpot isolation:** Need factors apply inside `weightedPick()` on eligible common types only (`nextInBag()` and `chooseRewardType()`). Jackpot `firstRound: 4`, `chance: 0.125`, no-consecutive-jackpot tracking (`lastWasJackpot`), no-immediate-repeat (`lastType`), and full-bag cycling remain unchanged.

## 12 November 2026 - Employee incentives: trimmed 13 -> 10 types and rare jackpot tier

Employee incentives (`config/powerUps.js`, `game/powerUps.js`, `game/incentiveEffects.js`) were consolidated from 13 overlapping types down to 10 (7 `common`, 3 `jackpot`) on branch `claude/incentives`:
- **Trimmed & merged (13 -> 7 common):** Removed `blueLightSpecial`, `securitySweep`, `expressCheckout`, `overtimeApproved`, `staffEntrance`, `productRecall`, and `paidBreak`. Merged `expressCheckout` + `overtimeApproved` into **SHIFT BONUS** (`shiftBonus`: `12 s` base, `+1.5 s` per direct kill up to `24 s`; `reloadMultiplier: 1.6`, `switchMultiplier: 1.8`, `speedMultiplier: 1.25`) and merged `lossPrevention` + `staffEntrance` into **LOSS PREVENTION** (`lossPrevention`: `25 s`, `3` melee hits at `damageMultiplier: 2` + `2.5 m` AoE stagger, and sprinting pulses `1.8 m` visible same-floor shoves every `0.35 s`). Kept `stockroomDelivery`, `inventoryLiquidation`, `employeeDiscount`, `mysteryShopper`, and `spillCleanup`. Zero removed IDs remain in `src/` or `tools/`.
- **Rare jackpot tier (`tier: 'jackpot'`, `jackpot: { firstRound: 4, chance: 0.125 }`):** Never drops before round 4 and never twice in a row across both meter drops and Employee of the Month drops; `save.version` bumped `8 -> 9` so `lastWasJackpot` and `jackpotRotation` serialize across Save & Quit and active stat modifiers are stripped before saving stats:
  1. **STORE-WIDE CLEARANCE** (`storeWideClearance`): clears all non-boss zombies on the pickup's floor within `radius: 28` using `source: 'clearance'` (so `'kill'` skips per-kill payout and `'payingKill'` outfit rail pulses), pays `flatBonus: 400` once via `wallet.award`, deals capped non-lethal `0.45 * maxHealth` to bosses above `damageFloor + 1`, emits `clearanceDetonated` for splats, Comfort-aware screen flash (`ui/bossFlash.js`), and Horror light stutter (`game/features/horror.js`).
  2. **COMMISSION DAY** (`commissionDay`): `2x` payouts for `20 s` through `stats.pointsMultiplier` and `wallet.award()` (`wallet.js` wraps `wallet.earn()`, leaving raw debug/test/expired-voucher `earn()` calls unscaled).
  3. **BLACK FRIDAY** (`blackFriday`): one-hit kills for `10 s` on non-boss zombies (`stats.instantKill: true`) and `3x` damage on bosses (`stats.bossDamageMultiplier: 3`) routed cleanly through `applyInstantKillDamage()` in `weapons/gunStats.js` across hitscan, cone, projectile (`ballistics.js`), and melee (`melee.js`).
- **Visuals, HUD & Audio:** Distinct 3D meshes (`fx/powerUpView.js`) plus double halo rings and `jackpotGlowScale: 1.25` on jackpots; inline SVG icons + `.jackpot` HUD cards (`ui/incentiveHud.js`); jackpot synths in `config/audio.js`.
- **Economy impact (`npm run sim:economy -- --quick`, BEFORE -> AFTER through Round 10):** Rounds 1-3 unchanged (`2,810 -> 2,810` good skill, `2,745 -> 2,745` average skill); Round 10 cumulative `23,430 -> 23,555` (`+0.5%`) for good skill and `22,025 -> 23,175` (`+5.2%`) for average skill; mortal mean round ended `10.0 -> 9.5` (good) and `7.0 -> 7.5` (average).
- **Preview note:** `npm run build` compiled all 365 modules cleanly; the built-in browser pane timed out at `about:blank` and its sandbox disallows `page.evaluate` on `window.__mall`, so live browser screenshots remain uncaptured.
## 12 November 2026 - Doorbusters: the rush comes when you BUY it, and only items you can reach in time

Two design changes after the review (game/flashSales.js, config/economy.js flashSales.doorbuster). **The rush is the price of the bargain:** going live no longer spawns anyone; buying the Doorbuster's item (the 'purchase' event; a door matched by its destination, `areaId`) sells it out: the sale ends with reason `'sold'` (PA `doorbuster.sold`, "Sold! ... The other shoppers saw that."), its price goes back to normal, and the rush starts and outlives the sale until every shopper has spawned (a discarded round, Play again or a load drop it). A Doorbuster you let pass costs nothing, and a break-time Doorbuster only fills the shopping window if you take it. **Only items in reach:** `reachableInTime(target, routeCost, maxRoute)`: one of the item's buy spots must be within `reachShareOfWindow` (0.5) of the window at your sprint speed (stats.sprintSpeed; 80 m of route at the defaults), by the zombies' nav field to you (route metres plus a little extra near walls, so it errs near). No item in reach = a normal sale instead. Applied when picking; a teased Doorbuster is not re-checked at go-live (you may have walked away on purpose).

## 12 November 2026 - Flash Sales: 10 s PA warning, minimap & world SALE tags, and Doorbusters

- **PA teaser (`flashSaleSoon`):** `economy.flashSales.teaserSeconds` (10 s; `firstDelaySeconds` adjusted to 110 s so the first live sale stays near 120 s). Announces the coming category or Doorbuster on the PA in deadpan mall voice and shows a countdown on the HUD `.sale-tag.soon` without discounting prices early. At go-live, `createFlashSales` re-checks eligibility, picks an eligible fallback if needed or cancels quietly, and `serialize()`/`restore()` preserve pending teasers (`save.version` bumped to `9`).
- **Minimap & 3D world SALE tags:** `flashSales.js` exports `collectSaleSpots()` (DOM-free) so both `minimapState().sales` and a new browser view `fx/saleTagView.js` highlight the exact usable open/adjacent buy spots during both teaser and active sale, clearing each item as soon as it is bought or the sale ends. `saleTagView.js` renders two-sided retail hang-tags via `world/typeKit.js` (`clearance` role, shared `InstancedMesh` pools + `fx/beacon.js` for Doorbusters).
- **Doorbusters:** Weighted rarer (`weight: 0.55`, `fromRound: 3`), discounts one specific unowned/reachable item (wall gun, adjacent shutter/unlock, open attachment, open wardrobe item, or open non-full Kevin product) at `65-75% off` for `20 s` through a new per-item discount map (`pricing.setItemDiscount` / `discountOf(category, id)`) that leaves category + employee coupon + boss voucher stacking untouched. Triggers a round-scaled, capped rush of extra regular-reward shoppers (`extra` so waves never shrink and break-time sales stay safe) from nearby open-zone spawn markers via `zombies.spawn(...)` within `maxAliveForRound`. Debug helpers: `debug.run('doorbuster')` and `debug.run('flashSaleSoon')`.
- **Reviewed (second pass, same day).** How the rush works: when a Doorbuster goes live, flashSales computes the count (`rush.baseCount` + `perRound` per round past `fromRound`, capped at `maxCount`), takes up to `nearestMarkers` open-zone spawn markers within `maxMarkerDistance` (18 m) of the item, or the single nearest if none is that close (`nearOpenSpawnPoints`), and spawns one Shopper every `spawnIntervalSeconds` through `zombies.spawn('shopper', null, { spawnPoints })`, the manager's own restricted-marker path (bosses use it too): its safety checks (4 m from you, body clearance, a route), per-type caps and failsafe apply, and it only asks while `aliveCount < maxAliveForRound` (otherwise it waits `retrySeconds`). The rush is extra (not from `remainingToSpawn`), so a round simply ends when its wave AND the rush are dead; what is still unspawned when the Doorbuster ends is dropped, and `roundDiscard` / Play again / a load drop it too. Fixes from the review: `g.warranty` was not exposed, so an Extended Warranty sale never marked the Customer Service desk (minimap and world tags); attachment Doorbusters/markers now need an attachment that fits a carried gun; `saleTagView` listened to a non-existent event, never unsubscribed and had no `dispose()`; the `.sale-tag` rules added to style.css never showed (retail.css overrides them) and were removed; teaser lines reworded deadpan; found in the browser check: shutter tags and the Doorbuster beacon sat inside the shutter (doors have no wall normal: `doorNormal` now points them at the bought side, `worldTag.doorOffset`), a teaser whose spot became usable without an event never got its tag (the view now re-reads on a timer while a sale is on), and with few areas open "the 5 nearest markers" were every open marker, up to 36 m away, so the rush came from across the mall (now capped by distance); the rush test now counts the exact spawns made through the manager (it only checked that the zombie list grew, which the wave does on its own), and the Flash Sale + Employee Discount test is pinned to literal prices and the real pickup.

## 12 November 2026 - Delete list from the code review: dead exports gone; three items held back on purpose

From the code review (pass 2). An export scan (every `export` in src/ that no other file in src, tests or tools names) found 22. Only one was dead code: `ATTACHMENT_SLOTS` in game/features/attachmentCounter.js, now deleted. Eleven more are used only inside their own file, so they lost the `export` keyword (nothing else changes): workshopComboNames, impulseForPeak, portalRect, HAZARD_SWITCH_STYLES, CLAW_CABINET, PRIZE_BOOTH, ARENA, getFacetedLimbGeometry, skinPatternTexture, NOZZLE_LENGTH, DIRECTIONS. The other ten were left exported: six are named in docs/folder-structure.md as a module's API (vanNeeds, vanNeedsClassic, meleeDeskItem, secondChanceItem, paintMural, HEADS), and four sit in files the sign-looks work owns (stores.js, typeKit.js, textures.js, config/fonts.js).
Held back:
- **The door `price` field** (every price comes from g.pricing; the field is only read by tests). It is set in maps/mall/mall.js, which the sign-looks work is editing: do it after that merges, and move the tests that read it (mall, atrium, cinema, interactions) to `g.pricing.priceOf('door', ...)`.
- **The five storage wrappers** (careerStats, challengePins, guideSave, skinSave, settings, plus saveGame's). On a closer look they are not copies: each chose its own failure rule (lazy lookup, go memory-only after a throw, never overwrite a newer build's record). A shared helper would save about 30 lines and touch the code that holds permanent progress; not worth it now. If a sixth record appears, give it a shared versioned-record helper then.
- **Debug flags on** (config/debug.js enabled, testArena, exposeToWindow). They are not dead: the debug keys, the T test range and window.__mall (every agent's browser check) use them. Turning them off is a release decision, not a cleanup; when a release build exists, switch them on import.meta.env.DEV instead.

## 12 November 2026 - Feature saves keyed by name: adding a map feature no longer breaks Save & Quit

From the code review (pass 2). Save & Quit stored each map feature's run state (Build-A-Blaster's order, the claw machine's site and stock, Kiosk Kevin's site) under its PLACE in map.features. Adding a feature anywhere before those three shifted the places, so the save version had to be bumped (dropping everyone's saved run) or a save would restore the claw machine's data into the wrong feature. Versions 5, 7 and 8 were bumped partly for that. Now features/index.js keys the data by the feature's name: adding, removing or reordering features needs no bump; renaming one of the saving features does. A feature that saves must have a name of its own, or building the map throws (all 61 mall features are named, no duplicates). Saves written before this change are still read: a numeric key is taken as the old place, so a saved run in progress survives the update; that fallback can go with the next version bump. No version bump here. tests/features.test.js guards it.

## 12 November 2026 - createGame.js: the mall PA becomes a table, feature lookups get a name

From the code review (pass 2). createGame.js went from 995 to 911 lines. Not a rewrite: it is still the one place every system is built and wired, which is the point of it. What moved out was repetition:
- **The mall PA** (event -> `hud.showAnnouncement` + chime): about 25 hand-written listeners became four tables in game/announcer.js. They are registered at four points in createGame on purpose, each where its listeners always were, because listeners of one event run in the order they were added and equal-priority lines queue in that order (Closing Time's key sound before the chime, a collect line before its certificate). A new system's plain PA line is now one name in PLAIN_PA_EVENTS.
- **Flash Sale eligibility** (which groups are worth discounting) moved next to Flash Sales as `saleEligibility` in game/flashSales.js.
- **Feature lookups by kind**: `features.instanceOf(kind)` / `instancesOf(kind)` replace the `features.list.find(({ feature }) => feature.kind === ...)` copies in createGame, debugCommands, minimapPlan and main.js (tools and tests keep their own: no need to touch them).
Checked: a recorder of every HUD and sound call (every PA event with and without a line, both run modes, plus a short real run) hashed the same before and after (b8493642a5b8e217). tests/announcer.test.js guards the order and the Directed-only lines.

## 12 November 2026 - One bug no longer freezes the game: the loop catches errors per stage

From the code review (pass 2). core/loop.js asked for the next animation frame only at the end of a frame, so any error thrown by a tick (any gameplay system, any event listener) or by render skipped that request: the picture froze for good while the radio kept playing, and the only trace was one line in the console. Now beforeUpdate, each tick and render are caught separately and the next frame is requested whatever happens. A tick that throws counts as played (the accumulator is decremented before the tick), so a tick that fails every time does not build up a debt that would be replayed at once when it stops failing. The default report prints each distinct error once in full and then a count of repeats every 5 seconds; `onError(error, stage)` replaces it, and `loop.errors` counts them. The trade-off: a tick that throws may have stopped partway (later systems skipped for that tick), so state can be slightly off; a game that keeps going with a logged error beats a frozen one. `window.__mall.step()` does not go through the loop and still throws to its caller, as tests want. tests/loop.test.js guards it.

## 12 November 2026 - Docs stop conflicting: history, tests and folder-structure merge with the union driver

From the code review (pass 2). Of the last 80 merges, 38 stopped on a conflict in docs/history.md, 7 in docs/tests.md and 4 in docs/folder-structure.md, almost always because two branches each added a line at the same spot (the top of history, the end of a list) and a person had to keep both by hand. A new .gitattributes marks those three files `merge=union`: git keeps both sides' lines instead of stopping. Replaying the 80 merges with the rule on: none of the three files conflicts any more, and 134 of 153 file results are byte-identical to what was committed; the other 19 differ by a few lines (mostly one), which is the price: if two branches edit the SAME existing line, both versions are kept, so look at the merged file once. Code files and docs/map.md still conflict normally.

## 12 November 2026 - Zombie pathfinding: half the cost per redraw, a sixteenth of the garbage, the same routes

From the code review (pass 2). The zombies' shared "arrows toward the player" map (zombies/navigation.js) is redrawn for the whole mall every 0.2 s. Measured headless at round 30 with every area open: that one job was about 30% of the tick's CPU, made a slow tick every 13th tick, and produced about 94% of the game's garbage. Branch claude/nav-flow-field.

- **No garbage in the inner loops.** The eight neighbours were a list of `[dx, dz, cost]` triples read with `for (const [...] of ...)`, the heap swapped with `[a, b] = [b, a]`, and the wall check built three small arrays per collider. Each made throwaway objects by the million. They are now flat lists read by index, one reused block of numbers for the heap, and the wall check written out per axis. Measured (V8's sampling heap profiler, 24 zombies, round 30): 3,596 KB a tick (211 MB a second) down to 220 KB a tick (13 MB a second).
- **Less repeated work.** A cell that comes out of the heap again at the distance it already spread from is skipped (it cannot shorten anything), and a typed flag answers "does this cell have a ramp" instead of a Map lookup per cell. One redraw: 7.8 ms down to 3.9 ms (median of 400, everything open, this PC).
- **No redraw while the player stands on exactly the same spot** on an unchanged grid (holding a corner, an open order form, the death camera, most headless tests): the field would come out the same. A collider change still redraws it on the next tick, and the position is compared by value (the zombie manager passes player.position itself, moved in place): tests/navFloors.test.js guards both.
- **The routes are the same, to the bit.** A throwaway script fingerprinted 4.4 million answers (distanceToTarget at every cell, directionTo with three lanes at every metre, both floors, 53 player spots, doors closed and everything open, plus boss paths): the same hash before and after.
- **The whole tick**, old and new run back to back under the same load (another agent was testing, so the absolute numbers are high): round 30 with 24 zombies, p95 12.6-15.4 ms down to 5.5-5.8 ms, mean 2.8-3.5 ms down to 2.1-2.3 ms. Measured in Node; Firefox will differ.
- Not touched, and still the next costs: collision scans every collider for every zombie (world/collision.js moveAndCollide, about 23% of the tick's CPU before this change), and a single tick of about 30 ms still turns up while holding fire into a crowd with a boss and four hazards running (before and after this change: not the flow field, cause not isolated).
- Shared files: none besides docs/history.md, docs/tests.md and docs/folder-structure.md.
## 12 November 2026 - Build-A-Blaster hall colours restored; debug window names the god-mode key

- Look pass 5 put a comment in the middle of a palette line in config/promenade.js (workshop details colors), which commented out the hall's `glass`, `pipe`, `beam`, `neon` and `lamp`: eleven parts (hopper windows, pipe runs, beams, neon, lamps) were built with no colour and Three.js only warned. The comment now ends the line. New guard in tests/mall.test.js: building the mall must give every material its colour.
- God mode is on B (G throws a Lethal since Kiosk Kevin phase 1). The debug window's status headings now take their keys from the command table (config/debug.js), so it reads "B toggles god mode" instead of the stale "G toggles".

## 12 November 2026 - Look pass: readability, a horror layer you can see, half the sign memory, and the barebones spots dressed

From the graphics review (pass 3) and its detail audit. Seven commits on branch claude/look-pass, each tested; the user asked for every item the review was confident about.

- **Zombies read against pastel.** The edge glow was a light rim on light walls (invisible). In bright areas zombies now get a dark, ink-like edge; only where the view is dim (back of house, late rounds, power cuts) does the light rim return (zombies/zombieRim.js, look.zombieRim.darkEdge / darkBelow; main.js sets it each frame from the view's exposure). The palest shopper tops (cream, white, lilac, pale yellow) are a step darker.
- **The horror layer shows.** Measured: at the old strength a round-21 hallway was barely darker on screen. Now darkness max 0.4 (was 0.2), late hours exposure 0.68 (was 0.84), up to 55% of lamps die, and the lit ceiling panels follow their area's lamps (dying, dead, power cut; game/features/horror.js). Settled at round 21 the hallway is about 33% darker than with the layer off.
- **Printed signs and posters take the room's light** (world/mapKit.js printedMaterial, look.print.glow 0.35): they used to glow white like stickers in dark corridors. Neon and screens stay unlit.
- **Hubs:** warm mauve haze instead of white, a little more contrast, darker floor border bands (Hallway, Promenade, the Atrium's upper ring).
- **Beacons** (fx/beacon.js): a light column and pulsing ring over power-ups and Closing Time keys, a column over Kevin's open cart. 1-2 draws each.
- **HUD:** the +points pop floats from above the store-credit card (it covered the label); short windows (<= 600 px tall) get slimmer cards and hide the wardrobe rail until something is worn. Checked and left alone: the PA card is opaque (the see-through captures were its fade), and the death receipt's button bar is sticky on purpose.
- **Cost.** Sign canvases are sized by the sign (drawn on the same 1024 page, scaled): with tile textures built once and shared, canvases fell from ~770 MB to ~394 MB. Graphics > Small detail hides small printed things beyond 22 m (Low) / 14 m (Potato) (fx/detailCulling.js). Static batching uses 24 m chunks (was 12). Wall-buy guns are merged per material (28-55 meshes -> 9-17). Level 2's view: High 1,693 -> 1,341 draw calls, Potato 1,533 -> 983; hallway High 1,293 -> 1,033, Potato 1,150 -> 790.
- **Benchmark:** the Food Court shot's dolly ran through Play Time Toys and Byte Me (inside their walls); it now runs at z -8.5, and a test keeps every shot's path out of colliders.
- **Detail passes:** the Atrium's bare south wall (three framed sunset murals, benches, a planter) and a neon SUNSET GALLERIA; the Build-A-Blaster back hall as a workshop (grey walls, dark roof, machine-grey wainscot, safety-yellow rail, pegboard tool walls, cable trays, chain hoists); Customer Parking (pylon sign, facade neon, wet gloss, cones, a box truck along the south fence); Mega Mart overstock racks high on the side walls; Play Time Toys' blank side wall (ad board, alphabet blocks); the start room (slatwall, bunting, a FINAL WEEK sign).
- Not done here (the review's "needs your eye" and "risky" items): boss props and scale, gun tier finishes, the Promenade landmark, Kevin and Closing Time spectacle, one shared texture per room for signs, merging zombie parts.
- Shared files: main.js, maps/mall/mall.js, config/look.js, config/settings.js (the new Small detail setting and presets), config/concourse.js, config/shoppers.js, world/mapKit.js, world/textures.js, world/atmosphereTextures.js, world/wallBuy.js, game/features/horror.js, maps/mall/props.js, stores.js, zoneLooks.js, atrium.js, kioskCart.js, parkingDetails.js, megaMartDetails.js, startRoomDetails.js, workshopRoom.js, workshopDetails.js, fx/powerUpView.js, fx/closingKeyView.js, src/style.css, ui/readability.css, tests (powerUps, horror, benchmark, zombieRim, new: beacon, detailCulling, wallBuyMerge).

## 11 November 2026 - Galleria FM: six songs on the mall radio

- **One 44-second loop became a radio station.** The mall's speakers now play Galleria FM: six original songs of 1:44 to 2:32, each a different kind of mall music, opening every session with After Closing (the mall's theme), then in a shuffled rotation (every song once before any repeats, never the same one twice running), crossfading from one to the next. Every song opens with the station's three-note chime, so the chime plays between songs. A "Now playing" card (Galleria FM · song title) slides in at the bottom left when a song starts where you can hear it.
- **The songs** (config/radioTracks.js): After Closing (the original lounge loop, kept note for note, now with a bridge and an ending), Escalator Bossa (nylon plucks, flute, a marimba chorus), Food Court Funk (slap bass, clavinet, a brassy riff), Synth Promenade (80s mall pop with arpeggios, gated snare and a key change), Waiting On Hold (an elevator-music waltz, marimba and flute) and Clearance Event (smooth jazz: breathy synth sax over electric piano).
- **A small song engine** (audio/mallMusic.js): songs are data (chord symbols per bar, rhythm patterns that play each bar's chord, written melodies, drum grooves, sections and a form), synthesised deterministically with new instruments (electric piano, marimba, bell, a wind voice for flute / lead / sax, clavinet, a plucked string, slap-style bass) and a synthesised kit (kick, snare with an optional gate, clap, hats, shaker, rim, brush, tom). Rendering one song takes about a second, in a worker.
- **Memory:** only the song playing and the next one are held (about 15 MB each at 16 kHz; the speakers' low-pass sits under 4 kHz). The radio's timeline still moves only while a speaker is audible, as before.
- **Tape wear:** from round 14 to round 30 the radio sags in pitch (up to 45 cents) and wobbles, like a worn tape. Off when the horror layer is off.
- Not heard by a person yet: the songs were checked by measurement (levels, no clipping, no silent stretches, melody notes on chords) and by WAV previews (`node tools/exportMusic.mjs scratch/galleria-fm`). Mix levels between instruments are first guesses.
- Shared files: audio/sound.js (the radio player), main.js (the card and tape wear), config/music.js (rewritten). Branch claude/galleria-fm.

## 11 November 2026 - The minimap restyled as the mall's own directory sign

- **The look of the in-world directories** (plum case, brass, teal signage, cream serif): brass frames with screw heads and a faint glass glare, a teal header ("Sunset Galleria · Store directory"), each area in its own colour taken from its shutter finish (areas not bought darker and hatched), a real floor plan (thick walls broken at doorways, from the culling portals), barrier tape over shut shutters with the price on a hanging price tag, escalator and stair chevrons pointing up, wayfinding pictograms instead of letters (gun, ammo, warranty badge, scope, hammer, hanger, claw, ticket, cart, bolt, safe, return arrow, van, key), and a pulsing you-are-here dot with a view cone.
- **The directory works like a real one:** places are numbered, and a store index under the floors lists them by group (wall guns by name, upgrades, supplies, hazards, customer services) with their area, dimmed where not bought, plus where Kevin's cart is this round. The floor you are on is drawn larger under a lit LEVEL tab. The corner map gains a strip naming the area you are in.
- **A little life:** the directory flickers on like a backlight warming up (0.16 s) and the corner map slides in; both are skipped with reduced motion.
- Seen in the browser at 800x450 and 1600x900. Browser storage was empty before and after.

## 11 November 2026 - The minimap: a mall directory on Tab

- **Hidden until asked for** (the user's call: an always-on minimap is a common complaint about modern COD). TAP Tab (controller Back/View) for a small corner map that turns with you; HOLD it for the whole directory, both floors side by side, north-up, while held. The corner choice is remembered (setting `minimap`, not in the menu). No gags: it is meant to be useful.
- **What a printed directory would show, no more:** rooms (bought ones filled, the rest hatched), the upper floor's holes (balcony voids, the atrium court), escalators and stairs, shutters still shut with the price to open them where you can, wall guns by name, Restocks, Warranty, attachment counters, Build-A-Blaster, fitting rooms, the claw and prize counter, the four hazard switches, the night safe, Returns desk and van, Kevin's cart while open, and dropped Closing Time keys on Directed runs only. Never zombies, bosses, lost property or quest steps. The duty places (safe, desk, van) show in Classic too: they are fixtures you can see anyway; only the keys and quest stay unmarked.
- **All from map data** (game/minimapPlan.js): the culling rooms per floor (the map's new `minimap` entry), culling portals for shutters, `colliders.ramps`, `map.features`. A new area, door or feature shows up with no change to the minimap.
- The PA, sales and notices (right-hand HUD stack) move down under the corner map while it is up. Tab is now blocked from moving browser focus while playing.
- Seen in the browser (production build, vite preview, 800x450 and 1600x900): the corner map on both floors, the full directory, the right stack moving down, and the Tab / Back labels on both Controls diagrams. Browser storage was empty before and after.
- Shared files: maps/mall/mall.js (the `minimap` entry), maps/index.js (interface comment), maps/areaBarriers.js (`zoneForRoom` exported), config/controls.js (binding and help lines), config/settings.js (the remembered setting), core/input.js (Tab in GAME_KEYS), ui/controlsDiagram.js (two label slots), main.js (mount and per-frame update). Branch claude/minimap.

## 11 November 2026 - The Closing Time measurement bot merged into main (its report is out of date)

- claude/closing-time-11 (`npm run sim:closing`: tools/closingTimeBot.js and closingTimeSim.mjs, the economy bot's seeded wrapper and driver hook, and the phase 11 report) merged into main. The user's call: worth having, not very useful.
- Conflicts: docs (both kept), package.json (both new scripts, sim:challenges and sim:closing) and tools/economyBot.js, where main's `onGame` hook (tools/challengeReport.mjs) and Kevin's standing order were kept beside the branch's seeded wrapper and driver.
- **One fix:** the bot's "with Return to Sender" runs bought the gun at the Returns Desk, which no longer sells it, so they would have waited forever. At the same moment (the duties done) the bot now skips the hidden quest to "your number is called" and collects the gun free. One run checked: directed, immortal, average skill, seed 1, won at round 20 with the beam as the finisher.
- **The phase 11 report predates the Return quest** and its "returns" figures include the old 10,000. It is marked out of date at its top; rerun `npm run sim:closing` before quoting it.

## 11 November 2026 - Weapon skins phase 9: the Closing Time rewards

- **Two looks that fit every gun, unlocked by winning the shift** (config/skins.js `closingRewards`, appended to each gun's list as slots 4 and 5):
  **Employee of the Month** (any run mode: brass body, dark grip, a name badge) and **After Hours** (Classic only: near-black with sunset-coloured
  trims that glow and drift; it also unlocks Employee of the Month). One win unlocks a reward on all eleven guns, announced once ("every gun").
- **The hook:** the run summary gains `closingMode`; a new counter kind `closingWin` (game/challenges.js) listens for `'runWon'` (the moment the van
  leaves) rather than `'runEnd'`, so a win counts even if the tab closes at the receipt, and the win receipt can list it: createGame's
  `receiptFor` reads the shift's earned list live (the win summary is taken just before the reward is paid). Clock out, Stay and a later death all
  keep it; a debug-assisted run earns nothing.
- **The badge** (weapons/models/skinBadge.js): one small plate, one draw call, placed by raycast on every gun's left face next to the sticker mount
  (not hand-placed: eleven guns, eleven different faces; a hand or arm in the way rejects a spot). After Hours reuses the phase 7 `drift` treatment.
- **The board and locker:** the Challenges tab lists the two rewards once, under "Closing Time" (one pin each, `skin:closing/<id>`); the locker shows
  five finishes per gun. No gun number, price or sound changed (the balance report is unchanged).


## 11 November 2026 - Hazards phases 2 to 4 and their review merged into main

- claude/hazards-review (Food Court Fryer Blast, Main Hallway Fire Sprinklers, Service Corridor PA System Lure, and the review's fixes: player slows through game/surfaceSlows.js, one switch per hazard, readable effects) merged into main after Kiosk Kevin phases 4 to 7. Its own entries are below. docs/hazards-plan.md moved to docs/archive/.
- Conflicts were both sides adding to the same lists: the feature registry, the feature context (surfaces, lostFound, returnQuest), the map's feature list (Kevin's five carts and the escape van's validation from main, the three hazard switches from the branch), the feature-kind test, the save version and docs. The save version is now 8 (three new map features).
- Against Kevin: the Sprinkler pull station stands 2.1 m from Kevin's Hallway cart, on purpose (the hazards branch placed it between his cart and the planter, and tests that each keeps its own prompt). That test was written for his old single cart (`feature.slots`); with five carts the slots are per site, so it now reads his first site, checks it is the Hallway one, and that each of its three slots gives its own product. No game change was needed.
- Against Lost and Found: the Food Court's order pager lay 1.9 m from the new Fryer switch. It moved to (-11.75, 0, -7.55); tests/lostFound.test.js still finds it reachable, clear and with its own prompt.
- Checked: every interaction point of the merged map against the others within 3 m. Two remain and are intended: the Sprinkler and Kevin's Hallway cart (above), and the Night Safe and Kevin's Atrium cart (already in main, unchanged).

## 11 November 2026 - Kiosk Kevin phases 4 to 7 merged into main

- claude/kiosk-kevin-7 (five carts and the move, the Glitter Bomb and Sparkler Cake, the SPIN-O-MATIC Sentry, sales, vouchers and balance) merged into main. Its own entries are below, under their dates. Phase 8 (spectacle) is still to do.
- Conflicts: docs only, and config/save.js, where both sides had bumped the save version for different reasons. It is now 7, which also covers what Lost and Found and the Return quest changed earlier today (new map features and a 'returnQuest' save step) and should have bumped then.

## 11 November 2026 - The Return: Return to Sender moves to a hidden quest, and the duties award labels

- **The change (the user's idea).** Return to Sender is no longer sold at the Returns Desk for 10,000 once the three duties are done. It comes free from a hidden quest, in the style of a COD Zombies Easter egg. The duties stay required to win; each of the three working duties now awards a RETURN LABEL, a variant of the gun's behaviour, fitted at the desk. The claw machine still pays the gun out (weight 1 of 115, unchanged), so the quest is by far the easier way.
- **Decisions (the user's):** variants are different behaviours, not looks; the duties are still required; the claw keeps the gun; no guidance in Classic and only faint trails anywhere; labels last one run; the gun is free after the quest; quest progress does not carry between runs.
- **The quest** (config/returnQuest.js, game/returnQuest.js): the mall's returns procedure, followed literally. (1) Shoot the four NO REFUNDS floor signs: start room, hallway, Food Court, Mega Mart. (2) Make a charging zombie crash within 4.5 m of the desk (a Cart Pusher, or Kettle): a dented parcel appears on the tray. (3) Take a number at the desk, 47, then get 47 kills while within 14 m of the desk on its floor; kills made elsewhere do not count and there is no time limit. (4) Collect the gun, free; the desk reissues it free if you no longer own one.
- **The trail is the desk's own prompt**: "Policy: no refunds", then "Report damaged goods here", then "Now serving 12 · you hold 47". Each completed step plays one in-world PA line, in both run modes. Nothing is on the checklist. The Lost and Found pager already said "Order 47 is ready".
- **The labels**: Chain Return (Water features off) also returns the 2 nearest returnable zombies within 6 m; Full Refund (Takings banked) pays +75 a return and hands a round back 25% of the time; Product Recall (Last orders) also returns up to 4 of the same kind within 7 m. They act only on a zombie the beam itself returned: never a boss or Mascot, never a stuffing's burn, and an extra return never starts another. One label at a time; a second prompt on a small label printer beside the desk cycles through those held, free, with the gun in hand. A label's PA line plays in Directed only (it is the checklist's reward); Classic finds the printer.
- **Two things differ from the plan as first sketched.** The signs are free-standing A-frames, not wall signs (wall decoration has the coplanar rules; floor spots could reuse the lost-property checks). Chain Return has no smaller reserve: ammo per variant would be a deep change to the gun, and the three labels already trade off against each other.
- **A bug the tests caught:** collecting the free gun was recorded as a purchase (the till sound and a 'purchase' event), because the interaction system reads `quiet` after `use()` and by then the gun was in hand, which turns the desk into the ammo counter. The desk now records what a use was before acting.
- **Removed:** the desk's duties gate and its sale. `economy.closing.returnsDesk` (10,000) stays as the gun's nominal worth for the claw's report; nobody pays it. docs/closing-time-plan.md decision 6 is marked superseded.
- **Save & Quit** keeps signs down, the parcel, the ticket and count, labels held and the fitted label (a new save step). Play again resets all of it. Assisted runs can do the quest: nothing here is permanent.
- **Also in this change: Lost and Found in the Challenges tab.** The tab (merged meanwhile) gained a Collections category with one entry, "Lost and Found", showing n / 11 from the guide record; it can be pinned, and the tracker shows it when an item is logged. No item is named there (no hints).
- **Two more things the browser caught, that the headless tests could not.** (1) The HUD looks up a shelf price for any prompt whose kind is a price category (main.js). The quest's free prompts called themselves 'closing', and the label slot has no price, so the page threw the moment you looked at the slot. The free prompts are now kind 'returnQuest'; only the ammo is 'closing'. A test now does the HUD's lookup on every desk prompt. (2) The HUD prints a prompt's `title` in bold, so the ticket and collect stages read "Hold Returns Desk · Free". The title now names the action: "Take a number", "Collect Return to Sender", "Fit: Chain Return".
- **One the full suite caught:** the Food Court sign stood within 1.5 m of the arcade set piece (tests/setPieces.test.js keeps features clear of them). It moved to the Food Court's south wall.
- Checked in the browser: the start-room sign standing and falling, the desk's prompt at all five stages, the parcel, the free issue, the ammo counter afterwards, the label printer's prompt, and the Challenges tab entry with its pin. Not checked: the other three signs by eye, a real cart crash at the desk (tests place one), the three behaviours in play (their numbers are first guesses), and any sound.
- Shared files: config/closingTime.js, config/economy.js and config/clawMachine.js (comments only, plus two unused words removed), game/features/returnsDesk.js (rewritten), game/createGame.js, game/events.js, game/features/index.js, maps/mall/mall.js (one import, one loop), config/audio.js (one sound), game/challengeCatalog.js, ui/challengeBoard.js, ui/challengeTracker.js, config/challengeBoard.js, main.js, tests/closingTime.test.js (two desk tests rewritten, one count), tests/saveGame.test.js, tests/features.test.js, docs. Branch claude/return-quest, on top of claude/lost-and-found.

## 11 November 2026 - Lost and Found: eleven pieces of lost property, and the page they unlock

- **What it is.** One small item hidden in each area (a trainee's name badge in the start room, a balloon in the hallway, an order pager in the Food Court, a shopping list in Mega Mart, Murray's flask in the Service Corridor, a coin by the Atrium fountain, one unpaid shoe on the Promenade, a mannequin's hand in HOFFMAN'S, a ticket stub in the Cinema, a half-stuffed bear in Build-A-Blaster's back hall, car keys in Customer Parking). Hold the use key to log it, for good. Each has one line on its tag; together they tell the day the mall did not close.
- **Decisions (the user's, 11 November):** fixed spots; NO hints (an item not yet found shows only "item 4 of 11"); finding all eleven opens a last page, the incident summary; no gameplay reward; a second set (staff lockers) was left out. Tracking in the planned challenges tab comes later, in another session's work: `g.lostFound.progress()` (or `lostFoundProgress(save)` with only the record) is the whole answer it needs: { found, total, complete, items: [{ id, name, area, found }] }.
- **In the mall** (game/features/lostProperty.js, kind `lostProperty`, one map feature per item from config/lostFound.js): a model of a few boxes drawn 1.5x life size, wearing a yellow property tag that pulses so it can be told from litter; a quiet cue sound every 2.6 s within 9 m on the same floor, louder as you close in (four cue sounds by kind of item); a 0.6 s hold. An item you already have stays where it was, faded, with a still tag, no cue and no prompt.
- **The record** is the Survival Guide's (game/guideSave.js gained `found`; still version 1, an older record reads as nothing found). A pickup is written at once. Assisted runs log nothing and the prompt says so; nothing is logged after death. Nothing to replay after Save & Quit: a found item stays found.
- **Choosing the spots.** A scan listed reachable floor points with solid things on two sides; I picked one per area. A browser check then found two that could not be used: the balloon hung beside the Night Safe and the pager lay beside a wardrobe rack, and the other prompt won. Both moved, and Murray's flask moved away from a rack too. tests/lostFound.test.js now stands the player at each item and requires that the prompt offered is the item's own, as well as clear of colliders and within reach of somewhere walkable.
- **In the binder**: a third divider tab, Lost & Found. A found item's page shows its model as "Exhibit n", where it was found and its property tag; the summary page is sealed (with the count) until all eleven are logged, then it is a typed report signed by nobody. The preview can now show a prop as well as a zombie.
- Developer shortcut: `g.lostFound.debug('badge' | 'all', 'find' | 'clear')`.
- Not done: the items' spots were checked by test and five of them by eye in the browser (badge, bear, hand, coin, keys prompt); the other six were not looked at. The cue sounds were not heard (no audio in the pane).
- Shared files: maps/mall/mall.js (one import, one loop adding eleven features), game/createGame.js (the system, the feature context, the PA list), game/features/index.js (one kind), game/events.js, config/audio.js (five sounds), config/guide.js, ui/guide.js, ui/retail.css, game/guideSave.js, tests/guide.test.js, tests/guideScreen.test.js, docs. Branch claude/lost-and-found.
## 11 November 2026 - Weapon skins phase 8: challenges measured and tuned

- **tools/challengeReport.mjs** (`npm run sim:challenges`, ~38 min for 3 seeds x 6 guns to round 20 at 3 workers): the economy bot (new
  `onGame` hook) plays each gun it can use as its main gun; in the playing process every challenge's target is lifted, so the game's own
  counters show raw values. `--skill=sharp` aims every shot at the head; `--guns=` picks guns.
- **Tuned** (table in docs/weapon-skins-plan.md "Phase 8"): mastery 400 -> 1000 (Return to Sender 150 -> 300), Doorbuster 150 -> 400, Rush
  Order 40 -> 50, Double Shift 2 -> 4 bosses, Final Markdown only from round 9, Company Man round 15 -> 12, Gold Standard 20 -> 15. The
  tests read these targets from config now.
- **Not measurable by the bot:** the Confetti Cannon, Barcode Scanner, Leaf Blower, Tennis Ball Launcher and Return to Sender challenges
  (pellets, charge, cone, ball, instant kill), and every "survive" feat (its runs are immortal). Their numbers are first guesses.

## 11 November 2026 - Weapon skins phase 7: feats, glow treatments, the Challenges tab and tracker

- **Eleven feats** (slot 3; game/challenges.js, data in config/skins.js): a run on the Staple Gun alone to round 15 (buying, winning or firing
  another gun spoils it), a boss nothing but the Price Gun hurt, 40 Nail Gun kills in a round, a round from 12 on with every kill a Foam Dart
  Blaster headshot, a popped Mascot finished with one Confetti Cannon blast, 20 Rivet Rifle headshot kills in a row, two bosses in a run with the
  Heavy Coil Nailer, a round with 25+ Barcode Scanner shots and no miss, a round from 8 on unhurt with 10 attacks blown away by the Leaf Blower,
  three kills with one tennis ball, and the Last Customer returned with Return to Sender. A feat's progress is its best attempt (best(), never a
  sum: a replayed round cannot pay twice); round feats are decided as the next round is announced and void on a debug skip; run feats save
  their state with Save & Quit (save version 6).
- **New kill and hit facts** (nothing pays by them): the kill's `woundedBy` (every gun or source that hurt it) and `projectile` (the lethal
  ball's id; balls now have ids), and `weaponId` on a gun's 'hit'. Changed from the plan's guesses where they could not work (the plan's
  "As built in phase 7" note): the Leaf Blower does ~80 damage a tank, so its feat is about not being hurt; 60 Nail Gun kills a round needed
  round 23.
- **Treatments** (weapons/models/skinTreatments.js): pulse, edgeGlow, shimmer and drift light one palette role with emissive light from the
  model's own animate() (the viewmodel passes its clock; the locker preview animates its display). No lights, no meshes, no draw calls;
  shimmer is a 128-texel DataTexture band slid along UVs laid down the gun. A part that already glows (sights, the scanner's window) is
  never touched; every peak is at most 0.45 of full unlit colour, well under a build's unlit seam. Feat skins use the light bodies the rims
  allow (cream, brass, sale yellow, safety orange, pink, mint, sky, optic yellow).
- **Challenges tab and tracker** (the user's call: pin up to three on a new title-screen tab that can list other unlockables later; the
  tracker sits under the round box, shows for 4 s when a pinned one moves, strikes a lost attempt through with "Failed" and a soft sound,
  then drops it until its next attempt; a Settings › Comfort toggle, OFF by default). game/challengeCatalog.js (DOM-free list),
  game/challengePins.js (own storage key), ui/challengeBoard.js, ui/challengeTracker.js, config/challengeBoard.js.
- Seen in the browser (production build, hidden pane driven through the DOM): the board pins three and refuses a fourth; with the tracker
  on, a Staple Gun kill shows all three pins under the round box (the changed one edged yellow); a Rivet Rifle body shot strikes Gold
  Standard through with "Failed"; Gold Standard's band moves between frames; Rush Order's trims glow; the locker previews Grand Opening.
  Browser storage was left as found (empty).
## 11 November 2026 - Closing Time phase 11: measure and tune

- Built sim:closing on the economy bot and SENSIBLE plan, with real purchases/keys/duties/validation/return/van and a four-process ceiling. Developer-only policy numbers live in config/closingTimeSim.js. Captured random functions now switch to the seed after map construction; the caller RNG is restored.
- Measured 322 attempts across all sixteen mode/life/skill/purchase conditions, with at least twenty completed samples at every immortal overtime index. Retained overtime fan-targeting stalls and added consecutive seeds rather than hiding failed attempts. All mortal runs died before the finale; immortal lethal exposure is reported separately.
- No gameplay tuning values changed: required spending is light, the Returns ammo route absorbs overtime income, and bot mortality/targeting limits do not establish a human fight-feel problem. The report gives current/candidate/applied values and open questions. No round gate or new duties.
- Evidence and complete tables: the phase 11 report and its per-seed data (removed on 11 November 2026: out of date after the Return quest; rerun `npm run sim:closing`). Teleported journeys/hand approach, Classic discovery, fan targeting, fun, readability and fight feel are explicit limits.
- Validation: final npm run balance, npm run sim:economy -- --quick --workers=4, npm test (one full run) and npm run build all passed. Focused economy/tool, Closing Time and overtime tests passed while iterating.
- Shared edits: tools/economyBot.js, tools/economySim.mjs, package.json, tests/economySim.test.js and docs. Added two quest tools and developer-only config. Gameplay systems and gameplay balance config are unchanged. Work remains on claude/closing-time-11; no merge into main.

## 11 November 2026 - Closing Time phases 7-10 integration

- Integrated `claude/closing-time-9`, including phase 7 parking validation and phase 8's booked Last Customer, with current main. The history conflict preserves both the weapon-skin rules and phase 9 entries.
- Copied phase 10's pending overtime implementation into `codex/closing-time-integration`; the original `closing-time-10` worktree is untouched. Reconciled its Closing Time wiring with validation and the final boss, and adapted the overtime fixtures to those prerequisites.
- The plan now marks phases 1-10 built; phases 11-12 remain planned. Harder overtime has its own documented `tests/overtime.test.js`, covering normal and pending-win state, health compounding, kill pay, Clock out, save/load and Play again.
- Validation on the combined code: 81 focused tests passed; full `npm test` passed 1,438/1,438 with no failures or skips at four files at a time; `npm run build` and `npm run balance` passed. Browser checks were not repeated; phase 9's original entry records its production-preview checks.
- The quick economy baseline completed four runs to round 10 on one worker (`npm run sim:economy -- --quick --set=baseline --workers=1`). Its bot does not do the quest or reach overtime; quest balance measurement remains phase 11.
- Shared changes include `mall.js`, `economy.js`, `createGame.js`, `bossDirector.js`, `closingTime.js`, `zombieManager.js`, interactions, the feature registry, weapon handling, tests and docs. `CLAUDE.md` and `shutters.js` are unchanged.
## 11 November 2026 - Hazards: their own switches, readable effects, the sprinkler pull moved, a stand-clear grace

- **Switch models** (game/features/hazardSwitches.js, numbers in config/hazards.js): the fountain keeps its breaker box; the fryer has a gas-line valve on a riser pipe whose red handwheel spins while it vents, with an oil gauge whose needle swings into the red; the sprinklers a red pull station with a horn/strobe above (the handle stays pulled); the PA Lure a paging panel with an ALL CALL button that presses in, a speaker grille, a gooseneck mic and an ON AIR lamp. Every switch shows a status lamp (green ready, a slow 2 Hz blink while active, amber while recharging) and a strip that runs down while active and refills over the cooldown. Still parts are merged by material: the four switches plus the always-there sprinkler heads and speaker horn are 43 meshes, against 68 for the four old breaker boxes.
- **Looks**: the fryer's slick is dark glossy oil (it was faint amber on the warm tiles) with a bright gold rim, bubbles that swell and pop on it, boiling vats and steam puffs each pulse. The sprinklers have ten ceiling heads that are always there (cyan while spraying), a cone of falling drops under each and splash rings where they land. The PA Lure's speaker horn is always on the ceiling and its mouth glows on air; sound waves run out along the floor to its real 10 m reach (under the walls into the Hallway and Food Court, as the hold does); a red sale tag (two crossed, so never edge-on) spins over every shopper it holds. Bubbles, drops, splashes and tags are one instanced mesh each. No lights.
- **Bug: every hazard flash ignored its size.** `effects.flash` takes `{ size, seconds }`, the hazards passed two plain numbers, so every flash was the default 1.2 m and the config's flash sizes did nothing. Fixed; the sizes that would now look wrong were set to what reads in the browser (fryer nozzles 0.5 m, as one sits just behind the valve; sprinkler streak ends 0.8; PA speaker 0.55, the corridor ceiling cut a bigger ball in half; the PA pop 1.2; the fountain spout 1.4).
- **Point 3, the sprinkler pull** moved from x -3.9 (0.4 m from the Food Court gate, whose prompt it took over the gate's west 1.5 m) to (-6.6, 1.25), between Kiosk Kevin's cart and the planter, under the Caution: Wet Floor notice: out of reach (2.5 m) from anywhere along the gate. The small red fire pull decal by the gate stays as decoration. Test: walking the whole closed gate never shows the sprinkler prompt.
- **Stand clear**: every switch stands inside its own zone, so for `playerGraceSeconds` (1 s) after the fountain or fryer is thrown it neither hurts nor slows the player (time to step out); zombies are hit from the first pulse. Player damage numbers are unchanged (standing in the fountain after the grace is about 105 damage over 7 s: close to a 100-health player's whole bar). Tests: the grace, and the existing player-damage, reset and Second Chance tests now wait it out.
- **Point 5, the rest**: the inline animation numbers in the four feature files are in config/hazards.js (shimmer speeds, opacities, the fountain's glow model, floor layer heights); docs/hazards-plan.md moved to docs/archive/ with an "After the review" section, every reference updated.
- Seen in the browser (production build; the pane was hidden, so frames were read from the canvas): the fountain switch and the fountain running, the fryer running and its valve, the pull station, the sprinklers running, the PA Lure running with its tags. Not seen after the last tweaks: the paging panel close up and the PA Lure with the smaller horn and speaker flash (the hidden page stopped loading). A hidden pane's frame times mean nothing; one first tick after a reload took 15 s there, every later one 2-3 ms (headless: 2 ms).

## 11 November 2026 - Hazards review: phases 2 to 4 merged over main, one fix, five questions open

- **Merged** antigravity/hazards-2, -3 and -4 (Fryer Blast, Fire Sprinklers, PA System Lure) into claude/hazards-review one at a time, over a main 36 commits newer than their base. Conflicts only in docs/history.md, docs/tests.md and config/save.js: the save version is 7 (main's 4, then one per hazard; each branch had bumped its own copy from 2).
- **Fixed:** the hazard framework wrote `stats.surfaceSpeed` itself and set it back to 1 when a hazard ended, which game/surfaceSlows.js forbids. Each hazard now reports its slow as `hazard:<id>` through `ctx.surfaces` (added to the features context in createGame.js), so it never overwrites or wipes a boss wet floor or a melt. New test in tests/hazards.test.js. Today the harm was small (other sources report every tick and repaired it a tick later), so this is a rule fix more than a visible bug.
- **Measured, headless, not changed (the plan's decisions):** one activation of the Electrified Fountain or the Fire Sprinklers killed Mopwater Murray and Dennis Fairweather outright (player standing just outside the zone, the boss walking through it); the Fryer took 50-60% of their health, the PA Lure 10%. The per-pulse cap holds, but the fountain fires 21 pulses at 10%. A normal zombie dies in 0.4 s in the fountain, 1.0 s in the fryer and 1.5 s under the sprinklers at ANY round (the plan's flat fryer, sprinkler and pop numbers never kill after about round 6; the branches used the round-proof formula from the plan's "Assumed" section instead and rewrote the table to match). The sprinkler switch is 0.4 m from the Food Court gate's west edge and takes the gate's prompt over its west 1.5 m. The PA Lure's 10 m radius holds zombies in the Main Hallway and the Food Court through the walls, where nothing is drawn.
- Seen in the browser (production build, vite preview): all four switches, prompts and effects. The fountain ring and the frozen-pink soaked zombies read well; the fryer's amber apron is faint on the warm tiles (its gold border shows); the PA Lure draws only a small ring round the beacon. Browser storage was empty before and after.
- Shared files: game/createGame.js (one word in the features context), game/surfaceSlows.js (comment), game/features/hazards.js, game/features/index.js (comment), config/save.js (merge), CLAUDE.md (hazard status lines), tests/hazards.test.js, docs. Branch claude/hazards-review.

## 11 November 2026 - Weapon skins: two rules settled after phase 6 (dark rims, prints on the left face)

- **Why:** phase 6 found that the 2:1 contrast floor between a skin body and every stuffing and warranty tier caps every body at luminance 0.0585 (no cream, yellow or orange skin was possible), and that prints kept to the top and right faces barely show in your hands, because a gun held on the right only ever shows its left face and top. Lowering the floor does not help (1.5:1 still caps it at 0.095), and a hue-difference rule does not either (the six stuffings cover the whole colour wheel). The user chose a rim and a left-face print with gaps.
- **Rims** (config/gunStyle.js `rim`: width 2.5 mm, the stitches' ink 0x1d1626): a thin dark edge round the build patch (four bars added as instances of the stitch mesh: no draw call), the warranty tag (merged into its print bar: no draw call; the bar takes the rim ink, which is nearly the old 0x2a2231) and each warranty collar (one merged `warrantyRim` mesh per tier, just inside the metal and a little longer, so a dark band shows at both ends: one draw call while a collar shows). The warranty seal already had a dark printed border; the loaner tag sits on the top mount. Every built or warrantied gun looks slightly different now, skinned or not.
- **The contrast rule** (tests/skinEquipment.test.js): a body passes against a stuffing or tier colour if it contrasts 2:1 with it directly OR with the rim ink, which itself contrasts with all ten. Today's 22 dark skins pass the first way; light bodies now pass the second (a cream 0xf3e3b8 is in the test as the example). No skin was recoloured in this change.
- **Left-face prints** (weapons/models/skinPattern.js, config/skins.js `skinPatterns.keepOut`): the canvas is now 512 x 1024, an upper region for top and right faces and a lower one for left faces. Round the sticker mount (the build patch and the warranty seal) a 72 x 52 mm keep-out is painted back to the body colour after the print. The layout is anchored on the sticker mount, so the gun in hand and its locker or conveyor display share one texture (the Price Gun and Confetti Cannon hand models carry body-coloured reload props, which moved the body's centre). A display borrows its gun's mounts from one default model build per gun. Still one material and no added draw call; the texture doubles to about 2.8 MB of GPU memory per worn pattern skin.
- Seen in the browser (production build): the Staple Gun's ruled lines and the Foam Dart Blaster's dots now run along the side you hold; a side render of the Foam Dart Blaster shows a cream Popcorn Butter patch framed by its dark rim on the dotted body; a Platinum tag shows its dark frame. Browser storage untouched.
- Full suite 1403/1403, build clean, balance report byte-identical. Shared files: config/gunStyle.js, config/skins.js, weapons/models/buildVisual.js, warrantyTrim.js, skinPattern.js, index.js, tests/gunStyle.test.js, tests/skinEquipment.test.js, tests/skinPatterns.test.js, docs. Branch claude/skins-rules.

## 11 November 2026 - Closing Time phase 9: the return and Returns Desk

- Lorraine stops at 1 health and becomes Speechless for 6 s. Return her with one Return to Sender beam or a 1.5 s hand stamp; either uses the existing box/stamp feedback and normal kill event. Missing the window restores 25%. Her beam share is 3% instead of the ordinary boss 12%; no other gun stats changed. Both finishes carry the weapon ID for skins; beams keep their distance.
- The Returns Desk on the hallway north wall east of Customer Service sells the gun after duties 1–3 for 10,000 and its half-rate refill for 2,500 without a duty gate. Both use pricing and discounts. RESTOCK-O-MATICs and the Prize Counter redirect its ammo buyers; free refills are unchanged. Real prompt tests keep the desk, safe, service windows and Prize Counter separate. The hand stamp wins over the van and held reload.
- Save version 5 appends the desk feature. A purchased gun/ammo uses the existing gun save step; Speechless and its hand prompt remain transient. The booked boss still survives a round-start save/load. Reset clears the encounter and its prompt.
- Balance: Platinum Rivet Rifle bar times at rounds 16/18/20 remain 16.4/18.9/21.9 s. Base Return to Sender needs 34 beams to Speechless, then a return. Claw odds are unchanged; valuing its copy at the guaranteed 10,000 desk price changes the 1,000-point grab's 3-in-4 first value/price from 1.52 to 1.66, timed from 1.67 to 1.85, whole-site value/point from 1.50 to 1.62. Details and shared files: [phase 9 report](closing-time-9-report.md).
- Validation: focused Closing Time, save, refill, boss and coplanar checks passed; production build passed. Isolated production-preview Edge/SwiftShader verified the desk, refill redirection, Speechless HUD, hand return beside the van with reload held and SHIFT COMPLETE, without game exceptions. Preview stopped. Final npm suite: 1,430/1,430 passed, zero failures or skips, across 158 files at four at a time (281 s testing; 338 s including the shared-lock wait).
- Main's committed weapon skins and capped/locked npm test runner were merged into this worktree. All tests use npm; the final run waits for other large runs. Shared changes include config/economy/save, mall.js, createGame, bossDirector, interactions, feature registry/ammo/prize, gunStats/playerGun, zombie/manager, HUD, existing tests and docs. No main checkout edits.

## 11 November 2026 - Closing Time phase 10: harder overtime

- **Health.** Every zombie and boss spawned in overtime has its health x `closingTime.overtime.healthPerRound` (1.03) compounded per overtime round,
  on top of the normal round scaling. The first overtime round is x1.03 (n = rounds.round - overtimeFrom + 1), so a loaded overtime run needs no counter of its own:
  `g.closing.healthMultiplier` is worked out from the saved `overtimeFrom`. The zombie manager got one option, `getHealthMultiplier`, read in `spawn()` (it multiplies a
  summoned fan's own fraction). Counts, spawn pace and the alive cap are untouched.
- **Pay.** On 'overtimeStart' (only), `stats.killPayMultiplier *= overtime.killPay` (1.25): it stacks with the Gold Card (1.1 x 1.25 = 1.375) and Play again's stats reset removes it.
  A load restores the saved stats as they are and never applies it again; tests/overtime.test.js checks a save in overtime round 3 comes back with the same pay.
- **Shopper health, win at round 15 (first overtime round 16):** overtime round 1 (round 16) 1,281 vs 1,244 normal; round 5 (round 20) 1,927 vs 1,662; round 10 (round 25) 3,207 vs 2,386.
- Shared files: createGame.js, zombies/zombieManager.js, config/closingTime.js, game/closingTime.js, docs. New: tests/overtime.test.js.
## 11 November 2026 - Kiosk Kevin, phase 7: sales, vouchers and balance

Phase 7 of docs/kiosk-kevin-plan.md, built on `claude/kiosk-kevin-7`: cut from `claude/kiosk-kevin-6` (phases 4 to 6) with main merged in
(pattern skins, the test runner's cap and lock). Save version 5: main's 4 (challenge counters) and this branch's 4 (Kevin's carts and the
skins) are different shapes, so both together are a new number.

- **`npm run kiosk`** (tools/kioskReport.mjs; its maths in tools/kioskBalance.js, read straight from config and the game's own functions):
  equipment power by round, Soda Bomb share and kill radius by round and zombie type, the Sparkler Cake's burn, the Sentry against the
  Price Gun, Bubble Wrap hits to death, damage per point against wall ammo, and every price as a share of what a round pays (the good
  bot's measured income, copied from docs/economy-report.md section 2 as ROUND_INCOME).
- **The bar it set** (tests/kioskBalance.test.js): no must-buy at round 2 = each product costs at least 40% of what round 2 pays (904),
  and no pocket thrown into crowds of four deals more per point than the Price Gun's own wall ammo at any round; the Soda Bomb at round
  25 = 40 to 60% of a Shopper at the centre, a Shopper's worth from a crowd, a pocket at most 5% of the round; Bubble Wrap = a full wrap
  absorbs less than the player's health and less than doubles Shopper hits to death (the maths is checked against the real health).
- **What changed from it:** the **Soda Bomb 300 -> 500** (300 was 33% of round 2, and past round 10 a pocket into crowds dealt more per
  point than Rivet Rifle ammo: 20.8 against 18.2 at round 15, 27.2 at round 25; now 12.5 and 16.3). **A Bubble Wrap layer 40 -> 30**: a
  full wrap absorbed 120% of your health and took Shopper hits to death from 3 to 6, exactly double; now 90% and 3 to 5. Mascot hits (50)
  and a Cart Pusher's charge (60) still go 2 to 4: whole hits are lumpy, and holding those under double would need a layer of about 15.
  The two armour numbers moved from player/stats.js into config/kiosk.js bubbleWrap (layerStrength, maxLayers). Everything else stays:
  Bubble Wrap and the Air Horn 500, the Sparkler Cake 400 (44% of round 2; a throw takes about what a Soda Bomb's does), the Glitter Bomb
  750, the Sentry 1,500 (166% of round 2; 13% of round 25; 0.42x a Price Gun's dps at round 2, level with it at round 25). The exponent
  0.37 stays: the Soda Bomb's centre is 53% of a Shopper at round 25, inside the plan's 40 to 60%.
- **Not done:** prices that climb with the round (the economy report's other option). At round 25 a Soda Bomb pocket is 4% of the round;
  what limits Kevin late is the pocket (one kind, 1 to 3 charges) and walking back to his cart, which moves every round.
- **Flash Sale and vouchers.** The 'kiosk' Flash Sale group and its eligibility (only while his cart is open and he is not ducking)
  came with phase 3; this phase adds the checks: no Kevin sale in round 1 or while his site is behind the locked start shutter, prices
  back on the shelf when it ends; the Discount Code takes 750 off a Sentry and is spent by that one purchase (one Sentry, never the Pick);
  the Master Key and Signed Approval never apply. Purchases spend the voucher through the 'purchase' event (kind 'kiosk'), as before.
- **The economy bot buys from Kevin** (tools/economyBot.js): a `{ type: 'kiosk', share, products }` step is a standing order. From that
  point on, every break, after the buy order, it spends up to `share` of the points in hand at his cart in the order's preference (a
  pocket still holding another product is left alone), and in a fight it throws: a lethal at the zombie it aims at when two more stand
  within 3.5 m of it, the Sentry when four are up and one is within 14 m, the Air Horn when two are within 4 m, the Glitter Bomb like a
  lethal. The KIOSK buy order (tools/economyPlans.js) is SENSIBLE with Kevin from the moment the shutter is open, half of what is in hand.
  economySim.mjs plays it as the 'kiosk' run set (immortal and mortal), with a table by round (spent at Kevin, thrown, equipment kills,
  Bubble Wrap absorbed, deaths beside SENSIBLE), income and time with and without him, and when the power purchases land.
- **`npm run sim:economy -- --quick`, before and after** (4 workers; 80 runs each; all finished; too few seeds to quote, as the tool says):

  | | Before (Soda 300, layer 40) | After (Soda 500, layer 30) |
  |---|---|---|
  | KIOSK: spent at Kevin, rounds 1-10 (a run) | 2,600 | 950 |
  | KIOSK: bought a run | Bubble Wrap 4.5, Sparkler Cake 0.5, Soda Bomb 0.5 | Bubble Wrap 1.5, Sparkler Cake 0.5 |
  | KIOSK: earned by round 10 / SENSIBLE | 22,495 / 24,550 | 22,070 / 22,395 |
  | KIOSK: first build, first Premium (round) | 7.5, 8.5 | 7.0, 8.0 (SENSIBLE: 7, 8 both times) |
  | KIOSK mortal (4 runs): died in round, mean; reached 10 | 9.0; 50% | 10.5; 100% |
  | SENSIBLE mortal good (4 runs): died in round, mean; reached 10 | 8.8; 50% | 9.0; 75% |

  SENSIBLE never buys from Kevin, so its rows moving (24,550 to 22,395 by round 10) is the sim's run-to-run noise (docs/economy-report.md
  section 1), and so is most of the mortal rows. What the change does show: at 300 the bot's leftover half-bank bought from Kevin most
  breaks from round 5 and its first build came half a round later; at 500 it bought from him about a third as often and lost nothing on the
  route. Neither run shows Kevin as a must-buy: with him the one-life runs did no worse, and four seeds cannot say better.
- **Browser check** (production build, vite preview of the worktree): at round 2 in the Hallway the cart's prompt read "Kevin's Pick ·
  Soda Bomb" at 500; holding F paid 500 for four bombs (the Pick), then 500 for one Bubble Wrap layer of 30 (one segment on the HUD); a
  Flash Sale started on Kevin's cart (40% off) and the wrap's prompt showed 500 crossed to 300. No console errors; browser storage left empty.
- **Tests:** test:quick picked all 161 files (the full suite): 1,429 passed. Build clean.
- **Not checked:** a full (non-quick) sim; playing Kevin's products by hand for feel.
- New: tools/kioskBalance.js, tools/kioskReport.mjs, tests/kioskBalance.test.js. Shared files changed: src/config/economy.js (economy.kiosk),
  src/config/save.js (the merge), src/player/stats.js, src/config/kiosk.js, package.json (`kiosk`), CLAUDE.md (the command),
  tools/economyBot.js, tools/economyPlans.js, tools/economySim.mjs, tests/kiosk.test.js, docs (plan, economy report, folder-structure, tests).

## 11 November 2026 - One big test run at a time, and AGENTS.md / GEMINI.md

- **The lock.** A test run of more than 8 files (npm test, or a big test:quick selection) takes a lock file in the system temp folder
  (`sunset-galleria-tests.lock`), which every worktree and every tool on the PC shares. A second big run waits and says whose run it is
  waiting for ("Waiting for the run from closing-time-7 (pid ..., 157 files, started 14:05)"). Runs of 8 files or fewer never wait, so
  fixing one failure never queues. A lock whose process is gone (a run killed by an agent's timeout) or that is over 30 minutes old is
  taken over. Checked for real: two 9-file runs started together, the second waited 2 s and then ran; the lock file was gone after.
- **AGENTS.md (Codex) and GEMINI.md (Gemini, Antigravity)** point those tools at CLAUDE.md, which they did not read before, and repeat
  the testing rules: only through npm, never a bare `node --test` on many files, rerun only the failing file while fixing, the full suite
  once at the end, long timeouts for a run that waits. CLAUDE.md gained the same habits as one rule.
- Until a worktree merges or rebases on main it still has the old runner; the lock only counts runs made through the new one.
- Shared files: tools/runTests.mjs, tools/testQuick.mjs, CLAUDE.md, AGENTS.md (new), GEMINI.md (new), docs.

## 11 November 2026 - The test runner caps how many test files run at once

- **Why: the PC froze while agents worked.** The machine has 16 GB of RAM. `node --test` runs one file per CPU thread minus one (19 here),
  and 125 of the 157 test files build the whole mall headless, at 500-600 MB a process (a file that builds no map: ~60 MB). One full run
  peaked at 9.3 GB and left 16 MB of RAM free; about 100 full runs were made by Claude Code and Codex sessions on 10-11 November, often at
  the same time as each other, so Windows swapped to disk for minutes at a time.
- **Now:** `npm test` is `node tools/runTests.mjs`: the same files, at most 4 at once (`MALL_TEST_JOBS=n` for another cap).
  `npm test -- tests/x.test.js` runs only those files, at the cap. test:quick runs its selection through the same runner. CLAUDE.md says
  to test through npm, never with a bare `node --test` on many files.
- **Measured (4 at once):** 1316/1316 in 277 s, peak 4.1 GB for the run's processes, lowest free RAM 1.3 GB, with Claude, Codex and
  Antigravity open. Uncapped it was 199 s but swapping the whole machine. 6 and 8 at once were not measured.
- Not done yet (proposed): a lock so two full runs never overlap, and AGENTS.md / GEMINI.md pointers so Codex and Gemini read CLAUDE.md.
- Shared files: package.json, tools/testQuick.mjs, CLAUDE.md (Commands), docs.

## 11 November 2026 - Weapon skins phase 6: role challenges and pattern skins

- **Eleven role challenges (slot 2), set from `npm run balance`, not from the plan's first guesses.** Staple Gun 100 headshot kills (the plan's "from round 10" dropped: a round-10 head kill takes 14 staples, more than a magazine). Price Gun 150 kills it drew first blood on and finished within 1 s ("full health" alone is nearly every kill). Nail Gun 25 magazines of 10+ nails with every nail hitting (kept). Foam Dart Blaster 150 kills from 15 m (kept). Confetti Cannon 40 blasts that kill 3+ (4 was impossible past round 3: a blast deals at most ~1260). Rivet Rifle 150 headshot kills from 10 m (its role is medium range). Heavy Coil Nailer 100 Mascot or Cart Pusher kills (50 was about one run). Barcode Scanner 40 beams that kill 2+ (its job is the pierce, not Mall Walkers). Leaf Blower 100 zombies blown out of an attack (hazards, ledge drops and zombie-on-zombie pushes cannot be counted today). Tennis Ball Launcher 60 kills by a ball that had bounced (kept). Return to Sender 5 bosses finished by a beam (one beam per boss was trivial). The claw-only three are marked `needs: ['claw']`.
- **Event fields, no payout or stat reads them:** 'kill' gained `distance` (metres the lethal shot travelled; a ball's whole flight), `bounces` (a ball's bounces before the lethal hit) and `firstWound` `{ weaponId, seconds }`; a cone shot's hits gained `interrupted`. zombie.js records them; `isAttacking` names the attack states. The scripted fight in tests/killAttribution.test.js is unchanged.
- **Counters are data:** each challenge has a `kind` (a counter in game/challenges.js), its numbers and its own locker sentence (`text`, filled by `challengeText`). Every amount goes through the existing advance path, so the Save & Quit replay rule, assisted, post-death and noRewards rules hold. The Nail Gun's magazine in progress is per-run state: reset on Play again, saved with the run (save version 4), back after Continue. The role unlock PA reads "performance review passed".
- **Eleven pattern skins**, one commit each: Interoffice (violet, ruled memo lines with a pink margin), Doorbuster (crimson, "% OFF" / "SALE" in Anton), Measure Twice (cobalt blueprint grid), Aisle Fifteen (teal, aqua halftone dots), Party Size (berry, seeded confetti), Hard Hat Area (rust, yellow hazard tape), Loading Dock (forklift green, diamond tread), Express Lane (azure, white checker), Lawn & Garden (moss, cream gingham), Country Club (royal purple, green argyle), Handle With Care (oxblood, "FRAGILE" / "THIS WAY UP" in Bebas Neue). No new font.
- **The contrast floor allows no light body.** At 2:1 against all six stuffings and four tiers, a body's luminance must be at most 0.0585 (the darkest, the Standard tier, is 0.167; the lightest, Popcorn Butter, 0.882, leaves no room above). Cream, yellow, orange or mid-tone bodies fail for every gun. So the pattern skins are deep SATURATED colours (saturation 0.86 to 1.00, luminance 0.038 to 0.055, lowest ratio 2.065:1) with a pale print, against the mastery skins' muted 0.15 to 0.65.
- **How the print works** (weapons/models/skinPattern.js, numbers in config/skins.js `skinPatterns`): after a skinned build, every body-coloured, untextured material is swapped for ONE patterned clone, so the gun draws the same meshes: draw calls measured in the browser are identical for default, mastery and pattern on all eleven guns (Rivet Rifle 37 / 37 / 37). Cost per skin: one 512 x 512 canvas texture made on first wear and shared (about 1.4 MB of GPU memory with mipmaps), one material, and unshared non-indexed copies of the body geometries. Body UVs are rewritten in the gun's frame: faces pointing up or right (and not leaning left) take the print, every other face samples a strip painted the body colour. The brand label is its own textured mesh and stays on top. The locker's preview release skips the shared texture. Node has no canvas, so nothing is printed in headless tests unless they stub one.
- **Seen by hand** (production build, vite preview of a copy of dist, 1440 x 900): every gun in hand in its pattern skin, then with a build (Fryer Oil, Neon Tube, Antifreeze, Smoothie, Glitter, Popcorn Butter). The patch sits on the plain left face every time. The print reads clearly in hand on the Foam Dart Blaster, Rivet Rifle, Barcode Scanner, Tennis Ball Launcher and Return to Sender. On the Staple Gun, Confetti Cannon and Leaf Blower the visible top is mostly other parts, so the print shows mainly in the locker preview (a right-handed viewmodel never shows its right face). Earned by play with a scripted player (aim at the nearest visible head, no debug command, unassisted): Interoffice in 6 to 8.5 minutes over three runs that died in rounds 2 to 5 (100 headshots of 147 Staple kills); Measure Twice after 6 min 10 s of Nail Gun play, rounds 4 to 10, 25 clean of 41 magazines emptied, with perfect aim. The Nail Gun was bought with earned points (shutter 500, gun 1000) via a teleport to the wall; the Staple Gun was refilled for free when dry. Browser storage was empty before and is empty after.
- Full suite 1395/1395 (79 new tests over main's 1316; three existing tests updated for the second skin per gun and the blank magazine in the run snapshot). Build clean (319 modules). Balance output byte-identical to main. Shared files: config/skins.js, config/save.js, game/challenges.js, game/createGame.js (the kill payload), game/events.js, zombies/zombie.js, weapons/playerGun.js, weapons/ballistics.js, weapons/models/index.js, ui/locker.js, tests/challenges.test.js, tests/locker.test.js, tests/skinEquipment.test.js, docs. New: weapons/models/skinPattern.js, tests/roleChallenges.test.js, tests/skinPatterns.test.js. Branch claude/skins-6.
## 11 November 2026 - The Survival Guide gains the Last Customer's page (found by the merge)

- Merging the guide into main after Closing Time phases 7 to 10 failed two guide tests: Lorraine Pruitt, the fifth boss, had no page. The "every boss has exactly one page" test did its job. She now has one (14 pages): booked by the checklist, so it says "First appears: Closing Time"; the notes cover the charge, the Mall Walker backup and that damage alone does not finish her; the tip is the return (Return to Sender or the hand stamp while Speechless). Her model is still the phase 8 placeholder, so her photo will change when the real one lands.

## 11 November 2026 - The Survival Guide gets its own look: a ring binder with a survivor's handwriting

- **Why.** The first version was the weapon locker's card with different words. The user asked for a look unlike every other menu.
- **The idea: two voices.** The staff memo is the company's printed page (serif, letterhead, form number). The field notes are a survivor's blue pen over the top of it (Caveat), with tally marks for kills. The tip is a yellow sticky note headed in marker (Permanent Marker). So a page visibly gets more lived-in as it fills: a fresh one looks like HR printed it yesterday. The notes were reworded into the first person to match (numbers still read from config).
- **The object.** A vinyl binder with stitching and a paper label; divider tabs for Customers and Management; one sheet on three rings with a coffee ring and a dog-eared corner. The model is a security-camera still (CAM number, scanlines) in a Polaroid: taped on for customers, paper-clipped for a boss, whose sheet is a "Personnel file" with one extra line (Employment status: Ongoing, regrettably). A rubber stamp says how far the page has got (Sighted, Documented, Resolved). An unseen page is a blank form with "No report filed" and NO SIGNAL on the camera.
- **Turning a page** flicks the sheet (0.22 s, off under prefers-reduced-motion) and plays a new synthesised sound, `pageTurn` (config/audio.js), through the screen's `onTurn` callback. It fires only when a different page is shown.
- No new fonts: Caveat, Permanent Marker, Fraunces and Playfair Display were already loaded for signs. Readable sizes follow the Text size setting (`--ui-text-scale`). There is no setting that swaps handwriting for plain type; the handwriting is set large (21 px) instead.
- Not changed: the record, the counters and their tests. tests/guideScreen.test.js gained three tests and one updated (new wording for "how many more").
- A note for browser checks: in a HIDDEN pane, after several reloads of the same tab, opening the guide (or the locker: both make a WebGL context) could block for over 45 s. A fresh tab opened it in under half a second. It was the tab, not the code.
- Shared files: config/audio.js (one sound), main.js (two lines), ui/retail.css (the guide block only), docs.

## 10 November 2026 - The Staff Survival Guide: a log of every zombie type and boss

- **What it is.** A book off the title screen ("Survival guide", under the weapon locker) with a page for each of the nine customers (Shopper, Mall Walker, Cart Pusher, Mannequin, the four Mascot costumes, the gold Employee of the Month) and the four bosses. A page appears when its subject is first seen and fills in by kills across all shifts: the staff memo at once, the field notes at `notesAt` kills, the tip at `tipAt` (Shopper 50 / 500 down to a boss's 1 / 3). Unseen pages are "???" with no model. Nothing in it pays anything.
- **Decisions (the user's, 10 November):** no gameplay bonus for pages; assisted runs do not count (the skins rule); no gun or wardrobe pages (the locker covers guns); collectibles are a later step with fixed spots, one per area.
- **The text cannot drift from the game.** Every number a page quotes (health against a Shopper, first round, speeds, timings, thresholds) is read in config/guide.js from the config it describes. Only the jokes and the advice are hand-written.
- **Counting** (game/guide.js) listens to 'kill' and to the four arrival events ('typeIntro', 'mascotVariantIntro', 'mascotGold', 'bossSpawn'). Fans (noRewards), assisted runs and anything after death count for nothing. A gold Mascot is filed on its own page, never its costume's. A page gaining a paragraph mid-shift fires 'guideEntry' with a PA line; a first sighting fires it silently (the type's own intro banner is already playing).
- **The record** (game/guideSave.js) is its own localStorage key, `sunsetGalleria.guide`, version 1, with the lessons of the skins review built in from the start: written on a new paragraph, a death, Save & Quit, Quit to title, Restart and `pagehide`, never per kill and never when nothing is new; a round replayed after Save & Quit is counted once (the same `credited` rule as game/challenges.js, kept as a separate copy so neither record depends on the other).
- **The screen** (ui/guide.js) follows the locker: plain DOM, its own small WebGL preview made on open and freed on close. The preview is the real Zombie with its real model, walking on the spot. ui/screens.js now treats the locker and the guide alike (`books`).
- Developer shortcut: `g.guide.debug('mallWalker', 'add', 25)`, `'see'`, `'complete'`, `'clear'` (not in g.debug.run, to keep out of game/debugCommands.js while skins phase 6 is open).
- Shared files: game/createGame.js (the system, one reset step, one transient step, the PA list), game/events.js (one event), main.js, ui/screens.js, ui/hud.js, ui/retail.css, docs. Branch claude/survival-guide.

## 10 November 2026 - Kiosk Kevin, phase 6: the SPIN-O-MATIC Sentry

Phase 6 of docs/kiosk-kevin-plan.md, built on `claude/kiosk-kevin-6`: cut from `claude/kiosk-kevin-5` (phases 4 and 5) with main merged
in (weapon skins), so the Sentry's kills can carry their weaponId.

- **The merge.** Main's weapon skins gave `applyBurn` and `applyConfusion` a fourth argument, `weaponId`; phase 5 had given them
  `source`. They now take both: `(..., weaponId = null, source = 'build')`; the burn keeps both from whichever burn supplies the
  damage. The Glitter Bomb and Sparkler Cake pass `(null, 'equipment')`. config/save.js version 4: main and the kiosk branch had each
  bumped it to 3 for different changes.
- **The Sentry** (game/equipment/sentry.js, config/kiosk.js products.sentry): Lethal, 1 charge, 1,500. Thrown like the rest; where it
  first touches the floor (or stops) it stands up ('sentryDeployed'), and for 30 s fires every 0.2 s at the nearest zombie within 15 m
  that it can see from its muzzle (0.95 m up): a clear line from the muzzle to the zombie's body, never Sunny, dummies, the dead or a
  rising zombie. The shot is the hitscan (castShot) from its own muzzle against zombies only, so Sunny can't soak one up. Each shot is
  a body hit of 58 x equipmentPower(round) (a Price Gun sticker, at under half a held Price Gun's rate; it can't aim, so no headshot
  pay or helmet bonus), source 'equipment', weaponId 'sentry'; bosses are hit normally. It looks for a target only when it's ready to
  fire, so the line-of-sight rays stay cheap. Then it falls apart ('sentryExpired'). One out at a time: a second throw is refused
  and keeps its charge. No collider (zombies walk through it; nothing can target it). It stops when paused or dead (the equipment
  tick doesn't run) and death and Play again clear it. Save & Quit drops it: thrown things are transient; the pockets come back as of
  the round's start.
- **Selling it (the user's choices):** the Lethal slot rotates Soda Bomb, Sparkler Cake, Sentry, and Kevin's Pick is now the product
  on sale that has waited longest for it (never the Sentry: `noPick`), because the Lethal slot's three-round cycle would otherwise
  line up with the Pick's and lock it onto the Soda Bomb. Rounds 2 to 7: Pick Soda Bomb, Sparkler Cake, Bubble Wrap (the Sentry's
  round), Glitter Bomb, Stadium Air Horn, Bubble Wrap.
- **View and HUD:** fx/throwableView.js draws a display stand with a staple gun whose head turns to its target (spinning while it
  hunts); a pocket icon. Phase 8 does the real model.
- **Checked:** tests/sentry.test.js (6 new tests), tests/saveGame.test.js (a save with a Sentry out loads without one), tests/kiosk.test.js
  (the purchase test buys all six). In the browser (worktree build): thrown with G in the Hallway it landed and stood up by the Food
  Court gate; three Shoppers in front of it took 43.6 a shot (58 x the round-4 power) and died, each kill 'equipment' / 'sentry' and
  paid its 60 only; Shoppers behind the shut Food Court shutter were never shot; no console errors. The Sparkler Cake's boss test now compares the burn ticks as dealt: after the merge the guard's
  own damage multiplier changes during the test, which made the health-lost ratio drift (the burn itself was still exactly half).
- Shared files changed: src/zombies/zombie.js and src/zombies/confusion.js (merge), src/config/save.js, src/config/economy.js (the
  Sentry's price), src/game/events.js ('sentryDeployed', 'sentryExpired'), src/ui/retail.css, docs (folder-structure, tests, the plan).

## 10 November 2026 - Kiosk Kevin, phase 5: the Glitter Bomb and the Sparkler Cake

Phase 5 of docs/kiosk-kevin-plan.md, built on `claude/kiosk-kevin-5` (cut from `claude/kiosk-kevin-4`, which it builds on). The Air Horn
was already built; this adds the other two products.

- **Selling them (the user's choice):** the cart keeps its three slots. The Lethal slot alternates Soda Bomb / Sparkler Cake round by
  round from round 2, the Tactical slot Air Horn / Glitter Bomb, Bubble Wrap is always there (config/kiosk.js `slots`, stockFor,
  pickFor). No randomness, so nothing new to save. Kevin's Pick moves along the slots, so every product is the Pick within six rounds.
  The buy spots read their product live; the cart's product labels became one canvas strip in its dynamic rig, redrawn when the
  stock changes. The PA line now names the round's three products. Prices: Sparkler Cake 400 (2), Glitter Bomb 750 (2): starting points.
- **The Glitter Bomb** (game/equipment/glitterBomb.js): opens where it first touches anything; up to 8 zombies within 4 m (in sight,
  nearest first) are confused for 6 s through `zombie.applyConfusion`, the SAME path as Build-A-Blaster's Glitter (zombies/confusion.js),
  not a second one. Their swings at each other are 75 x equipmentPower(round). Bosses refuse it (the method's own boss check).
- **The Sparkler Cake** (game/equipment/sparklerCake.js): lands on the floor and sprays for 4 s; every 0.5 s each zombie within 3 m (in
  sight, on its floor) is lit through `zombie.applyBurn`, the Fryer Oil burn: 450 x power over 3 s, a boss at half (equipmentDamage.js
  burnDamage). Burns don't stack, so standing in it keeps one burning.
- **Shared change:** `applyConfusion` and `applyBurn` take an optional `source` (default 'build', so Build-A-Blaster is unchanged); the
  products pass 'equipment', so their kills are equipment kills. Nothing pays 'hit' (no +10), the meter ignores them, and the gold Mascot's
  guaranteed power-up already drops whatever kills it (powerUps.js reads only the type): checked for a cake burn and a confused zombie.
- **Throwing:** equipment.js gained `opens` ('touch' / 'floor', or wherever it stops, or after landSeconds), targetsNear and a spraying
  state; `detonate(id, position)` now opens or lands any thrown product (tests). Thrown things stay transient: only the pockets are saved.
  fx/throwableView.js draws a pool per look.model (bottle, cake, card); the HUD has a cake icon and colours for both.
- **Checked:** tests/equipmentStatus.test.js (9 new tests) and tests/kiosk.test.js (the purchase test now buys all five through real
  input). In the browser (worktree build): the cart's labels and the PA show the round's three; a thrown cake lands and sprays, four
  Shoppers burn down with only the kill value paid; a thrown card confuses four Shoppers; no console errors. Found while testing: a
  card that opens in the air (on a zombie's chest) caught nobody, because the floor check compared feet to the card's height; it now
  takes any point from a zombie's feet to its head (plus the tolerance), with a test for it. And a Mascot placed with speed 0 has NaN
  hitboxes headless (its pose divides by its speed), so the tests place zombies at a crawl; a real Mascot always moves.
- Shared files changed: src/zombies/zombie.js and src/zombies/confusion.js (the optional source), src/config/economy.js (two kiosk
  prices), src/game/events.js (docs of two events), src/ui/retail.css, docs (folder-structure, tests, the plan).

## 10 November 2026 - Kiosk Kevin, phase 4: five carts and the move

Phase 4 of docs/kiosk-kevin-plan.md, built on `claude/kiosk-kevin-4`. The stock is unchanged (always Soda Bomb, Bubble Wrap and Air Horn;
the Pick cycles), so only WHERE he sells changes.

- **Five carts** (config/kiosk.js `sites`; maps/mall/kioskCart.js builds one per site in its own frame, turned by `faces`): the Hallway
  (unchanged, the first site), the Food Court (x -4.3..-2.1, z -6.9..-6.1, facing the gate: west of the door lane and 4.6 m clear of the
  Fryer Blast's grease apron, more than the 2 m asked), the Grand Atrium (the south arcade's corner west of the Hallway gate), the Sunset
  Promenade's east lounge (between the south benches and the plinth, facing the Atrium link) and Customer Parking (bay 1, against the
  family van's east side, facing +X). Each is the same 1.05 m vaultable counter; the live one has Kevin, the others say BACK IN 5 MIN.
  Every site's slot is in the scatter-clear list (clutter keeps 2 m away), next to the claw's.
- **Changed from the plan:** the Atrium site was to be the CELL-OUT kiosk, but its front is 4.7 m from the west vent spawn (the rule is
  5 m), its back is no better and its east face is inside the Electrified Fountain's 7 m apron. The Food Court cart is not in the
  centre aisle: that is the door lane (x -2..2) with the tree planter in it, and the stall side is the Fryer's.
- **The move rule** (game/features/kiosk.js): at each 'roundStart' after the opening round (so from round 3) he moves to a random OTHER
  site whose zone is open; with none, he stays (a 'kioskMoved' with moved false). Never into a locked zone (moveNow refuses one too).
  Never mid-purchase: if a buy on his cart is being held (the prompt is a kiosk item with progress > 0), the site is picked right then
  and he moves the tick the hold ends (`status.pending`). The buy items' positions are getters on the live cart.
- **PA:** still one 'kioskStock' line a round when he first sells in it, now naming the place when he is new there: "Kevin's cart is open
  in {where}." the first time (and after a load), "Kevin's cart is now in {where}. He's asked us to say it's a limited time only." after
  a move, then "Kevin's Pick is {pick}." (lines in config/kiosk.js `pa`; `where` per site). New event 'kioskMoved' { siteId, area, moved }.
- **Save & Quit:** the kiosk feature now saves { siteId, pendingId } (serialize/restore), so a loaded run reopens him where he stood at
  the round's start (the snapshot is taken after the roundStart listeners, so that round's move is in it). config/save.js version 3.
- **Debug:** keyless `g.debug.run('kioskMove', siteId?)`.
- **Checked** (tests/kiosk.test.js, 5 new tests; tests/saveGame.test.js, 1 new; tests/coplanar.test.js now has a region per site):
  each site has one collider (a vaultable counter), a clear stand point zombies reach, no spawn within 5 m, a real prompt from its front,
  ducking from that cart; the carts leave every spawn's route to the hub within 3 m of what it was; opens first in the Hallway at round 2,
  moves at round 3; 40 round starts with part of the mall locked only ever open him in an open zone, always somewhere new; a round that
  starts during a held buy waits for it; Play again puts him back; a load keeps the round-start site, not a mid-round move.
- Shared files changed: src/maps/mall/mall.js (the carts, the feature entry, the clear list), src/config/save.js, src/game/events.js,
  src/game/debugCommands.js, tests/coplanar.test.js, tests/saveGame.test.js, docs (map, folder-structure, tests, the plan).

## 10 November 2026 - Weapon skins: three fixes from the review of phases 1 to 5

- **Save & Quit paid a round's kills twice.** Mastery progress is permanent and was written at Save & Quit, but Continue replays the round, so the same kills counted again (30 kills, save, continue, 30 again = 60 with a run total of 30; repeatable, so a skin could be farmed without the run advancing). Now game/challenges.js remembers what the unfinished round has already been paid (`credited`, per gun and skin) and counts only what an attempt earns beyond that. Save & Quit writes it into the skin record as `replay`; 'runLoaded' reads it back; a new round, Play again or a run that loaded nothing starts with none. Nothing is ever taken back, so an unlock earned before the save stays.
- **Progress was lost by quitting.** It was written only on an unlock, a death or a Save & Quit, so Quit to title, Restart run or closing the tab mid-run dropped it. Now 'runReset' and the page's `pagehide` write it, and only when there is something new (the skin record tracks `dirty`); a death with nothing new writes nothing either. Still never a write per kill.
- **Every skin of every gun was built at start-up** (22 first-person models, 66 once each gun has five skins). The viewmodel now builds the eleven default looks up front and a skinned model the first time its gun is held in that skin, then reuses it. The sleeve styler (player/wardrobeAppearance.js) gained `add(root)` so a late-built model wears the cardigan or vest already on.
- Not changed, for the user to judge: the eleven mastery skins are all a dark body with pale trim, Return to Sender's six stripes share one accent colour under a skin, and a new skin can only be worn from the next run.
- Full suite 1316/1316 (seven new tests; one existing test updated: it asserted that a quit wrote nothing). Build clean; balance report identical to main. Branch claude/skins-fixes on top of codex/skins-5.
- Shared files: game/challenges.js, game/skinSave.js, weapons/viewmodel.js, player/wardrobeAppearance.js, main.js (one line), tests/challenges.test.js, tests/skinEquipment.test.js, docs.

## 10 November 2026 - Weapon skins phase 5: The locker, and slot 1 skins

- The title has a Weapon locker beside Statistics; Play keeps its Directed/Classic chooser. All eleven guns show Default and their named mastery recolour, with readable locked challenges and permanent progress. Mouse, arrows/Enter and controller D-pad/A browse/equip; Back, Escape and B return. Equipping saves immediately.
- The turning buildWeaponDisplay preview exists only while open, runs on the title idle-saver loop, and disposes its geometry, materials, label textures, renderer/context and canvas on close. Your held, newly purchased/won/built and conveyor guns use g.skins; wall displays and claw prizes stay default.
- Kept Night Shift unchanged and kept Carbon Copy, darkening only its body from #404a4d to #353f42 for the configured 2:1 contrast floor. Every mastery body passes all six stuffings and four warranty tiers; the lowest ratio is 2.0506:1. All eleven names and role palettes are in docs/skins-5-report.md.
- Save & Quit version 3 saves run skin choices and the challenges earned-this-run receipt list. Permanent progress/unlocks/preferences stay in the version 1 skin save and flush on runSaved. Play again rereads preferences; Continue restores the saved run coat. The receipt adds one line for this run's skin unlocks.
- Full suite: 1309/1309 passed, zero failures/skips. Production build passed (318 modules); balance output is byte-identical to Step 0. Phase 2 default fixtures and upgradeColors.test.js pass untouched. Step 0 separately passed 1295 tests and build; its commits are d8c2fea and d1aeafb.
- Production-preview Chrome/SwiftShader captures cover locked/unlocked locker, both retained skins in hand, three stuffings at Platinum, and a real 150 HP Shopper kill from 399 progress followed by the PA/toast and receipt. Rivet Rifle draw calls: default 135, skinned 135. Preview canvas releases on Back; Escape and simulated controller B return to title. QA used an isolated profile; normal browser saves were untouched and the QA storage was restored. Physical controller/GPU and subjective combat play were not checked.
- Shared files: config/skins.js and save.js; game/createGame.js, challenges.js, skinSave.js, features/workshop.js and workshopRitual.js; main.js; ui/hud.js, screens.js and retail.css; weapons/models/index.js; tests/challenges.test.js; folder/test/history docs. New files: game/skins.js, ui/locker.js, tests/locker.test.js and tests/skinEquipment.test.js. Full report: docs/skins-5-report.md.

## 10 November 2026 - Weapon skins phase 5, Step 0: join the tracks

- Isolated skins-5 starts at skins-1 (90ca748); both input suites passed 1175/1175 with no failures or skips. The skins-3 merge is d8c2fea; all eleven challenges, the two original palettes, storage, notices and both debug commands are retained.
- Merged main f471af0, keeping the Directed/Classic title chooser and Save & Quit. Mastery counters are permanent, so the empty challenge run state is transient at this integration step. runSaved flushes eligible progress without ending or recording the run. No saved shape changed; save version remains 2.
- Integrated validation: npm test passed 1295/1295, zero failures/skips; npm run build passed (316 modules). Balance baseline recorded for Phase 5 comparison.

## 10 November 2026 - Weapon skins phase 4: Challenges and the save

- Each of the eleven guns has a named Mastery challenge in config/skins.js. Kills earn its skin at 400, or 150 for Return to Sender. Phase 1's Night Shift and Carbon Copy entries and palettes are retained for the later merge.
- g.challenges listens to the Phase 3 kill.weaponId, including delayed build/projectile kills. Assisted play, kills after death and Skylar's noRewards fans earn nothing. Eligible progress earned before assistance stays.
- game/skinSave.js owns the versioned permanent record under sunsetGalleria.skins. It writes on unlock and runEnd, tolerates missing/corrupt/blocked storage, merges counts upward and unlocks by union, and protects newer save versions. main.js only creates and injects the browser-backed save.
- skinUnlocked drives the existing PA banner/chime and an independent HUD toast. All new words and challenge thresholds live in config. Counter factories expose event/lifecycle, update/reset/snapshot hooks for later role challenges and feats.
- The keyless challenge debug command can add, complete or clear one challenge and persists explicitly. Clear resets and relocks only that challenge. It marks assistance, so debug to 399 then Play again before a real earning kill.
- Verified: full suite 1175 passed (22 new challenge tests), production build passed, balance output identical to Phase 3. The existing equipment test now checks that pockets remains keyless alongside the new challenge command.
- Production preview: debug to 399, Play again, one real Staple Gun shot unlocked Night Shift. PA and toast captured together; reload retained the unlock; the temporary skin save was removed.
- Shared edits are createGame.js, events.js, debugCommands.js, main.js, ui/hud.js, ui/retail.css, tests/equipment.test.js and docs. Gameplay verification retains the Phase 3 kill payout baseline.

## 10 November 2026 - Weapon skins phase 3: Kills name their gun

- The kill event carries the gun ID from the lethal hit, projectile, or build effect. Burns, Glitter, and Party Trap keep their gun ID after a loadout change.
- The box cutter, hazards, Soda Bomb, Inventory Liquidation, and unowned zombie attacks give a null gun ID. Out-of-world zombies still use the existing rescue path.
- The scripted fight on main at ec36907 recorded 870 points left, 370 earned, 4 kills, and 4 hits from 4 shots. The phase keeps those figures and the existing payout and workshop listeners.
- Shared gameplay edits are the kill payload in createGame.js and the event contract in events.js.

## 10 November 2026 - Weapon skins phase 2 - Every gun answers to its palette

- Price Gun, Nail Gun, Foam Dart Blaster, Confetti Cannon, Heavy Coil Nailer, Barcode Scanner, Leaf Blower, Tennis Ball Launcher and Return to Sender now resolve their first-person and display colours through skinPalette. Reload props use the same coat as the gun. Displays use the default.
- gunPalettes.js contains role bindings and the defaults moved from model literals. Added roles are ammo (labels, darts, shells and balls), emitter (laser window and returns emitter ring, separate from aiming sights), screen (returns display) and glass (transparent hopper). Body shading uses dark, brass and coils use accent, and contact surfaces use grip. Return to Sender's six physical rainbow strips keep six default colours and take accent under a recolour.
- The fixture was captured before editing any model, from Phase 1 at a1c627e. It records all eleven models and displays with and without canvas support, including mesh/material names, colours, emissive colours, finishes, transforms, geometry and drawing commands. Nine test-only palettes prove role placement, fixed canvas artwork and reload props. Equal-valued role colours preserve finishes and glow, including the Foam Dart Blaster's original glowing accent.
- Validation passed. The full `npm test -- --test-concurrency=4` run has 1175 tests, 1175 passes, zero failures and zero skips. The focused run passed 102 tests, including upgradeColors, weaponModels and newGuns. The production build transforms 301 modules with zero errors and the existing large-chunk warning. The balance report completes.
- Browser comparison used a committed-main snapshot (ec36907) built inside this worktree's scratch folder. All eleven default gun regions are pixel-identical at 1440 x 900. Full-frame differences are confined to a timed HUD panel at the top right. Price Gun, Barcode Scanner and Return to Sender wore their test palettes through the existing skin debug command in a temporary QA build, including a Neon Tube build on Return to Sender. Captures and pixel comparisons are in scratch/skins-2-qa/. Chrome/SwiftShader checks cover the rendered frames. Physical-GPU, controller and hands-on combat play were outside these checks.
- Shared files changed are config/gunPalettes.js, weapons/skinPalette.js, tests/skins.test.js, the tests/helpers/gunMaterials.js capture helper, the pre-edit JSON fixture and the folder/test/history docs, alongside the nine model files.

## 10 November 2026 - Weapon skins phase 1 - The base coat on two guns

- Night Shift (Staple Gun) and Carbon Copy (Rivet Rifle) recolour the held models by role. The default colours, brand label and wall displays match main.
- In the browser console, use `__mall.g.debug.run('skin', 'stapleGun', 'night-shift')` or `__mall.g.debug.run('skin', 'rivetRifle', 'carbon-copy')`. Pass `'default'` as the last argument to clear that gun. The command marks the run assisted, and Play again clears the overrides.
- The viewmodel selects the base coat and applies the existing build, warranty, loaner tag and attachment layers to it. Tests compare the original material colours and exercise all six stuffings and all tiers on both coats.
- Production-preview checks used `window.__mall` in headless Chrome at 1440 x 900 with SwiftShader. Both guns wore all six stuffings, every warranty tier and an Extended Nozzle. The combined inspect frames distinguish the base coat, patch/seam, collar and nozzle. Screenshots and the check log are under `scratch/skins-1-qa/` in this worktree. Physical-GPU, controller and combat play were outside this visual check.
- The phase table also needs these integration points. The browser supplies the debug selection through `main.js`, the model registry forwards the skin id, and `createGame.js` clears overrides on the existing `runReset` event. The Staple Gun's fixed colour literals now live in `config/weapons.js`.
- Validation passed. The full `npm test -- --test-concurrency=4` run has 1136 tests, 1136 passes, zero failures and zero skips. `npm run build` transforms 300 modules with zero errors and the existing large-chunk warning. `npm run balance` completes. The equipment test's keyless-command list now includes `skin`.
- Shared files changed include `src/config/weapons.js`, `src/game/debugCommands.js`, `src/game/createGame.js`, `src/main.js`, the model registry and the viewmodel. The reset subscription clears debug coats with the rest of the run.

## 10 November 2026 - Closing Time phase 8: the Last Customer, reused parts

- Built on claude/closing-time-8, cut from main then fast-forwarded to the completed phase 7 prerequisite (360dd69), which main did not yet contain. Main and the other worktrees were not edited.
- Lorraine Pruitt, The Last Customer has no firstRounds, so random debut selection skips her. g.closing listens to closingValidated and books the following round through bossDirector.book(round, id), replacing that round's single slot even at an encore. Her round banner reads CLOSING TIME, including after a load. encore:false keeps her out of met and leaves the last ordinary boss available for overtime encores.
- She enters at the lot's existing delivery gate, with safe-marker retries and no fallback elsewhere. The placeholder is a mauve employee skeleton, with a receipt notice, intro/defeat banners and the existing Guard sting. Health is sixteen times the round's Shopper, speed 2.6, melee/charge damage 60, kill pay 2,500. She dies normally in this phase; no Speechless/return mechanic or finished trolley model.
- Her charge uses zombie.js's existing Cart Pusher/Kettle state machine, including solid crashes and extra damage while crashed. At each configured health threshold she requests four Mall Walkers through the lot's four markers. As with Kettle, backup spends the remaining wave quota and obeys the alive cap; unsafe markers/cap retry rather than adding extra quota.
- The van names the Last Customer while she is pending or alive and requires her defeat as well as keys, duties and validation. Her ordinary death unlocks it, with regular zombies allowed to remain. Classic names the same local missing requirement.
- Save & Quit keeps the booking in the director's existing serialized schedule. g.closing saves closingRound and lastCustomerDefeated; reset clears both. config/save.js version is 4 for the changed closing step. Loading is silent and the round banner is displayed after all restore steps have run.
- Balance report: Platinum Rivet Rifle ADS body fire at 10 m, sustained DPS including reloads, no crash bonus/headshots/misses/wave pressure: round 16 = 19,904 hp / 16.4 s; round 18 = 23,008 hp / 18.9 s; round 20 = 26,592 hp / 21.9 s. These are theoretical report estimates, not a moving-fight playtest. The report now handles booked-only bosses and prints this table.
- Checked: npm run test:quick and npm test (1,219 passing each); npm run build and npm run balance; all nine new Phase 8 cases separately, including round-20 encore replacement and save/load, all three van crashes, backup thresholds and overtime exclusion. Headless Edge against the built production preview checked validation, saving in round 20's break and loading, CLOSING TIME, exactly one Lorraine at the delivery gate, the notice/model and van refusal/unlock/SHIFT COMPLETE, with no game console exceptions; screenshot visually inspected. The final full-suite rerun passed after the save fixture was taught to retry safe spawns and the single-file build was allowed to recreate its generated folder. The quick economy baseline completed, but its bot does not attempt this quest.
- Shared files changed for phase 8: config/bosses.js, closingTime.js, deathReports.js, economy.js, save.js; game/bossDirector.js, closingTime.js, createGame.js, debugCommands.js, rounds.js, features/escapeVan.js; zombies/zombieManager.js; ui/hud.js; tools/gunReport.mjs; tests/closingTime.test.js, saveGame.test.js, bosses.test.js, bossPolish.test.js, helpers/headlessGame.js; docs (plan, history, folder-structure, map, tests). New module: zombies/bosses/lastCustomer.js. No map feature-list reorder or new callbacks through createGame.

## 10 November 2026 - Closing Time phase 7: parking validation

- The ticket machine is part of the existing escapeVan feature, mounted on the mauve van's west flank inside bay 4, opposite the east-side start prompt. It adds no collider and leaves combat lanes, the exit approach and four spawns clear.
- Every key and lines 1 to 3 are required. Hold to pay g.pricing.priceOf('closing', 'validation'): 5,000 base, with Discount Code and Employee Discount honoured. The machine explains each missing requirement, confirms validation locally in both modes, and cannot charge twice. The van names validation among its missing requirements and unlocks after payment. No final boss or round gate is added in this phase.
- g.closing owns validated, announces closingValidated { round, pa } once, and clears it on reset. Directed's PA says closing time is the next round; Classic keeps its local confirmation without quest PA. The Van Keys pickup now points to the ticket machine.
- The existing closing save step serializes/restores validated silently. config/save.js version is 3 for the changed step shape; map.features keeps its order and gains no entry. Save & Quit still rolls back to the round's start: validation first survives a save once it is in that snapshot.
- Checked: all 51 targeted Closing Time / Save & Quit tests; npm test (1,210 passing); npm run build; npm run test:quick while iterating; quick economy baseline (the bot does not do the quest; quest balance remains phase 11). Headless Edge against the production preview checked the missing-key prompt, a Discount Code payment of 3,000, the once-only event and confirmation, and the van's SHIFT COMPLETE receipt, with no game console exceptions. The machine screenshot was visually inspected.
- Shared files changed: config/closingTime.js, config/economy.js, config/save.js; game/closingTime.js, game/createGame.js, game/events.js, game/features/escapeVan.js; maps/mall/mall.js and parkingLot.js; tests/closingTime.test.js, saveGame.test.js and helpers/headlessGame.js; docs (plan, history, folder-structure, map, tests). No new source or test files.
## 10 November 2026 - Environmental hazards, phase 4: the PA System Lure (hazards plan complete)

- **What was built (`docs/archive/hazards-plan.md`, Phase 4).** Added the Service Corridor **PA System Lure** (`src/game/features/paLureHazard.js`, feature kind `paLureHazard`), mounted on the west corridor wall at `(-23.1, 1.35, -4.5)` facing `+X` east (`switchOffset: 0.18` proud of the west-wall electrical panel). Holding `F` / controller `X` in an unlocked Service Corridor pays `g.pricing.priceOf('hazard', 'paLure')` (`500` base in `economy.hazards.paLure`, discounted by `'hazards'` Flash Sales) to broadcast a clearance chime within a `10 m` radius of the ceiling speaker at `(-21.5, -4.5)` for `8 s` (`0.5 s` pulse interval), followed by a `30 s` recharging cooldown.
- **Zombies, 3 m Service Corridor crowd & failsafe, bosses, Mascots, and Closing Time line 1.** Each `0.5 s` broadcast pulse holds normal zombies and Mascots in place with `applyHold(lureSource, 1.2)` (zero pulse damage during the broadcast), then finishes when the `8 s` broadcast expires naturally (`onStop({ finished: true })`) with a feedback pop (`source: 'hazard'`) dealing `max(220, 60% maxHealth)` to normal zombies and capped at `10%` of `maxHealth` (`maxHealthCap = 0.1`) on bosses and Mascots. Bosses ignore `applyHold` (`this.type.boss` guard in `zombie.js`). In the `3 m`-wide Service Corridor (`x: -23.3..-20.3`), held zombies only separate walkers laterally without braking them (`zombie.js`) and yield half-overlap to unheld movers (`zombieManager.js`), so a held crowd neither triggers `rescueStuckZombies` nor blocks bosses or unheld zombies from walking through. Each feedback-pop kill emits `'paLureKill'` (never `'fountainKill'`), leaving Closing Time line 1's fountain duty count untouched.
- **Player in the lure zone & Save version.** A player standing inside the active lure takes `0` damage (`playerDamage = 0`) and is not slowed (`playerSlowFactor = 1`). `resetRun()` stops the active lure (`onStop({ finished: false })`) and releases holds without firing the feedback pop. Bumped `config/save.js` `version` because `map.features` gained `hazard_paLure` (4 to 5 on its branch; 7 once merged over main). Marked `docs/archive/hazards-plan.md` built.
- **Shared files changed.** `src/config/hazards.js`, `src/config/save.js`, `src/game/events.js`, `src/game/features/hazards.js`, `src/game/features/index.js`, `src/maps/mall/mall.js`, `src/zombies/zombie.js`, `src/zombies/zombieManager.js`, `tests/features.test.js`, `tests/hazards.test.js`, `docs/archive/hazards-plan.md`, `docs/folder-structure.md`, `docs/tests.md`, `docs/map.md`, `docs/history.md`.

## 10 November 2026 - Environmental hazards, phase 3: the Fire Sprinklers

- **What was built (`docs/archive/hazards-plan.md`, Phase 3).** Added the Main Hallway **Fire Sprinklers** (`src/game/features/sprinklerHazard.js`, feature kind `sprinklerHazard`), mounted on the south concourse wall at `(-3.9, 1.35, -1.95)` facing `+Z` north (`2 cm` proud of the `z = -2.0` wall via `switchOffset: 0.13`, `3.5 m` east of Kiosk Kevin's cart at `x = -8.5`). Holding `F` / controller `X` in an unlocked Hallway pays `g.pricing.priceOf('hazard', 'sprinklers')` (`600` base in `economy.hazards.sprinklers`, discounted by `'hazards'` Flash Sales) to drench the central concourse (`x: -12..12, z: -2..6`) for `10 s` (`0.5 s` pulse interval), followed by a `30 s` recharging cooldown.
- **Zombies, bosses, Mascots, Kiosk Kevin & Closing Time line 1.** Each pulse deals `max(60, 25% maxHealth)` cold-spray damage (`source: 'hazard'`), chills targets with `applySlow(1.0, 0.45, 'smoothie')`, and soaks them with `applyVulnerable(1.2, 1.35)` so weapon hits on soaked zombies, bosses, and Mascots deal `1.35x` damage while per-pulse hazard damage on bosses and Mascots stays capped at `6%` of `maxHealth` (`maxHealthCap = 0.06` in `dealHazardDamage`). Each sprinkler kill emits `'sprinklerKill'` (never `'fountainKill'`), leaving Closing Time line 1's fountain duty count untouched. Verified that the nearest-prompt-wins rule gives the Fire Alarm Pull and all three Kiosk Kevin slots their own independent prompts before and during an active spray.
- **Player in the drenched concourse & Save version.** A player standing inside `x: -12..12, z: -2..6` takes `0` damage (`playerDamage = 0`) and is wet-tile slowed to `0.9` `stats.surfaceSpeed` until stepping out or the sprinklers stop. Bumped `config/save.js` `version` because `map.features` gained `hazard_sprinklers` (3 to 4 on its branch; 6 once merged over main).
- **Shared files changed.** `src/config/hazards.js`, `src/config/save.js`, `src/game/events.js`, `src/game/features/hazards.js`, `src/game/features/index.js`, `src/maps/mall/mall.js`, `tests/features.test.js`, `tests/hazards.test.js`, `docs/archive/hazards-plan.md`, `docs/folder-structure.md`, `docs/tests.md`, `docs/map.md`, `docs/history.md`.

## 10 November 2026 - Environmental hazards, phase 2: the Fryer Blast

- **What was built (`docs/archive/hazards-plan.md`, Phase 2).** Added the Food Court **Fryer Blast** (`src/game/features/fryerHazard.js`, feature kind `fryerHazard`), placed on the front counter of **CORN DOG CORRAL** at `(5.75, 1.05, -13.0)` facing `+Z` north (with its 3D breaker cabinet offset `+0.21 m` along `+Z` so it sits proud of the counter face and stainless lip). Holding `F` / controller `X` in an unlocked Food Court pays `g.pricing.priceOf('hazard', 'fryer')` (`750` base in `economy.hazards.fryer`, discounted by `'hazards'` Flash Sales) to vent superheated oil from both deep fryers across the `6.5 m × 6.5 m` counter apron (`x: 2.5..9.0, z: -13.0..-6.5`) for `6 s` (`0.5 s` pulse interval), followed by a `25 s` recharging cooldown.
- **Zombies, bosses, Mascots, and Closing Time line 1.** Opening pulse deals `max(180, 45% maxHealth)` (`burstDamage = 180`, 1-shotting round-1 Shoppers) and subsequent pulses deal `max(120, 45% maxHealth)` (`source: 'hazard'`), while knocking normal zombies flat on their backs with `applySlip(0.9, 0.8)`. Bosses ignore `applySlip` (`this.type.boss` guard in `zombie.js`) and cap per-pulse damage with Mascots at `10%` of `maxHealth` (`maxHealthCap = 0.1`). Each fryer kill emits `'fryerKill'` (never `'fountainKill'`), leaving Closing Time line 1's fountain duty count untouched.
- **Player in the grease apron & Save version.** A player standing inside `x: 2.5..9.0, z: -13.0..-6.5` while active takes `5` scald damage per pulse (`{ type: 'hazard', id: 'fryer' }`, feeding `deathReports.hazards.fryer`), a `1.0°` view jolt, and a `0.8` `stats.surfaceSpeed` grease slow until stepping out or the blast ends. Bumped `config/save.js` `version` because `map.features` gained `hazard_fryer` (2 to 3 on its branch; 5 once merged over main's 4).
- **Shared files changed.** `src/config/hazards.js`, `src/config/save.js`, `src/game/events.js`, `src/game/features/index.js`, `src/maps/mall/mall.js`, `tests/features.test.js`, `tests/hazards.test.js`, `docs/archive/hazards-plan.md`, `docs/folder-structure.md`, `docs/tests.md`, `docs/map.md`, `docs/history.md`.

## 10 November 2026 - Save & Quit (Black Ops 6 style)

- **The rules (the user's).** One save slot. Saving ENDS the run (to the title). You can save any time while alive, but only at full health.
  The save is the run as it stood at the START of the current round: points, purchases and (later) Closing Time progress made during the
  round are not kept. Continue deletes the slot and replays that round from its break, with the same draws (boss schedule, Flash Sale,
  claw site, today's Build-A-Blaster bins). Play from the title with a save present asks twice and discards it. A save from an older
  version (config/save.js `version`) is dropped with a notice.
- **How.** game/saveGame.js. Each 'roundStart' raises a flag; createGame's update() takes the snapshot at the end of that tick, after every
  roundStart listener has rolled. createGame keeps `saveSteps` ([name, serialize, restore], in restore order) beside `resetSteps`, and
  `transientSteps` for what a save drops (zombies, effects, power-ups on the floor, traps, hazard cooldowns, a claw grab under way). A load
  is resetRun + every restore; rounds.restore puts the run at the start of the break without a 'roundStart'. 'runSaved' / 'runLoaded'
  are new events (horror relights on runLoaded; the PA welcomes you back). Saving is not a death: no runEnd, no career record.
- **Decisions.** Stats are saved as they are and the wardrobe restores without re-applying its factors (no double clothes). The run's
  'assisted' flag is kept (a debug run stays one). A gun away at Build-A-Blaster and its order are kept; the loaner too.
- **Checked.** tests/saveGame.test.js (7 tests): coverage of every reset step, the round-start rollback, an exact round trip (what the loaded
  game would save equals the save), same draws, the gun away + loaner, the full-health / alive / started rules, the old-version drop, no
  runEnd. In the browser (worktree build): Save & quit on the pause card asks twice and lands on the title with "Continue · Round 3";
  Continue resumes at round 3's break with the round-start 500 points (5,000 earned mid-round gone), the hallway owned, and the slot
  empty; the round's wave then spawned normally; hurt, the button reads "Save & quit · Full health needed" and does nothing. No console errors.
- **Not checked.** A real save mid-Build-A-Blaster order in the browser (the order's restore is covered only by the gun/feature data
  round trip), the controller's Start = Continue, and saves across a page reload (localStorage persistence itself was not reloaded).
- **For later work.** Every new system with per-run state (each Closing Time phase) must add a save step or a transient entry, or
  saveGame.test.js fails; bump config/save.js `version` when a step's saved data changes shape.
- Shared files changed: src/game/createGame.js, src/game/events.js, src/main.js, src/ui/screens.js, src/ui/retail.css, CLAUDE.md, and a
  serialize()/restore() pair in wallet, runStats, tickets, secondChance, rounds, pricing, flashSales, bossDirector, powerUps, wardrobe,
  warranty, outfitRail, equipment, weapons/playerGun, features/index, workshop, workshopRitual, clawMachine (+ attachmentCounter's
  ownedAttachments, horror's runLoaded listener); docs (history, folder-structure, tests).

## 10 November 2026 - Second Chance: review of step H (one self-revive per run)

- **What it is.** Customer Service's third window (SECOND CHANCE, opposite Sharpening) sells one automatic self-revive for 2,000
  (g.pricing 'secondChance'). A lethal hit spends it in onPlayerDeath: full health where you stand, nearby zombies shoved (4 m, same
  floor, in reach, never a boss; the Security Sweep's stagger), 3 s with no damage, a PA line. The receipt says "Second Chance · Used".
- **The review's fixes.** (1) A swing that landed during the 3 s still announced 'playerHit': damage arrows, controller rumble, the
  Sandwich Board / Hi-Vis tags and a boss's on-hit effect all reacted to hits that did nothing. Now nothing is announced while the
  protection lasts (createGame's onPlayerHit and onFall), and a hazard pulse does not jolt the view. (2) The outfit rail read the revive
  as the Cardigan soaking a hit (health after + damage > 100): measured 8 false pulses in one protected window, now 0. (3) The state
  moved out of a createGame closure into game/secondChance.js (status / buy / redeem / reset, on g.secondChance) and announces
  'secondChance' { status }; the HUD tag and PA line are listeners. The numbers got comments in config/feel.js (health.secondChance).
- **Checked and left alone.** Prompt choice along the counter (a sweep every 0.4 m: Second Chance x <= 6.2, Warranty 6.6..7.4, Sharpening
  from 7.8), a discounted price and a refused second purchase (it is in no Flash Sale group; vouchers and the Employee Discount apply), a lethal Cart Pusher charge, lethal fall
  and fountain pulse, two lethal hits in one tick, pause, the final cause of death, Play again while held or protected.
- **Measured (existing review-bot runs, not re-run).** In 60 saved mortal runs every bot had earned the 2,500 for the start shutter and
  Second Chance during round 3 (1.5 min), and 54 first held 2,000 unspent at the end of round 4 with the bot's own shopping list. Deaths: rounds
  6 to 11 for the good bot (9 of 20 in round 7), 4 to 10 for the average one, with 2,000 or more unspent in 38 of 60.
- **Measured (headless, a bot that cannot shoot).** The shove moves a zombie 0.3 to 0.6 m. Standing still in a crowd of eight, the next
  damage comes 3.0 to 3.8 s after the revive and the run ends about 3.7 s after it: the 2 s stun ends before the 3 s protection, so the
  swings land as it runs out. 28 crowd layouts at walls and corners (8 or 13 Shoppers in two rows), sprinting for the widest gap: clear
  of the crowd within 3 s in 12 with the shove as built, 16 with no shove, 3 with a 1.0 m shove, 0 with 1.4 m. Stunned zombies stand as
  a wall and the player cannot push through one, so a stronger shove does not open a gap. The tuning was NOT changed on this.
- **Open, for a playtest.** Whether a player with a gun gets out of a corner in the 3 s; whether the 3 s needs a visible cue; whether the
  SECOND CHANCE sign is noticed. If cornered re-deaths show up, the lever is passing through zombies during the protection, not a
  bigger shove.
- Shared files changed: src/game/createGame.js, src/game/events.js, src/config/feel.js, src/config/economy.js, src/game/outfitRail.js,
  src/game/features/hazards.js, src/game/features/upgradeDesk.js, tests/helpers/headlessGame.js, docs (history, folder-structure, map, tests).
## 10 November 2026 - First minute and HUD polish (Step C)

- **Player spawn faces the room.** Rotated initial player spawn yaw from `0` (-Z, staring at the closed shutter) to `Math.PI` (+Z, facing into the clearance store), driven by `feel.player.spawnYaw = Math.PI` in `src/config/feel.js`. The player at `(0, 0, 12)` now immediately sees the CRT TV wall and the two round 1 zombie spawns emerging from the boarded vents at `z = 15.4`.
- **Run objective line.** Config-driven objective text (`ui.startObjective: { text: 'Open the shutter · {price}', until: 'hallway' }` in `src/config/ui.js`; the price comes from g.pricing), rendered in the HUD left stack directly under the round counter. It hides once the `until` area is owned and comes back on Play again. (Review fix: the first draft said "Earn 500", but a run starts with 500 and the shutter costs 500.)
- **Review fixes before merging.** The GRAB-A-GUN banner's 5 s now count play time only (main.js passes the frame time while running, 0 while paused; it was a wall-clock setTimeout that ran out during a pause). The prompt's price label logic was simplified (an instant, free action shows no price).
- **HUD decluttering.** By minute 2, panels no longer overcrowd the screen:
  - The **GRAB-A-GUN banner** is now shown only for a timed `ui.clawBannerSeconds` (5 s) window when the machine opens or relocates to another site, then automatically hides.
  - The **Employee Rewards panel** remains hidden until its meter first gains progress (`status.progress > 0`), keeping an empty 0% progress bar from taking up screen space at the start of round 2.
- **Fitting room picker overlap fix.** `.hud.fitting-open .hud-left-stack` is now set to `display: none` in `src/ui/readability.css` (matching `.hud.menu-open`), preventing the round counter and Employee Rewards panel from overlapping the top-left of the fitting room receipt picker.
- **Claw drop instant prompt fix.** Fixed the claw drop prompt showing both "Hold" and "Press": `hud.setInteract` now inspects `info.instant` to display `[F] Press` instead of `Hold` on the verb key badge, suppresses redundant "Press" cost tags, and `clawMachine.js` cleans its drop interaction `priceLabel` to empty.
- **Shared files changed:** `src/config/feel.js`, `src/config/ui.js`, `src/maps/mall/mall.js`, `src/game/features/clawMachine.js`, `src/ui/hud.js`, `src/ui/incentiveHud.js`, `src/ui/retail.css`, `src/ui/readability.css`, `src/main.js`, `docs/map.md`, `tests/hud.test.js`, `tests/powerUps.test.js`, `tests/uiReadability.test.js`, `tests/incentiveEffects.test.js`, `tests/janitor.test.js`.
## 10 November 2026 - Review of the antigravity HUD and comfort commits

A review of the six commits merged from antigravity/* (damage direction, comfort toggles, zombie glow, incident report, occupancy,
spare-gun chip). Damage direction and the glow tweak were fine. Fixed:
- **Play froze on the first frame** (the spare-gun chip read an undefined `device` in main.js render): fixed first, in a4cb9d2.
- **Toggle ADS could never aim out of a sprint** (it dropped the sights whenever the player was sprinting, and the controller only stops
  a sprint once you aim). Now it behaves like the held button: aiming ends the sprint.
- **Toggle sprint consumed the sprint press**, so aim.js never saw it: a sprint press while aiming did nothing at all. The press is now
  read, not consumed; it lowers the sights and the sprint starts on the next tick. A sprint press also stands you up from a toggled crouch.
- **The Comfort "Standard" preset switched the three toggles off** (Calm didn't). They're a control choice, so no preset touches them.
- **Spare-gun chip:** it showed the spare ammo only (a full magazine with nothing spare read "0"); now loaded/spare. Its button comes from
  buttonLabels (weapon1/weapon2 on a keyboard, switchWeapon on a controller); the duplicate secondaryDef getter is gone.
- **Last shoppers:** the "2 alive" threshold and the PA line were hardcoded in rounds.js, zombieManager.js and createGame.js; they're
  economy.rounds.lastShoppers now, and the manager asks rounds.lastShoppers. The occupancy line only touches the DOM when it changes.
- **Incident report:** a death from your own Electrified Fountain read "Unclassified workplace casualty". Hazards now pass their id,
  with their own reports. The Cart Pusher tip named the [Space] key (wrong on a controller).
## 10 November 2026 - Minimal Kiosk Kevin

- **Phase 2.** Bubble Wrap has three layers of 40 damage each. Zombie and boss hits go through clothing before
  the wrap. Partial damage stays on the outer layer, falls bypass it, and a broken layer pops. The HUD shows
  remaining layers. The keyless `armour` debug command adds layers up to the cap.
- **Phase 3.** One fixed Hallway cart opens from round 2. It always stocks Soda Bomb (300 points to refill to
  three), Bubble Wrap (500 per layer), and Stadium Air Horn (500 to refill to two). Kevin's Pick cycles through
  the three, adding one charge or layer. Kevin ducks near zombies. Purchases use the normal discounts and vouchers.
- **Air Horn.** The Tactical button sounds it immediately. It staggers nearby zombies with a clear line and
  interrupts Cart Pusher charges. Bosses ignore it. Play again clears the pockets, wrap and cart state.
- **Merged into main (review).** Combined with Second Chance (a hit during the revive protection is not announced, so it never
  reaches the wrap) and Save & Quit: the wrap is saved as its own step ('armour', each layer's strength left), since health is
  transient; tests/saveGame.test.js checks a partly used layer survives a load. The cart itself keeps no saved state.
## 10 November 2026 - Closing Time phases 1-6 merged into main (with Save & Quit, Kiosk Kevin, Second Chance)

- **What came in.** `codex/closing-time-modes`: phases 1 to 6, the A1-A12 fix pass and Classic / Directed runs (the entries below).
  Phases 7 to 12 (parking validation, the final boss...) are not built.
- **Save & Quit now covers it.** New save steps: 'closing' (closingTime.serialize/restore: keys held, duties done and counted,
  the briefing timer, and any key still on the floor, put back without its PA line; a key drops once per run, so a save must
  never lose one) and 'runOutcome' (replaces 'death': the debug flag, the run mode, the win, its summary and the first
  overtime round). Stay for overtime takes a fresh snapshot (a win in the break restarts the break with no 'roundStart', so the
  old snapshot said "not won"). Saving is refused while the win receipt is up ("Shift complete"). Save & quit does not call
  `g.leaveRun()`: a won run saved in overtime is recorded once, when it really ends after Continue (a save never continued is not
  recorded, like any run left unwon). config/save.js version 2 (map.features gained the kiosk, night safe and van).
- **Menus.** Play opens the mode chooser; starting a run there discards a save in the slot (main.js newShift); Continue keeps the
  saved run's mode. Controller Start on the title continues when a save exists, else opens the chooser.
- **Test fixes from the merge.** closingTime.test.js's key-marker bearings assumed the old spawn facing (-Z): the test now sets
  yaw 0 (the start room spawns facing +Z since the first-minute HUD step). The title's Continue button is hidden from JS, not by
  the markup's `hidden` attribute (the test DOM doesn't read it).
- tests/saveGame.test.js: a floor key, a held key with its duty count and the run mode survive a load; a save in overtime keeps
  the win and refuses while the receipt is up.
- Shared files changed: createGame.js, closingTime.js, saveGame.js, config/save.js, main.js, ui/screens.js, mall.js (both features),
  features/index.js, pricing.js, debugCommands.js, hud.js, tests (features, pricing, powerUps, closingTime, saveGame), docs.

## 10 November 2026 - Classic and Directed runs: fixes after review

- **Directed is the default**: listed first and focused first on the chooser; the engine default was already 'directed'. Mode names, descriptions and order are config (`closingTime.modes`).
- **Classic is not silent.** A key pickup plays `closingKey` and a ticked line plays `closingDuty` in both modes (config/audio.js); Classic still shows no quest PA. Its prompts say what is true instead of "Locked": the safe and the van say "Needs <key>", and with every key held the van names one unfinished duty by its place ("Unfinished: Fountain"). The fountain switch's own prompt shows "Shocked n/12" in both modes while the Key Ring is held and the line is open.
- **Starting from the title** no longer leaves a "Fresh shift" pause screen when the mouse lock is refused and no longer resets twice: `ui/runStart.js` stores the mode and asks to play, the chooser stays up until play starts, and a pointer lock that arrives late (after Back) is given back.
- **One value for "no checklist line on this receipt"**: `closingDone: null`, set by the game (`g.receiptFor`) for the death and win receipts. ui/hud.js keeps no receipt state.
- **The last chosen mode is remembered** between sessions through game/settings.js (`closingMode`: no tab, in no preset, kept by Reset everything) and focused on the chooser.
- The plan's "Run modes" section is rewritten: added by the user after phase 6, Directed is the default and is what decision 10 describes, Classic is the opt-in. The ten decisions are unchanged.
- This branch also contains the fix pass on phases 1 to 6 (merged from `codex/closing-time-6`), so a Classic run needs the duties as well as the keys.
- Shared files changed here: `createGame.js`, `main.js`, `config/audio.js`, `config/settings.js`, `game/settings.js`, `ui/hud.js`, `ui/screens.js`, `features/hazards.js` and the docs.

## 10 November 2026 - Closing Time fix pass (phases 1 to 6, after review)

- **The van needs the duties.** Starting the van takes all four keys and lines 1 to 3 ticked (`g.closing.readyToLeave`, checked in `onRunWon` and at the prompt). The prompt lists missing keys first, then the unfinished duties whose key is held, by name. Still no round gate.
- **The game owns line 4.** The Van Keys tick nothing; their pickup has its own PA line. The win ticks "Car park cleared" (`closing.completeLeaving()` from `onRunWon`, before the summary), so `g.closing.done`, 'closingLine' and `summary.closingDone` are right headless and a win receipt reads 4 of 4. The three browser corrections are gone (`closingChecklistFor`, the PA text comparison and `setReceiptClosingDone`).
- **A won run is never lost.** `g.leaveRun()` records a won run that is left by Quit to title or Restart run (the win plus what overtime added), once; main.js calls it before `resetRun()`. A run that was never won is still not recorded. Not covered: closing the browser tab in overtime.
- **A win in the break keeps its round.** `rounds.startOvertime()` in a break restarts the full break and plays the announced round; mid-wave it discards and moves on as before. The summary carries `overtimeRounds` (from the first overtime round), which the receipt reads.
- **A boss reward on the floor survives Stay for overtime.** 'roundDiscard' carries a reason; for 'overtime' game/powerUps.js leaves the uncollected reward, which can still be collected or expire and pay `pointsInstead`. A debug skip deletes it, as before.
- **Statistics** shows career wins, the fastest win (a dash when none) and marks won shifts.
- **The PA introduces the checklist** once per run, 8 s after round 1 is announced ('closingBriefing').
- **The dropped completion line** (noted under phase 6) is fixed with a queue rule, not a priority: a PA message flagged `keep` does not count against the three-message queue, is never trimmed, and returns to the head of the queue if a more important message cuts it off. Only the checklist's line-opening and line-complete lines carry the flag.
- **Career saves:** a stored version higher than this build knows is left untouched; the session uses a blank ledger and writes nothing (Clear records included).
- **Words** for the win receipt, the OVERTIME tag and the Night Safe's "Requires" moved to `config/closingTime.js`.
- **Found while playing it, and fixed:** a boss voucher on the floor (Master Key, Signed Approval, Discount Code) froze the browser game. ui/incentiveHud.js looked its name up in `powerUps.types`, where vouchers are not, threw inside render, and core/loop.js then never scheduled another frame. The line dated from 23 October, before vouchers existed; headless tests never draw the HUD. The HUD now names vouchers from `bossVouchers` and never throws on an unknown id (tests/powerUps.test.js).
- Tests: tests/closingTime.test.js covers each of these, plus a key from a boss killed on an escalator ramp or against a wall, the mid-air drop, Play again against a fresh game (the headless `snapshot()` now includes the checklist, keys, pickups and win flags) and the HUD's boxes and markers. tests/retailUi.test.js covers the queue rule.
- Shared files changed: `createGame.js`, `rounds.js`, `powerUps.js`, `careerStats.js`, `events.js`, `main.js`, `config/economy.js` (a comment), `ui/announcements.js`, `ui/hud.js`, `ui/screens.js`, `ui/retail.css`, `tests/helpers/headlessGame.js` and the docs.

## 10 November 2026 - Classic and Directed runs

- Play opens a choice with Classic focused. Restart run and Play again retain the confirmed mode. Back returns to the title.
- Classic keeps the physical keys and local interactions, with terse van and safe prompts. Directed retains the checklists, key directions, quest PA and receipt progress. Classic filters quest PA before it reaches the Notices archive.
- Both modes share phase 6 quest progress, pricing, win, overtime and career credit.

## 10 November 2026 - Closing Time phase 6, Line 3 (last orders)

- Fairweather's Signature opens Last orders signed off. The next Build-A-Blaster collection, including a Restuff or an order already running at pickup, ticks the line once. Collections before pickup do not count. Play again resets the duty.
- Chrome production preview confirmed the 0/1 and 1/1 HUD states, both PA messages, and reset. The build charged 1,500 points and the Restuff charged 750, with no extra charge at collection.
- When the preview script forced the entire Restuff through while the opening PA was still up, the shared three-message PA queue dropped the completion banner. Letting the opening PA finish before the Restuff made the completion banner visible.
- Shared edits were limited to the Closing Time system and config, its existing test file, and the plan, history, folder guide and test guide.

## 10 November 2026 - Closing Time phase 5, Line 2 (the night safe)

- Kettle’s Safe Key opens Takings banked. Hold interact at the Night Safe on Customer Service’s east wall to make one deposit. Each deposit updates the checklist, and the PA announces the opening and the tick after four deposits. Play again clears the key and progress.
- The safe charges 1,000 points per hold through the new closing price category. The Discount Code and Employee Discount apply to deposits. Flash Sales have no closing group.
- Production Chrome preview showed the locked prompt, the 1/4 HUD count, and the Done prompt with the 4/4 tick. Four full-price holds charged 4,000 points. The prompt and coplanar tests cover the safe alongside both Customer Service windows and the Prize Counter.
- Shared files changed include the Closing Time config and game system, the economy and pricing tables, the map and feature registry, and their test expectations.

## 10 November 2026 - Closing Time phase 4, Line 1: the fountain

- Murray's Key Ring opens “Water features off.” Only kills dealt by the active Electrified Fountain count. The HUD and pause list show the count, and the PA announces the opening and the tick at 12. Bosses and Mascots count. Play again clears the duty.
- The breaker keeps its normal hazard behavior and price. The interim van still requires the four keys until parking validation is built in phase 7.
- With seed 42 and a stationary invulnerable lure in the real headless wave, the paid breaker took two activations in round 6 (11 then 8 kills), one in round 10 (15 kills) and one in round 15 (13 kills). A controlled run staging six full-health enemies at a time took two activations at each round. The measured price was 750 per activation.
- Shared files changed include the Closing Time config and game system, `createGame.js`, `events.js`, the van and fountain features, the HUD and pause UI, and `tests/closingTime.test.js`.

## 10 November 2026 - Closing Time phase 3, The win (browser)

- The existing receipt opens as SHIFT COMPLETE after the van starts. Clock out keeps the completed receipt available. Stay for overtime resumes on the controller or requests mouse lock with a Resume screen as a fallback.
- The fourth checklist box ticks at the van. The HUD shows OVERTIME after continuing. An overtime death uses the regular incident receipt and adds the win round, win time and number of completed overtime waves.
- The win releases pointer lock and stops rumble. The paused receipt is eligible for idle saving. Death alone starts the death music and camera.
- Shared files changed include `main.js`, `ui/screens.js`, `ui/hud.js`, `ui/readability.css` and `tests/closingTime.test.js`.

## 10 November 2026 - Closing Time phase 2, The win (headless)

- The mauve van's east-side hold prompt lists any missing keys. Four keys unlock the free start, even in round 1.
- `runWon` publishes the win snapshot and freezes the simulation. `g.clockOut()` ends the shift. `g.stayForOvertime()` discards the current wave and starts the next round with its normal break and scaling, preserving points and equipment.
- The career ledger records one run on `runEnd`, at Clock out or death in overtime. Version 2 preserves the version 1 history and adds wins and fastest win, measured when the van starts.
- Death events still own the music, cleanup and delayed receipt. The win pauses via `state.running`, which the idle saver already reads. Phase 3 owns pointer lock, receipt controls and changing the browser's death camera check to distinguish death from Clock out.
- Shared files changed include `createGame.js`, `events.js`, `rounds.js`, `careerStats.js`, the feature registry and `mall.js`.

## 10 November 2026 - Closing Time phase 1, Keys and the checklist

- The first defeat of each boss drops its closing key on clear floor alongside its usual reward. If the boss vanishes, its key drops at the player's feet.
- Keys stay through wave changes and Murray's cleanup. Collect a key to check off its duty. Play again resets the checklist and clears the drops.
- The HUD shows four boxes and a pointer for each dropped key. The PA calls out drops and pickups. Pause lists the duties and their keys, and the death receipt records how many were checked off.
- Browser console testing uses `__mall.g.debug.run('closing', 'drop', 'janitor')` and `__mall.g.debug.run('closing', 'grant', 'guard')`. Omit the boss ID to use the next eligible key.
- Shared files changed include `createGame.js`, `events.js`, `main.js`, `debugCommands.js`, `bossDirector.js`, and the power-up and HUD modules.

## 10 November 2026 - Shopping window: a 20 s break and "Clock in"

- **Why.** The fun review's headless bot found no calm moment to use the shops: the break was 10 s and the last two zombies of a round
  already run. The last-two rule is unchanged.
- **The break is 20 s** (economy.rounds.breakSeconds, was 10). At the 5 m/s walk that is 100 m of mall instead of 50; the wait before
  round 1 (firstRoundDelay, 3 s) is unchanged.
- **Clock in.** During the break before round 2 and later, a prompt under the round box reads "[I] Hold to clock in" with a fill bar,
  below CLOSED FOR RESTOCK. Holding Inspect (I / D-pad down) for 0.8 s brings the zombies after a 1.5 s lead: 2.3 s instead of the
  rest of the break. It takes a fresh press made while the prompt is up, works once per break and is ignored behind an open menu. A
  tap still inspects the gun. The PA says "An associate has clocked in early. Doors are opening now!" with the chime.
- **Why Inspect and not F.** Hold F is the buy button, and the break is for buying: a hold that just misses a shop item must not end
  the break. Inspect was the one existing action with no hold meaning. The action is a config value (economy.rounds.clockIn.action).
- **How it is wired.** game/clockIn.js is created and ticked in createGame (just before the rounds), calls rounds.endBreak(lead) and
  emits 'clockIn' { round, skipped } on g.events; the PA line is a listener. No new callback goes through createGame. Play again:
  reset step 'clockIn'.
- **Measured headless (the real game, 60 Hz).** Last zombie gone to first spawn of round 2: 20.0 s untouched, 2.3 s with the hold
  started at once. Not measured: the review bot was not re-run (it never clocks in, so it would only show longer runs).
- Shared files changed: src/config/economy.js, src/config/controls.js, src/game/createGame.js, src/game/events.js, src/game/rounds.js,
  src/main.js, src/ui/hud.js, src/style.css, tests/rounds.test.js, docs (history, folder-structure, tests).

## 10 November 2026 - Closing Time: the plan (document only)

docs/closing-time-plan.md plans a run goal with an ending, from the fun review's step G. No code changed.

- **The shape.** A closing checklist of four lines, one per boss: each boss drops a key (a floor pickup that never times out), and the key opens a duty that costs
  points: 12 kills with the Electrified Fountain, a 4,000 deposit in a night safe, one more Build-A-Blaster order, and a 5,000 parking validation. The exit is Skylar's
  van in Customer Parking. The final boss, the Last Customer, is built from the Cart Pusher charge and Kettle's backup, with ONE new mechanic: her bar cannot be emptied
  to death, she has to be returned (a Return to Sender beam, or a hand stamp). A Returns Desk sells Return to Sender for 10,000 once three lines are ticked.
- **Twelve phases**, each leaving the game working; an ending exists after the third. Phase 2 (the first time a run ends without a death) is the risky one.
- **The user's ten decisions are recorded at the top of the plan** (10 November). Three went against the plan's first draft: the ending opens as soon as the checklist is
  done (no round-20 gate, so the win moves to round 16 or 18: 21 to 33 bot-minutes), overtime is harder (extra health a round, more kill pay), and keys are floor pickups.
  Also decided: Return to Sender's ammo is sold only at the Returns Desk (2,500), which takes it off the 400-point RESTOCK-O-MATIC and the Prize Counter.
- **From the review bot's saved runs** (summarised with its report.mjs, not re-run): the end of round 20 comes at 30.3 min for the good bot and 39.2 for the average one, with
  about 95,000 points earned; the required quest costs 12,000 (12.5% of that). The bot's surplus only starts at round 24, after the win, and in 40 runs where it could
  die it never got past round 11. Both are listed as risks.
- The plan lists which side systems the quest uses (bosses, the fountain, Build-A-Blaster, the parking lot, the receipt, Return to Sender) and which it does not
  (power-ups, attachments, prize tickets, Limited Editions, the claw, the wardrobe, Kevin).
- Shared files changed: docs/history.md and CLAUDE.md (the docs index row and build-order line 9 now point at the plan).
## 10 November 2026 - Build-A-Blaster order form

**Your Blaster** now tells shoppers that a built blaster hits much harder and holds more ammo. The summary stays visible below the scrolling choices.
## 10 November 2026 - Soften round 7: gentle Shopper gait ramp

Round 7 previously spiked deaths sharply: 30% of Shoppers spawned running at 4.6 m/s, outpacing the player's backpedal (3.9 m/s)
and strafe (4.25 m/s). The run share now ramps in gradually across rounds 7, 9, 11, and 14 instead of an abrupt 30% jump at round 7.

- **Gait progression:** `src/config/zombies.js` `shopper.gaitsByRound` updated:
  - Round 1: 100% walk (2.0 m/s)
  - Round 3: 70% walk, 30% jog (3.4 m/s)
  - Round 5: 35% walk, 65% jog
  - Round 7: 25% walk, 65% jog, 10% run (4.6 m/s) [previously: 15% walk, 55% jog, 30% run]
  - Round 9: 15% walk, 55% jog, 30% run
  - Round 11: 40% jog, 60% run [previously: round 10]
  - Round 14: 15% jog, 85% run [previously: round 13]
- **Measured results (20-seed mortal bot batch, `node scratch/batch.mjs SENSIBLE good mortal 1 20 40`):**
  - Before death-round distribution: round 6: 3 (15%), round 7: 8 (40%), round 9: 5 (25%), round 10: 1 (5%), round 11: 2 (10%), round 12: 1 (5%).
    Mean death round: 8.15. Mean survival time: 329.3 s. 7 of the 8 round-7 deaths were killed by Shoppers.
  - After death-round distribution: round 6: 3 (15%), round 7: 5 (25%), round 9: 1 (5%), round 10: 7 (35%), round 11: 2 (10%), round 12: 2 (10%).
    Mean death round: 8.90. Mean survival time: 398.1 s. Round-7 deaths dropped from 8 (40%) to 5 (25%), with 11 of 20 runs reaching round 10+.
- **Shared files changed:** `src/config/zombies.js`, `docs/history.md`.
- **Not checked by hand:** manual browser play-feel of the transition into round 7; verified headlessly via 20-seed bot simulations, `npm run test:quick`, `npm test` (1,123 tests passing), and `npm run build`.
## 10 November 2026 - Economy proposals A, C and D applied (B is not)

Approved from docs/economy-report.md section 6, on the claude/economy-report branch. Build-A-Blaster (B) is unchanged: 1,500, any gun.

- **A. Price Gun** damage 70 -> 58 (config/weapons.js): 434 sustained dps instead of 524; the Rivet Rifle is 1.34x it, the Foam Dart Blaster 1.31x, the Heavy
  Coil Nailer 1.49x. Round-8 Shopper: 12 body shots, was 10 (tests/balance.test.js).
- **C. Platinum** damage x1.65 -> x1.9, holdsUntilRound 14 -> 16; **Renewals** x1.06 -> x1.09 each, prices 3,000 / 4,000 / 5,500 / 7,500 / 10,000 ->
  4,000 / 5,000 / 6,500 / 8,000 / 10,000 (config/upgrades.js, economy.upgrades.renewals).
- **D. Claw grab** 1,000 -> 1,500 (economy.claw.grab).
- **A design rule changed with C, and it was not in the report**: tests/workshopPower.test.js said "a Regular build beats Platinum alone". Platinum (x1.9, 10,000
  in all) now passes a Regular build (x1.7, 1,500). The test now says a Regular build beats Premium and an Overstuffed one beats Platinum. If the old rule
  matters more than Platinum's value, Platinum has to stay under x1.7.
- tests/clawMachine.test.js pinned a 400-point sale grab; it reads the price from config now.
- The report's "today" columns are the numbers BEFORE this change. Its "after" columns were played with exactly these numbers, on 7d633bf (before the
  20-second break). tools/economyPlans.js still lists A, C and D as proposals; they now equal the game's numbers.
- Not checked: nothing played by hand; no new bot runs after applying (the played "after" runs are the evidence); docs/claw-machine-plan.md and
  docs/weapon-balance-pass.md still quote the old numbers in their tables.

## 10 November 2026 - Economy report and power-curve proposal (no gameplay changes)

The report four plans were waiting for: docs/economy-report.md, written from `npm run sim:economy` (tools/economySim.mjs). Nothing in src/ changed;
the report PROPOSES numbers and they wait for approval. Built in the claude/economy-report worktree (.claude/worktrees/economy-sim).

- **The tool.** tools/economyBot.js is the review's throwaway bot, kept: the real game headless, a bot that aims with error, kites, and shops by
  teleport from a buy order (tools/economyPlans.js PLANS), immortal or with one life. New in it: income split by source (wallet.earn is wrapped and
  each 'hit' / 'kill' claims what was just paid), every purchase with its round and cost, the loadout as each round begins, a claw step (pay, press
  over the best capsule with a 0.12 s timing error, take it only if it beats the gun it would replace) and a give-up after 25 minutes in one round.
  tools/economySim.mjs plays plan x skill x seeds in child processes (12 at a time here), keeps each finished run in scratch/economy-sim/ keyed by a
  hash of src/, the bot and that plan, and prints every table as markdown. tools/economyModel.js is the maths beside it (wave mix, points a zombie,
  the upgrade ladder, "rounds of zombie health" a multiplier buys back). PROPOSALS are config changes applied in memory in the process that plays the
  run, so before/after is measured with src/config untouched. tests/economySim.test.js keeps it alive (two-round run, books balance, proposals and plans
  point at real config).
- **Measured, today's numbers** (8 immortal runs a skill to round 30, 40 one-life runs a set-up; 588 runs in all with the proposals):
  216,000 points by round 30 for either skill (the review: 216,140); 600 / 2,000 / 5,200 / 9,500 / 15,400 in rounds 1 / 5 / 10 / 20 / 30. A quarter to
  nearly half of it is +10 hits, so a weaker gun earns more (Price Gun only: +29%). The sensible buyer has the Rivet Rifle in round 5, the first build
  in round 7, Platinum in 11 or 12 and the whole 106,500 list by round 23; then nothing to buy (104,000 unspent at round 30; ammo is 3% of income).
  A Shopper takes 0.3 to 0.85 s of fire from round 1 to 23 while its health grows 14 times, then 1.4 s by round 30. One-life runs: the good bot is dead by
  round 7 half the time and reaches round 10 in 38% of runs; the average bot dies in round 6 and never reaches 10; without builds 25% reach round 10.
  The review's four findings are confirmed; one addition: a build on the Price Gun (shutter, Promenade, build: 3,750) is affordable in round 5.
- **Proposed, not applied** (section 6 of the report, each with a played before/after): A. Price Gun 70 -> 58 damage (the Rivet Rifle goes from 1.11x
  to 1.34x; no clear survival cost). B. Build-A-Blaster 1,500 -> 4,000 and only for a gun under Premium warranty (first build in round 9; needs a
  rule in the order form), or 5,000 with no rule (round 8), or 3,000 (the mild one). C. Platinum x1.65 -> x1.9 and Renewals x1.06 -> x1.09 at 4,000
  to 10,000 (Platinum 435 -> 193 points per +1% damage). D. Claw grab 1,000 -> 1,500 (the first grab wins 1.01x its price instead of 1.52x).
  **B costs survival**: 15% (4,000 + Premium), 13% (5,000) and 28% (3,000) of good-skill one-life runs reach round 10, against 38 to 40% today.
- **Two things learned the slow way.** (1) One-life results are very noisy: the first 20 runs on today's numbers had a median death round of 10, all
  40 have 7, and proposal C (the same game until round 11) is the built-in noise check. (2) The same seed with the same numbers does not always
  play the same run in the headless game (runs agree to about round 4, then drift). Not investigated; seeded tests may be exposed to it.
- **Machine time**: round-30 runs are slow (about 17 minutes each with 12 running at once), so the whole set is roughly an hour and a half from an
  empty cache. --quick (2 seeds to round 10, 4 one-life runs) took 6.5 minutes while another batch was running; it was not timed on an idle machine.
- **Shared files changed**: package.json (the sim:economy script), CLAUDE.md (one command line, one docs-index row), docs/history.md,
  docs/folder-structure.md, docs/tests.md, docs/claw-machine-plan.md and docs/kiosk-kevin-plan.md (one sentence each: the report exists now).
- **Not checked**: nothing was played by a person; shopping is a teleport and builds were never fought for (Understuffed or Regular only); everything
  past round 14 is from bots that cannot die; the proposals were played at good skill (average only for today's numbers and one-life runs with
  everything in); the 3,000 build and a 62-damage Price Gun were played for survival only; the bot never uses hazards, the Soda Bomb, attachments, prize
  tickets, the Confetti Cannon, the Barcode Scanner or a claw-only gun. npm test, npm run build and an unchanged npm run balance were run before the commit.

## 9 November 2026 - Wardrobe showroom: upstairs showpieces and on-player looks

- **Three upstairs fixtures.** A cardboard B-movie monster with a waving arm sells 3D Glasses beside Concessions. Shoe-Per Sale’s light-up
  disco tile and giant sneaker face its west entrance. The walking-club mannequin and moving treadmill face its east entrance. Each
  uses the Food Court purchase, PA and sold-out flow. The two shoe prompts and the mirror each have a separate approach.
- **First person.** Knit sleeves and reflective tape follow every gun and workshop build. Looking down shows the cardboard board, belt pouch,
  and the shoes with glowing soles, broad white uppers or heel wheels. The wheels spark during a slide. The foam finger rides the box-cutter swing.
- **HUD and eyewear.** Paper Hat gets a regen pip. Cardigan and Sandwich Board style the health bar. Light-Ups and Orthopedics style stamina.
  The Fanny Pack marks the actual reserve count, Gold Card marks paid kills, and both kinds of glasses tint or fringe the screen at its edges.
  Equip changes and Play Again update the visuals through the existing events.
- The headless 4:3 benchmark route with static batches and room culling estimates 326 to 327 average map calls. The shot averages sum to
  three added calls, with a peak increase of five in the hallway. The Food Court sample’s three-piece reference added 70 summed and 28 at peak.

## 9 November 2026 - Wardrobe showroom, phase 2: six ground-floor showpieces

- **Hallway and Mega Mart.** The MEMBERS ONLY kiosk faces the start shutter with a glinting Gold Card, red carpet and velvet rope. The front checkout
  gaps hold the megaphone mannequin with chasing sale bulbs and the AS SEEN ON TV bin with a bouncing Fanny Pack.
- **Service Corridor, HOFFMAN’S and Atrium.** An open locker with a rotating beacon stands beside the staff lockers, clear of the vent lane.
  The Heirloom Cardigan turns on a roped-off plinth on the front floor, clear of the KNITS racks and main gate. The mirrored glasses spin
  above a chrome tower beside SHADE SHACK, with sweeping floor decals.
- The Food Court purchase flow drives all six. Each has its own motif and PA line, strikes a pose on purchase and settles with a dimmed SOLD OUT
  display until Play Again. Placement and prompt checks are in tests/showpieces.test.js. Anchors are listed in docs/map.md.
- Headless draw-call estimate using the benchmark route, room culling and static batches (4:3, all shutters open). The Food Court sample added
  70 calls summed across the shot averages, with a largest increase of 28 on one shot. The six fixtures add an estimated 57 summed and 18 on
  the highest-delta shot (atrium ring). Route-average map calls rose from 322 to 326.

## 9 November 2026 - Box cutter tiers at Customer Service

The box cutter did a flat 150 forever while Shopper health climbs to 1,157 by round 15 and 1,662 by round 20, so melee stopped mattering around round 4. Two tiers now sell at the
Customer Service booth's SECOND window (1.25 m along the counter, a SHARPENING sign; the gun window is unchanged and the nearest window wins the prompt):

- **Sharpened Blade** (1,500): damage x3. **Box Cutter Pro** (4,000): damage x5, a 140 degree cone instead of 80, and the nearest TWO zombies a swing, each with its own hit,
  splatter, +10 / kill and 70-point melee bonus. Numbers: config/upgrades.js `melee`, prices economy.upgrades.melee through `g.pricing.priceOf('melee', id)`.
- **How it is wired:** four new stats (meleeTier, meleeUpgradeDamage, meleeHalfAngleDegrees, meleeMaxTargets) in the stats object, written by game/meleeUpgrades.js, so Play again's stats
  reset puts them back and Loss Prevention (meleeDamageMultiplier) still stacks on top. melee.js: `findTargets` (every live target in the cone, nearest first) replaces `findTarget`; the
  strike hits the first meleeMaxTargets and skips one already dead. The viewmodel recolours the cutter per tier. No headshots, as before.
- **Swings to kill a Shopper** (`npm run melee`, tools/meleeReport.mjs; 0.37 s a connected swing). Before = the plain column:

  | round | Shopper hp | plain | Sharpened | Pro | plain +50% | Sharpened +50% | Pro +50% |
  |---|---|---|---|---|---|---|---|
  | 1 | 150 | 1 | 1 | 1 | 1 | 1 | 1 |
  | 5 | 450 | 3 | 1 | 1 | 2 | 1 | 1 |
  | 10 | 806 | 6 | 2 | 2 | 4 | 2 | 1 |
  | 15 | 1157 | 8 | 3 | 2 | 6 | 2 | 2 |
  | 20 | 1662 | 12 | 4 | 3 | 8 | 3 | 2 |

  (+50% = Loss Prevention / the wardrobe's melee bonus.) Kills a second against one target at round 20: 0.23 plain, 0.68 Sharpened, 0.90 Pro; against two in the cone the Pro doubles that.
- Not checked: any of it by hand in a browser (the second window's placement, the sign, the cutter's tint, the prompt when standing between the two windows); numbers and prices were set
  from the table above, not from a playtest.
## 9 November 2026 - Environmental hazards, phase 1: the plan and the Electrified Fountain

Planned four pay-to-trigger mall hazards in `docs/archive/hazards-plan.md` (**Electrified Fountain** in the Grand Atrium, **Fryer Blast** at Corn Dog Corral in the Food Court, **Fire Sprinklers** in the Main Hallway, and **PA System Lure** in the Service Corridor; dropped **Toppling Shelves** and **Escalator Reversal** to avoid runtime navigation rebuilds, unbatching Mega Mart's static product shelves, and escalator dynamic-mesh invariants). Built the shared hazard framework (`src/config/hazards.js`, `src/game/features/hazards.js`, `hazard` pricing category in `src/game/pricing.js` and `src/config/economy.js` with a `'hazards'` Flash Sale group) and the first hazard, the **Electrified Fountain** (`src/game/features/fountainHazard.js`, `fountainHazard` on the south fountain rim in the Grand Atrium): 750 points, 8 s active (`0.4 s` pulses across a `7.0 m` radius) with opening stagger surge, convulsion slow (`0.25`), round-proof lethality (`max(200, 55% maxHealth)` per pulse on normal zombies; `10% maxHealth` cap per pulse on Bosses and Mascots), energized `3.7 m` fountain tower + 4 waterfall sheets + expanding shockwave ripple + jagged 4-segment forked lightning bolts + industrial breaker box with voltage needle and spark bursts, 25 s recharging cooldown, and clean Play-again reset without changes to `createGame.js`. Tested in `tests/hazards.test.js`.
## 9 November 2026 - Kiosk Kevin, phase 1: two pockets, the buttons and the Soda Bomb

The first piece of docs/kiosk-kevin-plan.md, built in the claude/kiosk-kevin-1 worktree: no Kevin, no cart, no Bubble Wrap, no tacticals, no Sentry yet.

- **The buttons** (config/controls.js): `lethal` = G / RB, `tactical` = middle click (Mouse1) / D-pad right. The box cutter loses RB and keeps V and R3 (COD's
  layout), so prompts say R3 on a controller. God mode's debug key moved from G to plain B (Shift+B is still the benchmark). A middle mousedown is always
  preventDefault'ed in core/input.js, so it can't start the browser's autoscroll before the pointer lock. The Controls screen has lines for both throws
  (new diagram anchors: G, the middle button, R3 and D-pad right).
- **game/equipment.js** (g.equipment, built and ticked in createGame after melee and before the gun): two pockets, each one product with charges;
  give(id, count) adds to the same kind and replaces another. A tap throws; isBusy (kiosk.throw.blockSeconds 0.4) joins gun.update's `blocked` and
  holds off the box cutter; a throw cancels a reload; refused while switching, vaulting, swinging, in a menu or dead. In a menu the buttons are not
  read at all, so the order form and fitting room keep D-pad right. A new 'equipment' reset step right after 'balls'; death clears thrown things.
- **Throwables:** weapons/ballistics.js got `zombies: 'bounce'` (a zombie is bounced off, never hit), and createGame makes a second instance
  (g.throwables) ticked right after `balls`. fx/throwableView.js draws the bottles (main.js).
- **The Soda Bomb** (config/kiosk.js; damage in game/equipment/equipmentDamage.js): 3 charges, lobbed 14 degrees over the crosshair, bounces, bursts
  1.8 s after the throw (a bottle that stops rolling waits for its fuse). 4 m blast, 850 x equipmentPower(round) at the centre, 0.3 of that at the
  edge, nothing through a wall; a boss takes 6% of its max health at the centre (same falloff). Distance is to a zombie's nearest hitbox, so a
  bottle at its feet is a centre hit. takeHit source 'equipment': it pays only through 'kill', never 'hit' (no +10, no boss onHit reactions, no
  power-up credit, which counts only 'gun' and 'melee'). Anything without a zombie type or with noRewards (Sunny, fans, test-range dummies) is skipped.
- **Measured** (tests/equipment.test.js on real Shoppers): equipmentPower is 0.54 / 1.00 / 1.50 / 1.71 at rounds 1 / 10 / 25 / 30, as the plan's table;
  a centre hit kills a Shopper at rounds 1 and 10 and takes 40 to 60% of one at round 25 (1,273 of 2,386).
- **HUD:** hud.setPockets: two pocket icons with their count and button left of the ammo count (a red bottle for the Soda Bomb); an empty pocket is a
  faint dashed outline. New events 'equipmentThrown' and 'equipmentBurst' (game/events.js). A keyless debug command fills the pockets:
  `window.__mall.g.debug.run('pockets')` (debugCommands.js `keyless`, so the key table and its tests are unchanged). The burst sound is 'sodaBurst'.
- Not checked: any of it by hand in the browser (the throw's feel, the arc, the bottle and HUD icons, the sound by ear); there is no throw animation
  on the viewmodel yet (the gun just can't fire for 0.4 s; phase 8 is spectacle).

## 9 November 2026 - GRAB-A-GUN, phase 10: RETURN TO SENDER, the wonder weapon (claw-only)

Settled with you before it was built: the plan's working idea, name and all, and bosses and Mascots take a BIG FIXED HIT (not just a normal hit). A returns-desk scanner whose
beam boxes one zombie and returns it to the manufacturer: an INSTANT KILL, at any round, one zombie a beam (no pierce). Rainbow capsule (hot pink), weight 1 of 115: the
rarest prize, a mall joke you cannot buy anywhere (clawOnly). Five-round magazine, 14 in reserve, a beam every 0.7 s, a 3 s reload.

- **The instant-kill rule** (weapons/gunStats.js hitDamage gets the target): a returnable zombie takes INSTANT_KILL_DAMAGE (more than any health; takeHit's own damage-taken
  factors still apply, so it stays lethal); a boss or a Mascot (type.boss / type.mascot, isReturnable) takes 12% of its MAX health per beam, times the gun's tier damage and the
  player's damage stat: 8 beams for a boss, never a one-shot. Nothing else changes for any other gun (the new argument is optional). A returned zombie is boxed in cardboard and tape
  (confetti in cardboard colours, the 'returnStamp' thump) instead of the usual splatter, and the wall it hits gets a red RETURNED stamp (impactModels 'returnStamp').
- **The half-rate refill** (weapon.js refillFraction 0.5, refillReserve): a refill (RESTOCK-O-MATIC, an ammo buy, a Refurbished grab, a Stockroom Delivery) fills the magazine
  and only HALF the reserve, never takes ammo away, and "full" (isFull, which ammo machines read) means that. It starts with all 19 rounds; a refill gives 5 + 7 = 12.
- **Balance, measured** (tools/balance.js killsPerSecond; npm run balance has an INSTANT-KILL GUNS table): 0.86 kills a second, sustained, at any round (one target, 5 m).
  The best other gun is the Heavy Coil Nailer: it kills faster until about round 10 (64-round drum), then Return to Sender is 1.2x at round 12, 1.5x at 15, 2.2x at 20, 3.2x at 25,
  4.6x at 30 (0.27 and 0.19 kills a second for the Coil Nailer there). Held back by what it carries: 19 rounds against a round-25 wave of 66 zombies, a refill under a fifth of one,
  never more than a kill every 1.2 s. tests/balance.test.js checks all of that. A first cut (4 rounds, 0.8 s, 3.2 s reload) was only 1.27x at round 15: tightened to the above.
- **Build-A-Blaster rows** (node tools/babReport.mjs returnToSender 25,30 14 2: the real game, a pack of 14 Shoppers, a bot that never moves; run on both the first cut, 4 rounds and 0.8 s, and
  the final 5 and 0.7 s, with identical rows: the clear time is set by the pack walking up to the bot, since every beam kills): a plain Return to Sender clears the pack in 26.4 s at round 25 (26.8 s at 30), and NO build changes that by more than 5% either way (Deluxe 26.1, Platinum 26.3, every
  stuffing + heart 27.5, Overstuffed fryer oil 25.5, Deluxe + fryer oil 25.2; round 30: 25.6 to 27.9): it already kills in one shot, so a stuffing adds nothing to the clear time; what
  the builds change is damage TAKEN (Popcorn Butter 380 against 1,080 plain at round 25, Glitter 280). The stuffings scale from the gun's nominal damage (150: gunPower under half a Price
  Gun's), so procs are a mid gun's, not a wonder weapon's; a test checks that and that the Last Round heart fires on the round that empties it.
- **Odds** (npm run sim:claw, nominal value 4000, no wall route): per grab at 3-in-4 timing Return to Sender is won 2.0% of grabs (perfect 2.7%, timed 2.5%, random 0.9%), in the pit
  2.7%: about 50 grabs or 47,600 points of grabs per copy at 1,000 a grab (71,400 at 1,500). With the three claw guns in (weights total 115) the first grab after the shutter is worth
  1.52x its price at 1,000 (85.7% Blue or better; 1.01x at 1,500), up from 1.46x, because the nominal 4000 lifts the average: the same must-buy at 1,000 phase 4 flagged, still not
  applied; and the wall is still the cheaper way to every wall gun. npm run sim:claw -- 1500 has the 1,500 tables (value per point 1.00 at 3-in-4 timing).
- Not checked: any of it by hand (no playtest of a round 25+ with it: the numbers above say what it does, not whether it feels right); the rainbow capsule is one hot-pink
  colour, not a shimmer; the sound by ear.

## 9 November 2026 - Hallway directory flicker

The hallway directory (north wall, x -6.9) hangs over the boarded vent, and its lowest row (Cinema · Upstairs, West) shared a plane (z 5.94) with the vent's top plank (y 1.15-1.35), so a brown
streak flickered across the text. The directory is raised 0.25 m (atmosphere.js `directoryRise`). It slipped past tests/coplanar.test.js because atmosphere.js signs carry flipped Euler angles and
the test skips any rotated mesh; a new test there checks every flat sign by its world normal.


## 9 November 2026 - GRAB-A-GUN, phase 9: the Tennis Ball Launcher

The second claw-only gun, and the first thing in the game that is not hitscan: the trigger THROWS a ball that flies, bounces and hits later. Purple capsule, weight 7 beside the
Barcode Scanner and the Leaf Blower. A pump launcher: 6 balls a magazine, 30 in reserve, a ball every 0.45 s, 50 damage a hit (headshot x1.5), a reload with the support hand
fetching a ball. In the open it is weak (one lobbed hit a ball: 66 sustained dps, below the Price Gun at every range); in a clump or off a wall one ball hits again and again.

- **Engine first, with its own test** (weapons/ballistics.js, tests/ballistics.test.js): a ball under gravity (6.5 m/s2, 21 m/s out), swept against the world and the zombies
  (castShot) every 60 Hz tick; every wall, floor or zombie contact is a BOUNCE (it keeps 84% of its speed; spent at 5 bounces, 3.2 s, or slower than 2.2 m/s). A zombie it
  touches is hit (the gun's own damage maths, falloff by the metres the BALL has flown), and the ball is thrown on, lifted for gravity, at the nearest OTHER zombie within 3.5 m
  in view (not through a wall), passing straight through the zombie it just hit (so zombies in a line are chained, not hit twice). DOM-free; createGame ticks it after the zombies,
  clears it on death and on Play again (the 'balls' reset step). fx/ballView.js (browser only) draws the balls between last tick's position and this one's.
- **Counting.** One pull is one shot (counted at the throw; haptics and Build-A-Blaster hearts see it at once); the ball's FIRST hit on a zombie makes it a hit for the run's
  accuracy, however many it touches after. Each zombie touched is a hit: +10, hit marker, splat, and a kill pays as usual.
- **The role, measured in the real game** (tests/tennisBallLauncher.test.js; frozen Shoppers, seeded spread): a lone zombie in the open is 1 hit a ball; three Shoppers in a line
  1.5 m apart 5 hits a ball (the cap); three spread 5 m apart 1; a lone zombie at the Service Corridor's mouth 2 (the walls send it back). So a ball can do at most 250 (5 x 50),
  330 sustained dps if every bounce hits, against 66 with one hit a ball. A first attempt at damage 55 / 6 bounces / 5.5 m of seeking chained everything everywhere (6 hits a
  ball even across the open hallway): the numbers above are the retune.
- **Odds** (`npm run sim:claw`, nominal value 1500, no wall route): per grab at 3-in-4 timing the Tennis Ball Launcher is won 9.2% (perfect 11.0%, timed 10.5%, random 6.2%), in the
  pit 18.1%; about 7,000 points of grabs per copy at 3-in-4 timing (about 6,000 with perfect timing and the Hallway): the only way to it. Weights now total 114; the wall is
  still the cheaper way to every wall gun, and the first grab after the shutter is 1.46x its price (85.6% Blue or better).
- Also: tests/impactMarks.test.js skips projectile guns (a ball marks no wall the way a ray does), the balance report has a BALL GUNS table, tests/balance.test.js has the job test.
- Checked in the browser pane (preview build): the viewmodel, a throw with its splat and points, a clump chained for five hits. The pane was hidden, so zombies were drawn part-risen
  (stale frames): the ball in the air was not seen in a frame, only in the game state. Not checked: the sounds by ear, a Build-A-Blaster build on it, a controller.

## 9 November 2026 - GRAB-A-GUN, phase 8: the Leaf Blower (the first claw-only gun)

A wide cone of wind that shoves everything in front of you back and lays the close ones flat, for a corridor or a doorway. It is crowd control, not damage: a pulse
does 2 (a full 40-pulse tank is 80, less than a round-1 Shopper's 150), and it only reaches 7 m. Claw-only: `clawOnly: true` in config/weapons.js, no wall price, and
the wall-buy feature refuses a clawOnly gun even if a map names it. Purple capsule, weight 7 beside the Barcode Scanner (config/clawMachine.js prizes).

- **Engine first, each with its own test.** weapons/fuel.js: a fuel TANK instead of a magazine. Holding the trigger pulses every 0.15 s and burns a unit each (40 = 6 s of
  blowing); let go and it refills itself after 0.8 s at 7 a second (6.5 s to full); run it dry and the trigger LOCKS until it holds 10 again (no sputter), with no reload. The
  tank's level is the weapon's `magazine`, so the HUD ("40 fuel", "Out of fuel"), RESTOCK-O-MATIC, Refurbished grabs, Build-A-Blaster and the Stockroom Delivery work on it
  unchanged. weapons/coneBlast.js: who is in the cone (range, 28 degrees each side, a wall blocks it, height forgiving so a zombie at your feet is caught), what the blast does
  (the zombies' OWN stagger and slip, so no new zombie state: stronger up close, a Mascot shoved at half, bosses and a zombie already sliding untouched), and a ledger so a stream
  pays the +10 hit once per 1.2 s per zombie, not every pulse (a kill still pays in full). playerGun.js fires a cone gun through fireCone; the kick/sound code is shared (kick()).
- **The gun** (config/weapons.js leafBlower, weapons/models/leafBlower.js: orange motor, red fuel tank with a level window, ribbed flared nozzle; sound leafBlowerPuff). Upgrades
  mean something sensible: Jumbo Pack / the tier magazine = a bigger tank, Speed Loader / the tier "reload" = a quicker refill (upgrades.js EFFECTS: reload -> fuel.regenPerSecond),
  Extended Nozzle / Sawn-Off move the cone's reach with the damage falloff. `npm run balance` has a CONE GUNS table (tank, blow and refill seconds, shove, knockdown range).
- **Tests.** tests/balance.test.js: the role tests compare the guns of the wall only (`clawOnly` filtered out of them and of tests/upgrades.test.js's role checks), and the Leaf
  Blower has its own job test. tests/impactMarks.test.js skips cone guns (wind marks no wall), tests/newGuns.test.js lets a clawOnly gun have no price. New: fuel.test.js,
  coneBlast.test.js, leafBlower.test.js.
- **Odds** (`npm run sim:claw`, tools/clawOdds.js gives a claw-only gun a nominal `value` of 1500 and no wall route): per grab at 3-in-4 timing the Leaf Blower is won 10.3% of
  grabs (perfect 12.5%, timed 11.7%, random 6.7%), in the pit 19.7%; the wall is still the cheaper way to every WALL gun, and the first grab after the shutter is worth 1.46x its
  price (84.7% Blue or better), as before. Specific copy: about 6,400 points of grabs at 3-in-4 timing (5,500 with perfect timing and the Hallway): the only way to it.
- Checked in the browser pane (preview build): the viewmodel, a stream pushing a crowd back (hit marker, fuel count), the dry tank. Not checked: a Build-A-Blaster build on it
  by hand (only the tests that loop over every gun cover it; its Heart triggers fire per pulse, with their own cooldowns), the sound by ear.

## 9 November 2026 - GRAB-A-GUN (phases 1-7) lands in main

The claw machine branch (claude/claw-machine) was merged into main through a fresh branch (claw-into-main): 8 commits, 45 files, behind main by the Wardrobe showroom, the
words-only rule and the look pass. Both sides of every shared file were kept (createGame.js, pricing.js, features/index.js, economy.js, hud.js, main.js, debugCommands.js,
tests/pricing.test.js, tests/features.test.js, the docs).

- **Words only.** The Slow Claw card said "half speed": now "sweeps slowly" (a multiplier in words is still a multiplier). Prices, points, ticket counts, "N left" and the
  grab's countdown stay numbers, and the claw Flash Sale keeps its percentage like every sale. tests/effectWords.test.js now scans every claw machine string in config
  (names, screens, PA lines, the Prize Counter's cards, the sale) and every real prompt the machine and the counter build (pay, drop, take, Refurbished take, each prize card,
  refused and affordable), and also rejects half / twice / double / triple / times in them.
- **The Prize Counter moved** from the Hallway's north wall at x 3.65 to x -13: the Wardrobe's Gold Card rack took x 4.7 of the same stretch (it showed up as the rack's display
  intersecting the booth). x -13 keeps the booth's own checks (a clear stand point 5 m from the boarded vent at x -7, routes unchanged, no coplanar faces). tests/staticBatch.test.js's
  wall ray moved from x -12 to x -9.5 (it now hit the booth); tests/features.test.js's "unknown kind" placeholder is a made-up kind, since fittingRoom and clawMachine are real now.
- Checked in the browser pane (preview build): the Hallway machine, a grab to the take prompt, the moved REDEMPTION booth and a card prompt; no console errors.

## 9 November 2026 - Design change: effect numbers are gone from the UI (words only)

Flash Sales are the exception, by decision: a sale is a PRICE, so its PA lines, the HUD banner and the help screen keep the percentage ("25% off"). They were changed to
"much cheaper" at first and put back the same day.

Decision: players never see what an upgrade does as a number. No percentages, multipliers, "x1.25", "100 → 125", seconds or damage values describing an effect, anywhere
in the UI. Effects are short plain lines with a rough size where it matters. Kept: prices, points, ammo counts, the round, the health and sprint bars, countdown timers
(a sale's seconds, an incentive's time left), charges left, and records of what happened (accuracy, "212 confirmed", the tank's kill count).
Gameplay numbers are unchanged; the debug panel and tools/gunReport.mjs still print numbers.

- **Where the numbers were**: the attachment counters' comparison line (magazine, reload seconds, damage, metres, degrees, FOV %: weapons/attachmentComparison.js, now deleted);
  Warranty tier jobs; the Smoothie blurb ("25% more") and Popcorn Butter ("double"); the Wardrobe's generated tickets ("Max health 100 → 125", "Reload 25% faster": the
  `statLabels` formatter) and so the fitting-room picker and the pause screen's ON YOU lines; incentive hints and PA lines ("30% OFF · SAVE UP TO 300", "Thirty percent off",
  "twenty-four seconds", "DOUBLE DAMAGE", "Double clearance credit"); two boss PA lines
  ("Half off… up to 2,000", "twenty-five percent").
- **How it works now** (config/effectWords.js): one fixed set of size bands (a little / noticeably / much, by how big the change is, the same either way round), a
  `{size}` / `{Size}` token in a line, and the wording lives next to each item in config: `lines` on every warranty tier, renewal, attachment and wardrobe item (one short
  line per upside / downside, `effect` = the multiplier that sizes the token), `blurbRatio` on stuffings, and plain hand-written hints for incentives. `statLabels` became `statBetter` (which direction of a stat is good).
- **Guard**: tests/effectWords.test.js scans every tier, attachment, wardrobe, stuffing, incentive, sale and boss string, and the real prompts built from them, for a digit followed
  by %, x, s, m, ° or an arrow (and spelled-out percentages). Tests that asserted numbers were rewritten.

## 9 November 2026 - Wardrobe showroom, phase 3: the outfit rail

Phase 3 of docs/wardrobe-showroom-plan.md (sections 3-4). The four grey text chips are gone.

- **The rail** (ui/outfitRail.js, ui/outfitIcons.js, retail.css): a chrome hanger rail over the health bar with four price tags, one per slot, in the item's colour with its
  SVG icon and short name. Empty slots are dashed silhouettes (HEAD / TORSO / FEET / EXTRA), visible from round 1 (v1 hid the strip until the first buy).
- **Tags react when the item works** (game/outfitRail.js; each item's trigger is its `pulse` in config/wardrobe.js): Paper Hat on 'regenStart'; Sandwich Board and Hi-Vis Vest on
  'playerHit'; Cardigan on a hit that landed above the base 100 health (the knit took it); Gold Card on a kill that paid; Foam Finger on a box-cutter hit; 3D Glasses on a gun
  headshot; Light-Ups and Orthopedics on a sprint start; Wheelies on a slide start; Aviators on aiming start; Fanny Pack on a refill that takes the reserve above the gun's base.
  Only the WORN item pulses, only on its own trigger, never after death. The bus event is 'outfitPulse' { id, slot }.
- **Pause screen**: an ON YOU row, the rail large with each worn item's lines (the ticket formatter's `wornLines`: "Max health 100 → 125", upsides green, downsides red).
- **Death receipt**: a DIED WEARING: row with the four tags (an empty slot dashed); the run summary carries `wearing` (slot -> item id).
- Not built: the hover detail on the HUD rail (the pause screen is where the lines live), and phase 4 (what you look like on yourself).

## 9 November 2026 - Wardrobe showroom, phase 2 sample: the three Food Court showpieces

The first three showpieces of docs/wardrobe-showroom-plan.md section 1, built as the sample to approve before the other nine.

- **Paper Hat burger** on Burger Barn's roof (lid bobs, steam puffs, a neon strip + PAPER HATS sign) with a hat chute: hats drop into a tray on the counter
  where you buy. **Wheelie Sneakers ramp** on the court floor (a vaultable 0.9 m wedge, skid marks, hazard apron, giant sneaker with spinning heel wheels,
  NO RUNNING sign on a post with a neon frame). **Foam Finger**: a 3 m finger waggling out of a pennant bin with a neon ring sliding up it.
- The Wheelies and Foam Finger moved from INSIDE Good Sports (invisible from the court) to the court floor (the Wheelies at its east window, the Foam Finger out on the open court floor: a pillar hides its west half from the entrance).
- Shared behaviour in showpiece.js: idle motion while unsold; on a buy the motion snaps to a pose for 1.1 s with a spotlight cone on the buyer and the PA
  line ('wardrobeBuy' event, read by createGame's PA wiring); then it goes still, glows and signs dim, and a card reads SOLD OUT · IN YOUR SIZE. Play again
  brings it back. A 2-3 note motif per item (config/audio.js motifPaperHat / motifWheelie / motifFoamFinger) hums within 8 m while unsold.
- Survey findings: a 6 m pillar at (-13, -11.3) in front of Good Sports' door hides that shop's west half from the entrance, so the Foam Finger stands on the open court
  floor north of it (a sight-line test guards every showpiece). The Food Court's exhaust duct (y 5.5-5.85) ran through the roof burger's space: atmosphere.js now
  leaves a 2.3 m gap in it over Burger Barn (x -6.9..-4.6) and drops that stall's riser. Sold-out = still, dim glow and signs, greyed moving parts, a red SOLD OUT banner.
- Numbers: config/wardrobe.js `showpieces`. Not built yet: the other nine showpieces, the on-you looks, the rail.

## 9 November 2026 - Wardrobe showroom rework, phase 1: the picker, numbers on tickets, new numbers

Phase 1 of docs/wardrobe-showroom-plan.md (the logic and data; no showpieces, outfit rail or on-body visuals yet).

- **Fitting rooms open a picker, not a queue.** Hold interact at a mirror: four slot columns with everything you own (game/features/fittingRoomPicker.js,
  drawn by ui/fittingRoomPicker.js on the order form's paper). A/D or ◀ ▶ picks the slot, W/S or the D-pad the item, F / A wears it, Q / B closes. It stays
  open while you change several slots. Like the Build-A-Blaster order form it freezes you while the world carries on, so "walking away" can only be a shove
  or a teleport (it closes past 3 m, config/wardrobe.js fittingRoomPicker); a zombie hit, death and Play again close it too. `g.wardrobe.wear(id)` replaces
  the bag and `wearNext`. All 81 outfits are reached through real key presses in a test, each item in at most two presses within its slot.
- **Tickets are generated, with numbers** (`g.wardrobe.statLines(id)`, labels in config/wardrobe.js `statLabels`): the joke line, then what would change if
  you put the item on now, from the stats as they are (other clothes and running incentives included), then what it replaces. Upsides are green and
  downsides red on the shelf ticket and in the picker. Example, wearing the Hi-Vis Vest at the Sandwich Board: "Zombie hits hurt 36% less · Knockback 50%
  weaker · Strafing 15% slower · Reload 20% slower · Replaces Hi-Vis Vest".
- **Numbers (section 6 of the plan).** Hi-Vis Vest reload x1.25 and damage taken x1.25: a Shopper hit is 50 (measured), two hits down you. Sandwich Board
  damage taken x0.8: a Shopper hit is 32 (measured). Light-Ups sprint x1.1 for x0.9 as long (8.8 m/s for 3.6 s, 31.7 m against 32 m barefoot; still under the
  Cart's 9 m/s, and a test keeps it so). 3D Glasses headshots x1.25. Aviators aim time x0.7 plus a new stat `aimAssistMultiplier` x1.2, keeping the switch
  x0.85 downside. Orthopedics is the short name (the Mall Walker is a zombie).
- **Clothes scale zombie hits only.** `stats.damageTakenMultiplier` moved from `health.takeDamage` to createGame's 'playerHit' listener, so a fall does the
  same damage in any outfit.
- **'regenStart'** fires once each time health begins to climb back (player/health.js `onRegenStart`), for the rail's Paper Hat tag in phase 3.
- Items carry a signature `color`, an `icon` id and their `ticket` joke line in config. Debug: Shift+H gives every item (free; what you wear stays on).

`npm run balance` with no items matched main byte for byte. Not done, or not checked: the Aviators' aim-assist factor only strengthens the rotational
follow at the default dial, because slowdown and the ADS snap already cap strength at 1 (left alone; raise the cap or drop the factor after playing with a
controller). The picker was only looked at in an 800x600 preview pane with the keyboard: there its top edge slides under the round counter when the stat
block is tall, and rows change height when the "Wearing" mark moves. Nothing was played by hand, so whether the new numbers feel right is still open.
The HUD strip is still v1's four chips (phase 3).

## 9 November 2026 - Wardrobe displays and clipping audit

Twelve static, low-poly apparel displays now mark the purchases. The three fitting rooms share a lit TRY ON badge. The visual mounts and interaction anchors are separate, and the displays add no collision.

The aisle sweep checked four views per location. HOFFMAN’S badge moved above the curtain and mirror dressing. At Shoe-Per Sale, the Light-Ups sit above the mirror and the Comfort Center header clears the shoe. Mega Mart’s two displays mount on the checkout surfaces. The concessions cabinet and checkout supports were adjusted to separate coplanar faces. The useful approaches to KNITS, the Foam Finger and the staff lockers turn around a rack, stay inside the shop glass and stay within the corridor, respectively. The two Good Sports purchases and the Gold Card and warranty desk can each be targeted from their own interaction spot.

## 9 November 2026 - Wardrobe v1

Twelve pieces of apparel are sold across the mall. A purchase equips the item, and the piece it replaces goes to the back of the bag. Hold interact at HOFFMAN'S, Shoe-Per Sale or the staff lockers to swap in the next bag item for free. The ticket shows the tradeoff, the HUD shows the four equipped slots, and Play Again starts with an empty outfit. Apparel sales, Employee Discount and the Discount Code use the existing pricing system.

Controlled checks at the draft prices gave the Cardigan 125 max health, enough for one more 40-damage Shopper hit after healing to full, in exchange for 20% shorter sprints. The Fanny Pack raised the starting staple gun's reserve capacity from 60 to 75, with extra rounds supplied by the next refill. The Gold Card increased an ordinary Shopper kill from 60 to 70, so it takes 200 such kills to repay a full-price 2,000-point purchase. For comparison, the Cardigan costs the same as a first Build-A-Blaster order plus Deluxe Warranty, and the Fanny Pack costs the same as the workshop order. The empty-outfit gun balance report matched main byte for byte.

## 9 November 2026 - Look and real-mall pass: grounding, haze, sunset, shopfronts, mall section, fixtures, stories

Twenty proposals from a visual review, in two passes (look better; look like a real mall). Numbers: config/look.js (bakedShade,
grading fog, zombieRim, dusk), config/concourse.js (everything in the concourse pass), config/parkingDetails.js realism.
- Look: walls and counters darken towards their floor, baked into the static batches' vertex colours (staticBatch shadeAt);
  a per-area haze rides on zone grading (fog / fogColor, one FogExp2 in main.js; the parking sky opts out); zombies get a soft
  rim of light by kind (zombies/zombieRim.js); the sun goes down over a run (horror director state.dusk -> map.horror.setDusk:
  sky light, Atrium skylight and new sun shafts, parking sky), part of Comfort > Horror lighting; HOFFMAN'S has burgundy carpet,
  the Promenade a dusk-mauve terrazzo; a staff watch on the left wrist (the polo sleeves were already there, just out of frame).
- Real mall (maps/mall/concourse.js, built last in mall.js so every neon sign is placed): a shopfront run on Level 2's south
  wall (CASSETTE CITY, GLAMOUR PORTRAITS, EAR-RESISTIBLE) and a KEYS CUT kiosk on the north wall, each with a painted interior,
  header, blade sign and its own light spill; display windows from the hallway into BYTE ME and PLAY TIME TOYS; Level 2 soffits
  with the pink trim on their edge and a ceiling cove (the "Sunset Galleria - Level 2" sign moved onto the south soffit); a
  hallway cornice; border bands, sunburst medallions and worn lanes on the floors; a pool under every lit panel and a
  reflection under every neon sign on a shiny floor; PA speakers, smoke detectors and sprinklers; a drinking fountain with
  RESTROOMS ->, an ATM, fire pulls, mirrored pillar wraps, ashtray urns, a kiddie ride and a gumball machine in the Atrium;
  trays, a stroller, a mop bucket, balloons under the skylight, an open till; FALL INTO SAVINGS '86 pennants and poster;
  garland on the balcony rails; a directory totem; a level mark on the Atrium escalator. Parking: an accessible bay, a cart
  corral, row letters and banners on the poles, a planted kerb island, an entrance vestibule.
- Cheap by construction: plain materials merge into the existing batches; every painted panel (interiors, signs) sits on one
  canvas atlas (world/canvasAtlas.js, world/paintedInteriors.js), all shop glass is one mesh, each glow set is one mesh
  (lookKit.glowSet), the campaign is one mesh.
- Placement lessons: the first kiddie ride stood on the Atrium's west vent spawn (z 16), the cart corral sat in a combat lane
  between two vans (tests/parkingLot.test.js), a blade sign bracket and a vestibule rail shared planes (tests/coplanar.test.js),
  and a directly flagged userData.dynamic mesh (the sun shafts) is taken for an escalator part by tests/staticBatch.test.js.
- Cost, A/B against main's build at 42 fixed cameras (each benchmark shot's start, middle, end), fresh pages: every door closed
  main 263 calls / 43.3k triangles, this 270 / 44.3k; every door open main 340 / 69.0k, this 351 / 70.8k. The hallway and
  Level 2 views rise most (about +25 calls each: signs, bands and new batches); the env map and fog add no calls.
- Measuring: open doors change the counts by ~80 calls on average (culling sees through them), and a hidden pane's benchmark
  route varies by up to ~140 per shot between runs, so compare builds only at fixed cameras with the same doors open.

Older entries (up to 8 November 2026, and the undated October work): docs/archive/history-2026-11-early.md;
before November: docs/archive/history-2026-10.md.
