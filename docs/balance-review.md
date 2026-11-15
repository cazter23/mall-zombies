# Balance review: judged for a human player

Status: 15 November 2026, written on branch `claude/balance-review` from main at 156b568. The review itself changed no game code or config.
Every "suggested change" below is a proposal to pick from.

**Applied since (same day, same branch): group 1.** That is the ammo changes G1-G5, the warranty fix P1, and the wardrobe fixes P2-P6 (Cardigan
by price, Gold Card at x1.25, 3D Glasses at x1.5). docs/history.md has the list. Everything else here is still a proposal.

Weapons come first, then perks (the wardrobe) and the other upgrades, then the economy, the extra modes and Closing Time. The last two sections
list where the existing tools assume bot-like play, and how future tools should model a human so this doesn't happen again.

## Summary: the most important problems, ranked

1. **Our balance tools measure a perfect shot, so every gun looks about twice as strong as it feels.**
   - `npm run balance` (tools/balance.js), and tests/balance.test.js which guards its numbers, measure a player standing still. They aim at the
     middle of the chest of a zombie that doesn't move, with the gun's resting spread. Every shot lands (100%), and the next shot follows the
     instant the last one is ready.
   - The economy bot is better, but it still lands about 3 shots in 4, aims at the head 20% or 50% of the time, and teleports to shops.
   - An average human lands about **55-60% of shots over a whole round, and 35-60% when the crowd is on them** (section 2).
   - Add the half-second to find the next zombie, shots fired into a zombie that is already dying, slower clicking on semi-auto guns, and
     reloads. An average human then kills **45-70% as fast as the report says** at the moments that matter.
   - This is the root of "the guns feel weak". Fixing the measurement (section 9) comes before trusting any number in the old reports.
2. **For a human, plain guns stop being good 6-11 rounds earlier than the tools say.** "Good" here means killing a Shopper in 3 seconds or less
   with the crowd on you.
   - The Rivet Rifle: round 19 for the bot, **round 9 for an average human**, round 16 for a good one.
   - The Price Gun: round 15 → 6. The Heavy Coil Nailer: round 24 → 13.
   - So a human needs warranties and a build several rounds earlier than the buy order assumes. They also earn a little less, and they walk to
     the shops instead of teleporting, so they get them later. That gap is where runs end: rounds 8-14.
3. **From round 10, no gun keeps up with the crowd.**
   - An average human with the upgrades they'd plausibly own kills **50-80% as fast as zombies arrive in rounds 10-15, and 20-38% as fast in
     rounds 25-30**.
   - So the full crowd (20-24 alive) is on them for most of every late round, and a round takes 2-4 minutes instead of the bot's 1-2.
   - On top of that:
     - runners (85% of zombies from round 14) are faster than backpedalling (4.6 against 3.9 m/s; about 2.9 m/s while aiming);
     - three hits down you;
     - several swings landing in the same moment all count, so being cornered is an instant down.
4. **Humans run out of ammo, and the economy report says ammo doesn't matter.**
   - At human accuracy, the Price Gun needs 2.2 extra full refills a round at round 15, the Rivet Rifle 1.2 and the Nail Gun 1.1. At round 25:
     5.6, 3.5 and 3.2.
   - The report's "ammo is 3% of income" came from a bot that lands 75% and teleports to a refill. For a human the points are the small part.
     The real cost is a walk to a RESTOCK-O-MATIC through 24 zombies, one to five times a round.
   - Reloading is the other half. Shooting at a crowd with the Price Gun at round 15 means about 20 seconds of reloading in a round of under
     a minute and a half, and every reload lets a runner close 6-14 m.
5. **Buying Premium or Platinum takes away handling that Deluxe gave you.**
   - A warranty tier replaces the one before it instead of adding to it (weapons/upgrades.js `withTier`).
   - Deluxe gives a 25% bigger magazine and 15% faster reloads. Premium then shrinks the magazine to +10% and puts the reload back to normal.
     Platinum is +15% and 10% faster.
   - So a human pays 3,000 for a gun that runs dry sooner. A bot hardly notices; a human does.
6. **Several wardrobe items are traps for a human**, because their downside hits exactly what humans struggle with:
   - **the Hi-Vis Vest**: Shoppers down you in 2 hits instead of 3;
   - **Wheelies**: your backpedal becomes slower than a jogging zombie;
   - **the Gold Card**: about 230 extra points a round, and slower healing;
   - **the Cardigan**: the same protection as the Sandwich Board, for 1,000 more;
   - **3D Glasses**: about +8% damage for a human who lands 20% headshots.
7. **The claw-only guns built for precision are useless in human hands.**
   - The Stargazer 3000 delivers 22-55% of the bot's output: a 12° hip cone, a slow scope, and its bonus damage only at 30 m, which the mall
     rarely offers.
   - The Bottle Rocket costs you 45% of your health from a point-blank shot. Humans fire at crowds that are on top of them.
   - The Balloon Launcher does a flat 200 that never scales.
   - The Leaf Blower kills nothing, yet it has the same chance as a real gun.
   - A grab costs 1,500 points, and about one prize in four is one of these.
8. **Build-A-Blaster is the cheapest big power step, and that is right for humans. But its pre-filled builds lean on headshots.**
   - A 1,500 build clears a round about as fast as 10,000 points of warranty (`npm run balance:bab`). Don't raise its price: humans need it more
     than bots do.
   - Smoothie, Neon and Antifreeze come pre-filled with the Headshot heart, which fires rarely for someone landing 15-30% headshots.
   - The Clearance Rack Limited Edition also needs a headshot to pay out.
9. **Closing Time's finale has no ammo source.**
   - It is fought in Customer Parking against a boss with 16 times a Shopper's health (20,000-27,000), on top of the full wave. No
     RESTOCK-O-MATIC or wall gun is there in a normal run (the three machines are in the Food Court, the Atrium and the Cinema); only a
    lucky Stockroom Delivery power-up refills you.
   - The bot never noticed, because it teleports to refill.
   - The "Everything Must Go" arena (the 10 x 10 m start room with up to 20 zombies alive) is decided by the size of the room, not by your aim.
