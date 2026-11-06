# Build-A-Blaster rebuild: running log

Branch `build-a-blaster`, worktree `.claude/worktrees/build-a-blaster`, cut from main at ee5a58a. The plan is docs/build-a-blaster-plan.md.
Baseline before any change: 623 tests, all passing.

## Phase 1: the room

**What changed.** The workshop now has a back hall behind the storefront: interior x -9.5..4.9, z 12..26.5, 4.8 m high, opening off the storefront through a mouth as
wide as the storefront. The tank, U-shaped conveyor, Naming Booth, lever and Returns Chute are plain blocks. The bench moved to the middle of the storefront and still sells
Party Trap and Clearance Rack. New test file: tests/workshopRoom.test.js.

**Verified.**
- Tests: lanes of at least 3 m, a player lap both ways, zombies can reach every floor point, a zombie follows round each side of the island, culling, grade, coplanar.
- Built game: walked the views with `window.__mall`, looked at screenshots of the hall and storefront, and bought Clearance Rack at the moved bench through the real input path (1000 spent, mod fitted).
- Performance, read from `renderer.info` in the built game (draw calls / triangles):

| View | Calls | Triangles |
|---|---|---|
| Hall, SW corner | 189 | 19k |
| Hall, SE corner | 144 | 17k |
| Hall, north lane looking out through the mouth | 876 | 106k |
| Storefront | 168 | 18k |
| Promenade at the window | 210 | 28k |
| Hallway | 1082 | 171k |
| Level 2 | 1397 | 260k |
| HOFFMAN'S | 515 | 80k |
| Atrium court | 305 | 40k |

The 876 view is the room looking out over the Promenade and down a balcony. It is still below the hallway and Level 2.

**Decisions made for you.**
- Hall height 4.8 m rather than the Promenade's 3.6 m, so the tank can be tall. The storefront stays 3.6 m, which gives a small reveal through the mouth.
- Hall runs to x 4.9, not 5: the Atrium's exterior wall starts at x 5.27 and the wall needs to fit before it. West goes to x -9.5 and north to z 26.5 (slightly past the 14 x 14 target) so the booth fits and every lane stays at least 3 m.
- The conveyor is a U open to the east instead of the plan's sketch, so it ends at the north-east corner beside the booth. The gun travels away from the doors, and the east side of the tank stays visible.
- Booth sits on the east wall with the lever further south along it, past the end of the conveyor.
- The island's guard is one bullet-through collider 2.2 m high. A separate conveyor at counter height would have been vaultable, and a player inside the ring could not be reached by zombies.

**Test changed on purpose.** tests/promenade.test.js: the walk-through used the old machine position, which no longer exists. It now crosses behind the bench. Same route check.

**Tooling note.** The preview tool's launch config only exists in the main checkout and runs from there, so `mall-zombies-preview` serves main's build. I did not edit that file. I run `npm run preview -- --port 4188` from the worktree instead and open that URL.

## Phase 2: the ritual

**What changed.** New game/features/workshopRitual.js with states idle, running and ready. Hand your gun over at the bench and it rides the conveyor; kills in the room fill the gauge; the lever or the 45 s limit ends it; collect at the Naming Booth. New HUD order ticket. Effects are still a placeholder: the gun gets a build record (quality and kills) that does nothing yet.

**Verified.**
- tests/workshopRitual.test.js (20 tests) covers everything in the plan's "Done when": death and Play again mid-ritual, walking away and returning, the loaner returning, gun purchases mid-ritual, the chute adding no zombies, the round still ending.
- Built game, real ritual start to finish through `window.__mall`: paid 1500 at the bench, Courtesy Loaner came up, zombies landed at the chute, real shots from the loaner filled the gauge to 3, ticket read "Being stuffed · 34s, 3 in the tank · 4 for Regular", lever gave Understuffed, booth returned the Staple Gun with a full magazine and the build, ticket cleared. Then Play again mid-ritual left nothing behind. No console errors from the game.

**Decisions made for you.**
- Kills count anywhere in the workshop, storefront as well as hall.
- Spawns steer to the chute only while you are inside the room. If they stayed steered after you left, you could start a ritual and walk off, and every zombie would have a long trek to reach you.
- If you stand on the chute, spawns fall back to the normal markers rather than dropping a zombie on you.
- The clock keeps running after you leave. The gun then waits at the booth with no deadline.
- The gun comes back with a full magazine; its reserve is unchanged. Handing over an empty gun and collecting it empty mid-fight felt bad.
- Collecting with a full loadout replaces the gun in your hand, the same rule as a wall buy, and the booth ticket warns you first ("Replaces your Foam Dart Blaster"). Buying the same gun again mid-ritual is allowed; the finished gun replaces that copy.
- The loaner shows on the HUD as "Courtesy Loaner". Customer Service and attachment counters ignore it, so nobody pays to upgrade a gun that gets taken back.
- Limited Editions needed their own spot now the bench takes guns for the ritual, so they moved to a shelf behind the display window. Price unchanged.
- A gun can hold a Limited Edition and a ritual build at once.
- New debug key Y teleports to the bench and opens the Promenade. (J was my first choice, but tests/debugCommands.test.js relies on J being unbound, so I took Y.)

