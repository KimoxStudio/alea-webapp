import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Reservation, CreateReservationRequest, TableAvailability } from '@alea/types'
import { apiClient } from '@/lib/api/client'

export function useMyReservations(userId: string | null) {
  return useQuery<Reservation[]>({
    queryKey: ['reservations', 'my', userId],
    queryFn: () => apiClient.get<Reservation[]>(`/reservations?userId=${userId}`),
    enabled: !!userId,
  })
}

export function useTableReservations(tableId: string | null, date: string | null) {
  return useQuery<Reservation[]>({
    queryKey: ['reservations', 'table', tableId, date],
    queryFn: () => apiClient.get<Reservation[]>(`/reservations?tableId=${tableId}&date=${date}`),
    enabled: !!tableId && !!date,
  })
}

export function useTableAvailability(tableId: string | null, date: string | null) {
  return useQuery<TableAvailability>({
    queryKey: ['availability', tableId, date],
    queryFn: () => apiClient.get<TableAvailability>(`/tables/${tableId}/availability?date=${date}`),
    enabled: !!tableId && !!date,
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateReservationRequest) =>
      apiClient.post<Reservation>('/reservations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export function useCancelReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.put<Reservation>(`/reservations/${id}`, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}
