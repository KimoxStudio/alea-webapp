# RLS → Service-Layer Audit (KIM-418)

Migration context: Phase F1 of the Supabase → Vercel/Postgres migration (see
`docs/MIGRATION-supabase-to-neon.md`). RLS is planned for removal in a later
phase; several service files already document this explicitly (e.g.
`lib/server/reservations-service.ts`, `lib/server/saved-games-service.ts`).
Since most reads/writes already go through `getAdminDb()` (the RLS-bypassing
admin client — see `lib/db/index.ts`), Postgres RLS is **not** the active
security boundary for those code paths today; the service layer is. This
audit enumerates every RLS policy currently defined in
`supabase/migrations/*.sql`, matches each to its service-layer equivalent,
and hardens the service layer wherever the equivalent was missing or weaker
than the RLS guarantee.

## Count reconciliation vs. KIM-418's stated "30 policies"

**Currently active: 48 policies** (across 15 tables/schemas), not 30.

- 52 distinct policy names were created across all migrations to date.
- 4 were dropped and never replaced: `profiles_admin_select` (absorbed into
  `profiles_member_select`), `activation_tokens_anon_select_by_hash`,
  `activation_tokens_authenticated_select_own`,
  `activation_tokens_authenticated_update_own`.
- 2 were dropped and recreated under the same name with a modified
  definition (net unchanged in count): `events_select_public` (repaired
  grant/policy), `reservation_equipment_admin_all` (rebound from
  `authenticated` to `service_role`).
