import type { PaginatedResponse, User } from '@/lib/types'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables, TablesUpdate } from '@/lib/supabase/types'

type ProfileRow = Tables<'profiles'>
type PublicProfileRow = Pick<ProfileRow, 'id' | 'member_number' | 'email' | 'role' | 'is_active' | 'created_at' | 'updated_at'>
type ProfilesQuery = {
  eq: (column: string, value: unknown) => ProfilesQuery
  or: (filter: string) => ProfilesQuery
  order: (column: string, options: { ascending: boolean }) => {
    range: (from: number, to: number) => Promise<{
      data: PublicProfileRow[] | null
      error: unknown
      count: number | null
    }>
  }
}
type ProfilesTableClient = {
  select: (columns: string, options?: { count?: 'exact' }) => ProfilesQuery
  update: (updates: TablesUpdate<'profiles'>) => {
    eq: (column: 'id', value: string) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data: PublicProfileRow | null; error: unknown }>
      }
    }
  }
}
type AdminProfilesTableClient = {
  select: (columns: string) => {
    eq: (column: 'id', value: string) => {
      maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }>
    }
  }
}

const PROFILE_COLUMNS = 'id, member_number, email, role, is_active, created_at, updated_at'

function toPublicUser(profile: PublicProfileRow): User {
  return {
    id: profile.id,
    memberNumber: profile.member_number,
    email: profile.email ?? null,
    role: profile.role,
    isActive: profile.is_active,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

function normalizePage(page: number) {
  return Math.max(1, Math.floor(Number(page)) || 1)
}

function normalizeLimit(limit: number) {
  return Math.min(100, Math.max(1, Math.floor(Number(limit)) || 20))
}

function sanitizeSearchTerm(search: string) {
  return search.replace(/[^a-zA-Z0-9@._-]/g, '')
}

function escapeLikeWildcards(term: string) {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function listPaginatedUsers(input: {
  page: number
  limit: number
  search?: string
}): Promise<PaginatedResponse<User>> {
  const page = normalizePage(input.page)
  const limit = normalizeLimit(input.limit)
  const search = input.search?.trim() ?? ''
  const supabase = await createSupabaseServerClient()
  const profiles = supabase.from('profiles') as unknown as ProfilesTableClient
  let query = profiles
    .select(PROFILE_COLUMNS, { count: 'exact' })
    .eq('is_active', true)

  if (search) {
    const sanitized = sanitizeSearchTerm(search)
    if (sanitized) {
      const escaped = escapeLikeWildcards(sanitized)
      query = query.or(`member_number.ilike.%${escaped}%`)
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)
  if (error) {
    serviceError('Internal server error', 500)
  }

  const total = count ?? 0
  return {
    data: ((data ?? []) as PublicProfileRow[]).map(toPublicUser),
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}

export async function updateUser(id: string, body: { memberNumber?: unknown; role?: unknown; is_active?: unknown }) {
  const updates: TablesUpdate<'profiles'> = {}
  if (body.memberNumber) updates.member_number = String(body.memberNumber)
  if (body.role === 'admin' || body.role === 'member') updates.role = body.role
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (Object.keys(updates).length === 0) {
    serviceError('No updatable fields provided', 400)
  }

  const supabase = await createSupabaseServerClient()
  const profiles = supabase.from('profiles') as unknown as ProfilesTableClient
  const { data, error } = await profiles
    .update(updates)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }
  if (!data) {
    serviceError('User not found', 404)
  }

  return toPublicUser(data as PublicProfileRow)
}

export async function deleteUser(id: string) {
  const admin = createSupabaseServerAdminClient()
  const profiles = admin.from('profiles') as unknown as AdminProfilesTableClient
  const { data, error } = await profiles
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }
  if (!data) {
    serviceError('User not found', 404)
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(id)
  if (deleteError) {
    serviceError('Internal server error', 500)
  }
}
