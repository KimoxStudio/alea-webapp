import { NextRequest, NextResponse } from 'next/server'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.authRegister)
  if (rateLimitError) return rateLimitError

  return NextResponse.json(
    { message: 'Self-registration is disabled. Ask an administrator for an activation link.', statusCode: 410 },
    { status: 410 },
  )
}
