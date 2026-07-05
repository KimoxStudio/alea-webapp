# OIR-203 / OIR-204 / OIR-205 — Landing content management from the admin dashboard

Follow-up batch to OIR-202 (public landing page, PR #148). Goal: the board can manage all
landing content (club events, partners, game library) from the webapp dashboard, with no
deploys and no hand-edited seeds.

## Branch & PR strategy (stacked chain — single manual merge)

All work depends on OIR-202, which is not yet in `develop`. Branches are **stacked**:

```
develop
  └─ feat/oir-202-public-landing-page        (PR #148 → develop)
       └─ feat/oir-203-admin-club-events     (PR → develop)
            └─ feat/oir-204-partners-management   (PR → develop)
                 └─ feat/oir-205-game-library-management  (PR → develop)
```

- Each branch is created from the previous one in the chain.
- Every PR targets `develop`. Diffs are cumulative vs develop (expected for stacked PRs);
  each PR description states which parent PR it stacks on.
- **Merge procedure (user, manual):** merge ONLY `feat/oir-205-game-library-management`
  into `develop` via `git merge --no-ff` + push. GitHub then auto-detects the commits of
  #148, OIR-203 and OIR-204 in `develop` and closes all four PRs as merged. One merge,
  everything closes.
- Migrations are prepared and committed by agents but **never executed** — user applies
  `supabase db push` after merging (project rule).

## Pipeline per issue (mandatory)

`software-engineer` (worktree) → `qa-engineer` (tests; owns all test files) →
`security-reviewer` (review + PR). Commits and PR descriptions in English.
i18n: full key parity `messages/es.json` ↔ `messages/en.json` in every issue.
Privilege checks live in the service layer; admin writes use
`createSupabaseServerAdminClient()`; reads respect RLS via `createSupabaseServerClient()`.

---

## OIR-203 — Admin CRUD for public club events

**Problem.** The 24 landing events were seeded by migration. The board cannot create,
edit or hide public events from the webapp. Some club events (e.g. Friday gastro nights)
must not block any room; the current admin event flow assumes room blocking.

**Scope.**

1. **Service layer** (`lib/server/club-events-service.ts` or sibling):
   - `createClubEvent` / `updateClubEvent` / `deleteClubEvent` — admin-only (ownership +
     role checked in service layer), writing the bilingual public columns of
     `public.events`: `title_es/en`, `blurb_es/en`, `description_es/en`, `date_kind`
     (`single` | `range` | `recurring`), `date`, `end_date`, `recurrence_label_es/en`,
     `image_url`, `link_url`, `category_es/en`.
   - **Room blocking optional**: creating a public event does NOT create
     `event_room_blocks` rows unless the admin explicitly attaches room blocks (reuse the
     existing block flow). An event with no blocks reserves nothing.
   - **URL hardening (MEDIUM from PR #148 security review):** `image_url` and `link_url`
     validated in the service layer with a protocol allowlist — only `http:`/`https:`
     absolute URLs (or empty). Reject anything else (`javascript:`, `data:`, relative).
     This lands BEFORE the board can edit those fields — hard requirement.
2. **Route handlers** for the CRUD operations (thin; no privilege logic in handlers).
3. **Dashboard UI** (admin events section):
   - New "Club events" management view listing public events (rows where
     `title_es IS NOT NULL AND title_en IS NOT NULL`), with tabs **Upcoming / Past**
     (derived by date at read time, same rule as the landing — past events stay listed
     forever so the landing's "past" carousel always has content).
   - Create/edit form with all bilingual fields, image URL, link URL, category,
     date kind (single date / range / recurring label), and an explicit
     "blocks rooms" toggle that only then exposes the room-block sub-flow.
   - Hide-from-landing action = clearing `title_es`/`title_en` is NOT the UX; instead the
     form simply requires both titles to publish. Deleting removes the row (confirm dialog).
4. **Internal listing separation:** the dashboard's existing `listEvents()` room-booking
   view must not mix in the public landing rows (flagged in
   `docs/issues/oir-202-public-landing-page.md`). Filter internal views to rows that have
   room blocks / legacy `title`, or add an explicit discriminator filter.
5. **i18n** for all new UI strings (ES/EN parity).

**Out of scope:** image upload/storage (URL field only, same as seed data).

**Acceptance criteria.**
- Admin can create a public event with no room blocks (gastro-night case) and it appears
  on the landing (upcoming or past by date) without any deploy.
- Admin can create a public event WITH room blocks and the blocks behave like today.
- Non-admin (member) gets 403 from every CRUD endpoint (service-layer check).
- `javascript:alert(1)` in `image_url`/`link_url` is rejected with a validation error.
- Internal room-booking event views show no landing-only rows.
- Typecheck, lint, build, full test suite green. New tests by qa-engineer cover service
  CRUD, URL allowlist, privilege checks, upcoming/past split.

**Branch:** `feat/oir-203-admin-club-events` from `feat/oir-202-public-landing-page`.

---

## OIR-204 — Partners (colaboradores) management

**Problem.** Partners are hardcoded in `components/landing/partners-data.ts` — changing a
partner requires a deploy.

**Scope.**

1. **Migration** (`supabase/migrations/20260704000002_oir204_partners_table.sql`):
   - Table `public.partners`: `id uuid pk default gen_random_uuid()`, `name text not null`,
     `img_url text not null`, `link_url text`, `desc_es text`, `desc_en text`,
     `sort_order int not null default 0`, `active boolean not null default true`,
     `created_at/updated_at timestamptz default now()`.
   - RLS enabled: SELECT for `anon` + `authenticated` where `active = true`; no
     INSERT/UPDATE/DELETE policies (writes go through service_role only).
     `GRANT SELECT ON public.partners TO anon, authenticated;`
   - **Seed** from the current `partners-data.ts` content (all partners, preserving order
     via `sort_order`).
2. **Service layer** `lib/server/partners-service.ts`: `listPartners` (public read,
   ordered), `createPartner`/`updatePartner`/`deletePartner` (admin-only, URL protocol
   allowlist on `img_url`/`link_url` — same rule as OIR-203).
3. **Route handlers** for CRUD.
4. **Dashboard UI**: "Colaboradores" management section — list with sort order, active
   toggle, create/edit form (name, logo URL, link, desc ES/EN), delete with confirm.
5. **Landing**: `partners-section.tsx` consumes DB data via the service (fetched in the
   server component `app/[locale]/page.tsx` alongside events; graceful empty state).
   Delete `components/landing/partners-data.ts`.
6. **i18n** ES/EN parity for new UI strings.

**Acceptance criteria.**
- Landing shows exactly the seeded partners in the same order as today (visual parity).
- Admin can add/edit/deactivate a partner and the landing reflects it without deploy.
- Non-admin gets 403 on writes; anon can only read active partners.
- URL allowlist enforced. All checks green; qa-engineer tests cover service + RLS-shaped
  read filtering (active only) + privilege checks.

**Branch:** `feat/oir-204-partners-management` from `feat/oir-203-admin-club-events`.

---

## OIR-205 — Game library (ludoteca) management

**Problem.** Featured games are hardcoded in `components/landing/game-library-data.ts`.

**Scope.**

1. **Migration** (`supabase/migrations/20260704000003_oir205_library_games_table.sql`):
   - Table `public.library_games`: `id uuid pk default gen_random_uuid()`,
     `title text not null`, `category_es text not null`, `category_en text not null`,
     `players text not null`, `play_time text not null`, `weight numeric(2,1) not null`,
     `sort_order int not null default 0`, `active boolean not null default true`,
     `created_at/updated_at timestamptz default now()`.
   - RLS + grants identical in shape to `partners` (public SELECT where active, writes
     service_role only).
   - **Seed** from `game-library-data.ts` (translate the single-language category to
     ES/EN pairs; e.g. "Rol" → "Rol"/"TTRPG", "Wargame" → "Wargame"/"Wargame",
     "Deducción" → "Deducción"/"Deduction", "Familiar" → "Familiar"/"Family",
     "Carreras" → "Carreras"/"Racing", "Estrategia" → "Estrategia"/"Strategy",
     "Deportes" → "Deportes"/"Sports").
2. **Service layer** `lib/server/library-games-service.ts`: `listLibraryGames` (public),
   CRUD (admin-only).
3. **Route handlers** for CRUD.
4. **Dashboard UI**: "Ludoteca" management section — list, sort order, active toggle,
   create/edit form (title, category ES/EN, players, time, weight 0–5), delete confirm.
5. **Landing**: `game-library-section.tsx` consumes DB data (server-fetched, localized
   category); delete `game-library-data.ts`.
6. **i18n** ES/EN parity.

**Acceptance criteria.**
- Landing games carousel identical to today with seeded data (localized category shown).
- Admin CRUD works without deploy; non-admin 403; anon reads active rows only.
- All checks green; qa-engineer tests cover service, localization fallback, privilege.

**Branch:** `feat/oir-205-game-library-management` from `feat/oir-204-partners-management`.

---

## Post-merge checklist (user)

1. Merge `feat/oir-205-game-library-management` → `develop` (`git merge --no-ff`, push).
   PRs #148 + OIR-203/204/205 close automatically.
2. `supabase db push` — applies OIR-202 pending migrations (incl. `20260704000001`
   repair) + `20260704000002` (partners) + `20260704000003` (library_games).
3. Verify `/es` and `/en`: landing renders events, partners and games from DB;
   dashboard manages all three.
