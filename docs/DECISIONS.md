# Decisions

## 2026-04-06

- Documented the local `pre-push` CI hook workflow introduced in PR #50.
- Clarified that `pnpm hooks:install` installs the hook, that the hook runs `typecheck`, `lint`, `test`, and `build`, and that GitHub Actions-only checks remain outside the local hook.
- Noted that Windows users need Bash or WSL to run the hook installer.
- [2026-04-11 19:41] QA: validation passed.
- [2026-04-14 16:40] QA: validation passed.
