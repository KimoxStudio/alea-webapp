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
