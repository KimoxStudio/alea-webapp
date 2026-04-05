import { NextRequest, NextResponse } from 'next/server'
import { listRoomTables } from '@/lib/server/rooms-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    return NextResponse.json(await listRoomTables(id))
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
