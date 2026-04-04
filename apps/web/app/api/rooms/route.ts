import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, requireAdmin } from '@/lib/server/auth'
import { createRoomEntry, listAllRooms } from '@/lib/server/rooms-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'

export async function GET() {
  try {
    return NextResponse.json(await listAllRooms())
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const body = await request.json()
    return admin.applyCookies(NextResponse.json(await createRoomEntry(body), { status: 201 }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
