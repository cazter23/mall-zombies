# Sunset Galleria: build history, early November 2026

Archived from docs/history.md (newest first). Newer entries are in docs/history.md; before November: history-2026-10.md.

## 8 November 2026 - GRAB-A-GUN, phase 7: Sunny runs away

Land a grab on the plush and, after the refund and the close, Sunny climbs out of the chute, looks round, and waddles (2 m/s) to wherever the machine will
reopen, along the zombies' grid (g.zombies.nav.pathTo: only through open areas, escalators and stairs included), then climbs into that cabinet and it
shakes. Follow him to learn where it's going before the PA says. If no other site is open he walks a lap round his own machine and climbs back in; if the
round starts first, the machine opens there anyway and he finishes his walk. Shoot or slash him and he pops in stuffing and confetti: 25 tickets, and the
machine re-picks its next site (not the one he was heading for). He is a shootable but not a zombie: no kill, no +10, no power-up or Heart credit; aim
assist and the vault skip him (assistable / blocksVault, flags ignoreAimAssist / ignoreVault); his splat is stuffing even in Red splatter mode. One small
low-poly model (world/sunnyModel.js), no collider. Checked in the browser pane (renders saved from the page): the Prize Counter with its teen, Sunny climbing out,
looking round and walking to the Parking site; no console errors.

## 8 November 2026 - GRAB-A-GUN, phase 6: prize tickets and the Prize Counter

Every grab now prints arcade tickets (game/tickets.js, g.tickets): 40 for a Green prize, 25 Blue, 15 Purple, 5 Gold, 10 for Sunny (the points still come back
too), nothing for a prize left in the chute. Tickets are their own currency: not the wallet, not g.pricing, not income, lost on death, gone on Play again. The
HUD shows them under the points once you have some, and the receipt gets "Prize tickets won" and "Sunny keychains" lines. The Prize Counter ("REDEMPTION",
feature kind 'prizeCounter') stood on the Hallway's north wall at x 3.65, between the start shutter and Customer Service (now x -13: see the 9 November merge entry): an ammo refill (60), a Slow Claw
(100: the next sweep runs slowly), an attachment voucher (150: an empty slot of the gun in hand), a free grab token (200) and a Sunny keychain (300). Each
prize is its own hold-to-buy spot along the counter, refused when you're short. Behind the glass, a bored teenage animatronic who has not moved since the mall
opened. The site was picked with the cabinets' checks (one 2.3 m collider, clear spots, no spawn within 10 m, routes unchanged, coplanar); x 10.6 would have
covered the sealed elevator doors.

## 8 November 2026 - GRAB-A-GUN, phase 5: the show

The finished cabinet (maps/mall/clawCabinet.js): a marquee board with painted bulbs (they never blink), "EVERYONE'S A WINNER*" under it, Sunny standing on top
and on both sides (one button eye, one stare), a printed "WIN! WIN! WIN! (results may vary)" backdrop, a lit strip, chrome, a DROP button, a coin door, small
print on the kick plate, a chute with a hinged flap. The claw's prongs open on the way down and shut on the capsule, which swings on the way up (it nearly
slips; it never does, and the prize is still settled at the press), and the flap swings as the prize lands. The dust sheet keeps the machine's stepped shape,
with soft folds and a taped "BACK SOON - Mgmt." note; the claw hides under it. Sounds (config/audio.js claw*): a jingle on paying, a tick each time the claw
crosses into a lane (something to time against), the motor down and up, the grab, a fanfare, Sunny's slide whistle; they fade with distance. The live
machine hums (an ambience emitter that follows it, silent while closed). PA lines are now lists, one picked at random; the screen cycles attract lines.
Cost, measured in the browser pane with the benchmark's own draw path (the pane was hidden, so the camera was posed by hand along map.benchmarkShots and at
each cabinet): the whole route 5,081 -> 5,106 draw calls (+25 summed over 14 shots) and 953,977 -> 954,211 triangles; looking at a live cabinet +6 or +7
calls and about +150 triangles, at a dust-sheeted one +1 or +2 calls (the claw and capsules are no longer drawn under the sheet). Frame times not measured
(a hidden pane draws no frames). All six sites checked in renders, no console errors.

## 8 November 2026 - GRAB-A-GUN, phase 4: sales and odds

The 'claw' Flash Sale group (economy.flashSales.groups; no eligibility rule, as the plan says); the Discount Code still never applies to a grab and
isn't spent by one (tested with a sale running). `npm run sim:claw` (tools/clawSim.mjs + tools/clawOdds.js) reproduces the plan's odds from config and
the game's own roll, adding a "timed" model (0.12 s press error against the real lane windows). The wall stays the cheaper way to every specific
gun, but the first grab after the start shutter is worth 1.46x its price (84% Blue or better): a must-buy at 1,000. Recommended 1,250 (not applied:
no rule strictly broken); the tables are in docs/archive/claw-machine-plan.md.

