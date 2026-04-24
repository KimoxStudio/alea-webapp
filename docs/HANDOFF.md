# Session Handoff

> Update this file at the end of every work session before closing the coding session.
> The next session must read this file first before doing anything.
> This file is the only valid handoff source for the repo. Do not use GitHub PR comments or `CLAUDE.md` for session handoff state.

---

## Last updated: 2026-04-24

## Current branch
`feat/KIM-317-30-minute-reservation-times` (active — do NOT switch to develop)

## Open PRs — awaiting merge
(none)

## Most recently merged
| PR | Branch | Fix |
|---|---|---|
| #116 | `feat/KIM-382-qr-activation-window` | `KIM-382` merged into `develop`: 60-minute QR activation window, auth coverage expansion, Vitest stability fixes |
| #115 | `feat/KIM-381-equipment-aware-reservations` | `KIM-381` merged into `develop`: equipment-aware reservation flow, overlap validation, one-week booking window, a11y fix (Radix Checkbox label pattern), ghost reservation safety, and pagination hardening |
| #111 | `feat/KIM-386-database-time-drift` | `KIM-386` merged into `develop`: DB-backed timestamp authority, club-time date helpers, deterministic reservation cutoff handling, and one-statement migration split |

---

## Status Summary

`KIM-317` is in progress on branch `feat/KIM-317-30-minute-reservation-times`.

In progress on branch:
- `lib/server/availability.ts`: day availability now uses 30-minute slots across the full 24-hour range
- `components/rooms/reservation-dialog.tsx`: reservation time selection now offers `00:00`–`23:30` in 30-minute steps
- `lib/server/reservations-service.ts` + `lib/club-time.ts`: reservation end boundary now accepts `24:00`
- tests updated for half-hour availability, dialog rendering, and `24:00` rollover

Validation:
- `pnpm exec vitest run __tests__/server/availability.test.ts` ✅
- `pnpm exec vitest run __tests__/components/rooms/reservation-dialog.test.tsx` ✅
- `pnpm exec vitest run __tests__/server/reservations-service.test.ts` ✅
- `pnpm test` ✅
- `pnpm test:coverage` ✅

Next likely work:
- open PR for `KIM-317`
- follow-up equipment-model issue created in Linear: `KIM-389`

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