- 3 filenames (`20260417000028/29/30_reservation_equipment_policy_*.sql`) are
  historical no-ops — despite their names, they never executed a
  `CREATE POLICY` (each file body is a comment only: *"Intentionally no-op:
  reservation_equipment must remain service-role-only"*). The actual
  `reservation_equipment` policies were added later in
  `20260528000006_supabase_linter_fixes.sql`.

52 − 4 = 48 currently active. This is reported honestly rather than forced to
match the issue's "30" — the discrepancy likely comes from counting
something narrower (e.g. distinct tables, or excluding `storage.objects` and
admin-only CRUD policies), but the actual current DB state has 48 active
policies. If KIM-418's "30" matters for a downstream tracking purpose, please
clarify what subset was intended to be counted.

## Enumeration + service-layer mapping

Legend: **Covered** = an equivalent (or stronger) check already exists in the
service layer. **Gap-Fixed** = a missing/weaker check was found and fixed in
this PR. **Gap-Open** = a missing check was found but NOT fixed here (flagged
for human review, with reasoning). **N/A** = the RLS policy has no
corresponding application code path today (dead/unused from the app's
perspective, but still worth knowing about — e.g. if a matching mutation
feature is added later, RLS would no longer be there to save it).

### `equipment`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `equipment_select` | SELECT | `true` (any authenticated) | `listEquipment()` — `lib/server/equipment-service.ts` | Covered |
| `equipment_admin_insert` | INSERT | `is_admin()` | `createEquipment()` — `lib/server/equipment-service.ts` | Gap-Fixed |
| `equipment_admin_update` | UPDATE | `is_admin()` | `updateEquipment()` — `lib/server/equipment-service.ts` | Gap-Fixed |
| `equipment_admin_delete` | DELETE | `is_admin()` | `deleteEquipment()` — `lib/server/equipment-service.ts` | Gap-Fixed |

### `room_default_equipment`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `room_default_equipment_select` | SELECT | `true` (any authenticated) | `getRoomDefaultEquipment()` — `lib/server/equipment-service.ts` | Covered |
| `room_default_equipment_admin_insert` | INSERT | `is_admin()` | `setRoomDefaultEquipment()` — `lib/server/equipment-service.ts` | Gap-Fixed |
| `room_default_equipment_admin_delete` | DELETE | `is_admin()` | `setRoomDefaultEquipment()` (delete-then-insert) — `lib/server/equipment-service.ts` | Gap-Fixed |

No `room_default_equipment_admin_update` policy was ever created — the app
only ever fully replaces a room's default set (delete + insert), never
row-level updates. Consistent, not a gap.

### `reservation_equipment` (final shape, after `20260528000006` + `20260602000007`)

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `reservation_equipment_authenticated_select` | SELECT | owns via `reservations.user_id = auth.uid()` (EXISTS subquery) | `listConflictingEquipmentIds()` / joined reads in `listVisibleReservations()` — `lib/server/reservations-service.ts` | Covered |
| `reservation_equipment_authenticated_insert` | INSERT | owns via reservation (EXISTS subquery) | `saveReservationEquipment()`, called only after `assertReservationAccess()` (ownership+role check) in `createReservationForSession()`/`updateReservationForSession()` | Covered |
| `reservation_equipment_authenticated_update` | UPDATE | owns via reservation (EXISTS subquery) | Not exercised (app only deletes+re-inserts, never updates a row in place) | N/A |
| `reservation_equipment_authenticated_delete` | DELETE | owns via reservation (EXISTS subquery) | `saveReservationEquipment()` (delete step), same ownership gate as insert | Covered |
| `reservation_equipment_admin_all` | ALL | `service_role` only (rebound 2026-06-02 — no longer reachable via `authenticated`) | All admin-side reservation/equipment operations already use `getAdminDb()` | Covered |
| `reservation_equipment_service_role_all` | ALL | `service_role`, `true`/`true` | Same as above | Covered |

Note: `listConflictingEquipmentIds()` / `listReservableEquipment()` query
`reservation_equipment` **across all users** via the admin client to compute
equipment availability (not to expose other members' reservation details) —
this is an intentional, narrow cross-tenant read (booleans only), matching
the pre-existing `equipment_select`-style "global availability" pattern used
throughout `reservations-service.ts`, `rooms-service.ts`, and
`tables-service.ts`. Not a gap.

### `profiles`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `profiles_member_select` | SELECT | `is_admin() OR (id = auth.uid() AND is_active_member())` (absorbed `profiles_admin_select` in `20260528000002`) | Session construction (`getSessionUser()` in `lib/server/auth.ts`) only returns a session for `is_active` profiles; self-read via `getCurrentUser()` (`auth-service.ts`); admin listing via `listPaginatedUsers()` | Covered |
| `profiles_admin_insert` | INSERT | `is_admin()` | Profile rows are created as a side effect of `importMembersFromCsv()`/`importMembersFromSource()` (`users-service.ts`) | Gap-Fixed |
| `profiles_admin_update` | UPDATE | `is_admin()` | `updateUser()`, `resetNoShows()`, `unblockUser()` — `lib/server/users-service.ts` | Gap-Fixed |
| `profiles_admin_delete` | DELETE | `is_admin()` | `deleteUser()` — `lib/server/users-service.ts` | Gap-Fixed |

### `reservations`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `reservations_select` | SELECT | `(user_id = auth.uid() AND is_active_member()) OR is_admin()` | `listVisibleReservations()` — explicit `user_id` filter for non-admins + `assertMemberRowsScoped()` defense-in-depth | Covered |
| `reservations_insert` | INSERT | same | `createReservationForSession()` — writes `user_id: session.id` explicitly | Covered |
| `reservations_update` | UPDATE | same | `updateReservationForSession()` — `assertReservationAccess()` (ownership/role) | Covered |
| `reservations_delete` | DELETE | same | Reservations are soft-deleted via `status: 'cancelled'` through the same `assertReservationAccess()`-gated update path | Covered |

`is_active_member()` is satisfied implicitly: `getSessionUser()` in
`lib/server/auth.ts` refuses to construct a session at all unless
`profile.is_active` is true, so any code holding a `SessionUser` already
passed the equivalent of `is_active_member()`.

### `rooms`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `rooms_public_select` | SELECT | `true` (authenticated + anon) | `listAllRooms()` — `lib/server/rooms-service.ts` | Covered |
| `rooms_admin_insert` | INSERT | `is_admin()` | `createRoomEntry()` — `lib/server/rooms-service.ts` | Gap-Fixed |
| `rooms_admin_update` | UPDATE | `is_admin()` | `updateRoom()` — `lib/server/rooms-service.ts` | Gap-Fixed |
| `rooms_admin_delete` | DELETE | `is_admin()` | No delete-room feature exists in the service layer or routes | N/A (flag if a delete feature is ever added) |

### `tables`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `tables_public_select` | SELECT | `true` (authenticated + anon) | `getTableAvailability()`, `listRoomTables()` | Covered |
| `tables_admin_insert` | INSERT | `is_admin()` | `createTableEntry()` — `lib/server/rooms-service.ts` | Gap-Fixed |
| `tables_admin_update` | UPDATE | `is_admin()` | `regenerateQrCodes()` (writes `qr_code`/`qr_code_inf`) — `lib/server/tables-service.ts` | Gap-Fixed |
| `tables_admin_delete` | DELETE | `is_admin()` | No delete-table feature exists in the service layer or routes | N/A (flag if a delete feature is ever added) |

### `event_room_blocks`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `event_room_blocks_select` | SELECT | `true` (any authenticated) | Read across `rooms-service.ts`, `tables-service.ts`, `reservations-service.ts`, `saved-games-service.ts` (global availability data, not per-user secret) | Covered |
| `event_room_blocks_admin_insert` | INSERT | `is_admin()` | `createClubEvent()`/`updateClubEvent()` (`club-events-service.ts`, via `apply_club_event_room_blocks` RPC — `SECURITY DEFINER`, revoked from anon/authenticated) → Covered. `createEvent()`/`updateEvent()` (legacy `events-service.ts`, via `create_event_with_blocks`/`update_event_with_blocks` RPCs, also revoked from anon/authenticated) → **Gap-Open** | Split: Covered (new) / Gap-Open (legacy) |
| `event_room_blocks_admin_update` | UPDATE | `is_admin()` | Same as above | Split: Covered (new) / Gap-Open (legacy) |
| `event_room_blocks_admin_delete` | DELETE | `is_admin()` | `deleteClubEvent()` (Covered) / `deleteEvent()`→`deleteEventCascade()` (Gap-Open, legacy) | Split: Covered (new) / Gap-Open (legacy) |

### `events`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `events_select` | SELECT | `true` (any authenticated) | `listEvents()`, `getEvent()` — legacy internal dashboard reads | Covered |
| `events_select_public` | SELECT | anon, `title_es IS NOT NULL AND title_en IS NOT NULL` | `listClubEvents()` — `lib/server/club-events-service.ts` (same predicate, `isClubEventRow()`) | Covered |
| `events_admin_insert` | INSERT | `is_admin()` | `createClubEvent()` (Covered) / `createEvent()` (Gap-Open, legacy) | Split |
| `events_admin_update` | UPDATE | `is_admin()` | `updateClubEvent()` (Covered) / `updateEvent()` (Gap-Open, legacy) | Split |
| `events_admin_delete` | DELETE | `is_admin()` | `deleteClubEvent()` (Covered) / `deleteEvent()` (Gap-Open, legacy) | Split |

### `activation_tokens` (final shape — fully locked to `service_role`)

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `activation_tokens_service_role_all` | ALL | `service_role`, `true`/`true` | All access via `getAdminDb()` in `lib/server/auth-service.ts`; app-layer token/expiry/`used_at` validation (`getActivationLinkState`, `activateAccount`, `getRecoveryLinkState`, `recoverAccount`) is the *only* boundary since RLS grants nothing to anon/authenticated anymore | Covered |

3 policies were created here (`activation_tokens_anon_select_by_hash`,
`activation_tokens_authenticated_select_own`,
`activation_tokens_authenticated_update_own`) and all 3 were later dropped
(`20260602000001`, `20260602000008`, `20260602000005`) along with the
table-level `anon`/`authenticated` grants — this table is now reachable only
through the admin client, so its security fully depends on
`lib/server/auth-service.ts` doing the token-hash/expiry/`used_at` checks
correctly, which it does today. Two admin-triggered mutation entry points
(`generateActivationLink()`, `generateRecoveryLink()`) had no in-function
admin check — **Gap-Fixed** in this PR.

### `saved_games` / `saved_game_attendances`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `saved_games_select` | SELECT | `user_id = auth.uid() OR is_admin()` | `listSavedGamesForSession()` — explicit `user_id` filter for non-admins + `assertMemberRowsScoped()` | Covered |
| `saved_game_attendances_select` | SELECT | matching saved_game owned by `auth.uid()` or admin | No read path exists in the service layer today (only `INSERT` via `recordSavedGameAttendance()`, admin client, system/cron context) | N/A |

`createSavedGameForSession()` writes `user_id: session.id` explicitly;
`renewSavedGameForSession()` checks `current.user_id !== session.id` before
mutating. Both Covered.

### `partners`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `partners_select_active` | SELECT | anon+authenticated, `active = true` | Public `listPartners()`-style read in `lib/server/partners-service.ts` | Covered |
| (writes: no RLS policy — service_role only) | INSERT/UPDATE/DELETE | n/a (locked to service_role by design, per migration comment) | `createPartner()`, `updatePartner()`, `deletePartner()` already call `requireAdminSession(session)` | Covered |

### `library_games`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `library_games_select_active` | SELECT | anon+authenticated, `active = true` | Public read in `lib/server/library-games-service.ts` | Covered |
| (writes: service_role only) | INSERT/UPDATE/DELETE | n/a | `createLibraryGame()`, `updateLibraryGame()`, `deleteLibraryGame()` already call `requireAdminSession(session)` | Covered |

### `event_equipment` (RLS enabled, zero policies — fully locked to `service_role`)

Not a "policy" per se, but flagged for completeness: `ALTER TABLE
event_equipment ENABLE ROW LEVEL SECURITY` with no `CREATE POLICY` at all
(`20260704000006_oir208_table_blocks_and_materials.sql`). Only reachable via
`apply_club_event_room_blocks` RPC (`SECURITY DEFINER`, revoked from
anon/authenticated) called from `createClubEvent()`/`updateClubEvent()`,
already gated by `requireAdminSession()`. Covered.

### `storage.objects`

| Policy Name | Command | RLS Logic | Service-Layer Equivalent | Status |
|---|---|---|---|---|
| `qr_codes_public_read` | SELECT | `bucket_id = 'table-qr-codes'` | Public read, no privilege needed by design | Covered |
| `qr_codes_service_delete` | DELETE | `bucket_id = 'table-qr-codes' AND auth.role() = 'service_role'` | Writes via `uploadToStorage()` (`lib/storage/qr/index.ts`, always admin client) | Covered |
| `qr_codes_service_update` | UPDATE | same | Same | Covered |
| `qr_codes_service_write` | INSERT | same | Same, now additionally gated by `requireAdminSession()` in `tables-service.ts` | Gap-Fixed |
| `landing_media_select_public` | SELECT | `bucket_id = 'landing-media'` (anon+authenticated) | Public read, no privilege needed by design | Covered |

## Gaps found and fixed in this PR

The following service-layer functions used `getAdminDb()` (which bypasses
RLS entirely) with **no in-function admin-role check** — the only
authorization boundary was the calling route handler's `requireAdmin()`.
This is inconsistent with the already-established pattern in
`club-events-service.ts`, `partners-service.ts`, `library-games-service.ts`,
and `uploads-service.ts` (each has a local `requireAdminSession(session)`
helper called at the top of every admin mutation). Fixed by adding the same
pattern:

- **`lib/server/equipment-service.ts`**: `createEquipment`, `updateEquipment`,
  `deleteEquipment`, `setRoomDefaultEquipment` — now take `session:
  SessionUser` as the first parameter and call `requireAdminSession(session)`.
- **`lib/server/rooms-service.ts`**: `createRoomEntry`, `updateRoom`,
  `createTableEntry` — same fix. `createTableEntry`'s fire-and-forget call to
  `regenerateQrCodes()` now threads `session` through.
- **`lib/server/tables-service.ts`**: `regenerateQrCodes`,
  `generateTableQrCode` (unused today, hardened for consistency/future use)
  — same fix.
- **`lib/server/users-service.ts`**: `listPaginatedUsers`, `updateUser`
  (includes role-escalation — `body.role`), `resetNoShows`, `unblockUser`,
  `deleteUser`, `importMembersFromCsv`, `importMembersFromSource` — same fix.
  This was the highest-severity finding: `updateUser` can grant the `admin`
  role, and `deleteUser` deletes the auth account — both had zero
  defense-in-depth.
- **`lib/server/auth-service.ts`**: `generateActivationLink`,
  `generateRecoveryLink` (admin-triggered activation/recovery link
  generation for a member) — added a `session: SessionUser` field to the
  input object + `requireAdminSession(input.session)`.

All corresponding route handlers (`app/api/equipment/**`,
`app/api/rooms/**`, `app/api/tables/[id]/qr/route.ts`, `app/api/users/**`)
were updated to pass `admin.session` (already available from the existing
`requireAdmin(request)` call) into the service function.

**Breaking change for tests (resolved):** the functions above changed
signatures (added a leading/new `session` parameter). This broke every test
file that called them directly; those files have since been updated (test
files are qa-engineer's exclusively, per repo convention) by adding a
`createAdminSession()`-style helper and passing the session as the new
required parameter: `__tests__/server/equipment-service.test.ts`,
`__tests__/server/rooms-service.test.ts`, `__tests__/server/tables-service.test.ts`,
`__tests__/server/users-service.test.ts`, `__tests__/server/member-import.test.ts`,
`__tests__/server/auth-activation.test.ts`, `__tests__/server/auth-recovery.test.ts`,
`__tests__/app/api/users/patch-route.test.ts`,
`__tests__/app/api/users/activation-link-route.test.ts`,
`__tests__/app/api/users/recovery-link-route.test.ts`, and
`__tests__/app/api/users/import-route.test.ts`. `pnpm typecheck`, `pnpm lint`,
`pnpm test`, and `pnpm build` all pass at the current PR head.

## Gaps found and left open (needs human review)

- **`lib/server/events-service.ts`** (`createEvent`, `updateEvent`,
  `deleteEvent`/`deleteEventCascade`, and indirectly `event_room_blocks`
  writes): same missing-service-layer-check pattern as the functions fixed
  above, but **not fixed in this PR**. This file is explicitly documented in
  its own code (lines 252–270) as a legacy internal-events dashboard surface,
  superseded by `club-events-service.ts`, kept only because
  `__tests__/server/events-service.test.ts` and
  `__tests__/server/events-service-multiday.test.ts` exercise it directly,
  and a prior review explicitly decided "test edits are out of scope for
  this change." Route-level protection exists today (`requireAdmin()` in
  `app/api/events/route.ts` and `app/api/events/[id]/route.ts`), so there is
  no active exploit — the gap is purely the missing defense-in-depth layer.
  Recommend one of: (a) retire this surface now that no UI component
  consumes it (per the file's own comment), or (b) apply the same
  `requireAdminSession(session)` fix if it must stay, updating its test
  suite in the same change. Left for human/product decision since retiring
  a surface is a product/architecture call, not a "minimal, focused" service
  fix.
- **`rooms_admin_delete` / `tables_admin_delete`**: no delete-room or
  delete-table feature exists anywhere in the app today, so there is nothing
  to harden. Flagging so that if either feature is added later, its
  service-layer function must include the same `requireAdminSession` check
  from day one rather than relying on RLS (which will be removed) or the
  route handler alone.

## Minor doc-only finding (not a security gap)

`lib/server/saved-games-service.ts`'s file-level comment says
`assertMemberRowsScoped()` "is not imported or called here today" — this is
stale; the function is in fact imported and called in
`listSavedGamesForSession()`. No code change needed (the implementation is
already correct), but the comment is misleading and worth a documentation
fix in a follow-up.
