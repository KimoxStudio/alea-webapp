import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { deleteUser, resetNoShows, unblockUser, updateUser } from '@/lib/server/users-service'
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
    return admin.applyCookies(NextResponse.json(await updateUser(id, body)))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const [{ id }, body] = await Promise.all([params, request.json()])
    const { action } = body as { action?: string }

    if (action === 'reset_no_shows') {
      await resetNoShows(id)
      return admin.applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'unblock') {
      await unblockUser(id)
      return admin.applyCookies(NextResponse.json({ ok: true }))
    }

    return admin.applyCookies(
      NextResponse.json({ message: 'Invalid action', statusCode: 400 }, { status: 400 })
    )
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
    await deleteUser((await params).id)
    return admin.applyCookies(new NextResponse(null, { status: 204 }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
