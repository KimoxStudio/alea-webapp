import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { getTableAvailability } from '@/lib/server/tables-service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    return auth.applyCookies(NextResponse.json(await getTableAvailability(id, new URL(request.url).searchParams.get('date'))))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
