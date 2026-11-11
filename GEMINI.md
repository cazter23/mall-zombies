# Sunset Galleria: instructions for Gemini and Antigravity

Read **AGENTS.md** and **CLAUDE.md** before doing anything: CLAUDE.md holds this project's rules, commands, map and docs index,
and applies to every tool, not only Claude. AGENTS.md repeats the rules that keep the PC usable. The short version:

- Test only through npm (`npm run test:quick`, `npm test`, `npm test -- tests/x.test.js`). Never a bare `node --test` on many
  files: 19 processes at ~500 MB each freeze this 16 GB PC.
- A big run may print "Waiting for the run from <worktree>...": that is another agent's run. Wait (long timeout), don't retry.
- Rerun only the failing file while fixing; the full suite once, at the end.
- Work in your own worktree under `.claude/worktrees/`, never in the main folder.
