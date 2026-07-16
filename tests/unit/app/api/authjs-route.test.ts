// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const handlersGetMock = vi.fn()
const handlersPostMock = vi.fn()

vi.mock('@/lib/authjs/auth', () => ({
  handlers: {
    GET: handlersGetMock,
    POST: handlersPostMock,
  },
}))

describe('Auth.js route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  describe('AUTH_JS_ENABLED guard', () => {
    it('returns 404 when AUTH_JS_ENABLED is unset', async () => {
      // AUTH_JS_ENABLED is unset by default
      const { GET, POST } = await import('@/app/api/authjs/[...nextauth]/route')

      const getResponse = await GET(new NextRequest('http://localhost:3000/api/authjs/signin'))
      expect(getResponse.status).toBe(404)
      expect(handlersGetMock).not.toHaveBeenCalled()

      const postResponse = await POST(new NextRequest('http://localhost:3000/api/authjs/signin', {
        method: 'POST',
      }))
      expect(postResponse.status).toBe(404)
      expect(handlersPostMock).not.toHaveBeenCalled()
    })

    it('returns 404 when AUTH_JS_ENABLED is false', async () => {
      vi.stubEnv('AUTH_JS_ENABLED', 'false')
      const { GET, POST } = await import('@/app/api/authjs/[...nextauth]/route')

      const getResponse = await GET(new NextRequest('http://localhost:3000/api/authjs/signin'))
      expect(getResponse.status).toBe(404)
      expect(handlersGetMock).not.toHaveBeenCalled()

      const postResponse = await POST(new NextRequest('http://localhost:3000/api/authjs/signin', {
        method: 'POST',
      }))
      expect(postResponse.status).toBe(404)
      expect(handlersPostMock).not.toHaveBeenCalled()
    })

    it('returns 404 when AUTH_JS_ENABLED is any value other than "true"', async () => {
      vi.stubEnv('AUTH_JS_ENABLED', 'yes')
      const { GET, POST } = await import('@/app/api/authjs/[...nextauth]/route')

      const getResponse = await GET(new NextRequest('http://localhost:3000/api/authjs/signin'))
      expect(getResponse.status).toBe(404)
      expect(handlersGetMock).not.toHaveBeenCalled()

      const postResponse = await POST(new NextRequest('http://localhost:3000/api/authjs/signin', {
        method: 'POST',
      }))
      expect(postResponse.status).toBe(404)
      expect(handlersPostMock).not.toHaveBeenCalled()
    })

    it('delegates to handlers.GET when AUTH_JS_ENABLED is "true"', async () => {
      vi.stubEnv('AUTH_JS_ENABLED', 'true')
      const mockResponse = new NextResponse(JSON.stringify({ status: 'ok' }), { status: 200 })
      handlersGetMock.mockResolvedValueOnce(mockResponse)

      const { GET } = await import('@/app/api/authjs/[...nextauth]/route')
      const request = new NextRequest('http://localhost:3000/api/authjs/signin')
      const response = await GET(request)

      expect(handlersGetMock).toHaveBeenCalledWith(request)
      expect(response).toBe(mockResponse)
    })

    it('delegates to handlers.POST when AUTH_JS_ENABLED is "true"', async () => {
      vi.stubEnv('AUTH_JS_ENABLED', 'true')
      const mockResponse = new NextResponse(JSON.stringify({ status: 'ok' }), { status: 200 })
      handlersPostMock.mockResolvedValueOnce(mockResponse)

      const { POST } = await import('@/app/api/authjs/[...nextauth]/route')
      const request = new NextRequest('http://localhost:3000/api/authjs/signin', {
        method: 'POST',
      })
      const response = await POST(request)

      expect(handlersPostMock).toHaveBeenCalledWith(request)
      expect(response).toBe(mockResponse)
    })
  })
})
