# Bosses 2 delivery report

> Archived: this work is finished and merged into main. Kept as a record; the code and docs/folder-structure.md are the current truth.

Implemented the Manager, Guard and Influencer, shared controls/buffs/holds/vouchers, approved encores, costumes, unique stings, cartoon deaths and balance rows. Murray retains his original wet-floor and combat behavior.

Branch: `codex/bosses-2`. Worktree: `.claude/worktrees/bosses-2`. At initial delivery, nothing was merged into main. Main was integrated before phase 2; both conflicts preserved the concurrent order-form feature. Later phase boundaries checked main and found no further changes.

After delivery, the user requested the merge. Main's subsequent Build-A-Blaster detail pass (`3fed655`) integrated without conflicts; the combined result passed all 812 tests and the production build before updating main.

## Verification

Every phase ran the full `npm test` suite and `npm run build` before its commit.

| Phase | Commit | Tests passed |
| --- | --- | ---: |
| 1 | `e9737e2` | 780 |
| 2 (including main integration) | `7c09ca7` | 787 |
| 3 | `c0f4661` | 793 |
| 4 | `50dfdec` | 800 |
| 5 (approved encores) | `ae11020` | 802 |
| 6 | `final branch HEAD` | 807 |

The final `npm run balance` succeeds and includes boss rows. At their earliest debut: Murray 2700 HP / 300 kill points, Doug 7500 / 750, Dennis 9320 / 1000, Skylar 9256 / 1000. The report labels its theoretical base-gun comparison; health and attack tuning remain the requested starting values pending player feedback.

Isolated headless Chrome rendered all four bosses with zero runtime exceptions. Visual inspection corrected the ring-light pose and moved/rotated the whiteboard beside Dennis. The temporary browser profiles and preview servers were closed; no real browser tabs were opened. Captures remain in the worktree's ignored `scratch/boss-previews/` folder.

Coverage includes exact meeting cancellation, independent buff expiry, all hold/lockdown exit paths, every-area shutter queries and preserved ownership, occupied shutters, third-headshot radio breakage, quota backup and round completion, reward-free fans, independent upstairs filming routes, visible/reachable filming cells in all open zones, flash Comfort behavior, voucher conversion/stacking/booth and door use, actual Employee Discount expiry, direct order-form purchases, and fan exclusion from ritual credit. Manager and Guard physically traverse every open zone and the workshop route without rescue teleports.

## Adaptations recorded in the plan

- Signed Approval applies to carried guns through Premium. Its exhausted-kind conversion is 1500 points; Master Key converts to 1250. A second voucher pickup waits while the independent slot is occupied.
- Three headshots permanently break the Guard's radio for that encounter. Lockdown uses only physical shutters and never changes ownership.
- Small rooms use the best visible reachable filming cell when 10–16 m separation is impossible. Fans trigger each threshold once per viral cycle; pending requests cap at 17, and surviving fans leave two seconds after Skylar dies without kill events.
- Encores begin at round 20 every four rounds. They use encountered bosses, skip type/Mascot debuts, and prefer an alternative known boss where possible.

## Try it

Run `npm run dev` from this worktree. During play, Shift+J selects the next boss and J summons it once per round; N discards the current round for another attempt. G toggles god mode and O opens the mall. The debug overlay shows the selected boss.

Explicit browser console calls: `__mall.g.debug.run('summonBoss', 'manager')`, `'guard'`, `'influencer'` or `'janitor'`. Settings → Comfort → Dim instead of phone flashes changes the flash to dimming; Calm enables it.

## Every shared file authored on this branch

The following existing files were authored on this branch. Files brought in unchanged by the main merge are excluded.

- `docs/archive/boss-zombies-plan.md`
- `docs/folder-structure.md`
- `docs/history.md`
- `docs/tests.md`
- `src/config/audio.js`
- `src/config/bosses.js`
- `src/config/debug.js`
- `src/config/economy.js`
- `src/config/settings.js`
- `src/fx/powerUpView.js`
- `src/game/bossDirector.js`
- `src/game/createGame.js`
- `src/game/debugCommands.js`
- `src/game/events.js`
- `src/game/features/limitedEditions.js`
- `src/game/features/workshopRitual.js`
- `src/game/features/workshopStuffings.js`
- `src/game/incentiveEffects.js`
- `src/game/powerUps.js`
- `src/game/pricing.js`
- `src/game/rounds.js`
- `src/game/runStats.js`
- `src/game/wallet.js`
- `src/maps/index.js`
- `src/ui/debugPanel.js`
- `src/ui/hud.js`
- `src/ui/retail.css`
- `src/world/shutter.js`
- `src/zombies/bosses/janitor.js`
- `src/zombies/navigation.js`
- `src/zombies/zombie.js`
- `src/zombies/zombieManager.js`
- `src/zombies/zombieModel.js`
- `tests/bosses.test.js`
- `tools/gunReport.mjs`

- `src/game/interactions.js` — phase 1 transaction context was later removed when voucher consumption moved to the shared purchase event; its final content matches integrated main.

## New files

- `docs/archive/bosses-2-report.md`
- `src/game/bossVouchers.js`
- `src/maps/areaBarriers.js`
- `src/ui/bossFlash.js`
- `src/zombies/bosses/employeeModel.js`
- `src/zombies/bosses/filmingSpots.js`
- `src/zombies/bosses/guard.js`
- `src/zombies/bosses/influencer.js`
- `src/zombies/bosses/manager.js`
- `tests/bossEncores.test.js`
- `tests/bossGroundwork.test.js`
- `tests/bossPolish.test.js`
- `tests/guard.test.js`
- `tests/influencer.test.js`
- `tests/manager.test.js`
