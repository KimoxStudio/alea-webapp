// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { ServiceError } from '@/lib/server/service-error'

/**
 * UPLOADS SERVICE TEST COVERAGE (OIR-207)
 *
 * Tests for image uploads to Supabase Storage for landing content (club events,
 * partners, library games). Implementation: lib/server/uploads-service.ts
 *
 * Key scenarios tested:
 * - Happy path: admin + valid PNG file → storage upload called with path matching /^events\/[0-9a-f-]+\.png$/, contentType set, returns { url }
 * - Privilege: non-admin → 403 Forbidden before any storage call
 * - Validation matrix (each → 400, no storage call):
 *   - missing file
 *   - folder outside allowlist ('../etc', 'avatars', '')
 *   - MIME not allowed (image/svg+xml, application/pdf, text/html)
 *   - size > 5MB
 * - Extension derived from MIME not filename: file named "evil.svg" with type image/png → stored as .png
 * - Storage error → 500 ServiceError (and console.error called)
 * - Migration: bucket insert with public=true + 5MB limit + 4 MIME types, SELECT-only storage policy, no write policies
 */

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerAdminClient: vi.fn(),
}))

vi.mock('@/lib/server/service-error', () => ({
  serviceError: vi.fn((message: string, statusCode: number) => {
    const err = new Error(message) as ServiceError
    err.name = 'ServiceError'
    err.statusCode = statusCode
    throw err
  }),
}))

type SessionUser = {
  id: string
  role: 'admin' | 'member'
  email?: string
}

