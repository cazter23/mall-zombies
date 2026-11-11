# Environmental Hazards — Plan

Pay-to-trigger mall traps with cooldowns, built as `map.features` kinds in `src/game/features/` with every price routed through `g.pricing` and every tunable number in `src/config/hazards.js`.

---

## The idea

The mall's infrastructure is still wired into 1986 breaker boxes, fryer valves, fire pulls, and paging panels. In an unlocked area, the player can walk up to a hazard switch, hold `F` / controller `X` to pay its activation cost, and turn the room itself against a horde. Each hazard runs for a short active window, then enters a recharging cooldown before it can be triggered again. Stand in your own trap and you feel it too.

---

## Decided

- **4 hazards chosen, 2 dropped** from the design reference list (`fire sprinklers, an electrified fountain, a fryer blast, escalator reversal, toppling shelves, a PA system lure`):
  1. **Electrified Fountain** (`fountain`, Grand Atrium) — **built first in Phase 1**
  2. **Fryer Blast** (`fryer`, Food Court at Corn Dog Corral) — **built in Phase 2**
  3. **Fire Sprinklers** (`sprinklers`, Main Hallway concourse) — **built in Phase 3**
  4. **PA System Lure** (`paLure`, Service Corridor)
  - *Dropped*: **Toppling Shelves** and **Escalator Reversal** (see **Why two candidates were dropped** below).
- **Each hazard is its own `map.features` kind** in `src/game/features/`, sharing a small lifecycle helper (`src/game/features/hazards.js`) for the switch box + indicator lamp, interaction prompt, `ready → active → cooldown` state machine, `source: 'hazard'` damage helper, player-inside slow/hurt, and `reset()`.
- **Prices go through `g.pricing.priceOf('hazard', id)`**, backed by `economy.hazards` in `src/config/economy.js`, with a `'hazards'` Flash Sale group (`"Maintenance clearance — {pct}% off all mall hazard switches"`).
- **Kills flow through the existing `'kill'` event with `source: 'hazard'`** (`zombie.takeHit({ ..., source: 'hazard' })`). Nothing is paid or counted once `state.over` is true.
- **No changes to `src/game/createGame.js`**: `buildFeatures` already receives every system a hazard needs (`scene`, `map`, `events`, `pricing`, `interactions`, `player`, `stats`, `wallet`, `health`, `zombies`, `state`, `effects`, `sound`), and `features.update(dt)` / `features.reset()` already run in the live tick and in `resetRun()`.

---

## Assumed (say if you disagree)

- **Pricing & cooldowns**:
  - **Electrified Fountain**: `750` pts, `8 s` active (`0.4 s` pulse interval), `25 s` cooldown.
  - **Fryer Blast**: `750` pts, `6 s` active (`0.5 s` pulse interval), `25 s` cooldown.
  - **Fire Sprinklers**: `600` pts, `10 s` active (`0.5 s` pulse interval), `30 s` cooldown.
  - **PA System Lure**: `500` pts, `8 s` active (`0.5 s` pulse interval), `30 s` cooldown.
- **Round-proof lethality & Boss/Mascot cap**: Normal zombies take `Math.max(baseDamage, maxHealth * normalHealthFraction)` per pulse (`200` min / `55%` `maxHealth` on the Electrified Fountain, so early-round zombies are one-shot and even round 30 zombies die in 2 quick zaps). Bosses and Mascots cap per-pulse damage at `maxHealth * maxHealthCap` (`10%` per pulse on the Electrified Fountain), so a single activation takes a heavy chunk out of a Boss or Mascot without one-shotting a boss fight.
- **Friendly fire on the player**: Hazards that deal energy or heat damage (**Electrified Fountain**, **Fryer Blast**) lightly shock or scald a player standing inside the active zone (`6` damage per pulse on the fountain, plus a brief view jolt and `stats.surfaceSpeed` slow), while crowd-control hazards (**Fire Sprinklers**, **PA System Lure**) only wet-slow (`0.9`) or leave the player unharmed.
- **Words-only prompts**: Following `src/config/effectWords.js`, switch prompts and blocked states use plain words (`"Energizes the fountain basin and surrounding wet floor"`, `"Active"`, `"Recharging"`) and never show durations, radii, or percentages as numbers.

