# Claw machine: plan

Status: phases 1 to 7 built (8 November 2026, branch claude/claw-machine; see docs/history.md; phase 4 recommends 1,250 a grab, not applied). Two sites moved from the table below:
Parking's back is x 34.43 (the facade's face) and the Cinema's x -34.1 (clear of the screen door's jamb). A gun bought off the wall between
the roll and the take gets a SPARE attachment rolled with the capsule, so the take adds nothing random. Phases 8 to 10 (the claw-only guns) are not started. The Prize Counter is on the Hallway's north wall at x -13 (it was x 3.65 until the Gold Card rack took that stretch).
Numbers here are starting points, to be tuned by playing. Prices are suggestions only: the economy report
(not written yet: the `economy-sim` branch has no work on it, so `tools/economySim.mjs` and `npm run sim:economy` still need doing) confirms them. Checked against the `build-a-blaster` branch at its phase 2; it is now merged, with all six phases and the Mascot.
This work relies on its `gun.away`, `gun.isLoaner` and `priceLabel`, and touches `createGame.js`, `interactions.js` and `mall.js`.
Build one phase at a time, in its own git worktree, and test before the next.

## The idea

The claw machine is the mystery box, but you work it. In COD you pay and watch. Here you pay, three capsules drop into the glass, and a claw sweeps over them while the zombies keep coming.
You see what's in each capsule and you choose the moment to drop. Everyone has stood at one of these sure they could get the good prize. This one takes your money just the same.

The machine is GRAB-A-GUN ("EVERYONE'S A WINNER*", and the small print says "*Not everyone"). Its plush is Sunny, the Galleria's sun mascot, with one button eye and a stare nobody asked for.

| | COD mystery box | GRAB-A-GUN |
|---|---|---|
| While it runs | You watch a cycling reel | You time the drop, with your gun still in your hands |
| What decides the prize | The roll | The roll offers three, and your timing picks one |
| Your own gun comes up | Removed from the odds | Comes back Refurbished, with a free attachment |
| Time to move on | A hidden roll | The plush is in the pit where you can see it |
| Where it goes next | Announced on the spot | Sunny climbs out and waddles there: follow him, or pop him and it goes somewhere else |
| The jackpot | The Ray Gun and the wonder weapons | Three claw-only guns, one of them a rare wonder weapon |
| A bad spin | Nothing | Prize tickets, spent at the Prize Counter |

## Decided

From the design notes and the brief:
- Pay, get a random gun, and sometimes a plush appears and the machine relocates.
- It's the mystery box equivalent, and it should feel different from COD.
- Every price comes from `g.pricing`.

Added by the user, 8 November 2026:
- **Claw-only guns.** Some guns are never on a wall and only come from the machine, so it has a jackpot: the Leaf Blower, the Tennis Ball Launcher, and a rare wonder weapon.
- **Prize tickets and a Prize Counter.** Every grab prints tickets, and a bad grab prints more. Tickets buy small things at a fixed Prize Counter. A losing grab still moves you forward.
- **Sunny runs away.** When the plush comes up, Sunny climbs out and waddles to the machine's next site, so you can follow him to learn where it's going. Pop him and it goes somewhere else instead.

## Assumed (say if you disagree)

- **You can see the prizes.** Each grab offers three capsules, each named on the machine's screen and the ticket, and your timing picks one. The roll is random, and the choice isn't. This is the
  biggest change from "get a random gun".
- **No menu, no pause and no locked camera.** You keep moving and shooting. The game can't stop for this anyway: the loop has to keep ticking.
- **No hidden dice after you press.** The capsule under the claw when you press is the one you get. It can wobble on the way up, but that's for show.
- **One machine at a time, six possible sites,** starting in the Hallway every run.
- **A plush refunds what you paid.** A sold-out machine doesn't refund, because you got your prize.
- **Guns you carry stay in the odds as Refurbished prizes** (see below).
- **The seven wall guns and three claw-only guns are prizes** (see Claw-only guns). The Staple Gun is left out.
- **Flash Sales and Employee Discount work here. The Discount Code doesn't** (see Boss vouchers).
- **No round gate.** A Heavy Coil Nailer can come up on round 2, if the luck is there. The economy report decides whether that stays.

## The grab