**Test changed on purpose.** tests/workshop.test.js: the first test now stands at the Limited Editions shelf rather than the bench. Same checks, new spot.

## Phase 3: Stuffings and Hearts

**What changed.** Smoothie, Fryer Oil and Neon Tube, the Headshot and Last Round Hearts, quality scaling, the daily stock, area stocking and re-stuffing. All prices go through `g.pricing.priceOf('workshop', ...)`.

**Verified.**
- tests/workshopBuilds.test.js (22 tests): all 6 pairs on real shots, a kill pays once, a stuffing's kills never fire a Heart, tiers and attachments stack with a build.
- `npm run balance` now prints a proc table; tests/balance.test.js still passes unchanged, because base guns did not change.
- Built game: picked Neon Tube at its bin and Headshot at the wall through the real input path, ordered, collected, then a real headshot dealt 60 to the target and arcs of 20 and 16 to the two zombies beside it.

**Proc numbers (Extra Stuffed), for tuning.** One burn: Staple Gun 149, Price Gun 502, Nail Gun 321, Foam Dart 535, Cannon 909, Rivet 565, Coil 565, Scanner 221. Compare zombie health: round 5 450, round 10 806, round 15 1157, round 20 1662, round 30 3425. Since stuffing scales with the gun, it falls behind at high rounds the same way guns do.

**Decisions made for you.**
- You pick by walking to a bin and a Heart and holding interact. There is no menu. The bench refuses until both are picked and says what is missing.
- Stuffing damage scales from one second of the gun's fire, not one shot. Shots range from 30 (Staple Gun) to 840 (Cannon), so per-shot scaling would have made the same stuffing 28 times stronger on the Cannon.
- All damage numbers are first guesses: burn is 0.35 gun-seconds over 3 s, an arc is 0.08 gun-seconds with 2 jumps at Understuffed (3 at Regular and above).
- Headshot Heart has a 0.75 s cooldown, or a Price Gun would fire it on nearly every shot. Last Round has no cooldown and is 1.5 times stronger, because it fires so rarely.
- Last Round fires even on a miss, at the spot the round lands. It is your last round, so it should always do something.
- Burns don't stack. Re-lighting a burning zombie restarts its clock and adds no damage.
- An empty bin fills at once when you buy an area; otherwise the stock only changes at the start of a round.
- A stuffing you picked that leaves the bins at the next round drops off your order. The Heart stays.
- A re-stuff keeps the old build on the gun until you collect the new one, then replaces it.

**A failure I hit.** tests/staticBatch.test.js failed on the first full run: it treats every mesh flagged `dynamic` as part of the escalator barrier, and my bin lamps were flagged that way. I did not touch the test. The lamps now sit under one dynamic group, the same pattern the neon uses, which keeps them out of batching. Checked in the built game that they survive batching and light up as areas open.

**Not done here.** Stuffing visuals are placeholder confetti in each stuffing's colours. Phase 5 replaces them.

## Phase 4: name and Birth Certificate

**What changed.** Each finished gun gets a random name. A certificate shows on screen at collection, the HUD reads "DALE · STAPLE GUN", the PA follows the order, and the death receipt says "Survived by Dale".

**Verified.**
- tests/workshopNames.test.js plus a new receipt test in tests/receiptReview.test.js.
- Built game: ran a Fryer Oil + Last Round order with 10 kills in the room. The certificate showed the right fields, the HUD showed the name, and dying put "Survived by Dale" on the real receipt screen. Looking at the screenshot is what caught "A EXTRA STUFFED"; it now says "an".

**Bug caught and fixed.** My first receipt change called a helper that only exists inside the screen builder, which would have crashed the death screen. The new test caught it before it was committed.

**Decisions made for you.**
- The certificate is a notice in the top-right that clears itself after 6 s, not a screen you have to dismiss. You collect mid-fight, so it must not pause anything or take your input.
- A re-stuffed gun keeps its name. Gerald stays Gerald. The PA line for that is "Gerald has been altered. Please do not tell them."
- No two guns in a run share a name until all 24 have been used.
- "Survived by" includes a named gun that was on the conveyor or at the booth when you died.
- The name appears only after collection, never before, so a gun you die with on its first ritual gets no line on the receipt. Naming it at the booth is the point of the booth.
- Only the gun's first ritual gets a welcome line; a quality line plays once per ritual, each time the gauge reaches a new quality.

## Phase 5: spectacle