---

## The hazards

### Summary table

| Hazard (`id`) | Feature kind | Area (`zone`) & switch spot | Active zone | Price & cooldown | What it does to zombies | Player in it | Bosses & Mascots | Sight & sound |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Electrified Fountain** (`fountain`) | `fountainHazard` | **Grand Atrium** (`atrium`), breaker box on the south fountain rim at `(20, 1.28, 15.92)` facing `-Z` (above the `y = 0.55` fountain sign) | Circular wet apron + basin around `(20, 18.6)`, radius `7.0 m` | `750` pts · `8 s` active · `25 s` cooldown | Opening stagger surge + pulses every `0.4 s` for `max(200, 55% maxHealth)` shock damage (`source: 'hazard'`) + `applySlow(0.65, 0.25, 'shock')` | `6` shock damage per pulse (`health.takeDamage`), minor view jolt, `0.75` `stats.surfaceSpeed` slow while inside | Damage capped at `10%` of `maxHealth` per pulse; bosses scale slow by `type.slowStrength`; Mascot helmet pop does not pay `helmetPopBonus` | Energized `3.7 m` fountain jet + bowls + 4 waterfall sheets, expanding floor shockwave ripple, jagged 4-segment forked lightning bolts + spark bursts, industrial breaker box with voltage needle & beacon |
| **Fryer Blast** (`fryer`) | `fryerHazard` | **Food Court** (`foodCourt`), valve switch on **CORN DOG CORRAL** front counter at `(5.75, 1.05, -13.0)` facing `+Z` north | Rectangular stall apron `x: 2.5..9.0, z: -13.0..-6.5` | `750` pts · `6 s` active · `25 s` cooldown | Opening `max(180, 45% maxHealth)` scald burst + `max(120, 45% maxHealth)` burn damage every `0.5 s` (`source: 'hazard'`) + `applySlip(0.9, 0.8)` on the hot grease slick | `5` scald damage per pulse + `0.8` `stats.surfaceSpeed` grease slow while inside | Bosses ignore `applySlip` (`type.boss` guard in `zombie.js`); pulse damage capped at `10%` of `maxHealth` | Amber grease floor slick, sweeping hot-oil wave, glowing fryer vats + counter nozzles, orange/gold oil streams (`effects.tracer` + `effects.splat` + `effects.flash`), sizzle audio |
| **Fire Sprinklers** (`sprinklers`) | `sprinklerHazard` | **Main Hallway** (`hallway`), red fire pull station on south concourse wall at `(-3.9, 1.35, -1.95)` facing `+Z` north | Central concourse `x: -12..12, z: -2..6` | `600` pts · `10 s` active · `30 s` cooldown | Pulses every `0.5 s` for `max(60, 25% maxHealth)` cold-spray damage (`source: 'hazard'`), chills zombies (`applySlow(1.0, 0.45, 'smoothie')`), and soaks them (`applyVulnerable(1.2, 1.35)`) | No damage; `0.9` wet-tile `stats.surfaceSpeed` slow while inside | Soaked bosses and Mascots take `1.35x` weapon damage from `vulnerableMultiplier`; pulse damage capped at `6%` of `maxHealth` | Drenched concourse floor sheet, sweeping rain curtain, glowing ceiling sprinkler nozzles, overhead water-drop streaks (`effects.tracer`), floor mist flashes, chime + spray audio |
| **PA System Lure** (`paLure`) | `paLureHazard` | **Service Corridor** (`serviceHall`), paging box on west corridor wall at `(-23.1, 1.35, -4.5)` facing `+X` east | `10 m` radius around ceiling speaker at `(-21.5, -4.5)` | `500` pts · `8 s` active · `30 s` cooldown | Holds normal zombies in place with `applyHold(lureSource, 1.2)` every pulse, ending with a `70` damage feedback pop (`source: 'hazard'`) | Harmless to the player | Bosses ignore `applyHold` (`if (this.type.boss) return false;` in `zombie.js`); final pop capped at `5%` of `maxHealth` | Pulsing amber speaker beacon ring on the corridor floor, `paChime` broadcast + feedback pop |

