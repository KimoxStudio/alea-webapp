# KIM-348 — Equipment Reservation System: Execution Plan

> Generated: 2026-04-10
> Epic: [KIM-348](https://linear.app/kimox-studio/issue/KIM-348)
> Status: Backlog — blocked partially by KIM-324 (QR check-in)

---

## Codebase Findings

| Area | Finding |
|---|---|
| `components/admin/admin-dashboard.tsx` | shadcn `Tabs` with 3 existing tabs (Users, Reservations, Rooms). "Equipos" is the 4th tab. |
| `lib/server/reservations-service.ts` | Conflict detection via `listActiveReservationsForConflict` + `hasReservationConflict`. KIM-352 must mirror this pattern. |
| `app/api/reservations/route.ts` | Guard sequence: `requireAuth` + `enforceMutationSecurity` + `enforceRateLimit`. All new equipment routes must follow this. |
| `lib/supabase/types.ts` | Manually maintained. Must be updated in M1 alongside the migration. |
| `lib/supabase/` | `createSupabaseServerAdminClient()` for admin writes; `createSupabaseServerClient()` for user-scoped reads. |
| `qrcode` package | Already installed (v1.5.4 with types). Equipment units follow the same `qr_code` + `qr_image_url` pattern as tables. |
| `messages/en.json` | Top-level namespaces: `common`, `nav`, `auth`, `rooms`, `tables`, `reservations`, `admin`, `home`, `footer`. New keys: `admin.equipment.*` and `reservations.equipment.*`. |
| `components/rooms/reservation-dialog.tsx` | Dialog flow: date → surface → time slots → submit. Equipment add-on step inserts after time confirmation, before submit. |
| `components/reservations/my-reservations-view.tsx` | One cancel button per reservation triggers a confirmation dialog. KIM-355 extends this for equipment-only vs full cancel. |
| `app/[locale]/check-in/` | **Does not exist yet.** KIM-353 creates it from scratch. Blocked by KIM-324. |

---

## Key Business Rules

- **Global inventory**: Equipment exists independently of rooms/tables. Any table reservation can request an available unit by type.
- **Optional add-on**: Reserving equipment is never mandatory when booking a table.
- **One per type, no overlap**: A user cannot hold two equipment reservations of the same type that overlap in time. Same logic as tables (KIM-330).
- **Linked lifecycle**: An equipment reservation cannot exist without an associated table reservation.
- **QR cross-activation**: Table QR activates table + all pending equipment reservations. Equipment QR activates the equipment reservation AND the linked table reservation (bidirectional — they are a set).
- **Independent cancellation**: Equipment-only cancel leaves the table active. Full cancel (table) cascades to all equipment reservations.
- **Cancellation cutoff**: 1-hour cutoff (KIM-331) applies to user equipment-only cancellations. Admin bypasses it.

---

## Milestones — Ordered by Priority

### M1 — KIM-349: Data model
**Priority:** Highest — everything depends on it.
**Agent:** `software-engineer`
**Skill:** —
**Mode:** Sequential
**Domain:** Backend — `supabase/migrations/`, `lib/supabase/types.ts`

#### Files
- `supabase/migrations/20260410000000_equipment_schema.sql` — new migration:
  - Enum: `equipment_reservation_status` (`pending`, `active`, `cancelled`)
  - Table `equipment_types`: `id uuid PK`, `name text`, `description text nullable`, `created_at`
  - Table `equipment`: `id uuid PK`, `equipment_type_id uuid FK → equipment_types`, `name text`, `qr_code text UNIQUE`, `qr_image_url text nullable`, `is_active bool DEFAULT true`, `created_at`
  - Table `equipment_reservations`: `id uuid PK`, `reservation_id uuid FK → reservations ON DELETE CASCADE`, `equipment_id uuid FK → equipment`, `status equipment_reservation_status DEFAULT pending`, `activated_at timestamptz nullable`, `cancelled_at timestamptz nullable`, `created_at`
  - Indexes: `equipment_type_id_idx`, `equipment_reservation_id_idx`, `equipment_is_active_idx`
  - RLS: admin full access via `is_admin()`; member SELECT on `equipment_reservations` via `reservations.user_id = auth.uid()`; public SELECT on `equipment_types` and `equipment` (needed for booking flow)
- `lib/supabase/types.ts` — add Row/Insert/Update types for all three new tables + new enum to `Database["public"]["Enums"]`

**Acceptance gate:** Migration applies cleanly. `lib/supabase/types.ts` compiles. `pnpm build` passes. No other milestone begins until green.

---

### M2 — KIM-352: Business rule — one per type, no time overlap
**Priority:** High — must exist before any booking flow or admin writes.
**Agent:** `software-engineer`
**Skill:** —
**Mode:** Sequential after M1
**Domain:** Backend — `lib/server/equipment-service.ts` (new file)

#### Files
- `lib/server/equipment-service.ts` — new file with:
  - `createEquipmentType`, `updateEquipmentType`, `deleteEquipmentType` (with active-reservation guard → 409)
  - `createEquipmentUnit` — generates unique `qr_code` token + base64 QR image via `qrcode` library; stores `qr_image_url`
  - `updateEquipmentUnit`, `toggleEquipmentUnitActive`, `deleteEquipmentUnit` (409 if active reservations)
  - `listEquipmentTypes`, `listEquipmentUnits`, `getEquipmentUnitByQrCode`
  - `checkEquipmentTypeOverlap(userId, equipmentTypeId, date, startTime, endTime)` — throws `ServiceError('EQUIPMENT_TYPE_OVERLAP', 409)` if overlap found
  - `createEquipmentReservation(reservationId, equipmentTypeId)` — calls overlap check, picks first available unit, inserts row
  - `cancelEquipmentReservation(equipmentReservationId, session)` — 1-hour cutoff for members; admin bypass
  - `getEquipmentReservationsForReservation(reservationId)`

**Acceptance gate:** `pnpm typecheck` passes. `pnpm build` passes.

---

### M3 — KIM-350: Admin "Equipos" tab (parallel sub-agents)
**Priority:** High.
**Mode:** M3A and M3B run in parallel. M3 runs after M2.
**Domain:** Both frontend and backend (disjoint files — safe to parallelize).

#### M3A — Frontend
**Agent:** `software-engineer`
**Skill:** `frontend-design`

- `components/admin/admin-dashboard.tsx` — add "Equipos" tab (icon: `Package` from lucide-react)
- `components/admin/equipment-section.tsx` — new: two-panel layout (Types list + Units panel). Follows `rooms-section.tsx` pattern. Create/edit dialogs, toggle active badge, QR download button. Uses shadcn `Dialog`, `Badge`, `Button`, `Input`, `Label`, `Switch`.
- `lib/hooks/use-admin.ts` — add hooks: `useAdminEquipmentTypes`, `useAdminCreateEquipmentType`, `useAdminUpdateEquipmentType`, `useAdminDeleteEquipmentType`, `useAdminEquipmentUnits`, `useAdminCreateEquipmentUnit`, `useAdminToggleEquipmentUnit`, `useAdminDeleteEquipmentUnit`
- `messages/en.json` — add `admin.equipment.*`: `typeName`, `unitName`, `isActive`, `createType`, `createUnit`, `editType`, `editUnit`, `deleteType`, `deleteUnit`, `noTypes`, `noUnits`, `downloadQr`, `typeManagement`, `deactivateWarning`, `deleteBlockedActiveReservations`
- `messages/es.json` — full parity

#### M3B — Backend
**Agent:** `software-engineer`
**Skill:** —

- `app/api/equipment/types/route.ts` — GET list, POST create (admin only)
- `app/api/equipment/types/[id]/route.ts` — PUT update, DELETE (admin only; 409 if active reservations)
- `app/api/equipment/units/route.ts` — GET list (filterable by type), POST create (admin only; QR auto-generated)
- `app/api/equipment/units/[id]/route.ts` — PUT update/toggle, DELETE (admin only)
- All routes: `requireAuth` + `enforceMutationSecurity` (mutations) + role check → service call → `toServiceErrorResponse`

**Acceptance gate:** Admin can create types and units. QR appears in the unit row and is downloadable. Delete with active reservations returns 409. Toggle active/inactive works. `pnpm build` passes.

---

### M4 — KIM-351: Booking add-on flow
**Priority:** Medium-High.
**Agent:** `software-engineer`
**Skill:** `frontend-design` (dialog step)
**Mode:** Sequential after M3B. Frontend changes are parallel-safe with M3A (disjoint files).
**Domain:** Both — `components/rooms/reservation-dialog.tsx` (frontend) + new API route (backend)

#### Files
- `app/api/equipment/available/route.ts` — GET: given `date`, `startTime`, `endTime`, returns equipment types with available unit counts for that window
- `components/rooms/reservation-dialog.tsx` — add optional equipment step after time confirmation: shows available types, user selects 0 or more, skippable. On confirm calls `POST /api/equipment/reservations` atomically.
- `app/api/equipment/reservations/route.ts` — POST: creates equipment reservation via service layer (overlap check + unit assignment)
- `lib/hooks/use-reservations.ts` — add `useAvailableEquipment(date, startTime, endTime)` and `useCreateEquipmentReservation()`
- `messages/en.json` — add `reservations.equipment.*`: `addEquipment`, `skipEquipment`, `availableEquipment`, `unitsAvailable`, `selectEquipment`, `equipmentStep`, `noEquipmentAvailable`, `equipmentAdded`
- `messages/es.json` — full parity

**Acceptance gate:** Completing a table reservation presents the equipment step. Selecting a type creates an `equipment_reservations` row. Skipping closes the dialog cleanly. `EQUIPMENT_TYPE_OVERLAP` is surfaced as an error. `pnpm build` passes.

---

### M5 — KIM-354: User-facing equipment view
**Priority:** Medium.
**Agent:** `software-engineer`
**Skill:** `frontend-design`
**Mode:** Sequential after M4.
**Domain:** Frontend (`components/reservations/`, `components/admin/`) + minor service extension

#### Files
- `lib/server/reservations-service.ts` — extend `RESERVATION_ENRICHED_COLUMNS` to include `equipment_reservations(id, status, activated_at, equipment(name, equipment_types(name)))`. Extend `mapEnrichedReservation` to include `equipment[]` on `Reservation`.
- `lib/types/index.ts` — add `EquipmentReservation` interface (`id`, `status`, `activatedAt`, `equipmentName`, `typeName`). Add optional `equipment?: EquipmentReservation[]` to `Reservation`.
- `components/reservations/my-reservations-view.tsx` — extend `ReservationCard` to render equipment chips below time row (type name, unit name, status badge).
- `components/admin/reservations-section.tsx` — extend admin reservation rows to show equipment (type name, unit name, `activated_at` if active).
- `messages/en.json` — add `reservations.equipment.status.*`, `reservations.equipment.activatedAt`, `admin.equipment.activatedAt`
- `messages/es.json` — full parity

**Acceptance gate:** My Reservations shows equipment badges. Admin reservations show equipment rows. `pnpm build` passes.

---

### M6 — KIM-355: Cancellation flows
**Priority:** Medium.
**Agent:** `software-engineer`
**Skill:** `frontend-design` (dialog), pure `software-engineer` (service)
**Mode:** Sequential after M5. Backend and frontend changes can be split between two parallel agents (disjoint files).
**Domain:** Both

#### Files
- `lib/server/equipment-service.ts` — add `cancelEquipmentReservation` (1-hour cutoff for members, admin bypass); add `cancelAllEquipmentForReservation(reservationId)` for cascade
- `lib/server/reservations-service.ts` — in `updateReservationForSession`, when `nextStatus === 'cancelled'`, call `cancelAllEquipmentForReservation(reservationId)` via admin client
- `app/api/equipment/reservations/[id]/route.ts` — PUT: equipment-only cancel
- `components/reservations/my-reservations-view.tsx` — extend cancel confirmation dialog: if `reservation.equipment` non-empty, show "Cancel equipment only" and "Cancel everything" options. Add "Cancel equipment" button per equipment chip.
- `messages/en.json` — add `reservations.cancelEquipmentOnly`, `reservations.cancelAll`, `reservations.cancelEquipmentConfirm`, `reservations.equipment.cancelConfirm`
- `messages/es.json` — full parity

**Acceptance gate:** Equipment-only cancel leaves table active. Full cancel cascades to equipment. 1-hour cutoff enforced for members. Admin bypasses. `pnpm build` passes.

---

### M7 — KIM-353: QR cross-activation ⚠️ Blocked by KIM-324
**Priority:** High (concept) — **externally blocked**.
**Agent:** `software-engineer`
**Skill:** —
**Mode:** Sequential. Do not start until KIM-324 is merged.
**Domain:** Both — new check-in page (frontend) + service logic (backend)

#### Files
- `app/[locale]/check-in/equipment/[equipmentId]/page.tsx` — new page: reads QR param, calls check-in API, renders success/error states
- `app/api/check-in/equipment/[equipmentId]/route.ts` — GET: looks up equipment by `qr_code`; finds linked `equipment_reservation` with status `pending`; activates it; if linked `reservation.status !== active`, also activates it; returns full state
- `lib/server/equipment-service.ts` — add `activateByEquipmentQr(qrCode)`: resolves equipment → equipment_reservation → table reservation; handles all edge cases as `ServiceError`
- KIM-324's check-in service — extend to cascade activation to all pending `equipment_reservations` for the reservation (bidirectional)
- `messages/en.json` — add `checkin.equipment.*`: `activated`, `alreadyActive`, `notFound`, `tableCancelled`, `noReservation`
- `messages/es.json` — full parity

**Edge cases:**
- No matching reservation for the equipment QR → "No active reservation found for this equipment"
- Already activated → "Already checked in" (no-op)
- Equipment reservation exists but table is cancelled → reject with error

**Acceptance gate:** Scanning equipment QR activates equipment + table (if pending). Scanning table QR activates all pending equipment reservations. All edge cases return correct UI states. `pnpm build` passes.

---

### M8 — KIM-356: Tests
**Priority:** Medium — sweep milestone after all service functions are finalized.
**Agent:** `qa-engineer`
**Skill:** —
**Mode:** Sequential after M7.
**Domain:** Backend — `__tests__/server/`

#### Files
- `__tests__/server/equipment-service.test.ts` — new file covering:
  - CRUD for types and units
  - QR generation (unique token, base64 output)
  - Overlap rule: no overlap passes; same-type overlap throws `EQUIPMENT_TYPE_OVERLAP`; different-type overlap passes
  - QR cross-activation: equipment QR activates equipment + table; table QR cascades to equipment
  - Cancellation cascade: full table cancel sets all equipment to cancelled
  - Equipment-only cancel: 1-hour cutoff for members; admin bypass
  - Unit availability: no units → empty; all units booked → empty
- `__tests__/server/reservations-service.test.ts` — extend: add test for equipment cascade when table is cancelled

**Note:** Test files live in `__tests__/server/` at the repo root, outside `"include": ["src"]` in `tsconfig.app.json` — already excluded implicitly. Verify before writing tests.

**Acceptance gate:** `pnpm test` passes all new and existing tests. `pnpm build` passes.

---

## Dependency Graph — Critical Path

```
M1 (KIM-349: Schema)
  └── M2 (KIM-352: Service layer + overlap rule)
        ├── M3A (KIM-350: Admin frontend)  ──┐ parallel
        ├── M3B (KIM-350: Admin API routes) ─┤
        │                                    │
        └── M3B done ──► M4 (KIM-351: Booking add-on)
                           └── M5 (KIM-354: User views)
                                 └── M6 (KIM-355: Cancellation)
                                       └── [KIM-324 merged]
                                             └── M7 (KIM-353: QR cross-activation)
                                                   └── M8 (KIM-356: Tests)
```

**Critical path:** M1 → M2 → M3B → M4 → M5 → M6 → [KIM-324] → M7 → M8

**Parallelism opportunities:**
- M3A (admin frontend) runs in parallel with M3B (admin API routes) — disjoint files
- M3A runs in parallel with M4-frontend once M3B API is complete — `equipment-section.tsx` vs `reservation-dialog.tsx` are disjoint

**Hard external gate:** M7 does not start until KIM-324 is merged, regardless of internal progress.

---

## Agent and Skill Summary

| M | Issue | Agent | Skill | Mode |
|---|---|---|---|---|
| M1 | KIM-349 | `software-engineer` | — | Sequential |
| M2 | KIM-352 | `software-engineer` | — | Sequential |
| M3A | KIM-350 frontend | `software-engineer` | `frontend-design` | Parallel with M3B |
| M3B | KIM-350 API | `software-engineer` | — | Parallel with M3A |
| M4 | KIM-351 | `software-engineer` | `frontend-design` | After M3B |
| M5 | KIM-354 | `software-engineer` | `frontend-design` | After M4 |
| M6 | KIM-355 | `software-engineer` | `frontend-design` | After M5 |
| M7 | KIM-353 | `software-engineer` | — | After M6 + KIM-324 |
| M8 | KIM-356 | `qa-engineer` | — | After M7 |

> `security-reviewer` acts as a gate before each PR is opened — reviews the staged diff, not the PR URL.

---

## Design Constraints (for all software-engineer agents)

1. **All business logic in `lib/server/equipment-service.ts`** — never in route handlers.
2. **`EQUIPMENT_TYPE_OVERLAP` as `ServiceError('EQUIPMENT_TYPE_OVERLAP', 409)`** — propagates via `toServiceErrorResponse`.
3. **QR generation** — server-side, `qrcode@1.5.4`, unique token in `qr_code`, image in `qr_image_url`. Generated at unit creation, not on demand.
4. **`lib/supabase/types.ts` updated in M1** — manually maintained, not auto-generated. New enum must be in `Database["public"]["Enums"]`.
5. **Delete guards** — types and units with `pending`/`active` reservations return 409 from service layer.
6. **i18n parity** — every key in `en.json` must have a translated counterpart in `es.json` in the same commit.
7. **`tsconfig.app.json`** — `__tests__/` is at repo root, outside `"include": ["src"]`, so already excluded. Verify before M8.
