# Session Handoff

> Update this file at the end of every work session before closing Claude Code.
> The next session must read this file first before doing anything.

---

## Last updated: 2026-04-11

## Current branch
`feat/overlap-restriction`

## Open PRs
| PR | Branch | Status |
|---|---|---|
| [#76](https://github.com/KimoxStudio/alea-webapp/pull/76) | `feat/auto-cancel-grace-period` | Open — awaiting merge. Mark KIM-327 Done after merge. |
| [#77](https://github.com/KimoxStudio/alea-webapp/pull/77) | `feat/overlap-restriction` | Open — awaiting merge. Mark KIM-330 + KIM-338 Done after merge. |

## Issues in progress
| Issue | Title | Status |
|---|---|---|
| KIM-327 | Auto-cancel grace period (M2) | In Progress → Done after PR #76 merge |
| KIM-330 | Overlap restriction per user (M3) | In Progress → Done after PR #77 merge |
| KIM-338 | Overlap validation backend (M3) | In Progress → Done after PR #77 merge |

---

## M2 — What was implemented

- `export const GRACE_PERIOD_MINUTES = 20` in `lib/server/reservations-service.ts` — shared by activation window and RPC call
- `cancelExpiredPendingReservations()` passes `{ grace_minutes: GRACE_PERIOD_MINUTES }` to the RPC
- Migration `20260411000003`: parameterized SQL function + DROP of legacy 0-arg overload
- Structured audit logging in `/api/cron/cancel-pending` (success + error paths with sanitized error logging)
- 2 new error-path tests in `__tests__/app/api/cron/cancel-pending.test.ts`
- Test uses `GRACE_PERIOD_MINUTES` constant for the RPC assertion
- Total: 239 tests passing

## Next milestone: M5 (from develop)

**M3 and M2 are open PRs — start M5 from `develop` immediately.**

**Issue:** KIM-331 + KIM-340 — Cancellation cutoff backend (member cannot cancel within 60 min of start)
**Branch to create:** `feat/cancellation-cutoff` from `develop`
**File:** `lib/server/reservations-service.ts` — in `updateReservationForSession`, when `nextStatus === 'cancelled'` and `session.role !== 'admin'`: check if reservation starts within 60 min of now → throw `CANCELLATION_CUTOFF` (403)

## Also available (parallel-safe from develop)

**Any of these can start immediately — they do not depend on M2:**

- **M3** (KIM-330 + KIM-338): Overlap restriction per user — `feat/overlap-restriction`
- **M5** (KIM-331 + KIM-340): Cancellation cutoff backend — `feat/cancellation-cutoff`
- **M8** (KIM-332 + KIM-343): Events data model — `feat/events-schema`
- **M10** (KIM-322 + KIM-323): Auth hardening — `feat/auth-hardening`

After M2 merge, switch to `develop`, pull, then create the next branch.

---

## Execution plan reference
→ `docs/ALEA-EXECUTION-PLAN.md`

## Linear project
→ https://linear.app/kimox-studio/project/alea-a9a47d8b2bb2/issues

---

## How to use this file

**At session start:**
1. Read `docs/HANDOFF.md` (this file) — mandatory before any action
2. Check `gh pr list --state open` for any PRs awaiting merge
3. Check `git branch --show-current`
4. Start from "Next milestone" above

**At session end:**
1. Update this file with current state before closing
2. Save a memory entry summarising the session
3. Prune worktrees: `git worktree prune && rm -rf .claude/worktrees/`