---

### Why two candidates were dropped

1. **Toppling Shelves (dropped)**
   - **Navigation rebuild cost**: In `src/world/collision.js` and `src/zombies/navigation.js`, adding or moving a floor collider calls `markCollidersChanged(colliders)`, which rebuilds the entire multi-floor `0.5 m` Dijkstra flow field.
   - **Static batching conflict**: Mega Mart's gondolas (`x: 24, 27.5, 31`) and their 31 stocked product types (`src/maps/mall/megaMartDetails.js`) are merged into static draw batches at map load (`src/world/staticBatch.js`). Toppling a gondola would either leave hundreds of batched cans and boxes floating in midair or require unbatching an entire aisle and breaking `tests/megaMartDetails.test.js` and `tests/mall.test.js` aisle-route invariants.
2. **Escalator Reversal (dropped)**
   - **Ramp navigation model**: Escalators (`src/maps/mall/props.js`) are static extruded side walls + `InstancedMesh` steps + a static `colliders.ramps` entry and a `navigation.js` ramp link (`{ lower, upper, halfWidth }`). Zombies on a ramp walk straight toward the endpoint closer to the player without reading conveyor velocity.
   - **Static batcher test invariant**: `tests/staticBatch.test.js` asserts that every mesh in `map.group` with `mesh.userData.dynamic === true` (except `parking_sunset_sky` and `retail_unease_*`) is an escalator barrier part that becomes `!visible` when `escalatorRepair` opens. Re-rigging escalator step meshes as dynamic conveyor geometry would collide directly with that invariant.

---

## Payouts, Mascots, bosses, power-ups, and the player

Every hazard deals zombie damage through:
```js
zombie.takeHit({ damage, part: 'body', point: zombie.position, source: 'hazard' });
```
Because `source` is `'hazard'`, the existing systems in `src/game/createGame.js`, `src/game/powerUps.js`, `src/game/bossDirector.js`, and `src/game/features/workshopStuffings.js` already treat hazard hits and kills with the right rules:

1. **Kill payout (`createGame.js` lines 308–320)**:
   - Lethal hits set `zombie.killedBy = 'hazard'` and emit `'kill'` with `{ zombie, headshot: false, melee: false, source: 'hazard' }`.
   - `createGame.js` awards `pointsForHit({ target: zombie, killed: true, headshot: false, melee: false, killMultiplier, killPayMultiplier })` (`60` Shopper/Walker, `100` Mannequin, `130` Cart Pusher, `300` Mascot/Janitor, `750` Guard, `1000` Manager/Influencer), scaled by active **Blue Light Special** (`powerUps.killMultiplier`) and **Galleria Gold Card** (`stats.killPayMultiplier`), and increments `runStats.kills`.
   - Non-lethal hazard pulses do **not** emit `'hit'`, so they do not farm `+10` hit points per pulse.
   - Once the player dies (`state.over === true`), `createGame.js` ignores `'kill'` and hazards stop pulsing, so nothing is paid or counted after death.
2. **Mascot helmet bonus (`createGame.js` lines 324–329)**:
   - `mascotHeadPop` checks `const earned = source === 'melee' || (source === 'gun' && headshot)`.
   - When a hazard brings a Mascot to 50% HP, its helmet still pops off (releasing the head and triggering its costume rage/reclaim/Poppy Corn blast), but **does not pay** the `100` pt `helmetPopBonus` ("stuffings and hazards don't aim").
