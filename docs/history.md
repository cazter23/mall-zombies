# Sunset Galleria: build history

Newest first, from 12 November 2026. Older: docs/archive/ (see the end of this file).

## 17 November 2026 - Startup: the signs stop measuring their text a dozen times over (`claude/sign-text`)

The game took 13-18 s from opening the page to the title's first frame (a production build in Chromium), with a blank page
throughout. Measured with timing marks in a throwaway copy: fonts and code 0.3 s, the renderer and HUD 0.4 s, building the mall
8.4-11.3 s, batching and the rest 0.6 s, then 2.1 s for the first title frame (43 shaders compiled, 146 textures uploaded) after a
0.8 s wait. Of the mall's build, ~7 s was spent in the canvas's measureText, not building anything: typeKit's fitSize shrank
each sign's text to fit by trying every size 2 px apart (~12,500 measurements for 1,123 signs), and the browser's first
measurement at a font size it hasn't used costs ~2 ms (it sets up that size; below ~256 px). Painting itself was under 0.2 s.
- **fitSize** now measures at the full size once, predicts the rung from it (width grows in proportion to size), then confirms
  that rung fits and the one above doesn't: ~2.4 measurements a call instead of ~22. Same answer: on the real mall (all 1,123
  calls run both ways) and in tests/typefaces.test.js (3,000 generated cases with widths not in proportion to size); the
  context is left with the same font.
- **Measured** (three page loads each, back to back): the title's first frame at 12.4 / 15.1 / 15.7 s before, 7.7 / 8.7 / 8.3 s
  after; the blocking startup task 8.8 s -> 3.0 s.
- **Not done (next candidates):** compile the title view's shaders in the background before its first frame (2.1 s of frozen page);
  the 0.8 s before that frame starts (not traced); main.js is only requested after the fonts (~0.1 s); a loading screen instead
  of a blank page. Measured in Chromium only: `npm run play` opens Firefox, whose numbers will differ (fewer measurements helps
  in any browser).

## 17 November 2026 - The docs brought up to date and tidied (`claude/docs-cleanup`)

An audit of every doc against the code. The numbers were mostly right (prices, door counts, coordinates, formulas, sounds); what had
drifted was status. Decided: the skill tree and meta progression are OUT (no longer "later"). Changes, docs and comments only:
- **Archived** (docs/archive/, links fixed everywhere): the three finished plans (Closing Time, Kiosk Kevin, arena modes),
  weapon-balance-pass.md (superseded numbers), vault-notes.md and balance-review.md. Deleted: three one-off delivery reports, and
  AGENTS.md / GEMINI.md (only Claude works on the repo now).
