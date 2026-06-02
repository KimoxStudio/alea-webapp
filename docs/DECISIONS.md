# Decisions

## 2026-04-06

- Documented the local `pre-push` CI hook workflow introduced in PR #50.
- Clarified that `pnpm hooks:install` installs the hook, that the hook runs `typecheck`, `lint`, `test`, and `build`, and that GitHub Actions-only checks remain outside the local hook.
- Noted that Windows users need Bash or WSL to run the hook installer.
- Supabase SQL migrations must keep exactly one SQL statement per file. Split `DROP FUNCTION`, `CREATE FUNCTION`, enum changes, and other DDL into separate migration files to avoid prepared-statement failures during resets and CI.
- Session handoff state lives only in `docs/HANDOFF.md`. Do not post handoff status in GitHub PR comments and do not use `CLAUDE.md` as a working-memory or handoff target for this repository.
- [2026-04-11 19:41] QA: validation passed.
- [2026-04-14 16:40] QA: validation passed.
- [2026-04-17 18:52] QA: validation FAILED at `test`.
- [2026-06-02 10:48] QA: validation passed.

## [2026-06-02 11:20] Cycle — KIM-391 Approved Fixes
- Fingerprint: branch feat/KIM-391-fix-remaining-security-warnings @ 06f2250
- Milestone: KIM-391-approved-fixes (Cycle 2)
- Tasks created: 32dafd28 (software-engineer), 76e50246 (security-reviewer)
- Executed: software-engineer → security-reviewer
- Decisions:
  - activation_tokens: dropped anon SELECT policy (server-side admin client handles all token validation)
  - reservation_equipment: added GRANT authenticated (required for 4 RLS policies to take effect); design change from service-role-only to authenticated+RLS access model
  - Reservations indexes: restored 4 performance indexes dropped in 20260528000006 (user decision: keep for performance)
  - Exception handling: narrowed WHEN OTHERS to WHEN UNDEFINED_FUNCTION (SQLSTATE 42883) to prevent silently swallowing real errors
- Result: SUCCESS — 3 migration files, commit 06f2250, 548/548 tests, PR #121 description updated
- [2026-06-02 11:34] QA: validation passed.
