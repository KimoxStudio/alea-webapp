# Alea Webapp — Execution Plan

> Generated: 2026-04-10 · Last updated: 2026-04-12
> Covers all 39 open Linear issues (Todo status)
> Ordered: highest → lowest priority

---

## MVP Progress (target: 2026-04-14)

| Milestone | Issues | Status | PR |
|---|---|---|---|
| M1 — QR + Check-in | KIM-316, KIM-324 | ✅ Merged | — |
| M2 — Auto-cancel grace period | KIM-327 | ✅ Merged | #76 |
| M3 — Overlap restriction backend | KIM-330, KIM-338, KIM-339 | ✅ Merged | #77 |
| M4 — Overlap UI feedback | KIM-337 | ✅ Merged | #81 |
| M5 — Cancellation cutoff backend | KIM-331, KIM-340, KIM-342 | ✅ Merged | #79 |
| M6 — Cancellation cutoff UI | KIM-341 | 🟡 PR open | [#82](https://github.com/KimoxStudio/alea-webapp/pull/82) |
| M11 partial — Auth i18n fix | KIM-325 | ✅ Merged | #78 |
| M12A — Seed data | KIM-306 | ✅ Merged | #80 |

> **PR #82 is 2-cycle team-review clean, all Copilot comments resolved, conflicts resolved. Ready to merge.**
>
> After #82 merges → final smoke test → Monday launch.

---

## Codebase State Summary

**Already built:**
- Full auth stack (login by member number, register with schema validation, session cookies, CSRF, RLS).
- Room / table / reservation CRUD with conflict detection, surface logic for `removable_top`, GiST exclusion constraint.
- `tables.qr_code` column exists in schema; `qrcode@1.5.4` is installed — but QR is never generated automatically and no check-in route exists.
- Admin dashboard with three tabs: Users, Reservations, Rooms.
- My Reservations page (`components/reservations/my-reservations-view.tsx`).
- `reservation_status` enum: `active | cancelled | completed`. No `pending` status, no `activated_at` column.
- No scheduled jobs, no pg_cron, no Supabase Edge Functions.
- No no-show tracking columns (`no_show_count`, `blocked_until`).
- No events or equipment tables.
- No check-in page (`app/[locale]/check-in/` does not exist).

**Key design decisions:**
1. `activated_at timestamptz` column added to `reservations` (not a new enum value) — avoids breaking the GiST exclusion constraint. Auto-cancel (KIM-327) and no-show tracking (KIM-329) both depend on it.
2. No pg_cron assumption — fallback to Supabase Edge Function with scheduled trigger if pg_cron is unavailable on Cloud tier.
3. KIM-322 may already be partially addressed by the existing `^\d+$` regex — software-engineer must verify client-side error key mapping before touching the schema.
4. Equipment Epic (M9) defers to the full breakdown in `docs/KIM-348-EQUIPMENT-PLAN.md` — superseded by this file's M9 section.
5. KIM-328 (Docker doc removal) is delegated to `tech-writer`, not `software-engineer`.

---

## Proposed Consolidations

| Consolidated Milestone | Absorbs KIM-IDs | Rationale |
|---|---|---|
| QR generation + check-in activation | KIM-316, KIM-324 | Inseparable: check-in route is useless without QR; QR without check-in has no consumer. Same migration, same service file, one PR. |
| Auth hardening batch | KIM-322, KIM-323 | Two small server-side hardening tasks in the same auth files. No new UI. Saves a full agent pipeline cycle. |
| Overlap restriction backend + tests | KIM-330, KIM-338, KIM-339 | KIM-338 is the sole backend child; KIM-339 is its tests. KIM-337 (UI feedback) stays separate as a frontend milestone. |
| Cancellation cutoff backend + tests | KIM-331, KIM-340, KIM-342 | Same pattern. KIM-341 (UI warning) stays separate. |
| No-show tracking — data model + logic | KIM-329, KIM-333, KIM-334 | KIM-333 (schema) and KIM-334 (booking restriction) land in the same migration + service file. KIM-335 (admin UI) and KIM-336 (tests) stay separate. |
| Events data model | KIM-332, KIM-343 | Parent + data model child are one migration. Admin UI (KIM-344), availability (KIM-345), conflict handling (KIM-346), tests (KIM-347) stay separate. |
| UX hardening batch | KIM-315, KIM-317, KIM-325 | Three small, independent UX improvements. KIM-328 (doc cleanup) goes to tech-writer separately. |
| Infra / tooling batch | KIM-306, KIM-307 | Seed data + a11y tooling. No production code impact. No conflict risk. |

---

## Execution Plan — Highest to Lowest Priority

### M1 — QR Generation + Check-in Activation (KIM-316, KIM-324) ✅ Done

**Priority:** Urgent — foundation for all QR-dependent features (KIM-353 equipment QR is blocked by this)
**Agent:** `software-engineer` × 2 (parallel sub-agents)
**Mode:** M1A (backend) parallel with M1B (frontend)
**Blocked by:** nothing

#### M1A — Backend
**Files:**
- `supabase/migrations/20260410000001_reservations_activated_at.sql` — `ALTER TABLE reservations ADD COLUMN activated_at timestamptz`
- `lib/supabase/types.ts` — add `activated_at` to `ReservationRow`
- `lib/server/tables-service.ts` — `generateQrCode(tableId)`: generate unique token + base64 QR via `qrcode@1.5.4`; persist on table creation/update if `qr_code` is null
- `lib/server/reservations-service.ts` — add `activateReservationByQr(qrCode)`: resolves table, finds qualifying reservation (today, within time window, `activated_at IS NULL`), sets `activated_at = now()`
- `app/api/check-in/[tableId]/route.ts` (new) — GET: delegates to `activateReservationByQr`; returns activation state

#### M1B — Frontend
**Skill:** `frontend-design`
**Files:**
- `app/[locale]/check-in/[tableId]/page.tsx` (new) — check-in result page: reads `tableId` param, calls GET `/api/check-in/[tableId]`, renders success / already-active / no-reservation / outside-window states
- `components/admin/rooms-section.tsx` — add QR display + download button per table row
- `messages/en.json` — add `checkin.*`: `activated`, `alreadyActive`, `notFound`, `noActiveReservation`, `outsideWindow`
- `messages/es.json` — full parity

**Acceptance gate:** Table creation auto-populates `qr_code`. Scanning the QR URL sets `activated_at`. Check-in page shows correct state for all edge cases. `pnpm build` passes.

---

### M2 — Auto-cancel Grace Period (KIM-327) ✅ Done — PR #76

**Priority:** High — business rule; depends on `activated_at` column from M1
**Agent:** `software-engineer`
**Skill:** —
**Mode:** Sequential after M1A
**Blocked by:** M1A

**Files:**
- `supabase/migrations/20260410000002_auto_cancel_function.sql`:
  - `auto_cancel_unactivated_reservations()` — UPDATE reservations SET status='cancelled' WHERE status='active' AND activated_at IS NULL AND (date + start_time) < now() - interval '20 minutes'
  - pg_cron job (or Supabase Edge Function fallback if pg_cron is unavailable): schedule every minute
- No app code changes needed

**Acceptance gate:** Reservations not activated within 20 minutes of start are auto-cancelled. Verified against local Supabase. `pnpm build` passes (no app code change).

---

### M3 — Overlap Restriction per User — Backend (KIM-330, KIM-338) ✅ Done — PR #77

**Priority:** High
**Agent:** `software-engineer`
**Skill:** —
**Mode:** After M1 (shares reservations service file — sequential to avoid conflict)
**Blocked by:** M1

**Files:**
- `lib/server/reservations-service.ts` — add `checkUserSlotOverlap(userId, date, startTime, endTime)`: queries active reservations for user where times overlap; throws `serviceError('USER_ALREADY_HAS_RESERVATION_IN_SLOT', 409)`. Call inside `createReservationForSession` before table-level conflict check.

**Acceptance gate:** Creating a second reservation in the same time slot for the same user returns 409. `pnpm build` + `pnpm typecheck` pass.

---

### M3-QA — Overlap Restriction Tests (KIM-339) ✅ Done — PR #77

**Priority:** High
**Agent:** `qa-engineer`
**Mode:** Sequential after M3
**Blocked by:** M3

**Files:**
- `__tests__/server/reservations-service.test.ts` — same user + same slot → 409; same user + different slot → allowed; different user + same slot → allowed (table-level conflict handles that separately)

**Acceptance gate:** `pnpm test` passes.

---

### M4 — Overlap Restriction — UI Feedback (KIM-337) ✅ Done — PR #81

**Priority:** Medium
**Agent:** `software-engineer`
**Skill:** `frontend-design`
**Mode:** Sequential after M3
**Blocked by:** M3

**Files:**
- `components/rooms/reservation-dialog.tsx` — handle `USER_ALREADY_HAS_RESERVATION_IN_SLOT` 409 with a specific error message (distinct from table-level slot conflict)
- `messages/en.json` — add `reservations.errors.userSlotConflict`
- `messages/es.json` — full parity

**Acceptance gate:** Booking dialog shows user-specific conflict message. `pnpm build` passes.

---

### M5 — Cancellation Cutoff — Backend (KIM-331, KIM-340) ✅ Done — PR #79

**Priority:** High
**Agent:** `software-engineer`
**Skill:** —
**Mode:** After M1 (parallel with M3 — different service function, same file; run sequential to be safe)
**Blocked by:** M1

**Files:**
- `lib/server/reservations-service.ts` — in `updateReservationForSession`, when `nextStatus === 'cancelled'` and `session.role !== 'admin'`: check if reservation starts within 60 minutes of now; throw `serviceError('CANCELLATION_CUTOFF', 403)`

**Acceptance gate:** Member cancellation within 1 hour returns 403. Admin cancel bypasses. `pnpm build` + `pnpm typecheck` pass.

---

### M5-QA — Cancellation Cutoff Tests (KIM-342) ✅ Done — PR #79

**Priority:** Medium
**Agent:** `qa-engineer`
**Mode:** Sequential after M5
**Blocked by:** M5

**Files:**
- `__tests__/server/reservations-service.test.ts` — cancel within 60 min (member) → 403; cancel outside 60 min → allowed; admin cancel within 60 min → allowed

**Acceptance gate:** `pnpm test` passes.

---

### M6 — Cancellation Cutoff — UI Warning (KIM-341) 🟡 PR #82 — ready to merge

**Priority:** Low
**Agent:** `software-engineer`
**Skill:** `frontend-design`
**Mode:** Sequential after M5
**Blocked by:** M5

**Files:**
- `components/reservations/my-reservations-view.tsx` — detect `CANCELLATION_CUTOFF` 403; show inline warning
- `messages/en.json` — add `reservations.errors.cancellationCutoff`
- `messages/es.json` — full parity

**Acceptance gate:** Cancel button shows correct error when cutoff has passed. `pnpm build` passes.

---

### M7 — No-show Tracking — Data Model + Backend Logic (KIM-329, KIM-333, KIM-334) 🚫 Post-MVP

**Priority:** High
**Agent:** `software-engineer`
**Skill:** —
**Mode:** Sequential after M2 (auto-cancel must exist before no-shows can be counted)
**Blocked by:** M2

**Files:**
- `supabase/migrations/20260410000003_no_show_tracking.sql`:
  - `ALTER TABLE profiles ADD COLUMN no_show_count integer NOT NULL DEFAULT 0`
  - `ALTER TABLE profiles ADD COLUMN blocked_until timestamptz`
  - Trigger `after_reservation_auto_cancel`: when `reservations.status` → `cancelled` AND `activated_at IS NULL` AND `old.status = 'active'` → increment `profiles.no_show_count`; if `no_show_count >= 3`, set `blocked_until = now() + interval '30 days'`
- `lib/supabase/types.ts` — add `no_show_count` and `blocked_until` to `ProfileRow`
- `lib/server/reservations-service.ts` — in `createReservationForSession`: check `profile.blocked_until IS NOT NULL AND blocked_until > now()`; throw `serviceError('USER_BLOCKED_NO_SHOWS', 403)`

**Acceptance gate:** After 3 unactivated auto-cancelled reservations, next booking returns 403 with `USER_BLOCKED_NO_SHOWS`. `pnpm build` + `pnpm typecheck` pass.

---

### M7A — No-show Admin Controls (KIM-335) 🚫 Post-MVP

**Priority:** Medium
**Agent:** `software-engineer`
**Skill:** `frontend-design`
**Mode:** Sequential after M7
**Blocked by:** M7

**Files:**
- `components/admin/users-section.tsx` — show `no_show_count` and `blocked_until` per user; add "Reset no-shows" and "Unblock" action buttons
- `app/api/users/[id]/route.ts` — PATCH: reset `no_show_count = 0` and clear `blocked_until` (admin only)
- `lib/server/users-service.ts` — add `resetNoShows(userId)`
- `messages/en.json` — add `admin.noShowCount`, `admin.blockedUntil`, `admin.resetNoShows`, `admin.unblockUser`
- `messages/es.json` — full parity

**Acceptance gate:** Admin sees no-show count per user and can reset/unblock. `pnpm build` passes.

---

### M7-QA — No-show Tests (KIM-336) 🚫 Post-MVP

**Priority:** Medium
**Agent:** `qa-engineer`
**Mode:** Sequential after M7
**Blocked by:** M7

**Files:**
- `__tests__/server/reservations-service.test.ts` — blocked user booking → 403; non-blocked → allowed; 3 no-shows triggers block

**Acceptance gate:** `pnpm test` passes.

---

### M8 — Events — Data Model (KIM-332, KIM-343) 🚫 Post-MVP

**Priority:** High (can start in parallel with M3/M5 — independent new tables)
**Agent:** `software-engineer`
**Skill:** —
**Mode:** Parallel with M3 and M5 (new tables, no shared service files)
**Blocked by:** nothing

**Files:**
- `supabase/migrations/20260410000004_events_schema.sql`:
  - Table `events`: `id uuid PK`, `title text`, `description text nullable`, `date date`, `start_time time`, `end_time time`, `created_by uuid FK auth.users`, `created_at timestamptz`
  - Table `event_room_blocks`: `id uuid PK`, `event_id uuid FK events`, `room_id uuid FK rooms`, `date date`, `start_time time`, `end_time time`
  - RLS: admin full access; public SELECT on both tables
- `lib/supabase/types.ts` — add `EventRow`, `EventRoomBlockRow`

**Acceptance gate:** Migration applies cleanly. `pnpm build` passes.

---

### M8A — Events Admin Tab (KIM-344) 🚫 Post-MVP

**Priority:** High
**Agent:** `software-engineer` × 2 parallel (M8A-backend + M8A-frontend)
**Mode:** After M8; M8A-backend and M8A-frontend run in parallel
**Blocked by:** M8

#### M8A-backend
**Files:**
- `lib/server/events-service.ts` (new) — `createEvent`, `updateEvent`, `deleteEvent` (with active-reservation conflict check), `listEvents`, `getEvent`, `listEventsBlockingRoom(roomId, date, start, end)`
- `app/api/events/route.ts` — GET list, POST create (admin only)
- `app/api/events/[id]/route.ts` — PUT update, DELETE (admin only)

#### M8A-frontend
**Skill:** `frontend-design`
**Files:**
- `components/admin/admin-dashboard.tsx` — add "Events" tab (icon: `CalendarRange`)
- `components/admin/events-section.tsx` (new) — list events; create/edit dialog; delete with conflict warning
- `lib/hooks/use-admin.ts` — add `useAdminEvents`, `useAdminCreateEvent`, `useAdminUpdateEvent`, `useAdminDeleteEvent`
- `messages/en.json` — add `admin.events.*`: `title`, `description`, `room`, `createEvent`, `editEvent`, `deleteEvent`, `noEvents`, `conflictWarning`
- `messages/es.json` — full parity

**Acceptance gate:** Admin can create, edit, delete events. Events tab visible and functional. `pnpm build` passes.

---

### M8B — Event-based Room Blocking in Availability (KIM-345) 🚫 Post-MVP

**Priority:** High
**Agent:** `software-engineer`
**Skill:** —
**Mode:** Sequential after M8A-backend
**Blocked by:** M8A-backend

**Files:**
- `lib/server/availability.ts` (or equivalent) — before returning slots, call `listEventsBlockingRoom(roomId, date, start, end)`; mark those slots unavailable
- Alternatively, add the check inside `createReservationForSession` as a pre-creation guard

**Acceptance gate:** Reserving a table in a room during an event time window returns no available slots. `pnpm build` passes.

---

### M8C — Existing Reservations Affected by Events (KIM-346) 🚫 Post-MVP

**Priority:** High
**Agent:** `software-engineer`
**Skill:** —
**Mode:** Sequential after M8B
**Blocked by:** M8B

**Files:**
- `supabase/migrations/20260410000005_reservation_cancellation_reason.sql` — `ALTER TABLE reservations ADD COLUMN cancellation_reason text`
- `lib/supabase/types.ts` — add `cancellation_reason` to `ReservationRow`
- `lib/server/events-service.ts` — in `createEvent`, after insert: query active reservations for the blocked room(s) in the event window; cancel them and set `cancellation_reason = 'event_conflict'`

**Acceptance gate:** Creating an event that overlaps active reservations auto-cancels them. `pnpm build` passes.

---

### M8-QA — Event Tests (KIM-347) 🚫 Post-MVP

**Priority:** Medium
**Agent:** `qa-engineer`
**Mode:** Sequential after M8C
**Blocked by:** M8C

**Files:**
- `__tests__/server/events-service.test.ts` (new) — create event; delete event; event blocks availability; create event cancels overlapping reservations

**Acceptance gate:** `pnpm test` passes.

---

### M9 — Equipment Epic (KIM-348 + children KIM-349 to KIM-356) 🚫 Post-MVP

**Priority:** High (partially Urgent via KIM-353 which is blocked by M1)
**Mode:** Internal milestones follow the sequence below. M9-M1 can start as soon as M1A is done.
**Blocked by:** M1 (for KIM-353 — QR cross-activation only)

| Sub-milestone | Issues | Agent | Skill | Mode |
|---|---|---|---|---|
| M9-M1 | KIM-349 (data model) | `software-engineer` | — | After M1A |
| M9-M2 | KIM-352 (service layer + overlap rule) | `software-engineer` | — | After M9-M1 |
| M9-M3A | KIM-350 (admin frontend) | `software-engineer` | `frontend-design` | Parallel with M9-M3B |
| M9-M3B | KIM-350 (admin API routes) | `software-engineer` | — | Parallel with M9-M3A |
| M9-M4 | KIM-351 (booking add-on) | `software-engineer` | `frontend-design` | After M9-M3B |
| M9-M5 | KIM-354 (user views) | `software-engineer` | `frontend-design` | After M9-M4 |
| M9-M6 | KIM-355 (cancellation flows) | `software-engineer` | `frontend-design` | After M9-M5 |
| M9-M7 | KIM-353 (QR cross-activation) | `software-engineer` | — | After M9-M6 + M1 done |
| M9-M8 | KIM-356 (tests) | `qa-engineer` | — | After M9-M7 |

> Full file-level breakdown for M9 is in `docs/KIM-348-EQUIPMENT-PLAN.md` (now superseded by this file — refer to Section 3 of the original plan output for detail).

---

### M10 — Auth Hardening Batch (KIM-322, KIM-323) 🚫 Post-MVP

**Priority:** Medium (can run in parallel with any non-auth milestone)
**Agent:** `software-engineer`
**Skill:** —
**Mode:** Parallel with M3/M5/M8 (touches only auth files)
**Blocked by:** nothing

**Files:**
- `lib/validations/auth.ts` — verify `memberNumber` regex parity between client and server schemas. KIM-322 may already be resolved — software-engineer must confirm before changing.
- `app/api/auth/register/route.ts` — if profile INSERT fails after `auth.signUp()`, call `supabase.auth.admin.deleteUser(userId)` to clean up the orphaned auth user (KIM-323)
- `lib/server/auth-service.ts` — move cleanup into `registerUser()` so it is testable

**Acceptance gate:** Registering with a non-numeric member number shows the correct translated error. Orphaned auth user is cleaned up on profile insert failure. `pnpm build` passes.

---

### M11 — UX Hardening Batch (KIM-315, KIM-317, KIM-325) 🚫 Post-MVP (KIM-325 ✅ merged PR #78)

**Priority:** Low
**Agent:** `software-engineer`
**Skill:** `frontend-design`
**Mode:** Parallel with any backend milestone
**Blocked by:** nothing

**Files:**
- `components/cookie-banner.tsx` (new) — GDPR cookie consent banner, `localStorage`-persisted dismissal
- `app/[locale]/layout.tsx` — render `CookieBanner`
- `components/rooms/reservation-dialog.tsx` — change time slot generator from 60-min to 30-min intervals (pass `interval: 30` to existing `generateTimeSlots`)
- Auth form components — trace where server error keys are surfaced; fix `t(errorKey)` namespace mismatch for translated auth errors (KIM-325)
- `messages/en.json` — add `cookies.*` namespace
- `messages/es.json` — full parity

**Acceptance gate:** Cookie banner dismisses and persists. 30-min time slots appear. Auth errors show translated text. `pnpm build` passes.

---

### M11B — Docker Docs Cleanup (KIM-328) 🚫 Post-MVP

**Priority:** Low
**Agent:** `tech-writer`
**Skill:** —
**Mode:** Any time (docs only)
**Blocked by:** nothing

**Files:**
- `docs/ARCHITECTURE.md` — remove Docker references from Local Development Setup section; replace with Supabase Cloud setup notes

**Acceptance gate:** No Docker references remain in docs. `pnpm build` unaffected.

---

### M12 — Infra / Tooling (KIM-306, KIM-307) — KIM-306 ✅ merged PR #80 · KIM-307 🚫 Post-MVP

**Priority:** Low
**Agent:** `software-engineer` (M12A) + `software-engineer` with `accessibility-wcag` skill (M12B), parallel
**Mode:** Parallel with any other milestone
**Blocked by:** nothing

#### M12A — Seed Data (KIM-306)
**Files:**
- `supabase/seed.sql` or `scripts/seed.ts` — 6 rooms, ~4 tables each, 5 test users (1 admin, 4 members), 10 sample reservations

#### M12B — A11y Audit Tooling (KIM-307)
**Skill:** `accessibility-wcag`
**Files:**
- `package.json` — add `@axe-core/playwright` dev dependency
- `scripts/a11y-audit.ts` — automated WCAG 2.1 AA audit against key pages (home, login, rooms, admin)

**Acceptance gate:** `pnpm seed` populates local Supabase. `pnpm a11y:audit` runs without crashing. `pnpm build` passes.

---

## Dependency Graph

```
M1A+M1B (KIM-316+324: QR + Check-in)  ← Urgent, start here
   │
   ├──► M2 (KIM-327: auto-cancel)
   │       │
   │       └──► M7 (KIM-329+333+334: no-show tracking)
   │               ├──► M7A (KIM-335: admin controls)
   │               └──► M7-QA (KIM-336)
   │
   ├──► M3 (KIM-330+338: overlap restriction backend)
   │       ├──► M3-QA (KIM-339)
   │       └──► M4 (KIM-337: overlap UI)
   │
   ├──► M5 (KIM-331+340: cancellation cutoff backend)
   │       ├──► M5-QA (KIM-342)
   │       └──► M6 (KIM-341: cutoff UI)
   │
   └──► M9-M7 (KIM-353: equipment QR cross-activation) ← also needs M9-M6

M8 (KIM-332+343: events schema)  ← parallel with M3/M5, starts independently
   └──► M8A-backend+frontend (parallel)
           └──► M8B (KIM-345: availability blocking)
                   └──► M8C (KIM-346: cancel affected reservations)
                           └──► M8-QA (KIM-347)

M9-M1 (KIM-349) → M9-M2 (KIM-352) → M9-M3A+M9-M3B (parallel) → M9-M4 → M9-M5 → M9-M6 → M9-M7 → M9-M8

M10 (KIM-322+323)  ← parallel with any non-auth milestone
M11 (KIM-315+317+325)  ← parallel with any backend milestone
M11B (KIM-328)  ← any time, tech-writer
M12A+M12B (KIM-306+307)  ← parallel, any time
```

**Critical path:** M1 → M2 → M7 → M7A
**Longest chain:** M1 → M9-M1 → M9-M2 → M9-M3B → M9-M4 → M9-M5 → M9-M6 → M9-M7 → M9-M8

**Hard external gate:** M9-M7 (KIM-353) does not start until M1 is fully done.

---

## Agent & Skill Summary

| M | Issues | Agent | Skill | Mode |
|---|---|---|---|---|
| M1A | KIM-316, KIM-324 (backend) | `software-engineer` | — | Parallel with M1B |
| M1B | KIM-316, KIM-324 (frontend) | `software-engineer` | `frontend-design` | Parallel with M1A |
| M2 | KIM-327 | `software-engineer` | — | After M1A |
| M3 | KIM-330, KIM-338 | `software-engineer` | — | After M1 |
| M3-QA | KIM-339 | `qa-engineer` | — | After M3 |
| M4 | KIM-337 | `software-engineer` | `frontend-design` | After M3 |
| M5 | KIM-331, KIM-340 | `software-engineer` | — | After M1 |
| M5-QA | KIM-342 | `qa-engineer` | — | After M5 |
| M6 | KIM-341 | `software-engineer` | `frontend-design` | After M5 |
| M7 | KIM-329, KIM-333, KIM-334 | `software-engineer` | — | After M2 |
| M7A | KIM-335 | `software-engineer` | `frontend-design` | After M7 |
| M7-QA | KIM-336 | `qa-engineer` | — | After M7 |
| M8 | KIM-332, KIM-343 | `software-engineer` | — | Parallel with M3/M5 |
| M8A-be | KIM-344 (API) | `software-engineer` | — | After M8, parallel M8A-fe |
| M8A-fe | KIM-344 (UI) | `software-engineer` | `frontend-design` | After M8, parallel M8A-be |
| M8B | KIM-345 | `software-engineer` | — | After M8A-be |
| M8C | KIM-346 | `software-engineer` | — | After M8B |
| M8-QA | KIM-347 | `qa-engineer` | — | After M8C |
| M9-M1 | KIM-349 | `software-engineer` | — | After M1A |
| M9-M2 | KIM-352 | `software-engineer` | — | After M9-M1 |
| M9-M3A | KIM-350 (frontend) | `software-engineer` | `frontend-design` | Parallel with M9-M3B |
| M9-M3B | KIM-350 (API) | `software-engineer` | — | Parallel with M9-M3A |
| M9-M4 | KIM-351 | `software-engineer` | `frontend-design` | After M9-M3B |
| M9-M5 | KIM-354 | `software-engineer` | `frontend-design` | After M9-M4 |
| M9-M6 | KIM-355 | `software-engineer` | `frontend-design` | After M9-M5 |
| M9-M7 | KIM-353 | `software-engineer` | — | After M9-M6 + M1 done |
| M9-M8 | KIM-356 | `qa-engineer` | — | After M9-M7 |
| M10 | KIM-322, KIM-323 | `software-engineer` | — | Parallel with any |
| M11 | KIM-315, KIM-317, KIM-325 | `software-engineer` | `frontend-design` | Parallel with backend |
| M11B | KIM-328 | `tech-writer` | — | Any time |
| M12A | KIM-306 | `software-engineer` | — | Parallel with any |
| M12B | KIM-307 | `software-engineer` | `accessibility-wcag` | Parallel with any |

> `security-reviewer` runs as a gate on the staged diff before every PR is opened.
