import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, requireAdmin } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { deleteUser, updateUser } from '@/lib/server/users-service'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const [{ id }, body] = await Promise.all([params, request.json()])
    return admin.applyCookies(NextResponse.json(await updateUser(id, body)))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    await deleteUser((await params).id)
    return admin.applyCookies(new NextResponse(null, { status: 204 }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
