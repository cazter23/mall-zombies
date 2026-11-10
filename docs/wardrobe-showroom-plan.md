# Wardrobe: the showroom rework (plan)

Status: phase 1 is built (9 November 2026: the picker, generated tickets, section 6's numbers, 'regenStart', colours and icons in config, the debug
command and the limits test; see docs/history.md). Phase 2 has nine showpieces built (9 November 2026: the Food Court sample and six ground-floor fixtures). See docs/history.md.
The Cinema 3D Glasses and the two Shoe-Per Sale fixtures remain. Phase 3, the outfit rail, is built (9 November 2026; docs/history.md), and phase 4 is not started.
It reworks Wardrobe v1 (the design that follows is
docs/wardrobe-plan.md). Numbers are starting points, to be tuned by playing.

## Why

v1 works: twelve items, three fitting rooms, all stats through the stats object, prices through `g.pricing`, Play again clean, 918 tests green.
A review in play and headless (9 November 2026) found that it doesn't yet feel like a perk system:

- **Buying is invisible.** An item is a mannequin with a name tag on an ordinary rack. Guns come back from Build-A-Blaster named, collared and
  covered in candy-coloured puffs; COD perk machines glow, hum and play a jingle. A Wardrobe purchase changes a number somewhere you can't see.
- **Nobody can tell what an item does.** Tickets say "More max health · Shorter sprints", with no numbers, and nothing in play shows an item working.
- **The HUD strip is four grey text chips.** It says what you wear and nothing else.
- **The fitting room is broken.** One shared bag across all four slots: with all twelve owned, only 12 to 24 of the 81 outfits can ever be put on,
  depending on buy order (measured over 300 orders). With 2 heads, 2 torsos, 2 feet and 1 accessory, 6 of 8.
- **Several items don't matter.** Hi-Vis x1.1 damage never changes a hit count (44/55/66 give the same 3/2/2 hits as 40/50/60). Light-Up Sneakers
  sprint 29.4 m against 32 m barefoot (faster but shorter). 3D Glasses x1.1 rarely saves a shot before round 10. Aviators are hard to feel at all.

## The goal, in one line

Every item is **a showpiece you spot from across the store, a moment when you buy it, something you see on yourself, and a tag on the HUD that
reacts when the item does its job.** The same campy excess as the guns.

## What stays from v1

Items are still data with factors applied through `game/wardrobe.js` (`*=` / `/=`), prices through `g.pricing`, features in `game/features/`,
`wardrobe.reset()` before 'stats', one item per slot, bought once, swaps free. No new item gets triggered logic (that rule change is still for Later).

## 1. Showpieces (the perk machines)

Each item is sold from **one big themed fixture**, not a rack. Rules for every showpiece:
- **Readable from 15 m**: a silhouette nothing else in the mall has, at least 2 m tall (or on a plinth that makes it so), and a neon sign in the
  item's signature colour (config, see 4). Decoration only (`collide: false`, merged by the static batcher) apart from a plain collider for the base.
- **Alive while unsold**: one cheap idle motion (spin, bob, blink, sweep) on a small `userData.dynamic` group. Emissive materials, not point lights
  (the light pool is full). Stops and goes dim once bought, with a SOLD OUT / "IN YOUR SIZE" card, so you can see from afar what you still lack.
- **A sound you learn**: a 2-3 note synth motif per item in `config/audio.js`, played every few seconds while you're within ~8 m and the item is
  unsold. One motif family (the mall chime), twelve variations. That's our perk jingle.
- **A buying moment** (about 1 s, game keeps running): the idle motion snaps to a pose, a spotlight cone flashes on the player, a register
  *ka-ching*, and the PA reads the item's line ("Attention shoppers: someone just bought the Heirloom Cardigan. Some are still warm.").
  The PA uses the existing announcement queue (`hud.showAnnouncement`), so it can't talk over a boss line.

