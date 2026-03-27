import { useQuery } from '@tanstack/react-query'
import type { Room } from '@alea/types'
import { apiClient } from '@/lib/api/client'

export function useRooms() {
  return useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => apiClient.get<Room[]>('/rooms'),
  })
}

export function useRoomTables(roomId: string | null) {
  return useQuery({
    queryKey: ['rooms', roomId, 'tables'],
    queryFn: () => apiClient.get<import('@alea/types').GameTable[]>(`/rooms/${roomId}/tables`),
    enabled: !!roomId,
  })
}
