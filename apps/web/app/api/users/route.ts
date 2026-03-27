import { NextRequest, NextResponse } from 'next/server'
import type { User, PaginatedResponse } from '@alea/types'

const MOCK_USERS: User[] = Array.from({ length: 47 }, (_, i) => ({
  id: String(i + 1),
  memberNumber: String(100001 + i),
  email: i === 0 ? 'admin@alea.club' : `socio${i}@alea.club`,
  role: i === 0 ? 'admin' : 'member',
  createdAt: new Date(2024, 0, i + 1).toISOString(),
  updatedAt: new Date(2024, 0, i + 1).toISOString(),
}))

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '10')
  const search = searchParams.get('search') ?? ''

  let filtered = MOCK_USERS
  if (search) {
    const q = search.toLowerCase()
    filtered = MOCK_USERS.filter(u => u.email.toLowerCase().includes(q) || u.memberNumber.includes(q))
  }

  const total = filtered.length
  const response: PaginatedResponse<User> = {
    data: filtered.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
  return NextResponse.json(response)
}
