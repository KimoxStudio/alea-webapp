# Admin sections & services refactor — split monolithic files

> Local markdown emulation of a Linear issue. This project tracks issues as
> markdown files under `docs/issues/` instead of Linear (see
> `docs/DECISIONS.md` for other repo-audit and process decisions). Track
> status here until this work starts; migrate into the real issue tracker if
> one becomes available for this project.

**Status:** Backlog (not started)
**Branch:** none yet — one branch per file/section once work begins (see
below)

## Problem

Several admin feature files have grown monolithic: form, list, dialogs, and
event handlers all live in a single file. This makes them hard to navigate,
increases merge-conflict risk when multiple people touch the same admin
section, and makes isolated unit testing harder than it needs to be.

This was flagged during a repo audit pass (2026-07-14) alongside unrelated
cleanup of stale CI docs and a dead `.gitignore` entry — tracked separately
here since it is a substantial refactor, not a quick fix.

## Files in scope (line counts as of 2026-07-14)

| File | Lines |
|---|---|
| `components/admin/club-events-section.tsx` | ~1192 |
| `lib/server/reservations-service.ts` | ~1121 |
| `lib/server/club-events-service.ts` | ~982 |
| `components/admin/rooms-section.tsx` | ~628 |
| `lib/server/events-service.ts` | ~712 |
| `lib/server/auth-service.ts` | ~682 |
| `components/admin/users-section.tsx` | ~577 |
| `lib/hooks/use-admin.ts` | ~545 |
| `components/admin/library-games-section.tsx` | ~523 |
| `components/admin/partners-section.tsx` | ~489 |

Line counts will drift as normal feature work lands on these files before
this refactor starts — re-verify with `wc -l` before scoping the first PR.

## Proposed approach

- **`components/admin/*-section.tsx` files:** split by concern into a
  subfolder per section (e.g. `components/admin/club-events/`), separating
  the list/table view, the create/edit form or dialog, and local
  handlers/state into their own files. Keep a thin `*-section.tsx` (or
  `index.tsx`) that composes them, so existing imports elsewhere in the app
  keep working.
- **Oversized `lib/server/*-service.ts` files:** split by responsibility
  where it makes sense — e.g. queries/reads vs. mutations/writes vs.
  validation helpers — while keeping ownership/role privilege checks in the
  service layer as required by project convention (never move them to route
  handlers or components during this refactor).
- No behavior changes, no new dependencies, no schema changes. This is a
  structural refactor only.

## Acceptance criteria

- [ ] No regression in behavior — every admin section and service function
      behaves identically before and after the split.
- [ ] Existing tests in `__tests__/` still pass without modification to test
      expectations (test files themselves may need import-path updates if
      files move, but that is owned by `qa-engineer` per project convention
      — `software-engineer` must not create or modify test files).
- [ ] Target no single file over ~400 lines where practically achievable;
      some files may reasonably exceed this if further splitting would hurt
      readability more than it helps — flag those exceptions in the PR
      description rather than forcing an arbitrary split.
- [ ] Privilege checks (ownership + role) remain exclusively in the service
      layer after the split, per project convention.
- [ ] i18n key parity between `messages/en.json` and `messages/es.json` is
      preserved (no keys added/removed by the refactor itself).
- [ ] One PR per file/section, not one giant PR — this is a multi-PR effort.
      Suggested order: start with the largest/highest-churn files
      (`club-events-section.tsx`, `reservations-service.ts`,
      `club-events-service.ts`) first, since they carry the most risk and
      the most benefit from being split.

## Notes

- This issue is scope/planning only — no code changes to the files above are
  part of this issue itself. Implementation is deferred to future
  `software-engineer` tasks, one per file/section as listed above.
- Follows the standard project pipeline once started: `software-engineer`
  (implementation, worktree-isolated) → `qa-engineer` (owns all test file
  changes, validates no regressions) → `security-reviewer` (review + PR
  against `develop`).
