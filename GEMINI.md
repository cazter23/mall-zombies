# Sunset Galleria: instructions for Gemini and Antigravity

Read **AGENTS.md** and **CLAUDE.md** before doing anything: CLAUDE.md holds this project's rules, commands, map and docs index,
and applies to every tool, not only Claude. AGENTS.md repeats the rules that keep the PC usable. The short version:

- Test only through npm (`npm run test:quick`, `npm test`, `npm test -- tests/x.test.js`). Never a bare `node --test` on many
  files: 19 processes at ~500 MB each freeze this 16 GB PC.
- A big run may print "Waiting for the run from <worktree>...": that is another agent's run. Wait (long timeout), don't retry.
- Rerun only the failing file while fixing; the full suite once, at the end.
- Work in your own worktree under `.claude/worktrees/`, never in the main folder.

## Lessons from review (what your Flash Sales and incentives drafts needed fixed)
Check each of these before you call a change done:
- **Keep existing tests.** Never delete or weaken a test to make a change pass (the Paid Break checks were dropped and had to be
  restored). If a test is truly obsolete, say which one and why in the commit message.
- **Pin numbers in tests.** Assert literal results (`1500 at 40% off = 900`), not the same formula the code uses; a test that
  re-derives the answer passes when the maths is wrong. Cover the edge cases too (the Employee of the Month fallback could pick
  a jackpot: nothing tested it).
- **Every tunable number lives in `src/config/`.** Durations, radii, colours, flash and flicker timings included; none in logic.
- **Clean up what you create.** Anything that adds meshes, materials, textures or listeners gets a `dispose()` (or a 'runReset'
  clear) and a test that it runs. Delete CSS rules, helpers and comments your change made unused or wrong.
- **Docs match the code.** Update docs/folder-structure.md for every module you add or change, docs/tests.md for every test
  file, and add a docs/history.md entry; field and event names in the docs must be the real ones.
- **Match the voice of what you add to.** Read the existing lines of that pool first and write like them. The mall PA, signs,
  HUD text, death reports and Survival Guide forms are deadpan corporate retail: calm, bureaucratic, no exclamation marks.
  Characters have their own voices: Kiosk Kevin (config/kiosk.js hawk) is a pushy, desperate salesman who shouts in
  exclamation marks, and the GRAB-A-GUN cabinet's text (config/clawMachine.js) is a cheerful arcade machine. Keep new lines about
  as long as the ones beside them (HUD lanes: docs/ui-readability.md).
- **Cite file:line for every claim about the game.** Before any text says what something does (a tip, a guide entry, a PA
  line, a doc), find the code that does it and note `file:line` in your summary. If you cannot find it, do not write the
  claim. (The death-report tips written from memory got mechanics wrong; the guide audit, which cited code, got them right.)
- **Think through the player's moment.** Ask when the player sees, hears or pays for the thing (the first Doorbuster rush
  arrived before the player had bought the item, so it read as a random spawn). Say in your summary how to try it in the game.
- **Commit your draft as an unreviewed snapshot** on your own branch; a review pass runs before anything merges into main.
