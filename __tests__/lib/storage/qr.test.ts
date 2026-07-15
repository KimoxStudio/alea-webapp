// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

/**
 * Smoke test for the lib/storage/qr seam (F0-07).
 *
 * This is a pure indirection layer over lib/supabase/server's admin storage
 * client — the goal here is only to lock in that uploadToStorage(),
 * getPublicStorageUrl(), and removeFromStorage() route to the correct
 * underlying Supabase Storage admin client methods, so a future regression
 * (e.g. accidentally using a user-scoped client or wrong method) is caught
 * immediately.
 *
 * For F0 this seam remains a thin wrapper around Supabase Storage admin calls
 * with zero behavior change. Storage backend swaps (e.g. to Vercel Blob) happen
 * in later phases; this test ensures the seam correctly preserves today's
 * call signatures and error shapes.
 */

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
        remove: vi.fn(),
      })),
    },
  })),
}))

describe('lib/storage/qr seam', () => {
  it('uploadToStorage() calls admin.storage.from(bucket).upload() with preserved options', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr')
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

    const mockUpload = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn(() => ({ upload: mockUpload }))
    const mockStorage = { from: mockFrom }

    vi.mocked(createSupabaseServerAdminClient).mockReturnValue({
      storage: mockStorage,
    } as never)

    const testBuffer = new Uint8Array([1, 2, 3])
    const result = await uploadToStorage('test-bucket', 'test/path.png', testBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    expect(mockFrom).toHaveBeenCalledWith('test-bucket')
    expect(mockUpload).toHaveBeenCalledWith('test/path.png', testBuffer, {
      contentType: 'image/png',
      upsert: true,
    })
    expect(result.error).toBeNull()
  })

  it('uploadToStorage() wraps Supabase Storage upload errors', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr')
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

    const mockError = { message: 'Upload failed' }
    const mockUpload = vi.fn().mockResolvedValue({ error: mockError })
    const mockFrom = vi.fn(() => ({ upload: mockUpload }))
    const mockStorage = { from: mockFrom }

    vi.mocked(createSupabaseServerAdminClient).mockReturnValue({
      storage: mockStorage,
    } as never)

    const testBuffer = new Uint8Array([1, 2, 3])
    const result = await uploadToStorage('test-bucket', 'test/path.png', testBuffer)

    expect(result.error).toEqual({ message: 'Upload failed' })
  })

  it('uploadToStorage() defaults upsert to false', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr')
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

    const mockUpload = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn(() => ({ upload: mockUpload }))
    const mockStorage = { from: mockFrom }

    vi.mocked(createSupabaseServerAdminClient).mockReturnValue({
      storage: mockStorage,
    } as never)

    const testBuffer = new Uint8Array([1, 2, 3])
    await uploadToStorage('test-bucket', 'test/path.png', testBuffer)

    const callArgs = mockUpload.mock.calls[0]
    expect(callArgs[2].upsert).toBe(false)
  })

  it('getPublicStorageUrl() calls admin.storage.from(bucket).getPublicUrl() and extracts publicUrl', async () => {
    const { getPublicStorageUrl } = await import('@/lib/storage/qr')
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/public/path.png' },
    })
    const mockFrom = vi.fn(() => ({ getPublicUrl: mockGetPublicUrl }))
    const mockStorage = { from: mockFrom }

    vi.mocked(createSupabaseServerAdminClient).mockReturnValue({
      storage: mockStorage,
    } as never)

    const result = getPublicStorageUrl('test-bucket', 'test/path.png')

    expect(mockFrom).toHaveBeenCalledWith('test-bucket')
    expect(mockGetPublicUrl).toHaveBeenCalledWith('test/path.png')
    expect(result.publicUrl).toBe('https://example.com/public/path.png')
  })

  it('getPublicStorageUrl() returns null publicUrl when Supabase returns null', async () => {
    const { getPublicStorageUrl } = await import('@/lib/storage/qr')
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: null,
    })
    const mockFrom = vi.fn(() => ({ getPublicUrl: mockGetPublicUrl }))
    const mockStorage = { from: mockFrom }

    vi.mocked(createSupabaseServerAdminClient).mockReturnValue({
      storage: mockStorage,
    } as never)

    const result = getPublicStorageUrl('test-bucket', 'test/path.png')

    expect(result.publicUrl).toBeNull()
  })

  it('removeFromStorage() calls admin.storage.from(bucket).remove() with path array', async () => {
    const { removeFromStorage } = await import('@/lib/storage/qr')
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

    const mockRemove = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn(() => ({ remove: mockRemove }))
    const mockStorage = { from: mockFrom }

    vi.mocked(createSupabaseServerAdminClient).mockReturnValue({
      storage: mockStorage,
    } as never)

    const paths = ['path1.png', 'path2.png']
    const result = await removeFromStorage('test-bucket', paths)

    expect(mockFrom).toHaveBeenCalledWith('test-bucket')
    expect(mockRemove).toHaveBeenCalledWith(paths)
    expect(result.error).toBeNull()
  })

  it('removeFromStorage() wraps Supabase Storage remove errors', async () => {
    const { removeFromStorage } = await import('@/lib/storage/qr')
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

    const mockError = { message: 'Remove failed' }
    const mockRemove = vi.fn().mockResolvedValue({ error: mockError })
    const mockFrom = vi.fn(() => ({ remove: mockRemove }))
    const mockStorage = { from: mockFrom }

    vi.mocked(createSupabaseServerAdminClient).mockReturnValue({
      storage: mockStorage,
    } as never)

    const result = await removeFromStorage('test-bucket', ['path.png'])

    expect(result.error).toEqual({ message: 'Remove failed' })
  })
})
