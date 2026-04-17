# Session Handoff

> Update this file at the end of every work session before closing the coding session.
> The next session must read this file first before doing anything.
> This file is the only valid handoff source for the repo. Do not use GitHub PR comments or `CLAUDE.md` for session handoff state.

---

## Last updated: 2026-04-17

## Current branch
`feat/KIM-381-equipment-aware-reservations`

## Open PRs — awaiting merge
| PR | Branch | Status |
|---|---|---|
| #115 | `feat/KIM-381-equipment-aware-reservations` | Open — validated locally, awaiting review |

## Most recently merged
| PR | Branch | Fix |
|---|---|---|
| #111 | `feat/KIM-386-database-time-drift` | `KIM-386` merged into `develop`: DB-backed timestamp authority, club-time date helpers, deterministic reservation cutoff handling, and one-statement migration split |
| #110 | `feat/KIM-379-password-recovery` | `KIM-379` merged into `develop`: admin-mediated password recovery, stale-session auth redirects, and root entry redirect hardening |
| #109 | `feat/KIM-378-member-activation` | `KIM-378` merged into `develop`: activation flow, login-first entry route, and auth redirect fixes |

---

## Status Summary

`KIM-381` is in progress on `feat/KIM-381-equipment-aware-reservations`.

Current branch state includes:
- optional equipment selection in the reservation flow
- server-side equipment overlap checks for selected reservation windows
- one-week reservation booking window enforcement
- reservation equipment display in member/admin reservation views
- new room equipment availability API route and route test coverage
- two validation cycles clean on `lint`, `typecheck`, `build`, and targeted Vitest server/route suites

Current meaningful next steps:
- review and merge PR #115 for `KIM-381`
- after `KIM-381` merges, continue with `KIM-382`
- follow-up still needed: fix equipment reservation scoping, because equipment can still be reserved from any room except equipment linked to a room during room creation

Plan source:
- Use only `docs/PLAN.md`.
- Ignore removed legacy planning docs and canceled legacy tickets.

---

## Manual QA

~~Pending checklist (PRs #82, #86, #101, #103, #104, #105, #106)~~ — **Cancelled 2026-04-17. Gate removed. Implementation proceeds.**

---

## Active roadmap reference

- `KIM-380` — Equipment inventory model
- `KIM-381` — Equipment-aware reservation flow
- `KIM-382` — 60-minute QR activation window
- `KIM-383` — Expanded event scheduling and blocking
- `KIM-317` — 24h booking times with 30-minute intervals
- `KIM-384` — Saved Game reservation type
- `KIM-385` — FAQ route

---

## Execution plan reference
→ `docs/PLAN.md`

## Linear project
→ https://linear.app/kimox-studio/project/alea-a9a47d8b2bb2/issues

---

## How to use this file

**At session start:**
1. Read `docs/HANDOFF.md` (this file) — mandatory before any action
2. Move the selected Linear issue to `In Progress` before writing code
3. `gh pr list --state open` — check PRs awaiting merge
4. `git branch --show-current` — confirm you are on `develop` unless active branch work has started
5. If operational closure is still pending, use the Manual QA checklist above
6. Otherwise branch fresh from `develop` for the next planned issue

**At session end:**
1. Update this file with current state
2. Do not add handoff-only state to GitHub comments or `CLAUDE.md`
3. Prune worktrees if needed: `git worktree prune && rm -rf .claude/worktrees/`
