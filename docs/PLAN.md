# Alea Plan

**Last updated:** 2026-04-21
**Source of truth:** current repository state + active Linear issues for project `Alea`
**Ignore:** canceled legacy tickets and removed migration-era planning docs

---

## Current Product State

- Stack: single Next.js 15 app with Supabase, `next-intl`, Vitest, and shadcn/ui.
- Member import is done and merged (`KIM-377`).
- Admin already has: users, reservations, rooms, events, member import, activation links, and recovery links.
- `KIM-378` is merged: public sign-up is disabled, activation links are admin-issued, and login is the default entry route.
- `KIM-379` is merged: admin-mediated password recovery and the current password reset path are live.
- `KIM-386` is merged: persisted sensitive timestamps now use DB time, reservation/check-in comparisons use club-time-aware helpers, and cron SQL compares slot boundaries with explicit timezone semantics.
- `KIM-381` is merged: optional equipment selection, server-side overlap validation, and the one-week booking window are live in the reservation flow.
- Follow-up still required: fix equipment reservation scoping. Equipment can still be reserved from any room, except equipment linked to a room during room creation.
- `Saved Game` is still not implemented.

---

## Open Issues In Scope

### High priority

- `KIM-380` — Equipment inventory model + room defaults + single QR for double tables
- `KIM-381` — Reservation flow with optional equipment + overlap validation + one-week booking window
- `KIM-382` — QR activation window up to 60 minutes after reservation start
- `KIM-383` — Multi-day / multi-room event management with reservation overrides

### Medium priority

- `KIM-317` — 24h reservation times with 30-minute intervals
- `KIM-384` — `Saved Game` reservation type
- `KIM-385` — Public FAQ route

---

## Execution Order

### Phase 1 — Prepare inventory for equipment-aware bookings

1. `KIM-380`

Reason:
- Auth and time infrastructure are now merged.
- Equipment cannot be reserved cleanly until it exists as a first-class admin-managed resource.
- The single-QR rule for double tables affects later saved-game and booking behavior.

### Phase 2 — Upgrade the normal reservation flow

1. `KIM-381`
2. `KIM-382`
3. `KIM-317`

Reason:
- `KIM-381` depends on the equipment inventory from `KIM-380`.
- `KIM-382` belongs to the reservation rules layer and should be validated against the post-`KIM-380` flow.
- `KIM-317` is also a reservation-flow change and should be validated against the new overlap/equipment behavior rather than implemented against an older flow and then reworked.

### Phase 3 — Expand event authority

1. `KIM-383`

Reason:
- This extends a feature that already exists in the repo.
- It must be aligned with normal reservation behavior from Phase 2.
- It should land before `Saved Game`, because `KIM-384` depends on event blocking semantics.

### Phase 4 — Add the new saved-game product

1. `KIM-384`

Reason:
- `Saved Game` depends on stable inventory, booking, QR attendance, and event-blocking rules.
- It is the most cross-cutting open feature and should not be started before the lower-level rules are settled.

### Phase 5 — Publish user-facing documentation

1. `KIM-385`

Reason:
- The FAQ must describe the final implemented rules, not transitional behavior.
- It should land after auth, equipment, booking, event, and saved-game flows are stable.

---

## Dependency Summary

- `KIM-380` -> `KIM-381`
- `KIM-381` + `KIM-382` + `KIM-383` -> `KIM-384`
- `KIM-378` + `KIM-379` + `KIM-381` + `KIM-382` + `KIM-384` -> `KIM-385`
- `KIM-317` is technically independent, but should be validated after the reservation flow changes in `KIM-381`

---

## Recommended Next Build Step

`KIM-382` is in progress on `feat/KIM-382-qr-activation-window`. PR #116 is open. Test suite optimisation is still in progress while review feedback is addressed. Full plan in `docs/HANDOFF.md` under "Pending test optimisation plan".

---

## Notes

- Do not reintroduce milestone plans from the old migration era.
- Do not use canceled child tickets as active roadmap items when a newer parent issue supersedes them.
- Move the selected Linear issue to `In Progress` before starting implementation work.
- Equipment reservation scoping still needs a dedicated fix: equipment can currently be reserved from any room, except equipment linked to a room during room creation.
- Keep `docs/HANDOFF.md` short and aligned with this file.
