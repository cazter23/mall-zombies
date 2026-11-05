# Build-A-Blaster rebuild: plan

Status: agreed outline, nothing built yet. The current prototype (`game/features/workshop.js`, `maps/mall/workshopRoom.js`,
`config/workshop.js`) is what this replaces. Build one phase at a time, in its own git worktree, and test before the next.

## The idea

Pack-a-Punch is a wait. Build-A-Blaster is a ritual, a parody of Build-A-Bear: your gun is handed over, stuffed, given a heart
and named, while you fight for it. The result should feel made, not bought.

The flow:
1. Bring your gun to the bench. Pick a Stuffing (what it does) and a Heart (when it fires). Pay.
2. The gun goes onto a conveyor. You fight with your other gun.
3. Kills in the room are sucked into the Stuffing Tank and fill a gauge.
4. Pull the lever to finish early, or let the maximum time run out.
5. Collect the gun at the Naming Booth, with its Birth Certificate.

## Decided

- The gun really leaves your hands during the ritual.
- Finished builds can be re-stuffed for a price.
- No fetching across the mall. Stuffings are at the workshop.
- The ritual ends by lever, with a maximum time.
- The room is rebuilt for this.

## Assumed (say if you disagree)

- **No lock-in.** Doors stay open during the ritual, so you can run. Kills only count inside the room, and the gun waits for you.
- **Courtesy Loaner.** A player carrying one gun would otherwise be left with only the box cutter, so the bench lends a basic
  Staple Gun for the ritual and takes it back at collection.
- **The room needs its own zombies, without a points farm.** See the Returns Chute rule below.

## Stuffings

Each round the sign shows "Today's Stuffings": 3 picked at random from what is stocked, or all of them if fewer are stocked.
Owning an area adds its stuffing. Smoothie is always stocked, so the bench is never empty.

| Stuffing | Stocked by | Effect | Phase |
|---|---|---|---|
| Smoothie | Always | Slow (uses the existing `zombie.applySlow`) | 3 |
| Fryer oil | Food Court | Burn over time (new damage-over-time status) | 3 |
| Neon tube | Mega Mart | Chain lightning to nearby zombies | 3 |
| Stale popcorn butter | Cinema | Slippery puddle (the Spill Cleanup effect is the starting point) | 6 |
| Antifreeze | Customer Parking | Shatters slowed zombies | 6 |
| Glitter | HOFFMAN'S | Confused zombies fight each other (new AI, the largest piece) | 6 |

## Hearts

| Heart | Fires | Phase |
|---|---|---|
| Headshot | On a headshot | 3 |
| Last Round | On the last round in the magazine | 3 |
| Reload | A blast around you when you reload | 6 |
| Every 10th | On every 10th kill | 6 |

Stuffings and Hearts stay independent, so any pair works: 6 + 4 pieces of code make 24 builds. Hearts read existing events
('shot', 'kill' and a reload event if needed) and hand off to the stuffing. Kills made by a stuffing must not fire Hearts, or chains
will loop.

## Quality

The kill count from the gauge sets the quality, stored on the build and printed on the certificate:

| Quality | Result |
|---|---|
| Understuffed | Base effect |
| Regular | Stronger effect |
| Extra Stuffed | Strongest effect |
| Overstuffed | Strongest effect, and the gun visibly bulges and leaks stuffing |

Thresholds, multipliers and the maximum time go in `config/workshop.js`. Starting point: 45 s maximum, thresholds 4 / 9 / 15 kills.
Tune them by playing.

## The room

Space: the workshop can grow north and west at level 2. The slab sits above HOFFMAN'S (ceiling 5 m) and the start room (ceiling 4 m).
The limits are the shoe store (x -10.3..-3.7, up to z 11.6) and the Atrium's upper shops and exterior wall (about x 5.4). Phase 1 confirms
this with the collision and culling tests.

Target shape, about 14 × 14 m at the back: keep the storefront at the current position, then open into a hall at roughly x -9..5, z 12..26.

