# Wardrobe: plan

Status: outline, nothing built yet. Numbers here are starting points, to be tuned by playing. Prices are suggestions only: the economy report
(`npm run sim:economy`, which is still in the `economy-sim` worktree and not yet on main) confirms them. Checked against main at 738e7f5 and the `build-a-blaster` branch at 37f99d5 (its phase 2).
Start only after `build-a-blaster` is merged: this work touches `createGame.js`, `events.js` and `main.js`, which that branch has also changed, and it
reuses the branch's free-action prompt (`priceLabel`). Build one phase at a time, in its own git worktree, and test before the next.

## The idea

Wardrobe is the perk system, but every item is a trade, not a buff. You don't collect upgrades, you dress for how you play. A Cardigan keeps you alive and leaves
you out of breath. A Hi-Vis Vest makes you quick with your hands and easy to find. The mall sells you an outfit, and the outfit says who you were when the zombies got you.

| Slot | Items | Theme |
|---|---|---|
| Head | Paper Hat, Mirrored Aviators, 3D Glasses | Recovery and aiming |
| Torso | Cardigan, Sandwich Board, Hi-Vis Vest | Survival and hands |
| Feet | Light-Up Sneakers, Orthopedic Mall Walkers, Wheelie Sneakers | Movement |
| Accessory | Fanny Pack, Foam Finger, Galleria Gold Card | Ammo, melee and points |

## Decided

From the design notes and the brief:
- Four slots: head, torso, feet, accessory. One item per slot.
- Each item has a small upside and a small downside.
- Items are bought once and swapped free at fitting rooms.
- Every effect goes through the single stats object (`player/stats.js`). No item has its own logic.
- Every price comes from `g.pricing`. A new run starts with nothing, because `resetPlayerStats` already clears everything.

## Assumed (say if you disagree)

- **Buying an item puts it on at once.** The item it replaces goes in your bag. Paying 2,500 and seeing nothing change would feel broken, and the fitting room then
  has a clear job: changing back.
- **A fitting room is one button with no menu.** Hold interact at the mirror and you put on the next item from your bag, with the old one going to the back of the bag.
  The ticket says what you're about to wear before you commit. This works on a controller, needs no new screen and keeps the game running.
- **You can't leave a slot empty.** Once something is in a slot, you can swap it but not remove it.
- **Three fitting rooms:** HOFFMAN'S, Shoe-Per Sale and the staff lockers. Standing still in a dead end is the cost of a free swap, so swaps add no other delay.
- **Twelve items, three per slot.** Nothing is sold in the Parking lot or the Promenade's main floor.
- **Flash Sales, Employee Discount and the Discount Code all work on the Wardrobe.** The Master Key and Signed Approval don't apply.
- **No hit-point healing from swaps.** Putting on the Cardigan raises your maximum, not your current health. Regeneration fills the gap.

## The items

Stat changes are multipliers on the player's stats. `(new)` marks a stat that doesn't exist yet.

### Head

| Item | Sold at | Upside | Downside | Ticket line | Suggested price |
|---|---|---|---|---|---|
| Burger Barn Paper Hat | Burger Barn counter, Food Court | `regenDelay` x0.8 (2.5 s to 2 s) | `reloadSpeed` x0.92 | "You smell like a shift you survived." | 750 |
| Mirrored Aviators | SHADE SHACK kiosk, Atrium | `adsTimeMultiplier` x0.8 (new) | `switchSpeed` x0.85 | "Too cool to hurry." | 1,250 |
| 3D Glasses | Concessions, Cinema lobby | `headshotDamageMultiplier` x1.1 (new) | `adsMoveSpeed` x0.85 | "The floor is closer than it appears." | 1,500 |

### Torso

| Item | Sold at | Upside | Downside | Ticket line | Suggested price |
|---|---|---|---|---|---|
| Hoffman's Heirloom Cardigan | KNITS rack, HOFFMAN'S | `maxHealth` x1.25 (100 to 125) | `sprintDuration` x0.8 (4 s to 3.2 s) | "Some are still warm." | 2,500 |
| EVERYTHING MUST GO Sandwich Board | Checkout end, Mega Mart | `damageTakenMultiplier` x0.9 (new), `knockbackMultiplier` x0.5 (new) | `strafeSpeed` x0.85 | "Covers the front and back. The sides are your problem." | 1,500 |
| Hi-Vis Vest | Staff lockers, Service Corridor | `reloadSpeed` x1.15 | `damageTakenMultiplier` x1.1 (new) | "Nobody questions a vest. Everybody can see one." | 1,250 |

