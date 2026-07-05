import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { updateEvent, deleteEvent } from '@/lib/server/events-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

// OIR-208 review (Finding 2 — legacy /api/events double-write surface):
// no dashboard component or hook consumes this route anymore (the legacy
// "internal events" admin section was replaced by the unified Eventos flow
// in lib/server/club-events-service.ts, driven by lib/hooks/use-admin.ts's
// club-event hooks). It's kept only because __tests__/app/api/events.test.ts
// imports PUT/DELETE from this exact file directly and cannot be edited as
// part of this change. Divergence risk: updateEvent/deleteEvent still accept
// any non-club-event row — i.e. a unified internal event (both titles NULL,
// created via the unified admin flow) remains writable/deletable here too,
// with different validation than lib/server/club-events-service.ts. Do not
// wire a new consumer to this route; prefer the club-events endpoints. A
// follow-up should remove this route together with its test coverage.

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = await enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const [{ id }, body] = await Promise.all([params, request.json()])
    return admin.applyCookies(NextResponse.json(await updateEvent(id, body)))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = await enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const { id } = await params
    await deleteEvent(id)
    return admin.applyCookies(new NextResponse(null, { status: 204 }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
