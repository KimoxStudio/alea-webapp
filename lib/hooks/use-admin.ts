'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { User, Room, GameTable, Reservation, PaginatedResponse, AdminEvent, MemberImportResult, Equipment } from '@/lib/types'
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
    mutationFn: ({ id, data }: {
      id: string
      data: {
        memberNumber?: string
        fullName?: string
        email?: string
        phone?: string
        role?: string
        is_active?: boolean
        status?: 'active' | 'suspended'
      }
    }) =>
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

export function useAdminPatchUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'reset_no_shows' | 'unblock' }) =>
      apiClient.patch<void>(endpoints.users.byId(id), { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useAdminGenerateActivationLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, locale }: { id: string; locale?: string }) =>
      apiClient.post<{ activationLink: string; expiresAt: string }>(endpoints.users.activationLink(id), { locale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useAdminGenerateRecoveryLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, locale }: { id: string; locale?: string }) =>
      apiClient.post<{ recoveryLink: string; expiresAt: string }>(endpoints.users.recoveryLink(id), { locale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useAdminImportUsers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiClient.post<MemberImportResult>(endpoints.users.import, formData)
    },
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
    mutationFn: (data: { title: string; description?: string | null; date: string; startTime?: string; endTime?: string; roomId?: string | null; allDay?: boolean }) =>
      apiClient.post<AdminEvent>(endpoints.events.list, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
    },
  })
}

export function useAdminUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; description?: string | null; date?: string; startTime?: string; endTime?: string; roomId?: string | null; allDay?: boolean } }) =>
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

// ----- Equipment -----

export function useAdminEquipment() {
  return useQuery<Equipment[]>({
    queryKey: ['admin', 'equipment'],
    queryFn: () => apiClient.get<Equipment[]>(endpoints.equipment.list),
    staleTime: 60_000,
  })
}

export function useAdminCreateEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiClient.post<Equipment>(endpoints.equipment.list, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipment'] })
    },
  })
}

export function useAdminUpdateEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string | null } }) =>
      apiClient.put<Equipment>(endpoints.equipment.byId(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipment'] })
    },
  })
}

export function useAdminDeleteEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(endpoints.equipment.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipment'] })
    },
  })
}

export function useAdminRoomDefaultEquipment(roomId: string | null) {
  return useQuery<Equipment[]>({
    queryKey: ['admin', 'rooms', roomId, 'default-equipment'],
    queryFn: () => apiClient.get<Equipment[]>(endpoints.equipment.roomDefaults(roomId!)),
    enabled: !!roomId,
    staleTime: 60_000,
  })
}

export function useAdminSetRoomDefaultEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, equipmentIds }: { roomId: string; equipmentIds: string[] }) =>
      apiClient.put<void>(endpoints.equipment.roomDefaults(roomId), { equipmentIds }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms', variables.roomId, 'default-equipment'] })
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
