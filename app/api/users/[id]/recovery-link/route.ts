import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'
import { generateRecoveryLink } from '@/lib/server/auth-service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const [{ id }, body] = await Promise.all([params, request.json()])
    const locale = body?.locale === 'en' ? 'en' : 'es'
    const requestUrl = new URL(request.url)

    return admin.applyCookies(NextResponse.json(await generateRecoveryLink({
      userId: id,
      locale,
      baseUrl: requestUrl.origin,
      createdBy: admin.session.id,
    })))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