## 8 November 2026 - GRAB-A-GUN, phases 1 to 3: the claw machine, its six sites, Sunny and Refurbished prizes

The mystery box you work (docs/archive/claw-machine-plan.md). One cabinet on the Hallway's south wall at x 8. Hold F to pay 1,000 (g.pricing 'claw' 'grab'): three
coloured capsules fall into the pit and the screen names them. The claw sweeps the lanes; PRESS F once to drop it, and the capsule under it is your gun.
It lifts to the chute, where the gun waits 15 s (hold F to take it). It drops by itself after 6 s, so walking away never hangs it.
Prizes: the seven wall guns by weight, never the Staple Gun, never a gun you carry or have at Build-A-Blaster (Refurbished prizes come in phase 3).
Engine pieces: interactions.js `instant` items (fire on a fresh press, set the controller-X "used" flag so a drop isn't a reload) and `use(purchase)`
(the actual charge, for a refund); wallet.refund (lowers totalSpent, not income); the 'claw' pricing category (the Discount Code already excludes it).
Phase 2, the same day: all six cabinets (Hallway, Food Court, Mega Mart, Atrium, Cinema lobby, Parking), dust-sheeted "BACK SOON" unless live; no collider
ever moves. Six grabs of stock a site; from the third a plush (Sunny) may take a lane (20/40/60/80%). Landing on him refunds what that grab actually charged
(a sale or the Employee Discount included) and closes the machine, picking the next site right then (phase 7's Sunny walks there). Selling out closes it
once the last prize is gone. It reopens at the next round at another site in an open zone, with a PA line, or restocks in place if none. HUD: a small pink
tag under the Flash Sale tag says where it is. Debug: E = Sunny in the next grab, Shift+E = move it now. Two site changes from the plan: Parking's back is
x 34.43 (the facade's face, not 34.5), and the Cinema's is x -34.1 (the cabinet clipped the screen door's jamb at -34).
Checked in the browser pane (preview build): the Hallway cabinet, a grab (capsules, claw, the prize in the chute) and a dust-sheeted Food Court cabinet; no
console errors. Not checked in the browser: the other four sites up close, the HUD tag.
Phase 3, Refurbished prizes: a gun you carry stays in the odds, named with a free attachment for one of its empty slots ("Nail Gun + Grip Tape"). Taking
it refills that gun and fits the attachment, in hand or not, and the attachment is owned for the run (attachmentCounter.js unlockAttachment). A carried gun
with no empty slot that fits, and a gun at Build-A-Blaster, aren't offered. The take checks again (takeOutcome): bought off the wall meanwhile = refill plus
its spare attachment (rolled with it, so nothing random happens after the press) if that slot is free; a Refurbished gun no longer carried, or handed to
Build-A-Blaster, comes as a plain copy (collection then replaces the copy). It never replaces a fitted attachment and waits while the gun in hand reloads.


## 9 November 2026 - Upgrade colours: warranties are metal, builds are candy

The old palette clashed: Premium purple was nearly Glitter, Platinum gold nearly Popcorn Butter (6 apart in Lab delta-E), Deluxe blue near Neon Tube, and the Standard
green near Antifreeze. Now each system has its own colour language (config/gunStyle.js): the Extended Warranty is METAL (Deluxe steel, Premium gold, Platinum pearl that
slowly shimmers between pearl tints; Renewal studs copper; the collar and tag are metallic with a sheen, and the HUD name, the seal and the Customer Service post-its follow
the tier colours); the Build-A-Blaster is CANDY (the stuffing colour, with Fryer Oil moved to a red-orange and Popcorn Butter to cream); the quality sets how vivid and lit
the pillow is (Understuffed washed out, Overstuffed saturated, glowing, with a hot white seam); and the Heart shows as a badge on the patch, a coloured plate with a cream
shape (Headshot crosshair/crimson, Last Round bullet/blue, Reload ring/green, Every 5th star/amber), also on the order form and as a dot on the HUD chip.
tests/upgradeColors.test.js keeps every warranty colour at least 30 delta-E from every stuffing (closest now 36), the stuffings 35 apart and the Heart badges 40 apart.
Not done: the Attachments keep their store colours (they were already distinct), and the muzzle flash only takes the stuffing colour (no gold glint for a warranty).

## 9 November 2026 - Gun upgrades you can see, and the Extended Warranty rework

Looked at from behind the gun, a Warranty seal and a Build-A-Blaster patch were tiny stickers on the face you rarely see, and the build's patch covered the warranty seal
(both sat on the same mount). Now each system has its own zone on the gun, all readable at once (config/gunStyle.js): the WARRANTY is the barrel collar (one blue ring, two
purple, then a wide gold block with two dark stripes and a gem, a gold stud on top per Renewal) plus a tag swinging off the grip; the BUILD puffs the body (a stuffed pillow each
side, bigger with the quality, the patch riding on it, a glowing seam on top, and the muzzle flash in the stuffing's colour); ATTACHMENTS are drawn 1.2x chunkier.
The HUD shows the same under the gun's name: Renewal stars, a swatch with the build's quality and stuffing, and a pip per attachment slot.
tools/gunSheet.html (npm run dev, then /tools/gunSheet.html?gun=nailGun&view=left) shows one gun in eight states side by side.
Warranties reworked (game/warranty.js): Deluxe is handling (x1.1 damage, +25% magazine, -15% reload, 1,000), Premium is damage (x1.45, 3,000), Platinum is the most damage
(x1.65) and a CLAIM: a completely dry gun gets its ammo replaced once per round (6,000). Past Platinum the desk sells Warranty Renewals (5, each x1.06 damage and x1.03
magazine, 3,000 up to 10,000). A replaced gun leaves its warranty on file; the desk moves it onto the gun in hand for a quarter of that tier's price. Not done: a visible
cue on the gun for the build's quality beyond the pillow size, and the other seven guns' collars were only checked on a contact sheet, not in hand.

## 8 November 2026 - Visual review pass: metal, rails, late rounds, bare walls

A visual review of every area (screenshots at eye height, High graphics) found a few cheap, mall-wide problems, fixed here:
- Metal rendered nearly black: the scene has no environment map, so steel, chrome and brass had nothing to reflect (the hallway
  escalator read as a charcoal column). fx/metalSheen.js bakes a 64 x 32 gradient once (config/look.js metalSheen) and gives it to
  metal materials only (296 meshes), after static batching. Lighting the whole scene with it washed every wall out instead.
- Balcony handrails used the escalator's black rubber colour and drew a black bar across the view over every balcony; they are
  brass now (palette balustradeRail; escalator handrails stay black). The hallway escalator is clad in the wainscot lavender with a
  RIDE AT YOUR OWN RISK panel on each side.
- The horror layer barely showed at round 21 (only real lamps and flickering letters changed; painted light hid it). Now every
  neon tube browns out too (neon.setBrownout, look.horror.neonBrownout) and the view drifts to a lateHours grade (look.horror.decay),
  MULTIPLIED onto each area's grade so dark back-of-house rooms only get darker.
- Sightlines: the Food Court tree hid FRESH MEAT DAILY and WOK THIS WAY (now a low hedge); the Atrium court trees hid the kiosks
  (now tall: canopy above the signs, at the ring's level); the hallway's FOOD COURT sign sat behind the start door's lintel seen
  from the back of the start room (4.3 -> 3.9 m). Planters turn and size their foliage by position, so repeats don't look copied.
- Bare walls dressed: cinema stairwell (two wayfinding stripes that follow the flight, LEVEL marks, a notice and Dale), the
  workshop hall's side walls (a banner, Dale, two notices), two Level 2 banners, and a ghost sign painted on the parking facade
  (new poster kind 'ghost': unlit, so its colours are the wall's at dusk). The hallway terrazzo is matter, with more tile variation.
- Checked and left alone: the PA card looked faint in screenshots, but a hidden pane does not advance CSS animations (it is opaque
  in play); the receipt's buttons are sticky by design and the whole receipt scrolls clear of them.
Cost, measured as an A/B against main's build at 42 fixed cameras (each benchmark shot's start, middle and end, culling updated):
main 317 calls / 46,632 triangles on average, this 317 / 46,657. Per view 0 to +4 calls (cinema stairs and workshop hall the most),
the Food Court hedge saves one. The env map adds no calls (checked by removing it). Benchmark route runs in a hidden pane vary by
up to ~140 calls per shot between runs, so they can't show differences this small.


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

Finished employee costumes and filming/meeting poses, aligned enlarged head hitboxes, added a distinct sting and corporate defeat line per boss, and use a colored confetti death burst with no boss gore. Shift+J selects a boss, J summons it; explicit debug ids remain supported. Added boss health/reward/theoretical Nail Gun time rows to npm run balance. Health and damage stay at the requested starting values pending player feedback. Headless browser inspection prompted a raised ring-light pose and a rotated whiteboard beside Dennis so it cannot hide his head from the front. Vouchers now clear on death, and order-form purchases consume them through g.events.

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
