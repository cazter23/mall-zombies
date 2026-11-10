# Weapon skins: plan for per-gun looks earned by challenges

Status: PLAN ONLY (10 November 2026). Nothing here is built. Checked against main at a4cb9d2. Every number and every challenge is a
starting point for `src/config/skins.js`, to be tuned in phase 8. Build one phase at a time, each in its own worktree.

## Decided by the user (10 November 2026)

1. **Skins are per gun.** A skin belongs to one gun and is earned with that gun.
2. **Three skins and three challenges per gun, for now.** One challenge unlocks one skin.
3. **Every skin must work with Build-A-Blaster.** A built gun shows its skin and its build together.
4. **Closing Time gives skins too:** one reward for winning on Directed, a better one for winning on Classic.

## Assumed (say if you disagree)

- **Skins change looks only.** No stat, price, sound or tracer changes. Nothing in `player/stats.js` or `weapons/gunStats.js` is touched.
- **Eleven guns, 33 skins.** The box cutter gets none in this plan (it has no palette or build today).
- **The three slots are the same on every gun**, rising in difficulty and in how much the gun changes (see "The three slots").
- **The Closing Time rewards are two treatments that fit every gun**, not 22 hand-made skins: one win unlocks that treatment on all eleven.
  A Classic win also unlocks the Directed one. They are skins 4 and 5 in each gun's locker.
- **You choose skins between runs**, in a locker screen off the title. A gun bought, won or built mid-run arrives in the skin you chose for it.
- **Progress and unlocks are permanent** and kept in their own save, not in the career stats save.
- **Debug-assisted runs earn nothing**, the same rule as career records (`state.assisted`).
- **Wall displays and the claw's prizes stay in the default look.** Your skin shows on the gun in your hands and on your own gun while it
  rides the Build-A-Blaster conveyor.

## What the code already gives us

- **A gun's colours are data.** Each gun's `viewmodel` entry in `config/weapons.js` holds its colours, and the model builder
  (`weapons/models/<gun>.js`) makes its materials from them when the model is built (`viewmodel.js` calls `buildWeaponModel(def)`).
  So a skin is a second set of those colours.
- **A build is drawn on top and never recolours the gun.** `weapons/models/buildVisual.js` adds the patch, the seam, the lumps and the Heart
  badge at the gun's `sticker` mount; its header says the model itself is never changed. The warranty collar and tag, the loaner tag and
  the attachments are add-ons in the same way (`upgradeParts.js`, `warrantyTrim.js`, `loanerTag.js`).
- **So the rule is: the skin is the base coat, everything else sits on it.** No system has to hide or choose.

What is NOT uniform today, and is the real work:

- **Two generations of model.** The Staple Gun, Price Gun and Nail Gun read a `colors` object and also have two or three colours written
  into the model file. The newer guns read `vm.bodyColor`, `vm.darkColor`, `vm.accentColor` and so on, with different key names per gun.
  Return to Sender has six colours written into its file.
- **Some guns carry printed textures** (the Staple Gun, Price Gun, Nail Gun, Foam Dart Blaster and Confetti Cannon each make canvas
  textures: brand labels and the like). A recolour has to decide what those do.
- **A kill does not say which gun made it.** `'shot'` and `'reload'` carry `weaponId`; `'kill'` carries only
  `{ zombie, headshot, melee, source }`. A stuffing's burn, a tennis ball in the air or a gun swapped mid-shot can all kill after the
  trigger was pulled, so "the gun in hand" is not a safe answer.
- **Colour rules already exist.** `tests/upgradeColors.test.js` and `config/gunStyle.js` keep warranties metal, builds candy-coloured and
  attachments in their shop's colours. A skin must not make any of those unreadable.

## The three slots

| Slot | Name | The challenge is | The skin is | Costs to build |
|---|---|---|---|---|
| 1 | Mastery | Kills with the gun, added up over all runs | A recolour | A palette entry |
| 2 | Role | Using the gun the way it is meant to be used | A recolour with a printed pattern | A palette and one texture |
| 3 | Feat | One hard thing inside a single run | A recolour with glow or motion | A palette and a shared treatment |

