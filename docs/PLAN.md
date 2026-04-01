# Alea Webapp — Migration Plan

## Current State

| Feature | Issue | Status | Branch |
|---|---|---|---|
| API — M1 contract freeze & baseline | #11 | Done | main |
| API — M2 server layer (services + thin handlers) | #12 | Done | feat/next-api-m2-server-layer |
| UI — shadcn init + auth UI foundation | #18 | In Progress | feat/shadcn-supabase-ui |
| Auth — M3 Supabase SSR cutover | #6 | Pending | — |

---

## Priority Order

### P0 — Completed

#### Issue #11 — [API] M1 contract freeze & baseline
**Branch:** `main`
**Status:** Merged

#### Issue #12 — [API] M2 server layer (services + thin handlers)
**Branch:** `feat/next-api-m2-server-layer`
**Status:** Done

---

### P0.5 — Before M3 (no external blockers)

#### NEW: Issue #18 — [UI] shadcn/ui initialization + Supabase auth UI foundation
**Branch:** `feat/shadcn-supabase-ui`
**Why before M3:** M3 needs working auth UI components. This delivers the shadcn Form foundation and properly structured auth forms that M3 will wire to Supabase SSR.
**Deliverables:**
- `components.json` — formal shadcn initialization
- `form` component + missing ui components (accordion, alert-dialog, avatar, checkbox, dropdown-menu, popover, scroll-area, tooltip, sonner)
- Auth forms rewritten with shadcn Form + zod
- Auth callback route scaffold

---

### P1 — M3 (depends on P0 + P0.5)

#### Issue #6 — [Auth] M3 Supabase SSR cutover
**Branch:** TBD
**Depends on:** #12 (server layer), #18 (auth UI forms)
**Why after P0.5:** Needs the Form-based auth components from #18 and the service layer from #12 to wire Supabase SSR correctly.

---

## Dependency Graph

```
#11 (M1 baseline) → #12 (M2 server layer) ─┐
                                             ├→ #6 (M3 Supabase SSR)
#18 (shadcn + auth UI) ────────────────────┘
```
