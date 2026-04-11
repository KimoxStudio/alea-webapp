# Session Handoff

> Update this file at the end of every work session before closing Claude Code.
> The next session must read this file first before doing anything.

---

## Last updated: 2026-04-11

## ⚠️ MVP TARGET: Monday 2026-04-14

## Current branch
`develop`

## Open PRs — ready to merge (team-review clean, all comments resolved)
| PR | Branch | Issues | Tests |
|---|---|---|---|
| [#79](https://github.com/KimoxStudio/alea-webapp/pull/79) | `feat/cancellation-cutoff` | KIM-331, KIM-340, KIM-342 | 266 ✅ |
| [#80](https://github.com/KimoxStudio/alea-webapp/pull/80) | `chore/seed-data` | KIM-306 | SQL only ✅ |
| [#81](https://github.com/KimoxStudio/alea-webapp/pull/81) | `feat/overlap-ui-feedback` | KIM-337 | 269 ✅ |

## Merged this session
| PR | Branch | Issues |
|---|---|---|
| ~~#76~~ | `feat/auto-cancel-grace-period` | KIM-327 ✅ Done |
| ~~#77~~ | `feat/overlap-restriction` | KIM-330 ✅ Done · KIM-338 ✅ Done |
| ~~#78~~ | `fix/auth-i18n-errors` | KIM-325 ✅ Done |

---

## MVP Critical Path (ordered)

### ✅ Done
- **KIM-327** (M2) — auto-cancel grace period — merged PR #76
- **KIM-330 + KIM-338** (M3) — overlap restriction — merged PR #77
- **KIM-325** — auth i18n double-namespace — merged PR #78
- **KIM-358** — toGameTable mapper — already in develop (no PR needed)

### 🟡 Awaiting merge
- **KIM-331 + KIM-340 + KIM-342** (M5) — cancellation cutoff backend + tests — PR #79 ✅ all comments resolved
- **KIM-306** — seed data — PR #80 ✅ all comments resolved
- **KIM-337** — overlap UI feedback — PR #81 ✅ clean

### 🔴 Next after PR #79 merges: KIM-341 — Cancellation Cutoff UI
**Branch:** `feat/cancellation-cutoff-ui` from `develop` (after PR #79 merges)
**Files:** `components/reservations/my-reservations-view.tsx`, `messages/en.json`, `messages/es.json`
**Skill:** `frontend-design`
**Add:** Detect `CANCELLATION_CUTOFF` 403 response; show inline warning with `reservations.errors.cancellationCutoff` message

### 🟡 After PRs #79/#80/#81 merge
Nothing else MVP-critical is blocked. Sunday work:
- **KIM-341** — cutoff UI (needs M5/PR #79 merged)
- Final smoke test across all flows

---

## Post-MVP (do NOT start before launch)

- **KIM-329 epic** (no-show tracking) — KIM-329, 333, 334, 335, 336
- **KIM-332 epic** (events / room blocking) — KIM-332, 343, 344, 345, 346, 347
- **KIM-348 epic** (equipment management) — KIM-348–356
- **KIM-360** — locale switcher redirects to home instead of current route
- **Auth hardening** (KIM-322, KIM-323)
- **KIM-357** (checkin hardening)
- **KIM-359** (QR non-blocking perf)
- **KIM-328** (Docker doc removal — tech-writer)

---

## Recommended execution order for MVP weekend

```
Saturday (completed):
  ✅ Merge #76 (KIM-327)
  ✅ Merge #77 (KIM-330, KIM-338)
  ✅ Merge #78 (KIM-325)
  ✅ Open PR #79 (M5 — KIM-331+340+342) — all comments resolved
  ✅ Open PR #80 (KIM-306 seed) — all comments resolved
  ✅ Open PR #81 (KIM-337 overlap UI) — clean

Sunday:
  → Merge #79, #80, #81
  → feat/cancellation-cutoff-ui (KIM-341) — after M5 merged
  → Final smoke tests

Monday: Launch
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
