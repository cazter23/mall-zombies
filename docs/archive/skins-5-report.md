# Weapon skins phase 5: locker and mastery recolours

Implemented only phase 5 in .claude/worktrees/skins-5 on codex/skins-5. Main and the other worktrees were not edited. Nothing was merged into main. No slot 2/3 challenges, patterns, glow treatments or Closing Time skin rewards were added.

## Commits and validation

- Inputs: codex/skins-1 at 90ca748 and codex/skins-3 at 9b43afc each passed 1,175 tests, zero failures/skips, run in the new skins-5 worktree. Eleven model builders resolve their colours; the second input supplies kill.weaponId, challenges and the permanent skin record.
- Step 0 commits: d8c2fea merges the skin tracks; d1aeafb merges main f471af0 and reconciles Save & Quit. Its full suite passed 1,295/1,295, zero failures/skips. Production build passed, 316 modules.
- Finished phase: npm test passed 1,309/1,309, zero failures/skips. npm run build passed, 318 modules, with the existing chunk-size warning. npm run balance completed and its output is byte-for-byte identical to Step 0.
- The Phase 2 material/canvas fixture and tests/upgradeColors.test.js pass unchanged. Phase 5 makes no changes to player/stats.js, weapons/gunStats.js or config/weapons.js.

## Combined config and palettes

The hand merge kept every entry from both branches: both Phase 1 palettes, all eleven Phase 4 challenge IDs/names/counts, gunSkin, the debug copy, storage version/key, unlock notices and challenge debug copy. The nine missing palettes were then filled in with roles. Night Shift and Carbon Copy are retained as real mastery skins, not replaced placeholders. Night Shift is unchanged.

Every palette below is a base coat; printed labels, attachments, build patches/seams/Heart badges, loaner tags and warranty trim keep their existing layers. Other roles retain defaults where absent.

| Gun | Skin | body | dark | metal | grip | accent | sight | Other roles |
|---|---|---|---|---|---|---|---|---|
| Staple Gun | Night Shift | #303e74 | #202846 | #8294aa | #292b36 | #bfcce1 | #f8e1a3 | — |
| Rivet Rifle | Carbon Copy | #353f42 | #242a30 | #8797a5 | #20242a | #7086a0 | #e9eb9b | — |
| Price Gun | Red Tag | #612635 | #311922 | #b0a3aa | #241c24 | #f6adbd | #ffe3a1 | ammo #f8ecd9 |
| Nail Gun | Aftermarket | #393e35 | #20271f | #aab4a0 | #24241d | #e7b36b | #f7e1a0 | — |
| Foam Dart Blaster | Blue Ribbon | #243c68 | #19243e | #9bb7d8 | #202736 | #c7dcff | #ffe6a4 | ammo #9dd4f5 |
| Confetti Cannon | Encore | #512753 | #2c1a30 | #b1a0be | #241b2b | #e9b5f2 | #ffe7ad | ammo #f2ddaf |
| Heavy Coil Nailer | Factory Finish | #38454a | #202c32 | #b1c1ca | #202428 | #ddb480 | #f8e0a0 | — |
| Barcode Scanner | Black Label | #292636 | #171723 | #a8a2bb | #201e29 | #d9b5de | #c8f3b0 | emitter #f391b3 |
| Leaf Blower | Autumn Gold | #51402b | #2d281e | #beb099 | #27231d | #edc77f | #ffefb0 | — |
| Tennis Ball Launcher | Centre Court | #244838 | #192e26 | #a4bdb4 | #1c2723 | #e0e5c4 | #ffe6a3 | ammo #e2ed91, glass #c7e6d7 |
| Return to Sender | Final Notice | #492c3c | #291d29 | #bba9ba | #241c26 | #efb0c4 | #ffe7a7 | emitter #f8c3d2, screen #cdebc0 |

The contrast threshold is skinContrast.minimum = 2, using the WCAG relative-luminance ratio for body paint against all six stuffings and all four warranty tier colours (110 comparisons). Carbon Copy failed at 1.8848:1 against Standard grey; only its body changed from #404a4d to #353f42, now 2.2379:1. All other bodies pass as authored; the lowest finished ratio is 2.0506:1. Stuffing and tier colours are untouched.

## State and Save & Quit

