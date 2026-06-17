import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { activateReservationByTable } from '@/lib/server/reservations-service'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.reservationMutation)
  if (rateLimitError) return rateLimitError

  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id: tableId } = await params
    const { searchParams } = new URL(request.url)
    const side = searchParams.get('side') === 'inf' ? ('inf' as const) : undefined

    const reservation = await activateReservationByTable(tableId, auth.session.id, side)
    return auth.applyCookies(NextResponse.json({ reservation }))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