- **Treatments are shared code**, three or four in all (pulse, shimmer, edge glow, slow colour drift), each driven by numbers in config.
  Eleven feat skins pick from them; nobody writes eleven effects.
- **Patterns keep off the left face**, where the build patch, the warranty seal and the loaner tag live. They go on the top and right.
- **A gun's printed brand label survives every skin** unless the skin says otherwise, so the gun stays recognisable.

## Starting challenges

Slot 1 is the same shape on every gun: **400 kills with it across all runs** (Return to Sender: 150, it is rare). Slots 2 and 3 below are
first guesses written from each gun's name and place in the mall, NOT from its numbers. Phase 5 must check every one against
docs/weapon-balance-pass.md and `npm run balance` so that each is possible, and hard in the way intended.

| Gun | Slot 2: Role | Slot 3: Feat (one run) |
|---|---|---|
| Staple Gun | 100 headshot kills from round 10 on | Reach round 15 having never bought, won or been handed another gun |
| Price Gun | 150 kills on zombies that were at full health when hit | Kill a boss with only the Price Gun |
| Nail Gun | 25 magazines emptied with every nail hitting | 60 kills in one round |
| Foam Dart Blaster | 150 kills from 15 m or more | A round from round 12 on with every kill a headshot |
| Confetti Cannon | 40 blasts that each kill four or more | Kill a Mascot with one blast's worth of damage after its helmet is off |
| Rivet Rifle | 200 headshot kills | 20 headshot kills in a row without a body shot |
| Heavy Coil Nailer | 50 Mascot or Cart Pusher kills | Kill two bosses in one run with it |
| Barcode Scanner | 150 kills on Mall Walkers | A whole round with no missed shot |
| Leaf Blower | 100 zombies pushed into a hazard, a ledge drop or each other | Finish a round having taken no damage, kills with the blower only |
| Tennis Ball Launcher | 60 kills by a ball that had already bounced | Three kills with one ball |
| Return to Sender | 10 bosses hit by a beam | Return the Last Customer with it (needs Closing Time phase 9) |

Rules for every challenge:

- **Counted from events, never from polling.** A challenge listens on the bus and adds to a counter.
- **A feat is decided at the end of its run or round**, and is lost with the run if it has not been met.
- **Progress shows in the locker** as a count ("212 / 400") or, for a feat, as its best attempt.
- **Nothing is hidden.** Every challenge is readable in the locker from the start, with the skin shown greyed out.
- **A challenge that needs a system that may be cut** (hazards, the claw, Closing Time) is marked so in config and can be swapped.

## The Closing Time rewards

| Earned by | Treatment | Look |
|---|---|---|
| A win on Directed (Clock out or a later death both count) | **Employee of the Month** | Polished brass body, dark grip, a small name badge |
| A win on Classic | **After Hours** | Near-black body, sunset-gradient edges that glow. Also unlocks Employee of the Month |

- These wait for the Closing Time fix pass. Today the run summary does not record which mode was played, and that pass is rewriting
  the code that records a win (createGame.js `onRunWon`, `clockOut`, the quit path). The hook is one field on the summary (`closingMode`)
  and one listener on `'runEnd'`.
- "Better" for Classic means the more striking look and getting both. It does not mean anything that affects play.
- Later ideas, not in the phases below: a third treatment for a Classic win plus five overtime rounds; one for a fast win.

## How it fits the code

- **`src/config/skins.js`** (new): per gun, its skins `{ id, name, slot, palette, pattern?, treatment?, challenge }`; the treatments'
  numbers; the two reward treatments; the locker's words. A palette is written in ROLES (`body`, `dark`, `metal`, `grip`, `accent`,
  `sight`, plus any a gun needs), not in the guns' own key names.
- **`src/weapons/skinPalette.js`** (new): `resolveGunColors(def, skinId)` returns the `viewmodel` colour set a model builder reads, with
  the skin's roles mapped onto that gun's keys. THE one place a skin becomes colours, the way `gunStats.js` is for damage. Skins never
  edit `config/weapons.js` entries.
