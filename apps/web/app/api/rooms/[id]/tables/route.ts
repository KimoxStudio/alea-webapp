import { NextResponse } from 'next/server'
import { listRoomTables } from '@/lib/server/rooms-service'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json(await listRoomTables(id))
}
