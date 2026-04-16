# Decisions

## 2026-04-06

- Documented the local `pre-push` CI hook workflow introduced in PR #50.
- Clarified that `pnpm hooks:install` installs the hook, that the hook runs `typecheck`, `lint`, `test`, and `build`, and that GitHub Actions-only checks remain outside the local hook.
- Noted that Windows users need Bash or WSL to run the hook installer.
- Supabase SQL migrations must keep exactly one SQL statement per file. Split `DROP FUNCTION`, `CREATE FUNCTION`, enum changes, and other DDL into separate migration files to avoid prepared-statement failures during resets and CI.
- Session handoff state lives only in `docs/HANDOFF.md`. Do not post handoff status in GitHub PR comments and do not use `CLAUDE.md` as a working-memory or handoff target for this repository.
- [2026-04-11 19:41] QA: validation passed.
- [2026-04-14 16:40] QA: validation passed.
- [2026-04-16 09:41] QA: validation passed.
- [2026-04-16 10:06] QA: validation FAILED at `test`.
- [2026-04-16 10:10] QA: validation passed.

## 2026-04-16

- Do not remove Supabase migration files that are already recorded as `applied` in any shared or remote database from the active migration directory. `supabase db push` and `supabase db pull` require local files to match remote migration history.
- Migration cleanup is only allowed through a dedicated baseline/squash workflow that explicitly repairs migration history and revalidates from a clean local reset.
- `supabase/seed.sql` must stay aligned with the post-migration schema used by `pnpm test:integration`; when profile auth fields become required, the seed must populate them.
- [2026-04-16 11:24] QA: Supabase integration validation exposed seed/type drift after migration cleanup attempt.
- [2026-04-16 11:30] QA: validation passed after seed/type sync and migration-history restoration policy.
