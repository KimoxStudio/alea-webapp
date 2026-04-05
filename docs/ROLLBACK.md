# Rollback Procedure — Alea WebApp

This document describes how to roll back a deployment of the Alea WebApp to a previously known-good state.

---

## What "Rollback" Means

Rolling back means reverting the running application to the code and database schema of a previous stable git tag or branch. It does **not** automatically undo database data changes (rows inserted/deleted by users). Schema changes are also not automatically reverted; rolling them back requires restoring a backup or applying a new migration that reverses the prior schema change.

---

## Pre-Deployment Checklist

Before every deployment, verify the following:

- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm typecheck` passes with no type errors
- [ ] `pnpm test` passes (all tests green)
- [ ] `pnpm build` completes successfully
- [ ] All required environment variables are set in the deployment target (see [Environment Variable Checklist](#environment-variable-checklist))
- [ ] Supabase migrations have been reviewed and tested against a staging database
- [ ] The current git HEAD is tagged (e.g. `git tag v0.x.y && git push origin v0.x.y`)
- [ ] The previous stable tag is known and documented

---

## Rollback Steps

### 1. Identify the last stable tag

```bash
git tag --sort=-creatordate | head -10
```

Note the tag you want to roll back to (e.g. `v0.3.2`).

### 2. Create a rollback branch from the stable tag

```bash
git checkout -b rollback/v0.3.2 v0.3.2
```

### 3. Verify the rollback branch builds cleanly

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Fix any issues before proceeding. Do not deploy a rollback branch that does not build.

### 4. Deploy the rollback branch

Follow your normal deployment process, targeting the `rollback/v0.3.2` branch instead of `main`/`develop`.

If using Vercel or a similar platform, redeploy from the rollback branch or promote the previous deployment.

### 5. Verify the rollback is live

- Smoke test key flows: login, room listing, reservation creation.
- Confirm the correct version is running (e.g. check a version endpoint or git SHA in logs).

---

## Supabase Migration Rollback

### Understanding migrations

Supabase migrations are forward-only versioned SQL files in `supabase/migrations/`. In this repo, rollbacks are handled by restoring from backup or applying a new migration that reverses the prior schema change, rather than by using paired down migrations.

### Rolling back a single migration (local dev)

If a migration was applied and needs to be undone locally:

```bash
# Reset the local DB to a clean state and re-run all migrations from scratch
supabase db reset
```

`supabase db reset` drops and recreates the local database and runs all migrations from scratch.

**Note:** `supabase db reset` re-applies all migrations from `supabase/migrations/`. If the issue is caused by a broken migration, you must first remove or replace that migration file, then run `supabase db reset`.

### Rolling back a migration in production

Supabase does not support automatic down migrations in production. To roll back a schema change:

1. Write a new SQL migration that reverses the change (e.g. `DROP COLUMN`, `DROP TABLE`, restore constraints).
2. Apply the reversal migration via the Supabase dashboard or CLI:

   ```bash
   supabase db push
   ```

3. Verify the schema is correct in Supabase Studio.

> **Warning:** Dropping columns or tables that contain data is destructive. Always take a database backup before applying reversal migrations in production.

### Taking a database backup (Supabase Cloud)

Use the Supabase dashboard: **Project > Database > Backups** to restore to a point-in-time backup, or use `pg_dump`:

```bash
pg_dump "postgresql://postgres:<password>@<host>:5432/postgres" > backup-$(date +%Y%m%d).sql
```

---

## Environment Variable Checklist

Ensure these variables are correctly set in the target environment before deploying or rolling back:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | Supabase publishable key (format: `sb_publishable_*`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase secret key (format: `sb_secret_*`); server only |
| `AUTH_SESSION_SECRET` | No | Auth session secret (min 32 chars); only required if rolling back to pre-M3 implementations |
| `NEXT_PUBLIC_APP_URL` | No | Public app base URL (e.g. `https://app.alea.club`); only set if deployment, redirect, or OAuth/provider configuration explicitly requires it |
| `NEXT_PUBLIC_API_URL` | No | API base URL override (default: `/api`) |

> **Security:** `SUPABASE_SERVICE_ROLE_KEY` and `AUTH_SESSION_SECRET` must never be exposed to the browser or committed to git.

For local development, copy `.env.local.example` to `.env.local`. The example values work with the local Supabase instance started via `supabase start`.

---

## Security Implications

Rolling back a deployment can have security consequences that must be addressed before or immediately after redeployment.

### Rolling back past a security fix

If the rollback target predates a security patch (e.g. a credential exposure or input validation fix), **rotate all affected credentials before redeploying**. Redeploying a version with a known vulnerability without rotating secrets leaves the system in a worse state than the original incident.

### `AUTH_SESSION_SECRET` rollback

If rolling back to a pre-M3 implementation that uses `AUTH_SESSION_SECRET` to sign application sessions, restoring an older secret value can invalidate sessions issued under the newer value, requiring users to re-authenticate. For the current Supabase-based runtime, `AUTH_SESSION_SECRET` is not referenced and changing it will not affect active sessions.

### Never rollback to a version with known secret exposure

If the rollback target is a version where secrets were exposed (e.g. accidentally committed to git, leaked in logs), **rotate the exposed credentials first**. Only then redeploy. Rolling back without rotation leaves the exposed values active.

Credentials to rotate if any exposure is suspected:

- `AUTH_SESSION_SECRET` — generate a new secret (min 32 chars)
- `SUPABASE_SERVICE_ROLE_KEY` — rotate via Supabase Dashboard > Project Settings > API
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — rotate if the anon key was abused

### Supabase service role key rotation on auth architecture rollback

If the rollback affects auth architecture (e.g. rolling back past M3 Supabase auth integration), **rotate the Supabase service role key** before redeployment. This prevents the old key from being usable if it was cached or logged during the affected window.

```bash
# After rotating the key in the Supabase dashboard, update your deployment environment:
# SUPABASE_SERVICE_ROLE_KEY=<new-key>
# Then redeploy.
```

---

## Post-Rollback Verification

After rolling back, verify:

- [ ] App loads at the expected URL
- [ ] Login works (member number and email login)
- [ ] Rooms and tables load correctly
- [ ] Reservation creation and cancellation work
- [ ] Admin dashboard loads for admin users
- [ ] No console errors related to environment variables or Supabase connectivity
