# Session Handoff

> Update this file at the end of every work session before closing Claude Code.
> The next session must read this file first before doing anything.

---

## Last updated: 2026-04-13

## Current branch
`develop`

## Open PRs — awaiting merge
| PR | Branch | Status |
|---|---|---|
| #106 | `fix/event-create-update-cancel-reservations` | Ready to merge (3× /team-review passed) |

## Merged this session
| PR | Branch | Fix |
|---|---|---|
| ~~#105~~ | `fix/availability-polling` | Availability polling 30s/60s + tests ✅ |

---

## Status Summary

PR #106 is clean — 3 `/team-review` passes, 415/415 tests, full CI green.
Merge into `develop` when ready.

---

## Manual QA pending (KIM-365)

All checks require a live browser session. See KIM-365 for full list.

### PR #82 — Cancellation cutoff UI
- [ ] Cancel a reservation < 60 min away → cutoff error shown in red
- [ ] Dismiss dialog → error clears on reopen

### PR #86 — Check-in hardening
- [ ] Valid QR scan → reservation activates to `active`
- [ ] `/en/check-in/not-a-uuid` → redirects to `/en/rooms`
- [ ] `/xx/check-in/<valid-uuid>` (invalid locale) → redirects to `/`

### PR #101 — Admin force-delete events
- [ ] Admin deletes event with active/pending reservations → reservations cancelled, event removed
- [ ] Delete error displays in active locale (ES or EN)

### PR #103 — Slot end_time inclusive
- [ ] User A has 17:00–18:00 → User B sees both 17:00 and 18:00 as unavailable
- [ ] 19:00 remains green

### PR #104 — Check-in timezone fix
- [ ] Check-in at exact reservation start time → succeeds
- [ ] Check-in 5 min before start → succeeds
- [ ] Check-in 6 min before start → "too early" error

### PR #105 — Availability polling
- [ ] User A opens reservation dialog → User B books same table/date → within 30s slot appears red in User A's open dialog

### PR #106 — Event create/update cancels reservations
- [ ] Admin creates event for a room with active/pending reservations in same time window → reservations cancelled immediately
- [ ] Admin updates event time range to overlap existing reservations → overlapping reservations cancelled
- [ ] Admin updates event room assignment → only new room's reservations cancelled (old room unaffected)
- [ ] Admin updates only event title/description → no reservations cancelled

---

## Post-MVP backlog

- **KIM-364** — After cancellation cutoff, show explanation instead of hiding cancel button
- **KIM-365** — Manual QA checklist (In Progress — items above)
- **KIM-361** — Spanish translations missing ñ
- **KIM-317** — 24h time range for reservations
- **KIM-329 epic** — No-show tracking (KIM-329, 333, 334, 335, 336)
- **KIM-332 epic** — Events / room blocking (KIM-332, 343–347)
- **KIM-348 epic** — Equipment management (KIM-348–356)
- **Hardening** — DB overlap constraint alignment with inclusive end_time (UI/DB semantic gap noted in PR #103 review)
- **Hardening** — UTC-anchored reservation timestamps (noted in PR #104 security review)

---

## Execution plan reference
→ `docs/ALEA-EXECUTION-PLAN.md`

## Linear project
→ https://linear.app/kimox-studio/project/alea-a9a47d8b2bb2/issues

---

## How to use this file

**At session start:**
1. Read `docs/HANDOFF.md` (this file) — mandatory before any action
2. `gh pr list --state open` — check PRs awaiting merge
3. `git branch --show-current` — confirm on develop
4. Follow MVP Critical Path above in order

**At session end:**
1. Update this file with current state
2. Save memory entry
3. Prune worktrees: `git worktree prune && rm -rf .claude/worktrees/`
