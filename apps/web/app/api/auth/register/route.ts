import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { memberNumber, email } = body
  if (!memberNumber || !email) {
    return NextResponse.json({ message: 'Member number and email are required', statusCode: 400 }, { status: 400 })
  }
  const newUser = { id: String(Date.now()), memberNumber, email, role: 'member' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  const response = NextResponse.json(newUser)
  response.cookies.set('auth_user', JSON.stringify(newUser), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
  return response
}
