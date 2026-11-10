# Sunset Galleria: build history ("Current state")

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

Planned four pay-to-trigger mall hazards in `docs/hazards-plan.md` (**Electrified Fountain** in the Grand Atrium, **Fryer Blast** at Corn Dog Corral in the Food Court, **Fire Sprinklers** in the Main Hallway, and **PA System Lure** in the Service Corridor; dropped **Toppling Shelves** and **Escalator Reversal** to avoid runtime navigation rebuilds, unbatching Mega Mart's static product shelves, and escalator dynamic-mesh invariants). Built the shared hazard framework (`src/config/hazards.js`, `src/game/features/hazards.js`, `hazard` pricing category in `src/game/pricing.js` and `src/config/economy.js` with a `'hazards'` Flash Sale group) and the first hazard, the **Electrified Fountain** (`src/game/features/fountainHazard.js`, `fountainHazard` on the south fountain rim in the Grand Atrium): 750 points, 8 s active (`0.4 s` pulses across a `7.0 m` radius) with opening stagger surge, convulsion slow (`0.25`), round-proof lethality (`max(200, 55% maxHealth)` per pulse on normal zombies; `10% maxHealth` cap per pulse on Bosses and Mascots), energized `3.7 m` fountain tower + 4 waterfall sheets + expanding shockwave ripple + jagged 4-segment forked lightning bolts + industrial breaker box with voltage needle and spark bursts, 25 s recharging cooldown, and clean Play-again reset without changes to `createGame.js`. Tested in `tests/hazards.test.js`.
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
no rule strictly broken); the tables are in docs/claw-machine-plan.md.

## 8 November 2026 - GRAB-A-GUN, phases 1 to 3: the claw machine, its six sites, Sunny and Refurbished prizes

The mystery box you work (docs/claw-machine-plan.md). One cabinet on the Hallway's south wall at x 8. Hold F to pay 1,000 (g.pricing 'claw' 'grab'): three
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


## 10 November 2026 - Closing Time phase 3, The win (browser)

- The existing receipt opens as SHIFT COMPLETE after the van starts. Clock out keeps the completed receipt available. Stay for overtime resumes on the controller or requests mouse lock with a Resume screen as a fallback.
- The fourth checklist box ticks at the van. The HUD shows OVERTIME after continuing. An overtime death uses the regular incident receipt and adds the win round, win time and number of completed overtime waves.
- The win releases pointer lock and stops rumble. The paused receipt is eligible for idle saving. Death alone starts the death music and camera.
- Shared files changed include `main.js`, `ui/screens.js`, `ui/hud.js`, `ui/readability.css` and `tests/closingTime.test.js`.


## 10 November 2026 - Closing Time phase 4, Line 1: the fountain

- Murray's Key Ring opens “Water features off.” Only kills dealt by the active Electrified Fountain count. The HUD and pause list show the count, and the PA announces the opening and the tick at 12. Bosses and Mascots count. Play again clears the duty.
- The breaker keeps its normal hazard behavior and price. The interim van still requires the four keys until parking validation is built in phase 7.
- With seed 42 and a stationary invulnerable lure in the real headless wave, the paid breaker took two activations in round 6 (11 then 8 kills), one in round 10 (15 kills) and one in round 15 (13 kills). A controlled run staging six full-health enemies at a time took two activations at each round. The measured price was 750 per activation.
- Shared files changed include the Closing Time config and game system, `createGame.js`, `events.js`, the van and fountain features, the HUD and pause UI, and `tests/closingTime.test.js`.

## 10 November 2026 - Closing Time phase 5, Line 2 (the night safe)

- Kettle’s Safe Key opens Takings banked. Hold interact at the Night Safe on Customer Service’s east wall to make one deposit. Each deposit updates the checklist, and the PA announces the opening and the tick after four deposits. Play again clears the key and progress.
- The safe charges 1,000 points per hold through the new closing price category. The Discount Code and Employee Discount apply to deposits. Flash Sales have no closing group.
- Production Chrome preview showed the locked prompt, the 1/4 HUD count, and the Done prompt with the 4/4 tick. Four full-price holds charged 4,000 points. The prompt and coplanar tests cover the safe alongside both Customer Service windows and the Prize Counter.
- Shared files changed include the Closing Time config and game system, the economy and pricing tables, the map and feature registry, and their test expectations.

## 10 November 2026 - Closing Time phase 6, Line 3 (last orders)

- Fairweather's Signature opens Last orders signed off. The next Build-A-Blaster collection, including a Restuff or an order already running at pickup, ticks the line once. Collections before pickup do not count. Play again resets the duty.
- Chrome production preview confirmed the 0/1 and 1/1 HUD states, both PA messages, and reset. The build charged 1,500 points and the Restuff charged 750, with no extra charge at collection.
- When the preview script forced the entire Restuff through while the opening PA was still up, the shared three-message PA queue dropped the completion banner. Letting the opening PA finish before the Restuff made the completion banner visible.
- Shared edits were limited to the Closing Time system and config, its existing test file, and the plan, history, folder guide and test guide.

## 10 November 2026 - Classic and Directed runs

- Play opens a choice with Classic focused. Restart run and Play again retain the confirmed mode. Back returns to the title.
- Classic keeps the physical keys and local interactions, with terse van and safe prompts. Directed retains the checklists, key directions, quest PA and receipt progress. Classic filters quest PA before it reaches the Notices archive.
- Both modes share phase 6 quest progress, pricing, win, overtime and career credit.
