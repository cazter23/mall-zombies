# Plan for Codex: two new wall-buy guns (Foam Dart Blaster + Confetti Cannon)

> Archived: this work is finished and merged into main. Kept as a record; the code and docs/folder-structure.md are the current truth.

Read `CLAUDE.md` first (folder structure + "How the pieces connect"). Existing guns to copy the style of:
`stapleGun`, `priceGun`, `nailGun` in `src/config/weapons.js`, their models in `src/weapons/models/`, their
sounds in `src/config/audio.js`.

## Goal
Add two guns bought off the wall, one per new area. Today the player has 3 guns: a pistol, a full-auto SMG-like gun and
a piercing semi-auto. Missing roles: a **burst rifle** (accurate, mid range) and a **close-range shotgun**.

| | Foam Dart Blaster | Confetti Cannon |
|---|---|---|
| Where | Mega Mart (door 750), wall spot already reserved: `wallbuy_megaMart` | Service Corridor (door 1250), wall spot already reserved: `wallbuy_serviceCorridor` |
| Id | `foamDartBlaster` | `confettiCannon` |
| Role | accurate 3-round burst, mid range, strong headshots | point-blank shotgun, huge close, weak far |
| Price (weapon / ammo) | 1200 / 600 | 1500 / 750 |

The wall-buy spots and the prices (`economy.wallBuys.foamDartBlaster` / `.confettiCannon`) are ALREADY in `main`
(inert until the guns exist in `config/weapons.js`). **Do not edit the map** (`src/maps/**`, `src/world/**`).
`main.js` already turns any wall-buy marker whose weapon exists in `config/weapons.js` into a display + a buy prompt.
So once the guns exist the buy spots just work. Adding a gun = config entry + model file + 1 registry line + sounds.

## Working setup (important: Claude is editing the same repo at the same time)
- Work in a **separate git worktree and branch**, not in this folder:
  `git worktree add ../mall-zombies-guns -b codex/new-guns` (from `main`). Run `npm install` there.
- You may touch ONLY: `src/config/weapons.js`, `src/config/audio.js`, `src/config/economy.js` (prices only, if you
  retune), `src/config/feel.js` (only if a number is truly shared), `src/weapons/**`, `src/audio/sound.js` (only if a new
  sound feature is needed), `src/fx/effects.js` (only for pellet/confetti effects), `src/ui/hud.js` + `src/main.js` (only
  the one crosshair line below), `tests/**` (new files + the weapon tests), and the **weapon-related lines of CLAUDE.md**.