- **New: docs/open-ideas.md**, everything planned or proposed and not built (balance proposals P7-P11 and the rest of the review,
  economy proposal B, Kevin's "Later" list, the boss ideas), so archiving the plans buries nothing.
- **history.md split** at 12 November: 9-11 November moved to docs/archive/history-2026-11-mid.md (174 KB out, 152 KB stays).
- **CLAUDE.md** 24.8 -> 18 KB: the build order and design wish list became "The game as built" (with Twisty, the Last Customer,
  Second Chance; the wall-buy wish list was mostly guns that never existed); the map summary and folder map are shorter (details stay
  in map.md and folder-structure.md); the area checklist moved to the top of map.md. Every rule is kept.
- **folder-structure.md** rewritten for accuracy: misfiled entries, spliced text, duplicates, the tools/ folder, history wording.
- **docs/research/**: the 321 links into the deleted references/ folder are plain `file`:line text now, with a note at the top of each
  file; links to this repo's own files are relative instead of C:/Users/... paths.
- Smaller: economy-report.md says A, C and D are applied; README covers the arena modes, Closing Time, the Guide and Inspect;
  tests.md describes atrium.test.js; typefaces.md counts 25 families; the sign ledger is labelled a 13 November snapshot.

## 17 November 2026 - The test range becomes the Staff Training Center (`claude/test-range-5`, stage 5 of 5)

The last stage of the test range plan: the grey box with 2 m walls under the open sky is now a back-of-house warehouse
(maps/testRange/backOfHouse.js). Concrete-block walls run up to a 9.5 m ceiling over the hall, the gallery and the pen, with
fluorescent strips (one instanced draw), yellow safety stripes at the walls' feet, cones and pallets; the floor is sealed concrete
(its 1 m tiles kept for judging distances). The signs use the game's sign styles: industrial plates over each station, a wayfinding
STAFF TRAINING CENTER banner and AUTHORIZED STAFF ONLY, and two deadpan handwritten notices. No lights were added. Found on the way:
the gallery test's shots were random (the Rivet Rifle's spread) and only passed by luck; the new meshes moved the random sequence
(the CLAUDE.md trap), so the test now fixes Math.random at 0 (dead centre) after the map is built.

## 17 November 2026 - The test range's movement course, brought up to date (`claude/test-range-4`, stage 4 of 5)

The course dated from 12 October: its stairs had 0.5 m steps (no rule allows that now) and nothing showed vaulting, balcony rails,
ramps or fall damage. New stations (maps/testRange/movementCourse.js), each with a sign: a vault row (0.9 / 1.0 / 1.1 m vault,
1.2 m and a 1.6 m deep counter don't), a ramp to a 3 m landing and a 6.3 m balcony with real balcony rails (the free drop and the
~40-damage upper-floor drop), and the reach rule (a 0.95 m counter between a 2.0 m block a jump from it reaches and a 2.1 m one it
doesn't). A movement readout (moveTracker.js, ui/movementReadout.js) shows speed, the last jump or drop, fall damage, slide and
vault. Found building it: a solid box flush with a ramp's surface is a lip you walk into (the first ramp stopped at 2.85 m), so the
ramp's solid underside sits 0.6 m below the surface and its flat top runs 1.2 m over the balcony's edge, as the mall's escalators do.

## 17 November 2026 - The test range's zombie pen (`claude/test-range-3`, stage 3 of 5)

Checking a zombie's hit reactions, splatter or special move meant waiting for its round or spawning it somewhere in the mall. Now a
pen through the test range's west wall (maps/testRange/pen.js): a console spawns any zombie type, Mascot costume (or the gold
Employee of the Month) or mall boss at the far end, and they stand still (held, facing you) or come at you. Bosses come through
the boss director (health bar, phases, advisories), which got an optional spot to summon at (bossDirector summon(id, at)); a held
boss is pinned, as bosses ignore holds. The failsafe never "rescues" a pen zombie to the mall, and leaving the range clears the
pen. The armory's menu became a shared bench form (benchForm.js, ui/benchForm.js) that both benches use.

## 17 November 2026 - The test range's armory bench (`claude/test-range-2`, stage 2 of 5)

Trying a gun meant juggling debug keys (H for the next gun, U for the next tier) and could not reach attachments, builds or Kevin's
items at all. Now a bench right of the test range's spawn (maps/testRange/armory.js, ui/armoryForm.js): hold F, and a form of five
pages applies any gun, warranty tier, renewals, attachments that fit, a Build-A-Blaster build (made exactly as the ritual makes it, so
the quality's damage boost and the stuffing's tracers are real), wardrobe items, a full Lethal or Tactical pocket and Bubble Wrap
layers, each the moment you confirm, through the game's own code. Using it marks the run as a debug run. The gun in your hands
changes when the form closes (the gun holds still while a menu is open). The gallery's connect moved after the wardrobe in createGame.

## 17 November 2026 - Debug mode, and the test range's shooting gallery (`claude/test-range`, stage 1 of 5)

The debug keys, the test range and window.__mall were always on, and the test range dated from 12 October. Stage 1 of the test range
plan (the user chose all five: 1 the gallery, 2 an armory bench, 3 a zombie pen, 4 a movement course for today's moves, 5 a back-of-house look):
- **Debug mode** (config/debug.js `mode`, game/debugMode.js): off for players. On for the dev server (`npm run dev`), an address ending in
  `?debug` (the built game, the single file, `npm run preview` for a browser check), or Settings > Debug > Debug mode (read when the game
  opens). It turns on the keys and window, the test range and window.__mall. Runs that use a debug command were already kept out of
  every record (state.assisted: career stats, skin challenges, the Survival Guide, Lost and Found; the receipt says DEBUG RUN).
- **The mall's light no longer depends on the range.** The range carried its own sky light (0.9, steadier and brighter than the mall's
  0.52), and a sky light lights the whole scene: every look since October was made with it on. It is now the mall's `fill`
  (config/environment.js), unchanged, and the range's lamp has a 50 m reach. Noticed, not changed: the fill does not follow the dusk or
  the horror layer's darkness, so it softens both.
- **The shooting gallery** (maps/testRange/gallery.js, ui/rangeReadout.js): a hall through the range's north wall, targets at 5, 10, 15,
  20, 30 and 40 m, a counter that sets their round (health and round scaling: rounds 1 to 40), and a readout: each hit's damage, head or
  body, distance and the share the range left; your hit rate at each distance; each kill's hit shots and time. (Hip-firing the Rivet
  Rifle at 40 m in the first check: 0 of 8. That is its hip spread, and the kind of thing the gallery is for.)
- Dummies now carry a round and a maxHealth (the Return to Sender's instant kill reads maxHealth).

## 15 November 2026 - Build-A-Blaster guns you can see (`claude/bab-visible`)

A check of every gun in first person found the finished-build look easy to miss or wrong on several guns. Now:
- **A build spot you can see** (models/buildVisual.js, a `build` mount per model): the patch and pillows used to share the warranty seal's
  sticker spot. On the Foam Dart Blaster the drum hid it completely; on the Confetti Cannon, Tennis Ball Launcher, Leaf Blower and Return to
  Sender it sat at the back, right under your face, so an Overstuffed pillow filled the screen. Those five now have their own spot, further
  forward (the Tennis Ball Launcher's ahead of the laser pointer). The other ten keep the sticker spot, which already showed well.
- **A seam along the gun**, found on the body, not placed blind: rays dropped from above find the top surface and the seam follows it
  (up to 20 stitches, about 32 cm; it was 6, 8.5 cm). The old seam floated beside the body on the Staple Gun, Price Gun and Stargazer (its line
  ran past a narrow body) and up to 3 cm above the Nail Gun.
- **The Heart badge follows the Heart:** a re-stuff with the same stuffing and quality but a new Heart kept the old badge (the redraw key
  left the Heart out).
- The skin pattern keeps the new build spot plain too (config/skins.js keepOut), and the Employee of the Month name badge stays off it.
- Checked in first person on all 15 guns, Regular and Overstuffed, and with Platinum + 3 Renewals and every attachment fitted (laser,
  scope, nozzle, magazine, grip): everything stays readable. Known: on the ten guns that keep the sticker spot, a build covers the warranty
  seal sticker (the barrel collar still shows the tier), and the laser pointer shares the left side with the pillow on several guns.

## 15 November 2026 - The WEAR-O-MATIC (`claude/wear-o-matic`)

Arena survival had almost no Wardrobe: Last Showing has one rack (the 3D Glasses), Lot Full none, and neither has a fitting room.
Now both have a **WEAR-O-MATIC**, a hot-pink clothes vending machine (Everything Must Go stays without one: it is the hard mode).
- **Every item, you choose** (not a random roll: every item has a downside). It opens the fitting-room picker in SHOP MODE
  (game/features/fittingRoomPicker.js `shop`): every slot lists every item; one you don't own shows its price and the button buys it
  and puts it on; one you own changes for free, so it is the arena's fitting room too. Short of points: 'denied', nothing happens.
- **A small convenience fee:** the rack price x 1.2 (economy.js wearOMatic; pricing category 'wearOMatic', so 750 -> 900,
  2000 -> 2400). The Apparel Flash Sale covers it and marks it (game/flashSales.js) while anything is left to buy; vouchers apply.
- **Where:** Last Showing, the lobby's north wall between two posters (x -30, near the RESTOCK-O-MATIC, across from the box
  office); Lot Full, the north fence east of the RESTOCK-O-MATIC (x 58.4). config/arenas.js wardrobeMachine; the model is
  maps/mall/wardrobeMachine.js (one shelf per slot, each item in its own colour). Like the other arena-only fixtures it is not
  on the minimap (the map's places are drawn once, from the whole mall).
- Tests: tests/wearOMatic.test.js; tests/arenaModes.test.js's clearance, reachability and whole-mall checks now include it.

## 15 November 2026 - Shopping bags carry Kevin's stock; the Limited Editions are gone (`claude/balance-review`)

The Party Trap (Confetti Cannon) and the Clearance Rack (Price Gun) were relics of Build-A-Blaster's Pack-a-Punch days: a second special mod,
for two guns only. Build-A-Blaster already gives every gun its special effect, so both were removed.
- **Removed:**
  - their config (config/workshop.js `workshopBuilds`, `workshopModOf`, `limitedEditionDrops`) and their prices in economy.js;
  - their code: game/features/limitedEditions.js, clearanceRack.js and clearanceSticker.js, zombies/partyTrapDeath.js, the trap placement and
    tag hit in weapons/playerGun.js, and the gun-model parts (weapons/models/workshopBuilds.js);
  - their sounds (`partyTrapBlast`, `clearanceStamp`, `partySnap`) and their tests.
  - The Build-A-Blaster room, the ritual and the builds are untouched.
- **Shopping bags** (game/bagDrops.js, wired in createGame as g.bagDrops; numbers in config/kiosk.js `bagDrops`):
  - A bag-carrying zombie still sometimes drops its bag: from round 3, 15% a kill, one bag at a time, 30 s on the floor.
  - Inside is one thing from Kiosk Kevin's cart: one charge of a Soda Bomb, Sparkler Cake, Air Horn or Glitter Bomb, or one Bubble Wrap layer.
    The Sentry is never in a bag.
  - Only something you have room for: an empty pocket, or the same product below a full pocket; Bubble Wrap below the most layers. It never
    replaces what you carry, and if nothing fits, no bag drops.
  - Walk over the bag to take it.
  - The HUD marker and the PA lines are the same as before ('bagDrop' / 'bagTaken' replace 'limitedEditionDrop' / 'limitedEditionFitted').
- tests/bagDrops.test.js covers it.

## 15 November 2026 - Human balance pass, group 2: the guns nobody wanted (`claude/balance-review`)

docs/archive/balance-review.md's group 2, with two of its numbers changed to respect earlier rules.
- **Stargazer 3000** (config/weapons.js):
  - Scope sway 0.22 → 0.12°.
  - The 2x long-range bonus is reached at 20 m instead of 30 m (a body hit at 15 m: 392 → 469).
  - **Hip spread NOT changed** (12°). The review suggested 5, but the 13 November playtest rule (tests/balance.test.js: hip fire "a gamble even
    close in", at most 35% at 5 m) allows only about 10.5, which would change almost nothing.
- **Bottle Rocket:** your own blast takes 30% of your health at its centre (was 45%), never more than 50% (was 75%). The review suggested 25%,
  but 30% is the lowest that still "bites" from 1.5 m (tests/bottleRocket.test.js: over 20%).
- **Balloon Launcher:** its pop keeps up with the rounds, `roundScaling: { exponent: 0.4 }`: 200 at round 1, about 450 at round 15, 600 at
  round 25. weapons/gunStats.js now applies `roundScaling` to a blast's damage too (it only did for bullets and balls).
- **BOGO:** resting hip spread 2.4 → 1.8°. The review also suggested aimed spread 0.55 → 0.4, but that broke "a spray, not a rifle, at 20 m"
  (tests/balance.test.js). The aimed spread is unchanged.
- **Leaf Blower in GRAB-A-GUN** (config/clawMachine.js): weight 7 → 4. It is in about 9% of grabs instead of 15%.
- **Clearance Rack** (game/features/clearanceRack.js): a body shot that KILLS a tagged zombie pops every tag, as a headshot on one does. Before,
  only a headshot popped them.
- **Party Trap** (game/features/workshop.js, config/workshop.js `partyTrap.roundScaling`): its 650 blast grows like Kiosk equipment once 650
  stops killing a Shopper, x(the target's round health / 600) ^ 0.37, never below 650. About 830 at round 15, 950 at round 20.
- **Left alone, as the review said:** the Heavy Coil Nailer and the Confetti Cannon.
- **Tests:**
  - New tests in tests/workshop.test.js for the Clearance Rack kill-pop and the Party Trap scaling.
  - tests/upgrades.test.js now checks the barrels on the Stargazer inside its new 8-20 m ramp.
- **Still the same after this pass:** the Stargazer's 30 m window over the wall guns (from round 17). The falloff change doesn't touch 30 m, so
  group 1's note that this pass would win round 16 back was wrong.

## 15 November 2026 - Human balance pass, group 1 (`claude/balance-review`)

docs/archive/balance-review.md judged the balance for a human player instead of a perfect-aim bot. These are its group 1 changes, numbers only:
- **Ammo and the wall guns** (config/weapons.js, economy.js):
  - Price Gun: magazine 24 → 30, reserve 144 → 180.
  - Nail Gun: magazine 10 → 12, reserve 60 → 90.
  - Foam Dart Blaster: damage 90 → 100, reserve 144 → 180.
  - Rivet Rifle: damage 80 → 90, reserve 144 → 216.
  - Barcode Scanner: magazine 8 → 10, ammo 900 → 600.
  - A human lands about 55-60% of shots and was running dry 1-3 times a round from round 15.
- **Warranty tiers** (config/upgrades.js): a tier replaces the one before, so Premium used to shrink Deluxe's magazine and give its reload back.
  - Premium: magazine 1.1 → 1.3, and it now reloads 15% faster (it had no reload bonus).
  - Platinum: magazine 1.15 → 1.35, reload 0.9 → 0.8.
  - tests/warranty.test.js now checks that a later tier never takes handling away.
- **Wardrobe traps** (config/wardrobe.js, economy.js):
  - Hi-Vis Vest: zombie hits x1.25 → x1.2. A Shopper hits for 48, so three hits still down you.
  - Wheelie Sneakers: backpedal x0.85 → x0.95, back above a jogging zombie.
  - Cardigan: 2,500 → 1,500, the Sandwich Board's price for the same four hits.
  - Gold Card: kill pay x1.1 → x1.25 (a Shopper kill +20).
  - 3D Glasses: headshots x1.25 → x1.5.
- **Side effect:** the Stargazer 3000's "faster than any wall gun at 30 m with headshots" window now starts at round 17 instead of 16. The new Foam
  Dart Blaster wins round 16 (tests/balance.test.js). The Stargazer's own fix is in the review's group 2.
## 15 November 2026 - 3D zombie sound (`claude/spatial-audio`)

Hear WHERE every zombie is: behind you, to the side, upstairs, through a wall. Still no audio files. The whole picture, the
numbers and how to tune it are in docs/spatial-audio.md.
- **Positional voices** (audio/sound.js, game/soundStage.js, config/spatialAudio.js):
  - A zombie's sound gets a PannerNode at the zombie, re-placed every frame, so it follows the zombie and turns as you turn.
  - Settings > Audio > 3D sound picks HRTF (Headphones, the default) or equal-power stereo (Speakers, where a sound behind you
    is darker).
  - Distance falls off by a per-sound PROFILE (a groan carries further than a footstep), with the config entry's maxDistance as
    the edge.
  - The guns and every sound of your own are untouched.
- **Walls and floors** by the room-culling areas and portals, no raycasts:
  - The same area, or a line straight through an open opening: clear.
  - The next area: a little muffled. Further away: muffled. Only through a closed shutter: muffled most.
  - Another area on the other floor: at least muffled.
  - A sound rings in the reverb of the room it is in: up to two extra convolvers, reused once their tails die.
- **Cues you can't miss from behind** (docs/voice.md's campy store sounds):
  - A swing winding up within reach: `zombieLunge`.
  - The Cart Pusher's telegraph: `cartRattle` gained a forklift's three reversing beeps.
  - A Shoplifter: its loot jingles as it runs at you, and the anti-theft gate alarm goes with it as it flees with your points
    (not after you die).
  - A Mascot: a clown-car horn while its helmet is on.
  - A boss walking in: a shop door chime from where it is (the PA sting stays).
  - Cues skip the per-name sound gap and outrank everything for a voice.
- **Presence:**
  - Shoppers now shuffle and groan (they had no sounds).
  - Mannequins creak, only while they move. Carts rattle. Mascots thud further.
  - Steps change with the floor: carpet in HOFFMAN'S and the Cinema, concrete in the service corridors, asphalt in the car
    park, with `shopperShuffle@carpet` / `@asphalt` recipes.
  - The periodic sounds are timed by each zombie's own random stream, so no seeded test or gait roll moved.
- **Crowds:**
  - At most 12 positional voices (6 on Graphics > Zombie sound voices: Fewer, which the Potato preset picks: plain stereo, no
    extra rooms). The lowest-scoring play is dropped or stolen, and a cue always gets in.
  - The rest of the horde is one looped crowd murmur (audio/crowdBed.js), placed toward where they are.
- **Measured**, round 30, 40 zombies:
  - 0 audio underruns on Full and on Fewer; about 0.15 ms of main-thread JS per frame.
  - Offline, positional HRTF costs about what the old non-positional sounds did, once positions are SET, not glided. A
    setTargetAtTime glide on a panner's position doubled it (Chrome's per-sample path).
  - The real cost is zombie sounds feeding the room reverb.
- **The audition page** (`npm run audition`) has a new top card, 3D zombie sound:
  - A mini map where you drag a zombie round you (behind a wall, behind a shutter, upstairs, the floor underfoot).
  - Loop, Walk a circle, the crowd bed, and Measure 3D cost.
- Tests: tests/spatialAudio.test.js. Shared files changed: config/audio.js (new zombie recipes; mannequinStep, cartSqueak and
  cartRattle gained layers), config/zombies.js, config/bosses.js (the guard's telegraph is a cue), config/settings.js,
  game/createGame.js, game/shoplifting.js, zombies/zombie.js, zombies/zombieManager.js, main.js, CLAUDE.md (docs index).
## 15 November 2026 - Vaults no longer go sideways (`claude/vault-sideways`)

Playtest: vaults sometimes went SIDEWAYS; the magnet had to stay forgiving. A headless sweep (the real controller on the real
HOFFMAN'S counters, start counter, a checkout, a bench and the Atrium and Promenade rails, a stick at every angle) found four
causes; the tables and the code lines are in docs/archive/vault-notes.md.
- **Rails** were climbed straight over from up to 70 degrees off, so running along a balcony drifting toward the rail, a jump
  turned you 70 degrees and dropped you off it, landing up to 2.3 m along. Now `ledge.maxApproachDegrees` 50 and
  `ledge.maxLookDegrees` 45 (the climb is still straight over: those angles are how far it can turn you).
- **Counters** never checked that you were looking at the counter: looking along one while drifting into it with W+D vaulted
  it. New `feel.vault.maxFaceDegrees` 65 (your view vs straight over the face you enter, per obstacle).
- **The angled search** rescued a vault refused for where you look (a 12 to 24 degree turn) and could vault a different counter
  (HOFFMAN'S counters are 1 m apart). Turned paths now only dodge a blocked landing of the obstacle straight ahead; a held jump
  press (the magnet) only vaults the obstacle it was pressed at (`ahead()` remembers it, `tryStart({ magnet: true })`).
- Kept forgiving: head-on to 35 degrees (counters to 60), early or late presses, off centre, key diagonals at a counter you look at.
  tests/vaultSideways.test.js checks both sides; tests/fallAndLedge.test.js's rail-angle test asked for the 60 degree climb (the
  sideways case) and now asks for 35 degrees and a plain jump at 60.
## 15 November 2026 - Performance pass: shader stutter, draw calls, the game tick (`claude/performance`, not merged: the user says when)

Measured first, fixed the biggest costs, measured again. Nothing here changes gameplay, and High draws the same picture
(proved by pixels, below). The one look change is a new Graphics setting used by Potato and Low only. Machine: this 16 GB PC,
Intel UHD 770 (integrated), a 1280 x 720 Browser pane, every door open. CPU timings are headless in Node; a pane's frame
rates are indicative only, draw calls and CPU times are not.

**What was slow, and what it is now**

| What | Before | After |
|---|---|---|
| First shot of a run (High) | 1,126 ms freeze | 12 ms |
| First zombie to walk into view (High) | 1,495 ms | 187 ms (a normal High frame here is 70-120 ms) |
| First zombie after a cleared wave, every round (High) | 850 ms | 78 ms |
| First Cart Pusher (High) | 1,560 ms | 98 ms |
| Textures uploaded before play | 325 of 819 (the rest as you first looked at them) | all, behind the title |
| Benchmark, High: draw calls, route average / worst shot | 420 / 1,195 (Atrium ring) | 284 / 670 (Hallway) |
| Benchmark, Potato: draw calls, route average / worst shot | 359 / 974 (Atrium ring) | 188 / 344 (Hallway) |
| Benchmark, High: CPU per draw, average / p95 / worst | 13.8 / 22.2 / 2,686 ms | 4.0 / 6.3 / 8.1 ms |
| Benchmark, Potato: CPU per draw, average / p95 / worst | 3.5 / 6.0 / 184.6 ms | 2.7 / 3.6 / 7.8 ms |
| Benchmark, worst frame, High / Potato | 250 ms (the cap) / 250 ms | 83 ms / 17 ms |
| Game tick, round 28, Atrium: average / p99 | 1.07 / 3.67 ms | 0.50 / 1.90 ms |
| One route field for the zombies (5 a second) | 2.45 ms | 1.10 ms |

Draw calls per benchmark shot (Shift+B, the average over each shot):

| Shot | High before | High after | Potato before | Potato after |
|---|---|---|---|---|
| parking lot | 338 | 315 | 256 | 210 |
| hallway | 1,033 | 670 | 766 | 344 |
| food court | 671 | 538 | 545 | 286 |
| mega mart | 558 | 315 | 468 | 213 |
| service corridor | 250 | 115 | 224 | 85 |
| start room | 210 | 146 | 165 | 104 |
| atrium court | 341 | 327 | 264 | 220 |
| atrium ring | 1,195 | 598 | 974 | 335 |
| level 2 | 858 | 503 | 719 | 310 |
| department store | 232 | 206 | 186 | 154 |
| cinema lobby | 210 | 161 | 159 | 109 |
| cinema screen | 78 | 67 | 49 | 37 |
| cinema stairs | 211 | 135 | 168 | 94 |
| workshop hall | 182 | 167 | 152 | 134 |

Game tick at round 28 (`npm run perf`: 24-27 zombies, two Mascots, a boss, a Flash Sale, every hazard, a Sentry, Soda Bombs, a
held trigger; main and this branch run back to back, milliseconds, average / p95 / p99):

| Spot | main | this branch |
|---|---|---|
| Main Hallway | 1.27 / 2.55 / 3.89 | 0.69 / 1.79 / 3.00 |
| Grand Atrium | 1.07 / 2.13 / 3.67 | 0.50 / 1.47 / 1.90 |
| Food Court | 1.08 / 2.38 / 3.58 | 0.49 / 1.51 / 1.93 |
| Customer Parking | 0.84 / 1.80 / 3.12 | 0.40 / 1.42 / 1.76 |

(The first measurement of the day read 1.8-2.5 ms: another agent's tests were running. Compare only back-to-back runs.)

**The fixes**

- **Shader stutter** (fx/shaderWarmup.js, zombies/warmupModels.js). The first time anything is drawn the browser builds its
  shader and uploads its textures on the spot. Three causes, three parts. (1) A zombie's materials are disposed with it, and
  three destroys a shader when its last material goes, so the shader was rebuilt for the first zombie of every round and for
  every rare type: every shader three makes is now kept for the session (one extra use counted on it). (2) Everything in the
  scenes, hidden or not, plus one zombie of every type, Mascot costume and boss, is compiled in the background behind the title
  (three's compileAsync: the title keeps drawing). (3) Compiling alone left 541 ms of the first shot, so every object is then
  drawn once into one pixel, a few per frame within 6 ms, which uploads its textures and makes the driver finish the shader.
  It is done about 12 s after the page loads here, starts again when a Graphics setting changes the shaders (the Visual
  effects path, the lamp count), and waits while the first launch measures the frame rate. A shader costs about 1.3 s on High
  (37 lamps in each) and about 0.1 s on Medium. `?nowarmup` turns it off to compare.
- **Draw calls** (fx/roomCulling.js). In the worst views about 1,000-1,150 calls, 819 of them further than 25 m away, and
  763 materials with 338 textures in one view (posters and signs: one call each). Three things with no visual change:
  a room seen through a doorway is no longer drawn whole, only the objects inside the screen rectangle it is seen through
  (the portal walk already knew the rectangle); still props that features add to the scene (wall-buy guns, Lost and Found,
  hazard switches, NO REFUNDS signs: `userData.roomProp`) go on their room's layer (260-470 calls were always drawn); and the
  debug test range is skipped from indoors (107 calls from the Atrium's ring).
- **Far objects** (Graphics, new; config/look.js propDistance). Potato: Close (20 m). Low: Near (30 m). Medium and High:
  Everywhere, so they are unchanged. Small things in a room (a bounding sphere under 2 m: signs, neon letters, racks, Kevin's
  cart, props; never a wall, a floor or a merged batch) are not drawn beyond the distance, and come back 1.5 m nearer than
  they went. **This is the one look change**, and only on those two presets.
- **Collision** (world/colliderGrid.js). Every body tested all ~670 boxes several times a tick: 31% of a late tick. The list
  is sorted into a grid (2 m cells; each lists, in the list's own order, every box within 1 m), and collision.js reads one
  cell. Same result, box for box, because the boxes left out are too far to matter and the rest keep their order; a push
  that moves a body out of a cell carries on in the next cell's list from the same place in the full list.
- **Route field** (zombies/navigation.js). The player field is redrawn 5 times a second. The heap became buckets one cell wide
  (a step costs at least one cell, so a bucket never shortens itself and each cell spreads once), and each cell's open
  neighbours are worked out when the grid is built. Same field.
- **Ambience** (game/ambience.js). Each speaker ray-tested every box, 60 times a second (5% of a tick). The boxes within
  hearing range of the listener are listed once a tick; each speaker reads those.

**How "the same" was checked**

- Culling, by pixels, in the browser on High: this branch's culling against main's rule (rooms drawn whole, props and the
  test range always drawn) in one page, frame against frame: identical at all 205 camera poses (the 14 benchmark shots and the
  6 title shots at their start, middle and end, and 145 random poses on walkable floor at standing, crouching and jump
  height), with 59,989 objects skipped across them. Two things turned up on the way and are handled: a floor decal with a
  depth offset bleeds a few pixels through the foot of the wall in front of it (so materials with a depth offset or no depth
  test keep the old rule), and **the debug test range shows as a thin strip over the parking lot's fence** (so it is still
  drawn wherever the lot is visible).
- Collision: 12,000+ moves on the real mall identical with and without the grid (tests/colliderGrid.test.js).
- Route field: against main's navigation.js, 300 player positions, every cell of every floor: 21.9 million comparisons, 0
  differences (and tests/navigationField.test.js keeps the heap as the reference).
- Ambience: main's mixer and this one along a walk through the mall, 6,600 ticks: the same voices and one-shots.
- Screenshots (before from main's build, after from this branch, High; and Potato after): `perf-screenshots/` in the worktree
  (not committed).

**Measured and left alone**

- **High on a weak GPU**: 22 fps here before and 19 after (the same within a pane's noise), against 60 on Potato. 37 real
  lamps light every pixel; that is High's look. The first-launch auto-pick already steers weak computers lower.
- **Texture memory**: about 620 MB in 863 textures (227 over 1 MB; the three largest are 31, 22 and 22 MB). Halving them on
  Potato and Low would need the canvas textures built smaller: its own piece of work.
- **Zombies are 8 draw calls each** (6 upper-body parts and 2 legs): 24 zombies = about 190 calls. One call each would need
  a skinned or instanced model.
- **Posters and signs are one call each** (unique textures): an atlas would merge them, with a risk to the look.
- **Throttling far zombies' thinking**: it would change what zombies do.
- Ray tests (shots, line of sight) still read every box: a few percent of the tick in the last profile.
- Guns not in hand are not in the gun's scene, so the first switch to a new gun can still build its shader once.
- Memory does not grow: 95.2 MB after one minute of headless play, 95.8 MB after twelve.
- Worth knowing: the test range's two lights are in the scene, so they light the mall too. Turning `debug.testArena` off
  before shipping will change the mall's lighting.

**New**: `npm run perf` (tools/perfReport.mjs; `--profile`, `--no-grid`, `--root <folder>`), config/performance.js (the knobs
and the draw budget), tests colliderGrid, navigationField, shaderWarmup, windowCulling, drawBudget (a view that draws too much
fails), URL flags `?nowarmup` and `?nowindowcull`.
Shared files: CLAUDE.md, package.json, src/main.js, config/settings.js, config/look.js, game/createGame.js, game/ambience.js,
world/collision.js, zombies/navigation.js, fx/roomCulling.js, fx/postProcessing.js, maps/mall/parkingLot.js, and one line each
in game/features wallBuy.js, lostProperty.js, refundSign.js, hazards.js, paLureHazard.js; docs history, folder-structure, tests.

## 15 November 2026 - Arena survival: Extra Modes (`claude/arena-modes`, not merged: the user plays it first)

Survive as many rounds as you can locked in ONE part of the mall (the plan, with every decision: docs/archive/arena-modes-plan.md).
Play now lists Directed, Classic and **Extra Modes**; Extra Modes opens three arenas, each with its line and best round:
**Everything Must Go** (the Start Room), **Last Showing** (the Sunset Cinema) and **Lot Full** (Customer Parking).
- How: `g.setArena(id)` / `state.arena`. The map's `setArena` (maps/mall/arenas.js) opens exactly the arena's zones, seals the area
  system (world/areaUnlocks.js `sealed`: no door prompts, no door Flash Sales, door vouchers pay their points) and shows that arena's
  own fixtures, spawns and features; set back to null the map is exactly the whole mall's (tested collider by collider). Arena-only
  features are built once with the rest and gated (game/features/index.js arenaContext). No Closing Time in an arena (no keys, no
  briefing, no checklist, no van). GRAB-A-GUN and Kiosk Kevin start a run at their first OPEN site, so an arena gets its own.
- Fixtures: Last Showing's Customer Service is the Box Office (its three windows on the ticket booth, a CUSTOMER SERVICE board hung
  above it: no new collider) plus a Nail Gun; Lot Full gets a Customer Service booth, a RESTOCK-O-MATIC and two wall guns on fence
  boards (Foam Dart Blaster, Rivet Rifle) and a spawn in the vestibule; Everything Must Go is the hard mode (Price Gun, an arena
  RESTOCK-O-MATIC, two more spawns: no claw machine or warranties). Coordinates: docs/map.md "Arena survival".
- Saves and records: an 'arena' save step (restored first; Continue says the arena); the receipt names it; careerStats keeps each
  arena's best round (`arenas`) and leaves the whole mall's bests alone. The Statistics screen has an "Arena survival" section.
- Shared files changed: createGame.js, mall.js (one call), areaUnlocks.js, features/index.js, clawMachine.js, kiosk.js, closingTime.js,
  escapeVan.js, bossVouchers.js, saveGame.js (peek), careerStats.js, screens.js, runStart.js, runIntro.js, main.js, settings.js
  ('arenaChoice'), retail.css, tests/menus.test.js (the chooser now lists Extra Modes). No economy, weapon or save-version change.
- Checked in the browser (a build on a spare port): each arena played several rounds with no zombie outside it, the box office and
  the lot's fence row look right, the receipt and best round are filed. Controller menus are covered by tests only (a fake pad in the
  hidden pane did not reach the menus).
## 15 November 2026 - Shopper outfits match the person (`claude/shopper-outfits`)

The user's report: male-looking Shoppers sometimes spawned in skirts. Cause: shopperAppearance.js rolled hair, build, top, bottom and
shoes independently, so the office archetype's pencil skirt (half its bottoms) went with bald heads and ties, and the Mall Rat's ra-ra
skirt with flat-tops and mullets; the women's power suit (blouse bow) and the purse went on men the same way. Now every Shopper is rolled
a presentation first (per archetype `presentations` weights in config/shoppers.js; office 1.5 : 1 and rocker 2 : 1 men to women, parent
1 : 1.2, the rest even) and wears only the pieces that fit it: `onlyFor` lists what is men-only (short or bald hair, flat-top, spiky,
mullet, the three tie shirts, the broad build, the flat cap) and women-only (bob, ponytails, perm, big hair, the power suit, the three
skirts, the purse); everything else is anyone's. Same seed, same Shopper, as before (the looks per seed changed once). The plain `skirt`
had been unreachable since the errand/summer archetypes went: it is now on the Weekend Shopper's list. Skirt share among all spawns of an
archetype: office 50% -> ~20%, Mall Rat 33% -> ~16% (now half and a third of the women), Weekend ~12%. There is no facial hair in the
Shopper data; a beard or moustache would go in onlyFor.masculine.

## 15 November 2026 - Gun weight, and rumble on hits (`claude/bughunt`)

From a gunplay check (what the game already does for hit feedback, reactions, handling, reloads, penetration, weak spots): hit
markers, hit sounds, flinch and knockback, penetration and headshots were all there; gun handling and controller feedback on hits
were the cheapest gaps. The user asked for both, gun weight with the recommended numbers.
- **Gun weight** (config/weapons.js `weight` per gun, `gunWeights`; weapons/playerGun.js). Switching TO a gun: light 0.25 s to come
  up, medium 0.32 (what every gun had), heavy 0.40, very heavy 0.45 (the drop of the old gun is still feel.weaponSwitch 0.18). Firing
  from a full sprint: 0.05 / 0.08 / 0.11 / 0.14 s before the first shot. Light: Staple Gun, Price Gun, Foam Dart Blaster, Barcode
  Scanner, BOGO. Heavy: Rivet Rifle, Heavy Coil Nailer. Very heavy: Stargazer 3000, Bottle Rocket Bazooka. The rest medium. The two
  numbers left feel.js. Walking speed while just holding a gun was left alone (aiming already slows heavy guns: `ads`).
- **Rumble on hits** (config/haptics.js hit / headshot / kill, core/haptics.js): from the 'hit' event, so only your gun and box
  cutter (hazards, equipment and burns don't announce hits). They follow the Controller vibration setting. A hit is announced just
  before its own shot, so the new `accent` pulses BLEND (stronger motor, longer time) with whatever plays instead of replacing it,
  both ways; a pellet or pierce hit that adds nothing plays nothing. Not felt on a real controller here: tune by hand.

## 14 November 2026 - A full magazine fills when an upgrade makes it bigger (`claude/bughunt`)

The user's request: buying a Deluxe warranty on a full Rivet Rifle left it at 36/45 until a reload. Now any upgrade that makes the
magazine bigger (warranty tiers and renewals, attachments, the claw's attachment prizes, a limited edition's build) fills a FULL
magazine to the new size, free: the reserve is untouched (the user chose free over "out of the reserve"). A part-empty magazine is left
as it was. weapon.js setDef does it; it also remembers `unloaded`, the rounds a smaller magazine sent back to the reserve, and takes
those back first, because refitting between two owned attachments is free and a full Speed Loader <-> Jumbo Pack swap would otherwise
have made 14 rounds every time. (`unloaded` is not saved: after a Continue one such swap can still gain them once.)

## 14 November 2026 - The bug hunt's open decisions, decided (`claude/bughunt`)

The user's answers to the hunt's "proved but left for a decision" list (the entry below), each with a test in tests/bugHunt.test.js
unless noted. No save-version bump: every new saved field is optional on restore, so an older save still loads.
- **A boss's voucher survives Save & Quit.** powerUps saves `owed`: a boss reward (or an Employee of the Month's drop) on the floor or
  still queued at the round's start; on a load it falls again where it was. The boss is often the wave's last kill, so the snapshot
  was taken before the voucher could be picked up.
- **A claw grab the save dropped is refunded.** clawMachine.serialize holds the machine as it was before a grab under way (stock and
  grab count back) plus `refund`; restore hands the points back. A free-grab token spent on it is still lost.
- **Build-A-Blaster Hearts that can never fire: left as they are** (the user: not a big deal). Headshot on the Tennis Ball Launcher,
  Leaf Blower and Return to Sender, Reload on the Leaf Blower, and a ball's Last Round going off 6 m ahead.
- **Second Chance keeps Bubble Wrap** (health.revive puts the layers back after its reset).
- **A reissued Return to Sender has the ammo the last one had** (returnQuest remembers magazine and reserve while you carry it, saved
  as `lastAmmo`): buying a 500-point wall gun over it is no longer a free full reload.
- **A Flash Sale on nothing is skipped.** saleEligibility also asks collectSaleSpots for at least one buy spot (GRAB-A-GUN stays the
  stated exception; Kevin's cart keeps its own rule). tests/flashSales.test.js's tag re-read test now uses a wall gun sale that gains
  a second spot, since a sale that marks nothing can no longer start.
- **A fleeing Shoplifter can be knocked down**: its getaway control steps aside while it is staggered (zombie.js does the stagger)
  and the getaway clock waits.
- **Customer Parking:** the planted kerb island gets a topper, and so does the 0.75 m slot between it and the first van (a body
  fitted, the nav grid's cells did not: zombies stopped 2.6 m short at either end).
- **Save slot and storage:** the "save discarded" notice is a line on the title screen (screens.setTitleNote, saveGame.takeNotice;
  it was a HUD line wiped by setDimmed in the same call); a NEWER build's save is left in its slot (config/save.js newerNotice) and
  Play does not delete it; storage the browser blocks greys Save & quit out (reasons.blocked) instead of saving into memory; a
  refused write greys it out with reasons.full until the next round's snapshot (main.js redraws the pause card); careerStats re-reads
  the stored ledger before adding a run, so two tabs add up. Not changed: settings are still last-writer-wins across tabs.
- **Controller and receipt:** a controller run pauses on the window's blur (main.js; shown in the browser, before and after); the
  receipt ignores keys and controller buttons for menuFeel.receiptGuardSeconds (0.8 s) after it appears, a mouse click always counts
  (tests/controllerMenus.test.js, with an injectable clock: createScreens({ now })).

## 14 November 2026 - Drawing-side waste removed: the gun in hand, bullet marks, still matrices, shadows, the corner map (`claude/render-waste`)

The bug hunt (`claude/bughunt`) measured constant per-frame and per-shot work that did nothing, and left it alone because each
fix touches drawing code. This is that work, one commit per item, each with a test that fails on the old code. Timings are
headless in Node on the 16 GB PC unless they say browser; counts are exact. Started from main (the bug hunt was not merged yet).

| What | Before | After |
|---|---|---|
| Objects under the gun's scene (staple gun in hand) | 3,875 (4,103 after one skinned gun) | 262 (and 262) |
| The gun scene's matrix pass, and one muzzle lookup | 0.36 ms and 0.40 ms per frame | 0.02 ms and 0.02 ms |
| One bullet mark (batched mall, 157 sample shots) | 5.60 ms | 0.50 ms (0.33 ms in the browser) |
| Marks re-checked per frame at the 200 cap | all 200 (0.049 ms) | only those on moving surfaces (0.016 ms) |
| Map objects rebuilding their matrix per frame | 2,579 (0.27 ms) | 1,162 (0.16 ms) |
| Contact shadows, 24 walking zombies, 594 colliders | 0.065 ms per frame | 0.007 ms |
| Corner map, per second at 60 fps | 60 layout measurements, 60 redraws, 120 text writes | 0, 30, 0 |

- **The gun in hand** (weapons/viewmodel.js). All 15 gun models, and every skinned twin built later, stayed attached to the
  gun's scene, hidden. three still walks hidden objects. Now only the gun in hand is attached; `setActive` swaps them, and
  the sleeve styler is handed the waiting models directly. tests/skinEquipment.test.js had counted two staple housings in the
  scene (the pile-up itself); it now checks one at a time and that the twin is built once.
- **Bullet marks** (fx/impactMarks.js, new fx/triangleGrid.js). Each wall hit refreshed every matrix under the map, walked the
  map for visible meshes and ray-tested all of them. The surfaces are now listed once (still meshes with a world box; meshes
  under a `userData.dynamic` parent are tested every shot) and relisted after `refresh()`: a barrier opening, static batching,
  a new run. **The mesh list alone was not the cost**: it only took a shot from 5.6 to 4.6 ms. The time went on testing every
  triangle of the merged meshes the ray crosses (about 52,000 per shot, plus the hit mesh four more times for the corners), so
  big still meshes get a triangle grid, built at start-up in the browser (68 ms, 4 MB). It returns exactly three's hit: the
  same 106 of 157 sample shots are accepted, and the test compares it with three on 2,000+ rays. The whole ray is still
  tested, so a decoration in front of the wall rejects or takes the mark as before. One behaviour changed: a mark on a still
  surface is no longer re-checked every frame, so a mark on a poster that Graphics > Small detail hides at a distance now
  stays (it used to be deleted for good).
- **Still matrices** (world/staticBatch.js `freezeStatic`, called by main.js after batching; `?nofreeze` to compare).
  Everything under the map that is not under a `userData.dynamic` parent or a shutter stops rebuilding its matrix. Checked
  first what moves without the flag, with a scripted run (every door, 24 rounds, bosses, Mascots, the claw machine moving,
  every interaction, every gun, Play again): one thing, the hallway's swaying hanging sign, which now hangs in a flagged
  group. A frozen thing that is moved later just stands still, with no error, so `movedWhileFrozen(root)` lists such
  objects: tests/staticBatch.test.js plays a run and expects none, and `__mall.movedWhileFrozen()` does it in a browser
  check. The other 1,162 objects are inside dynamic groups (Kevin's five carts, the claw cabinets, showpieces) and still
  update; most of them do not move either, but that needs a look at each group.
- **Contact shadows** (fx/contactShadows.js). Each zombie read all ~600 colliders every frame. It now remembers the ones
  within 0.75 m of where it last looked and reads the list again after walking that far or when a door changes it.
- **Corner map** (ui/minimap.js; off by default). It measured its box every frame (a forced page layout), redrew every frame
  and rewrote its two strips. It now measures when it appears or the window resizes, redraws
  `config/minimap.js corner.redrawsPerSecond` (30) times a second, and writes a strip only when its words change.
  **To judge by eye:** the map now turns at 30 steps a second, not 60. Set the number to 60 to put it back.

Browser check (built, `vite preview`, `window.__mall`): all 15 guns come up with 246-442 objects in the gun scene and the
muzzle in front of the eye; a skinned staple gun and the cardigan sleeves show on it; marks land on the wall (0.33 ms each);
all 14 shutters roll; the sign sways; Kevin opens at the Atrium with his goods out; GRAB-A-GUN moves; the corner map draws;
`__mall.movedWhileFrozen()` stayed empty throughout. Frame times were not compared: the pane was hidden, where they mean nothing.

Not done: skinned twins are still kept for the whole session once built (off the scene, so they cost memory, not time).
Shared files touched: CLAUDE.md (one line on the freeze in the dynamic-flag gotcha), src/main.js, src/game/createGame.js,
docs/tests.md, docs/folder-structure.md.

## 14 November 2026 - Punch picked by ear: Confetti C, Rivet C, Stargazer A (`claude/audio-overhaul`)

From the three takes on the audition page (A tighter, B in between, C bigger, all at the same loudness), the user picked C for the
Confetti Cannon (a heavier driven kick, two slaps, an 8 dB dip) and the Rivet Rifle (a driven kick that still ends by 0.08 s, two
slaps), and A for the Stargazer (one slap, a 5 dB dip). They are now config/gunSounds.js's recipes; the other takes and
tools/auditionPunch.js are gone. Measured: the loudness order held, no two guns above 0.72 alike, and the stress test peaks at -1.0 dBFS.
## 14 November 2026 - Full-repo bug hunt (`claude/bughunt`)

Seven readers went through the game by area (game core, features, guns and player, zombies, UI, map, leaks); every candidate was
proved in the real headless game (or the browser) before it was fixed. One commit and one test per bug: tests/bugHunt.test.js.
The branch was brought up to main (the audio overhaul) first; no audio file, `sounds:` block or sound.play line was touched.

**Fixed (what the player saw):**
- **The horde froze** when you hopped into a pocket with no zombie-walkable floor within 1.5 m (behind the Food Court bench by the
  RESTOCK-O-MATIC, the south-west nook behind a table, the parking kerb island): no route field, every zombie stood still, no spawn
  marker had a route, the round stopped spawning. navigation.js now falls back to the nearest cells within
  zombieNav.playerFallbackRadius (4 m), walls or not, also when the field stays inside a sealed pocket (pocketCells). The cinema
  service stairs' nav link was 0.9 m narrower than the stairs (the same freeze in a 10 cm band along each wall): full width now.
- **Map perches and a dead end** (found by a flood fill of everything reachable, replayed with real keys): the sealed escalator's
  side walls step up like stairs from the planter (free entry to the unbought Promenade, and a perch); a hop from a display prop
  cleared a Food Court store counter into the clerk's strip, which has no way out; the TV wall (1.95 m), the arcade cabinets (1.9 m)
  and the Mega Mart gondolas (2.0 m) could be stood on. All get unseen, shot-through toppers (config/environment.js perchCap;
  attachmentDisplay's capTo for the counters). A sprint-jump up an escalator sank you 0.77 m under the treads (world/collision.js:
  a ramp now also catches a rising body once the slope reaches its feet).
- **Saves:** Employee Discount became permanent after Save & Quit (the coupon was saved, the timed effect that owns it was not: the
  coupon is no longer saved or restored; restore ignores the old field, so the save version is unchanged); Save & quit right after
  Stay for overtime wrote the pre-win snapshot; Continue replayed "Second Chance redeemed"; a claw machine saved during its last grab
  came back open with "0 left" and charged for a seventh grab.
- **Pay and credit:** Store-Wide Clearance killed a RUNG UP boss unpaid (its wound maths left out the Barcode Scanner's multiplier);
  Build-A-Blaster credited a balloon / rocket / ball kill to the gun in hand; the Full Refund label clamped a reserve above its cap
  down; the order form ordered a Stuffing that had left the bins; the Leaf Blower carried a phantom reserve round (gunStats rounded
  0 up to 1), so a Platinum one never claimed.
- **Guns:** a tennis ball thrown against a wall started on its far side (the rocket's guard, for balls); a holstered gun was frozen
  in time (fire delay and fuel tank only ticked in hand).
- **Zombies:** crowd spacing, queueing and the overlap rule ignored height (the Promenade shoved the Hallway under it); the failsafe
  never rescued a zombie wedged on the floor above you within 5 m on the map; a boss's backup announced 'typeIntro' without the zombie.
- **Menus:** winning with the mouse put the pause card over the van's drive-off (main.js's lock handler now skips a pending win;
  shown in the browser); a menu opened mid-jump left you hanging in the air.
- **Waste:** hud.setVoucher ran every tick; a Sentry with zombies in range but none in sight re-cast its sight lines every tick
  (ticks about 70% slower with 20 hidden zombies).

**Proved but left for a decision** (the report to the user has the list): a boss voucher or a claw grab under way when the round
flips is lost by a save; Hearts that can never fire on some guns (Headshot on the Tennis Ball Launcher, Leaf Blower and Return to
Sender; Reload on the Leaf Blower) and a ball's Last Round going off 6 m ahead through walls; Second Chance wiping Bubble Wrap; the
free Return to Sender reissue as a cheap full reload; Flash Sales on nothing buyable; a fleeing Shoplifter ignoring staggers; the
parking kerb island (zombies now come within 2.4 m but cannot step onto a 0.15 m kerb); the "save discarded" notice nobody can see.
**Measured, not changed** (render side, wants a browser profile): the viewmodel scene keeps all 15 guns attached (3,875 matrices a
frame), effects.impact raycasts the whole map per wall hit (about 6 ms), nothing freezes the static map's matrices.
No leak was found: scene objects, colliders and bus listeners return to baseline after Play again, and zombie, claw, Kevin and gun
cycles leave no geometry, material or texture behind.

## 14 November 2026 - `npm run audition`: the gun sound audition without the dev server (`claude/audio-overhaul`)

The dev server took too long to start just to listen. tools/openAudition.mjs bundles tools/audition.html (the sound engine, the gun
configs and the page: not the 3D mall) into one 200 KB file, dist-audition/gun-sound-audition.html, and opens it in Firefox. Like
`npm run play`, it rebuilds only when the code changed (tools/play.mjs now exports openInBrowser). It is never part of the game's builds.

## 14 November 2026 - Gun sounds, round three: punch for desktop speakers (`claude/audio-overhaul`)

The Confetti Cannon, Rivet Rifle and Stargazer still felt light. Punch is three things, and now the big guns have all three:
- **A kick.** A tone that drops fast and then holds at 55-95 Hz (the new `freqTime`). Its part is driven, so the overtones
  carry the bass on speakers too small to play it (the user listens on desktop-style speakers).
- **A slap.** A short low-mid noise burst.
- **Contrast.** The new `duck`: everything else (a new `world` bus) dips 5-8 dB for 0.2-0.3 s. The shot itself and the hit
  sounds skip it. Only the rare big guns duck (Confetti, Stargazer, Return to Sender, the Bottle Rocket burst, the Party Trap);
  automatic guns never do (it would pump).

Version B plays in the game. tools/audition.html has A (tighter) and C (bigger) of each, at the same loudness, to pick by ear.
Measured: the order of loudness held, no two guns above 0.70 alike, and the stress test peaks at -1.0 dBFS.

## 14 November 2026 - Gun sounds, round two: less echo, more punch, a BOGO per gun (`claude/audio-overhaul`)

The first listen found the echo overdone and several guns too light. The fixes:
- **Rooms:** every room is shorter and drier (hall wet 0.22 -> 0.10, Atrium 2.6 -> 2.0 s), and every gun's send into it was cut
  to about a third. Shot tails went from 0.8-1.0 s to 0.3-0.5 s.
- **Punch:** the master compressor's attack went from 0 to 6 ms, so a shot's first milliseconds pass before it acts (the limiter
  and soft clip still hold the peak under 0 dBFS). The Confetti Cannon, Rivet Rifle and Stargazer got a wide crack and a hard
  driven kick that drops fast, plus a sub; the rivet keeps its TANG.
- **Balloon Launcher:** a wobbly rubber squeak and the neck's "brrrp". The pop is sharper.
- **BOGO:** it broke when the BOGO got a trigger per gun (`claude/bogo`): the sound alternated left/right on every shot, even
  with one trigger held. It now sits on the side of the gun that fired (`sidePan`, playerGun passes `side`). The shot is a short
  driven SMG "pap" instead of a 25 ms tick.

Measured: no two guns above 0.83 alike, and the stress test peaks at -1.0 dBFS (docs/gun-sounds.md).

## 14 November 2026 - Audio overhaul: every gun gets its own synthesized voice, and the mall gets rooms (`claude/audio-overhaul`)

Every gun used 2-9 plain layers (a noise burst or a tone sweep), a ±5% pitch wobble, and one shared dry click. Nothing had a
room, crunch or a voice limit, and an upgraded gun sounded like a stock one. It is all still generated in code, and no gameplay
number changed.
- **Engine** (audio/sound.js, the pure audio/recipes.js and audio/roomImpulse.js):
  - Each play is one voice, capped per sound and in total; the oldest is stolen with a 12 ms fade.
  - New layer types: `click` (a few ms of crack or an impulse tick, four random variants), `metal` (inharmonic partials for
    springs, rivets and bells) and `fm` (boings, rattles, buzzes). Noise layers can sweep their filter.
  - Each layer can be nudged a little on every play (`vary`). Drive (tanh saturation) works per sound, per part or per layer.
  - Recipes can have named parts (crack / body / mech).
  - A shared room reverb: two convolvers with generated impulses, crossfaded as you move between areas (config/audio.js
    `rooms` / `roomOf`, from the grade zones).
  - A limiter and a soft clip after the compressor, so nothing passes 0 dBFS.
  - `play()` returns `{ stop() }`, so the scanner's whine stops on a released scan.
  - Every old recipe still plays unchanged.
- **Guns** (config/gunSounds.js; design notes and the measured table: docs/gun-sounds.md):
  - Each gun has a fire sound with its own identity, its own dry fire, reworked reload steps in the same materials, and its
    impacts.
  - The Tennis Ball's bounces climb in pitch along a chain. BOGO's shots alternate hands.
  - The Kiosk Sentry has its own `sentryShot`, and the Party Trap its own blast.
  - The hit feedback is now a tick, a desk-bell ding, and a cash-register cha-ching.
- **Upgrades** come from data (`soundUpgrades`, picked by weapons/upgrades.js soundVariantOf):
  - Tiers make the body fuller and deeper; Premium and Platinum add a sheen, and Platinum a sub thump.
  - Renewals add a touch more.
  - Each Build-A-Blaster stuffing adds its flavour (on every few shots of an automatic gun).
  - The last 3 rounds play a lighter mechanism and a tick.
- **Settings > Audio > Room echo** turns the reverb off for slow PCs.
- **Dev-only audition page:** tools/audition.html under `npm run dev`. It plays every gun's sounds at their real timing in any
  room, compares them with the old ones (tools/auditionLegacy.js, kept until the new sounds are signed off), and measures them.

Measured (offline, dry RMS = the loudest 50 ms in dBFS): BOGO per shot -26.2, Sentry -25.1, Staple Gun -24.7, Price Gun -23.4,
Foam Dart -23.1, Leaf Blower -21.7, Balloon -20.0, Nail Gun -19.5, Rivet Rifle -19.1, Tennis -18.7, Barcode Scanner -16.5,
Coil Nailer -16.3, Bottle Rocket -15.7 (its burst -12.5), Stargazer -14.4, Confetti Cannon -14.3, Return to Sender -12.2.
- No two guns score above 0.71 alike; Rivet Rifle vs Coil Nailer scores 0.00.
- BOGO at 18/s with Platinum +5, glitter and hit sounds peaks at -1.1 dBFS, has no gaps, and renders 6.4x faster than real time
  offline.
- Tests: tests/gunSounds.test.js.
## 14 November 2026 - BOGO: a trigger per gun, no zoom, a one-at-a-time reload (`claude/bogo-triggers`)

From playtesting: right mouse aimed the BOGO, and its ADS zoom (fovMultiplier 0.93) took ~8 degrees off a 120 FOV for a gun that never lines up
with the eye; and the reload (both guns roll out and drop their magazines at once) read poorly. Now `akimbo: true` (config/weapons.js) gives it a
trigger per hand and no ADS (weapons/playerGun.js akimboTriggers): left mouse fires the left gun, right mouse the right; on a controller LT is the
left gun and RT the right (core/input.js actionDownOn/actionPressedOn ask one device, since 'fire' and 'aim' swap sides between them). Each gun
fires every 2 x fireInterval: one trigger is ~9 shots a second, both together take turns at the old ~18. Damage and spread are unchanged (the
hip spray; the balance test now rates it at the hip). The reload (models/bogo.js, viewmodel.reload.turns) goes one gun at a time: the left gun
tips in, muzzle up and rolled out, drops its magazine and slaps in a fresh one while the right waits lowered, then the right, then both flick up;
the reload sound events play once per magazine (the same sound names, so the audio overhaul's recipes still apply).

## 13 November 2026 - The game gets an icon (`claude/icon`)

The title screen's logo as an "SG" monogram (Righteous, white with the pink offset shadow and glow, on the dark plum): src/icons/.
icon-64.png is the browser tab icon (index.html's `<link rel="icon">`; tools/buildSingle.mjs inlines it as a data: URL, so the single
file carries it); sunset-galleria.ico (256/64/48/32/16) is for a Windows shortcut to play.cmd.

## 13 November 2026 - Controller audit: one menu model, pad glyphs everywhere, new rumbles (`claude/controller`)

core/gamepad.js had not changed since October; everything added since was audited for a pad (the table: docs/controller-audit.md).
Gameplay already worked on a pad (buying, the claw, Kevin, the order form, charge and scope); the menus around a run were the gap.
- **One menu model (core/menuNav.js):** D-pad or left stick moves (held: repeats after 0.4 s, every 0.11 s), A / B, LB / RB tabs,
  the right stick or a held trigger scrolls, Start / Y / X shortcuts. The DOM menus read new pad-only ui* actions (a key there would
  press a web-page button twice); the order form and fitting room read menu* through the same navigator (their hard-coded stick numbers
  moved to config/controls.js menuNav). Moves go to the nearest button that way (spatialStep), so the receipt's row and the locker's two
  columns work. ui/menuFocus.js is the shared cursor and the locker / Survival Guide / Challenges padNav. Before: raw Pad codes, up/down
  only, no stick, no hold, and the receipt, guide pages, stats and notices could not be scrolled.
- **Glyphs (ui/glyphs.js):** every menu hint line and How to play's keycaps follow the device used last (Xbox / PlayStation names; with
  the keyboard the lines still advertise the controller). Confirm buttons say "Press again". Controls opens on the Controller page from
  a pad, with an "In menus" list.
- **Rumble:** blasts (rockets, balloons, Soda Bombs), the Air Horn, a boss arriving and falling, jackpots (the claw's prize, prize
  tickets, a gold Mascot), a Doorbuster going live, and a hum that grows while the Barcode Scanner scans (config/haptics.js).
- Not built: rebinding (the Controls screen is a reference). Checked in the browser with a fake pad only: what to try with a real one is
  at the end of docs/controller-audit.md.
## 13 November 2026 - Buying a door is a moment (claude/doors)

- game/doorOpenings.js turns a door 'purchase' into bus events: 'areaOpened' (once per purchase, with the PA's welcome on an area's
  first opening this run), 'barrierOpening' per barrier set rolling (bought = the one paid at; the others are free connections) and
  'barrierOpened' when it is fully up. Listeners: the announcer, game/shutterSounds.js, core/haptics.js, fx/doorOpenView.js (new).
- Per kind of barrier (config/shutters.js opening.profiles, by finish): rattly (the start shutter: padlock click, tinny rattle), roll
  (store grilles: key and latch), service (steel staff doors: deadbolt, heavy grinding motor, dusty), grand (the brass Atrium/HOFFMAN'S/
  Cinema fronts: a shop bell, smooth roll, ringing clunk), repair (the escalator: a spin-up and engage). Each: unlock + motor, roll ticks,
  a heavier end clunk (config/audio.js). The mall has no glass doors: "grand" is the storefront version.
- The curtain is DRAWN eased (opening.rollEase 2.2: leaps off the floor, settles into the housing) and rattles sideways as the motor
  catches. The real roll is untouched: the collider leaves on exactly the same tick (1.2 s roll, gone at 1.9 m), and the drawn curtain
  is never below the real one. Dust puffs along the floor line and falls from the housing (effects.splat); light from the new area spills
  through (a pooled additive card past the curtain and a floor tongue, coloured by area; it follows the real roll, then fades over
  0.5 s, so a paused game or a long frame cannot use it up; no real lights). A small view nudge and
  a controller thump when it clunks home within 10 m.
- Free connections opened because you now own both sides: a smaller rattle and less dust, only a quiet clunk; no glow, nudge, rumble or PA.
- PA welcomes (kicker 'Now open', two lines per area, docs/voice.md PA voice) carry `ifQuiet`: the HUD drops them instead of queueing when
  another PA line is up, and the announcer skips the chime (hud.showAnnouncement returns false).
- Save & Quit: the restore opens doors with { instant: true } (snapped open, no events/sounds) and counts owned areas as welcomed.
## 13 November 2026 - Shoppers become 1986 mall-goers, and a crowd of them costs less to draw (`claude/shoppers`)

- **Eight archetypes** (config/shoppers.js), each with a few variations, every colour from a curated 1986 palette (`colors`): the
  weekend shopper (tee/polo/raglan/rugby, jeans or shorts, bags), the velour tracksuit (colour-blocked shoulders or panels, matching
  trousers; not the Mall Walker's striped one: no headband or wristbands), the mall-rat teen (colour-block windbreaker, neon tee or jean
  jacket, acid-wash jeans or a ra-ra skirt with leg warmers, big hair, side pony, mullet, flat-top, a slushie, a Walkman with orange foam
  headphones), the office worker on lunch (shirt and tie, loose tie, short sleeves with a pocket protector, a power suit with shoulder
  pads; big glasses, a briefcase), the parent with a front carrier (a sleeping baby in a bonnet), the retiree (cardigan or sweater vest,
  a perm or a flat cap, glasses, a purse), the food-court crew in their stall's colours (Corn Dog Corral, Burger Barn, Pretzel Palace,
  Wok This Way: paper hat or visor, apron, name badge, a spatula) and the rocker (denim or studded vest over a tee with a back patch,
  long hair or a mullet, a chain wallet). Widths 0.92 / 1 / 1.08; heights never change (the head hitbox is fixed). Nothing the Shoplifter
  (dark hoodie, beanie) or the Mall Walker wears. The Cart Pusher wears them too.
- **One material per Shopper.** It used to be a material per colour per zombie (~8 each) and a mesh per material per bone: 433 draw calls
  for 24 Shoppers. Now every piece is a paint (zombies/shopperBake.js) and each bone is baked into ONE mesh with vertex colours, drawn
  with the Shopper's own vertex-coloured material (so hit flashes, Build-A-Blaster glows, the edge shading and the straggler highlight still
  work per zombie): 8 draw calls a Shopper, 192 for 24. Baked geometry is shared between Shoppers whose bone looks the same, ref-counted
  and freed with the last one (normals and colours in bytes).
- **Deterministic looks.** A look is a pure function of zombie.lookSeed (one Math.random draw per spawn in zombieManager). While a seeded
  Shopper builds, its own random stands in for Math.random, because Three.js draws on it for every object id and a look's piece count
  varies: building one never moves the game's random numbers, so changing a look no longer shifts seeded tests.
- New: zombies/shopperModel.js, zombies/shopperBake.js. Changed: config/shoppers.js (rewritten), zombies/shopperAppearance.js,
  zombieModel.js (Shopper path), zombie.js and zombieManager.js (lookSeed). limitedEditions.test.js reads `appearance.held`.
## 13 November 2026 - Rivet Rifle and Heavy Coil Nailer separation (`claude/hydrogen-rivet-coil`)

Separated the Rivet Rifle and Heavy Coil Nailer (both were `damage: 95`, `fireInterval: 0.1` in `src/config/weapons.js`; numbers and adjacent comments only):
- **Heavy Coil Nailer (`coilNailer`):** `damage` `95 -> 120`, `fireInterval` `0.1 -> 0.125` (`8.0` shots/s, `7.9` s drum). `npm run balance` at 5 m: burst DPS `950 -> 960`, sustained DPS `647 -> 700` (2-15 m; `575 -> 622` at 20 m, `424 -> 459` at 30 m), round-8 Shopper body shots `8 -> 6`.
- **Rivet Rifle (`rivetRifle`):** `damage` `95 -> 80`, `fireInterval` `0.1 -> 0.085` (`11.8` shots/s, `2.5` s mag). `npm run balance` at 5 m: burst DPS `950 -> 941`, sustained DPS `582 -> 538` (2-10 m; `542 -> 501` at 15 m, `469 -> 433` at 20 m, `349 -> 323` at 30 m), round-8 Shopper body shots `8 -> 9`.
- **Tests (`npm test -- tests/balance.test.js` + 23 matching test files, unedited):** 429/434 subtests passed; 5 failed (`balance.test.js:97` old 8-shot round-8 target, `coilAndScanner.test.js:24` old 10/s check, `rivetRifle.test.js:23` old 10/s check, `rivetRifle.test.js:40` sustained DPS `538` falling under `0.95x` Foam Dart Blaster `570` because the faster mag empties in `2.5` s against an unchanged `2.0` s reload, and `weaponProgression.test.js:29` 9 round-8 Shoppers now fit in one 64-nail drum at 6 shots/kill). Details: `docs/archive/weapon-balance-pass.md`.
- **Review fix:** the Rivet Rifle's magazine `30 -> 36` (reserve stays 144: four magazines) and headshot multiplier `1.75 -> 2` (a headshot 160, about the old 166, still above a Foam dart's 157.5), so the faster gun is still an upgrade over the
  Foam Dart Blaster: sustained `538 -> 579` at 5 m (Foam `570`), `539` at 15 m. The four other failures were the old numbers in the tests
  (fire rates 12/s and 8/s, round-8 body shots Rivet 9 / Coil 6, a Coil drum now needs 11 round-8 Shoppers to run dry): updated.
## 13 November 2026 - BOGO, the akimbo SMGs, in GRAB-A-GUN (`claude/bogo`)

A new claw-only gun (purple capsule, weight 6): BOGO, Buy One Get One. Two label-tagger SMGs, one in each hand, firing in turn. To the game it
is one gun (config/weapons.js bogo): one 60-round magazine (two 30s), one trigger, one 2 s reload. 60 a hit every 0.055 s (~18 a second, the
fastest there is), falloff from 7 m to 0.45x at 18 m and a wide spray that blooms: `npm run balance` sustained 686 at 2 to 5 m (the Coil
Nailer 647, the Rivet Rifle 582), 364 at 15 m (the Price Gun 407), 216 at 20 m. Right mouse raises no sights: it pulls the pair in and
tightens the spray (spread.adsMultiplier 0.55; hip 438 vs 592 at 10 m), the crosshair stays. The model (weapons/models/bogo.js) is the pair;
the viewmodel gained three optional hooks for it (onFire, createUpgradeVisuals, skinTargets; animate gets aimAmount), so attachments, warranty
trims and skin prints go on both guns. Skins: Markdown, Two for One (BUY 1 / GET 1, 300 quick kills), Doorbuster Rush (50 kills in a round).
Its wall mark is a little two-for-one tag (impactModels bogoTag).

## 13 November 2026 - Tennis Ball Launcher keeps up; Barcode Scanner: scan and ring up (claude/gun-rework)

- Tennis Ball Launcher: 60 a hit x (round Shopper health / 150)^0.85 by the round the zombie spawned in (roundScaling; zombie.round), so a
  Shopper takes 3-4 hits from round 1 to 30 (it was 24 by round 15). A faster, flatter ball (28 m/s, gravity 4) zeroed at 10 m: it lands
  on the crosshair instead of ~0.7 m under it at 10 m. Seeks the next zombie within 4.5 m.
- Barcode Scanner: hold to scan (red scan line on the target, a ring filling round the crosshair, the window and LEDs, a rising whine);
  the beam fires itself when the 0.45 s scan completes, with a checkout BEEP: 420, 2x headshots, pierce 4. No weak tap: let go early and
  nothing fires. Everything a beam hits is RUNG UP for 4 s (game/rungUp.js, a red price tag over it, fx/rungUpView.js): x1.35 damage from
  everything and +40 on a kill while marked. Sustained 292 -> 494 (~645 on its own marked target; Rivet Rifle 582, Price Gun 434).
- Numbers and reasons: docs/archive/weapon-balance-pass.md (13 November 2026 section). New: game/rungUp.js, fx/rungUpView.js, fx/scanLine.js,
  hud.setCharge (the crosshair ring), gunStats roundDamageScale, audio scannerBeep.
## 13 November 2026 - The Shoplifter replaces the Mall Walker in the waves (`claude/shoplifter`)

Playtest: Mall Walkers (5.4 m/s, faster than your walk; up to 30% of spawns from round 9 with no cap; a slimmer hitbox) made rounds about
running away, not shooting. They leave the waves (economy.zombieMix.mallWalker is summon-only: Skylar's fans, Kettle's lockdown backup
and the Last Customer's backup still bring them) and the SHOPLIFTER takes round 4: a jogging shopper (3.6 m/s, under your backpedal) in a
hoodie and beanie with a bag, 0.8x health, a 25 hit. A hit steals 10% of your points (50 to 400) and it runs off (navigation.directionAway: the
player field walked uphill) at 5.2 m/s with a gold coin over it; kill it within 8 s and every point comes back (plus its 70), else they are
gone. 12% / 18% / 20% of spawns from rounds 4 / 6 / 9, at most 3 alive. PA pools for the theft, the recovery and the getaway, a till's
"ka-ching" and a recovery chime. New: game/shoplifting.js, fx/lootView.js, wallet.lose/recover, a Shoplifter guide page and death report;
the Polka Dot skin (Balloon Launcher) now asks for 100 Shoplifters instead of 150 Mall Walkers. Also: zombie.walkToward no longer assumes
a Mascot (it read the Mascot's acceleration).

## 13 November 2026 - Return to Sender becomes a blast (`claude/claw-guns`)

The wonder weapon felt underpowered for its rarity: it instant-killed, but one zombie per pull. Asked for something like a COD "Thunder Gun"
(a wide blast that flings a crowd), in our own theme:
- **The blast (`src/config/weapons.js` returnToSender.cone, `src/weapons/playerGun.js` fireCone):** it now fires through the Leaf Blower's cone code
  (`weapons/coneBlast.js`). Every returnable zombie within `cone.killRange` (9 m, 30 degrees each side, no wall between) is returned (the same
  `weapons/returnToSender.js` path: an instant kill at any round, the cardboard burst, the stamp sound) and flung (`impact.deathImpulse` 3.2); the
  rest of the cone, to 12 m, is shoved and knocked down unharmed. Bosses and Mascots within killRange take the big fixed hit as before. Every zombie
  caught pays its +10. Two blasts a tube, twelve in all (was 5 and 19 single kills), fireInterval 0.9, reload unchanged at 3 s, the half-rate
  refill unchanged. The fire sound (`returnBeam`) is now a pneumatic whoomp. `tools/economyBot.js` still counts it usable (it has a cone).
- **Labels (`src/game/returnQuest.js`):** one blast returns a crowd, so Chain Return and Product Recall act once per blast (from its first return)
  and Full Refund rolls its round back once per blast (its points are still per return): otherwise one pull would chain through a round or refill
  itself. The gun's 'shot' event ends a blast (`blastDone()`).
- **Model (`src/weapons/models/returnToSender.js`):** the plain scanner box is now a pneumatic tube cannon (a flared bell, a glass chamber with a
  parcel canister, a tube curl, a stamp, the rainbow label kept). Reload: flip the glass lid, lift the spent canister out and toss it, drop a fresh
  one in, shut the lid, thump the stamp. New palette roles glassColor (glass) and canisterColor (ammo).
- **Tests:** instantKill.test.js (one blast, the edge, the sides), returnQuest.test.js (labels once per blast), balance.test.js (the new role),
  closingTime.test.js (the Last Customer is returned from inside the cone, not from 30 m), skins.test.js roles; the model fixture regenerated for this
  gun only. The economy simulation was NOT rerun (about 90 minutes): the bot's income with this gun will have changed.
## 13 November 2026 - The vault goes where you look

Playtest: first the vault refused angled runs, then (after loosening it) it vaulted you sideways when you were not facing the
counter. A headless matrix (real input, a counter, a deep counter and a bench; path angle x where you look x walk/sprint x the gap
at the press) showed three causes:
- Where you looked was ignored: `maxLookDegrees` 100 compared your view with your VELOCITY, so a pure strafe vaulted exactly like a
  run straight at it. Now it compares your view with the direction the vault would carry you, at 55 degrees (rails: their own
  `ledge.maxLookDegrees` 70, so angled runs at a rail still climb it, but strafing along a balcony looking along it never tips you over).
- The angle limit leaked: a straight path refused as too steep was "rescued" by `directionSearchDegrees` turning it 12-24 degrees
  into the counter, so skimming past at 85 degrees vaulted. The turned paths now only dodge a blocked landing.
- `maxDepth` measured the diagonal an angled run takes through the obstacle, so a 0.9 m counter refused anything past ~45 degrees
  (the original "angles don't vault"). It is now the thickness straight through the face you enter; `maxApproachDegrees` 75 -> 65
  is then the one angle rule for every obstacle.
Result on all three obstacles: running at it from straight-on to 60 degrees vaults (walk or sprint, from up to 3 m out), looking a
little off your path is fine; strafing along it, looking well away, or skimming past at 65+ degrees is a plain jump.
## 13 November 2026 - Stargazer 3000: sniper hip fire

- Playtest: from the hip it played like a piercing shotgun. The hip cone was 4.5 deg: a standing hip shot hit 100% at 3 m and 79% at
  5 m. Now `spread.base` 12 and `spread.moving` 5 (config/weapons.js): ~77% at 2 m, ~50% at 3 m, ~25% at 5 m, ~3% at 15 m (npm run balance);
  through the scope it is still dead on. tests/balance.test.js pins hip at 3 m <= 60% and at 5 m <= 35%.

## 13 November 2026 - Bottle Rocket Bazooka: a better model and a breech-loading reload (`claude/claw-guns`)

- **Model (`src/weapons/models/bottleRocket.js`):** a crimped mouth, a yellow label wrap with stars, a ring front sight and a peep, a fat fuse coil with a
  wick and a flickering tip (`fire.fuseFlicker`), a shoulder pad, and a breech cap on the back end hinged on the left. `tests/fixtures/weapon-materials-phase-1.json`:
  only this gun's entries regenerated.
- **Reload (same 2.4 s, keys in `viewmodel.reload`):** it used to load through the mouth, which is at the far top-left of the screen, so the loading was
  tiny. Now the tube turns side-on, the cap swings open AWAY from you (a right-hand hinge swung it into the camera once the tube was side-on), the burnt-out
  casing is pulled and tossed, a fresh rocket slides in through the breech (its nose shows in the mouth from `rocketInAt`, which replaces `tubeEmpty`: the
  old window let the nose flash on the first frame), the cap shuts and the tube gets a pat before swinging home low. Test: `bottleRocket.test.js`.

## 13 November 2026 - Stargazer 3000 keeps its scope; both claw guns' models and reloads redone (`claude/claw-guns`)

- **The scope bug (`src/weapons/aim.js`, `src/weapons/scope.js`, `src/config/weapons.js`):** a Stargazer shot used to drop the ADS amount to `scope.boltDropTo`
  (0.35), under the eyepiece's `overlayFrom` (0.75), so every shot blanked the scope for about a quarter second while it eased back. That was by design
  ("the eye comes off the eyepiece to work the bolt"), but it plays as being kicked out of the scope, so the drop is gone: firing never lowers the sights,
  scoped or not. `boltDropTo` is removed from the config. Tests: `stargazer.test.js` (fully aimed every tick through two shots and their bolts), `scope.test.js`.
- **Models (`src/weapons/models/stargazer.js`, `balloonLauncher.js`):** Stargazer: a left-side loading port (the camera sees the gun's left and top, never
  its right), turrets and a focus ring, a fluted barrel with a brass band, a ringed-planet front sight, a three-leg tripod, a shaped stock with a navy cheek
  rest. Balloon Launcher: polka dots, a domed tank with a valve wheel and a hose, a white-faced gauge, a teardrop balloon with a knot, curly ribbons, a
  helium cartridge screwed into the tank's back. `tests/fixtures/weapon-materials-phase-1.json`: only these two guns' entries regenerated.
- **Reloads (same lengths, keys in `viewmodel.reload`):** Stargazer: the trigger hand (gathered under a pivot group in the model) lifts and pulls the bolt,
  the gun rolls its left side up, the support hand presses a strip of bearings sideways into the port and flicks the clip away, the trigger hand closes the
  bolt. Balloon Launcher: the balloon lets go, the spent cartridge is unscrewed and tossed, a new one screwed in while the needle climbs, the gauge tapped,
  the balloon blows back up. Reload events may now be a bump with no sound (`tests/newGuns.test.js` allows it).
## 13 November 2026 - Kevin's cart is solid to the roof; the last shoppers no longer sprint

- **Cart collision:** the sign pass gave the carts a canopy, posts, a pegboard and a marquee, all decoration, over a 1.05 m vaultable
  counter collider, so the upper cart could be walked and shot through. Now the counter mesh is decoration and each cart has ONE invisible
  collider over its footprint from the floor to the roof's top (`kiosk.cart.roofY` 2.4 + `roofThickness` 0.09; dressCart reads roofY
  too). Not vaultable any more: the canopy leaves 1.35 m over the counter. tests/kiosk.test.js checks every site.
- **Last shoppers:** `economy.rounds.lastShoppers.speedUp` (new, false) switches off the end-of-round sprint (the last 2 zombies jumped
  to their fastest gait: the user found it caused cheap deaths). The "final clearance" PA stays; the straggler glow does the finding.
## 13 November 2026 - Closing Time says what to do next

- Playtest: after "Open the shutter" nothing said what Closing Time wanted (the four checklist boxes have no text, and the round-1
  briefing PA is easy to miss after the opening line). In Directed mode the line under the round box now shows `g.closing.nextStep`
  once the shutter is open: "Closing checklist · staff carry the keys" until a key exists, then "Collect <key>", the open duty with
  its count ("Shock zombies at the Atrium fountain 3/12"), "Validate parking by the van", "Closing time: serve the Last Customer",
  "Start Skylar's van". Wording in config/closingTime.js `objective`; Classic shows nothing (it is the discover-it-yourself mode).

## 13 November 2026 - Spill Cleanup draws shoppers through it

- The teal spill only slowed whoever happened to cross it. Now a non-boss shopper within `attractRadius` (10 m, same floor, clear line,
  the spill nearer to it than the player) walks to the puddle first (`zombie.detour`, steered in `Zombie.chase` before the route to the
  player), and is done with it once within `crossRadius` (0.8 m) of its middle, so each shopper is drawn once. Detours are let go when
  the spill ends. game/incentiveEffects.js `lureThroughSpill`; config/powerUps.js spillCleanup; tests/incentiveEffects.test.js.

## 13 November 2026 - Kiosk Kevin rests between moves and restocks every 3 rounds (`claude/hydrogen-kevin-calmer`)

Calmed Kiosk Kevin down so he rotates stock, Pick, and sites on a 3-round cadence instead of every round:
- **3-Round Stock & Pick Blocks (`src/config/kiosk.js`):** added `kiosk.stockEveryRounds = 3` and `kiosk.moveEveryRounds = 3`. Updated `stockFor(round)` and `pickFor(round)` to advance one step per 3-round block from `openingRound` (rounds `2-4` first stock + Soda Bomb Pick, `5-7` second stock + Sparkler Cake Pick, `8-10` Sentry + Bubble Wrap Pick, etc.), keeping `Pick` constant throughout each block.
- **3-Round Moves & Move-Only PA (`src/game/features/kiosk.js`, `src/game/events.js`):** Kevin only rolls a move at `'roundStart'` on move rounds (`openingRound + 3, + 6...`, i.e. rounds `5, 8, 11...`), preserving open-zone, stay-put, and mid-purchase defer rules. Removed `lastRound` so `kioskStock` PA fires once on initial/post-load opening (`opened` + `stock`) and on moves (`moved` + `stock` rotating by move index in one banner), staying silent on rounds where he does not move; `kioskHawk` shouts at the cart are unchanged.
- **Tests & Docs (`tests/kiosk.test.js`, `tests/saveGame.test.js`, `docs/folder-structure.md`, `docs/tests.md`):** updated round-by-round expectations to 3-round blocks (`5`, `8`, `11`), added pinned literal block coverage (`stockEveryRounds`, `moveEveryRounds`, rounds `1-16`, PA silence on `3, 4, 6, 7`, mid-block Flash Sales eligibility), and verified mid-block Save & Quit preserves Kevin's site and stock across reloads.

## 13 November 2026 - Twisty crunches where he walks (`claude/hydrogen-twisty-crunch`)

Extended Twisty the Pretzel's salt patches so bare-headed Twistys also crunch positionally where they walk through active salt:
- **Positional Zombie Crunch (`src/config/zombies.js`, `src/game/saltTrail.js`, `src/game/mascotCostumes.js`):** added `zombieStepMeters` (`0.72`), `zombieEntryStepMeters` (`0.08`), and `maxDistance` (`18`) to `mascotVariants.twisty.saltPatch`, passed `zombies` into `createSaltTrail`, extracted a shared per-walker `stepThroughSalt` helper, and tracked each bare-headed walking Twisty independently in a `zombieWalkers` `Map` (`clear()` resets it). Walking across any active salt patch plays `saltCrunch` attenuated by `1 - distToPlayer / config.maxDistance` (matching `Zombie.playSound` / `distanceTo` in `src/zombies/zombie.js`), keeping player crunch unchanged.
- **Guide, Tests & Docs (`src/config/guide.js`, `tests/twisty.test.js`, `docs/folder-structure.md`, `docs/tests.md`):** updated Twisty's guide `twist` note to mention both bare-headed Twisty and player crunches across active salt, and added tests covering bare-headed walking crunches, positional distance falloff/cutoff, silence when suited / outside / standing still, and independent tracking for a second Twisty.

## 13 November 2026 - Twisty the Pretzel Mascot (`claude/hydrogen-mascot-pretzel`)

Added the fifth Mascot costume, **Twisty the Pretzel** (`foodCourt` pretzel stand mascot), unlocking from **round 22** (rounds 10-21 unchanged):
- **Costume & Head (`src/config/zombies.js`, `src/zombies/mascotHeads.js`):** added `mascotVariants.twisty` (`name: 'Twisty the Pretzel'`, `unlockRound: 22`, `homeZones: ['foodCourt']`, deadpan PA `introBanner` & `helmetPopLine`, plum/cream/mustard baker's uniform, low-poly baked pretzel head parameters, and `saltPatch` tuning block) plus `HEADS.pretzel` (shared low-poly `TubeGeometry` outer loop and crossed twist arms, central knot face cushion, and proud coarse salt crystal blocks, gilded cleanly by `mascotGoldTypes.twisty`).
- **Underfoot Salt Crunch Beat (`src/config/audio.js`, `src/game/saltTrail.js`, `src/game/mascotCostumes.js`, `src/game/createGame.js`):** when Twisty's helmet pops (`mascotHeadPop`), `createSaltTrail` drops a pooled short-lived patch of salt crystals on flat floor (10 s life, 2 s fade, max 8 pooled). Walking across an active patch while grounded triggers the new multi-layer `saltCrunch` audio cue strictly as an audio clue with **no damage and no slow**; standing still, teleporting onto a patch, walking outside, or jumping remains silent. Patches clear on round end, `roundDiscard`, player death, Play again (`resetRun`), and Save & Quit (`transientSteps`), and `dispose()` frees every material, shared geometry, listener, and scene group.
- **Guide, Death Report & Tests (`src/config/guide.js`, `src/config/deathReports.js`, `tests/twisty.test.js`, `tests/receiptReview.test.js`, `docs/folder-structure.md`, `docs/tests.md`):** added the Survival Guide `mascotPage('twisty')`, words-only Form 109-C entry `deathReports.mascots.twisty`, `tests/twisty.test.js`, and `'twisty'` coverage in `tests/receiptReview.test.js`.

## 13 November 2026 - Review of PA pools round two and the Survival Guide audit

Merged through `claude/hydrogen-review-2`. The encore detection (met before this fight), the boss intro moving into the announcer table
(only the Survival Guide also listens to bossSpawn, and its first sighting carries no PA line, so nothing is reordered) and every guide
finding (checked: Skylar relocates on a timer or an unreachable spot; the finale is booked for the validation round + roundOffset) held up.
Fixed in review:
- **Kevin's opening PA:** `opened` and `stock` are joined in ONE banner; the new pools made it up to 233 characters (the original 147).
  Both pools rewritten shorter (worst now 181, under the existing moved+stock 220). `opened` plays once a run, so "once again open" went.
- **Murray's encore:** he runs, he doesn't charge; one 96-character line trimmed.
- **Guide wording:** Captain Coupon's after-pop clause reads "then he goes back for it instead of running" (the twist explains the rest);
  Stockroom Delivery's summary and hint lost the internals ("shell-loaded", Return to Sender's half) for plain words.

## 13 November 2026 - PA pools round two (`claude/hydrogen-pa-pools-2`)

Converted three more high-frequency single-line PA moments into deadpan mall-PA pools using `pickPaLine` and cosmetic `paRandom` from `src/game/announcer.js` (never `Math.random` or gameplay randomness), preserving original lines at index `0`:
- **Kiosk Kevin's PA (`src/config/kiosk.js`, `src/game/features/kiosk.js`):** expanded `pa.opened` (1 → 8 lines, each preserving `open in {where}`) and `pa.stock` (1 → 8 lines, each preserving `{stock}` and `{pick}`). `buildKiosk` now takes `lineRandom = paRandom` and picks both with `pickPaLine`, while `pa.moved` keeps its deterministic round rotation.
- **Boss encores (`src/config/bosses.js`, `src/game/bossDirector.js`, `src/game/announcer.js`, `src/game/createGame.js`, `src/game/events.js`):** added 4-line `encoreBanner` pools acknowledging a boss's return to the four encore-capable bosses (`influencer`, `guard`, `manager`, `janitor`; `lastCustomer` keeps `encore: false` with no encore banner). `bossDirector.js` checks `met.has(id)` before recording `met.add(id)` and emits `encore` on `'bossSpawn'`, and `announcer.bossesAndIncentives()` handles `'bossSpawn'` so encores pick from `encoreBanner` via `random` while first fights keep `introBanner` and `introSound` unchanged.
- **Platinum warranty claim PA (`src/config/upgrades.js`, `src/game/warranty.js`):** chosen as the third once-a-round PA moment because Platinum claims fire automatically once per round a Platinum weapon empties and already route through `announcer.js` (`'warrantyClaim'`), keeping high repeat visibility in late-round combat. Expanded `upgrades.claimPa` from `{ kicker, text }` into `{ kicker, lines }` (8 Customer Service lines keeping `Warranty claim approved` and `{gun}`), picked via `pickPaLine(upgrades.claimPa.lines, lineRandom)` with `lineRandom = paRandom`.
- **Tests & Docs:** updated `tests/kiosk.test.js`, extended `tests/announcer.test.js` and `tests/bossEncores.test.js` (pool invariants, injected-random coverage, first-fight vs encore banners, reset behavior, and default `paRandom` never calling `Math.random` while leaving all existing tests passing), and updated `docs/folder-structure.md` and `docs/tests.md`.
## 13 November 2026 - Survival Guide accuracy audit (`claude/hydrogen-guide-audit`)

Audited every factual claim in the Staff Survival Guide (`src/config/guide.js` and the incentive summaries sourced from `src/config/powerUps.js`) against `src/config/zombies.js`, `bosses.js`, `powerUps.js`, `weapons.js`, `closingTime.js`, `src/zombies/` (`zombie.js`, `observation.js`, `bosses/*.js`), `src/weapons/` (`weapon.js`, `playerGun.js`, `gunStats.js`, `melee.js`, `returnToSender.js`), and `src/game/` (`incentiveEffects.js`, `closingTime.js`). Confirmed all 14 enemy/boss pages (including `lastCustomer`) and all 11 incentive pages are already present.

Fixed only the inaccurate (`FALSE` / `PARTLY`) claims:
- **Shopper `tip` (`src/config/guide.js`):** no longer claims headshots deal more than body shots "with every gun" (`bottleRocket` and `balloonLauncher` have `headshotMultiplier: 1` and blast `part: 'body'`, `leafBlower` `fireCone` passes `'body'`, and `returnToSender` uses fixed `INSTANT_KILL_DAMAGE` / `bigFraction`), and allows `3×` on `stargazer` (`twice as much or more`).
- **Captain Coupon `notes[0]` (`src/config/guide.js` `mascotPage`):** added optional `afterPop` so Captain Coupon no longer shares the generic "then it RUNS at `5.6` m/s" claim; after shaking he goes for his helmet at `2.4` m/s (`mascotSeek`) and only runs at `exposedSpeed` (`5.6` m/s) if he gives up or loses his helmet a second time.
- **Skylar Sparkle `notes[0]` (`src/config/guide.js`):** no longer claims she "moves when I close in"; `influencer.js` only picks a new spot when `spot` is missing/unreachable or her `${influencer.filming.relocateSeconds}` s timer expires.
- **The Last Customer `notes[0]` (`src/config/guide.js`):** no longer claims she arrives "once the closing checklist is done"; she is booked in Customer Parking for the round after the duties are done and parking is validated (`closingValidated` -> `round + closingTime.finale.roundOffset`).
- **Stockroom Delivery (`src/config/powerUps.js`):** `summary` (displayed on the guide page) and `hint` no longer claim it "Refills half of every equipped firearm’s magazine reserve"; `gun.restock(magazineFraction)` refills every equipped gun's full `refillReserve` (half on `returnToSender` via `refillFraction: 0.5`) and tops only the held gun's magazine to at least `50%` unless reloading or shell-loaded.
- **Store-Wide Clearance `summary` (`src/config/powerUps.js`):** added `there` so boss damage is scoped accurately to bosses in that area of the floor (`inScope`).
- **Tests & Docs (`tests/guide.test.js`, `docs/tests.md`):** pinned assertions covering these mechanics without altering any existing checks.

## 12 November 2026 - Review of the four Hydrogen text branches (text pools, PA pools, Kevin's pitches, voice guide)

Merged through `claude/hydrogen-review`. The lines, voices and structure held up; fixed in review:
- **Death reports:** several rewritten tips were wrong when checked against the code (the Last Customer goes Speechless at her damage floor,
  not by crashing into the vans; Fairweather's meeting is cancelled before its buff applies, no buff is cancelled; no "open area" rule for
  Kettle's lockdown; only the hit that knocks a helmet off pays a bonus; the fryer oil covers the counter apron, not the kitchen) and up to
  151 characters (main's longest was 110: a narrow receipt). All tips rewritten to the code, at most 117 characters, with the old jokes kept
  where they were still true ("perimeter railings are not slides", "fryer oil does not check badges", "the far end of the Hallway").
- **PA random:** the Flash Sale teaser took its line from the sales' own random, so every later sale and discount shifted (two existing
  tests had their dice changed to fit). The cosmetic random now lives once in announcer.js (`paRandom`, never Math.random); flashSales
  takes a separate `lineRandom` and createGame lost its inline copy. The two tests' dice are back as they were.
- **docs/voice.md:** its death-report examples quoted the tips this pass replaced; the PA rule now admits the two old lines with "!".
- **Kevin:** the text-pool and pitch branches both edited config/kiosk.js; merged with both (25 lines, 10 duck, 8 back, the pitch table).

## 12 November 2026 - Text pool expansion and death-report accuracy pass (`claude/hydrogen-text-pools`)

- **Kiosk Kevin (`src/config/kiosk.js`)**: expanded `hawk.lines` (9 → 25, including 8 new `{product}` shouts), `hawk.duck` (4 → 10), and `hawk.back` (3 → 8) while keeping the existing opening lines in place.
- **GRAB-A-GUN (`src/config/clawMachine.js`)**: added deadpan PA lines across `pa.plush` (3 → 7), `pa.soldOut` (3 → 7), `pa.moved` (3 → 7), and `pa.restocked` (2 → 6), and added 6 three-line arcade screens to `screen.attract` (4 → 10).
- **Run-intro PA (`src/config/feel.js`)**: fixed the indentation on `runIntro.lines[0]` and added 14 deadpan mall PA opening announcements (6 → 20), each within the existing maximum line length.
- **Death reports (`src/config/deathReports.js`)**: audited and updated `cause` and `tip` copy across `fall`, zombies, mascots, bosses, `hazards`, `ownBlast`, and `hazardDefault` to match actual runtime behavior (such as mascot half-health unmasking without torso foam armor, Poppy Corn's instant zero-damage pop blast, Mopwater Murray's slowing puddles rather than cones, Officer Kettle's taser charge and gun-headshot radio break, Lorraine Pruitt's Speechless return flow, and fryer/fountain grace windows after activation) while keeping the words-only rule.

## 12 November 2026 - PA pools for the most-heard single lines (claude/hydrogen-pa-pools)

Audited single-line announcements in `game/announcer.js` and its configs on `claude/hydrogen-pa-pools` and converted the three highest-frequency single-line PA moments into deadpan mall-PA pools with injectable `random`:
- **Config pools (`src/config/economy.js`):**
  - `rounds.lastShoppers.pa.lines` (`waveEnding`, end of every round): 15 lines (the original plus 14 new lines, each `<= 44` chars), preserving `kicker` and `priority: 1`.
  - `rounds.clockIn.pa.lines` (`clockIn`, break skip from round 2+): 8 lines (original plus 7 new lines).
  - `flashSales.teaser.lines` (`flashSaleSoon` category sale teaser): 8 lines (original plus 7 new lines), each preserving `{lead}` and `{label}`.
- **Random picking (`src/game/announcer.js`, `src/game/flashSales.js`, `src/game/createGame.js`):**
  - Exported `pickPaLine(lines, random = Math.random)` and added `random = Math.random` to `createAnnouncer({ events, hud, sound, state, random = Math.random })`; `waveEnding` and `clockIn` now pick from `pa.lines`.
  - `createGame.js` passes a `crypto.getRandomValues` `paRandom` to `createAnnouncer` so cosmetic PA phrasing never consumes `Math.random` combat/bot draws (keeping seeded `economySim` runs intact).
  - `sayTeaser` in `src/game/flashSales.js` picks from `teaser.lines` via `pickPaLine(t.lines, random)` (with `t.text` fallback for minimal test configs). Save format (`version: 10`) is unchanged.
- **Tests & Docs:** extended `tests/announcer.test.js` (pool invariants, `pickPaLine` / `createAnnouncer` injectable `random`, and Save & Quit `load()` compatibility with pooled PA lines), updated `tests/rounds.test.js` (`waveEnding` and `clockIn` `.pa.lines` checks) and `tests/flashSales.test.js` (`dice(...)` roll adjustment for teaser draws + injectable `random` teaser-pool test), and updated `docs/folder-structure.md` and `docs/tests.md`.

## 12 November 2026 - Kiosk Kevin product pitches (claude/hydrogen-kevin-pitches)

Gave Kiosk Kevin product-specific sales pitches tied to his current round stock (`src/config/kiosk.js`, `src/game/features/kiosk.js`):
- **Config (`src/config/kiosk.js` `hawk`):** added `pitchChance: 0.35` and `pitches` with 4 short, exclamation-mark salesman lines for each of the 6 products he stocks (`sodaBomb`, `sparklerCake`, `bubbleWrap`, `airHorn`, `glitterBomb`, `sentry`), keeping lengths within the speech bubble budget and no stat numbers.
- **Deterministic cadence & Pick preference (`src/game/features/kiosk.js`):** on `'lines'` shouts, a deterministic `pitchCredit` accumulator triggers a product pitch at `pitchChance` (so the first lines stay predictable, zero `Math.random` calls are consumed, and `pitchChance` `0`/`1` edge cases behave cleanly). Pitches filter strictly to `stockFor(round)`, interleave Kevin's Pick twice per 4-turn cycle (`[pick, other0, pick, other1]`), and advance each product's own pitch turn counter so lines don't repeat back to back; all counters reset on `setUp()`.
- **Tests & Docs:** extended `tests/kiosk.test.js` (pitch table shape/length/words-only checks, `pitchChance` `0`/`1`/`0.35`, stocked-only filtering across rounds, Pick preference, no pitches for unstocked/fake IDs, and zero back-to-back repeats while keeping all existing hawk tests unchanged) and updated `docs/folder-structure.md` and `docs/tests.md`.

## 12 November 2026 - Integration: incentives, Flash Sales, Kiosk Kevin phase 8 and the claw guns on one branch

`claude/integration` (from main a013f9a) merges, in order: `claude/incentive-meter` (the reviewed tip of `claude/incentives`: it
holds that commit plus the review), `claude/flash-sales`, `claude/epic-hellman-cf878e` (Kevin phase 8) and `claude/magical-chaplygin-a0d099`
(claw machine + Stargazer 3000, Bottle Rocket Bazooka, Balloon Launcher).
- **Conflicts:** config/save.js (three branches each went to version 9: now **10**, one note naming all three changes); main.js twice
  (the incentive HUD's `{ pickup, effects }` kept beside the sale teaser and floating SALE tags; the rocket view kept beside Kevin's new
  `throwableView.update(alpha, visualTime)` and his spectacle); tests/saveGame.test.js (both new tests kept).
- **Cross-feature bug:** Black Friday did nothing to a Bottle Rocket burst: gunStats `hitDamage` returned a blast's damage before the
  jackpot step, and playerGun's `explode()` passed no target. Both fixed; a burst now one-shots every shopper caught and does x3 to a boss.
- **Docs:** the union driver kept main's old `ballistics.test.js` line (tests.md) and the old `throwableView.js` entry (folder-structure.md)
  next to the branches' rewrites; the stale copies are gone.
- **Checks:** tests/crossFeature.test.js (jackpots on the claw guns, Commission Day on a blast kill, the three price layers in one order).
  Full suite 1733/1733; balance, build and build:single fine; a browser run (Black Friday rocket, a Doorbuster bought, Kevin, a claw
  Balloon Launcher, Save & Quit and Continue) showed no console errors.

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
## 12 November 2026 - Kiosk Kevin phase 8: the spectacle (Kevin, his lid, his shouts, the products and their effects)

The last phase of docs/archive/kiosk-kevin-plan.md, presentation only: no price, damage, rule or random number changed (the shouts take turns instead of rolling, so seeded tests see the same game).
- **Kevin** (maps/mall/kioskKevin.js) replaces the two placeholder boxes: a low-poly guy in a teal polo with a red lanyard and a KEVIN name badge, a quiff, a headset mic and jointed arms. He turns to look at you, bobs, and waves and talks while his speech bubble is up. When a zombie comes within the duck radius a spring drops him into the cart, arms over his head; every couple of seconds he peeks over the counter. Baked to 8 draws (new world/bakeParts.js: a moving model's plain meshes merged per material kind, colour per vertex, pivots kept).
- **The shutter** is a slatted roll-top lid hinged at the back: shut over the counter while he's away (or before round 2), with a notice that changes each time he leaves (BACK IN 5 MIN, GONE TO GET CHANGE, ON BREAK...), and flipping up and over to hang down the back when he arrives; he springs up as it clears.
- **Products on the counter** (world/kioskProducts.js): each slot shows the product it sells this round (three cola bottles, the cake on a doily, a mini demo Sentry whose spinner turns, a Bubble Wrap roll, the air horn on its can, a glitter card). The thrown items now come from the same module (fx/throwableView.js).
- **Hawking**: within 8 m of his open cart he shouts a line in a speech bubble, at most every 14 s, with a short synthesized "hey!"; he yelps as he ducks and says when he's back ('kioskHawk' from game/features/kiosk.js, DOM-free and tested). The PA's "moved" line now has four versions, by round.
- **Effects** (fx/kioskSpectacle.js, listening on the bus): the Soda Bomb's cola geyser and foam ring, the Glitter Bomb's twinkling cloud (and a pinch on each confused zombie), the Air Horn's rings on the floor and at chest height (a new 'airHornBlast' event from game/equipment.js), Bubble Wrap bits popping in front of you plus the HUD segment bursting (retail.css), the Sentry's muzzle flash per shot, its spring-up, whirring spinner, kick, dying sputter and break-up into pieces. Every burst draws a ring out to its real reach, and a comic word pops over it (FSSSHH!, CONGRATS!, HOOONK!, POP!, BZZT!). New sounds: kevinShout, kevinYelp, sentryBreak (config/audio.js).
- Found while checking it in the browser: a sprite in the map breaks any raycast made without a camera (the bullet-mark raycast in tests/staticBatch.test.js threw). Kevin's bubble and the comic words opt out of raycasts.
Shared files touched: src/main.js (three lines), src/config/audio.js (three sounds), src/game/events.js (two events), src/ui/hud.js and retail.css (the armour pop), CLAUDE.md (status lines). Not regenerated: docs/typefaces-ledger.md (tools/typefaceLedger.mjs), which the sign-looks work owns; the new texts use existing roles (marker, priceTag, toyBody, toyBrand).
Review pass (same day, before merging): Kevin's lanyard was an upside-down V (an "A") with the badge hidden behind the middle product; it is now a V to a badge high on his chest. The headset band sat across his hair like a hat band (his hair read as a cap): it now runs over the top, with sideburns and a nose added. His speech bubble was tone-mapped and fogged (grey, not white) and the cart's light column washed out the middle of each line: it now draws after the column, untoned. The spectacle's last inline numbers (foam life, gravity and drag; debris drag; the Sentry's sputter seconds) moved to config/kiosk.js spectacle. New test: the bake and every product model (tests/kiosk.test.js).
## 12 November 2026 - Claw guns review: rockets through walls, Last Round on the Bazooka, the Stargazer's barrels, save 9

A review of the three claw-only guns before merging (unverified work, checked against the game's rules, `npm run balance` and `npm run sim:claw`).
- **Rockets and balloons went through walls.** They leave 0.6-0.7 m in front of the eye; pressed against a wall that is already past it (the player is 0.35 wide, walls 0.3), so a rocket fired at the Hallway's west wall burst in the Service Corridor, killing and paying into locked areas and dodging its own self-damage. weapons/playerGun.js now casts from the eye to the launch point: a wall or zombie in between bursts it right there (and a rocket into a wall at your face hurts you). The Tennis Ball Launcher (main's code, 0.55 m) has the same latent gap; not changed here.
- **Build-A-Blaster on a blast gun.** The Bazooka's magazine is one round, so the Last Round heart fired on EVERY launch, at a made-up point 6 m in front of the tube (through walls), and the stuffing scaled from 900 a second though the gun's real cycle includes its 2.4 s reload. A blast gun's Last Round now waits for the burst ('gunBlast' carries magazineLeft) and goes off on the zombie it caught or where it burst; gunStats.gunPower counts the reload of a one-round magazine (the Bazooka's proc base 900 -> 375, its single-target fire rate). The Headshot heart still never fires on a blast gun (a blast has no headshots).
- **The Stargazer's barrels were backwards.** Its falloff RISES, so scaling start and end like a fading gun's made the Extended Nozzle ("carries further") a nerf and the Sawn-Off's downside a big buff. weapons/upgrades.js scales a rising falloff by 1 / the factor.
- **Save version 9**: stats gained ownBlastDamage, and a version-8 save restored with the Hi-Vis Vest on left it at 1 (and taking the vest off then made it 100).
- Tests: tests/featChallenges and roleChallenges had been rewritten LF -> CRLF (whole-file churn, one stray CR each): back to LF, so the real change is the new cases. weaponProgression's headshot bound skipped every claw gun: now only blast guns and the Stargazer. The clump test in bottleRocket.test.js failed about one run in five on the branch (the hip spread sent the rocket over the clump, and a bench shielded one zombie from a low burst): moved to an open stretch and fired dead on. "Eleven guns" wording fixed.
Not changed (noted): the Speed Loader's "smaller magazine" on a one-round gun rounds back to 1; a few view-only numbers in playerGun's burst splat.

## 12 November 2026 - More claw-only guns, 3: the Balloon Launcher (homing balloons)

From the user's wish list. **The Balloon Launcher**: a party-store helium blaster. Its job: it hits what you DON'T aim at. A balloon drifts out at 9 m/s, rising a
little (gravity -0.4), and HOMES: every quarter second it picks the nearest live zombie within 16 m, inside 55 degrees of its flight and in sight, and turns
toward its chest at up to 140 degrees a second; it pops on what it touches with a small harmless blast (200 at the centre, half that at 1.3 m). Eight balloons,
0.3 s apart, a 2.6 s reload. On one zombie you aim at it does 340 a second, under the Price Gun's 434; fired 35 degrees wide of a zombie it still finds it.
**The engine piece**: `homing` in weapons/ballistics.js (any projectile can carry it), tested alone first in ballistics.test.js. The gun itself needed no new
system: it is a blast gun (`blast` + `flight`) like the Bottle Rocket Bazooka, so the `rocket` config block became `flight` and fx/rocketView.js draws each flight
by its look.model (a firework or a bobbing balloon on a string). Balance: the first numbers had 170 a pop, which one-shot only a round-1 Shopper; 200 now.
In the pool as a purple capsule, weight 6. `npm run sim:claw` (weights now total 129): it is in 13.4% of pits, won 6-7% of grabs; Return to Sender stays the
rarest (2.3%). With five claw-only guns plus the wonder weapon, 29 of 129 weight (22% of a capsule, was 13%) is now a claw-only gun.
Skins: Birthday Party; Polka Dot (150 Mall Walkers: the fast ones, homing catches them); Helium High (a boss from round 9 that only balloons hurt).
**The blast-proof fix is the Hi-Vis Vest** (the user's choice over a 13th item: the wardrobe is 4 slots x 3 items and the picker walks all 81 outfits).
Safety gear: it gains a third line, "Your own blasts can't hurt you" (factor ownBlastDamage 0.01, statBetter 'lower'). Not 0: the wardrobe takes an item
off by dividing its factors out, and 0 can't be divided out. weapons/blast.js drops a self-hit under blast.self.ignoreBelow (1 health point), so the vest's
0.45 at most is no hit at all (no hurt flash, no regen reset). The vest is now a stronger item (faster reloads, blast-proof, zombie hits hurt more).
The full suite (once, at the end) caught: the 'rockets' reset step must not sit between 'balls' and 'equipment' (equipment.test), a role skin's body must be
clearly more saturated than its mastery body (two mastery bodies muted, the rocket's role skin made red), and no feat glow may peak past 0.45.

## 12 November 2026 - More claw-only guns, 2: the Bottle Rocket Bazooka (the rocket launcher) and the blast

The user's own idea, with their call on self-damage: your own rocket hurts you, and a wardrobe item will cancel it (the next step; until then
`stats.ownBlastDamage` is 1 for everyone). **The Bottle Rocket Bazooka**: a fireworks-stand cardboard tube firing one oversized bottle rocket. Its job: the only
gun that hurts everything around a POINT. The rocket flies on a third ballistics instance (`g.rockets`, zombies 'bounce', one contact of any kind ends it, or the
end of its 1.6 s life in the air) and bursts: 900 at the centre down to 25% at 3.5 m, through gunStats.hitDamage (`hit.blastDistance`), so tiers and stats
apply. One rocket in the tube, a 2.4 s reload, 12 in reserve. Measured (`npm run balance`, new BLAST GUNS tables): the centre kills a Shopper to round 11, 1.5 m
out to round 7; a clump of six 1.5 m round a burst takes 1,527 a second, 1.18x the best wall gun at 15 m even counting its pierce (the Heavy Coil Nailer's two,
1,294); one zombie gets 375, under the Price Gun's 434. **Your own burst**: 45% of your max health at its centre with the same falloff, never more than 75% (it
can't kill you from full), nothing behind a wall; it goes straight to health like a fall, jolts the view, and a death by it reads "Self-administered fireworks
display, indoors, at close range" (config/deathReports.js ownBlast). fireInterval is 1 s, not shorter: Build-A-Blaster's stuffings scale from damage / fireInterval
(tests/workshopBuilds.test.js caught 0.6 s making a burn outpace the gun).
**The engine piece, weapons/blast.js**, alone first (tests/blast.test.js): the falloff, who is caught (live zombies within the radius by their nearest hitbox
point, a wall shields), and the self-damage. playerGun.js fires and explodes; the new 'gunBlast' event carries the hits and selfDamage, and createGame's
listener takes it off your health. The view, fx/rocketView.js, draws each rocket as a firework with a spark trail. Models get `state.loaded` (viewmodel.js) so the
nose shows in the tube's mouth only while loaded. In the GRAB-A-GUN pool as a GOLD capsule, weight 2: `npm run sim:claw` puts it in 4.9% of pits (won 3.6-4.8%);
Return to Sender stays the rarest (2.5%). Skins: Grand Finale; Long Fuse (200 kills from 12 m: its kills land after the shot, like the tennis ball's, so not a
multi-kill-shot challenge); Sparkler (40 kills in one round).
Other tests touched by the two guns: weaponProgression's 1.2-2x headshot bound now covers wall guns only (the sniper's 3x is its job), impactMarks skips blast
guns, the Stargazer's wall mark is a new 'bearing' kind (each signature needs its own draw), upgrades lists the rocket among guns the Extended Nozzle doesn't fit,
aim.test's Laser Pointer check on a scoped gun compares only fully aimed or at the hip, and skinEquipment counts guns instead of assuming eleven.

## 12 November 2026 - More claw-only guns, 1: the Stargazer 3000 (the sniper) and its scope

The user picked three new claw-only guns from a pitch (a sniper and a rocket launcher, their own ideas, and the Balloon Launcher from the wish list); this is the first.
**The Stargazer 3000**: a hobby-shop telescope fitted with a bolt, firing steel ball bearings. Its job: the further away, the harder it hits. Its falloff RISES
(`falloff.minMultiplier` 2: gunStats.damageFalloff already ran the line up when the end is above 1, so no damage maths changed): 300 a hit to 8 m, 600 at 30 m,
3x headshots (the biggest multiplier), a 4-zombie pierce, 5 rounds, a 1.2 s bolt, a 3.0 s reload. Measured (`npm run balance`, new SCOPED GUNS table): one aimed
headshot at 30 m kills a Shopper through round 21 (round 11 across a room); at 30 m with headshots it kills 1.2x (round 18) to 1.4x (round 20) faster than the best
wall gun, level with it by round 25 and behind before round 15; up close it is 192 sustained dps, under half the Price Gun's. The bolt was 1.3 s / 3.2 s reload at first:
that only tied the Foam Dart Blaster at round 16, so it went to 1.2 / 3.0.
**The engine piece, weapons/scope.js**, built and tested alone first (tests/scope.test.js): the eyepiece (a HUD overlay, ui/hud.js setScope, star-chart reticle;
once it covers the view main.js stops drawing the gun model), a figure-eight sway applied as per-tick changes to the view (shots follow it; crouched or prone it is
a third; lowering the scope gives back exactly what it took), and the bolt (aim.js onShot drops ADS to 0.35 after a scoped shot; holding aim brings it back before
the next shot). ADS zoom 0.28. The balance tool gained `aimAt: 'head'`.
Everything one gun touches now includes the weapon skins (the first gun added since they were built): three skins in config/skins.js (Midnight Sky; Constellation,
150 headshot kills from 25 m; Supernova, a perfect round of 15 shots), their cases in roleChallenges/featChallenges, its palette keys, and its default materials
added to tests/fixtures/weapon-materials-phase-1.json (existing entries untouched). In the GRAB-A-GUN pool as a purple capsule, weight 6 (the other claw-only purples are 7):
`npm run sim:claw` at 1,500 a grab puts it in 14.5% of pits and wins it 7-8% of grabs (timed or 3-in-4); Return to Sender stays the rarest prize (2.5% of pits).
Files: config/weapons.js, audio.js (shot with the bolt as delayed layers, three reload sounds), haptics.js, ui.js, attachmentVisuals.js, gunPalettes.js, skins.js,
clawMachine.js; weapons/scope.js, aim.js, playerGun.js, models/stargazer.js + index.js; ui/hud.js, style.css, main.js (two lines); tools/balance.js, gunReport.mjs;
tests scope, stargazer, balance, role/feat challenges, the material fixture.
## 12 November 2026 - Closing Time phase 12, the spectacle: Lorraine and her trolley, the van's lights and engine, Last Call, the receipt's art

The last phase of docs/archive/closing-time-plan.md. Presentation only: no price, health, timing or rule changed, and her hitboxes are the ones phase 8 gave her.
- **Lorraine Pruitt** (config/lastCustomerLook.js, zombies/bosses/lastCustomerModel.js): a lilac twinset with pearl buttons, a brooch and a string of pearls, a calf-length plum skirt, a lilac-grey set perm, cat-eye glasses on a chain (rims around the eyes, so her face still reads), clip-on pearls and lipstick. She pushes her own trolley, upright (the Cart Pusher hunches; she has her dignity): the Cart Pusher's cart model and size (so the charge reach still matches the nose) with a heap of returns: a boxed toaster, a television box tipped over the front, shoe boxes, a standard lamp in the front corner (moved there after the browser check: it covered her face), a coral dress over the rail, her handbag on the handle and a receipt pinned under her hand, down the side and curled on the floor. Speechless: her mouth drops open, a hand goes to her pearls, the other goes up for the manager, chin up, trembling; it eases back out if she recovers. zombies/cartModel.js gained an optional fixed `heap`; a boss with a cart keeps its own look. Her leans are small because her hitboxes do not follow a lean (tests/lastCustomerModel.test.js shoots her drawn face in every charge state).
- **The van** (fx/vanLights.js, config/closingTime.js vanShow): dark until she is returned; then its amber hazards blink with a relay click you hear within 14 m, a beacon across the lot. Start the van: the starter cranks (nine strokes), the headlights stutter, the engine catches and revs, the headlights (the cracked right one keeps flickering), soft beams, a pool of light on the asphalt and the tail lights come on, and the screen fades to black and up on the SHIFT COMPLETE receipt (2.3 s; the run is already frozen at the win, so nothing in the game waits on it). Through overtime it idles, lit. No real light is added (that would rebuild every shader at the win): unlit lenses and additive glows. The first beams were far too bright and were cut to under half.
- **Last Call** (config/closingMusic.js): an original song in D minor at 144 bpm, octave-pumping bass, clav stabs, a marimba arpeggio and a wind lead, the last section up a semitone. Written as data for the radio's engine but never on the radio: it plays straight to you from her arrival until she is returned (the loop cuts under a ringing D major chord) or the run ends; it fades under a menu and starts again on Resume. The radio is turned down to a quarter while it plays. renderTrack learned `chime: false` and `loop: true` (the ringing end folds onto the start, no end fade): a seamless 53 s loop, rendered once a session in the music worker.
- **The receipt's art** (ui/receiptArt.js and .css): the SHIFT COMPLETE receipt now prints a picture under the store name (the van from behind, driving down the road into a striped, dithered sunset between the mall and the parking deck, one ink), a return slip ("1 x CUSTOMER, LAST ... RETURNED. Receipt: extremely long. Refund: declined."), a teal double-ringed stamp instead of the death receipt's red, a sunset backdrop, and, while the choice is open, an OVERTIME COUPON that states overtime's real terms (kills pay 125%, zombies +3% health every round).
Checked in the browser (preview build): her model in Customer Parking, Speechless, the hazards, the drive-off and the receipt. Last Call was not heard in the browser (the pane cannot play sound to the checker); its loop and playback are covered by tests/closingMusic.test.js.

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
## 12 November 2026 - Last-zombie straggler helper

At the tail of a round (no spawns remaining and `aliveCount <= 2`), after an 8-second quiet window since the last kill, remaining non-boss zombies are highlighted through walls (`zombies/zombieRim.js`: per-zombie rim uniform + one shared `GreaterDepth` overlay material readable in bright and dark zones) and pinged live on the minimap (`ui/minimap.js`), with a once-per-run PA line ("Shoppers, we have a straggler in the store."). Bosses count toward the zombie count but are excluded from the helper since they already carry a boss bar. Driven by `game/stragglers.js` via `'stragglers'` / `'stragglersCleared'` on `game/events.js`, with a Comfort setting (`stragglerHelper`, default on), `tests/stragglers.test.js`, and reset/transient registration in `createGame.js`.

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

Older entries: 9 to 11 November 2026 in docs/archive/history-2026-11-mid.md; up to 8 November 2026 (and the undated October work)
in docs/archive/history-2026-11-early.md; before November in docs/archive/history-2026-10.md.