- **Model builders** take their colours from `resolveGunColors` instead of from `def.viewmodel` directly, and lose their written-in
  colours (each becomes a named role with the same default value, so the default look does not change by one pixel).
- **`src/weapons/models/skinTreatments.js`** (new): the shared glow and motion treatments, run from the model's existing
  `animate(state)`. No lights (the light pool is full enough); emissive materials only.
- **`src/game/skins.js`** (new, `g.skins`): which skin each gun wears this run, read from the save when the run starts. `playerGun` asks
  it when a gun is given; the viewmodel and the workshop ritual's conveyor model ask it when they build. No per-run state beyond that
  choice, so its `resetSteps` entry only re-reads the save.
- **`src/game/challenges.js`** (new, `g.challenges`): built and ticked in createGame.js, DOM-free. It listens (`'kill'`, `'shot'`, `'hit'`,
  `'roundStart'`, `'bossDefeated'`, `'runEnd'`...), keeps the per-run counters for feats (one `resetSteps` entry), and reports
  finished challenges. It ignores everything while `state.assisted` is set, and nothing counts once `state.over`.
- **`src/game/skinSave.js`** (new): the permanent record `{ version, progress, unlocked, equipped }`, with the injected-storage pattern of
  `careerStats.js` so it tests in Node. Its own localStorage key. Written when a challenge finishes and at `'runEnd'`, not every kill.
  An unknown NEWER version is left untouched in storage (the lesson from the career stats review).
- **One change to a shared system:** `'kill'` gains `weaponId` when a gun or its build made the kill (the firing gun is already captured
  on the shot in `playerGun.js`; stuffing and projectile kills must carry it through). This is the risky edit: it touches the kill path
  every payout uses. Payouts and stats must not change.
- **Events it announces** (to add to game/events.js): `'challengeProgress' { gunId, skinId, count, needed }`,
  `'skinUnlocked' { gunId, skinId, pa }`. The PA line and a HUD toast listen; nothing is threaded through createGame.
- **Browser side** (`ui/`): a locker screen off the title (a gun list, its five skins, each challenge and its progress, a turning
  preview built with `buildWeaponDisplay`), an "unlocked" toast in play, and a line on the receipt for skins earned that run.
- **Tests:** tests/skins.test.js and tests/challenges.test.js (described in docs/tests.md, or tests/docs.test.js fails).

## Build-A-Blaster and the other add-ons

- **Order of layers:** skin (base coat), then warranty trim, attachments, the build's patch, seam and lumps, the Heart badge, the loaner tag.
- **Every skin is checked against all six stuffings.** The patch takes the stuffing's colour, so a skin whose body is close to a stuffing's
  colour swallows the patch. A test compares each skin's body colour with each stuffing's and fails under a set contrast; a skin that
  fails gets a darker or lighter body, the stuffing colours do not move.
- **Limited Editions** (Party Trap, Clearance Rack) are builds on one gun each and follow the same rule.
- **A named gun keeps its name and certificate**; the certificate may name the skin it was built in.
- **Treatments must not fight the build's own glow** (`gunStyle.glow`): a glowing skin is dimmer than a glowing seam, by a number in config.
- **The Platinum warranty look stays readable on every skin** (same contrast test, against the tier colours).

## Phases

Each phase leaves the game working. Phases 1 to 6 touch none of the files the Closing Time fix pass edits, so they can run beside it.