| Step | What happens | Player does |
|---|---|---|
| 1. Pay | Hold interact, suggested price 1,000. Three capsules fall into the pit, one per lane. The screen names all three | Hold to pay |
| 2. Sweep | The claw travels across the lanes and back. The ticket names the lane it's over | Press interact once to drop. Nothing pressed after 6 s: it drops wherever it is |
| 3. Lift | About 1.5 s. The claw lifts the capsule and carries it to the chute | Fight |
| 4. Take | The gun sits in the chute for 15 s. The ticket warns what it replaces | Hold to take, or walk away. No refund if it times out |
| 5. Reset | The machine is ready to pay again, unless it closed | |

**Sweep speed.** A full sweep there and back takes 2.4 s on a site's first grab, 0.2 s less each grab after, down to 1.4 s on the sixth. On the first grab the claw spends about 0.4 s over the middle lane and 0.8 s over
an end lane, because it turns round there. The middle lane is the hard one, and a sold-out site's last grab is the hardest.

**Standing at the machine is the risk.** You must be within interact range and facing it to press. Walk away and it still drops itself on time, so a grab can never hang.

## The odds

Each capsule is drawn by weight from the pool, with no repeats in one grab.

| Gun | Weight | Capsule | Wall price |
|---|---|---|---|
| Price Gun | 26 | Green | 500 |
| Nail Gun | 22 | Green | 1,000 |
| Foam Dart Blaster | 18 | Blue | 1,200 |
| Confetti Cannon | 12 | Blue | 1,500 |
| Rivet Rifle | 12 | Blue | 1,500 |
| Barcode Scanner | 7 | Purple | 1,750 |
| Heavy Coil Nailer | 3 | Gold | 2,500 |
| Leaf Blower | 6 | Purple | claw only |
| Tennis Ball Launcher | 6 | Purple | claw only |
| The wonder weapon | 2 | Rainbow | claw only |

The claw-only guns aren't in config yet (phases 8 to 10), so the numbers below are the seven wall guns only. When they join the pool, re-run
`npm run sim:claw`: the starting weights above put a claw-only gun in about 1 capsule in 8, and the wonder weapon in about 1 in 60.

**`npm run sim:claw`** (tools/clawSim.mjs, the simulation in tools/clawOdds.js; tests/clawSim.test.js guards the rules below). Run on
8 November 2026 at 1,000 a grab: 400,000 grabs per timing, nothing carried, shelf price, the walk between sites free. The player aims
for the lane with the highest wall price and away from the plush. Timing: **perfect**; **3-in-4** (a miss lands on a neighbouring lane,
the old model); **random** lane (mashing, or the auto-drop); **timed**, a press aimed at the middle of the lane's real window with a
0.12 s error, so the middle lane and the 1.4 s late sweeps are harder.

| Won per grab | In the pit | Perfect | 3-in-4 | Random | Timed |
|---|---|---|---|---|---|
| Price Gun | 61.7% | 0.0% | 7.8% | 20.8% | 2.2% |
| Nail Gun | 55.5% | 5.0% | 10.0% | 18.9% | 6.1% |
| Foam Dart Blaster | 48.6% | 16.9% | 16.6% | 16.3% | 16.5% |
| Confetti Cannon | 34.9% | 24.1% | 19.5% | 11.8% | 22.8% |
| Rivet Rifle | 34.8% | 24.1% | 19.5% | 11.9% | 22.7% |
| Barcode Scanner | 21.5% | 20.3% | 15.5% | 7.3% | 19.0% |
| Heavy Coil Nailer | 9.6% | 9.6% | 7.3% | 3.3% | 8.9% |
| Plush (refunded) | | 0.0% | 3.9% | 9.6% | 1.8% |
| Average wall value of a gun won | | 1,571 | 1,431 | 1,168 | 1,535 |
| Grabs per site | | 6.00 | 5.76 | 5.39 | 5.92 |
| Sites closed by the plush | | 0% | 22% | 52% | 11% |
| A site's first grab: Blue or better | | 100% | 84% | 57% | 98% |
| A site's first grab: average wall value | | 1,624 | 1,456 | 1,173 | 1,604 |

**One specific gun** (points of grabs per copy, aiming for it whenever it's in the pit, plush grabs refunded) against the wall (the
cheapest doors from the start room plus the gun). The claw also needs the Hallway (500), included in the last column:

| Gun | Wall route | Claw 3-in-4 | Claw timed | Claw random | Claw perfect + Hallway |
|---|---|---|---|---|---|
| Price Gun | 500 | 2,066 | 1,716 | 4,319 | 2,120 |
| Nail Gun | 1,500 | 2,291 | 1,903 | 4,776 | 2,295 |
| Foam Dart Blaster | 2,450 | 2,625 | 2,185 | 5,517 | 2,575 |
| Confetti Cannon | 3,000 | 3,642 | 3,034 | 7,641 | 3,363 |
| Rivet Rifle | 3,250 | 3,658 | 3,027 | 7,679 | 3,378 |
| Barcode Scanner | 3,000 | 5,900 | 4,891 | 12,427 | 5,117 |
| Heavy Coil Nailer | 5,250 | 13,173 | 10,996 | 27,548 | 10,855 |

**The wall stays the cheaper way to any one gun**, even with perfect timing, but only just for the mid guns: the Rivet Rifle is 1.04x its
wall route at perfect timing, the Foam Dart Blaster 1.05x (the claw's grabs win other guns on the way, which these numbers don't count).

**The early jump is the problem.** After the 500 start shutter, the next 1,000 buys either the Nail Gun off the wall or a grab whose
first prize is Blue or better 84% of the time (98% for a decent timer), worth 1.46x its price in wall value (1.60x timed). At 1,000
the grab is the obvious second purchase, which is the must-buy the plan wanted to avoid.

| Grab price | First grab value / price (3-in-4) | (timed) | Value per point, whole site (3-in-4) | Hallway + one grab | Closest gun, claw perfect / wall |
|---|---|---|---|---|---|
| 1,000 | 1.46 | 1.60 | 1.43 | 1,500 | 1.04 |
| 1,250 | 1.16 | 1.28 | 1.15 | 1,750 | 1.26 |
| 1,500 | 0.97 | 1.07 | 0.95 | 2,000 | 1.47 |
| 1,750 | 0.83 | 0.92 | 0.82 | 2,250 | 1.69 |

**Recommendation: 1,250 a grab, weights unchanged** (not applied: economy.claw.grab is still 1,000, since no rule in this plan is
strictly broken). At 1,250 the first grab still feels like a win (1.16x, 1.28x timed: a gamble should), it takes a round or two more
saving after the start shutter, and every gun stays at least 1.26x cheaper on its wall. Go to 1,500 once prize tickets (phase 6: a free
grab about every 7) and the claw-only guns (phases 8 to 10) add their value; re-run `npm run sim:claw -- 1500` then. The weights do their
job: perfect timing never takes a Price Gun, and the Coil Nailer is in the pit about 1 grab in 10.

## Guns you already own

Dropping your guns from the pool would be the COD answer, and it leaves two-gun late-game players nothing to want. Instead:

| The rolled gun is... | The capsule becomes... | Taking it gives |
|---|---|---|
| Not carried | Normal | The gun, in a free slot, or replacing the gun in your hand |
| Carried, with an empty attachment slot that fits | **Refurbished**: named with its attachment, such as "Nail Gun + Grip Tape" | A full refill of that gun plus that attachment, in hand or not |
| Carried, with nothing that fits | Not offered: it leaves the pool for this grab | |
| Away at Build-A-Blaster | Not offered | |

You see the attachment before you drop, so an unwanted one (some are real trade-offs, like Sawn-Off) is your choice. A Refurbished prize never replaces a fitted attachment. It also counts as owned for the run, so refits are free, like a bought one.
At least four guns always remain in the pool, even with two carried guns full of attachments and a third on the conveyor.

**Things change between the roll and the take,** so the prize is checked again at step 4:
- You bought the rolled gun off the wall meanwhile: it becomes a refill, plus the attachment if a slot is free.
- You no longer carry a Refurbished gun: you get a plain copy of it.
- You handed the rolled gun to Build-A-Blaster: you get a plain copy, and the finished gun replaces that copy later, which `gun.collect` already handles.

## Where the machines go

All six cabinets are always in the map, as dust-sheeted "BACK SOON" machines, and only one is live. Each site passed a headless check on main: a 1.3 x 1.0 x 2.2 m cabinet touches only its wall, the stand point is clear, and a real `interactions` item got focus.

| Site | Zone | Back of cabinet (x, z, floor y) | Faces | Nearest spawn | Clear lane in front | Notes |
|---|---|---|---|---|---|---|
| Hallway | hallway | 8, -2 | +z | 8.0 m | 5.1 m | Starts here. Between the Food Court gate and the Nail Gun |
| Food Court | foodCourt | 8.5, -2.3 | -z | 5.2 m | 11 m | Between the RESTOCK-O-MATIC and Byte Me |
| Mega Mart | megaMart | 28, 6 | -z | 7.9 m | 13 m | Past the checkouts, where a real store keeps one |
| Grand Atrium | atrium | 27, 6.6 | +z | 5.4 m | 6.3 m | South arcade |
| Cinema lobby | cinema | -34, -10.5, y 6.3 | +z | 5.6 m | 15 m | Every cinema has one |
| Customer Parking | parkingLot | 34.5, -8 | +x | 6.8 m | 27 m | Against the Mart's outside wall, abandoned in the sunset |