3. **Power-ups & Boss rewards (`powerUps.js` lines 147–173, `bossDirector.js` line 83)**:
   - The regular employee-incentive drop meter checks `if (source !== 'gun' && source !== 'melee') return;`, so hazard kills **do not fill the regular power-up meter**.
   - **Employee of the Month** (`zombie.type.guaranteedDrop`) and **Boss defeats** (`bossDirector.js`) listen to `'kill'` regardless of `source`, so finishing off a Gold Mascot or a Boss with a hazard still drops their guaranteed reward.
4. **Build-A-Blaster Hearts (`workshopStuffings.js`)**:
   - Gun Hearts (`everyTenth`, etc.) check `source === 'gun'` (or `stuffedBy`), so hazard kills never falsely trigger weapon-shot counters.

---

## How it fits the code

### Files

- `src/config/hazards.js` — all tunable numbers and words-only strings for the hazards (`fountain`, `fryer`, `sprinklers`, `paLure`).
- `src/config/economy.js` — `economy.hazards` base prices (`fountain: 750`, `fryer: 750`, `sprinklers: 600`, `paLure: 500`) and a `'hazards'` group in `economy.flashSales.groups`.
- `src/game/pricing.js` — adds `hazard` to `BASE` (`PRICE_CATEGORIES`) so `g.pricing.priceOf('hazard', id)` and Flash Sale discounts work identically to doors, weapons, and the claw machine.
- `src/game/features/hazards.js` — shared hazard framework (`createHazard`, `dealHazardDamage`): builds the switch box + indicator lamp, registers the `interactions.add` buyable (`kind: 'hazard'`), ticks `ready → active → cooldown`, applies player self-damage/slow, and resets cleanly on `resetRun()` or `playerDeath`.
- `src/game/features/fountainHazard.js` — Phase 1 feature kind (`fountainHazard`) for the Grand Atrium Electrified Fountain; registered in `src/game/features/index.js` and listed in `map.features` in `src/maps/mall/mall.js`.
- `src/game/features/fryerHazard.js` — Phase 2 feature kind (`fryerHazard`) for the Food Court Fryer Blast at Corn Dog Corral; registered in `src/game/features/index.js` and listed in `map.features` in `src/maps/mall/mall.js`.
- `src/game/features/sprinklerHazard.js` — Phase 3 feature kind (`sprinklerHazard`) for the Main Hallway Fire Sprinklers; registered in `src/game/features/index.js` and listed in `map.features` in `src/maps/mall/mall.js`.

### Constraints checked

1. **`tests/staticBatch.test.js` (`userData.dynamic` rule)**:
   - `staticBatch.test.js` filters `meshes(map.group)` where `m.userData.dynamic === true` directly on a `Mesh` and asserts they all hide when `escalatorRepair` opens.
   - Hazard switches and active visual rings are added to `ctx.scene` inside a parent `THREE.Group` marked `rig.userData.dynamic = true` (never flagging child `Mesh` objects inside `map.group`).
2. **`src/fx/lightPool.js` (real `PointLight` cap)**:
   - `lightPool.js` collects map `PointLight`s once at startup and caps active lights to `MAX_ACTIVE_LIGHTS = 8`.
   - Hazards never create `THREE.PointLight` at runtime; they use unlit `MeshBasicMaterial` / emissive indicator materials plus `effects.flash()` and `effects.tracer()`.
3. **`tests/coplanar.test.js` (4 mm z-fighting rule)**:
   - The fountain breaker switch at `(20, 1.05, 15.95)` sits above the `0.65 m` fountain rim and well clear of the `"PLEASE DO NOT FEED THE FOUNTAIN"` sign at `y = 0.25..0.51`, with all child box faces separated by `>= 2 cm`.
