# Alea WebApp

Web application for a cultural gaming association (board games and tabletop RPGs — not casino games). Built with Next.js 15 and a Tolkien-inspired RPG/fantasy dark theme.

## What This Is

Alea is a cultural association management platform that allows members to:

- Log in with their member number or email + password
- Browse and reserve tables across 6 themed rooms
- View QR codes per table reservation

Admins can manage users, rooms, tables, and reservations through a dedicated dashboard.

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
- **Docker Desktop / Docker Engine** (required to run `supabase start` locally)
- **Supabase CLI** (`brew install supabase/tap/supabase` or see [docs](https://supabase.com/docs/guides/cli))

## Setup

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

   Open `.env.local` and fill in your Supabase credentials. The example contains hosted-project placeholders that must be replaced. For local development, use `http://127.0.0.1:54321` for `NEXT_PUBLIC_SUPABASE_URL` and run `supabase status` to get the publishable and secret keys.

   If the app runs behind a reverse proxy or CDN in deployment, set `TRUST_PROXY_HEADERS=true` and configure `TRUSTED_PROXY_CIDRS` with the proxy source-IP ranges that are allowed to provide `x-forwarded-for`; otherwise rate limiting falls back to `x-real-ip`. Your ingress must also strip and overwrite inbound `x-real-ip` and `x-forwarded-for` headers before the request reaches the app.

4. **Start the local Supabase instance**

   ```bash
   supabase start
   ```

   This starts PostgreSQL, Auth, Storage, and the Supabase Studio UI locally via Docker.

5. **Start the development server**

   ```bash
   pnpm dev
   ```

   The app is available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run the full test suite (Vitest) |
| `pnpm lint` | ESLint via Next.js |
| `pnpm typecheck` | TypeScript type-check (no emit) |

## Key Business Rules

- **6 rooms**: Mirkwood, Gondolin, Khazad-dum, Rivendell, Lothlorien, Edoras — each with a fixed number of tables.
- **Table types**: `small`, `large`, `removable_top`.
- **removable_top rule**: A table with a removable top has two bookable surfaces (`top` and `bottom`). Reserving one surface blocks the other surface in the same time slot.
- **Authentication**: Members log in with their member number or email + password. Passwords require: minimum 12 characters, at least one letter, at least one number, and at least one special character.
- **Admin**: Admins can view/edit/delete users (without seeing or modifying passwords), manage rooms, tables, and reservations (10 users per page, with search).
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

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a full description of the system architecture, data flow, and design decisions.
