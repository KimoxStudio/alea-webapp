# Migration: Supabase → Neon (via Vercel Postgres)

**Status:** Planned — not started
**Decisions locked:** 2026-06-20 · **Estimate produced:** 2026-07-09
**Note:** Vercel Postgres is powered by Neon underneath (btree_gist / pgcrypto / uuid-ossp + serverless pooling). "Neon via Vercel" = this locked decision.

## Goal

Eliminate Supabase entirely. Migrate data, auth, storage, and cron to the Vercel platform.

## Locked decisions (2026-06-20)

1. **Data → Vercel Postgres (Neon).** Migration = `pg_dump` from Supabase → restore into Vercel Postgres. Total removal of Supabase.
2. **Eliminate RLS entirely.** Access control moves 100% to the service layer.
3. **Vercel Cron** (drop cron-job.org).
4. **Auth + data migrate together in a single atomic cutover** — Supabase Auth (GoTrue) needs its `auth.users` table inside the Supabase Postgres; if data leaves, GoTrue loses its DB. "Migrate auth last" is rejected.

## RLS → service-layer parity gate (blocks F2 cutover)

Decision 2 removes the database authorization layer entirely, so it must not be able to happen silently. This project's existing convention already puts privilege checks (ownership + role) in the service layer, never in route handlers (root `CLAUDE.md`) — F1 extends that same pattern to cover what RLS currently does. Before any RLS policy is dropped, F1 (issue #11) must produce and attach the following parity artifact to that issue:

| Requirement | Detail |
|---|---|
| Enumerate | List all 30 existing RLS policies (table, policy name, command, `USING`/`WITH CHECK` expression). Producing this list is in scope of issue #11 itself, not this plan. |
| Map | A 1:1 mapping from each RLS policy to the exact service-layer function/file that replaces it. |
| Test | Per replaced policy, tests covering: owner-access allow, admin-access allow, and cross-tenant/other-user denial. |
| Sign-off | Parity artifact (list + mapping + passing tests) reviewed before F2 cutover starts — "audit later" is not acceptable. |

This gate must be **fully satisfied**, not merely started, before RLS is dropped during the F2 cutover. F2 (issues #12/#13) is blocked on this artifact, in addition to its existing dependency on F1.

## Current Supabase surface (measured 2026-07-09)

| Metric | Count |
|---|---|
| Files touching Supabase | 25 |
| SQL migrations | 85 (30 contain RLS policies) |
| Service-layer files | 24 |
| Uses of `createSupabaseServer*` | 15 files |
| Auth/session surface | 13 files |
| Storage/QR | 2 files |
| Deps to remove | `@supabase/ssr`, `@supabase/supabase-js` |
| Target stack present today | none (drizzle / neon / next-auth / bcrypt = greenfield) |

## Blockers — must fix before any Vercel deploy

1. `lib/server/security.ts` imports Node `crypto`; imported by `middleware.ts` (Edge runtime) → runtime failure.
2. Rate limiter uses a `globalThis` Map → no-op across serverless instances.
3. Cron `mark-no-show` not registered in `vercel.json`.

## P0 security (pre-migration)

Rotate all `.env.local` secrets: service-role key, `CRON_SECRET`, `AUTH_SESSION_SECRET`, QA creds. `AUTH_SESSION_SECRET` has no code consumer → investigate/remove.

## Phases

- **F0 — Abstraction seams + reorg** (no downtime): introduce `lib/db`, `lib/auth/session`, `lib/storage/qr`; regroup flat `lib/server/` (24 files) by domain.
- **F1 — Build target in parallel** (no cutover): Auth.js (Credentials + bcrypt) + Drizzle schema against Neon. Translate the 85 migrations to the final Drizzle schema; the 30 RLS policies become service-layer authorization checks, subject to the [RLS → service-layer parity gate](#rls--service-layer-parity-gate-blocks-f2-cutover).
- **F2 — Atomic cutover**: `pg_dump` → restore data; activate Auth.js + Drizzle; copy bcrypt hashes from `auth.users.encrypted_password` → `profiles.password_hash` (bcryptjs-compatible, no re-hash); invalidate sessions (users re-login once).
- **F3 — Vercel Blob**: migrate QR codes (2 files) + backfill dead URLs.
- **F4 — Cleanup**: remove Supabase deps/dirs.

## Effort estimate

| Phase | Work | Effort | Risk |
|---|---|---|---|
| Pre: 3 Vercel blockers + rotate P0 secrets | crypto/Edge, serverless rate-limiter, cron in vercel.json | 1–2 d | medium |
| F0: abstraction seams + `lib/server` regroup | 24 files funneled through seams, no downtime | 2–3 d | low |
| F1: Auth.js + Drizzle schema vs Neon (parallel) | 85 migrations → final Drizzle schema; 30 RLS → service-layer checks | 4–6 d | high |
| F2: atomic cutover | dump→restore, activate auth+Drizzle, copy bcrypt hashes, invalidate sessions | 2–3 d + rehearsals | high |
| F3: Vercel Blob (QR) | 2 files + URL backfill | 1 d | low |
| F4: remove Supabase deps/dirs | final cleanup | 0.5 d | low |

**Total engineering effort:** ~11–16 working days.
**Realistic calendar:** 3–4 weeks (includes review, tests, ≥1 cutover rehearsal, user re-login window).
**Critical path:** F1 → F2 carries ~60% of risk and time.

## Risk drivers

1. Atomic auth+data cutover — single shot, requires a full rehearsal first.
2. 85 migrations → Drizzle schema — manual translation, verify exact parity.
3. 30 RLS policies removed → all authorization moves to the service layer; the convention already exists (see CLAUDE.md) but 100% coverage must be audited.
4. Real DB push/restore is user-only — agents prepare and validate; the user executes the cutover.

## Remaining work (to port into Linear)

Each row below becomes one Linear issue.

| # | Issue | Phase | Depends on |
|---|---|---|---|
| 1 | Fix `crypto` import in Edge middleware | Pre | — |
| 2 | Serverless-safe rate limiter | Pre | — |
| 3 | Register `mark-no-show` cron in vercel.json | Pre | — |
| 4 | Rotate P0 secrets + resolve `AUTH_SESSION_SECRET` | Pre | — |
| 5 | Introduce `lib/db` seam | F0 | 1–4 |
| 6 | Introduce `lib/auth/session` seam | F0 | 1–4 |
| 7 | Introduce `lib/storage/qr` seam | F0 | 1–4 |
| 8 | Regroup `lib/server` by domain | F0 | 1–4 |
| 9 | Build Auth.js (Credentials + bcrypt) | F1 | F0 |
| 10 | Build Drizzle schema vs Neon (translate 85 migrations) | F1 | F0 |
| 11 | Migrate 30 RLS policies to service-layer checks + audit coverage — must satisfy the [RLS → service-layer parity gate](#rls--service-layer-parity-gate-blocks-f2-cutover) | F1 | 10 |
| 12 | Atomic cutover runbook + rehearsal | F2 | F1, parity gate sign-off |
| 13 | Execute cutover (user-only) | F2 | 12 |
| 14 | Migrate QR to Vercel Blob + backfill URLs | F3 | F2 |
| 15 | Remove Supabase deps/dirs | F4 | F3, F4 |
