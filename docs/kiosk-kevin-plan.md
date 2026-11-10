# Kiosk Kevin: plan

Status: PLAN ONLY (9 November 2026, branch `claude/kiosk-kevin-plan`). Nothing is built. Numbers are starting points to tune by playing, and prices are
suggestions: the economy report the claw and Wardrobe plans wait for still doesn't exist (`docs/economy-report.md` and `tools/economySim.mjs` aren't
written), so phase 7 checks them with a small report of its own. Checked against main at 753aafd (all ten GRAB-A-GUN phases, Wardrobe v1 and showroom
phases 1 and 3). Build one phase at a time, in its own worktree, and test before the next.

## The five decisions I need from you

1. **One pocket or two?** I suggest **one Pocket**: it holds one kind of equipment at a time (3 Soda Bombs, or 2 Air Horns, or 1 Sentry), and buying
   a different kind replaces what's in it. COD gives you a lethal and a tactical. One pocket makes every visit to Kevin a choice. Two pockets
   (lethal + tactical) is friendlier and needs a second button.
2. **Which button?** Keyboard: **G** (the grenade key everyone expects; it's a debug key today, so that debug key moves) or **Q** (free in gameplay; the
   order form uses it as Back, but nothing else runs while the form is open). Controller: every face button and bumper is taken. I suggest **RB for
   equipment, with melee on R3 only** (COD's own layout: melee is on R3 there). The other choice is **D-pad right**, which changes nothing but is awkward
   mid-fight.
3. **Does Kevin move?** I suggest **yes, at each 'roundStart', to a random open-zone site among five**, with the PA naming the area (the claw's pattern,
   already proven in code). The other choice is a fixed kiosk with only the stock rotating. And: **does he duck under the counter while a zombie is
   within 3 m?** (I suggest yes. It makes a visit something you clear the area for.)
4. **Does equipment damage scale with the round?** I suggest **yes**: a Soda Bomb's damage is a share of the round's zombie health
   (`zombieHealthForRound`), so it stays worth buying at round 25. COD's fixed-damage grenades stop mattering. Fixed damage is simpler and makes it an
   early-game tool only.
5. **The turret: a timed demo that zombies ignore?** There is no aggro system (every zombie always chases the player; the Wardrobe plan dropped the
   Mascot Head disguise for the same reason). So the Sentry can't be attacked or used as a decoy. It runs for 30 s and falls apart. The other choices:
   drop the turret, or add a targeting system first (big: zombies, navigation and bosses all change).

## The idea

Kevin runs the phone-case cart. You know the one: "Excuse me! Can I ask you a question?" The zombies came and he's still open, still shouting, and
he's added some new products. Everything on his cart is As Seen On TV, a party favour or something from the Food Court that shouldn't be shaken.

COD gives you two grenades a round for nothing. Kevin gives you nothing for nothing. You buy equipment from him, he only has some of it each round, and
he's never in the same place twice.

| | COD equipment | Kevin's cart |
|---|---|---|
| How you get it | Free refills every round | You buy it, and restocking means finding Kevin again |
| What you carry | A lethal and a tactical, always | One Pocket: you pick one kind (decision 1) |
| What's on offer | Everything, always | Three products a round, one of them Kevin's Pick (an extra one free) |
| Where | Your loadout | Kevin's cart moves every round (decision 3) |
| Late game | Grenades stop mattering | Damage scales with the round (decision 4) |
| Armour | Plates you hold to apply | Bubble Wrap: bought on the spot, pops audibly, never comes back by itself |
| A mall "grenade" | A frag | A shaken two-litre of Galleria Cola |

## Decided

From the design notes and the brief:
- Kevin sells lethals, tacticals, armour plates and a turret, with rotating stock each round.
- Every price comes from `g.pricing`.
- Kills pay through 'kill', whatever killed the zombie.
- It should feel different from COD in the way the claw machine is different from the box.

## Assumed (say if you disagree)

- **Kevin is a person, not a zombie.** He can't be hurt, zombies ignore him, and he has no collider of his own (his cart does).
- **He opens at the start of round 2, in the Hallway.** Round 1 already asks you for the start shutter. After that he moves (decision 3).
- **Three products a round,** drawn from six. Bubble Wrap is always one of them, because survival shouldn't hang on a roll. The other two slots are
  random, never the same product twice in one round.
- **Kevin's Pick:** one of the three gets one extra charge free ("Buy 2, get 1 free!"). A bonus in quantity, not price, so it needs nothing from
  pricing and can't stack with a Flash Sale in odd ways.
- **No free refills, ever.** The Pocket only fills at Kevin (and from debug commands).
- **Equipment hits pay no +10.** Only kills pay, through 'kill'. A Sentry or a Sparkler Cake farming +10s would pay for itself.
- **Equipment kills don't fill the power-up meter.** `powerUps.js` counts only 'gun' and 'melee' kills, and that stays. Same for Inventory Liquidation,
  Mystery Shopper, Overtime and Every 10th. The gold Mascot's guaranteed power-up is the exception (it must drop however he dies: check in phase 5).
- **Throwing is a tap.** No cooking, no hold. The throw blocks the gun for about 0.4 s, like a melee swing.
- **Clothes don't change equipment in v1.** The armour numbers are declared stats, so a later Wardrobe item can change them.

## The products

Words on the ticket follow the WORDS ONLY rule (`config/effectWords.js`): what an item does in words, never radius, damage or seconds. Counts ("3 Soda
Bombs") are allowed, like ammo counts.

| Product | Kind | What it does | Bosses | Charges | Suggested price | Ticket line |
|---|---|---|---|---|---|---|
| **Soda Bomb** (shaken Galleria Cola, 2 L) | Lethal | Thrown, bounces, bursts after 1.8 s. Blast 4 m: 1.3x the round's zombie health at the centre, 0.35x at the edge | 6% of a boss's max health | 3 | 750 | "Do not shake. Do shake." |
| **Grand Finale Sparkler Cake** (party store) | Lethal | Lands, sits and sprays sparks for 4 s: sets zombies within 3 m on fire (`applyBurn`, the Fryer Oil burn) | Burns, at half strength (`slowStrength`-style factor) | 2 | 750 | "Indoor use voids the warranty and the mall." |
| **Stadium Air Horn** (Good Sports) | Tactical | One blast: everything within 6 m staggers away and any Cart Pusher charge stops (`staggerAway` sets `chargeLeft = 0`) | Ignored (bosses refuse `staggerAway`): "Bosses have heard worse." | 2 | 500 | "Clears a room. Ask anyone at a hockey game." |
| **Glitter Bomb Greeting Card** | Tactical | Opens on landing: zombies within 4 m are confused for 6 s and hit each other (`applyConfusion`, the Glitter stuffing) | Ignored (bosses refuse confusion) | 2 | 1,000 | "Congratulations! It never comes out." |
| **Bubble Wrap** | Armour | One layer per purchase, up to 3. Each layer takes one zombie hit's worth of damage (40) before your health, then pops | Boss hits pop layers too | n/a | 500 a layer | "FRAGILE. This side towards zombies." |
| **SPIN-O-MATIC Sentry** (Kevin's own display stand, a staple gun taped on) | Turret | Thrown like the rest; it lands upright and spins, firing at the nearest zombie in sight for 30 s, then falls apart. One out at a time | Hits them normally | 1 | 1,500 | "Batteries not included. Neither is supervision." |

Why these numbers (starting points):
- **Soda Bomb vs a crowd:** a Shopper at the centre dies at any round. A Mascot (5x health) takes about a quarter. At round 25 a zombie has about
  2,400 health; the bomb still kills what it lands on, which is the point of decision 4. Three for 750 is cheaper than a RESTOCK-O-MATIC's 400 a refill
  only if they each clear a group, so it competes with ammo, it doesn't replace it.
- **Bubble Wrap at 40 a layer** is exactly one Shopper hit, so a full wrap (1,500) turns 3 hits to death into 6 before regen. That's strong, which is why
  layers never come back by themselves and Kevin moves. It's the Cardigan's job done differently: the Cardigan (2,500) is permanent and regenerates.
- **The Sentry** does about Price Gun damage per second and can't be aimed, so it's a holding tool for a doorway, not a kill machine.

## The Pocket and the button

- **One new action, `equipment`,** in `config/controls.js` (decision 2 picks the codes), plus its line in `controlsHelp` and `buttonLabels`.
- **Tap to throw** the Pocket's item along the view, with a lob (the Tennis Ball's gravity arc). The Sentry is thrown too and sets itself up where it lands.
- **The Pocket holds one kind.** Buying the same kind tops it up to its charges (and Kevin's Pick adds one past that). Buying another kind replaces it:
  the ticket says "Replaces 2 Air Horns". Nothing is refunded.
- **Can't throw** while switching guns, vaulting, swinging, in a menu, or with a Sentry already out (for the Sentry only). A throw cancels a reload,
  as a melee swing does.
- **HUD:** the Pocket's icon and count beside the ammo; Bubble Wrap as up to three white segments over the health bar.

## Where Kevin is

All five sites have a kiosk cart in the map all the time, and only one is live: the others have their shutter down and a "BACK IN 5 MIN" sign (the claw's
dust sheets, for the same reason: no collider can be added or moved at runtime). Each cart is a low counter (<= 1.1 m, vaultable on its short side) or
>= 2.1 m with its canopy, never in between.

| Site | Zone | Starting idea | To check in phase 4 |
|---|---|---|---|
| Hallway | hallway | West half, south wall, between the Service Corridor door and the Food Court gate. **First site** | 2 m from the claw at x 8 and the Prize Counter at x -13; vent spawns |
| Food Court | foodCourt | Centre aisle, between the stalls | The foam-finger bin and the pillar at (-13, -11.3) |
| Grand Atrium | atrium | **The CELL-OUT kiosk at (12.6, 14.8)**: it's already a phone kiosk, so it becomes Kevin's | Its counter is 1.05 m; zombies' routes round the court |
| Sunset Promenade | upstairs | East lounge, near the plinth at (14.2, 1.6) | Routes round both sides; Build-A-Blaster's storefront |
| Customer Parking | parkingLot | Beside a van: Kevin's "overflow stock" | Outdoor spawns |

Not HOFFMAN'S (tight aisles) or the Service Corridor (3 m wide). Not the Cinema: one more site upstairs would make the upper floor the common answer.

**The move rule:**
- At each 'roundStart' after round 2, Kevin moves to a random other site whose zone is open; if none is, he restocks where he stands. Stock re-rolls
  every 'roundStart' either way.
- He never moves mid-purchase (the claw's `moveNow` refusal) and never into a locked zone.
- **He ducks** (decision 3) while any live zombie is within 3 m of his stand point: the cart's `available()` is false and the ticket area shows "Kevin
  is hiding". He's back the tick it's clear.
- PA lines: "Kevin's cart is now in {area}. He's asked us to say it's a limited time only." and "Today on Kevin's cart: {a}, {b} and {c}."
- Kevin hawks: when you come within 8 m he shouts a line ("You! You look like someone who needs a Soda Bomb!"). Sound only, rate-limited.

## How items pay out

- **Every kill goes through 'kill'** with a new `source: 'equipment'` (and the product id on the zombie's death, for the career stats). The kill
  listener pays all sources already, so nothing changes there. Once the player is dead nothing pays (existing rule).
- **No 'hit' event** from equipment, so no +10, and boss `onHit` hooks (the Influencer's followers, the Guard's headshots) don't react. That's intended:
  those mechanics are about your aim.
- **Damage goes through `zombie.takeHit({ damage, source: 'equipment', ... })`**, like Party Trap and the stuffings. Status products call the zombie's
  existing `staggerAway`, `applyConfusion` and `applyBurn`.

## How it fits the code

### Constraints checked

- **Controls are full.** Gameplay keyboard: WASD, Space, C, Ctrl, Shift, R, F, 1, 2, V, I, mouse and wheel. G, E, X, Z and T are debug keys
  (`config/debug.js`, and a test there forbids clashes). Q is only `menuBack`, while the order form is open, and createGame skips movement, the gun and
  buying while `state.menu` is set, so Q can be both if equipment is skipped the same way. Controller: every face button and bumper is used; only
  PadUp, PadLeft and PadRight are free outside menus. Hence decision 2.
- **The equipment system is player-side, not a feature.** It ticks every frame with the gun, so it's built in `createGame` like `melee`, ticked inside
  `if (!inMenu)` between melee and the gun, and its "busy" goes into `gun.update(dt, blocked, ...)` with `melee.isBusy` and the vault. There is no shared
  busy arbiter today; this joins the `blocked` argument. Kevin's cart IS a feature (`game/features/kiosk.js`).
- **Thrown things can reuse `weapons/ballistics.js`,** which already does a gravity arc with bounces (`launch({ position, direction, projectile, onHit,
  onBounce, onEnd })`). Two problems: hitting a zombie always calls `takeHit` (line 113), and the game-level `balls` instance is drawn by the ball view.
  So: one option (`zombies: 'bounce'`, bounce off a zombie without hitting it) and a second instance, `throwables`, with its own view, ticked and cleared
  where `balls` is (tick after zombies, clear on reset and death).
- **Sunny is in `shootables`.** `castShot` treats him as a target, and he has `isSunny`, `noRewards`, `ignoreAimAssist`. Blasts and the Sentry skip
  anything without a zombie `type` (or with `noRewards`): no popping Sunny with a Soda Bomb by accident (or decide it's allowed; he pays tickets).
- **Bosses refuse status.** `applyBuff`, `applyHold`, `staggerAway`, `applySlip` and `applyConfusion` all return early for bosses, slows are weakened
  by `type.slowStrength`. So the Air Horn and the Glitter Bomb do nothing to a boss, and the ticket must say so (the WORDS ONLY line "Bosses ignore it").
  Damage has no boss cap in the engine, so the Soda Bomb's boss share is its own rule, in its own damage function, like Return to Sender's boss rule in
  `gunStats.js` (but equipment isn't a gun, so it doesn't go in gunStats: `game/equipment/equipmentDamage.js`, numbers in `config/kiosk.js`).
- **Mascots:** the helmet pops at a health fraction from any source, but its 100-point bonus is only for a gun headshot or melee. Equipment kills a
  Mascot fine and never pays the helmet bonus. Air Horn knockback is scaled by `hitKnockbackScale`. Poppy Corn's pop blast is unchanged.
- **Mannequins** are frozen while observed "unless staggered", so an Air Horn lets a watched Mannequin slide while it staggers. Fine: it's being pushed
  away from you.
- **Armour must sit in the zombie-hit path only.** The 'playerHit' listener in createGame does `health.takeDamage(damage * stats.damageTakenMultiplier)`,
  and `health.js` says the amount is final there and falls never use clothes. Bubble Wrap absorbs in that listener, after the multiplier (so the
  Sandwich Board makes layers last longer, the Hi-Vis Vest shorter), and never on a fall. Knockback is unchanged. Boss attacks arrive through
  'playerHit' too (the Wardrobe plan checked it); boss-specific `onPlayerHit` hooks in `bossDirector.js` still run.
- **Armour state vs stats.** Layers are run state (`health.armour`, reset by the health step); the numbers that a perk might change are declared
  stats in `createPlayerStats()`: `maxArmourLayers` (3) and `armourLayerStrength` (40). Undeclared stats get deleted by `resetPlayerStats`. Reads use
  `?? default`, because test doubles pass partial stats.
- **A price category needs a real id.** `main.js` calls `pricing.basePriceOf(prompt.kind, ...)` every frame for kinds in `PRICE_CATEGORIES`. So the
  cart's buy items use `kind: 'kiosk'` with the product id (`economy.kiosk.sodaBomb` etc.), and a "Kevin is hiding" state is `available()` false, not a
  fake item. Adding 'kiosk' to `BASE` in pricing.js gets the Employee Discount ending on purchase and the HUD's sale marker for free.
- **Focus goes to the nearest item, not the one you look at.** Three products on one cart need their own positions about 0.6 m apart along the counter,
  or one item with the stock cycling. I suggest three positions (the attachment counters and wardrobe racks taught the 1.2 m rule for separate
  fixtures; on one counter the facing check does the rest: test it in phase 3).
- **The claw's relocation is the pattern.** One mutable `site`, getter positions on every interaction, every site's cart built at setUp with `setLive`,
  `pickSite()` over open zones on 'roundStart', PA through events. The PA relay in createGame (lines 373-378) needs the new event names added.
- **Clutter avoids only `feature.position`.** Like the claw, each extra site needs its own entry in the scatter-clear lists (`hallwayClear` and the Food
  Court and Atrium equivalents).
- **Zombies can't target the Sentry.** No aggro exists. It has no collider, no health, a lifetime instead, and zombies walk through it (decision 5).
  It fires with the hitscan from its own muzzle position at the nearest zombie with a clear line, skipping `noRewards` and anything without a type.
- **Freezes and death.** `features.update` doesn't run while paused or dead, and the equipment tick sits in the same block, so a Sentry or a Sparkler
  Cake stops with the game. The 'kill' listener already pays nothing after death.
- **Reset order.** `resetSteps`: bosses, powerUps, zombies, mascotCostumes, wardrobe, stats, surfaces, health, runStats, balls, gun, interactions, ...,
  map, features, ... The Pocket and the throwables reset in a new 'equipment' step right after 'balls' (live throwables and the Sentry removed and
  disposed). Armour layers reset in the 'health' step (after 'stats', so `maxArmourLayers` is back to base). Kevin's site and stock reset in
  `features.reset()`.
- **Tests must not seed `Math.random` before building the map.** Stock rolls use `Math.random` after the build; tests seed after.
- **WORDS ONLY.** `tests/effectWords.test.js` fails on a digit followed by %, x, s, m or an arrow in any ticket. Product lines live in `config/kiosk.js`
  and use the same size words.
- **Build-A-Blaster:** equipment kills in the workshop room are 'kill' events, so they should fill the Stuffing Tank (check the ritual's listener
  doesn't filter by source). The Glitter Bomb and the Sparkler reuse the zombie methods, not `STUFFINGS` (which is private and needs a gun def).

### What needs to change

- **New `config/kiosk.js`:** products (kind, charges, lines, blast and status numbers, boss share), Pocket rules, sites, duck radius, hawk lines, PA lines.
  Prices in `economy.kiosk` ({ sodaBomb: 750, sparklerCake: 750, airHorn: 500, glitterBomb: 1000, bubbleWrap: 500, sentry: 1500 }).
- **`config/controls.js`:** the `equipment` action, help and button labels; `config/debug.js` if G moves.
- **New `game/equipment.js`** (built in createGame, DOM-free, `g.equipment`): the Pocket, throw timing and busy state, `give(id, count)`, `status` for the
  HUD, `reset()`. **New `game/equipment/`**: `equipmentDamage.js` (the round-scaled blast and the boss share), one small module per product effect
  (sodaBomb, sparklerCake, airHorn, glitterBomb, sentry).
- **`weapons/ballistics.js`:** the `zombies: 'bounce'` option. A second instance `throwables` in createGame.
- **`player/stats.js`:** `maxArmourLayers`, `armourLayerStrength`. **`player/health.js`:** `armour` layers, `addArmour()`, `absorb(amount)`, reset.
  **createGame's 'playerHit' listener:** absorb before `takeDamage`.
- **`game/pricing.js`:** the `kiosk` category.
- **New `game/features/kiosk.js`** + one registry line; **new `maps/mall/kioskCart.js`** (like `clawCabinet.js`: `{ position, normal, sign, rig }`,
  moving parts `userData.dynamic`); **`maps/mall/mall.js`:** five carts, one feature entry, the clutter lists.
- **New events** (listed in `events.js`): 'kioskStock' `{ siteId, stock, pick, pa }`, 'kioskMoved' `{ siteId, area, moved, pa }`, 'kioskDuck'
  `{ hiding }`, 'equipmentThrown' `{ id, left }`, 'equipmentBurst' `{ id, position, radius }`, 'armourHit' `{ absorbed, layers }`, 'sentryDeployed'
  `{ position }`, 'sentryExpired' `{}`.
- **`economy.flashSales.groups`:** a 'kiosk' group, eligible only while Kevin is open in an open zone.
- **`main.js`:** the Pocket and armour HUD pieces, the throwables view, Kevin's area note (read from `.status`), the hawk sound.
- **`tests/helpers/headlessGame.js`:** `snapshot` includes the Pocket, armour and Kevin's site and stock.

### Ideas that changed

| Idea | Problem | What replaced it |
|---|---|---|
| A decoy (a singing plush, a monkey-bomb) | No aggro or targeting system: every zombie chases the player | Dropped. The Glitter Bomb makes them fight each other instead (that already exists) |
| A turret zombies attack | Same: nothing can target it | A 30 s demo unit with no health (decision 5) |
| Grenades bounce off zombies through the ball system | `ballistics.js` always damages a zombie it touches, and its view draws every ball | A bounce option and a separate `throwables` instance |
| Equipment damage in `gunStats.js` | That file combines GUN numbers; equipment isn't a gun and doesn't take tiers or attachments | `game/equipment/equipmentDamage.js` |
| Kevin wheels his cart across the mall | Moving a collider rebuilds navigation | Five fixed carts, one live, the rest shuttered |
| A "Deal of the Day" price cut | Pricing discounts are per category, not per id; a second discount layer fights Flash Sales | Kevin's Pick: one free extra charge |
| Free grenades each round (COD) | Removes the reason to find Kevin | No free refills |
| Haggling with Kevin on a timed press | The claw already owns the timing game | No haggling |
| Kevin as a zombie you can kill | A dead vendor ends the system for the run, and he'd need to be a non-zombie shootable everywhere | He can't be hurt and ducks instead |
| Showing blast radius on the ticket | WORDS ONLY rule | Words ("a big blast", "Bosses ignore it") |

## Working with other systems

### Bosses
- Soda Bomb and Sentry damage bosses (the bomb at its boss share), Sparkler burns at half strength, Air Horn and Glitter do nothing (tickets say so).
- No 'hit' events, so no Influencer followers or Guard headshot reactions from equipment.
- A Security Guard lockdown can shut you away from Kevin: fine, the cart waits and nothing times out.
- Boss vouchers: **Discount Code applies** (50% off, at most 2,000: on a 1,500 Sentry it saves 750; there's no refund to abuse, unlike the claw).
  **Master Key and Signed Approval don't** (doors and tiers only). The Employee Discount power-up's coupon applies.

### Mascots
- Equipment kills pay their kill value, never the helmet bonus. The gold Employee of the Month must still drop his guaranteed power-up when a Soda Bomb
  kills him (check `powerUps.js`: the meter skips non-gun kills; the gold drop must not).

### Build-A-Blaster
- No conflict: equipment doesn't touch guns, so it works with the Courtesy Loaner in hand and during every ritual stage.
- Kills in the room fill the tank (check the listener). No cart in the workshop room.
- Later: a stuffed gun's effect on a Soda Bomb ("Fryer Oil Soda Bomb") is out of scope; it needs `STUFFINGS` exported.

### Wardrobe
- Sandwich Board and Hi-Vis Vest scale the damage before Bubble Wrap absorbs it. No item changes the Pocket in v1. Later: a "Utility Belt" accessory
  could add a Pocket charge through a declared stat (`pocketBonus`).

### Flash Sales and vouchers
- A 'kiosk' Flash Sale group, skipped while Kevin is hidden behind a locked zone. PA line: "Everything on Kevin's cart is {pct}% off. Kevin was not
  consulted."

### GRAB-A-GUN and prize tickets
- No link. Tickets don't buy equipment (they're claw currency). Later: a Prize Counter Soda Bomb, if tickets need more sinks.

### Death and Play again
- On death: live throwables and the Sentry stop (the tick doesn't run) and are cleared on reset. The Pocket, armour and Kevin's site and stock reset;
  Kevin is shuttered until round 2 again. `tests/fullRun.test.js` proves Play again equals a fresh game.

## Phases

### 1. The Pocket, the button and the Soda Bomb (Opus or Sol)
The `equipment` action and bindings (after decision 2), `game/equipment.js`, the throw blocking the gun, the `throwables` instance and the bounce option,
`equipmentDamage.js` and the Soda Bomb only, a debug command `g.debug.run('pocket')` to fill it (no new debug key), the HUD count.
Done when: a throw works through real input on keyboard and controller, can't fire during a switch, vault, swing or menu, pays only through 'kill', never
pays +10 or power-up credit, never hurts Sunny, and death and Play again leave nothing behind.

### 2. Bubble Wrap (Opus or Sol: it touches the shared damage path)
The two stats, `health.armour`, the absorb in 'playerHit', the HUD segments, the pop sound, a debug command.
Done when: a layer takes exactly its strength, falls never touch it, clothes scale before it, and reset clears it.

### 3. Kevin's cart, one site (Opus or Sol)
`config/kiosk.js` stock rules, the pricing category, the feature kind and one cart in the Hallway, the three buy items, Kevin's Pick, the Pocket's
replace rule and ticket, ducking, the first PA lines, opening at round 2.
Done when: every product can be bought through real input, the stock re-rolls every 'roundStart' with Bubble Wrap always in it, prices follow a Flash
Sale and the Employee Discount, and the cart is never buyable while a zombie is within the duck radius.

### 4. More sites and the move (Sonnet or Luna)
The other four carts and their checks (stand point clear, no spawn within 5 m, routes unchanged, coplanar), the move rule, the clutter lists, PA.
Done when: Kevin only ever opens in an open zone, never moves mid-purchase, and every site passes the navigation and coplanar tests.

### 5. Air Horn, Glitter Bomb and Sparkler Cake (Sonnet or Luna)
Each through the zombie's existing status methods, with boss tickets. Check the gold Mascot drop.
Done when: each does its job on Shoppers, Cart Pushers and Mascots, does nothing (or half) to bosses as the table says, and pays only through 'kill'.

### 6. The SPIN-O-MATIC Sentry (Opus or Sol)
Deploy on landing, targeting with a clear line, the hitscan from its muzzle, lifetime, one at a time, no collider.
Done when: it never targets Sunny or the dead, stops when paused or dead, and its kills pay through 'kill' with no +10.

### 7. Sales, vouchers and balance (Sonnet or Luna)
The Flash Sale group, voucher checks, and `tools/kioskReport.mjs` (`npm run kiosk`): Soda Bomb kills by round and type, Bubble Wrap hits-to-death,
Sentry damage per second against the Price Gun. Set the prices.
Done when: no product is a must-buy at round 2, the Soda Bomb is worth buying at round 25, and Bubble Wrap doesn't double survival by itself.

### 8. Spectacle (Sonnet or Luna)
Kevin (a low-poly guy in a lanyard, ducking animation), the cart and its shutter, the hawking lines, product models, the cola spray, the glitter, the
air-horn blast ring, bubble-wrap pops, the Sentry's spin, and a humour pass. Keep it static-batched where it doesn't move.

### Later
- A second pocket (if decision 1 goes the other way, or players ask).
- Kevin's van in the Parking lot as a sixth site.
- Prize Counter equipment for tickets.
- A "Utility Belt" Wardrobe accessory (+1 Pocket charge).
- A decoy, once any targeting system exists.

## Tests to add

`tests/kiosk.test.js` and `tests/equipment.test.js`, using `headlessGame()`. Build the map before seeding `Math.random`.
- Pocket: one kind at a time, same kind tops up, other kind replaces, Kevin's Pick adds one, nothing refunded.
- Button: throwing works on the keyboard and controller codes, not during a switch, vault, swing or menu, and a throw cancels a reload.
- Payouts: equipment kills pay through 'kill' with source 'equipment', no +10, no power-up meter, nothing after death; Sunny is never hit.
- Damage: the Soda Bomb kills a centre Shopper at rounds 1, 10, 25; a boss takes only its share; Air Horn and Glitter do nothing to a boss.
- Armour: a layer absorbs its strength, falls skip it, clothes scale first, layers cap at `maxArmourLayers`.
- Kevin: stock re-rolls each 'roundStart' with Bubble Wrap and three different products, he opens only in open zones, never moves mid-purchase, ducks
  within the radius, and opens first in the Hallway at round 2.
- Pricing: a Flash Sale, the Employee Discount and the Discount Code change the price; Master Key and Signed Approval don't.
- Carts: each is a step, a vaultable counter or >= 2.1 m tall, with one collider, navigation stays connected, and the coplanar test covers each site.
- Controls: the new action clashes with no debug key (the existing test in `config/debug.js`) and has help and label entries.
- Reset: Play again equals a fresh game (`tests/fullRun.test.js`), and every thrown object and the Sentry are removed and disposed.
- WORDS ONLY: every product line passes `tests/effectWords.test.js`.

## Rules to keep

- Update `docs/map.md`, `docs/folder-structure.md`, `docs/tests.md` and `docs/history.md` with each phase. Change `CLAUDE.md` only for rules (and the
  docs index, once building starts).
- Run `npm test` and `npm run build` before every commit.
- Prices through `g.pricing` with `kind: 'kiosk'`; numbers in `config/kiosk.js` and `economy.kiosk`.
- Kevin's cart is a feature in `game/features/`, DOM-free, talking through `g.events`. The Pocket is a player system built in `createGame`.
- Gameplay reads the `equipment` ACTION, never a raw key.
- Kills pay only through 'kill'. Equipment never emits 'hit'.
- No cart moves and no collider is added or removed at runtime.
- Every new runtime object is cleaned up by `reset()`, in the resetSteps order.
