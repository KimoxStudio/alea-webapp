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
   - **Seed** from `game-library-data.ts`, preserving its existing ES/EN category
     pairs verbatim (the data file is authoritative for labels — e.g. "Rol"/"RPG"
     for Pathfinder 2e, matching what the landing already renders).
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

## OIR-206 — Admin dashboard UX: single Events tab, tab order, optional English

**Problem (user feedback 2026-07-04).** "Eventos del club" as a separate tab is confusing —
it's all "Eventos" to the board. Tab order is wrong. The forms demand English copy the
board doesn't want to write (the public language toggle may be removed entirely later).

**Scope.**

1. **Single "Eventos" tab.** Remove the `club-events` top-level tab. The `events` tab
   renders ONE section with two inner sub-tabs (shadcn Tabs nested or segmented control):
   - **"Club (landing)"** — the existing club-events management UI (default sub-tab).
   - **"Internos (salas)"** — the existing legacy room-booking events UI.
   Reuse both existing section components as-is inside the wrapper; no logic changes.
2. **Tab order:** `users`, `reservations`, `rooms`, `equipment`, `library-games`,
   `events`, `partners` — i.e. Usuarios, Reservas, Salas, Material, Ludoteca, Eventos,
   Colaboradores.
3. **Optional English with ES fallback.** In club-events, partners and library-games
   services: all `*En` inputs become optional; when absent/empty, the service copies the
   ES value on create AND update (`title_en = title_es`, etc.) so DB constraints
   (`events_bilingual_titles_paired`, NOT NULL categories) and the landing RLS gate stay
   satisfied. Admin forms: EN inputs moved into a collapsed "English (opcional)"
   disclosure, never required client-side. NO DB schema change — full i18n removal is a
   future issue, explicitly out of scope here.
4. i18n for changed labels, ES/EN parity.

**Acceptance criteria.**
- Dashboard shows exactly 7 top-level tabs in the order above; club events reachable
  under Eventos → Club (landing).
- Creating a club event/partner/game with ONLY Spanish text succeeds; landing renders it
  (EN locale shows the ES copy); DB rows satisfy the paired-titles constraint.
- Explicit EN text, when provided, still wins.
- Full suite green; qa-engineer covers the ES-fallback service behavior.

**Branch:** `feat/oir-206-admin-events-ux` from `feat/oir-205-game-library-management`.

---

## OIR-207 — Image upload from device to Supabase Storage

**Problem.** Events/partners images are URL-only; the board wants to upload files from
their device. Library games have no image support at all.

**Scope.**

1. **Migration** `supabase/migrations/20260704000005_oir207_landing_media_bucket.sql`:
   - Create storage bucket `landing-media` (public read). Insert into `storage.buckets`
     with `public = true`, plus `storage.objects` policies: public/anon+authenticated
     SELECT for this bucket only; NO client INSERT/UPDATE/DELETE policies (writes go
     through the service-role key server-side only). File size limit 5 MB and
     allowed_mime_types image/png, image/jpeg, image/webp, image/gif on the bucket if
     supported by the local Supabase version (else enforce only in the route).
   - `ALTER TABLE public.library_games ADD COLUMN "img_url" text;` (nullable).
2. **Upload route** `app/api/admin/uploads/route.ts` (POST multipart/form-data):
   `requireAdmin` + `enforceMutationSecurity` + `enforceRateLimit(adminMutation)`.
   Validates: file present, content-type in the image allowlist above, size ≤ 5 MB,
   `folder` param in allowlist {`events`,`partners`,`library-games`}. Stores via admin
   client at `<folder>/<uuid>.<ext>` (extension derived from MIME, never from filename),
   returns `{ url }` (public URL). Service-layer helper `lib/server/uploads-service.ts`
   owns validation; route stays thin.
3. **Shared UI component** `components/admin/image-upload.tsx`: file input + client-side
   preview + upload progress/error; on success writes the returned URL into the form's
   image field (URL field stays visible as fallback/manual option).
4. **Wire into the three forms**: club-events, partners, library-games (adds image
   support to library-games create/edit; service accepts optional `imageUrl` validated
   by the shared URL validator).
5. **Landing game card**: if `img_url` present render it as the cover (object-fit cover,
   same container), else keep the existing gradient cover — pixel parity when absent.
6. i18n ES/EN parity for new strings.

**Acceptance criteria.**
- Admin uploads a PNG/JPG/WebP from device in any of the three forms → file lands in
  `landing-media/<folder>/…`, public URL saved on the row, image renders on landing.
- Upload rejects: >5 MB, non-image MIME, SVG, missing admin session (401/403), folder
  outside allowlist.
- Anon can READ uploaded files, cannot write to the bucket.
- Full suite green; qa covers the uploads service validation matrix.

**Branch:** `feat/oir-207-image-uploads` from `feat/oir-206-admin-events-ux`.

---

## Post-merge checklist (user)

1. Merge the LAST branch of the chain → `develop` (`git merge --no-ff`, push).
   All stacked PRs (#148 onward) close automatically. Current chain tail:
   `feat/oir-207-image-uploads`.
2. `supabase db push` — applies all pending migrations: OIR-202 set +
   `20260704000001` (repair) + `20260704000002` (partners) + `20260704000003`
   (library_games) + `20260704000004` (club-events RPC) + `20260704000005`
   (landing-media bucket + library_games.img_url).
3. Verify `/es` and `/en`: landing renders events, partners and games from DB;
   dashboard manages all three.
