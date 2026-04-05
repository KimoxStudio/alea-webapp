import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { updateReservationForSession } from '@/lib/server/reservations-service'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.reservationMutation)
  if (rateLimitError) return rateLimitError

  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const body = await request.json()
    return auth.applyCookies(NextResponse.json(await updateReservationForSession(auth.session, id, body)))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
