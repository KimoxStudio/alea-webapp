import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, requireAdmin } from '@/lib/server/auth'
import { updateRoom } from '@/lib/server/rooms-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const [{ id }, body] = await Promise.all([params, request.json()])
    return admin.applyCookies(NextResponse.json(await updateRoom(id, body)))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
