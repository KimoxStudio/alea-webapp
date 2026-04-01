import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, requireAdmin } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { deleteUser, updateUser } from '@/lib/server/users-service'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request)
  if (admin instanceof NextResponse) return admin
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  try {
    const [{ id }, body] = await Promise.all([params, request.json()])
    return NextResponse.json(updateUser(id, body))
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request)
  if (admin instanceof NextResponse) return admin
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  try {
    deleteUser((await params).id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