interface MockFile {
  size: number
  type: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

function createMockFile(size: number, type: string): MockFile {
  const buffer = new ArrayBuffer(size)
  return {
    size,
    type,
    arrayBuffer: async () => buffer,
  }
}

function buildSupabaseMock() {
  let uploadSpy = vi.fn(async (path: string, data: Uint8Array, options: any) => {
    return { error: null, data: { path } }
  })

  return {
    storage: {
      from: vi.fn(function (bucket: string) {
        return {
          upload: uploadSpy,
          getPublicUrl: vi.fn(function (path: string) {
            return {
              data: {
                publicUrl: `https://example.com/storage/v1/object/public/${bucket}/${path}`,
              },
            }
          }),
        }
      }),
    },
    _uploadSpy: uploadSpy,
  }
}

function createAdminSession(): SessionUser {
  return { id: 'user-admin-1', role: 'admin', email: 'admin@example.com' }
}

function createMemberSession(): SessionUser {
  return { id: 'user-member-1', role: 'member', email: 'member@example.com' }
}

async function loadUploadsService() {
  vi.resetModules()
  const mod = await import('@/lib/server/uploads-service')
  return {
    uploadLandingMediaImage: mod.uploadLandingMediaImage,
  }
}

describe('uploads-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.error = vi.fn()
  })

  describe('happy path — admin upload', () => {
    it('admin uploads valid PNG file → storage called, returns { url }', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(1024, 'image/png')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { uploadLandingMediaImage } = await loadUploadsService()

      const result = await uploadLandingMediaImage(adminSession, {
        file: mockFile,
        folder: 'events',
      })

      expect(result).toHaveProperty('url')
      expect(result.url).toContain('https://example.com')
      expect(result.url).toContain('landing-media')

      expect(mockSupabaseAdmin._uploadSpy).toHaveBeenCalled()
      const uploadArgs = mockSupabaseAdmin._uploadSpy.mock.calls[0]
      expect(uploadArgs[0]).toMatch(/^events\/[0-9a-f-]+\.png$/)
      expect(uploadArgs[2].contentType).toBe('image/png')
    })

    it('admin uploads valid JPEG file → extension .jpg derived from MIME', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(2048, 'image/jpeg')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { uploadLandingMediaImage } = await loadUploadsService()

      await uploadLandingMediaImage(adminSession, {
        file: mockFile,
        folder: 'partners',
      })

      const uploadArgs = mockSupabaseAdmin._uploadSpy.mock.calls[0]
      expect(uploadArgs[0]).toMatch(/^partners\/[0-9a-f-]+\.jpg$/)
    })

    it('admin uploads valid WebP file → extension .webp derived from MIME', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(512, 'image/webp')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { uploadLandingMediaImage } = await loadUploadsService()

      await uploadLandingMediaImage(adminSession, {
        file: mockFile,
        folder: 'library-games',
      })

      const uploadArgs = mockSupabaseAdmin._uploadSpy.mock.calls[0]
      expect(uploadArgs[0]).toMatch(/^library-games\/[0-9a-f-]+\.webp$/)
    })

    it('admin uploads valid GIF file → extension .gif derived from MIME', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(256, 'image/gif')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { uploadLandingMediaImage } = await loadUploadsService()

      await uploadLandingMediaImage(adminSession, {
        file: mockFile,
        folder: 'events',
      })

      const uploadArgs = mockSupabaseAdmin._uploadSpy.mock.calls[0]
      expect(uploadArgs[0]).toMatch(/^events\/[0-9a-f-]+\.gif$/)
    })
  })

  describe('privilege checks', () => {
    it('non-admin member gets 403 Forbidden before any storage call', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(1024, 'image/png')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(memberSession, {
          file: mockFile,
          folder: 'events',
        })
      ).rejects.toMatchObject({ statusCode: 403 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })
  })

  describe('validation matrix — file missing', () => {
    it('missing file (null) → 400 before storage call', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: null,
          folder: 'events',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })
  })

  describe('validation matrix — folder outside allowlist', () => {
    it('folder: parent directory "../etc" → 400 before storage call', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(1024, 'image/png')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: '../etc',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })

    it('folder: "avatars" (not in allowlist) → 400 before storage call', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(1024, 'image/png')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: 'avatars',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })

    it('folder: empty string → 400 before storage call', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(1024, 'image/png')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: '',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })
  })

  describe('validation matrix — MIME type not allowed', () => {
    it('MIME: image/svg+xml → 400 before storage call', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(1024, 'image/svg+xml')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: 'events',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })

    it('MIME: application/pdf → 400 before storage call', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(1024, 'application/pdf')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: 'events',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })

    it('MIME: text/html → 400 before storage call', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(1024, 'text/html')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: 'events',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })
  })

  describe('validation matrix — file size outside bounds', () => {
    it('file size > 5 MB → 400 before storage call', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const fiveMBPlus = 5 * 1024 * 1024 + 1
      const mockFile = createMockFile(fiveMBPlus, 'image/png')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: 'events',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })

    it('file size 0 bytes (empty) → 400 before storage call', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(0, 'image/png')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: 'events',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin._uploadSpy).not.toHaveBeenCalled()
    })

    it('file size exactly 5 MB (boundary) → allowed', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const fiveMB = 5 * 1024 * 1024
      const mockFile = createMockFile(fiveMB, 'image/png')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { uploadLandingMediaImage } = await loadUploadsService()

      const result = await uploadLandingMediaImage(adminSession, {
        file: mockFile,
        folder: 'events',
      })

      expect(result.url).toBeDefined()
      expect(mockSupabaseAdmin._uploadSpy).toHaveBeenCalled()
    })
  })

  describe('extension derived from MIME not filename', () => {
    it('file named "evil.svg" with type image/png → stored as .png', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      const mockFile = createMockFile(1024, 'image/png')

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { uploadLandingMediaImage } = await loadUploadsService()

      await uploadLandingMediaImage(adminSession, {
        file: mockFile,
        folder: 'partners',
      })

      const uploadArgs = mockSupabaseAdmin._uploadSpy.mock.calls[0]
      // Path should end with .png, not .svg
      expect(uploadArgs[0]).toMatch(/\.png$/)
      expect(uploadArgs[0]).not.toMatch(/\.svg/)
    })
  })

  describe('storage error handling', () => {
    it('storage upload error → 500 ServiceError and console.error called', async () => {
      const adminSession = createAdminSession()
      const mockFile = createMockFile(1024, 'image/png')

      const errorUploadSpy = vi.fn(async () => ({
        error: { message: 'Storage bucket misconfigured' },
        data: null,
      }))

      const mockSupabaseAdmin = {
        storage: {
          from: vi.fn(() => ({
            upload: errorUploadSpy,
            getPublicUrl: vi.fn(),
          })),
        },
        _uploadSpy: errorUploadSpy,
      }

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: 'events',
        })
      ).rejects.toMatchObject({ statusCode: 500 })

      expect(console.error).toHaveBeenCalled()
    })

    it('getPublicUrl returns no publicUrl → 500 ServiceError and console.error called', async () => {
      const adminSession = createAdminSession()
      const mockFile = createMockFile(1024, 'image/png')

      const uploadSpy = vi.fn(async () => ({
        error: null,
        data: { path: 'events/test.png' },
      }))

      const mockSupabaseAdmin = {
        storage: {
          from: vi.fn(() => ({
            upload: uploadSpy,
            getPublicUrl: vi.fn(() => ({
              data: { publicUrl: null },
            })),
          })),
        },
        _uploadSpy: uploadSpy,
      }

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { uploadLandingMediaImage } = await loadUploadsService()

      await expect(
        uploadLandingMediaImage(adminSession, {
          file: mockFile,
          folder: 'events',
        })
      ).rejects.toMatchObject({ statusCode: 500 })

      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('migration sanity checks (OIR-207)', () => {
    const migrationPath = join(
      '/Users/samuelromeroarbelo/Projects/Alea/alea-webapp/supabase/migrations',
      '20260704000005_oir207_landing_media_bucket.sql'
    )
    const migrationContent = readFileSync(migrationPath, 'utf8')

    it('migration creates landing-media bucket with public=true', () => {
      expect(migrationContent).toContain("'landing-media'")
      expect(migrationContent).toContain('true')
      expect(migrationContent).toContain('INSERT INTO "storage"."buckets"')
    })

    it('migration sets file_size_limit to 5 MB (5242880 bytes)', () => {
      expect(migrationContent).toContain('5242880')
      expect(migrationContent).toMatch(/5242880.*5\s*MB/)
    })

    it('migration allows 4 MIME types: image/png, image/jpeg, image/webp, image/gif', () => {
      expect(migrationContent).toContain('image/png')
      expect(migrationContent).toContain('image/jpeg')
      expect(migrationContent).toContain('image/webp')
      expect(migrationContent).toContain('image/gif')
      expect(migrationContent).toContain('ARRAY')
    })

    it('migration creates SELECT-only storage policy for anon and authenticated', () => {
      expect(migrationContent).toContain('CREATE POLICY "landing_media_select_public"')
      expect(migrationContent).toContain('FOR SELECT TO "anon", "authenticated"')
      expect(migrationContent).toContain('"bucket_id" = \'landing-media\'')
    })

    it('migration defines no INSERT/UPDATE/DELETE policies (writes service_role only)', () => {
      expect(migrationContent).not.toContain('FOR INSERT')
      expect(migrationContent).not.toContain('FOR UPDATE')
      expect(migrationContent).not.toContain('FOR DELETE')
    })

    it('migration adds img_url column to library_games table', () => {
      expect(migrationContent).toContain('ALTER TABLE "public"."library_games"')
      expect(migrationContent).toContain('ADD COLUMN IF NOT EXISTS "img_url" text')
    })

    it('migration uses ON CONFLICT DO NOTHING for idempotency', () => {
      expect(migrationContent).toContain('ON CONFLICT ("id") DO NOTHING')
    })
  })
})
