# Sunset Galleria: instructions for coding agents

This project's rules, commands, map and docs index are in **CLAUDE.md**. Read it first and follow it: it applies to every
tool (Codex, Gemini, Antigravity, Claude), not only Claude. This file only points there and repeats the rules that keep the
PC usable; if anything here and CLAUDE.md disagree, CLAUDE.md wins.

## Testing (the PC has 16 GB and several agents run at once)
- Always test through npm: `npm run test:quick`, `npm test`, or `npm test -- tests/x.test.js` for named files.
  **Never run a bare `node --test` on many files**: it starts 19 processes at ~500 MB each (~9 GB) and freezes the PC.
  tools/runTests.mjs caps a run at 4 files at once.
- A run of more than 8 files waits for any other big run on this PC and prints "Waiting for the run from <worktree>...".
  That is normal: give the command a long timeout (10 minutes) and do not start a second run meanwhile.
- While fixing a failure, rerun only the failing file. Run the full suite once, when you are done. Sub-agents never run the
  full suite.
- One browser preview at a time; stop your preview server when the check is done.

## Working copy
- Work in your own worktree and branch (`.claude/worktrees/<name>`), never in the main folder, and never switch branches there.
- Do not touch another tool's uncommitted files. Never run a bare `git stash`.
