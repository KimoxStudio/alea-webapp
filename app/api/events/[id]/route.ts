import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { updateEvent, deleteEvent } from '@/lib/server/events-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const [{ id }, body] = await Promise.all([params, request.json()])
    return admin.applyCookies(NextResponse.json(await updateEvent(id, body)))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const { id } = await params
    await deleteEvent(id)
    return admin.applyCookies(new NextResponse(null, { status: 204 }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
