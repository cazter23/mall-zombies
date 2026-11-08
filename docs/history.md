# Sunset Galleria: build history ("Current state")

## 8 November 2026 � Idle saver (focus mode)

The title screen draws a full post-processed flyover every frame, so a tab left open on the menu kept a CPU core and the GPU busy all day. Now, while the game is
not running (title, pause and results screens), it goes easy when nobody is there: after 30 s with nothing pressed (or the window unfocused) it draws 10 frames a
second, after 2 minutes it stops drawing and suspends the audio, and any key, click, mouse move over the focused window, controller input or the window gaining
focus wakes it at once. Never during a live run, a benchmark, or the first launch's graphics measurement (autoGraphics). Numbers: config/idle.js; settings:
Graphics > Save power when idle, Idle delay (short / normal / long), Audio > Mute when asleep. A hidden tab was already stopped by the browser; this covers the tab
that is visible but not the one in use.
Checked in the browser pane (a hidden pane throttles frames, so only states and frame counters mean anything): dim at 15 s and asleep at 60 s on the short delay,
0 frames drawn in 5 s asleep, awake again on focus with 62 frames in 3 s. Not measured: Firefox / the GPU saving itself (use about:processes). The audio suspend
is only covered by the test double (the pane never got a click to start audio).
Files: core/loop.js (the handle), core/idleGovernor.js (decisions, pure), core/idleSaver.js (listeners, controller poll), audio/sound.js setSleeping, main.js
(builds it; eligible = not running, no benchmark, graphics measured or window hidden), tests/idleSaver.test.js.

## 8 November 2026 — Build-A-Blaster becomes the big power-up

Playtested with a headless horde bot (tools/babReport.mjs, `npm run balance:bab`: Nail Gun and Rivet Rifle, rounds 8-16, 14 shoppers walking at a bot that aims
down sights): a 1,500 build gave +0-30% (Fryer Oil and Glitter did the work; Smoothie, Popcorn Butter, Neon Tube and Every 10th did about nothing), while a
2,000 Deluxe warranty gave +25-38%. Now the BUILD powers the gun up itself, by its quality (config/workshop.js qualities[].gun): damage x1.5 / 1.7 / 1.9 / 2.2
and magazine +20% / +20% / +30% / +30%, and the gun comes back with a full magazine and a full reserve. Extended Warranties are the support upgrade: damage
x1.2 / 1.4 / 1.65 (was 1.4 / 2.1 / 3.5), prices 1,500 / 3,000 / 6,000 (was 2,000 / 4,000 / 8,000); they stack with a build.
Stuffings got jobs: Neon Tube arcs about 3x harder with more jumps (an arc never takes more than 60% of a zombie's health); Antifreeze shatters hit harder and
the shards hit and chill what stands round; Smoothie makes slowed zombies take +25% from everything; Popcorn Butter makes zombies slip and fall (steering lost,
flat on their back, headshots on a fallen one x2, 2.5 s before they can slip again); Reload is the panic button (strength x2.5, only with a zombie within 6 m);
Every 10th is now Every 5th at x2.5 (the id stays everyTenth). Every effect is now visible (config/workshop.js stuffingLook, zombies/statusTint.js): burning zombies
flicker orange with flames, chilled ones glow icy blue and burst into ice, Smoothie goo is pink and drips, Glitter cycles through the rainbow with hearts floating up,
butter bubbles, a neon arc is fatter (5 cm, 0.25 s, flickering) with a flash at each zombie, and every proc leaves a small ball of light.
Measured after (bot, round 12, builds at 1,500 vs a plain gun): +40% to +95% faster and far less damage taken; Platinum (10,500 in total) +39-55%. Antifreeze first came
out near +95%, an outlier next to Popcorn Butter (+40%), so its shatter was trimmed (0.5 -> 0.32 gun-seconds, splash 0.2 -> 0.12); that trim was not re-measured.
Tests that pinned old numbers now read config instead (tiers, Every Nth) or state the new envelope (neon best case under 2.5 gun-fires per second, antifreeze under
one gun-second per zombie); tests/workshopPower.test.js covers the new rules. Not done: re-stuff levels (a second build level that grows a stuffing), and a bot
that moves (slows and butter are undervalued by a bot that stands still).

## 8 November 2026 — Review fixes: vouchers, boss rewards, boss removal

A review of the week's boss / Build-A-Blaster / voucher work found five bugs, fixed here (tests/reviewFixes.test.js):
- A free attachment refit used up the Discount Code. `pricing.spendVoucher(kind, id, paid)` now takes what was paid: a payment of 0 spares a part-price voucher
  (a full-discount one, Master Key / Signed Approval, is what makes things free, so it is still used).
- A second boss voucher on the floor while you held one expired with nothing. It now pays its `pointsInstead` when it runs out ('powerUpExpire' carries `pointsInstead`).
- Signed Approval turned into points while the gun it would upgrade was at Build-A-Blaster; the eligibility check now counts `gun.away`.
- A boss landing the killing blow removed itself from the zombie list mid-update, so the next zombie skipped a tick and the boss's model was disposed under its own
  update. `clearBosses()` now only marks it removed (and takes it out of the shootables) while `update()` is running; the end-of-update sweep removes it.
- Hardcoded numbers moved to config: the Party Trap puck (`workshopBuilds.partyTrap.marker`) and the vault preview's `approachFraction` / `ledge.minClosing`.
Not changed, on purpose: a sprint-jump off the top of the Atrium escalator or the cinema stairs costs about a third of your health. That is a real 5.7 m airborne fall
(the jump carries you over most of the flight), so the fall rule is doing what feel.fall says; making it free would be a design change.

## 8 November 2026 — Box cutter helmet pops pay

Knocking a Mascot's helmet off with the box cutter never paid the 100-point helmet-pop bonus: the listener wanted a headshot, and melee always reports a body hit (it ignores
headshots, COD-style). The test passed because it faked a melee head hit. Now a box-cutter pop always pays (getting that close is the risk); a gun still needs the headshot.
tests/mascot.test.js swings the real knife.

