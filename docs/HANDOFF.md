# Session Handoff

> Update this file at the end of every work session before closing Claude Code.
> The next session must read this file first before doing anything.

---

## Last updated: 2026-04-11

## ⚠️ MVP TARGET: Monday 2026-04-14

## Current branch
`develop`

## Open PRs
| PR | Branch | Issues | Status |
|---|---|---|---|
| [#78](https://github.com/KimoxStudio/alea-webapp/pull/78) | `fix/auth-i18n-errors` | KIM-325 | Open — awaiting merge. Mark KIM-325 Done after merge. |

## Merged this session
| PR | Branch | Issues |
|---|---|---|
| ~~#76~~ | `feat/auto-cancel-grace-period` | KIM-327 ✅ Done |
| ~~#77~~ | `feat/overlap-restriction` | KIM-330 ✅ Done · KIM-338 ✅ Done |

---

## MVP Critical Path (ordered)

### ✅ Done
- **KIM-327** (M2) — auto-cancel grace period — merged PR #76
- **KIM-330 + KIM-338** (M3) — overlap restriction — merged PR #77
- **KIM-358** — toGameTable mapper — already in develop (no PR needed)

### 🟡 Awaiting merge
- **KIM-325** — auth i18n double-namespace — PR #78 open

### 🔴 Next: M5 — KIM-331 + KIM-340 — Cancellation cutoff 1h
**Branch:** `feat/cancellation-cutoff` from `develop`
**File:** `lib/server/reservations-service.ts` — in `updateReservationForSession`, when `nextStatus === 'cancelled'` and `session.role !== 'admin'`: if reservation starts within 60 min of now → throw `CANCELLATION_CUTOFF` (403)
**Agent:** `software-engineer`

### 🟡 After PR #77 merge (unblocked ✅)
- **KIM-337** — UI feedback for overlap conflict
  **Branch:** `feat/overlap-ui-feedback` from `develop`
  **Skill:** `frontend-design`

### 🟡 After M5 merged
- **KIM-341** — UI warning for cancellation cutoff
  **Branch:** `feat/cancellation-cutoff-ui` from `develop`
  **Skill:** `frontend-design`

### 🟡 6 — KIM-306 — Seed data for manual QA
**Branch:** `chore/seed-data` from `develop`
**Agent:** `software-engineer`

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
Saturday (now):
  ✅ Merge #76 (KIM-327)
  ✅ Merge #77 (KIM-330, KIM-338)
  → Merge #78 when ready (KIM-325)
  → feat/cancellation-cutoff (M5 — KIM-331+340)
  → feat/overlap-ui-feedback (KIM-337) — #77 already merged ✅

Sunday:
  → feat/cancellation-cutoff-ui (KIM-341) — after M5 merged
  → chore/seed-data (KIM-306)
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
