# M1 Endpoint Inventory (Current State)

This document is the contract baseline for issue #4.

## Next.js API (`apps/web/app/api`)

| Method | Path | Auth Requirement | Origin Check on Mutation | Cookie Use | Response Notes |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | Public | Yes | Sets `auth_session` | Returns public user, 401 on invalid credentials |
| POST | `/api/auth/register` | Public | Yes | Sets `auth_session` | 400 if missing fields or password length < 12, 409 on duplicate email |
| GET | `/api/auth/me` | Authenticated | N/A | Reads `auth_session` | 401 when missing/invalid session |
| POST | `/api/auth/logout` | Session-aware | Yes | Clears `auth_session` | Returns `{ success: true }` |
| GET | `/api/users` | Admin | N/A | Session required | Returns paginated user list |
| PUT | `/api/users/:id` | Admin | Yes | Session required | 404 if user not found |
| DELETE | `/api/users/:id` | Admin | Yes | Session required | 204 on success, 404 if missing |
| GET | `/api/rooms` | Public | N/A | None | Returns all rooms |
| POST | `/api/rooms` | Admin | Yes | Session required | 400 if `name` is missing, 201 on create |
| PUT | `/api/rooms/:id` | Admin | Yes | Session required | 404 if room not found |
| GET | `/api/rooms/:id/tables` | Public | N/A | None | Returns room tables |
| GET | `/api/rooms/:id/tables/availability` | Authenticated | N/A | Session required | Returns per-table availability map |
| GET | `/api/tables/:id/availability` | Authenticated | N/A | Session required | 404 if table not found |
| GET | `/api/reservations` | Authenticated | N/A | Session required | Admin can query other users; members self-scoped |
| POST | `/api/reservations` | Authenticated | Yes | Session required | Validates table, times, conflicts; 201 on create |
| PUT | `/api/reservations/:id` | Authenticated (owner/admin) | Yes | Session required | Validates ownership/status/time/conflicts |

## API App (`apps/api`)

Current `apps/api` runtime is minimal:

- `GET /` responds with JSON `{ "status": "ok", "service": "@alea/api" }`.
- No active auth domain routes exist in current clean state.

## Data/Persistence Reality (Current State)

- Current Next.js API routes use process-local in-memory storage in `apps/web/lib/server/mock-db.ts`.
- No durable database is active for these endpoints in current state.
- Parity planning for later milestones must account for this.

## Error Contract Snapshot

Common error shape used in Next handlers:

```json
{ "message": "Human-readable message", "statusCode": 400 }
```

## Cookie and Session Snapshot

Current Next session (`apps/web/lib/server/auth.ts`):

- Cookie name: `auth_session`
- Token model: HMAC-signed stateless payload (`userId`, `role`, `exp`)
- Attributes:
- `HttpOnly=true`
- `SameSite=lax`
- `Secure=true` only in production
- `Path=/`
- Max age: 7 days

## Auth/CSRF Baseline

- Auth checks are centralized via:
- `requireAuth`
- `requireAdmin`
- Mutation request origin guard:
- `enforceSameOriginForMutation` (checks `Origin` host against `Host`)

## Drift and Freeze Decision

1. Drift
- Two API runtimes currently coexist (`apps/web` and `apps/api`).
- Only Next.js runtime contains active domain and auth flows used by the app.

2. Validation caveats for this baseline
- Register validation currently enforces minimum password length only (`>= 12`), not full complexity rules.
- Room creation strictly enforces `name`; other values are permissive/coerced.

3. Freeze decision
- Keep Next `/api/**` behavior as migration source of truth.
- Do not add new business behavior to `apps/api`.
