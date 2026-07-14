# Secret Rotation Checklist (Pre-Migration, P0)

This is an investigation + checklist artifact only. **No agent may rotate any secret.**
Rotation is a manual, user-executed action in the Vercel and Supabase dashboards.
Variable **names** only are referenced below — no actual secret values appear in this
document or were printed/logged while producing it.

Related issue spec: `docs/issues/migration-pre-04-rotate-p0-secrets.md`

---

## 1. `AUTH_SESSION_SECRET` — dead / legacy config

- **Where it is set:** Not present in `.env.example`. Historically would have been set in
  `.env.local` for local dev / Vercel project env for deploy, under a pre-M3 (pre-Supabase)
  session implementation.
- **Code consumers:** **None.** A repo-wide grep for the literal string `AUTH_SESSION_SECRET`
  across all file types (excluding `node_modules` and `.git`) found matches only in
  `docs/ROLLBACK.md` (lines 122, 127, 141, 151). No `.ts`/`.tsx`/`.js`/`.mjs`/`.cjs` file reads
  or references `process.env.AUTH_SESSION_SECRET` or the string `AUTH_SESSION_SECRET` in any
  form.
- **`.env.example` status:** Confirmed **not present** — there is nothing to remove there.
- **What breaks if rotated without updating dependents:** Nothing in the current
  Supabase-based runtime. `docs/ROLLBACK.md:143` explicitly notes: "For the current
  Supabase-based runtime, `AUTH_SESSION_SECRET` is not referenced and changing it will not
  affect active sessions."
- **Recommendation:** Keep the `docs/ROLLBACK.md` reference as historical rollback
  documentation (it only matters if the team ever rolls back to a pre-M3, non-Supabase
  session implementation). Flag for the user to decide whether to drop the `ROLLBACK.md`
  reference entirely, since there is no live config or code path tied to it today. No action
  needed for `.env.local`, `.env.example`, or any schema file — there is nothing to rotate.

---

## 2. `CRON_SECRET`

- **Where it is set:** Present in `.env.example` (`.env.example:79`, comment context at
  `.env.example:77-78`). Set in `.env.local` for local dev, and in the Vercel project env
  (and whatever external cron scheduler calls the endpoint, e.g. cron-job.org) for deploy.
- **Code consumers:**
  - `app/api/cron/mark-no-show/route.ts:7` — reads `process.env.CRON_SECRET`.
  - `app/api/cron/mark-no-show/route.ts:8` — validates the caller's `Authorization: Bearer`
    header against it via `tokensMatch()` (imported from `lib/server/security` at
    `app/api/cron/mark-no-show/route.ts:3`); returns 401 if missing/invalid.
  - Also referenced in QA e2e tooling: `qa/e2e/qa-no-show-expiry.mjs:5,12,106` (used to call
    the cron endpoint during E2E validation) and in unit tests
    `__tests__/app/api/cron/mark-no-show.test.ts` (stubbed test value, not a real secret).
- **What breaks if rotated without updating dependents:** The cron endpoint's own
  authorization check (`app/api/cron/mark-no-show/route.ts:7-8`). If the env var is rotated
  in Vercel but the external cron scheduler's `Authorization: Bearer <value>` header is not
  updated to match, every scheduled call to `/api/cron/mark-no-show` will be rejected with
  401 and no-show reservations will stop being auto-marked until the scheduler config is
  updated too.

---

## 3. `SUPABASE_SECRET_DEFAULT_KEY`

- **Where it is set:** Present in `.env.example` (`.env.example:18`, comment context at
  `.env.example:16-17` — sourced from Supabase Project Settings → API Keys → Secret keys →
  default). Set in `.env.local` for local dev, Vercel project env for deploy.