- game/skinSave.js keeps permanent progress, unlocks and equipped preferences in sunsetGalleria.skins, version 1. The existing saved shape already had equipped, so its version does not change. Equipping validates gun/skin/unlock, writes synchronously, protects newer saves, and preserves concurrent progress and choices for other guns. It also flushes on runSaved, without producing runEnd/career records.
- g.skins is the run's eleven choices. Its resetSteps entry reads the permanent equipped preferences; main also rereads them when the title chooser starts a new shift, because the player may have visited the locker after the title reset. A saved skins step restores the run's choices before guns/features restore, so changing the locker cannot recolour a resumed run. Locked, unknown and wrong-gun choices become Default.
- g.challenges still keeps mastery counts permanently. Its new earned list belongs to this run's receipt. It resets on Play again and is saved in the challenges step at the round start; Continue restores that list without rewinding permanent progress/unlocks. It moved from transientSteps to saveSteps. No other per-run challenge counters exist in slot 1.
- The two new saved steps change the run snapshot shape, so config/save.js is version 3. Older run snapshots are discarded using the existing notice rule. Visual preview resources and debug colour overrides are transient and never part of a save.

## Locker and model routing

The title's Weapon locker button sits beside Statistics. Play retains its Directed/Classic chooser. All eleven guns and each Default/mastery finish are visible, including locked names, challenge text and saved progress. Locked finishes can be highlighted/previewed but cannot equip. An available click, Enter or controller A equips and saves. Back, Escape and controller B return to title.

The preview uses buildWeaponDisplay and a temporary renderer. Main's existing idle-governed loop drives it, so dim/sleep also throttle/stop the preview. Closing releases geometries, materials, label textures, renderer/context and canvas; it also removes the keyboard listener. Wall displays and claw prizes omit a skin ID. The viewmodel and only the player's Build-A-Blaster conveyor ask g.skins. Mid-run purchases, prizes and returned builds therefore resolve the chosen coat by gun ID.

## Browser checks

Built preview served with Vite preview, using an isolated headless Chrome/SwiftShader profile, 1440 × 900, and window.__mall. The sandbox required running the preview and browser together over a private debugging pipe.

- Captured the locker with 212 / 400 locked progress and with Night Shift equipped. The first visual check caught the inherited 480px card limit; the corrected layout fits all eleven guns, preview, rows and Back on screen.
- Used the challenge debug command to unlock Night Shift and Carbon Copy, equipped both in the DOM locker, started through the existing Play chooser, and captured both in hand.
- Captured Carbon Copy with Platinum warranty plus Smoothie, Fryer Oil and Neon Tube. Build descriptors were applied through the existing gun API for these visual captures; the behavioral test separately exercises a real bench order and built return.
- Measured the same stationary Rivet Rifle frame, summing renderer calls across the world/viewmodel/post-processing passes: factory 135, Carbon Copy 135, delta 0.
- Set Night Shift to 399 with the challenge command, reset to an unassisted run, and killed a normal 150 HP Shopper with three real Staple Gun shots. Progress became 400, one skinUnlocked was earned, the PA/toast named Night Shift, and its receipt printed Skins unlocked / Night Shift. Feedback timers/animation were held for the software-rendered capture.
- Browser Escape and simulated controller B returned to title; the preview canvas count went from one to zero. Unit tests also verify disposal of every actual preview geometry/material/label texture.
- No runtime game exceptions were observed. Physical controller hardware, a physical GPU, subjective combat play and long-session performance were not checked. Save & Quit round trips and a real bench order were verified headlessly; these were not repeated end-to-end in the browser.
- Normal browser profiles were never used. The isolated profile's localStorage is restored to its original empty state after QA.

Screenshots and QA logs are in scratch/skins-5-qa/ (ignored local artifacts): locker-locked.png, locker-unlocked.png, night-shift-in-hand.png, carbon-copy-in-hand.png, carbon-copy-platinum-smoothie.png, carbon-copy-platinum-fryer.png, carbon-copy-platinum-neon.png, real-unlock-pa-toast.png and real-unlock-receipt.png.

## Shared files changed by phase 5

config/skins.js, config/save.js; game/createGame.js, game/challenges.js, game/skinSave.js, game/features/workshop.js and workshopRitual.js; main.js; ui/hud.js, ui/screens.js, ui/retail.css; weapons/models/index.js; tests/challenges.test.js; docs/folder-structure.md, docs/tests.md, docs/history.md and this report. New files: game/skins.js, ui/locker.js, tests/locker.test.js and tests/skinEquipment.test.js.

Step 0's manual integration also resolved game/debugCommands.js and tests/equipment.test.js while retaining main's armour/closing commands and the skins/challenge commands.
