# OIR-202 — Public landing page: import Alea Design "Alea Landing" and wire up club events

> Local markdown emulation of a Linear issue. Linear is not reachable for this
> project's real workspace in the current session (only an unrelated personal
> team, "Oiranca", is connected — an issue was created there by mistake, see
> note at the bottom). Track status here until Linear is properly connected,
> then migrate this file's content into the real issue and delete it.

**Status:** In Progress
**Branch:** `feat/oir-202-public-landing-page`

## Context

Source design: claude.ai/design project `592c2b9c-c77a-4c56-8e84-5eaa7d246db9`, file **`Alea Landing.html`** (NOT `Alea Admin.html` — that file is the admin dashboard and is explicitly out of scope, see below).

The design project contains 3 separate concerns:
- `Alea Landing.html` (+ `variant-modern.jsx`, `events-calendar.jsx`, `event-modal.jsx`, `app.jsx`, `shared.jsx`, `data.js`, `styles.css`, `variant-modern.css`) → **this is what we implement**: the public marketing landing (hero, upcoming/past events, game library, values, partners, footer, member CTA, i18n ES/EN, easter eggs).
- `Alea Admin.html` (+ `admin-*.jsx`) → admin dashboard. **Out of scope** — we already have an admin dashboard in the webapp; any admin functionality from this design gets folded into the *existing* dashboard as new features later, not duplicated.
- A login screen also exists in the design assets → **out of scope**, webapp already has its own login/auth flow.

## What to build (this issue)

1. New public landing route, mounted at `/` when there is no active session (currently `app/page.tsx` and `app/[locale]/page.tsx` unconditionally redirect to `/login` or `/rooms`). Authenticated behavior is unchanged (still redirects to `/rooms`).
2. Port the landing content/sections from the design (hero, upcoming events, past events, game library highlights, club values, partner/collaborator grid, footer) into the webapp's stack (Next.js 15 App Router, Tailwind, existing component conventions) — do not bring in the standalone React-via-CDN/Babel setup used in the design prototype, reimplement as normal Next.js components.
3. i18n: fold the landing copy into the project's existing `messages/en.json` / `messages/es.json` via next-intl, maintaining full key parity — do NOT reuse the design's ad-hoc `window.ALEA_I18N` dictionary/`I18nProvider`.
4. Events data model — **reuse and extend, don't duplicate**: the webapp already has a `public.events` table (`id, title, description, date, start_time, end_time, created_by, created_at`) plus `event_room_blocks` for multi-day/multi-room support (see `supabase/migrations/20260417000003_baseline.sql` and `20260617000001_kim383_multi_day_events.sql`), used today for internal room-reservation events via `lib/server/events-service.ts`. Confirmed with the user: club events shown on the landing (tournaments, game nights, community gatherings) are **always public** — there is no separate public/private flag to design. Extend the existing `events` table with the additional fields the landing needs rather than creating a fully parallel model:
   - Bilingual copy: title/description/blurb in ES and EN (existing columns are single-language).
   - `image_url`, external `link`.
   - Category/tag (wargame, rol, cultural, recurring league, etc. — see `tone`/`tagES` in the design's `data.js`).
   - Support for date ranges and weekly/recurring patterns as *display* metadata (the existing multi-day/room-block model is for concrete scheduled room bookings — the landing needs looser recurring text like "Cada viernes" / "Todo 2026" too; see the date-parsing logic in the design's `events-calendar.jsx` for the formats to support).
   - "Past" vs "upcoming" is derived from `date`, not a stored flag.
   Seed the extended table with the real content already present in the design's `data.js` (`window.ALEA_DATA.upcoming` and `.past` arrays — this is real event history for the club, not placeholder data).
5. Landing reads events from the DB (not hardcoded data.js) so the "past events" list grows over time as new events pass their date.
6. Member/CTA buttons ("Hazte socio", "Entrar al club", footer admin link) point at the existing `/login` flow — no new login UI.

## Explicitly deferred (follow-up issue, do not build now)

- Admin CRUD UI for managing public club events (create/edit). This issue only needs the schema extension + seed + read path for the landing to render. Scope kept small to avoid conflating "new landing" with "new admin surface" in one PR.
- Any admin dashboard functionality from `Alea Admin.html` (overview/events/collaborators/games panels) — to be evaluated separately for integration into the existing admin dashboard, not duplicated.

## Assumed / confirmed decisions

- Landing lives at public `/` (unauthenticated), not a separate dedicated path. **Confirmed by user.**
- Events extend the existing `events` table rather than a brand-new parallel table; only genuinely missing fields get added. **Confirmed by user** ("ya tenemos tablas que nos pueden servir y las que no tengamos tendremos que crearlas").
- All club events are public by nature — no public/private distinction needed in the schema. **Confirmed by user.**
- Admin CRUD for these events stays deferred to a follow-up issue (not re-confirmed explicitly, flag before merge if this should actually ship now).
- Full agent pipeline used (product-manager → team-lead → software-engineer → qa-engineer → security-reviewer → PR against `develop`), tracked here in markdown instead of Linear until Linear is reachable for this project.
- DB migrations are prepared by the engineer and committed to the branch, but **never executed** by any agent — user applies via `supabase db push` per project rules.

## Acceptance criteria

- [ ] Unauthenticated visit to `/` (and `/es`, `/en`) renders the new landing instead of redirecting straight to `/login`.
- [ ] Authenticated visit to `/` still redirects to `/rooms` (unchanged).
- [ ] Landing renders hero, upcoming events, past events, game library, values, partners, footer sections with content from DB (seeded from design's `data.js`).
- [ ] ES/EN toggle works via next-intl, full key parity in `messages/en.json` / `messages/es.json`.
- [ ] "Hazte socio" / "Entrar al club" / footer admin link route to existing `/login`.
- [ ] No dependency on the design prototype's CDN React/Babel loading — fully integrated as Next.js components.
- [ ] Build and typecheck pass; test files excluded from `tsconfig.app.json` per project convention.
- [ ] Migration SQL committed but not applied by any agent.

---

**Note on Linear:** a duplicate of this issue was created as `OIR-202` in the Linear team "Oiranca" (https://linear.app/oiranca/issue/OIR-202) before it became clear that's not this project's real workspace. Leaving it there for now (harmless, unrelated team) — decide later whether to cancel it once the correct Linear project is connected.
