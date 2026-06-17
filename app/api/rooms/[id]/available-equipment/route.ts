import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { listAvailableEquipmentForReservation } from '@/lib/server/reservations-service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const searchParams = new URL(request.url).searchParams
    return auth.applyCookies(NextResponse.json(await listAvailableEquipmentForReservation({
      roomId: id,
      date: searchParams.get('date'),
      startTime: searchParams.get('startTime'),
      endTime: searchParams.get('endTime'),
    })))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
