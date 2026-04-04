import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { listPaginatedUsers } from '@/lib/server/users-service'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const { searchParams } = new URL(request.url)
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10)
    const rawLimit = parseInt(searchParams.get('limit') ?? '10', 10)
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 10
    return admin.applyCookies(NextResponse.json(
      await listPaginatedUsers({
        page,
        limit,
        search: searchParams.get('search') ?? '',
      }),
    ))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