Tried and rejected: x 15 and x -12 on the Hallway's south wall (a vent spawn within 2.3 m), Mega Mart x 23 (the Atrium link is there), Promenade spots (within 2.5 m of a spawn or the Atrium shutter, or on a bench, and that floor is busy with Build-A-Blaster).
HOFFMAN'S and the Service Corridor get no machine: HOFFMAN'S aisles are tight, and the corridor is 3 m wide.

The cabinets also leave zombies' routes alone. With all six in place and every door open, zombie routes from all 38 spawn points and all six stand points to the hub came out the same: none lost, none more than 3 m longer.

## The relocation rule

- **Each site has 6 grabs of stock.** The screen counts down.
- **A plush may take one lane,** by grab number at this site:

| Grab at this site | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Chance a plush is in the pit | 0% | 0% | 20% | 40% | 60% | 80% |

- **Land on the plush** and Sunny comes up the chute, the machine refunds what you paid, and it closes. At perfect timing you can always dodge it, and a miss or an auto-drop can land on it.
- **Sell out** on grab 6 and the machine closes after you've taken or lost the prize.
- **It reopens at the next 'roundStart'** at a random other site whose zone is open, and the PA names the area. If no other site is open, it restocks where it stands.
  After a plush, the next site is picked the moment Sunny comes up (not at 'roundStart'), so he knows where to walk (see Sunny runs away).
- **It never moves during a grab,** and never into a locked area, so it can always be reached. The one exception is the start: it waits in the Hallway until you own the Hallway.

In the simulation a site lasts 5.8 grabs at 3-in-4 timing, ending by plush 23% of the time and by selling out 77% of the time. With a random lane, it's 5.4 grabs and 52% by plush.
Machines don't go to whichever site the player is far from: a uniform pick is easier to reason about and to test.

Suggested PA lines: "Attention shoppers: GRAB-A-GUN is temporarily out of service. Sunny has been informed." and "GRAB-A-GUN is now in {area}. We don't know how either."

## Claw-only guns

Three guns that are never on a wall. Each one does something no wall gun does, so it's a reason to grab, not just a stronger number.