**What changed.** Real tank with quality marks that fills in the stuffing's colour, running belt, gantry arm that carries the gun to the booth, chute flap and slide, lever, booth, party bulbs, party colours on the lamps. Kills in the room fly into the tank; returns tumble out of the chute. Jingle, narration, per-stuffing sounds, Neon arcs, Fryer embers, shots that streak in the stuffing's colour, the stitched gun look and the Overstuffed bulge.

**Verified.**
- tests/workshopSpectacle.test.js (16 tests), plus checks on every gun in tests/weaponModels.test.js.
- Built game, looked at screenshots of: the tank mid-ritual, the chute with a zombie falling out, the arm lowering a gun to the booth, the Birth Certificate, an Overstuffed gun in hand.
- I could not hear the jingle or the new sounds: I can only check that they are triggered with the right volume. **Please listen to them.** They are synthesised from notes I chose without hearing them.

**Performance**, same views as phase 1, draw calls / triangles:

| View | Phase 1 | Phase 5 |
|---|---|---|
| Hall, SW corner | 189 / 19k | 217 / 23k |
| Hall, SE corner | 144 / 17k | 164 / 20k |
| Hall, north lane looking out | 876 / 106k | 914 / 109k |
| Storefront | 168 / 18k | 190 / 21k |
| Promenade at the window | 210 / 28k | 241 / 31k |
| Hallway | 1082 / 171k | 1086 / 171k |
| Level 2 | 1397 / 260k | 1411 / 260k |
| Atrium court | 305 / 40k | 310 / 41k |

During a ritual the hall peaks at 244 calls. Carrying a built gun adds about 10 calls anywhere. No lights were added.

**Bugs caught by looking at it.**
- The patch and stitches floated off to the side of the gun, huge. I had measured the model's bounds, and the model root includes the hands and arms. They now anchor to the gun's own mounts, and there is a test for it.
- Zombies fell out of the chute standing upright, because the model's alive branch reset the tumble. Fixed, with a test.
- On the Staple Gun the hand hides the side patch, so I added a seam of thread along the top of the gun, which is the surface you actually see.
- Each stitch was its own mesh, which added about 50 draw calls everywhere you carried a built gun. They are instanced now.

**Decisions made for you.**
- Ritual mode only recolours the hall's two existing lamps and steps an unlit bulb string, so it cannot exceed the light pool.
- The storefront's old mascot-topped machine is gone; the mascot sits on the new tank's lid.
- Narration lines are lowest priority, so a quality or "ready" line beats them. With a queue of three, some narration gets dropped in a busy ritual, which is the intent.
- Zombies from the chute fall 1.5 m instead of rising through the floor, in the same time.
- The stuffing's colour goes on the gun's tracer, seam, patch and the tank.

**Failure on the way.** tests/staticBatch.test.js failed a second time, for the same reason as phase 3: I had flagged the belt and bulbs directly instead of under a group. Fixed the same way, without touching the test.

**Interruption.** The session crashed just before this commit. Nothing was lost: the phase 5 work was intact in the worktree. I re-ran the browser check, the tests and the build before committing.

## Phase 6, part 1: Popcorn Butter, Antifreeze, Reload, Every 10th

**What changed.** Two more stuffings and two more Hearts, so 5 stuffings and 4 Hearts. All 20 pairs work.

**Verified.**
- tests/workshopBuilds.test.js sets every pair off for real, plus puddle, shatter, cooldown and kill-count tests.
- Built game: a Popcorn Butter + Reload gun reloaded for real next to two zombies. The puddle landed on the floor under them, the gun showed its seam in butter yellow, no console errors.
- Not looked at on screen: Antifreeze's chill and shatter. Those are checked by tests only.

**Decisions made for you.**
- Stuffing is named "Popcorn Butter", because "Stale Popcorn Butter" doesn't fit a bin label.
- Antifreeze needs two procs on its own: the first chills, the second shatters. It also shatters anything slowed by another source, such as Spill Cleanup or a Smoothie gun. A shatter uses up the slow and hits at most 3 zombies per proc.
- Every 10th counts kills made by that gun only. Box cutter, hazards, traps and stuffing kills don't count, and it keeps counting through another gun's cooldown.
- Reload has a 4 s cooldown, otherwise tapping R after one shot would spam it. It blasts around you even with nobody near.
- Heart cooldowns are per gun now, so two built guns don't share one.
- Slow and chill radii grow with the square root of power, and Neon jumps cap at 5. Otherwise Every 10th on an Extra Stuffed gun would cover most of a room.

## Phase 6, part 2: Limited Edition drops

**What changed.** Party Trap and Clearance Rack are no longer on sale. A zombie with a shopping bag sometimes drops one: walk over the bag and it fits itself to the gun it belongs to. The empty shelf behind the window now reads "LIMITED EDITIONS · ASK A SHOPPER".

