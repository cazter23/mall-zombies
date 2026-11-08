# UI information priority pass

Branch: codex/ui-information-priority
Base: 017c399 (main at start). This worktree is isolated; do not merge without the user asking.

Scope: emphasize decisions/timers/tradeoffs; reduce round/certificate/flavor emphasis;
remove exhausted reward paperwork; teach effect hints once per run; retain full PA/certificates in archive.

Status: COMPLETE, ready for user review; not merged.

Implemented:
- Round number 64 -> 44px; combat certificate name ~50 -> ~26px, result more prominent than remark.
- Effect timers/charges 18px, first-activation instructions 16px; later activations omit repeated hints until run reset.
- Purchase tradeoffs/restrictions, drop location and sale information promoted to 16px.
- Exhausted reward paperwork hidden without hiding active drops/effects.
- Workshop ticket prioritizes countdown and current/next quality; routine stage narration retained only in archive.
- PA station header removed, cosmetic intro copy 14px; important PA messages remain 18px and full archive text preserved.

Validation: 19 focused tests passed; final 3 priority tests passed after copy adjustment;
production build passed; final browser sweep 128/128 passed, zero exceptions.
Screenshots/report are in the parent visualization directory (readability-*.png,
readability-verification.json). No further implementation is pending.

Resume/review: work in this worktree on codex/ui-information-priority. Run npm run dev
with an unused port for manual review. Do not merge into main unless requested.

Dependencies: node_modules junction uses the existing main checkout installation (no dependency installation required).
