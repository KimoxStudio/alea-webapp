import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth/auth'
import { toServiceErrorResponse } from '@/lib/server/shared/http-error'
import { renewSavedGameForSession } from '@/lib/server/games/saved-games-service'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/shared/security'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError
  const rateLimitError = await enforceRateLimit(request, RATE_LIMIT_POLICIES.reservationMutation)
  if (rateLimitError) return rateLimitError

  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    return auth.applyCookies(NextResponse.json(await renewSavedGameForSession(auth.session, id)))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
