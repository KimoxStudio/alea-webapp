import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { Room } from '@/lib/types'
import { apiClient } from '@/lib/api/client'

export function useRooms() {
  return useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => apiClient.get<Room[]>('/rooms'),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}

export function useRoomTables(roomId: string | null) {
  return useQuery({
    queryKey: ['rooms', roomId, 'tables'],
    queryFn: () => apiClient.get<import('@/lib/types').GameTable[]>(`/rooms/${roomId}/tables`),
    enabled: !!roomId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}
