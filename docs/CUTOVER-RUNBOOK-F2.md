# F2 Cutover Runbook — Supabase → Neon (via Vercel Postgres) + Auth.js

**Status:** Prep artifact only — not yet executed.
**Related plan:** `docs/MIGRATION-supabase-to-neon.md` (phase F2, issues #12/#13 in that plan's table; tracked as KIM-419/KIM-420).
**Depends on:** F1 sign-off — the RLS → service-layer parity gate (`docs/RLS-SERVICE-LAYER-AUDIT.md`, PR #168), Drizzle schema (`lib/db/schema/`, PR #169), and Auth.js scaffold (`lib/authjs/`, PR #170). **PR #169 and PR #170 have been merged into `develop`; PR #168 (RLS → service-layer parity gate) is still open, not yet merged, as of this writing.**

---

## 0. Ownership — read this first

| This document (KIM-419) | Real execution (KIM-420) |
|---|---|
| Prepared by agents (software-engineer). | **USER-ONLY.** No agent may execute any step in section 2 against a real Supabase, Neon, or Vercel Postgres project. |
| Describes the exact sequence, checks, and rollback triggers. | The human operator follows this runbook manually, step by step, during a scheduled maintenance window. |
| Ships a rehearsal script (`scripts/cutover-rehearsal.sh`) that exercises the *mechanical logic* (dump-shape validation, hash-copy, session-invalidation) against synthetic fixtures only. | Ships nothing extra — KIM-420 is the act of running the real thing, with real credentials, against real infra. |

If you are an agent reading this document: you may read, extend, and rehearse against synthetic/local data. You may never run any step in section 2 against real infrastructure, and you may never read or echo a real `.env*` value while doing so.

---

## 1. Preconditions (must all be true before scheduling a real cutover)

- [ ] F1 PRs (#168 RLS→service-layer audit, #169 Drizzle schema, #170 Auth.js) are merged to `develop`.
- [ ] The RLS → service-layer parity gate (`docs/MIGRATION-supabase-to-neon.md`, "RLS → service-layer parity gate") is fully signed off: all 48 active RLS policies (audited count, PR #168 — supersedes the earlier 30-policy planning estimate in `docs/MIGRATION-supabase-to-neon.md`) enumerated, mapped 1:1 to service-layer checks, and covered by owner/admin/cross-tenant-denial tests — all green.
- [ ] The `profiles.password_hash` column exists in the target Drizzle schema (`lib/db/schema/profiles.ts`) and its type/nullability matches what `lib/authjs/credentials-user.ts` expects. **PR #169 now defines this column (`passwordHash: text('password_hash')` in `lib/db/schema/profiles.ts`, and `"password_hash" text` in the generated migration SQL), so the schema/auth contract is resolved and the column is no longer missing.** It remains unpopulated with real data until step 2.3 below actually copies the bcrypt hashes over during the real F2 cutover. Verify this precondition by confirming the column is still present in the merged schema (e.g. `grep passwordHash lib/db/schema/profiles.ts` or the generated migration SQL) before scheduling a real cutover.
- [ ] A **rehearsal against a disposable/local throwaway Postgres** (not just the synthetic-fixture rehearsal in this repo) has been run at least once, using a realistic-shape copy of schema + anonymized/synthetic data, and produced a clean pass.
- [ ] `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` for the target Neon/Vercel Postgres database exist and have been verified reachable (by the user, out of band — never pasted into chat or committed).
- [ ] `AUTH_SECRET` (Auth.js) is generated and set in the target environment.
- [ ] A maintenance window is scheduled and communicated to users (expect brief read-only or full downtime — see step-by-step timing below).
- [ ] A verified, restorable Supabase backup/snapshot exists, taken immediately before cutover starts (see step 2.1).

---

## 2. Cutover sequence (real execution — KIM-420, user-only)

Each step lists what to do, how to verify it succeeded, and what "stop and roll back" looks like for that step. Steps are meant to run **in this order, atomically** — do not skip ahead if a step's verification fails.

### 2.1 Freeze writes + take a final Supabase backup

1. Put the app into maintenance mode (or at minimum disable write paths — reservations, profile edits, admin actions) so no new data lands in Supabase after the dump is taken.
2. Take a final `pg_dump` of the Supabase Postgres database in `--format=plain` (or `--format=custom` if preferred for `pg_restore` — plain text is easier to eyeball/diff for the coverage check in step 2.2):

   ```bash
   pg_dump --format=plain --no-owner --no-privileges \
     "$SUPABASE_DB_URL" > cutover-dump-$(date +%Y%m%dT%H%M%S).sql
   ```

   `$SUPABASE_DB_URL` is read from the operator's own shell environment / secrets manager — never typed into a shared terminal, chat, or committed file.
3. **Verify:** the dump file is non-empty, and a quick `grep -c '^COPY '` matches the expected number of tables (compare against the current `supabase/migrations/` table count, or the table list produced by F1's Drizzle schema translation, `docs/MIGRATION-F1-DRIZZLE-COVERAGE.md` if merged by then).
4. Store the dump file somewhere durable and access-controlled (not committed to git) as the pre-cutover snapshot — this is the artifact step 5 (rollback) restores from if needed.

**Stop/rollback trigger:** dump command errors, produces a suspiciously small file, or the table-count check fails → do not proceed. Re-enable writes, investigate, retry from 2.1.

### 2.2 Restore into Vercel Postgres (Neon)

1. Restore the dump from 2.1 into the target Neon database:

   ```bash
   psql "$POSTGRES_URL_NON_POOLING" < cutover-dump-<timestamp>.sql
   ```

   (Use the non-pooling connection string for DDL-heavy restores, per Neon/Vercel Postgres guidance.)
2. **Verify (structural):** run the same `COPY`-block coverage check used in the rehearsal (`lib/cutover/dump-integrity.mjs` — `parseDumpTables` / `validateDump`) against the dump file, comparing to the full expected table manifest (all tables covered by F1's Drizzle schema, `lib/db/schema/index.ts`). This is the exact same logic the rehearsal exercises against synthetic fixtures; here it runs against the real dump file, still with zero database access required for the check itself.
3. **Verify (row counts):** for each table, compare `SELECT count(*) FROM <table>` in the restored Neon database against the row counts recorded from the dump (same `parseDumpTables` output, or a simple `grep`/`wc -l` on each `COPY` block). Counts must match exactly.
4. **Verify (spot-check):** pick 2-3 tables with foreign keys (e.g. `reservations` referencing `rooms`/`profiles`) and confirm referential integrity holds — no orphaned rows.

**Stop/rollback trigger:** `psql` restore errors out partway, row counts don't match, or referential integrity is broken → do not proceed to step 2.3. See section 5 (rollback).

### 2.3 Copy bcrypt password hashes (`auth.users.encrypted_password` → `profiles.password_hash`)

**This is a byte-for-byte copy. There is no re-hashing step, ever.**

Supabase Auth (GoTrue) and `bcryptjs` (used by `lib/authjs/credentials-user.ts` on the F1 branch) both produce and consume the same standard bcrypt hash format: `$2a$`, `$2b$`, or `$2y$` version tag, a 2-digit cost factor, and a 53-character salt+digest. Because the format is identical, the value from `auth.users.encrypted_password` can be written directly into `profiles.password_hash` with zero transformation — re-hashing would be both unnecessary and destructive (bcrypt hashes cannot be "re-hashed" into an equivalent hash without knowing the original plaintext).

1. On the **source** (Supabase, still queryable read-only from the dump or a still-live read replica if the window allows), extract `id, encrypted_password` from `auth.users` for every user with a non-null password.
2. Validate each value's *shape* before copying — reject/flag anything that is not standard bcrypt format (defensive check only; Supabase always produces this format, so a mismatch signals something unexpected and should halt that row, not the whole run). This is exactly what `lib/cutover/hash-copy.mjs`'s `isBcryptHash` / `planPasswordHashCopy` do, and what the rehearsal script proves against synthetic fixtures.
3. Write the value verbatim into `profiles.password_hash` (target Neon database, matched by `profiles.id`, which is the same UUID as `auth.users.id`).
4. **Verify:** for a sample of users, confirm `profiles.password_hash` in the target database is byte-for-byte identical to the source `encrypted_password` value (this is what `assertByteForByteCopy` encodes — never compare hash *equivalence* by re-hashing a known plaintext through bcryptjs and expecting an identical string; bcrypt hashes of the same input differ each time due to a random salt, so the only valid check is exact string equality against the source, not a fresh hash of a test password).
5. Users with no `encrypted_password` (e.g. invited-but-never-activated profiles) are left with a `null` `password_hash` and must go through the normal password-set/activation flow post-cutover — this is expected, not a bug.

**Stop/rollback trigger:** more than a handful of rows fail the format check (would indicate the source data isn't what was assumed), or the byte-for-byte verification fails on the sample → do not proceed. See section 5.

### 2.4 Activate Auth.js + Drizzle at runtime

1. Flip the runtime switch-over. The exact mechanism depends on how F1 wires it in (see `lib/authjs/config.ts`'s own comment: "not wired into any page, layout, or middleware yet — that only happens in a future cutover issue"), but the shape is:
   - An env var or feature flag (e.g. `AUTH_BACKEND=authjs` vs. the implicit default of the current Supabase-Auth-backed code path) read at the seam boundaries introduced in F0: `lib/auth/session/index.ts` (session/sign-in/sign-out) and `lib/db/index.ts` (`getDb()`/`getAdminDb()`).
   - Route handlers and Server Components continue to call the same seam functions (`getAuthUser`, `signInWithPassword`, `getDb`, `getAdminDb`, etc.) — only the implementation behind the flag changes, from Supabase client calls to Auth.js (`auth()`/`signIn()`/`signOut()` from `lib/authjs/auth.ts`) and Drizzle (`lib/db/schema/*`) respectively.
   - This is why F0's seams exist: the goal is that this step is a flag flip at the seam, not a call-site-by-call-site rewrite done under cutover time pressure.
2. Deploy the build with the flag flipped to the new backend.
3. **Verify:** smoke test login (member-number and email login, per `docs/ROLLBACK.md`'s post-rollback checklist, run in reverse as a post-cutover checklist), room/table listing, reservation creation/cancellation, and the admin dashboard, all against the new Auth.js + Drizzle/Neon path.
4. **Verify:** confirm no route or Server Component is still reaching the old Supabase client directly (bypassing the `lib/auth/session` / `lib/db` seams) — anything doing so will silently keep talking to the now-frozen/decommissioned Supabase project.

**Stop/rollback trigger:** login fails for a meaningful fraction of test accounts, or a core flow (reservation creation, admin dashboard) errors out → flip the flag back immediately (this step is designed to be reversible independent of the data cutover, since data already lives in both places up to this point) and see section 5.

### 2.5 Invalidate all existing sessions (forced single re-login)

Every session issued under the old Supabase-Auth-backed runtime must stop being accepted the moment the new runtime is live — no session should be valid across the cutover boundary. Concretely:

1. Rotate/set `AUTH_SECRET` to a fresh value as part of this deploy (a new JWT signing secret immediately invalidates every previously-issued Auth.js JWT — see `lib/authjs/config.ts`, which uses the JWT session strategy). If `AUTH_SECRET` was already set during F1 rehearsal/testing, generate a new value for the real cutover deploy specifically, so no test-era JWT survives into production.
2. Ensure any lingering Supabase Auth session cookies are not still being honored: the old seam's `getAuthUser` path (`lib/auth/session/index.ts`) should no longer be reachable at all once the flag in step 2.4 is flipped, so old Supabase cookies simply stop mattering — but explicitly clear/expire the old Supabase auth cookie name(s) in the response of the first request after cutover as defense-in-depth, so stale cookies don't linger in browsers indefinitely.
3. **Verify:** the check encoded in `lib/cutover/session-invalidation.mjs` (`planSessionInvalidation` / `isSessionValidAfterCutover`) — every session with an `issuedAt` before the cutover instant must be classified as invalidated; zero should remain valid. In the real cutover this is verified operationally by confirming that a browser with a pre-cutover session gets redirected to login on its next request, and that logging in fresh immediately after works and stays logged in.
4. Communicate to users (release notes / banner) that they will need to log in once after this deployment.

**Stop/rollback trigger:** users are not being prompted to re-login (stale sessions still accepted) → this is a security issue, not just a UX one; treat it as a blocking failure and see section 5 if it can't be fixed forward quickly (e.g. by re-rotating `AUTH_SECRET` again).

---

## 3. Post-cutover verification checklist

Run this in full before declaring the cutover complete:

- [ ] Login works for both member-number and email login paths, for a sample of real accounts, on the new backend.
- [ ] A brand-new signup/activation flow works end-to-end (proves the write path to `profiles`/Drizzle is fully live, not just reads).
- [ ] Reservation creation, cancellation, and listing work for both member and admin sessions.
- [ ] Admin dashboard loads and admin-only actions are still gated correctly (this is the moment the RLS→service-layer parity gate gets its first real production exercise — watch error logs closely for any authorization gap).
- [ ] No application log lines reference the old Supabase project URL/keys post-cutover (would indicate a code path still bypassing the seams).
- [ ] Old sessions are confirmed invalidated (see 2.5.3).
- [ ] The Supabase project is put into a clearly-labeled "frozen, do not write" state (do not delete/decommission yet — keep it as the rollback source until the team is confident, per section 5).

---

## 4. Rollback plan

### 4.1 What to detect

Any of the following, discovered at any point after 2.2 begins, means "this cutover is not safe to continue or declare complete":

- Row count mismatch between source dump and restored Neon data for any table.
- Referential integrity broken in the restored data (orphaned foreign keys).
- More than a small, explainable number of `profiles.password_hash` copies fail format validation or byte-for-byte verification.
- Login fails for a non-trivial fraction of accounts on the new backend.
- A core flow (reservation CRUD, admin dashboard) is broken on the new backend and can't be fixed forward within the maintenance window.
- Sessions are not being invalidated as expected (security-relevant — see 2.5).

### 4.2 How to revert safely

The cutover is designed so that **Supabase remains untouched (frozen, not deleted) throughout** — this is what makes rollback safe:

1. **If the failure is caught before step 2.4 (runtime flag flip):** nothing user-facing has changed yet. Simply do not flip the flag. Investigate the restore/hash-copy issue, fix it, and re-run from the failing step (or from 2.1 if the dump itself was suspect). No user-visible rollback is needed.
2. **If the failure is caught during/after step 2.4 (flag already flipped):** flip the runtime flag back to the Supabase-Auth-backed path immediately. Since Supabase was never written to after the freeze in 2.1, and never decommissioned, this restores full pre-cutover functionality with no data loss — any writes that happened against Neon during the failed window are simply not carried back (they only existed in the new backend, which is now inactive again).
3. **If the failure is caught after step 2.5 (sessions already invalidated) and rollback to Supabase-Auth is needed:** users will need to log in again against the restored Supabase-Auth path too (their old Supabase session cookies, if still present, may or may not still be valid depending on how long the window was — treat this the same as a normal rollback needing re-auth, per `docs/ROLLBACK.md`'s `AUTH_SESSION_SECRET` guidance pattern, applied here to the Supabase-Auth cookie instead).
4. **Communicate** the rollback to users the same way the cutover itself would have been communicated (brief downtime / please log in again).
5. **Do not decommission or delete the Supabase project** until the team has run the full post-cutover verification checklist (section 3) successfully and is confident enough not to need rollback again. Freeze-but-keep is the safe default; irreversible teardown is out of scope for this runbook (see F4 in `docs/MIGRATION-supabase-to-neon.md`, "remove Supabase deps/dirs", which only happens after F2 is fully trusted).

### 4.3 What rollback does *not* need to undo

Because the data cutover (2.2) and hash copy (2.3) only ever *copy into* Neon — they never delete or mutate the Supabase source — a rollback at any point never needs to "undo a restore." It only ever needs to flip the runtime flag back and, in the worst case, ask users to log in again. This is the entire reason the runbook forbids destructive operations against Supabase during cutover: the source of truth must stay recoverable until the new stack is proven.

---

## 5. Rehearsal — what exists today vs. what still needs a real rehearsal

`scripts/cutover-rehearsal.sh` (backed by `lib/cutover/`) exercises the **mechanical logic** of steps 2.2 (dump structural validation), 2.3 (hash-copy, verbatim-copy proof), and 2.5 (session-invalidation classification) against **synthetic, in-memory fixture data only**. Run it with:

```bash
pnpm cutover:rehearsal
```

What this rehearsal proves today:

- The dump-coverage check correctly detects a complete vs. truncated/missing-table dump.
- The hash-copy planner never re-hashes, correctly identifies rows to skip (missing/malformed hash), and a byte-for-byte-copy assertion correctly accepts a true copy and rejects a divergent one.
- The session-invalidation planner correctly classifies every pre-cutover session as invalidated and correctly recognizes a freshly-issued post-cutover session as valid.

What this rehearsal does **not** prove, and what still needs a real rehearsal once F1 merges and real Neon/Vercel credentials exist:

- That a real `pg_dump`/`pg_restore` round-trip against actual Supabase and Neon databases preserves all 85 migrations' worth of schema and data (this repo's rehearsal never shells out to `pg_dump`/`psql`/`pg_restore` at all, by design — see the hard constraints at the top of this document).
- That the runtime flag switch-over in step 2.4 actually routes traffic through `lib/authjs/` + `lib/db/schema/` correctly once those modules are live and wired in (they are inert scaffolding today, per their own doc comments).
- That `AUTH_SECRET` rotation actually invalidates real, browser-held Auth.js JWTs end-to-end (the synthetic rehearsal only proves the *classification logic*, not a real JWT/cookie round-trip).
- Performance/timing of the real dump+restore for the actual data volume (affects how long the maintenance window in section 2 needs to be).

A rehearsal against a **disposable/local throwaway Postgres** (e.g. via Docker, or a local Neon branch) covering the real `pg_dump`/`pg_restore` round-trip is a required precondition (section 1) before KIM-420 is scheduled — this repo's synthetic rehearsal is a fast, no-infra smoke test for the logic, not a substitute for that.
