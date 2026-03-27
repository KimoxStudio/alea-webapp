import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { password: _p, ...safeBody } = body
  return NextResponse.json({ id, ...safeBody })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params
  return new Response(null, { status: 204 })
}
