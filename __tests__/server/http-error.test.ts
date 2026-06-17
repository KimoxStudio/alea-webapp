// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ServiceError } from '@/lib/server/service-error'
import { toServiceErrorResponse } from '@/lib/server/http-error'

describe('toServiceErrorResponse', () => {
  it('converts ServiceError to a response with the correct message and status code', async () => {
    const error = new ServiceError('Not found', 404)
    const response = toServiceErrorResponse(error)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      message: 'Not found',
      statusCode: 404,
    })
  })

  it('falls back to a 500 response for unknown errors', async () => {
    const response = toServiceErrorResponse(new Error('boom'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      message: 'Internal server error',
      statusCode: 500,
    })
  })
})