| Gun | Capsule | What it does | New in the engine |
|---|---|---|---|
| **Leaf Blower** (Garden Centre) | Purple | A wide cone that blows zombies back and knocks them down, with little damage. Crowd control for a corridor or a doorway. Runs on a fuel tank that refills slowly when you stop. | A cone attack with knockback (the Cart Pusher's shove, aimed outward), and a fuel meter instead of a magazine |
| **Tennis Ball Launcher** (Sporting Goods) | Purple | Lobbed balls that bounce off walls and floors and between zombies, each bounce a hit. Best in tight spaces: the Service Corridor, the cinema stairs. | A slow, visible projectile with bounces (the guns are all hitscan today), capped per shot |
| **The wonder weapon** | Rainbow (rare) | The jackpot, a mall joke you can't buy anywhere. Working idea: **RETURN TO SENDER**, a returns-desk scanner whose beam boxes a zombie and "returns it to the manufacturer": an instant kill for normal zombies, heavy damage to Mascots and bosses, which it can't return. Small magazine, slow reload. | An instant-kill rule with a boss and Mascot exception, in gunStats.js |

- **Each is a normal gun** in `config/weapons.js` with `clawOnly: true`, so wall buys, the Customer Service tiers and Build-A-Blaster treat it like any other. A wall-buy feature must refuse a `clawOnly` gun (test it).
- **A stuffed wonder weapon** is the late-game peak. Its Build-A-Blaster effects need their own balance rows, and `tests/balance.test.js` must show it is the strongest gun without making rounds 25+ trivial (zombie health is about 2,400 at round 25 and 3,400 at round 30).
- **Ammo:** claw guns refill at a RESTOCK-O-MATIC like any gun, and from a Refurbished grab. The wonder weapon refills at half the rate (config), so it stays special.
- **One at a time,** each with `npm run balance` before it joins the pool: Leaf Blower, then the Tennis Ball Launcher, then the wonder weapon.

## Prize tickets and the Prize Counter

Every grab prints arcade tickets from a slot on the cabinet, and a bad grab prints more. Tickets are a second, small currency for the run.

| Outcome | Tickets |
|---|---|
| Green capsule (Price Gun, Nail Gun) | 40 |
| Blue capsule | 25 |
| Purple capsule | 15 |
| Gold or Rainbow capsule | 5 |
| Plush (the money comes back) | 10 |
| A prize left in the chute until it timed out | 0 |

The **Prize Counter** is one fixed booth ("REDEMPTION", with a bored teenage animatronic behind the glass). It never moves. Its site is picked in phase 6 with the same headless checks the cabinet sites passed (clear stand point, no spawn within 5 m, routes unchanged): the Hallway near the first machine, or the Atrium's arcade. Starting prices:

| Prize | Tickets | What it does |
|---|---|---|
| Ammo refill (the gun in hand) | 60 | A full refill, like a RESTOCK-O-MATIC |
| Slow Claw | 100 | Your next grab's sweep runs slowly |
| Attachment voucher | 150 | A random attachment that fits the gun in hand, free (the attachment counter's checks apply) |
| Free grab token | 200 | Your next grab costs nothing |
| Sunny plush keychain | 300 | A Wardrobe accessory once the Wardrobe exists; until then a joke item for the results receipt |

- At these numbers a player earns a free grab about every 7 grabs and something small every 2 or 3. The economy report checks it.
- **Tickets are not points.** They don't go through `g.pricing` (Flash Sales and vouchers don't touch them), aren't paid on 'kill', and never count as income on the results screen. They are lost on death and reset on Play again. Career stats can count "tickets won".
- **The HUD** shows the ticket count beside the points, only once you have some.

## Sunny runs away

The plush is Sunny, the Galleria's sun mascot. When a grab lands on him, he doesn't just sit in the chute:

1. The machine refunds what you paid and closes, as before. **The next site is picked now**, among the other sites whose zone is open.
2. Sunny climbs out of the chute, looks around, and **waddles to that site** along the zombies' navigation, at walking pace (config, about 2 m/s). Anyone who follows him knows where the machine is going before the PA says so.
3. When he arrives he climbs into the dust-sheeted cabinet, and it shakes once. The machine still opens at the next 'roundStart' as before, and the PA still names the area.
4. **Shoot or slash him** and he pops in a puff of stuffing and confetti. That pays a small ticket bonus (25) and re-picks the next site at random (it can't be the one he was walking to, if another is open). Then you won't know where it's going until the PA.

- **He is not a zombie.** No kill event, no points, no +10 for hitting him, and no power-up credit. Zombies ignore him and he walks through them. He has no collider, so the player walks through him too.
- **If the round starts before he arrives,** the machine opens anyway and he finishes his walk and climbs in. If no other site is open, he walks a lap around the machine and climbs back in.
- **He's only for a plush,** never for a sold-out close: then the machine just closes, as before.

## How it fits the code

### Constraints checked

- **A timed press can't use the normal hold.** Buying takes `feel.interact.holdSeconds`, 0.25 s, which is more than half of the 0.4 s the claw spends over the middle lane. So `interactions.js` needs an `instant` item: it fires on the press, with no hold.
- **Controller X is both interact and reload.** Near a buyable, a press is hidden from the gun and becomes a reload on release unless something was bought. An instant item must set `sharedUsed`, or dropping the claw on a controller also starts a reload.
- **The press must be a fresh one.** `armed` already needs a new press, so holding on after paying can't drop the claw by accident.
- **A price category needs a real price id.** `main.js` calls `pricing.basePriceOf(prompt.kind, ...)` every frame for kinds in `PRICE_CATEGORIES`, and it throws on an unknown id. So only the pay item uses `kind: 'claw'` with `id: 'grab'`. The drop and take steps use `kind: 'clawAction'`, like the ritual's `kind: 'ritual'`.
- **A refund must be what was charged.** With a 50% sale, refunding the shelf price pays out double. `tryBuy` works out the cost but doesn't pass it on, so it needs to call `item.use(purchase)`. Other items ignore the argument.
- **A refund isn't income.** `wallet.earn` adds to `totalEarned` and `wallet.spend` adds to `totalSpent`, so a refund through `earn` inflates the results screen and the career stats on both sides. `wallet.js` needs `refund(amount)`.
- **Moving a collider means rebuilding navigation.** The shared nav grid rebuilds when a shutter moves, and zombies then need new routes. So no cabinet ever moves: six fixed colliders, and only lights, screen and parts change.
- **A cabinet must be at least 2.1 m tall.** It's standable otherwise: a jump from a 0.95 m counter peaks at 2.01 m. 2.2 m with one solid collider, like the RESTOCK-O-MATIC's 2.35 m.
- **Gun displays are heavy.** `buildWeaponDisplay` gives 25 to 52 meshes per gun, so three at once adds up to about 150 draw calls per machine. Capsules are plain spheres in the rarity colour, and only the won gun gets a display, in the chute. Build-A-Blaster's `hideGun` shows the disposal to copy.
- **The Staple Gun can't be a prize.** `playerGun.js` on `build-a-blaster` relies on "the starting gun can't be bought again, so a loaner and a bought copy never meet". Giving it out would break that.
- **`gun.owns` misses a gun on the conveyor.** It only checks the slots, so the pool must also skip `gun.away`.
- **Replacing a gun loses its mods.** `give()` drops the old slot, with its tier, attachments and build. The take ticket must name them ("Replaces your Platinum Rivet Rifle"). Build-A-Blaster's `collectReplaces` is the same idea.
- **`give()` wants the base gun.** Pass `weapons[id]`. It's already safe if you own the gun (it refills), and it works with the loaner: `build-a-blaster` tests purchases mid-ritual.
- **Attachments have the same safety checks.** `setMods` cancels a reload or burst, so the attachment counter refuses during a switch, reload, burst or charge. A Refurbished take uses the same checks. A plain gun doesn't need them, because `give()` cancels those itself.
- **Features freeze when they should.** `features.update` doesn't run while paused or dead, so a grab stops with the game, and death can't pay anyone. `features.reset()` runs after the map step and only needs to clear the machine's own state.
- **Clutter only knows `feature.position`.** `hallwayClear` keeps scatter 2 m from each feature's one position, so the five other sites need their own entries in that list.
- **`createGame` doesn't need to know much.** The feature context already holds everything needed except PA playback: 'clawClosed' and 'clawMoved' join the ritual's PA event list, which is one line.

- **Sunny must be shootable without being a target for anything else.** Shots and melee find targets in `shootables`, but createGame also hands that list to aim assist
  and to the vault as bodies. So Sunny needs flags both skip (no aim slowdown towards him, no blocking a vault), and the 'hit' listener must pay its +10 only for zombies.
- **Sunny walks the zombies' grid:** `navigation.pathTo` (the Influencer uses it), only through open zones, so he can always arrive. One small model, one mover, no collider.
- **Tickets are their own currency:** not the wallet, not pricing. A small `game/tickets.js` with a reset step, events 'ticketsWon' `{ amount, total, reason }` and 'prizeRedeemed' `{ id }`.
- **The Prize Counter is a feature kind** ('prizeCounter'), one entry in `map.features`, using the normal hold-to-buy with its own cost label ("100 tickets"), not `kind: 'claw'`.
- **New guns need engine work** (see Claw-only guns): a cone attack and a fuel meter, a bouncing projectile, and an instant-kill rule with exceptions. Each is its own small system, tested alone first.

### What needs to change

- **New `config/clawMachine.js`:** weights, plush chances, stock, timings, PA lines. Prices go in `economy.claw`, as `{ grab: 1000 }`.
- **`game/pricing.js`:** a `claw` category. `economy.flashSales.groups` gets a 'claw' group. If the machine is closed the sale is just wasted for a moment, so it needs no eligibility line.
- **`game/interactions.js`:** `instant`, and `use(purchase)`.
- **`game/wallet.js`:** `refund(amount)`, lowering `totalSpent`.
- **`game/features/attachmentCounter.js`:** export a small `unlockAttachment(gun, id)`, because its run inventory is private.
- **New `game/features/clawMachine.js`:** states idle, sweeping, lifting, ready, closed. One feature entry with a `sites` list, and one registry line. A pure `rollCapsules(pool, plushChance, random)` so odds can be tested.
- **New `maps/mall/clawCabinet.js`:** follows `restockMachine.js`, returning `{ position, normal, screen, rig }`. Moving parts are `userData.dynamic`. One rig per site stays inside its culling room, with only the live one shown.
- **`maps/mall/mall.js`:** six cabinets, one feature entry and the clutter list. No new area, door, spawn or light.
- **New events** (listed in `events.js`): 'clawGrab' `{ capsules }`, 'clawPrize' `{ gunId, refurbished }`, 'clawClosed' `{ reason, pa }`, 'clawMoved' `{ siteId, pa }`.
- **`main.js`:** a small HUD note with the machine's area while it's open, read from `.status`.
- **`tests/helpers/headlessGame.js`:** `snapshot` includes the machine's state.

### Ideas that changed

| Idea | Problem | What replaced it |
|---|---|---|
| A real joystick, steering the claw | Takes over movement input while zombies attack, and needs a locked view and a new input mode | One press, on timing |
| Weak grip: a capsule can slip on a bad press | A hidden roll after a good press feels like a cheat, and the skill stops meaning anything | The wobble stays as a visual gag. The outcome is settled at the press |
| Wheeling the machine away while you watch | Moving a collider rebuilds navigation | Fixed cabinets, with the live one switching |
| Three guns on show in the glass | Up to 150 extra draw calls | Coloured capsules, named on the screen and ticket. The won gun appears in the chute |
| Staple Gun as the joke prize | Breaks the Courtesy Loaner's rule | Price Gun is the low prize |
| A hidden plush, as in COD | With lanes on show, a surprise would feel random, and the machine couldn't show its own wear | The plush is visible, and stock forces a move anyway |
| Plush chance rising forever | A good player dodges it and the machine never moves | Six grabs of stock |
| Random starting site | `tests/fullRun.test.js` compares a reset game to a fresh one, and a closed-off start would hide the machine for half a run | Always the Hallway, then random |
| New claw-only guns from the design notes | Each needs a model, viewmodel, sounds and a balance role | Kept out at first, then added by the user (8 November): three of them, after the machine works, one at a time |
| Bumping the cabinet to nudge the claw (TILT if you overdo it) | A second input during the sweep makes the timing design riskier | Not now. Maybe later, if timing alone feels thin |

## Working with other systems

### Build-A-Blaster

- Claw guns are ordinary guns with no mods, so they can be stuffed, and a Refurbished attachment stacks with a build, because `withAttachment` leaves other mods alone.
- Using the machine during a ritual is fine: you're fighting with your other gun anyway. The away gun isn't offered, and the loaner can't take a Refurbished prize.
- Taking a prize with the loaner in hand fills the free slot, as a wall buy does, and the loaner still goes back at collection.
- No cabinet is in the workshop room, and the claw adds no zombies, so the Returns Chute's budget is untouched.

### Boss vouchers

- **Discount Code: doesn't apply to the claw.** It's a 2,000-point reward. Spending it on a 1,000 grab saves 500 at most, and a plush would refund the payment but not the voucher. When the voucher slot is built (boss plan, phase 2), it needs an excluded category list with 'claw' in it, and the listener that spends it must skip that kind.
  **This changes a line in the boss plan:** "50% off your next purchase" becomes "your next purchase, except the claw". The boss plan hasn't been edited.
- **Employee Discount and Flash Sales apply,** and a plush refunds the reduced price. An Employee Discount is spent even if the plush comes up, because it's small and short-lived.
- **Master Key and Signed Approval:** no interaction. The claw isn't an area or a tier.
- **Free steps** (drop and take) cost 0, so they can't spend any discount.
- **Boss rounds:** a Security Guard lockdown can shut you in with or away from the machine. That's fine, because it never needs you to return: the sweep drops itself, and a prize times out. No boss touches the machine.

### Wardrobe

No dependency either way. Aviators and Hi-Vis change nothing in the grab. Later, the first plush of a run could give a free Plush Keychain accessory, which would need both systems finished.

## Phases

### 1. The machine, plain (Opus or Sol)
`rollCapsules`, the state machine, `instant`, `use(purchase)`, `wallet.refund`, the pricing category, and a single cabinet in the Hallway as blocks. Normal prizes only, with no plush yet.
Done when: a grab works through real input on keyboard and controller, can't hang, and death, Play again and walking away all leave nothing behind.

### 2. Plush and relocation (Opus or Sol)
All six cabinets, stock, plush, refund, closed state, 'roundStart' move, PA lines, debug commands to force a plush and to move the machine.
Done when: the machine only ever opens in an open zone, a plush can't pay out more than was charged, and every site works in the coplanar and navigation tests.

### 3. Refurbished prizes (Sonnet or Luna)
Carried guns in the pool, the re-check at take time, `unlockAttachment`, and the Build-A-Blaster cases.
Done when: each row of the Guns You Already Own table and each late change has a test.

### 4. Sales and odds (Sonnet or Luna)
The Flash Sale group, the voucher exclusion (if the boss work is in), and a claw step for the bot in `tools/economySim.mjs`. Run the economy report, then set the price and weights.
Done when: the report shows the early jump isn't a must-buy, and the wall is still the cheaper way to a specific gun.

### 5. Spectacle (Sonnet or Luna)
The finished cabinet, claw and chute, capsule wobble, Sunny, jingle and sweep sounds, a hum from the live machine, and a humour pass. Keep the machine unlit and flicker-free, like the RESTOCK-O-MATIC.

### 6. Prize tickets and the Prize Counter (Sonnet or Luna)
`game/tickets.js`, tickets from every grab, the counter's site check and booth, the five prizes, the HUD count, the reset step.
Done when: every outcome pays its tickets, every prize works and can't be bought without enough tickets, and tickets never touch points, pricing or the results income.

### 7. Sunny runs away (Opus or Sol)
Picking the next site at the plush, Sunny's model and walk, arriving and climbing in, popping him (bonus and re-pick), and the shootable flags.
Done when: he always arrives (or loops when no site is open), popping him re-picks, and he never pays a kill, a +10 or power-up credit, never pulls aim assist and never blocks a vault.

### 8. The Leaf Blower (Opus or Sol for the cone and fuel; Sonnet or Luna for the model and sounds)
### 9. The Tennis Ball Launcher (Opus or Sol for the bouncing projectile)
### 10. The wonder weapon (Opus or Sol)
Each: the engine piece alone first, then the gun, its balance row, `npm run balance`, and only then into the pool.
Done when: `tests/balance.test.js` shows each one's job, no wall sells it, and the wonder weapon is the strongest gun without trivialising rounds 25+.

### Later
- **Plush Keychain** in the Wardrobe (it's already a Prize Counter prize), and "Plush toys won" on the results receipt.
- **Bumping the cabinet** to nudge the claw, with TILT if you overdo it.
- **A round gate on rare guns,** with an optional `fromRound` per gun, if the report asks for it.

## Tests to add

`tests/clawMachine.test.js`, using `headlessGame()`. Build the map before seeding `Math.random`.
- Odds: `rollCapsules` matches the weights, never repeats a gun in one grab, and never offers the Staple Gun or a gun on the conveyor.
- Grab: the capsule under the claw at the press is the prize, an unpressed sweep drops by itself, and the press can't come from a held button.
- Controller: dropping the claw with X doesn't start a reload.
- Payment: a Flash Sale, Employee Discount and a plush refund all charge and return the same number, and `totalSpent` ends unchanged after a refund.
- Relocation: every 'roundStart' after a close opens a different open-zone site if there is one, a site's stock and plush chances reset, and a sold-out machine closes only after its prize is gone.
- Owned guns: every Refurbished rule, and every change between the roll and the take.
- Build-A-Blaster: the machine works during each ritual phase and with the loaner in hand, and a gun taken during a ritual doesn't break collection.
- Cabinets: each is at least 2.1 m tall with one collider, navigation stays connected, and the coplanar test covers each site.
- Reset: Play again equals a fresh game (`tests/fullRun.test.js`), and the display in the chute is removed and disposed of.
- Tickets: each outcome pays its amount; each prize works, costs its tickets and refuses without enough; tickets are lost on death and reset on Play again; points, pricing and the results income never move.
- Sunny: the next site is picked at the plush; he reaches it from every site (or loops when none is open); popping him pays 25 tickets and re-picks; no kill, +10 or power-up credit; aim assist and the vault ignore him.
- Claw-only guns: no wall buy sells one; each has a balance row; the wonder weapon's instant kill skips bosses and Mascots.

## Rules to keep

- Update `docs/map.md`, `docs/folder-structure.md`, `docs/tests.md` and `docs/history.md` with each phase. Change `CLAUDE.md` only for rules.
- Run `npm test` and `npm run build` before every commit. Run `npm run balance` before adding any gun to the pool.
- Prices through `g.pricing`, with `kind: 'claw'` only on the pay step. Numbers in `config/`.
- The machine is a feature in `game/features/`, DOM-free, and it talks through `g.events`.
- No cabinet moves and no collider is added or removed at runtime.
- Nothing after the press may change the prize.
- Every new runtime object is cleaned up by `reset()`, and the steps stay in the resetSteps order.
