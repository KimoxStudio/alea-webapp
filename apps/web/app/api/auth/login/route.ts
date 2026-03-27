import { NextRequest, NextResponse } from 'next/server'

const MOCK_USERS = [
  { id: '1', memberNumber: '100001', email: 'admin@alea.club', password: 'Admin1234!@#', role: 'admin' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: '2', memberNumber: '100002', email: 'socio@alea.club', password: 'Socio1234!@#', role: 'member' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
]

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { identifier, password } = body
  const user = MOCK_USERS.find(u => (u.memberNumber === identifier || u.email === identifier) && u.password === password)
  if (!user) {
    return NextResponse.json({ message: 'Invalid credentials', statusCode: 401 }, { status: 401 })
  }
  const { password: _, ...userWithoutPassword } = user
  const response = NextResponse.json(userWithoutPassword)
  response.cookies.set('auth_user', JSON.stringify(userWithoutPassword), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
  return response
}
