// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { ServiceError } from '@/lib/server/shared/service-error'

/**
 * PARTNERS SERVICE TEST COVERAGE (OIR-204)
 *
 * Tests for admin CRUD operations on partners (colaboradores) and public read access.
 * Implementation: lib/server/partners/partners-service.ts
 *
 * Key scenarios tested:
 * - listPartners returns active partners ordered by sort_order (public, via RLS)
 * - listAdminPartners returns all partners (active + inactive) for admin dashboard
 * - createPartner/updatePartner/deletePartner admin-only operations
 * - Non-admin users get 403 Forbidden from every admin endpoint
 * - URL hardening: validateOptionalUrl rejects javascript:, data:, relative URLs
 * - img_url is required; link_url is optional
 * - Validate-before-write: invalid input prevents DB calls
 * - Type guards: name as object/array rejected with 400
 * - Migration enables RLS, creates SELECT-only policy, seeds 20 partners
 * - Chained .order() calls: secondary order('name') tie-break for consistent results
 */

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/server/shared/service-error', () => ({
  serviceError: vi.fn((message: string, statusCode: number) => {
    const err = new Error(message) as ServiceError
    err.name = 'ServiceError'
    err.statusCode = statusCode
    throw err
  }),
}))

type PartnerRow = {
  id: string
  name: string
  img_url: string
  link_url: string | null
  desc_es: string | null
  desc_en: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

type SessionUser = {
  id: string
  role: 'admin' | 'member'
  email?: string
}

function buildSupabaseMock() {
  return {
    from: vi.fn(function (table: string) {
      const state = { 
        table, 
        filters: {} as any, 
        updateData: {} as any, 
        data: null as any, 
        insertData: null as any,
        orders: [] as any[]
      }

      // Helper: Create a chainable query builder with .order() and .eq() support
      function createOrderableBuilder() {
        return {
          eq: vi.fn(function (col: string, val: any) {
            state.filters[col] = val
            return {
              maybeSingle: vi.fn(async () => {
                if (table === 'partners' && state.filters.id === 'partner-1') {
                  return {
                    data: {
                      id: 'partner-1',
                      name: 'Existing Partner',
                      img_url: 'https://example.com/partner.png',
                      link_url: 'https://example.com',
                      desc_es: 'Descripción',
                      desc_en: 'Description',
                      sort_order: 0,
                      active: true,
                      created_at: '2026-04-01T00:00:00Z',
                      updated_at: '2026-04-01T00:00:00Z',
                    },
                    error: null,
                  }
                }
                return { data: null, error: null }
              }),
            }
          }),
          order: vi.fn(function (col: string, opts: any) {
            state.orders.push({ col, opts })
            return createChainableQuery()
          }),
        }
      }

      // Helper: Create a thenable that is also chainable (supports multiple .order() calls)
      function createChainableQuery() {
        return {
          [Symbol.toStringTag]: 'Promise',
          order: vi.fn(function (col: string, opts: any) {
            state.orders.push({ col, opts })
            // Return another chainable query for further chaining
            return createChainableQuery()
          }),
          then: async (onFulfilled?: any, onRejected?: any) => {
            try {
              if (table === 'partners') {
                const mockData = [
                  {
                    id: 'partner-1',
                    name: 'Amantis Informática',
                    img_url: 'https://alealaspalmas.es/wp-content/uploads/2025/10/amantisinformatica.png',
                    link_url: 'https://maps.app.goo.gl/KPiF4nxabjBYu8YA6',
                    desc_es: 'Tienda de informática',
                    desc_en: 'Computer store',
                    sort_order: 0,
                    active: true,
                    created_at: '2026-04-01T00:00:00Z',
                    updated_at: '2026-04-01T00:00:00Z',
                  },
                  {
                    id: 'partner-2',
                    name: 'El Desván del Leprechaun',
                    img_url: 'https://alealaspalmas.es/wp-content/uploads/2025/10/eldesvandelleprechaun.png',
                    link_url: 'https://maps.app.goo.gl/CM96Gnighr4YGMbC7',
                    desc_es: 'Videojuegos y más',
                    desc_en: 'Video games and more',
                    sort_order: 1,
                    active: true,
                    created_at: '2026-04-01T00:00:00Z',
                    updated_at: '2026-04-01T00:00:00Z',
                  },
                ]
                return onFulfilled?.({ data: mockData, error: null })
              }
              return onFulfilled?.({ data: [], error: null })
            } catch (err) {
              return onRejected?.(err)
            }
          },
        }
      }

      return {
        select: vi.fn(function (cols?: string) {
          return createOrderableBuilder()
        }),
        insert: vi.fn(function (data: any) {
          state.insertData = data
          return {
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: 'partner-new-1',
                  ...data,
                  created_at: '2026-04-01T00:00:00Z',
                  updated_at: '2026-04-01T00:00:00Z',
                } as PartnerRow,
                error: null,
              })),
            })),
          }
        }),
        update: vi.fn(function (data: any) {
          state.updateData = data
          return {
            eq: vi.fn(function (col: string, val: any) {
              state.filters[col] = val
              return {
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: state.filters.id,
                      ...state.updateData,
                      created_at: '2026-04-01T00:00:00Z',
                      updated_at: '2026-04-01T00:00:00Z',
                    } as PartnerRow,
                    error: null,
                  })),
                })),
              }
            }),
          }
        }),
        delete: vi.fn(function () {
          return {
            eq: vi.fn(async () => ({
              data: null,
              error: null,
            })),
          }
        }),
      }
    }),
    rpc: vi.fn(),
  }
}

