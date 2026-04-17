import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { createEvent, listEvents } from '@/lib/server/events-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    return admin.applyCookies(NextResponse.json(await listEvents()))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}

export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const body = await request.json()
    const event = await createEvent({ ...body, createdBy: admin.session.id })
    return admin.applyCookies(NextResponse.json(event, { status: 201 }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
