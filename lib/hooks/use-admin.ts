'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { User, Room, GameTable, Reservation, PaginatedResponse, AdminEvent } from '@/lib/types'
import { apiClient } from '@/lib/api/client'
import { endpoints } from '@/lib/api/endpoints'

// ----- Users -----

export function useAdminUsers(page: number, limit: number, search: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) params.set('search', search)
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['admin', 'users', page, limit, search],
    queryFn: () => apiClient.get<PaginatedResponse<User>>(`${endpoints.users.list}?${params.toString()}`),
    staleTime: 30_000,
  })
}

export function useAdminUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { memberNumber?: string; role?: string; is_active?: boolean; status?: 'active' | 'suspended' } }) =>
      apiClient.put<User>(endpoints.users.byId(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useAdminDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(endpoints.users.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

// ----- Reservations -----

export function useAdminReservations(userId?: string | null, date?: string | null) {
  const params = new URLSearchParams()
  if (userId) params.set('userId', userId)
  if (date) params.set('date', date)
  const query = params.toString()
  return useQuery<Reservation[]>({
    queryKey: ['admin', 'reservations', userId, date],
    queryFn: () => apiClient.get<Reservation[]>(endpoints.reservations.list(query ? Object.fromEntries(params) : undefined)),
    staleTime: 30_000,
  })
}

export function useAdminCancelReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.put<Reservation>(endpoints.reservations.byId(id), { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reservations'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

// ----- Rooms -----

export function useAdminRooms() {
  return useQuery<Room[]>({
    queryKey: ['admin', 'rooms'],
    queryFn: () => apiClient.get<Room[]>(endpoints.rooms.list),
    staleTime: 60_000,
  })
}

export function useAdminUpdateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; tableCount?: number } }) =>
      apiClient.put<Room>(endpoints.rooms.byId(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useAdminCreateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; tableCount: number }) =>
      apiClient.post<Room>(endpoints.rooms.list, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useAdminRoomTables(roomId: string | null) {
  return useQuery<GameTable[]>({
    queryKey: ['admin', 'rooms', roomId, 'tables'],
    queryFn: () => apiClient.get<GameTable[]>(endpoints.rooms.tables(roomId!)),
    enabled: !!roomId,
    staleTime: 60_000,
  })
}

export function useAdminCreateTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, data }: { roomId: string; data: { name: string; type: string } }) =>
      apiClient.post<GameTable>(endpoints.rooms.tables(roomId), data),
    onSuccess: (_created, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms', variables.roomId, 'tables'] })
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.roomId, 'tables'] })
    },
  })
}

// ----- Events -----

export function useAdminEvents() {
  return useQuery<AdminEvent[]>({
    queryKey: ['admin', 'events'],
    queryFn: () => apiClient.get<AdminEvent[]>(endpoints.events.list),
    staleTime: 30_000,
  })
}

export function useAdminCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; description?: string | null; date: string; startTime: string; endTime: string; roomId?: string | null }) =>
      apiClient.post<AdminEvent>(endpoints.events.list, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
    },
  })
}

export function useAdminUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; description?: string | null; date?: string; startTime?: string; endTime?: string; roomId?: string | null } }) =>
      apiClient.put<AdminEvent>(endpoints.events.byId(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
    },
  })
}

export function useAdminDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(endpoints.events.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
    },
  })
}

export function useAdminRegenerateTableQr() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tableId }: { tableId: string; roomId: string }) =>
      apiClient.post<{ qr_code: string; qr_code_inf: string | null }>(`/tables/${tableId}/qr`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms', variables.roomId, 'tables'] })
    },
  })
}