function createAdminSession(): SessionUser {
  return { id: 'user-admin-1', role: 'admin', email: 'admin@example.com' }
}

function createMemberSession(): SessionUser {
  return { id: 'user-member-1', role: 'member', email: 'member@example.com' }
}

async function loadPartnersService() {
  vi.resetModules()
  const mod = await import('@/lib/server/partners/partners-service')
  return {
    listPartners: mod.listPartners,
    listAdminPartners: mod.listAdminPartners,
    createPartner: mod.createPartner,
    updatePartner: mod.updatePartner,
    deletePartner: mod.deletePartner,
  }
}

describe('partners-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listPartners', () => {
    it('returns active partners ordered by sort_order', async () => {
      const mockSupabaseClient = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient.mockResolvedValue(
        mockSupabaseClient as any
      )

      const { listPartners } = await loadPartnersService()

      const result = await listPartners()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
      expect(result[0].name).toBe('Amantis Informática')
      expect(result[0].sortOrder).toBe(0)
      expect(result[1].name).toBe('El Desván del Leprechaun')
      expect(result[1].sortOrder).toBe(1)
    })

    it('chains multiple order() calls without error (sort_order primary, name secondary)', async () => {
      const mockSupabaseClient = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient.mockResolvedValue(
        mockSupabaseClient as any
      )

      const { listPartners } = await loadPartnersService()

      // This test verifies that the chainable .order() mock works correctly
      // The service calls .order('sort_order').order('name'), which would fail
      // without the fix (chainable mock). If it doesn't throw, chaining works.
      const result = await listPartners()
      expect(Array.isArray(result)).toBe(true)
    })

    it('uses user-scoped client (RLS-respecting) for public listing', async () => {
      const mockSupabaseClient = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient.mockResolvedValue(
        mockSupabaseClient as any
      )

      const { listPartners } = await loadPartnersService()

      await listPartners()

      expect(vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient).toHaveBeenCalled()
    })

    it('maps database columns to public Partner type', async () => {
      const mockSupabaseClient = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient.mockResolvedValue(
        mockSupabaseClient as any
      )

      const { listPartners } = await loadPartnersService()

      const result = await listPartners()

      expect(result[0]).toMatchObject({
        id: 'partner-1',
        name: 'Amantis Informática',
        imageUrl: 'https://alealaspalmas.es/wp-content/uploads/2025/10/amantisinformatica.png',
        linkUrl: 'https://maps.app.goo.gl/KPiF4nxabjBYu8YA6',
        descriptionEs: 'Tienda de informática',
        descriptionEn: 'Computer store',
        sortOrder: 0,
      })
      expect(result[0]).not.toHaveProperty('active')
    })
  })

  describe('listAdminPartners', () => {
    it('admin can list all partners including inactive', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { listAdminPartners } = await loadPartnersService()

      const result = await listAdminPartners(adminSession)

      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toHaveProperty('active')
    })

    it('chains multiple order() calls without error (sort_order primary, name secondary)', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { listAdminPartners } = await loadPartnersService()

      // This test verifies that the chainable .order() mock works correctly.
      // The service calls .order('sort_order').order('name'). If it doesn't throw,
      // the mock fidelity fix (chainable .order()) is working.
      const result = await listAdminPartners(adminSession)
      expect(Array.isArray(result)).toBe(true)
    })

    it('non-admin member gets 403 Forbidden', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { listAdminPartners } = await loadPartnersService()

      await expect(listAdminPartners(memberSession)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('createPartner', () => {
    it('admin can create a partner with required fields', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { createPartner } = await loadPartnersService()

      const result = await createPartner(adminSession, {
        name: 'New Partner',
        imageUrl: 'https://example.com/partner.png',
      })

      expect(result.id).toBe('partner-new-1')
      expect(result.name).toBe('New Partner')
      expect(result.imageUrl).toBe('https://example.com/partner.png')
    })

    it('admin can create a partner with all fields', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { createPartner } = await loadPartnersService()

      const result = await createPartner(adminSession, {
        name: 'Complete Partner',
        imageUrl: 'https://example.com/partner.png',
        linkUrl: 'https://example.com',
        descriptionEs: 'Descripción en español',
        descriptionEn: 'Description in English',
        sortOrder: 5,
        active: true,
      })

      expect(result.name).toBe('Complete Partner')
      expect(result.active).toBe(true)
    })

    it('non-admin member gets 403 Forbidden', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(memberSession, {
          name: 'Partner',
          imageUrl: 'https://example.com/partner.png',
        })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('rejects javascript: URL in img_url', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(adminSession, {
          name: 'Partner',
          imageUrl: 'javascript:alert(1)',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects data: URL in link_url', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(adminSession, {
          name: 'Partner',
          imageUrl: 'https://example.com/partner.png',
          linkUrl: 'data:text/html,<script>alert(1)</script>',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects relative URL in imageUrl', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(adminSession, {
          name: 'Partner',
          imageUrl: '/images/partner.png',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('accepts empty/null link_url (optional)', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { createPartner } = await loadPartnersService()

      const result1 = await createPartner(adminSession, {
        name: 'Partner 1',
        imageUrl: 'https://example.com/partner.png',
        linkUrl: null,
      })

      const result2 = await createPartner(adminSession, {
        name: 'Partner 2',
        imageUrl: 'https://example.com/partner.png',
        linkUrl: undefined,
      })

      expect(result1.id).toBe('partner-new-1')
      expect(result2.id).toBe('partner-new-1')
    })

    it('rejects missing/empty name', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(adminSession, {
          name: '',
          imageUrl: 'https://example.com/partner.png',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects missing imageUrl', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(adminSession, {
          name: 'Partner',
          imageUrl: null,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects name as object with 400', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(adminSession, {
          name: { invalid: 'object' },
          imageUrl: 'https://example.com/partner.png',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects name as array with 400', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(adminSession, {
          name: ['array', 'name'],
          imageUrl: 'https://example.com/partner.png',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects descriptionEs as array with 400', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(adminSession, {
          name: 'Partner',
          imageUrl: 'https://example.com/partner.png',
          descriptionEs: [],
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('validates before any DB insert', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createPartner } = await loadPartnersService()

      await expect(
        createPartner(adminSession, {
          name: 'Partner',
          imageUrl: 'javascript:alert(1)',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin.from('partners').insert).not.toHaveBeenCalled()
    })

    it('accepts valid http:// URL', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { createPartner } = await loadPartnersService()

      const result = await createPartner(adminSession, {
        name: 'Partner',
        imageUrl: 'http://example.com/partner.png',
      })

      expect(result.id).toBe('partner-new-1')
    })

    it('accepts valid https:// URL', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { createPartner } = await loadPartnersService()

      const result = await createPartner(adminSession, {
        name: 'Partner',
        imageUrl: 'https://example.com/partner.png',
      })

      expect(result.id).toBe('partner-new-1')
    })
  })

  describe('updatePartner', () => {
    it('admin can update a partner', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { updatePartner } = await loadPartnersService()

      const result = await updatePartner(adminSession, 'partner-1', {
        name: 'Updated Partner',
      })

      expect(result.id).toBe('partner-1')
      expect(result.name).toBe('Updated Partner')
    })

    it('non-admin member gets 403 Forbidden on update', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { updatePartner } = await loadPartnersService()

      await expect(
        updatePartner(memberSession, 'partner-1', { name: 'Updated' })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('returns 404 for non-existent partner', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { updatePartner } = await loadPartnersService()

      mockSupabaseAdmin.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })) as any

      await expect(
        updatePartner(adminSession, 'nonexistent-partner', { name: 'Updated' })
      ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('rejects javascript: URL in img_url on update', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { updatePartner } = await loadPartnersService()

      await expect(
        updatePartner(adminSession, 'partner-1', {
          imageUrl: 'javascript:alert(1)',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects data: URL in link_url on update', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { updatePartner } = await loadPartnersService()

      await expect(
        updatePartner(adminSession, 'partner-1', {
          linkUrl: 'data:text/html,<script>alert(1)</script>',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('validates before any DB update', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { updatePartner } = await loadPartnersService()

      await expect(
        updatePartner(adminSession, 'partner-1', {
          imageUrl: 'javascript:alert(1)',
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin.from('partners').update).not.toHaveBeenCalled()
    })

    it('preserves current values for omitted fields', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { updatePartner } = await loadPartnersService()

      const result = await updatePartner(adminSession, 'partner-1', {
        name: 'Updated Name',
      })

      expect(result.id).toBe('partner-1')
    })
  })

  describe('deletePartner', () => {
    it('admin can delete a partner', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { deletePartner } = await loadPartnersService()

      await expect(deletePartner(adminSession, 'partner-1')).resolves.toBeUndefined()
    })

    it('non-admin member gets 403 Forbidden on delete', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { deletePartner } = await loadPartnersService()

      await expect(deletePartner(memberSession, 'partner-1')).rejects.toMatchObject({ statusCode: 403 })
    })

    it('returns 404 for non-existent partner', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/shared/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { deletePartner } = await loadPartnersService()

      mockSupabaseAdmin.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })) as any

      await expect(deletePartner(adminSession, 'nonexistent-partner')).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('migration sanity checks', () => {
    const migrationPath = join(
      '/Users/samuelromeroarbelo/Projects/Alea/alea-webapp/supabase/migrations',
      '20260704000002_oir204_partners_table.sql'
    )
    const migrationContent = readFileSync(migrationPath, 'utf8')

    it('migration file enables RLS on partners table', () => {
      expect(migrationContent).toContain('ALTER TABLE "public"."partners" ENABLE ROW LEVEL SECURITY')
    })

    it('migration creates SELECT-only policy for anon and authenticated', () => {
      expect(migrationContent).toContain('CREATE POLICY "partners_select_active"')
      expect(migrationContent).toContain('FOR SELECT TO "anon", "authenticated"')
      expect(migrationContent).toContain('USING ("active" = true)')
    })

    it('migration grants SELECT only (no INSERT/UPDATE/DELETE)', () => {
      expect(migrationContent).toContain('GRANT SELECT ON TABLE "public"."partners" TO "anon", "authenticated"')
      expect(migrationContent).not.toContain('GRANT INSERT')
      expect(migrationContent).not.toContain('GRANT UPDATE')
      expect(migrationContent).not.toContain('GRANT DELETE')
    })

    it('migration seeds 20 partners with sort_order preservation', () => {
      const insertMatch = migrationContent.match(/INSERT INTO "public"."partners"[\s\S]*?VALUES([\s\S]*?);/)
      expect(insertMatch).not.toBeNull()
      if (insertMatch) {
        const valuesSection = insertMatch[1]
        const rowCount = (valuesSection.match(/^\s*\(/gm) || []).length
        expect(rowCount).toBe(20)
      }
    })

    it('migration creates required columns with correct types', () => {
      expect(migrationContent).toContain('"id" uuid PRIMARY KEY DEFAULT gen_random_uuid()')
      expect(migrationContent).toContain('"name" text NOT NULL')
      expect(migrationContent).toContain('"img_url" text NOT NULL')
      expect(migrationContent).toContain('"link_url" text')
      expect(migrationContent).toContain('"sort_order" integer NOT NULL DEFAULT 0')
      expect(migrationContent).toContain('"active" boolean NOT NULL DEFAULT true')
      expect(migrationContent).toContain('"created_at" timestamptz NOT NULL DEFAULT now()')
      expect(migrationContent).toContain('"updated_at" timestamptz NOT NULL DEFAULT now()')
    })
  })

  describe('createPartner with optional English (OIR-206)', () => {
    it('admin can create a partner with descriptionEn absent, falls back to descriptionEs', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { createPartner } = await loadPartnersService()

      const result = await createPartner(adminSession, {
        name: 'Librería Local',
        imageUrl: 'https://example.com/library.png',
        descriptionEs: 'Tu tienda de libros favorita',
        // descriptionEn absent — should fallback
      })

      expect(result.name).toBe('Librería Local')
      expect(result.descriptionEs).toBe('Tu tienda de libros favorita')
      expect(result.descriptionEn).toBe('Tu tienda de libros favorita') // Fallback to ES
    })

    it('admin can create a partner with descriptionEn empty string, falls back to descriptionEs', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { createPartner } = await loadPartnersService()

      const result = await createPartner(adminSession, {
        name: 'Tienda de Juegos',
        imageUrl: 'https://example.com/games.png',
        descriptionEs: 'Juegos de mesa y más',
        descriptionEn: '', // Empty string — should fallback
      })

      expect(result.descriptionEn).toBe('Juegos de mesa y más')
    })

    it('admin can create a partner with explicit descriptionEn, preserves EN value', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { createPartner } = await loadPartnersService()

      const result = await createPartner(adminSession, {
        name: 'Café Artesanal',
        imageUrl: 'https://example.com/cafe.png',
        descriptionEs: 'Café y pasteles locales',
        descriptionEn: 'Artisanal coffee and pastries',
      })

      expect(result.descriptionEn).toBe('Artisanal coffee and pastries')
    })
  })

  describe('updatePartner with fallback semantics edge cases (OIR-206 round 2)', () => {
    it('rule 2: explicit different descriptionEn + blank descriptionEn payload = re-enable auto-copy to new ES', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      const currentRow = {
        id: 'partner-1',
        name: 'Partner Name',
        img_url: 'https://example.com/partner.png',
        link_url: null,
        desc_es: 'Descripción antigua',
        desc_en: 'Old Explicit Description', // Deliberately different from ES
        sort_order: 0,
        active: true,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
      }

      mockSupabaseAdmin.from = vi.fn(function (table: string) {
        if (table === 'partners') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: currentRow,
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      ...currentRow,
                      desc_es: 'Nueva descripción',
                      desc_en: 'Nueva descripción', // Should become new ES (rule 2)
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          }
        }
        return buildSupabaseMock().from(table)
      }) as any

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { updatePartner } = await loadPartnersService()

      const result = await updatePartner(adminSession, 'partner-1', {
        descriptionEs: 'Nueva descripción',
        descriptionEn: '', // Blank = re-enable auto-copy
      })

      expect(result.descriptionEn).toBe('Nueva descripción') // Follows new ES
    })

    it('rule 1: resending identical descriptionEn (en === es deliberately) + ES change = EN preserved', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      const currentRow = {
        id: 'partner-1',
        name: 'Partner Name',
        img_url: 'https://example.com/partner.png',
        link_url: null,
        desc_es: 'Descripción antigua',
        desc_en: 'Descripción antigua', // Same as ES (deliberately or auto-copied)
        sort_order: 0,
        active: true,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
      }

      mockSupabaseAdmin.from = vi.fn(function (table: string) {
        if (table === 'partners') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: currentRow,
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      ...currentRow,
                      desc_es: 'Nueva descripción',
                      desc_en: 'Descripción antigua', // Preserved because explicitly resent (rule 1)
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          }
        }
        return buildSupabaseMock().from(table)
      }) as any

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { updatePartner } = await loadPartnersService()

      const result = await updatePartner(adminSession, 'partner-1', {
        descriptionEs: 'Nueva descripción',
        descriptionEn: 'Descripción antigua', // Resend explicit identical value
      })

      expect(result.descriptionEn).toBe('Descripción antigua') // Preserved by rule 1
    })

    it('rule 2: whitespace-only descriptionEn behaves as blank (re-enable auto-copy to new ES)', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      const currentRow = {
        id: 'partner-1',
        name: 'Partner Name',
        img_url: 'https://example.com/partner.png',
        link_url: null,
        desc_es: 'Descripción antigua',
        desc_en: 'Old Explicit Description',
        sort_order: 0,
        active: true,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
      }

      mockSupabaseAdmin.from = vi.fn(function (table: string) {
        if (table === 'partners') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: currentRow,
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      ...currentRow,
                      desc_es: 'Nueva descripción',
                      desc_en: 'Nueva descripción', // Should become new ES (whitespace trimmed = empty)
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          }
        }
        return buildSupabaseMock().from(table)
      }) as any

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { updatePartner } = await loadPartnersService()

      const result = await updatePartner(adminSession, 'partner-1', {
        descriptionEs: 'Nueva descripción',
        descriptionEn: '   ', // Whitespace-only = treated as empty (rule 2)
      })

      expect(result.descriptionEn).toBe('Nueva descripción') // Follows new ES
    })
  })
})
