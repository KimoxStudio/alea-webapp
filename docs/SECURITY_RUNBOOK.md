# Security Hardening Runbook

## Active controls

- Supabase SSR session cookies are issued with `HttpOnly`, `SameSite=Lax`, `path=/`, and `Secure` in production.
- Mutating Next.js API routes require all of:
  - same-origin `Origin`
  - trusted Fetch Metadata (`Sec-Fetch-Site` must not be `cross-site`)
  - double-submit CSRF token (`alea-csrf-token` cookie + `x-csrf-token` header)
- Rate limiting is enforced per client IP on:
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `POST /api/auth/logout`
  - admin mutation routes
  - reservation mutation routes

## Operational notes

- The rate limiter is in-memory and best-effort. It is appropriate for local and single-instance deployments, but shared infrastructure should own the final abuse-control layer.
- Session cookies stay at `SameSite=Lax` to avoid breaking legitimate Supabase navigation and callback flows.
- The CSRF cookie is intentionally readable by the browser because the client must echo it in `x-csrf-token`. The auth session cookie remains `HttpOnly`.

## Incident response

### Session compromise

1. Revoke the affected sessions in Supabase and force logout on the affected accounts.
2. Review recent auth, reservation, and admin mutation activity for the impacted users.
3. If the blast radius is unclear, rotate `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` and `SUPABASE_SECRET_DEFAULT_KEY` in the Supabase Dashboard (Project Settings → API Keys) and redeploy.
4. Confirm clients receive a fresh session cookie and a fresh CSRF cookie after recovery.

### Service-role or environment secret compromise

1. Rotate `SUPABASE_SECRET_DEFAULT_KEY` immediately via Supabase Dashboard → Project Settings → API Keys → Secret keys → default.
2. Rotate `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` if exposure scope is uncertain (Dashboard → Project Settings → API Keys → Publishable key).
3. Redeploy with the new secrets.
4. Audit privileged reads and writes that could have bypassed RLS while the key was exposed.

### CSRF or abuse-control bypass suspicion

1. Inspect recent requests missing `Origin`, failing `Sec-Fetch-Site`, or returning `429`.
2. Confirm middleware is still issuing the `alea-csrf-token` cookie on page responses.
3. Tighten the affected route budget or move throttling to shared edge/storage-backed infrastructure.
4. Add a regression test that reproduces the bypass before shipping the mitigation.
