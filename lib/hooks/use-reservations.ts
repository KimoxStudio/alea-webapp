import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { AvailableEquipment, Reservation, CreateReservationRequest, CreateSavedGameRequest, SavedGame, TableAvailability } from '@/lib/types'
import { apiClient } from '@/lib/api/client'
import { endpoints } from '@/lib/api/endpoints'

type ReservationMutationError = {
  statusCode?: number
  message?: string
}

export function useMyReservations(userId: string | null) {
  return useQuery<Reservation[]>({
    queryKey: ['reservations', 'my', userId],
    queryFn: () => apiClient.get<Reservation[]>(`/reservations?userId=${userId}`),
    enabled: !!userId,
    placeholderData: keepPreviousData,
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
    queryFn: () => apiClient.get<TableAvailability>(endpoints.tables.availability(tableId!, date!)),
    enabled: !!tableId && !!date,
    staleTime: 0,
    refetchInterval: 30_000,
  })
}

export function useRoomAvailability(roomId: string | null, date: string | null) {
  return useQuery<Record<string, TableAvailability>>({
    queryKey: ['availability', 'room', roomId, date],
    queryFn: () => apiClient.get<Record<string, TableAvailability>>(endpoints.rooms.tablesAvailability(roomId!, date!)),
    enabled: !!roomId && !!date,
    staleTime: 0,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })
}

export function useAvailableRoomEquipment(
  roomId: string | null,
  date: string | null,
  startTime: string | null,
  endTime: string | null,
) {
  return useQuery<AvailableEquipment[]>({
    queryKey: ['rooms', roomId, 'available-equipment', date, startTime, endTime],
    queryFn: () => apiClient.get<AvailableEquipment[]>(
      endpoints.rooms.availableEquipment(roomId!, date!, startTime!, endTime!),
    ),
    enabled: !!roomId && !!date && !!startTime && !!endTime,
    staleTime: 0,
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateReservationRequest) =>
      apiClient.post<Reservation>('/reservations', data),
    onSuccess: (created) => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reservations', 'my'] }),
      queryClient.invalidateQueries({ queryKey: ['reservations', 'table', created.tableId, created.date] }),
      queryClient.invalidateQueries({ queryKey: ['availability', created.tableId, created.date] }),
      queryClient.invalidateQueries({ queryKey: ['availability', 'room'] }),
    ]),
    onError: (error: ReservationMutationError, variables) => {
      if (error.statusCode !== 409) return

      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['availability', variables.tableId, variables.date] }),
        queryClient.invalidateQueries({ queryKey: ['availability', 'room'] }),
      ])
    },
  })
}

export function useCancelReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.put<Reservation>(`/reservations/${id}`, { status: 'cancelled' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

export function useMySavedGames(userId: string | null) {
  return useQuery<SavedGame[]>({
    queryKey: ['saved-games', 'my', userId],
    queryFn: () => apiClient.get<SavedGame[]>(endpoints.savedGames.list),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  })
}

export function useCreateSavedGame() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSavedGameRequest) => apiClient.post<SavedGame>(endpoints.savedGames.list, data),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['saved-games'] }),
      queryClient.invalidateQueries({ queryKey: ['availability'] }),
    ]),
  })
}

export function useRenewSavedGame() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post<SavedGame>(endpoints.savedGames.renew(id), {}),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['saved-games'] }),
      queryClient.invalidateQueries({ queryKey: ['availability'] }),
    ]),
  })
}