### Feet

| Item | Sold at | Upside | Downside | Ticket line | Suggested price |
|---|---|---|---|---|---|
| Light-Up Sneakers | Shoe-Per Sale, west wall | `sprintSpeed` x1.08 (8 to 8.64 m/s) | `sprintDuration` x0.85 | "Every step says you're here." | 1,250 |
| Orthopedic Mall Walkers | Shoe-Per Sale, east wall | `sprintDuration` x1.35, `sprintRefillDelay` x0.7 | `sprintSpeed` x0.95 | "Recommended by the people chasing you." | 1,000 |
| Wheelie Sneakers | Good Sports, Food Court | `slideSpeed` x1.15, `slideCooldown` x0.7 | `backpedalSpeed` x0.85 | "Stopping sold separately." | 1,000 |

### Accessory

| Item | Sold at | Upside | Downside | Ticket line | Suggested price |
|---|---|---|---|---|---|
| Fanny Pack | Outdoor aisle end, Mega Mart | `reserveMultiplier` x1.25 (new) | `switchSpeed` x0.9 | "Fashion's last line of defence." | 1,500 |
| Giant Foam Finger | Good Sports, Food Court | `meleeDamageMultiplier` x1.5 | `reloadSpeed` x0.9 | "You're number one. Your hand is unavailable." | 750 |
| Galleria Gold Card | Customer Service, Hallway | `killPayMultiplier` x1.1 (new) | `regenDelay` x1.2 | "Earn points. Lose sleep." | 2,000 |

All twelve total 16,250. The cheapest full outfit is 3,750 and the dearest is 7,250. For scale, the nine areas cost 9,500 and a Deluxe warranty costs 2,000.

### Why these numbers