```
          NORTH
 ┌───────────────────────────────┐
 │ [RETURNS CHUTE]               │
 │                               │
 │   ┌── conveyor ──────────┐    │  back hall
 │   │   [ STUFFING TANK ]  │    │
 │   └──────────────► [NAMING    │
 │                     BOOTH]    │
 │   run loop all around    LEVER│
 └────────┐             ┌────────┘
          │ BINS  HEARTS│           storefront
          │    BENCH    │
          └──door─door──┘
          SOUTH (Promenade)
```

- **Storefront:** bins, the Today's Stuffings sign, the Heart wall and the bench.
- **Stuffing Tank:** glass, tall, seen from anywhere, with the quality marks painted on it.
- **Conveyor:** wraps the tank, shows your gun at each stage. Tank + conveyor make an island to run laps around (keep the lanes at least 3 m wide).
- **Lever and Naming Booth:** past the end of the conveyor, away from the doors, so cashing out means crossing the room.
- **Ritual mode:** party-coloured lights, a cheerful jingle over the fighting, PA narration.

### Returns Chute rule

A hatch at the back opens during the ritual and zombies tumble in as returned merchandise. These come out of the round's normal
budget: while a ritual runs, spawns are steered to the chute. They add nothing extra, so the room can't be farmed for points and rounds
still end.

The consequences are intended: a ritual started late in a round has few zombies left, so it comes out Understuffed. Starting one
in the round break means waiting for the next round's zombies. Timing it is part of the skill.

## Phases

### 1. The room (Opus or Sol to plan the layout, then Sonnet or Luna)
Build the shell, with the tank, conveyor and booth as plain blocks. No gameplay change: the current bench still works.
Touches: `config/promenade.js`, `maps/mall/levelTwo.js`, `maps/mall/workshopRoom.js`, `mall.js` (cull areas, grade zone, lamps, benchmark shot).
Done when: navigation reaches the whole room, zombies walk the loop, coplanar and culling tests cover it, and the frame numbers hold.

### 2. The ritual (Opus or Sol)
New `game/features/workshopRitual.js`: states idle, running, ready. Handing over, the loaner, conveyor stages, gauge, lever, maximum time,
collection, chute steering. Uses placeholder effects.
Done when tests cover: death and Play again mid-ritual, walking away and returning, the loaner returning, an ownership change or gun purchase
mid-ritual, the chute adding no zombies, and the round still ending.

### 3. Stuffings and Hearts (Opus or Sol)
The build record, three stuffings, two Hearts, quality, the daily stock and area stocking, re-stuffing, `priceOf('workshop', ...)`.
Party Trap and Clearance Rack stay on sale for their guns as Limited Editions until phase 6.
Run `npm run balance` and tests/balance.test.js: chain and burn damage must not break the round curve. Damage numbers live in config.
Done when every stuffing and Heart pair works, a kill pays once, and upgrades and attachments stack with a build.

### 4. Name and Birth Certificate (Sonnet or Luna)
Random names (`config/workshop.js`), a certificate on screen at collection, the name on the HUD, PA lines, "Survived by: Gerald" on the death screen.

### 5. Spectacle (Sonnet or Luna)
Real models for the tank, conveyor arm and chute, moving parts marked `userData.dynamic`, party lights within the light pool's limits, zombies being
sucked in, jingle and narration, per-stuffing tracers and sounds, the stitched gun look and the Overstuffed bulge.

### 6. Full set (Opus or Sol for Glitter, Sonnet or Luna for the rest)
The other three stuffings and two Hearts, and Limited Edition drops: a zombie with a shopping bag occasionally drops Party Trap or Clearance Rack.

## Prices

Not set yet. The economy simulation decides these: first ritual, re-stuff and Limited Editions. All go in `economy.upgrades.workshop` and are read
through `g.pricing`.

## Rules to keep

- Numbers in `config/`. Prices through `g.pricing`. Gun damage combined only in `weapons/gunStats.js`.
- The ritual is a feature in `game/features/`, DOM-free, and listens on `g.events`.
- Every new runtime object is cleaned up by `reset()`, and the steps stay in the resetSteps order.
- Nothing else should edit `promenade.js`, `levelTwo.js` or `mall.js` during phase 1.
- Update `docs/map.md`, `docs/folder-structure.md`, `docs/tests.md` and `docs/history.md` with each phase.