4. **`tests/effectWords.test.js` (words-only rule)**:
   - Every prompt `label`, `title`, `detail`, `blocked`, and Flash Sale PA line is free of stat numbers (`8s`, `6m`, `50%`, `1.5x`) and multiplier words (`half`, `double`, `twice`).
5. **No moving colliders (`src/zombies/navigation.js`)**:
   - None of the 4 chosen hazards add, remove, or move a collider in `colliders`, so `markCollidersChanged` is never triggered at runtime.

---

## Phases

1. **Phase 1 (built)**:
   - Shared hazard config (`src/config/hazards.js`), pricing category + Flash Sale group (`src/config/economy.js`, `src/game/pricing.js`), shared hazard lifecycle module (`src/game/features/hazards.js`), and the **Electrified Fountain** (`src/game/features/fountainHazard.js`, `src/game/features/index.js`, `src/maps/mall/mall.js`) + full headless integration tests (`tests/hazards.test.js`) and doc updates.
2. **Phase 2 (built)**:
   - **Fryer Blast** (`src/game/features/fryerHazard.js`) at Corn Dog Corral in the Food Court.
3. **Phase 3 (built)**:
   - **Fire Sprinklers** (`src/game/features/sprinklerHazard.js`) at the Main Hallway south fire pull station.
4. **Phase 4 (later session)**:
   - **PA System Lure** (`src/game/features/paLureHazard.js`) in the Service Corridor.

---

## Tests to add

In `tests/hazards.test.js` using `tests/helpers/headlessGame.js` (building the map before any `Math.random` seeding):
1. **Triggering & price**: Standing at the Grand Atrium fountain switch in an unlocked Atrium shows the prompt at `pricing.priceOf('hazard', 'fountain')`; holding `KeyF` charges the wallet (and respects a `'hazard'` discount / Flash Sale) and activates the fountain.
2. **Cooldown**: While active (`'Active'`) and while recharging (`'Recharging'`), the prompt is blocked and holding `KeyF` does not charge or re-trigger; once `durationSeconds + cooldownSeconds` elapse, the switch is ready again.
3. **Payout & `source: 'hazard'` rules**:
   - Zombies in the fountain ring take shock damage and slow on each pulse; lethal pulses emit `'kill'` with `source: 'hazard'` and pay base `killValue` (scaled by `killPayMultiplier` / Blue Light Special) without paying `+10` non-lethal hit points.
   - Popping a Mascot's helmet with the fountain does **not** pay `economy.payouts.helmetPopBonus`.
   - Hazard kills do **not** advance the regular power-up meter, while an Employee of the Month (`guaranteedDrop`) still drops its power-up.
   - Boss and Mascot per-pulse damage is capped by `maxHealthCap`.
4. **Player standing in the hazard**: Standing inside the active fountain ring deals shock damage per pulse and slows `stats.surfaceSpeed`; stepping outside or waiting for the hazard to finish restores `stats.surfaceSpeed` to `1`.
5. **Death & Play again (`resetRun`)**:
   - Once the player dies (`state.over`), no further hazard damage or kill points are paid.
   - `g.resetRun()` clears active/cooldown timers, hides active visuals, restores `stats.surfaceSpeed`, and matches a fresh `snapshot(g)`.
6. **Words-only guard**: Every string in `src/config/hazards.js` and the live fountain prompt passes `hasStatNumber` / words-only checks.

---

## Rules to keep

- All hazard numbers live in `src/config/hazards.js`; base prices live in `src/config/economy.js` and are read through `g.pricing.priceOf('hazard', id)`.
- Never create `THREE.PointLight` at runtime; never move or add colliders at runtime; never set `userData.dynamic = true` directly on a `Mesh` inside `map.group` (only on a parent `THREE.Group`).
- Build the map (`headlessGame()`) before seeding `Math.random` in tests.
- Keep `docs/folder-structure.md`, `docs/tests.md`, `docs/map.md`, and `docs/history.md` in sync so `tests/docs.test.js` passes.
