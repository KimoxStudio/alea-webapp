// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'

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

vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-qr-png-data')),
  },
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

  it('uploadToStorage() preserves structured diagnostic fields (name, status, statusCode) from a StorageApiError-like error, not just message', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr')
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

    const mockError = {
      name: 'StorageApiError',
      message: 'The resource already exists',
      status: 409,
      statusCode: '409',
    }
    const mockUpload = vi.fn().mockResolvedValue({ error: mockError })
    const mockFrom = vi.fn(() => ({ upload: mockUpload }))
    const mockStorage = { from: mockFrom }

    vi.mocked(createSupabaseServerAdminClient).mockReturnValue({
      storage: mockStorage,
    } as never)

    const testBuffer = new Uint8Array([1, 2, 3])
    const result = await uploadToStorage('test-bucket', 'test/path.png', testBuffer)

    expect(result.error).toEqual({
      name: 'StorageApiError',
      message: 'The resource already exists',
      status: 409,
      statusCode: '409',
    })
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

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
}))

describe('lib/storage/qr/vercel-blob (F3 adapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploadToStorage() calls put() with pathname joined from bucket+path', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { put } = await import('@vercel/blob')

    vi.mocked(put).mockResolvedValue({} as never)

    const buffer = Buffer.from([1, 2, 3])
    await uploadToStorage('my-bucket', 'path/to/file.png', buffer)

    expect(vi.mocked(put)).toHaveBeenCalledWith(
      'my-bucket/path/to/file.png',
      buffer,
      expect.objectContaining({ access: 'public' }),
    )
  })

  it('uploadToStorage() maps options.upsert to allowOverwrite', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { put } = await import('@vercel/blob')

    vi.mocked(put).mockResolvedValue({} as never)

    const buffer = Buffer.from([1, 2, 3])
    await uploadToStorage('bucket', 'path.png', buffer, { upsert: true })

    const callArgs = vi.mocked(put).mock.calls[0]
    expect(callArgs[2]?.allowOverwrite).toBe(true)
  })

  it('uploadToStorage() defaults upsert to false (allowOverwrite: false)', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { put } = await import('@vercel/blob')

    vi.mocked(put).mockResolvedValue({} as never)

    const buffer = Buffer.from([1, 2, 3])
    await uploadToStorage('bucket', 'path.png', buffer)

    const callArgs = vi.mocked(put).mock.calls[0]
    expect(callArgs[2]?.allowOverwrite).toBe(false)
  })

  it('uploadToStorage() forwards contentType option', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { put } = await import('@vercel/blob')

    vi.mocked(put).mockResolvedValue({} as never)

    const buffer = Buffer.from([1, 2, 3])
    await uploadToStorage('bucket', 'path.png', buffer, { contentType: 'image/png' })

    const callArgs = vi.mocked(put).mock.calls[0]
    expect(callArgs[2]?.contentType).toBe('image/png')
  })

  it('uploadToStorage() converts Uint8Array to Buffer before put()', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { put } = await import('@vercel/blob')

    vi.mocked(put).mockResolvedValue({} as never)

    const uint8Array = new Uint8Array([1, 2, 3])
    await uploadToStorage('bucket', 'path.png', uint8Array)

    const callArgs = vi.mocked(put).mock.calls[0]
    const passedBody = callArgs[1]
    expect(Buffer.isBuffer(passedBody)).toBe(true)
  })

  it('uploadToStorage() returns { error: null } on success', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { put } = await import('@vercel/blob')

    vi.mocked(put).mockResolvedValue({} as never)

    const result = await uploadToStorage('bucket', 'path.png', Buffer.from([1, 2, 3]))

    expect(result).toEqual({ error: null })
  })

  it('uploadToStorage() wraps Vercel Blob errors with structured fields', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { put } = await import('@vercel/blob')

    const blobError = {
      name: 'BlobError',
      message: 'Upload failed',
      status: 500,
      statusCode: '500',
    }
    vi.mocked(put).mockRejectedValue(blobError)

    const result = await uploadToStorage('bucket', 'path.png', Buffer.from([1, 2, 3]))

    expect(result.error).toEqual({
      name: 'BlobError',
      message: 'Upload failed',
      status: 500,
      statusCode: '500',
    })
  })

  it('uploadToStorage() handles errors with partial fields (only message for non-object errors)', async () => {
    const { uploadToStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { put } = await import('@vercel/blob')

    vi.mocked(put).mockRejectedValue(new Error('Network timeout'))

    const result = await uploadToStorage('bucket', 'path.png', Buffer.from([1, 2, 3]))

    expect(result.error?.message).toBe('Network timeout')
  })

  it('getPublicStorageUrl() returns null when BLOB_PUBLIC_BASE_URL is unset', async () => {
    const { getPublicStorageUrl } = await import('@/lib/storage/qr/vercel-blob')

    const originalEnv = process.env.BLOB_PUBLIC_BASE_URL
    delete process.env.BLOB_PUBLIC_BASE_URL

    const result = getPublicStorageUrl('bucket', 'path.png')

    expect(result.publicUrl).toBeNull()

    process.env.BLOB_PUBLIC_BASE_URL = originalEnv
  })

  it('getPublicStorageUrl() constructs URL from BLOB_PUBLIC_BASE_URL + encoded pathname', async () => {
    const { getPublicStorageUrl } = await import('@/lib/storage/qr/vercel-blob')

    const originalEnv = process.env.BLOB_PUBLIC_BASE_URL
    process.env.BLOB_PUBLIC_BASE_URL = 'https://example.public.blob.vercel-storage.com'

    const result = getPublicStorageUrl('my-bucket', 'file.png')

    expect(result.publicUrl).toBe('https://example.public.blob.vercel-storage.com/my-bucket/file.png')

    process.env.BLOB_PUBLIC_BASE_URL = originalEnv
  })

  it('getPublicStorageUrl() encodes pathname segments with encodeURIComponent (spaces -> %20)', async () => {
    const { getPublicStorageUrl } = await import('@/lib/storage/qr/vercel-blob')

    const originalEnv = process.env.BLOB_PUBLIC_BASE_URL
    process.env.BLOB_PUBLIC_BASE_URL = 'https://example.public.blob.vercel-storage.com'

    const result = getPublicStorageUrl('bucket', 'path/file with spaces.png')

    // Each segment of path should be encoded: 'path' -> 'path', 'file with spaces.png' -> 'file%20with%20spaces.png'
    expect(result.publicUrl).toBe('https://example.public.blob.vercel-storage.com/bucket/path/file%20with%20spaces.png')

    process.env.BLOB_PUBLIC_BASE_URL = originalEnv
  })

  it('getPublicStorageUrl() encodes special URL-reserved characters in pathname segments (# -> %23, ? -> %3F)', async () => {
    const { getPublicStorageUrl } = await import('@/lib/storage/qr/vercel-blob')

    const originalEnv = process.env.BLOB_PUBLIC_BASE_URL
    process.env.BLOB_PUBLIC_BASE_URL = 'https://example.public.blob.vercel-storage.com'

    const result = getPublicStorageUrl('bucket', 'path/file#with?special.png')

    // '#' -> '%23', '?' -> '%3F'
    expect(result.publicUrl).toBe('https://example.public.blob.vercel-storage.com/bucket/path/file%23with%3Fspecial.png')

    process.env.BLOB_PUBLIC_BASE_URL = originalEnv
  })

  it('getPublicStorageUrl() preserves / path separators when encoding (does not encode the slashes themselves)', async () => {
    const { getPublicStorageUrl } = await import('@/lib/storage/qr/vercel-blob')

    const originalEnv = process.env.BLOB_PUBLIC_BASE_URL
    process.env.BLOB_PUBLIC_BASE_URL = 'https://example.public.blob.vercel-storage.com'

    const result = getPublicStorageUrl('bucket', 'deep/nested/path/file.png')

    // Path separators should NOT be encoded
    expect(result.publicUrl).toBe('https://example.public.blob.vercel-storage.com/bucket/deep/nested/path/file.png')

    process.env.BLOB_PUBLIC_BASE_URL = originalEnv
  })

  it('getPublicStorageUrl() strips trailing slashes from base URL and bucket', async () => {
    const { getPublicStorageUrl } = await import('@/lib/storage/qr/vercel-blob')

    const originalEnv = process.env.BLOB_PUBLIC_BASE_URL
    process.env.BLOB_PUBLIC_BASE_URL = 'https://example.public.blob.vercel-storage.com/'

    const result = getPublicStorageUrl('bucket/', 'file.png')

    expect(result.publicUrl).toBe('https://example.public.blob.vercel-storage.com/bucket/file.png')

    process.env.BLOB_PUBLIC_BASE_URL = originalEnv
  })

  it('removeFromStorage() calls del() with pathname array', async () => {
    const { removeFromStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { del } = await import('@vercel/blob')

    vi.mocked(del).mockResolvedValue({} as never)

    const paths = ['path1.png', 'path2.png']
    await removeFromStorage('my-bucket', paths)

    const expectedPathnames = ['my-bucket/path1.png', 'my-bucket/path2.png']
    expect(vi.mocked(del)).toHaveBeenCalledWith(expectedPathnames)
  })

  it('removeFromStorage() returns { error: null } on success', async () => {
    const { removeFromStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { del } = await import('@vercel/blob')

    vi.mocked(del).mockResolvedValue({} as never)

    const result = await removeFromStorage('bucket', ['path.png'])

    expect(result).toEqual({ error: null })
  })

  it('removeFromStorage() wraps Vercel Blob del() errors with structured fields', async () => {
    const { removeFromStorage } = await import('@/lib/storage/qr/vercel-blob')
    const { del } = await import('@vercel/blob')

    const blobError = {
      name: 'BlobError',
      message: 'Delete failed',
      status: 404,
      statusCode: '404',
    }
    vi.mocked(del).mockRejectedValue(blobError)

    const result = await removeFromStorage('bucket', ['missing.png'])

    expect(result.error).toEqual({
      name: 'BlobError',
      message: 'Delete failed',
      status: 404,
      statusCode: '404',
    })
  })
})

/**
 * Integration test documenting the current state of lib/server/tables/tables-service.ts.
 *
 * As of KIM-421, the QR code URL construction in tables-service.ts::uploadQrCodeToStorage()
 * still manually builds Supabase Storage URLs from NEXT_PUBLIC_SUPABASE_URL directly
 * (line 33: `${supabaseUrl}/storage/v1/object/public/table-qr-codes/${storagePath}`)
 * instead of calling getPublicStorageUrl() from the storage seam.
 *
 * This test documents that this gap is INTENTIONAL for the inert F3 scaffold:
 * - F3 introduces the Vercel Blob adapter (vercel-blob.ts) in parallel
 * - But does NOT yet activate it or refactor call sites
 * - Refactoring tables-service.ts to use getPublicStorageUrl() belongs to the REAL F3
 *   cutover step (a separate, user/infra-gated change requiring BLOB_READ_WRITE_TOKEN)
 * - This test WILL FAIL once that cutover refactors the call site (expected — that's
 *   the signal to remove/update this test as part of cutover completion)
 *
 * See: lib/storage/qr/vercel-blob.ts doc comment for full context on F3 scaffold goals.
 */

/**
 * Integration test documenting the current state of lib/server/tables/tables-service.ts
 * QR code URL construction (F3 scaffold - intentional gap).
 *
 * As of KIM-421, the QR code URL in tables-service.ts::uploadQrCodeToStorage()
 * is still manually built from NEXT_PUBLIC_SUPABASE_URL directly
 * (line 33: `${supabaseUrl}/storage/v1/object/public/table-qr-codes/${storagePath}`)
 * instead of calling getPublicStorageUrl() from the storage seam.
 *
 * This test exercises the REAL generateTableQrCode() call path to document
 * and defend this gap:
 * - F3 introduces the Vercel Blob adapter (vercel-blob.ts) in parallel
 * - But does NOT yet activate it or refactor call sites
 * - The refactoring belongs to the F3 CUTOVER step (separate, user/infra-gated,
 *   requiring BLOB_READ_WRITE_TOKEN)
 * - This test WILL FAIL (expected signal to remove/update as part of cutover)
 *
 * See: lib/storage/qr/vercel-blob.ts doc comment for full F3 scaffold context.
 */
describe('lib/server/tables/tables-service (QR call-site URL construction gap)', () => {
  it('exercises real generateTableQrCode() call path: uploadToStorage() IS called, getPublicStorageUrl() is NOT', async () => {
    // Import and configure mocks for the real dependencies
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    const storageQr = await import('@/lib/storage/qr')

    // Set up environment for the call path
    const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'

    // Configure the Supabase admin client mock so uploadToStorage() can succeed
    const mockUpload = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn(() => ({ upload: mockUpload }))
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue({
      storage: { from: mockFrom },
    } as never)

    // Spy on getPublicStorageUrl to verify it's NOT called (documenting the gap)
    const getPublicStorageUrlSpy = vi.spyOn(storageQr, 'getPublicStorageUrl')

    try {
      // Import and call the real generateTableQrCode() function
      // This exercises the full call path: generateTableQrCode → uploadQrCodeToStorage → uploadToStorage
      const tablesService = await import('@/lib/server/tables/tables-service')
      const tableId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

      const result = await tablesService.generateTableQrCode(tableId)

      // Assertions documenting the current (F3 scaffold) state:

      // 1. The seam's uploadToStorage() WAS called (real code path exercises it)
      expect(mockFrom).toHaveBeenCalledWith('table-qr-codes')
      expect(mockUpload).toHaveBeenCalledWith(
        `${tableId}.png`,
        expect.any(Buffer),
        expect.objectContaining({ contentType: 'image/png', upsert: true })
      )

      // 2. The seam's getPublicStorageUrl() was NOT called (gap: manual URL construction)
      expect(getPublicStorageUrlSpy).not.toHaveBeenCalled()

      // 3. The returned URL matches the manual construction pattern
      expect(result).toMatch(/^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/table-qr-codes\/a1b2c3d4-e5f6-7890-abcd-ef1234567890\.png$/)
    } finally {
      getPublicStorageUrlSpy.mockRestore()
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
    }
  })
})

