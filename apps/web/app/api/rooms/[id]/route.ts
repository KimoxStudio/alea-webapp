import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, requireAdmin } from '@/lib/server/auth'
import { updateRoom } from '@/lib/server/rooms-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request)
  if (admin instanceof NextResponse) return admin
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  try {
    const [{ id }, body] = await Promise.all([params, request.json()])
    return NextResponse.json(updateRoom(id, body))
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