10. **Power-ups, Flash Sales and the Soda Bomb are designed for someone who is never under pressure.**
    - Power-ups drop in the middle of the crowd you just shot, last 15 s, and stop the next drop from coming while they lie there.
    - About three Flash Sales in four go live mid-wave.
    - The Soda Bomb's 1.8 s fuse lets a running crowd walk 6-8 m past the blast.

My recommendation for the first session: problems 1, 4, 5 and 6, plus the small gun fixes in section 3.3 (ammo, the Stargazer, the Bottle
Rocket). They are number-only changes with a clear direction. Problems 2 and 3 are the big one: decide them after a playtest with the new
ammo, because more ammo and the warranty fix already move them. The two candidate levers are a gun damage pass (+10-15% on the wall guns) or
slower zombie health growth after round 9 (x1.075 → x1.065 a round). Section 8 has both.

## 1. Why the old numbers were optimistic (what each tool assumes)

| Tool or test | What it assumes | What a human does instead |
|---|---|---|
| `npm run balance` (tools/balance.js, tools/gunReport.mjs) | A still player and a still Shopper, aimed at the chest, resting spread (no bloom from sustained fire), every shot from the first one to the kill. Its own note says "compare guns, not stopwatch kills", but its numbers are what the guns were tuned to | Misses, a gap to find the next zombie, bloom from holding the trigger, backpedalling while aiming |
| tests/balance.test.js | The same maths: each gun's role ("Rivet above Price", "Coil fits a round-20 Shopper in its drum") is checked with perfect hits | The ranking mostly survives human aim, but the absolute strength doesn't |
| tests/upgrades.test.js `holdsUntilRound` | A tier "holds until round N" counting body shots, every one landing | The ratio between tiers survives misses, but the round where a human feels the gun is weak is several rounds earlier |
| Boss and Last Customer tables in `npm run balance` | "no upgrades, headshots, misses or wave pressure" | A boss fight happens inside a full wave |
| `npm run sim:economy` (tools/economyBot.js) | About 75% of shots land; aims at the head 20% (average) or 50% (good) of the time; shopping is a teleport; refills by teleport; sees threats all round; immortal past round 10 | 55-60% land; 15-30% headshot kills; walks to every shop through the crowd; one life |
| `npm run balance:bab` (tools/babReport.mjs) | Stands still aiming down sights, head 35% of the time (its header says so) | Moves, so slows are undervalued too |
| `npm run melee` | Every swing connects, and standing in reach costs nothing | About 80% of swings connect, and a zombie's 0.3 s wind-up is shorter than a 0.37 s swing |
| `npm run kiosk` (tools/kioskBalance.js) | Every throw lands in a crowd of 4; the Sentry never misses; compared with wall ammo where "every shot lands"; prices against the good bot's income | A thrown bomb lands where the crowd was. But because humans miss with guns, aim-free equipment (Sentry, Air Horn, Glitter) is worth about 1.7x more to a human than this report says |
| `npm run sim:claw` | A prize is worth its wall price (a Leaf Blower counts as 1,500) | A prize is worth what it does for you; several are near useless to a human |
| tools/closingTimeBot.js | Teleports for every errand and every refill; skips the Return quest with a debug call | Has to carry the fight to the parking lot and back |

## 2. How a human was modelled

All numbers below come from a throwaway script, not added to the repo (kept at
`C:\Users\User\AppData\Local\Temp\claude\02e9a3f18fa83eee\d5c188de-ce19-4de8-b139-4fb23dd0e53f\scratchpad\human.mjs`).

**How it works.**
- It re-fires every gun shot by shot against the Shopper's real hitboxes, using the game's own damage formula (weapons/gunStats.js `hitDamage`),
  the gun's real spread, bloom, recoil and reload, and the upgrade maths (`resolveGun`, `withTier`, `withRenewals`).
- On top of the gun it adds what a person does:

| | Bad | Average | Good | Bot (the old tools) | Where it comes from |
|---|---|---|---|---|---|
| Aim wobble, calm (1 sigma, degrees) | 1.5 | 0.95 | 0.6 | 0 | General FPS knowledge: a mouse player tracking a walking target wobbles roughly half a degree to a degree and a half. The economy bot uses 1.6° (average) and 0.8° (good) but only fires when it is within 2.2° / 1.4°, which a person doesn't do |
| Under pressure (backpedalling, crowd within 6 m) | x1.6, plus crowd jostle 0.18 m | x1.5, 0.15 m | x1.4, 0.12 m | none | General FPS knowledge: accuracy roughly halves when you shoot while retreating from something close |
| Where they aim | chest | upper chest / neck | head (precision guns), neck (automatics) | middle of the chest | Most players aim centre mass; good players aim high. Aim assist (weapons/aimAssist.js) is controller-only and pulls to the CHEST on purpose, so it raises hits but lowers headshots |
| Recoil they cancel | 45% | 65% | 82% | 100% | General FPS knowledge |
| Time from a kill to the first shot on the next zombie | 0.6 s | 0.4 s | 0.25 s | 0.1 s | Human reaction time plus a turn. An automatic gun keeps firing for half of it: that is overkill, wasted ammo |
| Fastest clicking on a semi-auto gun | 4.5 a second | 5.5 | 7 | the gun's limit (the Staple Gun allows 8.3) | General: sustained clicking with aim is 4-7 a second |

**What came out** (hits per shot fired, a whole round blended: 40% of the time calm at 8 m, 60% under pressure at 6 m; round 10):

| Gun | Bad | Average | Good | Bot (balance tool) |
|---|---|---|---|---|
| Staple Gun | 48% | 60% | 62% | 100% |
| Price Gun | 44% | 59% | 66% | 100% |
| Nail Gun | 47% | 56% | 63% | 100% |
| Foam Dart Blaster | 50% | 60% | 61% | 100% |
| Confetti Cannon (pellets) | 59% | 62% | 67% | about 60% of pellets at 5 m |
| Rivet Rifle | 43% | 57% | 68% | 100% |
| Heavy Coil Nailer | 44% | 54% | 66% | 100% |
| Barcode Scanner | 50% | 58% | 62% | 100% |
| BOGO | 36% | 42% | 46% | 97% at 5 m, 53% at 10 m |
| Stargazer 3000 | 49% | 59% | 59% | 100% |

