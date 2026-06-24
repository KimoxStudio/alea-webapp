import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { previewEventConflicts } from '@/lib/server/events-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = await enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const body = await request.json()
    const result = await previewEventConflicts(body)
    return admin.applyCookies(NextResponse.json(result))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
