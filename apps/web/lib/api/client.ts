const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

class ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
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
  delete<T>(path: string, options?: RequestInit) { return this.request<T>(path, { method: 'DELETE', ...options }) }
}

export const apiClient = new ApiClient(API_BASE_URL)