- These land inside the 40-65% range you'd expect from an average-to-good player in a horde shooter. That is a sanity check, not a
  measurement.
- Under pressure alone, an average player lands 55-61% at 5 m, 35-46% at 10 m, and about 20% at 20 m (zombies far away and
  moving).

**Headshots** (the share of kills that are headshots):

| Gun type | Bad | Average | Good |
|---|---|---|---|
| Semi-auto precision guns (Staple, Nail, Scanner, Foam bursts) | 10-20% | 25-40% | 45-65% |
| Automatics (Price, Rivet, Coil, BOGO) | 5-10% | 15-25% | 30-50% |
| Pellets (Confetti Cannon) | about 15% for everyone | | |

- The model gave good players 80-98% headshot kills with the semi-auto guns. That is too generous: real zombies lurch and duck. I capped the
  table at what experienced players typically manage.
- The economy bot scores 42-50% headshot kills at both skills. That is good-player territory, so its income has about 8-10 points a kill of
  headshot bonus that an average human won't earn.

**Mistakes counted:** missed shots, overkill, the gap to the next target, reloading every magazine (including mid-crowd), and slower clicking.

**Not counted** (each makes real play worse still, so these numbers are the optimistic side of human):
- reloading early with half a magazine;
- swapping weapons late;
- getting cornered;
- walking time to the shops;
- buying the wrong thing.

## 3. Every gun

### 3.1 The table

Seconds to kill one Shopper for an **average human with the crowd on them** (7 m; the Cannon 4 m, the Stargazer 15 m), counting reloads, the
gap to the next target and pierce through the crowd behind. "Upgraded" is what a human plausibly owns by then: Platinum and a Regular build by
round 15, plus 5 Renewals by round 25. The bot column is the old tool's view of the plain gun at round 10, calm.

"Good until" is the last round where the plain gun still kills a Shopper in 3 s or less with the crowd on you, for each kind of player.