- Do NOT touch: `src/maps/**`, `src/world/**`, `src/zombies/**`, `src/game/interactions.js`. Claude is working there.
- Do not commit; leave the branch for review ("save it" = the user's word for a commit).

## Engine feature A: burst fire (`fireMode: 'burst'`)
Files: `src/weapons/weapon.js`, `src/weapons/playerGun.js` (how the trigger is read), `src/weapons/aim.js` (bloom per shot).
- New config on a gun: `fireMode: 'burst'`, `burst: { count: 3, interval: 0.07 }` (seconds between darts inside a burst),
  `fireInterval` = the pause after the LAST dart before the next burst can start.
- One fresh trigger press starts one burst. Holding the trigger does NOT start another burst (like `semi`); a click during
  the cooldown is buffered with the existing `fireBuffer`.
- Ammo is spent per dart. If the magazine empties mid-burst the burst just stops (no dry-click spam), and the usual
  auto-reload / dry-click rules apply on the next press.
- Weapon switch, melee, vault, or `blocked` aborts the rest of a burst (no darts fire later while the gun is lowered).
  Reload can't start mid-burst; a reload request waits for the burst to finish or is dropped (your choice, document it).
- Every dart is its own shot: `weapon.update` returns `'fire'` once per dart, so recoil, bloom, muzzle flash, tracer,
  sound and points all happen per dart with no special casing. Cooldown carries leftover fractions of a tick like the
  existing guns (real rate = the configured intervals).
- Reset (new run) clears any burst in progress.

## Engine feature B: multi-pellet shots (`pellets`)
Files: `src/weapons/playerGun.js` (the shot), `src/weapons/hitscan.js` (probably untouched), `src/fx/effects.js`.
- New config: `pellets: { count: 8, spreadDegrees: 5.5, falloff: { start: 4, end: 14, minMultiplier: 0.2 } }`.
- One trigger pull casts `count` rays. Each ray = the normal aimed direction (view kick + `aim.applySpread`, exactly as
  now), then an extra random offset inside a cone of `spreadDegrees`. Keep `aim.spread.base` small so the pellet cone is
  the pattern. Hitscan against world colliders and shootables as now; walls stop pellets.
- Damage per pellet = `damage` x headshot multiplier x `stats.damageMultiplier` x distance falloff (1 up to `start` m,
  linearly down to `minMultiplier` at `end` m and beyond), measured eye to hit point.
- **Points: once per zombie per shot, not per pellet** (otherwise a blast pays 80). A zombie hit by any pellet gives the
  usual +10 once; a kill gives the usual kill bonus once; it is a headshot kill bonus if the killing pellet hit the head.
  Call `onHit` once per zombie per shot with `{ killed, headshot }` aggregated.
- Effects: one splatter burst per zombie per shot (not per pellet); at most 4 wall puffs per shot; one hit marker per shot;
  tracers: one per pellet is fine if the pooled tracers cope (check `effects.js` pool size, raise it if needed).
  Fire sound/flash/recoil once per shot.
- **Crosshair**: the gap must show the pellet cone. In `src/main.js` (the line computing `halfSpread` from
  `gun.aim.spreadDegrees`) add the gun's `pellets.spreadDegrees` (0 if none). In ADS the cone should tighten
  (`pellets.adsMultiplier`, default 0.5, add to config) so aiming matters.
- Does not combine with `pierce` (guns use one or the other); throw a clear error if a def has both.

## Gun 1: Foam Dart Blaster (config entry `foamDartBlaster`)
Starting numbers (Claude will tune after a playtest; keep them in config, never hardcoded):
- `fireMode: 'burst'`, `burst: { count: 3, interval: 0.07 }`, `fireInterval: 0.35`, `fireBuffer: 0.12`.
- `damage: 45`, `headshotMultiplier: 3`. Round 1 zombie (150 HP): 4 body darts (a burst + 1) or 2 head darts.
- `magazineSize: 24` (8 bursts), `startingReserve: 144`, `reloadTime: 1.9`, `range: 100`.
- Spread: tight (`base ~0.8`, `moving ~2.2`, `perShot ~0.45`, `maxBloom ~2.2`, ADS multiplier ~0.05): rewards controlled
  bursts. ADS: `fovMultiplier ~0.8`.
- Recoil: small kick per dart that stacks across the burst (pitch ~0.55 deg per dart, a little yaw wander).
- Look/feel: a chunky toy blaster in the Mega Mart blue (`COLORS.megaMartBlue` 0x1d4e89) and yellow (0xffd23f) with an
  orange muzzle ring, a round dart drum on top/left, foam darts visible in the drum. Muzzle flash: small, white-orange puff.
  Tracer: a short bright orange streak (`tracerColor`).
- Sounds (add recipes to `src/config/audio.js`): `foamShot` (a soft pneumatic "pfft" + a plasticky tick, quiet next to
  the other guns), `foamReloadOut` (clip pops out), `foamReloadIn` (a new drum slaps in, with a jolt), `foamReloadReady`
  (a click/rack). Reuse `dryClick` for dry fire.
- Reload animation: tip the gun, left hand pulls the drum off and slaps a fresh one on (copy the structure of
  `nailGun` `gunKeys` / `handKeys` / `events`).

## Gun 2: Confetti Cannon (config entry `confettiCannon`)
- `fireMode: 'semi'`, `pellets: { count: 8, spreadDegrees: 5.5, adsMultiplier: 0.5, falloff: { start: 4, end: 14, minMultiplier: 0.2 } }`.
- `damage: 22` per pellet, `headshotMultiplier: 2` (per pellet; a point-blank blast is ~176 body, so it kills a round-1
  zombie (150) when ~7 of 8 pellets land, and is much weaker beyond ~10 m).
- `magazineSize: 2` (two barrels), `startingReserve: 30`, `fireInterval: 0.55`, `reloadTime: 2.4` (break open, two
  shells in, snap shut), `range: 60`.
- Big kick: pitch ~3.5 deg, a hard gun-model kick, slow settle. ADS `fovMultiplier ~0.85`.
- Look/feel: a stubby double-barrel party cannon (two fat tubes side by side, pink and purple stripes, gold rim, a short
  stock), reads like a party-popper-meets-shotgun. Muzzle flash: BIG, pink + yellow burst. Pellet tracers: pink / gold.
  A small confetti splatter on zombies (reuse their `splatColors`; no new gore).
- Sounds: `confettiShot` (a loud party-cannon BOOM with a paper-rustle noise tail), `confettiReloadOut` (barrels break
  open), `confettiReloadIn` (shell, shell), `confettiReloadReady` (snap shut).
- Reload animation: break open (barrels drop), left hand slides two shells in, snap shut.

## Models (`src/weapons/models/`)
New files `foamDartBlaster.js` and `confettiCannon.js`, each exporting `buildXModel(def)` and `buildXDisplay(def)` exactly
like `nailGun.js` (model interface in `models/index.js`), plus the two registry lines there. Use boxes/cylinders like the
others (low-poly look), colors from the gun's config `viewmodel` block. The display builder = the gun alone for the wall.

## Tests (add to `tests/`, run `npm test`)
1. Burst: one press fires exactly 3 darts at the configured intervals; ammo drops by 3; holding the trigger gives one
   burst; a buffered click during cooldown starts the next burst; magazine empty mid-burst stops cleanly; switching away
   mid-burst fires nothing later; reset clears it.
2. Pellets: a blast casts `count` rays; falloff is 1 at/below `start`, `minMultiplier` at/above `end`, linear between;
   per-pellet headshots; walls stop pellets; points are paid once per zombie per shot (a zombie hit by 8 pellets gives +10,
   not +80) and the kill bonus once; a def with both `pierce` and `pellets` throws.
3. Shots to kill table for rounds 1, 2, 5 and 9 for both guns (use `zombieHealthForRound`) asserted against the numbers
   above, so a later retune is a deliberate change.
4. Wall buys with the real mall (copy the pattern in `tests/interactions.test.js`): with the right door open, each gun can be
   bought from where you stand at its spot, and not through the wall.
5. Every gun in `config/weapons.js` has a registered model (+ display), sounds that exist in `config/audio.js`, and prices in
   `economy.wallBuys`.

## Acceptance (what "done" means; report each)
- `npm test` all green, `npm run build` clean.
- In `npm run dev` (use `window.__mall`, see CLAUDE.md "Testing hook"): buy each gun with a real held F, fire it, ADS, reload
  it, switch to/from it (2 slots, COD rules), refill ammo at the wall. Screenshots of both models (hip + ADS), both wall
  displays, and a blast hitting a zombie at 2 m and at 12 m.
- Update the weapon lines of `CLAUDE.md` (weapons.js / audio.js / models/ / weapon.js / playerGun.js / the "Current state"
  paragraph) in the same style as the nail gun's.
- A short list of any numbers you changed and why, and anything that felt wrong.
