// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { ServiceError } from '@/lib/server/service-error'

const requireAuthMock = vi.fn()
const listAvailableEquipmentForReservationMock = vi.fn()

vi.mock('@/lib/server/auth', () => ({
  requireAuth: requireAuthMock,
}))

vi.mock('@/lib/server/reservations-service', () => ({
  listAvailableEquipmentForReservation: listAvailableEquipmentForReservationMock,
}))

function makeAuthContext(userId = 'user-1', role: 'member' | 'admin' = 'member') {
  return {
    session: { id: userId, role },
    applyCookies: (response: NextResponse) => response,
  }
}

describe('GET /api/rooms/[id]/available-equipment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue(makeAuthContext())
  })

  it('returns available equipment options for an authenticated user', async () => {
    listAvailableEquipmentForReservationMock.mockResolvedValue([
      { id: 'eq-1', name: 'Projector', description: null, createdAt: '2026-04-01T10:00:00.000Z', available: true, conflictReason: null },
    ])

    const { GET } = await import('@/app/api/rooms/[id]/available-equipment/route')
    const request = new NextRequest('http://localhost:3000/api/rooms/room-1/available-equipment?date=2026-04-20&startTime=10:00&endTime=12:00')
    const response = await GET(request, { params: Promise.resolve({ id: 'room-1' }) })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: 'eq-1', available: true }),
    ])
    expect(listAvailableEquipmentForReservationMock).toHaveBeenCalledWith({
      roomId: 'room-1',
      date: '2026-04-20',
      startTime: '10:00',
      endTime: '12:00',
    })
  })

  it('returns auth response when the user is not authenticated', async () => {
    requireAuthMock.mockResolvedValue(
      NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
    )

    const { GET } = await import('@/app/api/rooms/[id]/available-equipment/route')
    const request = new NextRequest('http://localhost:3000/api/rooms/room-1/available-equipment?date=2026-04-20&startTime=10:00&endTime=12:00')
    const response = await GET(request, { params: Promise.resolve({ id: 'room-1' }) })

    expect(response.status).toBe(401)
    expect(listAvailableEquipmentForReservationMock).not.toHaveBeenCalled()
  })

  it('maps service errors to the route response', async () => {
    listAvailableEquipmentForReservationMock.mockRejectedValue(new ServiceError('Invalid reservation time range', 400))

    const { GET } = await import('@/app/api/rooms/[id]/available-equipment/route')
    const request = new NextRequest('http://localhost:3000/api/rooms/room-1/available-equipment?date=2026-04-20&startTime=12:00&endTime=10:00')
    const response = await GET(request, { params: Promise.resolve({ id: 'room-1' }) })

    expect(response.status).toBe(400)
  })
})
