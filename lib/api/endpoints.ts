export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  users: {
    list: '/users',
    byId: (id: string) => `/users/${id}`,
  },
  rooms: {
    list: '/rooms',
    byId: (id: string) => `/rooms/${id}`,
    tables: (roomId: string) => `/rooms/${roomId}/tables`,
    tablesAvailability: (roomId: string, date: string) => `/rooms/${roomId}/tables/availability?date=${date}`,
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
  events: {
    list: '/events',
    byId: (id: string) => `/events/${id}`,
  },
} as const