| Item | Showpiece | Idle | Where (re-survey in phase 2) |
|---|---|---|---|
| Paper Hat | Fibreglass burger on Burger Barn's roof with a hat chute; hats drop into a tray | Burger lid bobs, steam puffs | Burger Barn, Food Court |
| Mirrored Aviators | 2.4 m mirrored sunglasses tower | Spins, throws light spots on the floor (decals, not lights) | SHADE SHACK, Atrium |
| 3D Glasses | Cardboard cut-out of a B-movie monster bursting out of a poster frame, red/blue offset outline | Monster's arm sways | Cinema lobby, by Concessions |
| Cardigan | Velvet-roped HEIRLOOM COLLECTION mannequin on a turntable under a spot | Slow turn | HOFFMAN'S, a cleared floor spot rather than the KNITS rack aisle |
| Sandwich Board | Mannequin wearing the board, megaphone raised, EVERYTHING MUST GO bulbs chasing | Bulb chase | Mega Mart front |
| Hi-Vis Vest | Staff locker with its door blown open, vest on a hook, amber beacon on top | Beacon rotates | Service Corridor lockers |
| Light-Up Sneakers | Disco plinth: a light-up floor tile under one giant sneaker | Tiles cycle colours | Shoe-Per Sale |
| Orthopedic Walkers | Senior mall-walker mannequin mid-stride on a little treadmill, sweatband on | Treadmill belt + arm swing | Shoe-Per Sale |
| Wheelie Sneakers | Sneaker on a sloped mini ramp with skid marks, "NO RUNNING" sign | Wheel spins | Good Sports, Food Court |
| Fanny Pack | Grab-bag dump bin overflowing with fanny packs, "AS SEEN ON TV" | Top pack bounces | Mega Mart |
| Foam Finger | 3 m foam finger rising out of a pennant-covered bin | Finger waggles | Good Sports, Food Court (kept 1.2 m+ from the Wheelies prompt) |
| Gold Card | Gold kiosk on a red carpet behind a velvet rope, MEMBERS ONLY, oversized card in a frame | Card glints | Hallway, by Customer Service |

Placement rules: a showpiece needs a clear 2 m approach, can't sit in a spawn lane, and follows the coplanar, standable (>= 2.1 m or <= 1.1 m)
and `map.features` rules. Each one is a module in `maps/mall/wardrobeShowpieces/` (or one file with a builder per item; decide by size).

## 2. You see it on yourself

The wardrobe version of drinking the perk. Everything below listens for 'wardrobeChange' (browser side: viewmodel, body, HUD, post) and
resets on 'runReset'. Nothing here changes gameplay.

