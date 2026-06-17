import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(() => Promise.resolve()),
  useMutation: vi.fn((config: any) => config),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useMutation: mocks.useMutation,
    useQueryClient: vi.fn(() => ({ invalidateQueries: mocks.invalidateQueries })),
  }
})

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    delete: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@/lib/api/endpoints', () => ({
  endpoints: {
    equipment: {
      byId: (id: string) => `/equipment/${id}`,
      list: '/equipment',
      roomDefaults: (roomId: string) => `/rooms/${roomId}/default-equipment`,
    },
    events: {
      byId: (id: string) => `/events/${id}`,
      list: '/events',
    },
    reservations: {
      byId: (id: string) => `/reservations/${id}`,
    },
    rooms: {
      byId: (id: string) => `/rooms/${id}`,
      tables: (roomId: string) => `/rooms/${roomId}/tables`,
      list: '/rooms',
    },
    users: {
      activationLink: (id: string) => `/users/${id}/activation-link`,
      byId: (id: string) => `/users/${id}`,
      import: '/users/import',
      list: '/users',
      recoveryLink: (id: string) => `/users/${id}/recovery-link`,
    },
  },
}))

import { useAdminUpdateUser } from '@/lib/hooks/use-admin'
import { useCreateReservation } from '@/lib/hooks/use-reservations'

describe('mutation invalidation loading state', () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockClear()
    mocks.useMutation.mockClear()
  })

  it('keeps admin mutation pending until invalidation resolves', async () => {
    const { result } = renderHook(() => useAdminUpdateUser())

    const onSuccessResult = (result.current as any).onSuccess()

    expect(onSuccessResult).toBeInstanceOf(Promise)
    await onSuccessResult
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['admin', 'users'] })
  })

  it('keeps reservation creation pending until all invalidations resolve', async () => {
    const { result } = renderHook(() => useCreateReservation())

    const onSuccessResult = (result.current as any).onSuccess({
      tableId: 'table-1',
      date: '2026-06-17',
    })

    expect(onSuccessResult).toBeInstanceOf(Promise)
    await onSuccessResult
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(4)
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reservations', 'my'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reservations', 'table', 'table-1', '2026-06-17'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['availability', 'table-1', '2026-06-17'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['availability', 'room'] })
  })
})
