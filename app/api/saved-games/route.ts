import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { createSavedGameForSession, listSavedGamesForSession } from '@/lib/server/saved-games-service'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    return auth.applyCookies(NextResponse.json(await listSavedGamesForSession(auth.session)))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}

export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError
  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.reservationMutation)
  if (rateLimitError) return rateLimitError

  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    return auth.applyCookies(NextResponse.json(
      await createSavedGameForSession(auth.session, body),
      { status: 201 },
    ))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
