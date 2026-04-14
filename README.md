# Alea WebApp

Web application for a cultural gaming association (board games and tabletop RPGs — not casino games). Built with Next.js 15 and a Tolkien-inspired RPG/fantasy dark theme.

## What This Is

Alea is a cultural association management platform that allows members to:

- Log in with their member number + password
- Browse and reserve tables across 6 themed rooms
- View QR codes per table reservation

Admins can manage users, member imports, rooms, tables, events, and reservations through a dedicated dashboard.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS, shadcn/ui |
| Auth & DB | Supabase (PostgreSQL + Row Level Security) |
| i18n | next-intl (Spanish + English) |
| Testing | Vitest + React Testing Library |
| Language | TypeScript |

## Project Structure

```
alea-webapp/
├── app/                    # Next.js App Router pages and layouts
│   ├── [locale]/           # Locale-prefixed routes (es, en)
│   └── api/                # Route handlers (server-side API)
├── components/             # Reusable UI components
├── lib/                    # Application logic
│   ├── server/             # Server-side service layer (auth, rooms, reservations, users)
│   └── supabase/           # Supabase client helpers (browser + server)
├── messages/               # i18n translation files (es.json, en.json)
├── supabase/               # Supabase config and migrations
├── __tests__/              # Integration and unit tests
├── docs/                   # Architecture and decision documentation
├── middleware.ts            # i18n routing, Supabase session refresh, and CSRF cookie setup
└── scripts/                # Dev utility scripts
```

## Prerequisites

- **Node.js** 20+ (see `.nvmrc` or `engines` in `package.json`)
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker Desktop** + **Supabase CLI** *(optional — only required to run `pnpm test:integration` for local schema/migration checks)*

## Quick Start

### Option A — Fastest path (existing Supabase Cloud project)

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd alea-webapp
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   The project uses **Supabase Cloud** by default. Open `.env.local` and fill in the following credentials from your Supabase project dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `SUPABASE_SECRET_DEFAULT_KEY`
   - `NEXT_PUBLIC_APP_URL` (`http://localhost:3000` locally)
   - `CRON_SECRET` (any long random string for local work)

   If the app runs behind a reverse proxy or CDN in deployment, set `TRUST_PROXY_HEADERS=true` and configure `TRUSTED_PROXY_CIDRS` with the proxy source-IP ranges that are allowed to provide `x-forwarded-for`; otherwise rate limiting falls back to `x-real-ip`. Your ingress must also strip and overwrite inbound `x-real-ip` and `x-forwarded-for` headers before the request reaches the app.

4. **Start the development server**

   ```bash
   pnpm dev
   ```

   The app is available at [http://localhost:3000](http://localhost:3000).

### Option B — Full local Supabase stack

Use this when you want local DB/auth/state and deterministic QA fixtures.

1. Install Docker Desktop and Supabase CLI.

2. Start Supabase from the repo root:

   ```bash
   supabase start
   ```

3. Read local credentials:

   ```bash
   supabase status
   ```

4. Copy `.env.example` to `.env.local`, then set:

   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon/publishable key from supabase status>`
   - `SUPABASE_SECRET_DEFAULT_KEY=<service_role/secret key from supabase status>`
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `CRON_SECRET=<any long random string>`

5. Start the app:

   ```bash
   pnpm dev
   ```

Local Supabase ports from `supabase/config.toml`:

| Service | URL |
|---|---|
| App | `http://localhost:3000` |
| Supabase API | `http://127.0.0.1:54321` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio | `http://127.0.0.1:54323` |

### Local seed data

The local Supabase seed is for QA only and is applied by `supabase db reset` / `supabase start`.

- Shared local test password for seeded users: `TestPass123!`
- Seeded admin email: `admin@alea.test`
- Seeded profiles/member numbers are defined in `supabase/seed.sql`

Reset local DB + re-apply migrations + seed:

```bash
supabase db reset
```

Stop local Supabase:

```bash
supabase stop
```

## Local CI Hook

The repository uses a local `pre-push` hook to run the core validation checks before a push. The hook is not installed automatically after cloning.

1. Install the hook:

   ```bash
   pnpm hooks:install
   ```

   On Windows, this command requires Bash or WSL. If Bash is not available, the script exits without modifying your environment.

2. Push as usual:

   ```bash
   git push
   ```

   To skip the hook for a single push, use `git push --no-verify`.

The hook currently runs:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

It does not replace the checks that used to run only in GitHub Actions, such as coverage, dependency audit, SAST, or integration validation. Treat it as the local fast-fail gate for the main development path, not as a full CI substitute.

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run the full test suite (Vitest) |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:integration` | Validate migrations/types against a temporary local Supabase stack |
| `pnpm lint` | ESLint via Next.js |
| `pnpm typecheck` | TypeScript type-check (no emit) |
| `pnpm security:deps` | Audit production dependencies |
| `pnpm hooks:install` | Install the local `pre-push` hook |

## Developer Checklist

For a fresh machine:

1. `pnpm install`
2. `cp .env.example .env.local`
3. Fill env values for Cloud or local Supabase
4. `pnpm dev`
5. Optional local guardrail: `pnpm hooks:install`

Before pushing:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`

If you touched SQL schema or generated DB types:

1. `pnpm test:integration`
2. confirm `lib/supabase/types.ts` matches generated output

## Key Business Rules

- **6 rooms**: Mirkwood, Gondolin, Khazad-dum, Rivendell, Lothlorien, Edoras — each with a fixed number of tables.
- **Table types**: `small`, `large`, `removable_top`.
- **removable_top rule**: A table with a removable top has two bookable surfaces (`top` and `bottom`). Reserving one surface blocks the other surface in the same time slot.
- **Authentication**: Members currently log in with their member number + password. Passwords require: minimum 12 characters, at least one letter, at least one number, and at least one special character.
- **Admin**: Admins access the dashboard at `/{locale}/admin` (guarded route). The dashboard features: user management (10/page, paginated list with search, status badge, edit role/status/member number/contact fields, CSV member import, delete), room and table management (list/edit rooms, create tables), event management, and reservation management (list all, cancel with confirmation). Passwords are never shown or editable. Admin write operations use Supabase admin client (bypasses RLS). Inactive/suspended users cannot log in.
- **QR codes**: Each table has a QR code for quick reservation lookup.

## Accessibility

Target: **WCAG 2.2 AA**

- Full keyboard navigation
- Skip links
- High contrast tokens
- Visible focus indicators
- Semantic HTML and ARIA labels where applicable

## Internationalization

The app is available in **Spanish** (default) and **English**. Language is determined from the URL prefix (`/es/...`, `/en/...`). Translation files live in `messages/`.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a full description of system architecture, local setup, and runtime data flow.
