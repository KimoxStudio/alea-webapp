import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'
import { register } from '@/lib/server/auth-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'

export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.authRegister)
  if (rateLimitError) return rateLimitError

  try {
    const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request)
    const body = await request.json()
    const user = await register(body, supabase)
    return applyCookies(NextResponse.json(user, { status: 201 }))
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
