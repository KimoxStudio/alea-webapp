import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server'
import { recoverAccount } from '@/lib/server/auth-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.authActivate)
  if (rateLimitError) return rateLimitError

  try {
    const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request)
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({
        message: 'Invalid JSON request body.',
        statusCode: 400,
      }, { status: 400 })
    }

    const requestBody = typeof body === 'object' && body !== null
      ? body as Record<string, unknown>
      : {}
    const result = await recoverAccount({
      token: requestBody.token,
      password: requestBody.password,
    })
    const password = String(requestBody.password ?? '')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: result.authEmail,
      password,
    })

    if (signInError) {
      return applyCookies(NextResponse.json({
        message: 'Password updated, but automatic sign-in failed. Please sign in with your member number and new password.',
        statusCode: 500,
      }, { status: 500 }))
    }

    return applyCookies(NextResponse.json(result.user))
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
