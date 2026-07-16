import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/shared/security'
import { login } from '@/lib/server/auth/auth-service'
import { toServiceErrorResponse } from '@/lib/server/shared/http-error'

export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = await enforceRateLimit(request, RATE_LIMIT_POLICIES.authLogin)
  if (rateLimitError) return rateLimitError

  try {
    const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request)
    const body = await request.json()
    const user = await login(body, supabase)
    return applyCookies(NextResponse.json(user))
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
