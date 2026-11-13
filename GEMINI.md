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
- **The mall's voice.** PA lines, signs and HUD text are deadpan corporate retail (read the existing lines in config/ first);
  no exclamation-mark hype.
- **Think through the player's moment.** Ask when the player sees, hears or pays for the thing (the first Doorbuster rush
  arrived before the player had bought the item, so it read as a random spawn). Say in your summary how to try it in the game.
- **Commit your draft as an unreviewed snapshot** on your own branch; a review pass runs before anything merges into main.
