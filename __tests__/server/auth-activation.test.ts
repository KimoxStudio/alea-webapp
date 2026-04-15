import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

type ProfileRow = {
  id: string
  member_number: string
  auth_email: string
  email: string | null
  full_name: string | null
  phone: string | null
  role: 'member' | 'admin'
  is_active: boolean
  active_from: string | null
  psw_changed: string | null
  no_show_count: number
  blocked_until: string | null
  created_at: string
  updated_at: string
}

type ActivationTokenRow = {
  id: string
  profile_id: string
  token_hash: string
  expires_at: string
  used_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const profilesById = new Map<string, ProfileRow>()
const profilesByMemberNumber = new Map<string, ProfileRow>()
const activationTokensById = new Map<string, ActivationTokenRow>()
const activationTokensByProfileId = new Map<string, ActivationTokenRow>()
const activationTokensByHash = new Map<string, ActivationTokenRow>()

const updateUserByIdMock = vi.fn()

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function seedProfile(overrides?: Partial<ProfileRow>): ProfileRow {
  return {
    id: 'member-1',
    member_number: '100020',
    auth_email: '100020@members.alea.internal',
    email: '100020@members.alea.internal',
    full_name: 'Member 20',
    phone: null,
    role: 'member',
    is_active: false,
    active_from: null,
    psw_changed: null,
    no_show_count: 0,
    blocked_until: null,
    created_at: '2026-04-10T00:00:00.000Z',
    updated_at: '2026-04-10T00:00:00.000Z',
    ...overrides,
  }
}

function seedActivationToken(overrides?: Partial<ActivationTokenRow>): ActivationTokenRow {
  const token = {
    id: 'token-1',
    profile_id: 'member-1',
    token_hash: hashToken('plain-token'),
    expires_at: '2099-04-16T10:00:00.000Z',
    used_at: null,
    created_by: 'admin-1',
    created_at: '2026-04-15T10:00:00.000Z',
    updated_at: '2026-04-15T10:00:00.000Z',
    ...overrides,
  }
  activationTokensById.set(token.id, token)
  activationTokensByProfileId.set(token.profile_id, token)
  activationTokensByHash.set(token.token_hash, token)
  return token
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  })),
  createSupabaseServerAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        updateUserById: updateUserByIdMock,
      },
    },
    from: vi.fn((table: 'profiles' | 'activation_tokens') => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: 'id' | 'member_number', value: string) => ({
              maybeSingle: vi.fn(async () => {
                if (column === 'id') return { data: profilesById.get(value) ?? null, error: null }
                return { data: profilesByMemberNumber.get(value) ?? null, error: null }
              }),
            })),
          })),
          update: vi.fn((updates: Partial<ProfileRow>) => ({
            eq: vi.fn((column: 'id', value: string) => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn(async () => {
                  const existing = profilesById.get(value)
                  if (!existing) return { data: null, error: null }
                  const next = { ...existing, ...updates, updated_at: '2026-04-15T11:00:00.000Z' }
                  profilesById.set(value, next)
                  profilesByMemberNumber.set(next.member_number, next)
                  return { data: next, error: null }
                }),
              })),
            })),
          })),
        }
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn((column: 'profile_id' | 'token_hash', value: string) => ({
            maybeSingle: vi.fn(async () => {
              if (column === 'profile_id') return { data: activationTokensByProfileId.get(value) ?? null, error: null }
              return { data: activationTokensByHash.get(value) ?? null, error: null }
            }),
          })),
        })),
        insert: vi.fn(async (values: ActivationTokenRow) => {
          const inserted = { ...values, id: 'token-new', created_at: '2026-04-15T10:00:00.000Z', updated_at: '2026-04-15T10:00:00.000Z', used_at: null }
          activationTokensById.set(inserted.id, inserted)
          activationTokensByProfileId.set(inserted.profile_id, inserted)
          activationTokensByHash.set(inserted.token_hash, inserted)
          return { error: null }
        }),
        upsert: vi.fn(async (values: ActivationTokenRow) => {
          const existing = activationTokensByProfileId.get(values.profile_id)
          if (existing) {
            activationTokensByHash.delete(existing.token_hash)
            const next = {
              ...existing,
              ...values,
              updated_at: '2026-04-15T10:00:00.000Z',
              used_at: null,
            }
            activationTokensById.set(existing.id, next)
            activationTokensByProfileId.set(next.profile_id, next)
            activationTokensByHash.set(next.token_hash, next)
            return { error: null }
          }

          const inserted = { ...values, id: 'token-new', created_at: '2026-04-15T10:00:00.000Z', updated_at: '2026-04-15T10:00:00.000Z', used_at: null }
          activationTokensById.set(inserted.id, inserted)
          activationTokensByProfileId.set(inserted.profile_id, inserted)
          activationTokensByHash.set(inserted.token_hash, inserted)
          return { error: null }
        }),
        update: vi.fn((updates: Partial<ActivationTokenRow>) => ({
          eq: vi.fn(async (_column: 'id', value: string) => {
            const existing = activationTokensById.get(value)
            if (!existing) return { error: null }
            const next = { ...existing, ...updates, updated_at: '2026-04-15T11:00:00.000Z' }
            activationTokensById.set(value, next)
            activationTokensByProfileId.set(next.profile_id, next)
            activationTokensByHash.set(next.token_hash, next)
            return { error: null }
          }),
        })),
      }
    }),
  })),
}))

