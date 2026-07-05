import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { createEvent, listEvents } from '@/lib/server/events-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    return admin.applyCookies(NextResponse.json(await listEvents()))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}

// OIR-208 review (Finding 2 — legacy /api/events double-write surface):
// no dashboard component or hook consumes POST/GET here anymore (the legacy
// "internal events" admin section was replaced by the unified Eventos flow
// in lib/server/club-events-service.ts, driven by lib/hooks/use-admin.ts's
// club-event hooks). Kept only because __tests__/app/api/events.test.ts
// imports GET/POST from this exact file directly and cannot be edited as
// part of this change. Divergence risk: createEvent still writes a plain
// internal event indistinguishable from a unified "visibleOnLanding: false"
// event, with different validation/defaults than
// lib/server/club-events-service.ts's createClubEvent. Do not wire a new
// consumer to this route; prefer the club-events endpoints. A follow-up
// should remove this route together with its test coverage.
export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = await enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const body = await request.json()
    const event = await createEvent({ ...body, createdBy: admin.session.id })
    return admin.applyCookies(NextResponse.json(event, { status: 201 }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
