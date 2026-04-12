const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CSRF_COOKIE_NAME = 'alea-csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

function getCookieValue(name: string) {
  if (typeof document === 'undefined') return null

  const prefixedCookie = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))

  if (!prefixedCookie) return null
  return decodeURIComponent(prefixedCookie.slice(name.length + 1))
}

class ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const method = (options?.method ?? 'GET').toUpperCase()
    const csrfToken = UNSAFE_METHODS.has(method) ? getCookieValue(CSRF_COOKIE_NAME) : null

    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
        ...options?.headers,
      },
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText, statusCode: response.status }))
      throw error
    }
    if (response.status === 204) return undefined as T
    return response.json()
  }

  get<T>(path: string, options?: RequestInit) { return this.request<T>(path, { method: 'GET', ...options }) }
  post<T>(path: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...options })
  }
  put<T>(path: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, ...options })
  }
  patch<T>(path: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, ...options })
  }
  delete<T>(path: string, options?: RequestInit) { return this.request<T>(path, { method: 'DELETE', ...options }) }
}

export const apiClient = new ApiClient(API_BASE_URL)
