# Session Handoff

> Update this file at the end of every work session before closing Claude Code.
> The next session must read this file first before doing anything.

---

## Last updated: 2026-04-12

## ⚠️ MVP TARGET: Monday 2026-04-14

## Current branch
`develop`

## Open PRs — ready to merge (team-review clean, all comments resolved)
| PR | Branch | Issues | Tests |
|---|---|---|---|
| [#82](https://github.com/KimoxStudio/alea-webapp/pull/82) | `feat/cancellation-cutoff-ui` | KIM-341 | 279 ✅ — needs manual QA (3 checklist items in PR description) |
| [#83](https://github.com/KimoxStudio/alea-webapp/pull/83) | `fix/pending-reservation-cancel` | KIM-362 | 279 ✅ ready to merge |

## Merged this session
| PR | Branch | Issues |
|---|---|---|
| ~~#76~~ | `feat/auto-cancel-grace-period` | KIM-327 ✅ Done |
| ~~#77~~ | `feat/overlap-restriction` | KIM-330 ✅ Done · KIM-338 ✅ Done |
| ~~#78~~ | `fix/auth-i18n-errors` | KIM-325 ✅ Done |
| ~~#79~~ | `feat/cancellation-cutoff` | KIM-331 ✅ · KIM-340 ✅ · KIM-342 ✅ Done |
| ~~#80~~ | `chore/seed-data` | KIM-306 ✅ Done |
| ~~#81~~ | `feat/overlap-ui-feedback` | KIM-337 ✅ Done |

---

## MVP Critical Path (ordered)

### ✅ Done
- **KIM-327** (M2) — auto-cancel grace period — merged PR #76
- **KIM-330 + KIM-338** (M3) — overlap restriction — merged PR #77
- **KIM-325** — auth i18n double-namespace — merged PR #78
- **KIM-358** — toGameTable mapper — already in develop (no PR needed)
- **KIM-331 + KIM-340 + KIM-342** (M5) — cancellation cutoff backend — merged PR #79
- **KIM-306** — seed data — merged PR #80
- **KIM-337** — overlap UI feedback — merged PR #81

### 🟡 Awaiting merge
- **KIM-341** — cancellation cutoff UI — PR #82 ✅ team-review clean · ⚠️ needs manual QA first
  - Checklist: cancel > 60 min → succeeds, cancel < 60 min → inline error shown, dismiss dialog clears error
- **KIM-362** — pending reservations cancellable — PR #83 ✅ ready to merge

### 🔴 After PRs merge: Final smoke test → Monday launch

---

## Post-MVP (do NOT start before launch)

- **KIM-361** — Spanish translations with missing ñ (open Linear issue)
- **KIM-317** — 24h time range for reservations (open Linear issue)
- **KIM-329 epic** (no-show tracking) — KIM-329, 333, 334, 335, 336
- **KIM-332 epic** (events / room blocking) — KIM-332, 343, 344, 345, 346, 347
- **KIM-348 epic** (equipment management) — KIM-348–356
- **KIM-360** — locale switcher redirects to home instead of current route
- **Auth hardening** (KIM-322, KIM-323)
- **KIM-357** (checkin hardening)
- **KIM-359** (QR non-blocking perf)
- **KIM-328** (Docker doc removal — tech-writer)

---

## Recommended execution order for Monday launch

```
Sunday (completed):
  ✅ Merge #79 (KIM-331+340+342)
  ✅ Merge #80 (KIM-306)
  ✅ Merge #81 (KIM-337)
  ✅ Open PR #82 (KIM-341 cutoff UI) — team-review clean
  ✅ Open PR #83 (KIM-362 pending cancel) — team-review clean

Monday:
  → Manual QA on PR #82 (3 checklist items)
  → Merge #82 + #83
  → Final smoke tests across all flows
  → Launch
```

---

## Execution plan reference
→ `docs/ALEA-EXECUTION-PLAN.md`

## Linear project
→ https://linear.app/kimox-studio/project/alea-a9a47d8b2bb2/issues

---

## How to use this file

**At session start:**
1. Read `docs/HANDOFF.md` (this file) — mandatory before any action
2. `gh pr list --state open` — check PRs awaiting merge
3. `git branch --show-current` — confirm on develop
4. Follow MVP Critical Path above in order

**At session end:**
1. Update this file with current state
2. Save memory entry
3. Prune worktrees: `git worktree prune && rm -rf .claude/worktrees/`
