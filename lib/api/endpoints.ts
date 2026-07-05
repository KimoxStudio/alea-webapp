export const endpoints = {
  auth: {
    activate: '/auth/activate',
    recover: '/auth/recover',
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  users: {
    list: '/users',
    byId: (id: string) => `/users/${id}`,
    activationLink: (id: string) => `/users/${id}/activation-link`,
    recoveryLink: (id: string) => `/users/${id}/recovery-link`,
    import: '/users/import',
  },
  rooms: {
    list: '/rooms',
    byId: (id: string) => `/rooms/${id}`,
    tables: (roomId: string) => `/rooms/${roomId}/tables`,
    tablesAvailability: (roomId: string, date: string) => `/rooms/${roomId}/tables/availability?date=${date}`,
    availableEquipment: (roomId: string, date: string, startTime: string, endTime: string) =>
      `/rooms/${roomId}/available-equipment?date=${date}&startTime=${startTime}&endTime=${endTime}`,
  },
  tables: {
    byId: (id: string) => `/tables/${id}`,
    availability: (id: string, date: string) => `/tables/${id}/availability?date=${date}`,
  },
  reservations: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : ''
      return `/reservations${query}`
    },
    byId: (id: string) => `/reservations/${id}`,
  },
  savedGames: {
    list: '/saved-games',
    renew: (id: string) => `/saved-games/${id}/renew`,
  },
  // OIR-208 review (Finding 2): legacy internal-events surface — no
  // component consumes the hooks built on top of these paths anymore (see
  // lib/hooks/use-admin.ts). Kept only because existing route/service tests
  // exercise it directly; see the divergence-risk comments in
  // app/api/events/route.ts and app/api/events/[id]/route.ts.
  events: {
    list: '/events',
    byId: (id: string) => `/events/${id}`,
    preview: '/events/preview',
  },
  clubEvents: {
    list: '/club-events',
    byId: (id: string) => `/club-events/${id}`,
  },
  partners: {
    list: '/partners',
    byId: (id: string) => `/partners/${id}`,
  },
  libraryGames: {
    list: '/library-games',
    byId: (id: string) => `/library-games/${id}`,
  },
  equipment: {
    list: '/equipment',
    byId: (id: string) => `/equipment/${id}`,
    roomDefaults: (roomId: string) => `/rooms/${roomId}/default-equipment`,
  },
  uploads: {
    create: '/admin/uploads',
  },
} as const