## 8 November 2026 — Skylar's influencer makeover

Skylar now wears a cropped pink jacket, cream top, high-waisted dark trousers, chunky trainers and a crossbody bag.
Platinum hair with pink tips, a high ponytail, perched sunglasses, gold hoops, a heart necklace and smeared makeup
give her a distinct silhouette. Her compact phone/ring-light rig stays beside her face. She poses with a hand on her
hip, glances toward the phone, and adjusts it during the existing flash wind-up. Clothing is batched onto the normal
skeleton and all added geometry follows the model's disposal path.

## 8 November 2026 — Fall damage, and climbing over balcony rails

**Fall damage** (feel.fall): free up to 3 m, then 12 per metre (the 6.3 m drop from an upper floor costs about 40; health regenerates). controller.trackFall measures one unbroken
stretch in the air from its highest point, so stairs, benches and jumps are free; god mode and `stats.fallDamageScale` scale it; the event is 'playerFall'.

**Balcony rails** (props.railing marks them `ledge`; player/vault.js; feel.vault.ledge): jump at one, or push into it from a standstill, and you climb straight over along the
rail's normal (up to 70 degrees off), then drop with no steering (controller.dropVelocity). vault.chooseDrop picks how far out to land (0 to 3 m, nearest 1.5 m first): the first spot you
can stand on (floor, bench, counter or an escalator's walkway) whose whole fall line is clear, checked 10 cm wider than the body. The fall counts from the balcony floor, not the climb.
Cached per release point. About 75% of the railing offers it (the whole Atrium court edge, both Promenade voids); the escalator's top opening and the last half metre at corners refuse.

How it got there (four fixes in one day, each found by playing): the landing check first scaled with run speed, then checked only a straight line from an angled run,
then refused whenever the one landing point was blocked (only 47% of the railing worked), and it missed escalator ramps and other rails. The lesson: measure a feature
everywhere along its length and from every angle, not at the middle head-on; tests/fallAndLedge.test.js now does (every rail, angles, standstill, every offered drop lands standable).

## 8 November 2026 — Department boss bars

The three new bosses had individual notices but shared the purple health-bar frame. Officer Kettle now has a navy
and brass security badge with incident tape and a blue gauge. Dennis Fairweather has a cream clipboard, metal clip,
stamped title and burgundy gauge. Skylar Sparkle has a pink-and-cyan livestream frame with a LIVE follower count.
The HUD switches its department styling with the active boss and clears it on encounter cleanup.

## 7 November 2026 — Mascot costumes (branch codex/mascot-variants)

The Mascot keeps exactly its slot: share, cap of two and the round-10 intro, all still from economy.zombieMix.mascot. Each Mascot now wears one
of the costumes unlocked so far (config/zombies.js mascotVariants). The zombie manager picks the costume after the spawn point, weighted 3x in a
costume's home zones. Every costume resolves once into its own type (id 'mascot', plus variant and name), so the existing type.mascot reads and
tests needed no change, and zombieTypes.mascot is Sir Waffles. Each costume changes one beat:
- **Captain Coupon** (13, Mega Mart): after the shake he goes back for his helmet and puts it on, once, back to 3/4 health. The second pop pays no bonus. He gives up
  when it is gone, when you stand guard by it, or after 6 s. Fallen helmets now know their owner, and the cap never evicts the one he still wants.
- **Poppy Corn** (16, Cinema): the pop is a blast. Zombies within 4 m get the Security Sweep's stagger (no damage, no pay), and a player within 3 m is shoved and buttered (HUD splat).
- **Scoops** (19, Atrium, Food Court): melt puddles every 0.5 s (0.25 bare-headed) slow the player to 0.6. They come from one pool of 14 discs and clear at round end, death and Play again.
- **Employee of the Month** (15+, 8%): the gold version of any costume. It has 1.5x health and a PA line, and it always drops a power-up through the boss-reward queue, outside the meter.

Decisions. A costume's debut round forces its first Mascot. That forced spawn still rolls its dice, so a seeded wave is identical with or without costumes outside
debut rounds (tested). With only one costume unlocked nothing extra is rolled, so rounds 10-12 play exactly as before. stats.surfaceSpeed now has one writer, game/surfaceSlows.js:
each source keeps its own slot and the lowest wins. The spec said "reset to 1 each tick", but sources report after the player moves, so a per-tick reset would
have hidden every slow. After merging the boss work from main, the director reports the active boss's behavior.surfaceSpeed (the Janitor's wet floor, the Guard's
taser) as 'boss' and the melt reports 'melt'. Fan actors (noRewards) get no helmet bonus or guaranteed drop either. Bosses no longer take a costume's debut round
(main's bossIntroRounds already counted costumes). The in-game look check found faces lost against the popcorn stripes and the cream price
tag (now dark-rimmed eyes), and drips that read as ears. Per-costume posters were skipped; the PA lines carry the flavour. Note for debugging: a Mascot with speed 0 poses as NaN
(the stride divides by speed). Nothing in the game does that; hold one in place with a long stagger instead. Merged into main on 8 November.

## Bosses phase 6: spectacle and verification

Finished employee costumes and filming/meeting poses, aligned enlarged head hitboxes, added a distinct sting and corporate defeat line per boss, and use a colored confetti death burst with no boss gore. Shift+J selects a boss, J summons it; explicit debug ids remain supported. Added boss health/reward/theoretical Nail Gun time rows to npm run balance. Health and damage stay at the requested starting values pending player feedback. Headless browser inspection prompted a raised ring-light pose and a rotated whiteboard beside Dennis so it cannot hide his head from the front. Vouchers now clear on death, and order-form purchases consume them through g.events. Shared-file and validation details: docs/archive/bosses-2-report.md.

## Bosses phase 5: approved encores

At round 20 and every four rounds thereafter, one actually encountered boss returns. Type and Mascot variant debut rounds are skipped; alternate known bosses are preferred, with repeats allowed if only one has been met. Play again clears encounter knowledge.

## Bosses phase 4: Skylar Sparkle

Added independent grid-cell filming routes, a follower meter, capped half-health fan reinforcements, telegraphed phone flashes and Discount Code vouchers. Fans carry noRewards across points, stats, incentives, Limited Editions and workshop credit; after Skylar dies they leave without kill events. Comfort offers dimming instead of white flashes, included in Calm. Small rooms use the best reachable shootable cell if the preferred 10–16 m band is impossible. Follower starting tuning: 5/s, hit -7, headshot -18; each threshold triggers once per viral cycle, queued fans cap at 17. Direct order-form purchases consume vouchers through the purchase event.

## Bosses phase 3: Officer Doug Kettle

Added a telegraphed taser lunge, miss vulnerability, short player slowdown, radio lockdowns and quota-funded Mall Walker backup. The map interface finds surrounding shutters without touching area ownership; occupied shutters wait, and cleanup runs before map reset. Three headshots during a call permanently break the radio for that encounter. Master Key vouchers redeem through normal door pricing or convert to 1250 points. Also separated Manager report/meeting buff timers so a report cannot shorten meeting damage buffs.

## Bosses phase 2: Dennis Fairweather

Added Direct Report, interruptible Staff Meetings, visible whiteboard and Signed Approval pickups. The voucher grants one carried-gun tier through Premium; if all carried guns have reached that limit, it converts to 1500 points. The separate voucher slot survives sales and Employee Discount. Merged the concurrent order-form work and preserved its quiet interactions/menu handling. Phase 1 passed 780 tests and the production build.

## Bosses phase 1: shared groundwork

Bosses phase 1: isolated codex/bosses-2 worktree. Added behavior movement control, independent timed buffs and meeting holds, separate voucher pricing/HUD, and debug summon by id. Murray keeps his existing wet-floor behavior.

## 7 November 2026 — Murray's maintenance sign

The Janitor's boss bar is a worn yellow caution placard with black striped edges, a warning triangle and
Cleaning in progress above his name. A turquoise water gauge drains with his health. The notice lives with his
boss config; the HUD applies the treatment for his encounter and clears it when the bar is hidden.

## 7 November 2026 — Debug overlay cleanup

The debug overlay now groups shortcuts in columns and gives the selected enemy, next gun, god mode and active boss
their own status fields. Shorter labels distinguish clearing enemies from killing them for points and explain the
Janitor's once-per-round limit. Responsive layouts fit narrow screens and short landscape windows.
The panel still opens with backtick, and its visibility is exposed to assistive technology.

## 8 November 2026 — Build-A-Blaster's order form, readable mid-fight

Played by hand, the order form was hard to read: a fixed 560 px sheet with 10-13 px text, faded descriptions, key hints as 11 px text, and an Order "button"
that was only a price. Now the form (and the progress ticket and Birth Certificate) take their size from the screen height: about 16 px base at 1080p,
names ~19 px, keycaps 17 px, the Order button's key 22 px and its price 28 px, up to double that at 4K. The column you are moving in has a solid highlight
(the other column's pick is only outlined), stuffings not in stock fold into a short list under the stuffings, a "Your blaster" line says what the order does,
and the price always shows, with "Need N more points" under it when you're short. The form sits left of centre (never under the round counter), so you can
see down the middle while it's open. Below about 650 px of window height it reaches the health bar.

## 7 November 2026 — Build-A-Blaster's detail pass

The workshop read as a blockout, so maps/mall/workshopDetails.js dresses it (numbers in config/promenade.js workshop.details). Storefront: a slatwall of limp, unstuffed gun
skins, the heart-ceremony shelf, a till, footprints to the bench, window decals and balloons, plush mascots, ceiling grid, sprinklers and exit signs. Hall: six stuffing
hoppers piped into the tank, a QC desk, belt rollers, a typewriter and name-tag board at the booth, family portraits, a safety board, lockers and a time clock, an
extinguisher, a wainscot, beams, floor safety lines and hazard stripes, bales, a laundry cart, a returns bin, a plush pile, stray tufts and a neon thank-you.
The two side signs in the storefront now read CHOOSE YOUR BLASTER and THE HEART CEREMONY.
Measured in the built game (calls / triangles): hall 189-253 / 33-37k, storefront 244 / 38k, Promenade at the window 305 / 49k, north lane looking out 942 / 125k;
hallway 1086 / 175k and Level 2 1432 / 268k for comparison. Found on the way: lookKit.bands always built at floor 0 (fixed with a floorY option), so a wainscot meant
for the hall was first built inside HOFFMAN'S; the returns bin first sat on a chute landing spot.

## 7 November 2026 — Build-A-Blaster's order form

Playing it by hand, the ritual took too many stops in the middle of a fight: bins, Heart wall, bench, lever, booth. Now: hold F at the bench and an order form
opens with every Stuffing and Heart on one sheet, already filled in (your last order, else today's first stuffing and its usual Heart, config defaultHeart), so F again
orders. W/S, the wheel, the stick or the D-pad choose; A/D switch column; F / controller A order; Q / B cancel. The world keeps going while it's open: the player
stands still and can't shoot or buy (createGame's new state.menu gate), zombies keep swinging. Kills in the room now also take 1 s each off a 30 s clock (was 45 s,
with a lever), and the gun comes back to your hands by itself once the gantry reaches the booth, wherever you are. It only waits at the booth when taking it would
replace a gun you bought meanwhile, and the PA says so. The bins, Heart wall and lever stay as scenery.

Found while testing: the gun used to ride the whole path (belt and gantry) during the run, which was invisible with a lever but meant a finished order arrived
instantly. It now rides only the belt while running, then always takes catchUpSeconds to reach the booth.

## 6 November 2026 — One-click play, and the single file finally boots

`npm run play` / play.cmd (tools/play.mjs) opens the single-file build in Firefox with no server, rebuilding only when the source is newer and falling back to the last good build. The
user kept hitting "Unable to connect" on localhost:5173: that only means no dev server was running (the app itself stopped one), never the network.

The single file had not been opening at all: tools/buildSingle.mjs pasted the bundle in with a replacement STRING, so every `$&` in three.js became a stray `</body>` inside the code
(SyntaxError in Firefox). singleFile.test.js only checked the file's shape; it now parses the inline script. This was also the first real run through file://: headless Firefox boots it in
about 7.5 s with no console errors, and localStorage survives a browser restart and a rebuild. Saves are separate from localhost:5173 (a different origin).

Measured, because the first reading misled: a cold dev load took 74 s of files in a hidden pane with very little free RAM, yet about 1 s of files and 7 s to game ready in headless Firefox with 4 GB free,
with or without vite.config.js (6.9 and 7.1 s without it; 7.2, 7.0 and 6.8 s with it). So the config's warmup and watcher rules are tidying, not a measured speed-up, and memory pressure is the likely
cause of the long waits. The 7 s that remains is the game's own startup, in every mode.

## 6 November 2026 — Build-A-Blaster and Mascot polish

Overstuffed now earns its extra kills: 2.1 power against Extra Stuffed's 1.7, and a Heart cooldown at half. Named guns keep a confirmed-kill record (their own kills and their stuffing's,
through a re-stuff), and all 24 Stuffing and Heart pairs have a model name, both on the receipt ("Mildred (Last Sip), 2 confirmed"); the name is on the Birth Certificate too. The Courtesy
Loaner wears a security tag (weapons/models/loanerTag.js) and gets a line on the certificate, kinder if you bring it back. A dropped Limited Edition has a HUD arrow with distance, floor and time
(ui/bagMarker.js). Sir Waffles now stands and shakes for 0.6 s before he rushes, which also cancels a swing in progress. A gun or box cutter headshot that knocks the helmet off pays 100.
The helmet stays on the floor until the round ends, sits up and turns to face the player. At most 3 stay, because each is a couple of dozen draw calls. The zombie manager owns them, so they outlive the body.

## 6 November 2026 — Boss framework and the Janitor

Mopwater Murray joins once per run in round 5 or 7, with six times a Shopper's health and a 300-point base payout.
The director spawns him partway through the wave in addition to its usual quota, retries a blocked spawn and waits
for him before advancing. He uses regular mall markers even during the Build-A-Blaster ritual. His health bar and
PA sting announce the encounter, and the end-of-run receipt counts bosses defeated.

Murray swings a 60-damage mop and leaves up to six puddles on clear floor. They slow grounded players by 30% for as
long as they stand in them and expire after 12 seconds. He mops up Spill Cleanup and drops a guaranteed Spill
Cleanup incentive on defeat. Bosses ignore stagger, hitstop, Glitter and incentive marks. Antifreeze refreshes their
resisted slow without shattering them. Cross-floor chases now keep following the route even directly below the player.

## 6 November 2026 — Build-A-Blaster and the Mascot merged

The rebuilt workshop, Sir Waffles and the Wardrobe and claw machine plans reached main together. Testing the two features side by side found three edge cases: a chute zombie
sent back by the failsafe kept its drop, a burn outliving the player still filled the gauge, and the Mascot's model ignored the chute. All three have tests. Prices are still
placeholders because the economy report has not been written.

## November 2026 — Build-A-Blaster rebuild (branch build-a-blaster)

Plan: docs/archive/build-a-blaster-plan.md. Running log with every decision: docs/archive/build-a-blaster-log.md.

Phase 1, the room: the workshop grew a 14.4 x 14.5 m back hall behind the storefront (config/promenade.js workshop.hall, section 'workshopHall').
The tank, conveyor, booth, lever and chute are plain blocks for now. The bench moved from the old back wall to the middle of the storefront and still
sells Party Trap and Clearance Rack. The island's guard is ONE ignoreShots collider, not four rails: rails inside the balcony's x range count as balcony
rails in levelTwo.test.js, and one block also seals the inside. Measured in the built game (draw calls / triangles): hall 144-189 / 17-19k, storefront 168 / 18k,
Promenade at the window 210 / 28k, north lane looking out through the mouth 876 / 106k; for comparison hallway 1082 / 171k, Level 2 1397 / 260k, HOFFMAN'S 515 / 80k.

Phase 2, the ritual: game/features/workshopRitual.js (idle, running, ready), built by workshop.js so FEATURE_KINDS and createGame's systems don't change. playerGun gained handOver/collect:
the slot itself leaves the loadout, so ammo and upgrades wait with it. zombieManager.steerSpawns(points) changes where spawns land and nothing else; rounds still decides how many. Free actions (lever,
booth) use kind 'ritual', because main.js looks up a shelf price for any kind in PRICE_CATEGORIES and 'workshop' has none for them. The bench took over feature.position, so the Limited Editions moved to a
shelf behind the window (feature.limitedEdition). Spawn steering only applies while the player is in the room, so a ritual can't be used to send a round's zombies far from you.

Phase 3, Stuffings and Hearts: picks happen at physical bins and a Heart wall in the storefront, not in a menu. game/features/workshopStuffings.js is one function per Stuffing and per Heart, so any pair works.
Stuffings scale from gunPower (weapons/gunStats.js: one second of the gun's fire), not from one shot: shots range from 30 to 840 damage, so a per-shot scale made the Cannon's procs 28 times the Staple Gun's. cycleSeconds moved
from tools/balance.js into gunStats.js so the game and the report share it. Zombies gained a burn status (zombie.applyBurn) paid through takeHit with source 'build'. Interactions gained `blocked`: a prompt that shows why it can't be bought yet.

Phase 4, name and certificate: a gun is named at collection and keeps the name through a re-stuff. The certificate is a notice that clears itself, not a modal, because you collect mid-fight. run summaries gained survivedBy. receiptLinesFor moved out of createScreens so it could be tested, and that test caught `clock` being local to createScreens, which would have crashed the death screen.

Phase 5, spectacle: real tank (quality marks, fill in the stuffing's colour, turning fluff, mascot), running belt, gantry arm, chute flap and slide, lever, booth. Ritual mode recolours the hall's two existing lamps and steps a string of 64
unlit instanced bulbs, so it adds no lights. Runtime-shown parts sit under a dynamic GROUP, not a dynamic mesh: tests/staticBatch.test.js treats every directly flagged mesh as an escalator part. Measured (calls / triangles, plain gun): hall 164-217 / 20-23k, storefront 190 / 21k,
north lane 914 / 109k, Promenade at the window 241 / 31k, hallway 1086 / 171k, Level 2 1411 / 260k. During a ritual the hall peaks at 244. A built gun adds about 10 calls wherever it is carried; the first version used a mesh per stitch and added about 50, so stitches are instanced now.
buildVisual places from mounts, never from bounds: model.root holds the hands and arms, and bounds put the patch off in space (caught on screen, not by a test; there is a test now).

Phase 6, first part: Popcorn Butter (a fixed pool of three puddles, Spill Cleanup's slow per tick), Antifreeze (chills, then shatters anything slowed, by any source), the Reload Heart (a new 'reload' event) and Every 10th. Hearts now name the events they want and cooldowns are per gun, so one gun can't swallow another's tenth kill.

Phase 6, Limited Edition drops: Party Trap and Clearance Rack left the shelf, as the plan set out. A zombie carrying a shopping bag (model.hasBag) sometimes drops one for a gun you carry that doesn't have it; walking over the bag fits it free. Their prices stay in economy.upgrades.workshop for the economy simulation, unused for now.

Phase 6, Glitter: zombies/confusion.js. A confused zombie runs that module instead of its normal update, using the existing windup and swing states so the model animates by itself. It walks straight at its target rather than using the flow field, which only ever routes to the player: short range makes this fine, and a wall simply stops it. Immunity afterwards stops a fast gun locking a crowd for good.

## 4 November 2026 — Sir Waffles, the Mascot

The Food Court's foam breakfast knight completes the regular zombie roster. Sir Waffles joins waves at round 10
with 5x Shopper health and a two-alive cap. The costume shambles at 1.35 m/s and absorbs most hit knockback. At
half health the helmet pops off in a burst of cream-colored stuffing, exposing the smaller head as the zombie rushes
at 5.6 m/s. Shots use boxes derived from the posed model. The walking collider stays at the Cart Pusher's radius.
A kill pays 300 base points through the regular kill event. Hits and kills shed foam even with Red splatter selected.

## 4 November 2026 — tenant branding and font loading

Mega Mart and Hoffman's got their own tenant branding (config/look.js, zoneLooks.js, hallwayLook.js, textures.js).
Canvas signs were being drawn before the web fonts arrived, so a sign could keep its fallback font for good. src/boot.js now
waits for them (config/fonts.js, at most 2.5 s, then starts anyway), then imports main.js. Mystery Shopper's ammo reward no
longer cuts a reserve that is already above the gun's normal amount. tests/fontsReady.test.js guards the wait.

## 3 November 2026 — first-person employee model

player/body.js now models the Galleria uniform's upper body and a refined sprint: sleeves that would double up with the held
arms are hidden in first person, and sprint foot plants stay under the player. weapons/models/arms.js matches the uniform.
Checks live in tests/prone.test.js.

## Build-A-Blaster workshop prototype

The Promenade workbench installs Party Trap on the Confetti Cannon and Clearance Rack on the Price Gun. Aimed floor shots plant a charge. Fatal traps yank zombies off their feet and pop them into streamers. Clearance Rack body shots tag up to three zombies, and a headshot on a tagged target pops the whole rack.

> Moved out of CLAUDE.md (verbatim) so the file every session loads stays small. Roughly newest first: what each pass changed, how it was verified, measured numbers and decisions. Read it when you need the background of an area or a past decision; it is not needed to work on the code.


> Older entries (October 2026 and before): docs/archive/history-2026-10.md
