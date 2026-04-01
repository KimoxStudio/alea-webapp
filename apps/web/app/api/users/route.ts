import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { listPaginatedUsers } from '@/lib/server/users-service'

export async function GET(request: NextRequest) {
  const admin = requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  const { searchParams } = new URL(request.url)
  return NextResponse.json(
    listPaginatedUsers({
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '10'),
      search: searchParams.get('search') ?? '',
    }),
  )
}