**Verified.**
- tests/limitedEditions.test.js (11 tests).
- Built game: a Clearance Rack bag showed on the floor, walking onto it fitted the Price Gun free. No console errors.

**Decisions made for you.**
- The drop is free and fits instantly. The plan says these stay on sale "until phase 6" and then drop, so I ended the sale. **Please check this one**: the plan's price section still mentions Limited Editions. Their prices stay in `economy.upgrades.workshop` as you asked, but nothing charges them now.
- A bag only drops if you carry that gun and it doesn't already have that Limited Edition, so a drop is never wasted. No gun for it means no drop.
- It fits whichever carried gun it belongs to, even if you aren't holding that gun.
- From round 3, 15% per kill of a bag-carrying zombie, one bag at a time, 30 s on the floor. These numbers are guesses.
- If you swap the gun away, the bag waits for you until it runs out.

**Tests changed on purpose.** tests/workshop.test.js: the first test bought a Clearance Rack at the shelf; the plan ends that sale, so it now fits one from a drop and checks the same things (upgrades kept, survives an ammo buy, gone on Play again). tests/workshopRitual.test.js: the Limited Edition + ritual test fits the mod directly instead of buying it.

## Phase 6, part 3: Glitter

**What changed.** The sixth stuffing, stocked by HOFFMAN'S. Up to 3 zombies round the hit forget you for a few seconds, walk at the nearest other zombie and hit it with their normal attack. All 24 pairs now work.

**Verified.**
- tests/zombieConfusion.test.js (10 tests) and all 24 pairs set off for real in tests/workshopBuilds.test.js.
- Built game, real ritual and a real headshot into a crowd of 5: 3 were confused, the other zombies lost health to their blows at 15 a hit (a Staple Gun's number), the un-confused zombie kept chasing me, and no confused zombie hit the player. The shot's tracer showed Glitter's violet and the gun its violet seam.

**Decisions made for you.**
- A confused zombie is immune for 4 s after it wears off. Without that, a Headshot heart on a fast gun could keep a whole crowd harmless.
- At most 3 zombies per proc, for 3 s at Understuffed, up to a 6 s cap.
- Blows are weak on purpose: 0.06 gun-seconds, so Glitter's value is the crowd control, not the damage. Confused kills still pay you the normal kill value, once, and fill the gauge if they happen in the room.
- Only the zombies Glitter touches are confused. The ones they hit don't fight back.
- A zombie with nobody within 6 m on its floor just stands there, dazzled.
- It can't confuse a rising zombie or a frozen Mannequin. A charging cart stops mid-charge.
- Confused zombies walk straight at their target rather than path-finding, because navigation only ever routes to the player. A wall simply stops them. It's short range, so this rarely shows.

## Final state

**Tests.** `npm test`: 742 tests, all passing, up from 623. `npm run build` and `npm run build:single` are clean.

**Soak run.** A bot played all 24 pairs across the 8 guns through live rounds: a real order, 30 s of fighting through the ritual, collection, 40 s with the finished gun, then death and Play again. 24 rituals, 241 stuffing procs, 705 kills, no exceptions, no stuck rounds. The script was throwaway and is not in the repo.

**Merging.** A dry-run merge with current main (738e7f5) has no conflicts. Main has only gained docs/boss-zombies-plan.md since this branch was cut. Nothing is merged and nothing is pushed.

**After review (6 November).** Merged with the Mascot. Fixed on the way in: a zombie the failsafe rescued kept its chute drop, a burn finishing after the player died still filled the gauge, and the Mascot rose through the floor at the chute. Hardcoded stuffing and trap numbers moved to config, and How to Play now mentions Build-A-Blaster. A second soak with Mascots ran 60 rituals, 6 deaths and every reset with no broken invariants, and the head pop and a tank kill were checked in the browser.

**Shared files changed** (from the CLAUDE.md rule): mall.js, levelTwo.js, promenade.js, economy.js, CLAUDE.md, zombie.js, zombieManager.js, zombieModel.js, playerGun.js, createGame.js, events.js, interactions.js, hud.js, main.js, screens.js. shutters.js was not touched.

**Unfinished or unverified.**
- Prices are placeholders: ritual 1500, re-stuff 750.
- Every number in Stuffings, Hearts, quality and drops is a first guess. Nobody has played it with hands. The balance tests prove nothing is broken, not that it is fun.
- The jingle and the new sounds have not been heard by anyone. They are synthesised from notes I chose.
- Antifreeze has not been looked at on screen. It is covered by tests and the soak run.
- The stitched look was only inspected on the Staple Gun. The tests check it is anchored and gun-sized on all 8 guns, but the others may need a nudge.
- A Glitter-confused zombie does not path-find round walls.
- The Party Trap and Clearance Rack prices sit unused in economy.js, kept as you asked.