async function loadService() {
  return import('@/lib/server/auth-service')
}

describe('auth activation helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    profilesById.clear()
    profilesByMemberNumber.clear()
    activationTokensById.clear()
    activationTokensByProfileId.clear()
    activationTokensByHash.clear()
    updateUserByIdMock.mockResolvedValue({ error: null })

    const profile = seedProfile()
    profilesById.set(profile.id, profile)
    profilesByMemberNumber.set(profile.member_number, profile)
  })

  it('returns valid activation state for a fresh token', async () => {
    seedActivationToken()
    const { getActivationLinkState } = await loadService()

    await expect(getActivationLinkState('plain-token')).resolves.toEqual({
      status: 'valid',
      memberNumber: '100020',
      fullName: 'Member 20',
    })
  })

  it('returns expired state for an expired token', async () => {
    seedActivationToken({ expires_at: '2020-04-16T10:00:00.000Z' })
    const { getActivationLinkState } = await loadService()

    await expect(getActivationLinkState('plain-token')).resolves.toEqual({
      status: 'expired',
      memberNumber: null,
      fullName: null,
    })
  })

  it('generates a fresh activation link and replaces any previous token', async () => {
    seedActivationToken({ id: 'token-old', token_hash: hashToken('old-token') })
    const { generateActivationLink } = await loadService()

    const result = await generateActivationLink({
      userId: 'member-1',
      locale: 'es',
      baseUrl: 'http://localhost:3000',
      createdBy: 'admin-1',
    })

    expect(result.activationLink).toContain('http://localhost:3000/es/activate?token=')
    expect(result.activationLink).not.toContain('old-token')
    expect(activationTokensByProfileId.get('member-1')?.token_hash).not.toBe(hashToken('old-token'))
  })

  it('activates account, updates password, profile state, and marks token used', async () => {
    seedActivationToken()
    const { activateAccount } = await loadService()

    const result = await activateAccount({
      token: 'plain-token',
      password: 'Password1234!@#',
    })

    expect(updateUserByIdMock).toHaveBeenCalledWith('member-1', {
      password: 'Password1234!@#',
      email_confirm: true,
    })
    expect(result).toMatchObject({
      authEmail: '100020@members.alea.internal',
      user: {
        memberNumber: '100020',
        isActive: true,
      },
    })
    expect(profilesById.get('member-1')?.active_from).toBeTruthy()
    expect(profilesById.get('member-1')?.psw_changed).toBeTruthy()
    expect(activationTokensByProfileId.get('member-1')?.used_at).toBeTruthy()
  })
})
