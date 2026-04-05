# Architecture — Alea WebApp

**Last updated:** 2026-04-05
**Milestone:** M6 (post-flatten, single Next.js app)

---

## Overview

Alea is a single Next.js 15 application at the repository root. There is no monorepo, no separate backend process, and no NestJS. All server-side logic runs inside Next.js Route Handlers backed by Supabase.

---

## Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 15, App Router |
| UI | React 19, Tailwind CSS, shadcn/ui |
| Auth & DB | Supabase (PostgreSQL + Row Level Security + Supabase Auth) |
| i18n | next-intl (ES + EN, locale-prefixed URLs) |
| Validation | Zod |
| Data fetching | TanStack Query (client), Route Handlers (server) |
| Testing | Vitest + React Testing Library |
| Language | TypeScript (strict) |

---

## Directory Layout

```
alea-webapp/
├── app/                        # Next.js App Router
│   └── [locale]/               # Locale-prefixed routes (/es, /en)
│       ├── layout.tsx          # Root layout with providers
│       ├── page.tsx            # Home / landing
│       └── api/                # Route Handlers (server-side endpoints)
├── components/                 # Reusable React components (client + server)
├── lib/
│   ├── server/                 # Server-side service layer
│   │   ├── auth-service.ts     # Session management, login, registration
│   │   ├── users-service.ts    # User CRUD operations
│   │   ├── rooms-service.ts    # Room queries
│   │   ├── tables-service.ts   # Table queries
│   │   ├── reservations-service.ts  # Reservation business logic
│   │   ├── availability.ts     # Slot availability and conflict detection
│   │   ├── security.ts         # Password validation, rate limiting helpers
│   │   ├── http-error.ts       # Typed HTTP error factory
│   │   └── service-error.ts    # Domain error types
│   └── supabase/               # Supabase client factory
│       ├── client.ts           # Browser-side client (singleton)
│       ├── server.ts           # Server-side client (per-request, cookie-based)
│       └── types.ts            # Generated DB types
├── messages/                   # i18n JSON files (es.json, en.json)
├── middleware.ts                # Auth + i18n routing (Next.js middleware)
├── supabase/                   # Supabase project config
│   ├── config.toml             # Local dev config
│   ├── migrations/             # SQL migration files (versioned)
│   └── seed.sql                # Development seed data
└── __tests__/                  # Integration and unit tests
```

---

## Server Layer (`lib/server/`)

`lib/server/` is the application's server-side logic layer. It replaces the former NestJS backend.

All modules in this layer:
- Are imported only from Route Handlers (`app/[locale]/api/`) or Server Components.
- Never run in the browser.
- Call Supabase directly using the server-side client (`lib/supabase/server.ts`).
- Throw typed `ServiceError` or `HttpError` instances — never raw strings.

Each service module maps to a domain:

| Module | Responsibility |
|---|---|
| `auth-service.ts` | Login (member number or email), session tokens, logout |
| `users-service.ts` | User CRUD, role management |
| `rooms-service.ts` | Room listing and lookup |
| `tables-service.ts` | Table listing, lookup, QR codes |
| `reservations-service.ts` | Create, update, cancel, list reservations |
| `availability.ts` | Slot generation, conflict detection, `removable_top` surface logic |
| `security.ts` | Password strength validation, brute-force guards |

---

## Auth Flow

Auth is handled by Supabase Auth with server-side session management via HTTP-only cookies:

1. Client POSTs credentials to `/api/auth/login`.
2. Route Handler calls `auth-service.ts` → `supabase.auth.signInWithPassword()`.
3. Supabase sets an HTTP-only session cookie.
4. `middleware.ts` runs on requests to apply `next-intl` routing, refresh Supabase auth state via `auth.getUser()`, and set the CSRF cookie.
5. Protected pages/components (for example, `app/[locale]/rooms/page.tsx`) check the session and redirect unauthenticated users.
6. Protected API routes enforce authentication/authorization per route via helpers such as `requireAuth` and `requireAdmin`.
7. Logout calls `supabase.auth.signOut()`, which invalidates the session and clears the auth cookie(s).

Members can log in with their **member number** or **email address**.

---

## Data Model (key entities)

- **User** — `id`, `memberNumber`, `email`, `role` (`admin` | `member`), `createdAt`, `updatedAt`
- **Room** — `id`, `name`, `tableCount`, `description`
- **GameTable** — `id`, `roomId`, `name`, `type` (`small` | `large` | `removable_top`), `qrCode`, `position`
- **Reservation** — `id`, `tableId`, `userId`, `date`, `startTime`, `endTime`, `status`, `surface` (`top` | `bottom` | null)

### `removable_top` rule

A `removable_top` table has two bookable surfaces. Reserving one surface blocks the other in the same time slot. The availability layer enforces this by treating any partial-surface conflict as a full-slot conflict for the other surface.

---

## i18n

- URL prefix: `/es/...` (default) and `/en/...`
- `middleware.ts` handles locale detection and redirect.
- Translation files: `messages/es.json`, `messages/en.json`.
- `next-intl` is used for both server and client components.

---

## Supabase as the Sole Provider

- **Database**: PostgreSQL managed by Supabase. All schema changes are versioned SQL migrations in `supabase/migrations/`.
- **Auth**: Supabase Auth. No custom JWT implementation.
- **Row Level Security**: RLS policies enforce access control at the DB level in addition to application-layer checks.

---

## Middleware (`middleware.ts`)

`middleware.ts` runs on every request (Edge Runtime) and handles:

1. **Locale routing**: Injects locale prefixes and resolves the active `next-intl` locale.
2. **Supabase user lookup**: Calls `supabase.auth.getUser()` to load the current auth context for the request.
3. **CSRF cookie setup**: Sets a CSRF cookie used by the application.

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase CLI + Docker Desktop

### Steps

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment template
cp .env.local.example .env.local
# Edit .env.local — local Supabase values from the example work out of the box

# 3. Start local Supabase (runs migrations automatically)
supabase start

# 4. Start dev server
pnpm dev
```

### Useful local URLs

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://localhost:54323 |
| Supabase API | http://localhost:54321 |

---

## Testing

Tests live in `__tests__/`. Vitest + React Testing Library is used for unit and component tests.

```bash
pnpm test          # run all tests once
pnpm test:watch    # watch mode
pnpm typecheck     # TypeScript type-check
pnpm lint          # ESLint
```

---

## Security Posture

- Passwords never returned from any API endpoint or stored in client state.
- Admin operations require `role = admin` enforced at the Route Handler level and by RLS.
- All input validated with Zod before reaching service layer.
- HTTP-only, SameSite cookies for session management.
- See `docs/SECURITY_RUNBOOK.md` for the full security checklist.
