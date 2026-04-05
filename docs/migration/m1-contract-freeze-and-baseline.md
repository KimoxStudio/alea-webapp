# M1 Contract Freeze and Architecture Baseline

> **Historical record.** This document captures the architectural baseline and contract freeze decisions made at M1 (issue #4, PR #13) before migration work started. References to `apps/web`, `apps/api`, `packages/types`, and `mock-db` describe the pre-migration state. Do not update this file to reflect current architecture.

Issue: #4  
Branch: `feat/next-api-m1-baseline`

## Goal
Freeze current behavior and architecture decisions before migration work starts.

## Contract Freeze (Current-State Source of Truth)

1. API path and method stability
- Keep all existing Next.js API routes (`/api/**`) and HTTP methods stable unless a breaking-change issue is approved.

2. Current auth/session baseline
- Current source of truth is Next.js HTTP-only cookie session (`auth_session`) implemented in `apps/web/lib/server/auth.ts`.
- Keep role model unchanged: `admin` and `member`.
- Keep current error envelope style where already used: `{ message, statusCode }`.

3. Security baseline
- Keep mutation origin checks for `POST`, `PUT`, `PATCH`, `DELETE`.
- Keep HTTP-only cookie policy (`SameSite=lax`, `secure` in production).
- Add full CSRF strategy in later security milestone, but origin checks remain mandatory now.

## Target-State Proposals (To Be Implemented in Later Milestones)

These are approved as direction, not yet implemented in current state.

### Canonical runtime target
- Final target is a single Next.js API runtime using Route Handlers.
- `apps/api` removal is planned for later milestones and not part of M1 implementation.

### Auth/session target direction
- Keep HTTP-only cookie transport.
- Move auth logic into consolidated server modules during migration.
- Supabase SSR integration is targeted for later milestones.

### HTTP adapter layer
- `app/api/**/route.ts`
- Responsibility: request parsing, calling server modules, response mapping.

### Server domain layer
- `src/server/auth/**`
- `src/server/modules/users/**`
- `src/server/modules/rooms/**`
- `src/server/modules/tables/**`
- `src/server/modules/reservations/**`
- `src/server/http/**` (shared guards, error mapping, response helpers)

### Shared contracts
- Move shared types from `packages/types` into `src/types` after flattening.

## CI and Script Contract

### Current state (already present)
- Root: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`

### Target state (post-flattening proposal)

After repository flattening milestone:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:e2e`

Required PR checks target:

- lint
- typecheck
- unit
- integration
- e2e-smoke
- build
- security-sast
- security-deps

## Risks and Dependency Map

### Risks
- Auth drift while both Next.js session logic and `apps/api` coexist.
- Behavior drift in reservation conflict rules during extraction.
- Import/script breakage during repo flattening.
- Environment drift between development and production Supabase.

### Mitigations
- Freeze endpoint behavior in writing (inventory document).
- Move business logic into shared server modules before large file moves.
- Keep milestone-by-milestone branches and short PRs.
- Require QA and code review before each merge.

### Dependencies
- #5 depends on this baseline (#4).
- #6 depends on server-layer extraction from #5.
- #7 and #8 depend on parity and auth cutover completion.

## Acceptance Criteria Mapping

- [x] Endpoint inventory completed: `docs/migration/m1-endpoint-inventory.md`
- [x] Current auth/session baseline documented
- [x] Target module boundaries documented
- [x] Current and target CI/script contracts documented
- [x] Risks and dependency map documented