| Gun | Price | Its job | Bot r10 plain | Human r5 plain | Human r10 plain | Human r15 upgraded | Human r25 upgraded | Good until: bot / avg human / good human | Verdict for a human | How sure |
|---|---|---|---|---|---|---|---|---|---|---|
| Staple Gun | free | The starter pistol | 6.7 | 8.0 | 15.1 | 6.0 | 7.5 | 3 / never / 1 | Fine as a starter. Throwing points at it is a mistake | High |
| Price Gun | 500 | Cheap early sprayer | 2.1 | 2.6 | 4.0 | 1.9 | 2.2 | 15 / 6 / 9 | Fine damage, **too little ammo**: 20 shots a kill at round 10, about 17 reloads a round at 15 | High |
| Nail Gun | 1,000 | Pierces 3, no falloff, long range | 2.2 | 2.5 | 4.0 | 1.6 | 2.2 | 14 / 6 / 11 | **Too weak for an average human**: a 10-nail magazine and 60 in reserve run dry 1-3 times a round. Strong for a good player, who lands the 2x headshots | Medium |
| Foam Dart Blaster | 1,200 | Accurate mid-range bursts | 1.6 | 2.0 | 3.3 | 1.7 | 1.9 | 18 / 9 / 13 | Slightly weak. Its "accurate at range" niche is real, but humans fight at 5-10 m | Medium |
| Confetti Cannon | 1,500 | Close-range room clearer | 1.9 | 1.9 | 2.7 | 1.6 | 1.7 | 19 / 11 / 16 | **Fine**: the most human-proof wall gun (pellets forgive bad aim; it keeps 77-94% of the bot's output). Its weak spot is the shell-by-shell reload, about 40% of the time | Medium |
| Rivet Rifle | 1,500 | The main automatic rifle | 1.7 | 1.9 | 3.2 | 1.4 | 1.8 | 19 / 9 / 16 | Slightly weak, mostly from ammo: 1.2 extra refills a round at round 15, 3.5 at 25 | Medium-high |
| Heavy Coil Nailer | 2,500 | Sustained fire, huge drum, pierces 2 | 1.1 | 1.7 | 2.5 | 1.3 | 1.5 | 24 / 13 / 19 | **Fine, and the best human gun.** Its 64-round drum and 256 reserve mean no refills until round 20. Once owned it makes the Rivet and Foam pointless | High |
| Barcode Scanner | 1,750 | Charged beam that pierces 4 and marks | 1.9 | 2.5 | 3.4 | 1.7 | 1.9 | 21 / 14 / 15 | Fine damage, the best headshot gun. **Its ammo is the dearest in the mall** (900 for 48 beams) | Medium |
| Leaf Blower | claw | Pushes crowds back | - | - | - | - | - | - | **Trap as a prize**: kills nothing. A fine escape tool, but it costs a 1,500 grab | High |
| Tennis Ball Launcher | claw | Bouncing ball for corridors, scales with the round | 3.4 | 5.5 | 6.8 | 2.9 | 1.5 | - | Weak early, fine late. My model can't count bounces, so it undersells corridor play | Low |
| Return to Sender | claw / Return quest | The wonder weapon: kills everything in a short cone | instant | instant | instant | instant | instant | always | **Fine.** Aim doesn't matter, so humans get its full value. 12 shots is its limit | Medium |
| Stargazer 3000 | claw | Long-range sniper (damage rises with range) | 3.8 | 11.0 | 15.0 | 5.5 | 8.0 | - / never / never | **Too weak for humans**: 22-55% of the bot's output. A 12° hip cone, a 0.38 s scope with sway, and full power only at 30 m | High |
| Bottle Rocket Bazooka | claw | Breaks clumps | 3.4 | 7.1 | 6.0 | - | - | - | **Too dangerous to the user**: a shot at your feet costs 45% of your health, and humans fire at crowds that are on them. One rocket a magazine | Medium |
| Balloon Launcher | claw | Homing balloons (hits what you don't aim at) | 3.2 | 4.1 | 7.2 | 2.4 | 3.3 | - / 4 / - | Human-friendly aim, but **a flat 200 damage never scales**: weak after round 5 unless upgraded | Medium |
| BOGO (akimbo) | claw | Close-range bullet hose | 1.7 | 2.1 | 3.6 | 1.6 | 1.9 | 18 / 8 / 10 | Slightly weak: the widest cone of any automatic (42% hits for an average player) | Medium |

The Bottle Rocket and Balloon rows come from my model treating the rocket as a direct hit. Homing and blast radius make them less dependent on
aim than it suggests, so read those two rows as rough.

**Which guns nobody would pick:**
- the Staple Gun past round 3;
- the Leaf Blower, the Stargazer and the Bottle Rocket as prizes;
- the Nail Gun for an average player (it is a good player's gun).

**Which make the others pointless:**
- the Heavy Coil Nailer, once you own it (round 12-13 for a bot, later for a human);
- the Price Gun as the best deal in the mall, which is fine: it's the starter. For a human it falls off at round 6, so its "best value"
  status ends sooner than the economy report says.

### 3.2 Melee, warranty tiers, builds and Limited Editions

**The box cutter and its tiers.** An average human lands about 80% of swings (an 80° cone with a lunge).

| Round | Plain cutter | Sharpened Blade (1,500) | Box Cutter Pro (4,000) | The best gun (Coil, round's upgrades), human under pressure |
|---|---|---|---|---|
| 5 | 0.50 | 1.07 | 1.07 | 0.59 |
| 10 | 0.28 | 0.68 | 0.68 | 0.76 |
| 15 | 0.21 | 0.50 | 0.68 | 0.78 |
| 20 | 0.15 | 0.40 | 0.50 | 0.72 |
| 25 | 0.11 | 0.28 | 0.40 | 0.59 |

(Kills a second on one zombie.)

- Melee doesn't need aim, so it is relatively better for a human.
- **Sharpened Blade at rounds 5-9 is the strongest kill rate a human can buy**: it one-hits a Shopper through round 5, and the Pro through
  round 9. The economy plan buys it at round 23.
- The catch is standing in reach. A Shopper's wind-up (0.3 s) is shorter than a swing (0.37 s), so from round 6 every two-swing kill trades a
  hit.
- Verdict: **fine, slightly strong early, risky**. Nobody would guess it is this good, because the desk says nothing about it. No change
  needed; maybe a guide line.

**Customer Service gun tiers** (prices: economy.js `upgrades.tiers`):

| Tier | Price | Does | Verdict for a human |
|---|---|---|---|
| Deluxe | 1,000 | +10% damage, +25% magazine, 15% faster reload | Fine, good value |
| Premium | 3,000 | +45% damage, but magazine back to +10% and the reload back to normal | **Flawed**: you lose handling you paid for (problem 5) |
| Platinum | 6,000 | +90% damage, +15% magazine, 10% faster reload, a free refill once a round when you run completely dry | Fine. The free refill is worth more to a human than to a bot. Arrives around round 12-14 for a human, about when runs end |
| Renewals (x5) | 4,000-10,000 | +9% damage, +3% magazine each | Fine for the few who get there |

**Build-A-Blaster** (1,500 a ritual):
- An Understuffed build is x1.5 damage and +20% magazine; Overstuffed is x2.2. A stuffing effect comes on top.
- `npm run balance:bab`: a 1,500 build clears a round-8 to round-16 room about as fast as Platinum (10,000 of warranties), with far less
  damage taken.
- Verdict: **strong for its price, and it should stay that way for humans.** The economy report's proposals to raise it to 3,000-5,000 cost
  survival even for the bot (38% → 15-28% of good-bot runs reaching round 10).
- The real human problem: three of the six stuffings come pre-filled with the Headshot heart, which fires on headshots (rare for a human). The
  Last Round heart (x1.5, every magazine) or the Reload heart suit a human better.

**Limited Editions** (dropped by bag-carrying zombies, 15% a kill from round 3):
- **Party Trap** (the Confetti Cannon): a 650-damage floor charge.
  - Aim doesn't matter much, so it is human-friendly.
  - It is a flat 650 at every round: it kills to round 7 and does 28% of a round-20 Shopper. **Weak late.**
- **Clearance Rack** (the Price Gun): tag three zombies with body shots, then a headshot on a tagged one pops them all for x3.
  - An average human gets a headshot kill about 15-25% of the time with an automatic, so it rarely pays. **Too weak for a human.**

### 3.3 Suggested gun changes (none applied)

The numbers live in src/config/weapons.js unless noted. After any of them: `npm run balance`, and tests/balance.test.js will need its
thresholds checked.

| # | Change | From → to | What it does |
|---|---|---|---|
| G1 | Price Gun ammo | `magazineSize` 24 → 30, `startingReserve` 144 → 180 | Extra refills a round at 15 (with Platinum and a build): about 2.4 → 1.5, with a quarter fewer reloads. Damage is unchanged, so it stays the starter (good until round 7 instead of 6) |
| G2 | Rivet Rifle | `damage` 80 → 90, `startingReserve` 144 → 216 | Good until round 10 for an average human instead of 9. At round 15: kills vs arrivals 0.65 → 0.76, extra refills 1.2 → 0.4 |
| G3 | Foam Dart Blaster | `damage` 90 → 100, `startingReserve` 144 → 180 | Good until round 10 instead of 9. At round 15: kills vs arrivals 0.58 → 0.66, extra refills 0.8 → 0.3. Keeps it level with the Rivet after G2 |
| G4 | Nail Gun ammo | `magazineSize` 10 → 12, `startingReserve` 60 → 90 | Extra refills a round at 15: 0.9 → 0.4. Its main human problem is running dry; damage stays (it is already strong per nail) |
| G5 | Barcode Scanner ammo | economy.js `wallBuys.barcodeScanner.ammo` 900 → 600, `magazineSize` 8 → 10 | The dearest refill in the mall for the gun with the fewest shots |
| G6 | Stargazer 3000 | `spread.base` 12 → 5, `scope.sway.degrees` 0.22 → 0.12, `falloff.end` 30 → 20 | Usable without the scope in an emergency, steadier through it, and its full bonus at 20 m, where the mall's long sightlines actually are |
| G7 | Bottle Rocket | `blast.self.share` 0.45 → 0.25, `maxShare` 0.75 → 0.5 | A shot at your own feet costs a quarter of your health instead of nearly half. Still a lesson, no longer a death sentence |
| G8 | Balloon Launcher | add `roundScaling: { exponent: 0.4 }` (the Tennis Ball's key, which uses 0.85; gunStats.js already reads it for any gun) | Its 200 grows to about 450 at round 15 and 600 at round 25 (a quarter of a zombie). It stays a helper, not a killer |
| G9 | BOGO | `spread.base` 2.4 → 1.8, `spread.adsMultiplier` 0.55 → 0.4 | Aiming finally tightens it; still the shortest-range automatic |
| G10 | Leaf Blower in the claw | config/clawMachine.js `prizes.leafBlower.weight` 7 → 4 | One prize in eight is "nothing that kills" instead of one in five |
| G11 | Clearance Rack | the pop happens on any kill of a tagged zombie, not only a headshot (code, game/features/limitedEditions.js or wherever the pop is checked) | Pays out for everyone; headshots could keep a bonus |
| G12 | Party Trap | scale its 650 with the round like Kiosk equipment (`(health/800)^0.37`) (code) | Keeps it worth placing after round 8 |

Two guns don't need a change: the **Heavy Coil Nailer** (the human's best gun; watch it, don't buff it) and the **Confetti Cannon**.

## 4. Pressure: a crowd at rounds 15, 25 and 30

An average human under pressure, 7 m from the crowd, with the upgrades they'd own by then (Platinum and a build by 15, plus 5 Renewals by 25).

**What the columns mean:**
- **"Kills vs arrivals"** is how fast you kill against how fast zombies come out. Under 1, the crowd grows until 20-24 are alive.
- **"Extra refills"** is how many times the whole magazine and reserve run out in a round, beyond the first load.

| Gun | Round | Shopper hp | Zombies | Kills vs arrivals | Round minutes, human (bot) | Shots a round (carried) | Extra refills | Reloads | Seconds reloading |
|---|---|---|---|---|---|---|---|---|---|
| Price Gun | 15 | 1,157 | 41 | 0.52 | 1.3 (0.7) | 560 (177) | 2.2 | 17 | 20 |
| Price Gun | 25 | 2,386 | 66 | 0.25 | 2.5 (1.3) | 1,203 (182) | 5.6 | 32 | 37 |
| Price Gun | 30 | 3,425 | 79 | 0.17 | 3.9 (2.0) | 1,867 (182) | 9.3 | 49 | 57 |
| Rivet Rifle | 15 | 1,157 | 41 | 0.66 | 1.0 (0.7) | 421 (194) | 1.2 | 8 | 15 |
| Rivet Rifle | 25 | 2,386 | 66 | 0.32 | 2.0 (1.0) | 903 (202) | 3.5 | 16 | 28 |
| Rivet Rifle | 30 | 3,425 | 79 | 0.23 | 2.9 (1.5) | 1,333 (202) | 5.6 | 23 | 41 |
| Heavy Coil Nailer | 15 | 1,157 | 41 | 0.72 | 0.9 (0.7) | 317 (344) | 0 | 4 | 10 |
| Heavy Coil Nailer | 25 | 2,386 | 66 | 0.38 | 1.7 (0.8) | 600 (358) | 0.7 | 6 | 16 |
| Heavy Coil Nailer | 30 | 3,425 | 79 | 0.27 | 2.4 (1.1) | 873 (358) | 1.4 | 9 | 24 |
| Nail Gun | 15 | 1,157 | 41 | 0.56 | 1.2 (0.7) | 152 (74) | 1.1 | 11 | 18 |
| Nail Gun | 25 | 2,386 | 66 | 0.28 | 2.3 (1.3) | 316 (76) | 3.2 | 20 | 32 |
| Barcode Scanner | 15 | 1,157 | 41 | 0.47 | 1.4 (0.7) | 86 (51) | 0.7 | 8 | 13 |
| Barcode Scanner | 25 | 2,386 | 66 | 0.30 | 2.2 (1.0) | 133 (53) | 1.5 | 10 | 17 |

What it means in plain words:
- **Round 15**: you kill about two zombies for every three that come out. The crowd fills to 24 within half a minute and stays there. With any
  gun but the Coil, you run dry at least once (Platinum's free claim covers one of those).
- **Round 25**: you kill one for every three. The round is a two-minute run in circles with 24 zombies, 85% of them faster than your backpedal,
  and 2-5 trips to a RESTOCK-O-MATIC.
- **Round 30**: the same, but four minutes long, and with the Price Gun nearly a minute of it spent reloading.
- **"How often you're reloading or dry when you get hit"**: a reload is 1.3-3.1 s, and a runner closes 6-14 m in that time. Once the crowd is
  at the cap (from about round 12 for a human), nearly every reload is a moment you can be hit unless you sprint first. With the Price Gun at
  round 15, that is 17 such moments a round; with the Coil, 4.

## 5. Perks (the wardrobe) and the other upgrades

### 5.1 Wardrobe (config/wardrobe.js; prices economy.js `wardrobe`)

Facts that decide these: 100 health; a Shopper hits for 40; a Cart, a Mascot or a boss slam for 50-60. Healing starts 2.5 s after the last
hit at 50 a second. You walk at 5 m/s and backpedal at 3.9 (about 2.9 while aiming). Zombies jog at 3.4 and run at 4.6.

| Item (slot) | Price | Upside | Downside | Verdict for a human | Why |
|---|---|---|---|---|---|
| Paper Hat (head) | 750 | Healing starts at 2.0 s instead of 2.5 | Reloads 9% longer | Fine | Humans get hit more, so faster healing pays |
| Aviators (head) | 1,250 | Aim in 30% faster; stronger aim assist | Weapon swap 18% slower | Niche | The aim assist half does nothing on mouse and keyboard |
| 3D Glasses (head) | 1,500 | Headshots x1.25 | 15% slower while aiming | **Trap** | At 20% headshots that is about +8% damage, for a slower walk while aiming, all the time |
| Cardigan (torso) | 2,500 | Health x1.25 (4 Shopper hits) | Sprint lasts 20% less | **Trap (dominated)** | The Sandwich Board gives the same 4 hits, halves knockback, and costs 1,000 less |
| Sandwich Board (torso) | 1,500 | Zombie hits x0.8; knockback halved | Strafe 15% slower | **Must-have** | The best survival item in the wardrobe |
| Hi-Vis Vest (torso) | 1,250 | Reloads 20% faster; your own blasts don't hurt you | Zombie hits x1.25 | **Trap** | A Shopper hits for 50: **two hits down you**. Only worth it with the Bottle Rocket |
| Light-Up Sneakers (feet) | 1,250 | Sprint 10% faster | Sprint lasts 10% less | Niche | About the same distance; close to nothing |
| Orthopedic Walkers (feet) | 1,000 | Sprint lasts 35% longer; refills sooner | Sprint 5% slower | Fine, good for humans | Running away is how humans survive, and 7.6 m/s still outruns every runner |
| Wheelie Sneakers (feet) | 1,000 | Faster slide, shorter slide cooldown | Backpedal x0.85 | **Trap** | Backpedal becomes 3.3 m/s, **slower than a jogging zombie** (3.4). Backpedalling while shooting is the core human move |
| Fanny Pack (accessory) | 1,500 | Reserve ammo x1.25 | Swap 11% slower | Fine, better for humans than the report thinks | Humans burn ammo 1.5-2x faster than a bot |
| Foam Finger (accessory) | 750 | Box cutter x1.5 | Reloads 11% longer | Niche | Stacks badly with the Paper Hat: reloads 21% longer with both |
| Gold Card (accessory) | 2,000 | Kill pay x1.1 | Healing starts at 3.0 s | **Trap** | Kill pay is rounded to tens (game/wallet.js), so a Shopper kill pays +10. About +230 a round at round 8: 9 rounds to pay back. And slower healing hurts the player who gets hit most |

### 5.2 Attachments (config/upgrades.js; the first buy in a store unlocks free fitting there for the run)

| Attachment | Price | Upside | Downside | Verdict for a human |
|---|---|---|---|---|
| Extended Nozzle | 1,000 | Damage carries 60% further | Aims 10% slower | Trap: falloff starts at 10-15 m, and humans fight closer |
| Sawn-Off | 1,000 | +20% damage | Falloff starts 35% sooner (the Nail Gun gains one) | **Strong**: +20% on every gun you own for one payment, against +10% for 1,000 per gun from Deluxe. Humans fight inside the shorter range anyway. Fine for now: humans need it |
| Laser Pointer | 750 | Hip fire 35% tighter | none | **Must-have for humans**, and never measured: panic hip fire is human behaviour |
| Zoom Lens | 750 | Aimed shots 35% tighter, more zoom | Aims 10% slower | Fine |
| Grip Tape | 750 | 35% less recoil | none | **Must-have for humans**: recoil control is the human weakness on the automatics |
| Wristband | 750 | Aims 30% faster | 10% more recoil | Niche |
| Jumbo Pack | 1,000 | Magazine x1.5 | Reloads 20% slower | Fine (fewer reloads, each one longer) |
| Speed Loader | 1,000 | Reloads 35% faster | Magazine x0.9 | Fine, good for humans |

### 5.3 Kiosk Kevin (config/kiosk.js; equipment power grows as (zombie health / 800) ^ 0.37)

| Item | Price | Does | Verdict for a human | Why |
|---|---|---|---|---|
| Soda Bomb x3 | 500 | 1.8 s fuse, 4 m blast, 850 x power at the centre | **Trap** | In 1.8 s a jogger walks 6 m and a runner 8 m. A bomb thrown at a chasing crowd goes off behind it, unless the crowd is stuck in a doorway |
| Sparkler Cake x2 | 400 | Sits 4 s; burns everything within 3 m | Fine | Drop it as you back off and the crowd walks over it. Doesn't need aim |
| SPIN-O-MATIC Sentry | 1,500 | 30 s of hitscan fire that never misses | **Must-have when stocked** | It is aim-free, so worth relatively more to a human than to the bot. Stocked only in rounds 8-10, 17-19 and 26-28 |
| Stadium Air Horn x2 | 500 | Staggers and shoves everything within 6 m | Fine, a good panic button | It buys about 1.5 s: enough to start a sprint |
| Glitter Bomb x2 | 750 | Opens on touch; up to 8 zombies fight each other for 6 s | Fine to strong | It bursts on the first zombie it touches, so it is the most human-proof throw |
| Bubble Wrap, a layer | 500 | Absorbs 30 of a hit, up to 3 layers | Niche, leaning trap | Spent on chip damage that healing would have fixed in 4 s. The second layer adds no extra Shopper hit |

### 5.4 Power-ups, hazards, Flash Sales

**Power-ups** (config/powerUps.js):
- A drop comes every 12-16 kill credits, at most 3 a round, and lies 15 s at the spot where the zombie died, usually inside the crowd you were
  shooting.
- **The meter stops while a drop lies uncollected**, so a drop you can't reach also delays the next one.
- The best ones for a human: Stockroom Delivery (all ammo), Black Friday, Commission Day, Clearance.
- Paid Break (heals 15 a second inside a 2.5 m circle) is slower than ordinary healing (50 a second): dead weight.
- Employee Discount (30% off the next buy within 30 s) is usually wasted: you pick it up mid-wave.

**Hazards** (config/hazards.js):
- The Fire Sprinklers (600, the whole hub, everything dead in about 1.5 s, no harm to you) and the Electrified Fountain (750) kill everything in
  them at every round.
- For bots that would be "too strong". **For a human who is outgunned from round 10, they are the release valve.** Leave them alone until the
  guns are fixed, then look again.
- The PA Lure (8 s of zombies standing still) is ideal for a human.
- The Fryer's switch sits inside a corner, so pulling it means backing into the corner: niche.

**Flash Sales:**
- A sale is live for 45 s on a clock that ignores the round break. About three in four go live mid-wave.
- A Doorbuster checks that you can reach the item in time assuming 10 s of sprinting, but sprint lasts 4 s.
- Verdict: the ammo sale is useful; the rest are mostly wasted by humans.

### 5.5 Suggested changes for perks and upgrades (none applied)

| # | Change | From → to | What it does |
|---|---|---|---|
| P1 | Warranty tiers keep the previous tier's handling | config/upgrades.js premium `{ damage: 1.45, magazine: 1.1 }` → `{ damage: 1.45, magazine: 1.3, reload: 0.85 }`; platinum `magazine` 1.15 → 1.35, `reload` 0.9 → 0.8 | Each tier is strictly better than the last. Run `npm run balance` and tests/upgrades.test.js afterwards |
| P2 | Hi-Vis Vest | wardrobe.js `hiVisVest.factors.damageTakenMultiplier` 1.25 → 1.2 | A Shopper hits for 48: three hits still down you (two leave you at 4 health) |
| P3 | Wheelie Sneakers | `wheelieSneakers.factors.backpedalSpeed` 0.85 → 0.95 | Backpedal 3.7 m/s, back above a jog |
| P4 | Cardigan | economy.js `wardrobe.cardigan` 2,500 → 1,500 (or `maxHealth` 1.25 → 1.5) | A real choice against the Sandwich Board |
| P5 | Gold Card | `goldCard.factors.killPayMultiplier` 1.1 → 1.25 (a Shopper kill +20 after rounding), or the price 2,000 → 1,000 | Pays back in about 4-5 rounds instead of 9 |
| P6 | 3D Glasses | `glasses.factors.headshotDamageMultiplier` 1.25 → 1.5, or the price 1,500 → 750 | About +17% damage at human headshot rates |
| P7 | Builds that pre-fill the Headshot heart | config/workshop.js `defaultHeart` of smoothie, neonTube and antifreeze: 'headshot' → 'lastRound' | The pre-filled order works for someone who rarely lands headshots |
| P8 | Soda Bomb | kiosk.js `sodaBomb.fuseSeconds` 1.8 → 1.0 and `projectile.restitution` 0.42 → 0.2 (bursting on touch like the Glitter Bomb would be better, but needs code) | The blast lands where the crowd still is |
| P9 | Bubble Wrap | `bubbleWrap.layerStrength` 30 → 40, `maxLayers` 3 → 2 | Each layer is exactly one Shopper hit; a full wrap still gives 5 hits, for 1,000 instead of 1,500 |
| P10 | Power-ups | powerUps.js `lifetime` 15 → 25, `pickupRadius` 0.85 → 1.3; Paid Break heal 15 → 40 a second; let the drop meter keep counting while a drop lies (code, game/powerUps.js) | Humans can get to them after the crowd thins |
| P11 | Flash Sales | economy.js `flashSales.durationSeconds` 45 → 60; doorbuster `reachShareOfWindow` 0.5 → 0.35 | More sales reach a break; Doorbusters only for items you can really reach |

## 6. The economy at a human's income

**A human earns about the same per zombie as the bot, but keeps less of it.**
- Points come from hits (+10 each) and kills, so misses don't lose income directly. The same zombie takes the same number of hits whoever
  shoots it.
- The differences:
  - **Headshot bonus:** the bot gets 42-50% headshot kills; an average human 15-30%. That is 8-10 points a kill, about 6% of income.
  - **Ammo:** with the Rivet Rifle, an average human spends 1-3.5 extra refills a round from round 15 (400 each at a RESTOCK-O-MATIC; one is
    free with Platinum). That is about 7-15% of income, against the bot's 3%. A bad player spends twice that.
  - **Walking:** every shop trip costs part of the 20 s break, so a human makes one or two stops a break, not five.
- Net, a human has roughly **80-90% of the bot's spendable points, and every purchase lands about one round later** than the economy report's
  table:
  - Rivet Rifle round 5-6;
  - first build round 8;
  - Premium round 9-10;
  - Platinum round 12-14;
  - the second gun fully upgraded around round 25 instead of 23.

**What `npm run sim:economy -- --quick` says today** (run for this review on main's numbers: 2 immortal seeds to round 10 and 4 one-life
seeds a set-up, so it is too noisy to quote exactly):
- Income is unchanged from the report: about 24,800 by round 10 (good bot) and 23,000 (average bot).
- The buy order lands as before: Rivet Rifle in round 5, the build in 7, Premium in 8.
- **One-life runs end around round 9-10.** The good bot dies in round 9-12 (median 10.5), the average bot in round 6-12 (median 9). Only half
  of either reach round 10. Shoppers do most of the killing.
- **The bot being killed lands 3 shots in 4 and gets 46-53% headshot kills.** That is better aim than an average human. So an average human
  who moves no better than this bot ends a run before round 10. Better movement is the human's only advantage over it.
- The quick run also shows two things to tidy in the tool: some proposal labels are out of date ("A. Price Gun 70 -> 58" when 58 is already
  the game's number, "claw 1,000 a grab (today)" when it is 1,500).

**What this means for prices and the difficulty curve:**
- The power ladder arrives just as human runs end. Platinum (6,000) lands at round 12-14, which is exactly where section 4's pressure peaks and
  where the economy report's own bots start taking dozens of lethal hits a round.
- The report's worry that "after round 23 there is nothing left to buy" is a problem only for an immortal bot. For a human, the problem is the
  opposite: the help comes too late.
- Cheap early power (the Price Gun, Deluxe, the build, the Sharpened Blade, Grip Tape and the Laser Pointer) is what decides a human run. Keep
  it cheap.
- If you want one price change: **Platinum 6,000 → 5,000** (economy.js `upgrades.tiers.platinum`). It brings the free refill and +90% damage
  about one round sooner, into the window where humans die. Low priority next to P1.
- The difficulty curve itself (zombie health x1.075 a round after round 9, 85% runners from round 14, up to 24 alive) is COD-like. It is the
  gun and ammo side that was tuned for bots. So fix the guns and ammo first (G1-G5, P1), playtest, and only then decide whether health growth
  needs to come down (section 8).

## 7. The extra modes and Closing Time (briefly)

**Arena survival** (config/arenas.js):
- **Everything Must Go** (the 10 x 10 m start room, a Price Gun, a refill machine and the box cutter):
  - all four spawns are 4-9 m away in plain view, and from round 10 up to 20 zombies can be alive in about 100 m²;
  - a Price Gun needs 14 body hits a zombie at round 10 and 29 at round 20, more than its magazine;
  - **an average human probably ends at round 7-10, because of the room, not their aim. Unfair.**
  - Suggested: an arena-only alive cap (a new key such as `maxAlive: 10` in that arena's entry, and the code to read it), plus the Sharpening
    window the plan already names.
- **Last Showing** (the Cinema, with a loop to circle): **fine to hard but fair.**
- **Lot Full** (the parking lot): **fine, the easiest.** One small catch: the Second Chance window is about 4.2 m from a spawn, just past the
  4 m rule, so zombies can appear right behind you while you hold F there.

**Closing Time:**
- **Keys and the Night Safe: fine.** The Build-A-Blaster step: hard but fair.
- **The Fountain step** (12 kills inside the electrified ring): a human leading a crowd there by hand needs about 3-5 uses at 750 each, when
  points are tight. **Hard and tedious.** The bot teleported to a scripted circle round the basin.
- **The finale: unfair for an average player.**
  - The Last Customer has 16 times a Shopper's health: about 20,000 at round 16 and 27,000 at round 20. She arrives with the full wave
    (44-54 zombies) and 4 Mall Walkers at each of two health marks.
  - For a human with a Platinum Rivet Rifle, she alone is 34-45 seconds of fire, about two full loads. **And there is no ammo source in
    Customer Parking in a normal run.**
  - Emptying her bar isn't the end: you then need a 1.5 s hand stamp inside a 6 s window, in that crowd. Miss it and she comes back at 25%.
  - No one-life bot run ever reached the finale, so nothing shows yet that a human can win.
- Suggested changes:
  - **C1:** a RESTOCK-O-MATIC in Customer Parking for normal runs (a map feature entry with zone `parkingLot`; Lot Full already places one).
  - **C2:** Last Customer `healthMultiplier` 16 → 12 and `backup.count` 4 → 2 (config/bosses.js).
  - **C3:** `recoverHealthFraction` 0.25 → 0.1 and `handReturn.holdSeconds` 1.5 → 1.0.
  - **C4:** freeze her health at round 16's value, so a slower player doesn't get a harder finale (a new key, small code).

**Bosses on normal rounds:**
- Murray (round 5/7), Fairweather and Skylar: fine for a human, 13-26 s of fire.
- Kettle at round 9-11 (7,500-8,700 health, a 10 m/s charge): hard but fair, 26-30 s.

## 8. The big lever: guns or zombies?

Problems 2 and 3 (guns fall off early and the crowd outpaces you) have two possible fixes. I'd **not** do either until G1-G5 and P1 have
been playtested, because more ammo and the warranty fix already help a lot.

| Option | Change | Effect on an average human |
|---|---|---|
| A. A gun pass | +10-15% `damage` on the wall automatics and the Nail Gun (G2 and G3 are already +11-12%) | Measured on the Rivet Rifle at +15% (damage 92): good until round 12 instead of 9 for an average human, and at round 15 kills vs arrivals goes from 0.65 to 0.77. Early rounds get a little easier too |
| B. Slower health growth | economy.js `waves.health.multiplierAfter` 1.075 → 1.065 | No change to round 9. Round 15 health 1,157 → 1,094 (-5%), round 20 1,662 → 1,497 (-10%), round 25 2,386 → 2,051 (-14%), round 30 3,425 → 2,810 (-18%). Late rounds get much more forgiving. Lowers late income a little (fewer +10 hits) |
| C. Both, smaller | +8% gun damage and x1.07 growth | The middle road |

The economy report's own point stands: every buff to a gun lowers income slightly (fewer hits a kill), and every nerf raises it.

**A small survival fix that isn't a number:**
- Today several zombie swings landing in the same moment all count, so three zombies in reach down you instantly.
- A short hit grace would make being cornered survivable long enough to use the Air Horn or sprint: a new key such as
  `feel.health.hitGraceSeconds: 0.4`, checked in player/health.js.
- COD's zombies outrun a backpedal too (the BO3 research measured 2.6 m/s aimed backwards), so I would leave the runner speed alone and
  fix this instead.

## 9. How future balance tools should model a human

1. **One shared human model**, not a bot per tool.
   - A small module (for example tools/humanModel.js) with three profiles, bad, average and good: aim wobble, wobble under pressure, crowd
     jostle, where they aim, recoil they cancel, time to the next target, clicking speed.
   - tools/balance.js gets a `skill` option, and every report prints a **bot column and a human column side by side**, so the old numbers stay
     comparable. The script used for this review (see section 2) is a working first draft of it.
2. **Measure the job, not one zombie.**
   - The headline number for a gun should be "kills against arrivals" at rounds 10, 15, 20, 25 and 30 (section 4).
   - Next to it: ammo used against ammo carried a round, and seconds spent reloading a round.
   - Seconds to kill one still zombie is a footnote.
3. **Tests check roles at human skill.**
   - tests/balance.test.js keeps its role checks (which gun beats which, and where), run under the average profile, plus a few "a human can
     still..." floors.
   - For example: the plain Rivet Rifle kills a round-8 Shopper in under 3 s with the crowd on you; no wall gun needs more than 2 refills a
     round at round 15 with Platinum.
   - The `holdsUntilRound` check in tests/upgrades.test.js should count shots at human accuracy.
4. **Bots that walk and can die tell you about survival; immortal teleporting bots only tell you about income.** Say which one a number came
   from, every time (the economy report already does this well).
5. **Calibrate against real play.**
   - The game already records your accuracy and headshot kills (game/careerStats.js: shotsFired, shotsHit, headshotKills, saved in your
     browser). Note them after a few playtest runs and replace the guessed profiles above with your own numbers.
   - It would also help to record the round you died in, what killed you, and whether you were reloading or empty when hit.
6. **Value prizes and items by what they do for a human**, not by wall price (the claw report) or by a perfect throw (the Kiosk report).

## 10. How sure is this?

- **Sure:**
  - the tools assume perfect aim (I read their code);
  - the warranty handling regression, the wardrobe traps that cross a hit or speed breakpoint, and the missing ammo in the finale (read
    straight from config and code);
  - the ranking of the guns for humans.
- **Fairly sure:** the size of the human gap (45-70% of the bot's output under pressure). It rests on a model with assumed numbers, but every
  assumption errs on the kind side: no early reloads, no getting stuck, no walking.
- **Not measured:**
  - human survival (no human data exists yet);
  - how the slows, burns and chains of builds play for a moving human;
  - bounce and homing guns.
  - A one-hour playtest using careerStats would settle most of the open questions, which agrees with the memory note that bot sims cost more
    than they tell.