| Item | First person | HUD | Screen |
|---|---|---|---|
| Paper Hat | Paper hat brim at the top edge when you look down or mantle (or skip) | Health bar gets a little "regen" tick marker at the new delay | — |
| Aviators | — | — | Gentle warm tint and a faint lens frame at the screen edge while aiming |
| 3D Glasses | — | — | 1-2 px red/blue fringe at the screen edges, stronger on a headshot |
| Cardigan | Knit sleeves (cardigan colour + cable texture) replace the polo sleeves | Health bar 25% longer, with a knitted end cap | — |
| Sandwich Board | Board edge visible at the bottom of the screen when you look down | Health bar gets a cardboard frame | — |
| Hi-Vis Vest | Reflective stripes on the sleeves | — | — |
| Light-Ups | Soles flash on every step (first-person legs) | Sprint bar in neon, flashing while sprinting | — |
| Orthopedics | Big white walking shoes on the legs | Sprint bar 35% longer, beige | — |
| Wheelies | Wheels in the heels, sparks on a slide | — | — |
| Fanny Pack | Pack at your belt when you look down | Pouch icon on the reserve ammo count; reserve shows "/ 75" when above the base | — |
| Foam Finger | The melee arm swings a giant foam finger instead of the bare fist (still the box cutter's damage and timing) | — | — |
| Gold Card | — | Kill pops gold with a ★ ("+70 ★") | — |

Sleeves: `weapons/models/arms.js` builds the polo sleeve per gun model (`buildCuffedArmSegment` returns `{ sleeve, cuff, stripe }`).
Tag those meshes (`userData.sleevePart`) and give the viewmodel one `setSleeves(style)` that swaps their material across every gun model.
Legs and shoes: `player/body.js` already has `shoeMat` and `soleMat`; add a `setShoes(style)`.

## 3. Clarity: tickets that say what happens (WORDS ONLY)

Design decision (9 November 2026): the player never sees what an upgrade does as a number. No percentages, multipliers, "100 → 125", seconds or damage
values in any ticket, prompt, pause line or receipt (prices, points, ammo counts, round, the health and sprint bars and countdown timers stay).
The rule and its one set of size words live in `config/effectWords.js`.

- **One short line per upside and downside, written in the item's own config entry** (`lines` in `config/wardrobe.js`): "Reloads {size} faster",
  "{Size} more health", "Sprints {size} shorter". Never built from the numbers. Where the size matters the line carries `{size}` / `{Size}`, filled from
  FIXED BANDS defined once (a little / noticeably / much, by how big the factor's change is), so retuning a factor moves the word with it. Whether a line
  is an upside (green) or a downside (red) follows the factor's direction (`statBetter`). `g.wardrobe.statLines(id)` / `wornLines(id)` return them.
- The ticket title is the item, then one line of joke (the ticket line from the original plan), then the green upsides and red downsides.
- At a fitting room or a showpiece of the same slot, the ticket says "Replaces Hi-Vis Vest" (no number comparison: the new item's own lines are what you get).
- The buying moment's PA line says what the item is, so the first purchase teaches what it does even if you skipped the ticket (no numbers there either).
- The same rule covers the rest of the game's upgrades: attachment counters, Extended Warranty tiers and the upgrade desk, Build-A-Blaster blurbs,
  incentive hints and boss vouchers (Flash Sales keep their percentage: a sale is a price). tests/effectWords.test.js fails on a digit followed by %, x, s, m, ° or an arrow in any of them.

## 4. The outfit rail (HUD)

Replaces the four grey chips, bottom left above the health bar.

- **A little chrome hanger rail with four price tags**, one per slot, each tag in the item's signature colour with a simple icon
  (hat, glasses, cardigan, board, vest, sneaker...). Icons are drawn in CSS/SVG, no image files. Colours and icon ids in `config/wardrobe.js`.
- **Empty slots** show a dashed outline of the slot's silhouette with the slot name: the rail tells you there's more to buy from round 1.
  The rail is visible from the start of a run (v1 hides it until the first buy).
- **Tags react when the item works.** They swing and flash on its event: Sandwich Board and Hi-Vis on 'playerHit', Gold Card on a
  'kill' that paid, Paper Hat when health starts regenerating, Foam Finger on a melee hit, Light-Ups/Orthopedics/Wheelies on sprint/slide start,
  Fanny Pack on a refill above the base cap, Aviators when aiming starts, 3D Glasses on a headshot. You learn what an item does by seeing it work.
  Needs one new event, 'regenStart' (player/health.js, listed in events.js); the others already exist or are read from the player.
- **Tag hover / pause screen**: the pause screen shows the rail large with each tag's lines (the same words as 3).
- **Death receipt**: the results screen prints "DIED WEARING:" with the four tags (phase 4 of the original plan).

## 5. Fitting rooms: a picker, not a queue

Hold interact at the mirror opens the rail as a picker, like the Build-A-Blaster order form (the game keeps running, same controls:
`menuSwitch` A/D or ◀ ▶ picks the slot, `menuMove` W/S or the D-pad cycles that slot's owned items, `menuConfirm` wears, `menuBack` closes).
The ticket shows the comparison from 3. Walking away or taking a hit closes it. Every owned item in every slot is reachable in at most 2 presses
per slot. `game/wardrobe.js` gets `wear(id)` (owned item only, any slot) in place of the bag; `wearNext` goes.

Keep the free swap and the three rooms. The mirror gets the same treatment as a showpiece, lighter: TRY ON neon, a curtain that swishes shut
for 0.4 s when you confirm (cosmetic only).

## 6. Number changes from the review

| Item | v1 | Change | Why |
|---|---|---|---|
| Hi-Vis Vest | reload x1.15, damage taken x1.1 | reload x1.25, damage taken x1.25 | A Shopper hit becomes 50, so two hits down you instead of three. A real glass cannon for fast reloaders (x1.2 would still be 3 hits: 48 x 2 = 96) |
| Sandwich Board | damage taken x0.9 | x0.8 | Mascot 50 → 40 (3 hits), boss 60 → 48 (3 hits): a real alternative to the Cardigan |
| Light-Up Sneakers | sprint x1.08, length x0.85 | sprint x1.1, length x0.9 | 8.8 m/s x 3.6 s = 31.7 m: faster without being shorter. Still under the Cart's 9 m/s |
| 3D Glasses | headshot x1.1 | x1.25 | Saves a shot from round ~4 on most guns |
| Aviators | ADS time x0.8, switch x0.85 | ADS time x0.7, plus aim-assist strength x1.2 (a new stat `aimAssistMultiplier`, read in `weapons/aimAssist.js`) | Something a controller player feels |
| Orthopedics | short name "Mall Walkers" | "Orthopedics" | The Mall Walker is a zombie |
| Damage multipliers | also scale fall damage | zombie hits only: read in the 'playerHit' listener, not `takeDamage` | Matches the original plan; a board doesn't cushion a fall |

Check each with `npm run balance` (no change with no items) and a headless measurement; prices stay placeholders until the economy simulation exists.

## Phases

### 1. Fitting-room picker, numbers and the rail's data (Opus or Sol)
`wear(id)`, the picker in the fitting-room feature, the ticket lines (words only, see 3: first built as numbers, changed to words by the same day's decision), the number changes, the damage-multiplier move,
'regenStart', colours and icon ids in config, and the missing v1 pieces: a debug command that grants every item, and the limits test.
Done when: every one of the 81 outfits is reachable (test), tickets say what each item does in words only, Play again is clean.

### 2. Showpieces (Sonnet or Luna; one area at a time)
Survey spots headless (clear approach, no spawn lane, prompt focus, coplanar), then build the twelve showpieces with idle, sold-out state,
motif and buying moment. Food Court's three first, as the sample to approve before the other nine.
Done when: each is readable from its area's entrance (screenshot), draw calls stay within budget (benchmark shots), tests green.

### 3. The outfit rail (Sonnet or Luna)
Tags, empty silhouettes, reactions on events, pause-screen detail, death receipt.
Done when: each item's tag reacts to its own trigger and nothing else (test the triggers headless through the events; check the look in the browser).

### 4. On yourself (Sonnet or Luna)
Sleeves, shoes, foam finger arm, belt and board bits, screen tints, health and sprint bar styles.
Done when: every item shows on the player in first person or the HUD, and swapping shows it at once.

## Tests to add
- Picker: all 81 outfits reachable; picker closes on a hit or walking away; it never costs points or spends a discount.
- Words: every factor has a direction and exactly one line in its item; no ticket, pause line or rail line carries a number (tests/effectWords.test.js, tests/wardrobe.test.js).
- Rail triggers: each event pulses only its item's tag (DOM-free: the HUD reads a `g.wardrobe.pulses` list or listens; test the list).
- Showpieces: coplanar and standable rules, sold-out state on purchase, back to unsold on Play again.
- Limits (from v1's plan): no item raises `jumpVelocity`, `vaultMaxHeight` or `walkSpeed`; sprint stays under the Cart charge.

## Open questions
- Keep twelve showpieces, or fewer and bigger (one showpiece per slot per floor)? This plan keeps twelve, so every area unlock reveals one.
- Should the fitting-room picker also exist at each showpiece (swap within that slot there)? Simpler for players, less reason to visit the rooms.
- Aim-assist on the Aviators: fine for mouse players, who don't get assist?