| # | Phase | What exists afterwards | Main files (shared files in bold) | Risk |
|---|---|---|---|---|
| 1 | The base coat, on two guns | `resolveGunColors`, config/skins.js with one recolour each for the Staple Gun (old model style) and the Rivet Rifle (new style), a debug command to wear one. Shown right with every stuffing and warranty tier | config/skins.js, weapons/skinPalette.js, models/stapleGun.js, models/rivetRifle.js, weapons/viewmodel.js, **debugCommands.js** | Low |
| 2 | Every gun answers to its palette | The other nine models read roles only; written-in colours gone; the default look unchanged (a test compares every material's colour before and after) | weapons/models/*.js | Medium: nine files, easy to shift a default by accident |
| 3 | Kills name their gun | `weaponId` on `'kill'`, carried through stuffing and projectile kills | **createGame.js**, **events.js**, playerGun.js, features/workshopStuffings.js, the ball and throwable paths | High: the kill path. Full suite, not test:quick |
| 4 | Challenges and the save | `g.challenges`, the save, the two events, slot 1 (mastery) counting for every gun; a PA line and toast on unlock | game/challenges.js, game/skinSave.js, **createGame.js**, **events.js**, ui/hud.js | Medium |
| 5 | The locker, and slot 1 skins | The locker screen; choosing a skin; eleven mastery recolours; the contrast test against stuffings and tiers | ui/locker.js, **ui/screens.js**, **main.js**, game/skins.js, config/skins.js | Medium: a new screen in the title flow |
| 6 | Slot 2: role challenges and pattern skins | Eleven role challenges, checked against the balance report; eleven pattern skins | game/challenges.js, config/skins.js, weapons/models/ (pattern textures) | Medium: art time |
| 7 | Slot 3: feats and treatments | The shared treatments; eleven feats; eleven feat skins | weapons/models/skinTreatments.js, game/challenges.js, config/skins.js | Medium |
| 8 | Measure and tune | A bot or saved runs: how many runs each challenge takes, which are never met, which are met by accident. Numbers set from that | tools/, config only | Low |
| 9 | Closing Time rewards | `closingMode` on the run summary; the two treatments on every gun; unlocked by a win | **createGame.js**, game/challenges.js, config/skins.js | Low, but AFTER the Closing Time fix pass has merged |

Notes for whoever builds a phase:

- **Phase 1 is the proof.** If a skin, a build, a warranty tier and an attachment do not all read clearly on those two guns, stop and
  say so before the other nine are touched.
- **Phase 2**: do not tidy the models while you are in them. The test is that nothing changes.
- **Phase 3** can be built at any time before phase 4, and is worth doing even without skins (the receipt and career stats could use it).
  Once the player is dead nothing more is counted; a hit on a corpse is still skipped.
- **Phase 5** adds a screen to the same title flow the Closing Time modes work changed (`ui/screens.js`, `main.js`). Build it after that
  work has merged, or expect to merge by hand.
- **Phases 6 and 7** are mostly art. One gun's two skins is a sensible size for one sitting; they can be split across worktrees by gun.
- **Phase 9** depends on Closing Time phases 1 to 6 and their fixes being in main. Return to Sender's feat depends on Closing Time phase 9.
- **Every phase:** numbers and words in `src/config/`, a history entry, folder-structure lines for new files, `npm run build`, and the
  browser check on a built gun. After phase 3, `npm test` in full.

## Risks

- **33 skins is a lot of looking.** The code is small; choosing 33 palettes that suit eleven guns, six stuffings and four tiers is not.
  Slot 1 alone (phase 5) is already a complete feature, and the plan can stop there.
- **Readability in a fight.** The gun fills a corner of the screen all run. A loud skin under a loud build under a glowing seam can become
  noise. docs/ui-readability.md is the judge, and Comfort settings should be able to calm the treatments.
- **Feats that cannot be seen failing.** "No missed shot this round" is lost on the first miss, and the player should know. Decide in
  phase 7 whether a feat in progress shows on the HUD; the HUD is already full.
- **Challenges that bend play.** "Never buy another gun" asks for a bad run on purpose. That is fine for one skin per gun, not for all three.
- **Grind.** 400 kills is about three to five runs with a main gun and far longer with a side gun. Phase 8 measures it.
- **The kill-path change** (phase 3), as said above.
- **Performance.** A treatment that animates a material every frame on a gun that is always on screen must cost nothing measurable;
  check draw calls and the benchmark before and after.
- **Three saves in localStorage** (settings, career, skins), each with its own version rule. Keep the skin save's rule written in one place.
