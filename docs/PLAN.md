# Alea Webapp — Migration Plan

## Current State

| Feature | Issue | Status | Branch |
|---|---|---|---|
| API — M1 contract freeze & baseline | #11 | Done | main |
| API — M2 server layer (services + thin handlers) | #12 | Done | feat/next-api-m2-server-layer |
| UI — shadcn init + auth UI foundation | #18 | In Progress | feat/shadcn-supabase-ui |
| Auth — M3 Supabase SSR cutover | #6 | Pending | — |

---

## Priority Order

### P0 — Completed

#### Issue #11 — [API] M1 contract freeze & baseline
**Branch:** `main`
**Status:** Merged

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

### P0.5 — Before M3 (no external blockers)

#### NEW: Issue #18 — [UI] shadcn/ui initialization + Supabase auth UI foundation
**Branch:** `feat/shadcn-supabase-ui`
**Why before M3:** M3 needs working auth UI components. This delivers the shadcn Form foundation and properly structured auth forms that M3 will wire to Supabase SSR.
**Deliverables:**
- `components.json` — formal shadcn initialization
- `form` component + missing ui components (accordion, alert-dialog, avatar, checkbox, dropdown-menu, popover, scroll-area, tooltip, sonner)
- Auth forms rewritten with shadcn Form + zod
- Auth callback route scaffold

---

### P1 — M3 (depends on P0 + P0.5)

#### Issue #6 — [Auth] M3 Supabase SSR cutover
**Branch:** TBD
**Depends on:** #12 (server layer), #18 (auth UI forms)
**Why after P0.5:** Needs the Form-based auth components from #18 and the service layer from #12 to wire Supabase SSR correctly.
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

#### Issue #10 — [SEC] Security hardening (parallel with #7)
**Branch:** `feat/next-api-security-hardening`
**Depends on:** #6
**Deliverables:**
- Env-specific cookie policy finalized
- Rate limiting on auth + sensitive endpoints
- Origin/fetch-metadata checks
- Security runbook documented

#### Issue #7 — [M4] API parity across all domains (parallel with #10)
**Branch:** `feat/next-api-m4-api-parity`
**Depends on:** #6
**Deliverables:**
- Replace `mock-db` with Supabase queries in all services
- `profiles`, `rooms`, `tables`, `reservations` services rewritten against Supabase
- RLS enforced at DB level, service layer validates above it
- Consistent auth/authz guards across all handlers

---

### P3 — After M4

#### Issue #8 — [M5] Flatten repo / remove NestJS + monorepo
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

#### Issue #9 — [M6] Cleanup, docs, release readiness
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
#11 (M1 baseline) → #12 (M2 server layer) ─┐
                                             ├→ #6 (M3 Supabase SSR)
#18 (shadcn + auth UI) ────────────────────┘
```

---

## Notes

- Each issue gets its own branch targeting `develop`.
- PRs stay open as review artifacts; user merges manually.
- Never merge to `main` directly — only via release branch.
- Mock-db is replaced incrementally: auth in M3, domains in M4.
- `packages/types` stays in place until M5 flattening.
