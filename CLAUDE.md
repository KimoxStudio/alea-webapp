# Claude Code — Alea Webapp

All process rules (language, agent pipeline, worktrees, git, documentation discipline) are defined in
`~/.claude/CLAUDE.md` and apply here without modification. This file only adds project-specific context.

---

## Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js Route Handlers (API routes)
- **Database:** Supabase (Postgres + RLS)
- **Auth:** Supabase Auth + custom session layer
- **i18n:** next-intl — locale files in `messages/en.json` and `messages/es.json`
- **Tests:** Vitest + Testing Library
- **Package manager:** pnpm

---

## Key conventions

- Admin write operations use `createSupabaseServerAdminClient()` (bypasses RLS)
- Regular reads use `createSupabaseServerClient()` (user-scoped, respects RLS)
- All privilege checks (ownership + role) must live in the **service layer**, never in route handlers
- i18n keys must maintain full parity between `en.json` and `es.json`
- Test files must be excluded from `tsconfig.app.json`
- Test files are owned exclusively by `qa-engineer` — `software-engineer` must never create or modify test files

---

## Parallel worktree file split (for this project)

When running parallel implementation agents on this repo, use this domain split to avoid conflicts:

| Agent | File ownership |
|-------|----------------|
| A (frontend) | `app/`, `components/`, `messages/`, `lib/hooks/` |
| B (backend)  | `lib/server/`, `lib/supabase/`, `supabase/`, `__tests__/` |

If a task touches both domains, run agents **sequentially**.