| Limit from the game | What it means for the items |
|---|---|
| A Shopper hits for 40, and `maxHealth` is 100: 3 hits | The Cardigan's 125 is the only item that changes a hit count (Shopper 4 hits, Cart charge 3). That's why it's the dearest torso. |
| Hi-Vis x1.1 is 44 a hit, Sandwich Board x0.9 is 36 | Neither changes a full-health hit count. They only matter when regeneration is racing the next hit, which keeps them small. |
| Mall Walkers move at 5.4 m/s, "faster than your walk" | No item raises `walkSpeed`. Even x1.08 ties them, and x1.1 ends their threat. |
| A Cart charge is 9 m/s, faster than your sprint | Sprint stays below 9 on wardrobe alone. Light-Up Sneakers reach 8.64. (Overtime Approved already passes 9, and it's temporary.) |
| Slide starts at 10.5 m/s | Wheelie Sneakers reach 12.1 m/s, or 0.2 m a tick, well under the 0.35 m player radius. No tunnelling risk. |

Worst stacks, all from one item per slot: `reloadSpeed` runs from 0.83 (Paper Hat and Foam Finger) to 1.15, or 1.84 during Express Checkout. `sprintDuration` runs from 2.72 s
(Cardigan and Light-Ups) to 5.4 s. All stay playable.

## Where it's sold and where you change

Every spot was tested in a headless run of the real game on main: the fixture fits, the stand point is clear, and a real `interactions` item got focus from the stand point.
Exact positions are fixed in phase 2.

| Fixture | Zone | Spot (x, z, floor y) | Faces | Notes from the check |
|---|---|---|---|---|
| Paper Hat | foodCourt | -5.75, -13 | +z | Burger Barn's 1.2 m counter front |
| Aviators | atrium | 26.5, 14.5 | -x | SHADE SHACK's west face. The south face is blocked by a planter; the east lane is only 2.9 m |
| 3D Glasses | cinema | -40.9, 0.5, y 6.3 | +x | Concessions front |
| Cardigan | departmentStore | -12.6, 17.6 | -z | The KNITS rack. Lane 1.7 m, tight but it's a rack aisle |
| Sandwich Board | megaMart | 24.4, 3.5 | -x | Checkout end, 2.8 m from the Atrium link shutter |
| Hi-Vis Vest | serviceCorridor | -23.3, -8 | +x | West wall, near the lockers and 1 m from a vent spawn, which stays shut while you're within 4 m |
| Light-Up Sneakers | upstairs | -10, 8.5, y 6.3 | +x | Lane 5.9 m |
| Orthopedic Mall Walkers | upstairs | -4, 8.5, y 6.3 | -x | Lane 5.9 m |
| Wheelie Sneakers | foodCourt | -9, -16.4 | -x | Keep at least 1.2 m from the Foam Finger: focus goes to the nearest item, not the one you look at |
| Giant Foam Finger | foodCourt | -9, -15 | -x | Same wall |
| Fanny Pack | megaMart | 23.9, -4 | -x | Lane 3.5 m |
| Gold Card | hallway | 4.7, 5.1 | -z | Side of the Customer Service booth. 2.3 m from the warranty prompt, so the two don't fight |

| Fitting room | Zone | Spot (x, z, floor y) | Notes from the check |
|---|---|---|---|
| HOFFMAN'S open booth | departmentStore | -17.1, 23.6 | The booths are one solid block, so you stand at the mirror on its front face. It's also a zombie spawn, 0.3 m from where you stand, but `minSpawnDistance` (4 m) keeps it shut while you're there |
| Shoe-Per Sale | upstairs | -7, 10.73, y 6.3 | North cabinet front |
| Staff lockers | serviceCorridor | -22.85, -10 | Lockers are 1.9 m tall. Lane 2.5 m, the riskiest of the three, and the cheapest to reach |

First tries on the Good Sports west wall, the Shoe-Per Sale north wall and SHADE SHACK's south face failed (a shelf, a cabinet and a planter). The positions above are the ones that passed.

## How it fits the code

### Constraints checked

- **The stats object is the right home, and most of it is live.** `walkSpeed`, `sprintSpeed`, the slide, sprint, regen, reload, switch and melee stats are all read every use, so changing them mid-run works.
- **Incentives multiply and divide the same stats.** `incentiveEffects.js` does `stats[key] *= factor` and later `/= factor` on `reloadSpeed`, `switchSpeed`, `walkSpeed`, `sprintSpeed` and
  `meleeDamageMultiplier`. So the Wardrobe must do exactly the same. Setting a stat from its base value is wrong: tested, wearing the Hi-Vis Vest during Express Checkout that way
  leaves `reloadSpeed` at 0.72 instead of 1.15 once the incentive ends. Multiplying gives 1.15. **Every wardrobe effect is a factor above 0, applied with `*=` and removed with `/=`.**
- **Lowering two stats needs a clamp.** Tested on main: dropping `maxHealth` to 80 at full health gives a health fraction of 1.25, and dropping `sprintDuration` with a full meter gives a sprint
  fraction of 1.25. Nothing corrects these for the HUD. After any change the Wardrobe does `stats.health = min(health, maxHealth)` and `player.sprintMeter = min(meter, sprintDuration)`.
- **Reset order is a trap.** `features.reset()` runs after `resetPlayerStats`. A feature that "took off" items on reset would divide stats that are already back to base and corrupt the new run.
  So the Wardrobe is a system built in `createGame`, its `reset()` only clears its lists and never touches stats, and its step sits straight after 'powerUps', before 'stats'.
- **New stats must be declared** in `createPlayerStats()`, or `resetPlayerStats` deletes them. Default 1.
- **Test doubles use partial stats.** `tools/balance.js` passes `{ damageMultiplier: 1 }`, many tests build `new Weapon(def, { reloadSpeed: 1 })`, and `tests/aim.test.js` gives the player only `walkSpeed`. New reads use `?? 1`,
  as `stats.switchSpeed ?? 1` already does.
- **A `kind` that's a price category must have a real price id.** `main.js` calls `pricing.basePriceOf(prompt.kind, ...)` every frame for any prompt whose kind is in `PRICE_CATEGORIES`, and it throws on an unknown id.
  So a rack uses `kind: 'wardrobe'` with the item id, and a fitting room must not: it uses `kind: 'fittingRoom'`, like the ritual's `kind: 'ritual'`.
- **Free actions already exist.** Attachment refits cost 0 on main, and `build-a-blaster` adds `priceLabel: 'Free'`. A cost of 0 doesn't end Employee Discount, because that listener checks `cost > 0`.
- **Discounts need one line each.** `purchase` events end Employee Discount for any kind in `PRICE_CATEGORIES`, so a new 'wardrobe' category joins that automatically. The HUD's sale marker works the same way.
- **Clutter avoids `map.features` positions.** The hallway and Food Court scatter keeps 2 m from each feature, so new fixtures get clear floor without extra work.

### New stats

| Stat | Default | Read in | Used by |
|---|---|---|---|
| `damageTakenMultiplier` | 1 | `player/health.js` `takeDamage`. Every zombie, cart and boss hit arrives through 'playerHit', so one line covers them all | Sandwich Board, Hi-Vis Vest |
| `knockbackMultiplier` | 1 | The 'playerHit' listener in `createGame.js` | Sandwich Board |
| `headshotDamageMultiplier` | 1 | `weapons/gunStats.js` `hitDamage`, the one place gun damage is combined | 3D Glasses |
| `adsTimeMultiplier` | 1 | `weapons/aim.js`, which already reads `player.stats` | Aviators |
| `killPayMultiplier` | 1 | The 'kill' listener in `createGame.js`, multiplied into `killMultiplier`. `pointsForHit` doesn't round today, so it needs to round the kill value to the nearest 10: 60 becomes 70 and 130 becomes 140 | Gold Card |
| `reserveMultiplier` | 1 | A new `Weapon.reserveCap` getter replaces `def.startingReserve` in `weapon.js` (5 places), `powerUps.js` and Mystery Shopper in `incentiveEffects.js` | Fanny Pack |

The existing rule "a reserve above the cap is never cut" means taking off the Fanny Pack keeps your extra ammo. That's small, and it needs a trip to a fitting room, so it stays.

### What needs to change

- **New `config/wardrobe.js`:** slots, items and their factors, ticket lines, fixture ids. Prices go in `economy.wardrobe`.
- **New `game/wardrobe.js`** (built in `createGame`, DOM-free, `g.wardrobe`): owned, worn and bag state, `buy(id)`, `wearNext()`, the clamps, `status` for the HUD, and `reset()`. It's the only code that changes stats for clothes.
- **`game/pricing.js`:** a `wardrobe` category. `game/flashSales` needs no change: a new group in `economy.flashSales.groups`, plus one eligibility line in `createGame`.
- **New feature kinds `wardrobeRack` and `fittingRoom`**, with one registry line each and entries in `map.features`. `createGame` adds `wardrobe` to the feature context.
- **New event:** 'wardrobeChange' `{ slot, worn, removed }`. The HUD strip and PA lines listen. Listed in `events.js`.
- **`main.js`:** reads `g.wardrobe.status` for a small four-slot strip on the HUD, the same way it reads the ritual's `status`.
- **`tests/helpers/headlessGame.js`:** `snapshot` includes the wardrobe, so `tests/fullRun.test.js` proves Play again clears it.

### Ideas that didn't fit

| Idea | Problem | What replaced it |
|---|---|---|
| Moon Shoes (higher jump) | The map's rule is that anything standable is under 1.1 m or at least 2.1 m tall. At jump x1.05 a counter-top jump peaks at 2.11 m, past that limit. `vaultMaxHeight` has the same problem | Items never raise `jumpVelocity` or `vaultMaxHeight`. A test enforces it. Feet items change sprint and slide instead |
| Faster walking | Ties or beats the Mall Walker at x1.08 | Sprint and slide items |
| Extra magazine | Magazine size lives in the gun (`def`, layer 2 in `gunStats.js`) and is fixed per slot. It's a mod, not a player stat | The Fanny Pack changes the reserve cap, which can be read live |
| Mascot Head disguise (zombies ignore you) | There's no aggro or noise system. Every zombie always chases the player | Dropped. Revisit if bosses or Glitter add targeting |
| Flat gun damage up | `stats.damageMultiplier` only reaches `hitDamage`, so it skips Party Trap, Clearance Rack, Inventory Liquidation and Build-A-Blaster stuffings. It would also compete with tiers | 3D Glasses raise headshots only, which rewards aim and stays in `hitDamage` |
| Items with triggered effects ("every 10th kill...") | Needs listeners per item, which breaks "everything through the stats object" | Left for Later. All twelve are plain numbers |
| Walk-in changing booths | The HOFFMAN'S booths are one solid block 2.4 m deep | You change at the mirror on the front face |
| A menu of four hooks, one per slot | Focus goes to the nearest item, and a booth has no room to step between four hooks | One mirror, one button |

## Working with other systems

### Build-A-Blaster

No conflict. Wardrobe stats are player stats, so they follow you whichever gun you carry, including the Courtesy Loaner. A gun on the conveyor keeps its own ammo state, and `reserveCap` is read when it comes back.
Foam Finger kills count in the Stuffing Tank, because the ritual listens for 'kill'. Stuffings and Party Trap don't use the 3D Glasses bonus, which is by design: `headshotDamageMultiplier` applies to gun hits only.
Don't place racks in the workshop room: the plan reserves that space for the ritual.

### Boss vouchers

The voucher slot isn't built yet (boss plan, phase 2). When it is:
- **Discount Code:** works on Wardrobe prices with no extra code, because racks use `priceOf('wardrobe', id)`. It's cleared by the 'purchase' event, and a free swap can't burn it because the cost is 0.
- **Master Key and Signed Approval:** area and tier only. No interaction.
- **Boss attacks:** all reach `health.takeDamage` through 'playerHit', so the Sandwich Board and Hi-Vis Vest apply. The Manager's +25% zombie damage stacks with them.
- **Janitor wet floor and Guard taser slows:** must apply to the player as factors on `walkSpeed` and `sprintSpeed`, like incentives, or they'll collide with the same stats.

### Incentives and Flash Sales

Express Checkout, Overtime Approved and Loss Prevention multiply on top of the Wardrobe in any order, and a swap in the middle of one is safe. Paid Break already reads `stats.maxHealth`, so it heals to the Cardigan's 125.
A 'wardrobe' Flash Sale group is skipped once everything is owned. Suggested PA line: "Apparel is {pct}% off! Try before you die."

## Phases

### 1. The stats and the core (Opus or Sol)
Declare the six new stats and wire their reads. Add `config/wardrobe.js`, `game/wardrobe.js`, the pricing category and a debug command that grants every item (a free key: tests rely on J being unbound).
No map or HUD work yet. Run `npm run balance`: with default stats it must not change.
Done when: wearing, swapping and Play again leave stats exactly right, with and without incentives running, and each new stat has been shown to work on its own.

### 2. Racks and fitting rooms (Sonnet or Luna)
The two feature kinds, all fifteen map entries as plain blocks, prompts with upside, downside and "Replaces X", the HUD strip and 'wardrobeChange'.
Done when: every item can be bought and swapped in a headless run through real input, in its zone only, and the coplanar test covers each fixture.

### 3. Sales and prices (Sonnet or Luna)
The Flash Sale group, PA lines, and bot buy-order steps in `tools/economySim.mjs` for the Wardrobe. Run the economy report and set prices.
Done when: the report shows no item is a must-buy, the Gold Card doesn't pay for itself too early, and survival by round moves a little, not a lot.

### 4. Spectacle (Sonnet or Luna)
Real displays, mirror reaction, shoe tint on the first-person legs, Light-Up Sneaker flashes and squeaks, the outfit on the results receipt ("Died wearing: ..."), and a humour pass.

### Later
- **Taking an item off.** Add a "nothing" entry to the bag cycle if players ask for it.
- **Set bonuses or triggered items,** only if the plain version gets dull. Needs a rule change first.
- **Non-Slip upgrade:** Orthopedic Mall Walkers also shrink the Janitor's wet floor slow, through a `slowTakenMultiplier` stat read by the Janitor. Add it with the boss.
- **Plush Keychain:** a free accessory won from the claw machine's plush (see `docs/claw-machine-plan.md`).

## Tests to add

`tests/wardrobe.test.js`, using `headlessGame()`. Build the map before seeding `Math.random`.
- Items: every item has a valid slot, at least one upside and one downside, and all factors above 0.
- Limits: no item raises `jumpVelocity`, `vaultMaxHeight` or `walkSpeed`, and `sprintSpeed` alone stays below the Cart charge.
- Wearing: buying puts the item on, the old one goes in the bag, and each slot holds one item.
- Swapping: at a fitting room the cycle reaches every bag item, it's free, and no zombie can spawn out of the HOFFMAN'S curtain while you stand there.
- Stacking: swap during Express Checkout, Overtime and Loss Prevention, let each end, and stats finish within a tiny tolerance of the expected value.
- Clamps: taking off the Cardigan at 125 health gives 100. Lowering sprint with a full meter keeps the fraction at 1.
- Stats: each new stat at its default changes nothing, and each works alone. `tests/balance.test.js` still passes.
- Pricing: a Flash Sale, Employee Discount and the Discount Code all change the rack price, and a free swap spends none of them.
- Payouts: the Gold Card pays once per kill whatever the source, in tens, and pays nothing after death.
- Reset: Play again equals a fresh game (`tests/fullRun.test.js`). `wardrobe.reset()` never writes to stats.

## Rules to keep

- Update `docs/map.md`, `docs/folder-structure.md`, `docs/tests.md` and `docs/history.md` with each phase. Change `CLAUDE.md` only for rules.
- Run `npm test` and `npm run build` before every commit.
- `game/wardrobe.js` is the only code that changes stats for clothes, and it only uses factors.
- Items are data. An item that needs its own code doesn't belong in this system yet.
- Prices through `g.pricing`, numbers in `config/`, gun damage combined only in `weapons/gunStats.js`.
- Racks and fitting rooms stay features in `game/features/`, DOM-free.
