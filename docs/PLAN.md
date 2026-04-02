# Migration Execution Plan — Alea Webapp

**Last updated:** 2026-04-01
**Branch:** develop
**Epic:** #3 — Next.js API migration (remove NestJS + monorepo)
**Platform:** Supabase (dev + prod, sole DB/auth provider)

---

## Current State

| Milestone | Issue | Status | Branch |
|-----------|-------|--------|--------|
| M1 — Contract baseline | #4 | ✅ Done | merged |
| M2 — Server layer extraction | #5 | ✅ Done | merged |
| M3 — Auth cutover (Supabase SSR) | #6 | ⏳ Todo | — |
| M4 — API parity | #7 | ⏳ Todo | — |
| M5 — Flatten repo / remove NestJS | #8 | ⏳ Todo | — |
| M6 — Cleanup + release readiness | #9 | ⏳ Todo | — |
| Platform — Supabase env split | #11 | 🔄 In Progress | — |
| QA — CI quality gates | #12 | 🔄 In Progress | — |
| Security — Hardening | #10 | ⏳ Todo | — |

---

## Priority Order

### P0 — Immediate (parallel, no blockers)

#### 1. Issue #11 — [PLATFORM] Supabase environment split ← HIGHEST PRIORITY
**Branch:** `feat/supabase-env-separation`
**Why first:** Blocks M3 (auth cutover). Without Supabase client configured, SSR auth cannot start.
**Human prerequisite:** User must provision two Supabase projects (dev + prod) and provide keys.

**Code deliverables:**
- Install `@supabase/supabase-js` + `@supabase/ssr` in `apps/web`
- Initialize `supabase/` directory with `config.toml` for local dev
- Create initial schema migration (`supabase/migrations/`) with: `profiles`, `rooms`, `tables`, `reservations`
- Configure RLS policies per table
- Define env variable structure: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Create `.env.example` and update `.env.local.example`
- Set up typed Supabase client for SSR (`createServerClient`, `createBrowserClient`)
- Acceptance: `supabase start` runs locally, schema applies cleanly, client connects

#### 2. Issue #12 — [QA] Testing stack and CI quality gates (parallel with #11)
**Branch:** `feat/qa-next-api-gates`
**Why now:** Independent of Supabase. Establishes CI gates that protect all subsequent work.

**Code deliverables:**
- GitHub Actions workflow: lint + typecheck + test on every PR
- Coverage thresholds enforced (≥80% for server layer)
- Supabase CLI step in CI for integration tests (`supabase start`)
- Semgrep security scan step
- Dependency audit step (`pnpm audit`)
- Acceptance: CI blocks merge on failing checks

---

### P1 — After #11 Supabase ready

#### 3. Issue #6 — [M3] Auth cutover to Supabase SSR
**Branch:** `feat/next-api-m3-auth-cutover`
**Depends on:** #11
**Deliverables:**
- Replace mock auth (`mock-db` users) with Supabase Auth
- Implement `createServerClient` / `createBrowserClient` SSR pattern
- HTTP-only cookies via `@supabase/ssr` cookie helpers
- CSRF protection for unsafe methods (POST/PUT/PATCH/DELETE)
- Auth parity: `login`, `register`, `me`, `logout`
- Frontend no longer contacts NestJS for auth
- Cookie flags: `HttpOnly`, `Secure` in prod, `SameSite=Lax`

---

### P2 — After M3

#### 4. Issue #10 — [SEC] Security hardening (parallel with #7)
**Branch:** `feat/next-api-security-hardening`
**Depends on:** #6
**Deliverables:**
- Env-specific cookie policy finalized
- Rate limiting on auth + sensitive endpoints
- Origin/fetch-metadata checks
- Security runbook documented

#### 5. Issue #7 — [M4] API parity across all domains (parallel with #10)
**Branch:** `feat/next-api-m4-api-parity`
**Depends on:** #6
**Deliverables:**
- Replace `mock-db` with Supabase queries in all services
- `users`, `rooms`, `tables`, `reservations` services rewritten against Supabase
- RLS enforced at DB level, service layer validates above it
- Consistent auth/authz guards across all handlers

---

### P3 — After M4

#### 6. Issue #8 — [M5] Flatten repo / remove NestJS + monorepo
**Branch:** `feat/next-api-m5-flatten-repo`
**Depends on:** #7
**Deliverables:**
- Promote `apps/web` to repo root
- Delete `apps/api` (NestJS) and all NestJS dependencies
- Delete `pnpm-workspace.yaml`, `packages/` workspace
- Move `packages/types` into `apps/web/lib/types`
- Single root `package.json` with `dev`, `build`, `test`, `lint`, `typecheck`
- No monorepo artifacts remain

---

### P4 — Final

#### 7. Issue #9 — [M6] Cleanup, docs, release readiness
**Branch:** `feat/next-api-m6-cleanup`
**Depends on:** #8
**Deliverables:**
- Update `docs/ARCHITECTURE.md` for final single-app structure
- Remove dead code and obsolete env vars
- Rollback procedure documented
- CI passes in final state

---

## Dependency Graph

```
#11 Supabase ──┐
               ├──► #6 M3 Auth ──► #10 Security
#12 QA ────────┘                └──► #7 M4 API ──► #8 M5 Flatten ──► #9 M6 Cleanup
```

---

## Notes

- Each issue gets its own branch targeting `develop`.
- PRs stay open as review artifacts; user merges manually.
- Never merge to `main` directly — only via release branch.
- Mock-db is replaced incrementally: auth in M3, domains in M4.
- `packages/types` stays in place until M5 flattening.
