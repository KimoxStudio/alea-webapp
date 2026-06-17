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

## [2026-06-02 12:12] Cycle — KIM-391 HIGH Security Findings (Cycle 3)
- Fingerprint: branch feat/KIM-391-fix-remaining-security-warnings @ 627ddd0
- Milestone: KIM-391-HIGH-security-findings
- Tasks created: ae769dab (software-engineer), f6bc060d (security-reviewer)
- Executed: software-engineer → security-reviewer
- Decisions:
  - search_path on internal SECURITY DEFINER functions: changed from `SET search_path = 'internal', 'public', 'pg_catalog'` to `SET search_path = ''` and fully qualified all references (public.profiles, auth.uid(), public.user_role). Shadow object attack surface eliminated.
  - reservation_equipment_admin_all policy: changed binding from TO authenticated to TO service_role. Authenticated admins were matching 5 permissive policies (OR semantics); now admin path routes exclusively through service_role client.
  - activation_tokens table-level grants: REVOKE ALL from anon + REVOKE INSERT/UPDATE/DELETE from authenticated at table level. Baseline grant remains only for SELECT on authenticated (SELECT on own rows still allowed for lookup). Only service_role/admin can mutate.
  - PR replies: 16 individual threaded replies posted to all open comment threads on PR #121.
- Validation: build pass, typecheck pass, 548/548 tests pass.
- Result: SUCCESS — 3 migrations (20260602000006-08), commits d695215/46052de/e214a6c, 16 PR replies posted.
- [2026-06-17 10:03] QA: validation passed.
- [2026-06-17 11:18] Security audit: changed migrations reviewed; no new findings in patch scope. Dependency audit still reports pre-existing high advisories in `next`, `xlsx`, and transitive `ws`.