- **Code consumers:**
  - `lib/supabase/config.ts:18-19` — `getSupabaseSecretKey()` reads
    `process.env.SUPABASE_SECRET_DEFAULT_KEY` via `requiredEnv()`; throws if missing. This
    file is guarded by `server-only` (`lib/supabase/config.ts:1`) so it cannot be imported
    into client bundles.
  - `lib/supabase/server.ts:67-68` — `createSupabaseServerAdminClient()` calls
    `getSupabaseSecretKey()` to construct the Supabase admin client, which bypasses RLS for
    all server-side admin write operations.
  - Also referenced in QA e2e tooling (for privileged fixture writes/deletes against
    Supabase): `qa/e2e/qa-reservation-cancellation.mjs:15,21`,
    `qa/e2e/qa-reservation-lifecycle.mjs:13,18`, `qa/e2e/qa-no-show-expiry.mjs:12,17`,
    `qa/e2e/qa-reservation-equipment.mjs:16,22`.
- **What breaks if rotated without updating dependents:** Every server-side admin Supabase
  client created via `createSupabaseServerAdminClient()` (`lib/supabase/server.ts:67`) — i.e.
  all admin write operations across the app's service layer that bypass RLS. If the env var
  is rotated in Supabase (key regenerated) without updating it everywhere the app runs
  (Vercel project env, and any local `.env.local` / `.env.e2e.local` used for QA scripts),
  those clients will fail to authenticate against Supabase and admin operations will start
  erroring.

---

## 4. QA credentials

Grepped `.env.example` for `QA_`, `TEST_`, `E2E_`, `PLAYWRIGHT`, and `qa` patterns: **none of
these appear in `.env.example`.** They are documented separately in `qa/e2e/README.md`
(lines 27-36) as belonging to a dedicated `.env.e2e.local` file at the repo root — the E2E
runners intentionally do not load the app's `.env.local` because they perform privileged
fixture writes/deletes.

- **Variables (names only):**
  - `PLAYWRIGHT_QA_USER` — member number of the admin QA user.
  - `PLAYWRIGHT_QA_PASSWORD` — password for the admin QA user.
  - `PLAYWRIGHT_QA_SECONDARY_USER` — member number of a regular (non-admin) QA member.
  - `PLAYWRIGHT_QA_SECONDARY_PASSWORD` — password for the secondary QA user.
  - `E2E_ALLOW_DESTRUCTIVE` — not a credential, but a required env var (must be `1`) to
    acknowledge privileged fixture writes/deletes performed by the E2E runners.
- **Where set:** `.env.e2e.local` at the repo root (local dev / CI runner only — not part of
  the deployed app's runtime env).
- **Code consumers:** the standalone Playwright/Node E2E runners under `qa/e2e/*.mjs`
  (e.g. `qa/e2e/qa-reservation-lifecycle.mjs:13,63-64,113`,
  `qa/e2e/qa-reservation-equipment.mjs:14,99-100`,
  `qa/e2e/qa-no-show-expiry.mjs:12,44`,
  `qa/e2e/qa-reservation-cancellation.mjs:13`). Not consumed by any app runtime code (`app/`,
  `lib/`) or by the Vitest unit tests under `__tests__/`.
- **What breaks if rotated without updating dependents:** the corresponding QA/member account
  credentials in Supabase must be updated to match, and `.env.e2e.local` on every machine/CI
  runner that executes the `qa/e2e/*.mjs` scripts must be updated, or those E2E runs will fail
  to log in / authenticate.

---

## Rotation procedure (user-executed)

Rotation is a **manual, user-only** action. No agent performs any of the following steps:

1. In the Supabase dashboard (Project Settings → API Keys), regenerate the secret key
   backing `SUPABASE_SECRET_DEFAULT_KEY`.
2. In the Vercel project settings, update the corresponding env vars
   (`SUPABASE_SECRET_DEFAULT_KEY`, `CRON_SECRET`) for every environment (Production,
   Preview, Development) that needs them.
3. Update the external cron scheduler's `Authorization: Bearer <value>` header to match the
   new `CRON_SECRET` value.
4. Update local `.env.local` (and `.env.e2e.local` for QA credentials, if those Supabase
   accounts are also being rotated) to match.
5. Decide whether to drop the now-dead `AUTH_SESSION_SECRET` reference from
   `docs/ROLLBACK.md` (optional — no code or config action required either way).
6. Verify in the Supabase dashboard and via a smoke test (e.g. an admin write operation and
   a manual cron endpoint call) that the app authenticates correctly after rotation.

This document intentionally does not, and must never, contain any actual secret value.
