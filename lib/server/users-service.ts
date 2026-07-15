import type { MemberImportIssue, MemberImportResult, MemberImportRow, PaginatedResponse, User } from '@/lib/types'
import { getAdminDb } from '@/lib/db'
import { createAuthUser, deleteAuthUser, updateAuthUserById } from '@/lib/auth/session'
import { serviceError } from '@/lib/server/service-error'
import type { TablesUpdate } from '@/lib/supabase/types'
import { memberNumberSchema } from '@/lib/validations/auth'
import { type PublicProfileRow, toPublicUser } from '@/lib/server/profile-mappers'
import {
  type MemberImportOptionalColumnPresence,
  MEMBER_IMPORT_PREVIEW_LIMIT,
  parseMemberImportCsv,
  normalizeMemberImportSource,
  pushImportIssue,
} from '@/lib/server/member-import'

type ProfilesQuery = {
  eq: (column: string, value: unknown) => ProfilesQuery
  or: (filter: string) => ProfilesQuery
  maybeSingle: () => Promise<{ data: PublicProfileRow | null; error: unknown }>
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

type ProfileImportLookupResult = Promise<{ data: PublicProfileRow | null; error: unknown }>
type ProfilesImportTableClient = {
  select: (columns: string) => {
    eq: (column: 'member_number' | 'id', value: string) => {
      maybeSingle: () => ProfileImportLookupResult
    }
  }
  update: (updates: TablesUpdate<'profiles'>) => {
    eq: (column: 'id', value: string) => {
      select: (columns: string) => {
        maybeSingle: () => ProfileImportLookupResult
      }
    }
  }
}
const PROFILE_COLUMNS = 'id, member_number, full_name, auth_email, email, phone, role, is_active, active_from, no_show_count, blocked_until, created_at, updated_at'

function normalizePage(page: number) {
  return Math.max(1, Math.floor(Number(page)) || 1)
}

function normalizeLimit(limit: number) {
  return Math.min(100, Math.max(1, Math.floor(Number(limit)) || 20))
}

function sanitizeSearchTerm(search: string) {
  return search.replace(/[^a-zA-Z0-9@._\s-]/g, '')
}

function escapeLikeWildcards(term: string) {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function sanitizeOptionalUpdateValue(value: unknown) {
  if (value === null) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

function assertNullableStringField(value: unknown, fieldName: string) {
  if (value !== null && typeof value !== 'string') {
    serviceError(`${fieldName} must be a string or null`, 400)
  }
}

function createInternalAuthEmail(memberNumber: string) {
  return `${memberNumber}@members.alea.internal`
}

async function importMembersFromNormalizedRows(input: {
  totalRows: number
  normalizedRows: MemberImportRow[]
  issues: MemberImportIssue[]
  optionalColumnPresence: MemberImportOptionalColumnPresence
}): Promise<MemberImportResult> {
  const { totalRows, normalizedRows } = input
  const issues = [...input.issues]
  const auditedRows: MemberImportRow[] = []
  const admin = getAdminDb()
  const profiles = admin.from('profiles') as unknown as ProfilesImportTableClient
  const concurrencyLimit = 10

  async function processImportRow(row: MemberImportRow) {
    const { data: existing, error: selectError } = await profiles
      .select(PROFILE_COLUMNS)
      .eq('member_number', row.memberNumber)
      .maybeSingle()

    if (selectError) {
      return {
        created: 0,
        updated: 0,
        normalizedRow: null,
        issue: { rowNumber: row.rowNumber, memberNumber: row.memberNumber, code: 'read_existing_failed' as const },
      }
    }

    if (existing) {
      const resolvedEmail = row.email ?? createInternalAuthEmail(row.memberNumber)
      const updatePayload: TablesUpdate<'profiles'> = {
        full_name: row.fullName,
      }
      const normalizedRow: MemberImportRow = { ...row }

      if (input.optionalColumnPresence.email) {
        updatePayload.email = resolvedEmail
        normalizedRow.email = resolvedEmail
      } else {
        normalizedRow.email = existing.email ?? null
      }
      if (input.optionalColumnPresence.phone) {
        updatePayload.phone = row.phone
      } else {
        normalizedRow.phone = existing.phone ?? null
      }

      const { error: updateError } = await profiles
        .update(updatePayload)
        .eq('id', existing.id)
        .select(PROFILE_COLUMNS)
        .maybeSingle()

      if (updateError) {
        return {
          created: 0,
          updated: 0,
          normalizedRow: null,
          issue: { rowNumber: row.rowNumber, memberNumber: row.memberNumber, code: 'update_existing_failed' as const },
        }
      }

      return {
        created: 0,
        updated: 1,
        normalizedRow,
        issue: null,
      }
    }

    const authEmail = createInternalAuthEmail(row.memberNumber)
    const contactEmail = row.email ?? authEmail
    const temporaryPassword = `Temp${crypto.randomUUID().replace(/-/g, '')}Aa1`
    const { data: authData, error: createAuthError } = await createAuthUser(admin, {
      email: authEmail,
      password: temporaryPassword,
      email_confirm: true,
    })

    if (createAuthError || !authData.user) {
      return {
        created: 0,
        updated: 0,
        normalizedRow: null,
        issue: { rowNumber: row.rowNumber, memberNumber: row.memberNumber, code: 'create_auth_failed' as const },
      }
    }

    const { data: persistedProfile, error: updateProfileError } = await profiles
      .update({
        member_number: row.memberNumber,
        full_name: row.fullName,
        auth_email: authEmail,
        email: contactEmail,
        phone: row.phone,
        role: 'member',
        is_active: false,
        active_from: null,
        psw_changed: null,
      })
      .eq('id', authData.user.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle()

    if (updateProfileError || !persistedProfile) {
      await deleteAuthUser(admin, authData.user.id)
      return {
        created: 0,
        updated: 0,
        normalizedRow: null,
        issue: { rowNumber: row.rowNumber, memberNumber: row.memberNumber, code: 'persist_import_failed' as const },
      }
    }

    return {
      created: 1,
      updated: 0,
      normalizedRow: {
        ...row,
        email: contactEmail,
      },
      issue: null,
    }
  }

  let createdCount = 0
  let updatedCount = 0

  for (let index = 0; index < normalizedRows.length; index += concurrencyLimit) {
    const batch = normalizedRows.slice(index, index + concurrencyLimit)
    const results = await Promise.all(batch.map((row) => processImportRow(row)))

    for (const result of results) {
      createdCount += result.created
      updatedCount += result.updated
      if (result.normalizedRow) {
        auditedRows.push(result.normalizedRow)
      }
      if (result.issue) {
        pushImportIssue(issues, result.issue)
      }
    }
  }

  return {
    totalRows,
    createdCount,
    updatedCount,
    skippedCount: issues.length,
    normalizedRows: auditedRows.slice(0, MEMBER_IMPORT_PREVIEW_LIMIT),
    issues,
  }
}

export async function importMembersFromCsv(input: string): Promise<MemberImportResult> {
  const parsed = parseMemberImportCsv(input)
  return importMembersFromNormalizedRows(parsed)
}

export async function importMembersFromSource(input: {
  fileName: string
  contentType?: string | null
  bytes: Uint8Array
}): Promise<MemberImportResult> {
  const normalized = await normalizeMemberImportSource(input)
  return importMembersFromNormalizedRows(normalized)
}

export async function listPaginatedUsers(input: {
  page: number
  limit: number
  search?: string
}): Promise<PaginatedResponse<User>> {
  const page = normalizePage(input.page)
  const limit = normalizeLimit(input.limit)
  const search = input.search?.trim() ?? ''
  const supabase = getAdminDb()
  const profiles = supabase.from('profiles') as unknown as ProfilesTableClient
  let query = profiles.select(PROFILE_COLUMNS, { count: 'exact' })

  if (search) {
    const sanitized = sanitizeSearchTerm(search)
    if (sanitized) {
      const escaped = escapeLikeWildcards(sanitized)
      query = query.or(`member_number.ilike.%${escaped}%,full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
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

export async function updateUser(
  id: string,
  body: { memberNumber?: unknown; fullName?: unknown; email?: unknown; phone?: unknown; role?: unknown; is_active?: unknown }
) {
  const updates: TablesUpdate<'profiles'> = {}
  let nextMemberNumber: string | null = null
  if (body.memberNumber !== undefined) {
    const parsed = memberNumberSchema.safeParse(String(body.memberNumber))
    if (!parsed.success) {
      serviceError('Invalid member number format', 400)
    }
    updates.member_number = parsed.data
    nextMemberNumber = parsed.data
  }
  if (body.fullName !== undefined) {
    const fullName = String(body.fullName).trim()
    if (!fullName) {
      serviceError('Full name is required', 400)
    }
    updates.full_name = fullName
  }
  if (body.email !== undefined) {
    assertNullableStringField(body.email, 'Email')
    updates.email = sanitizeOptionalUpdateValue(body.email)
  }
  if (body.phone !== undefined) {
    assertNullableStringField(body.phone, 'Phone')
    updates.phone = sanitizeOptionalUpdateValue(body.phone)
  }
  if (body.role === 'admin' || body.role === 'member') updates.role = body.role
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (Object.keys(updates).length === 0) {
    serviceError('No updatable fields provided', 400)
  }

  const supabase = getAdminDb()
  const profiles = supabase.from('profiles') as unknown as ProfilesTableClient
  const { data: existingProfile, error: existingProfileError } = await profiles
    .select(PROFILE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (existingProfileError) {
    serviceError('Internal server error', 500)
  }
  if (!existingProfile) {
    serviceError('User not found', 404)
  }

  const existingInternalAuthEmail = createInternalAuthEmail(existingProfile.member_number)
  if (
    nextMemberNumber !== null
    && nextMemberNumber !== existingProfile.member_number
    && existingProfile.auth_email === existingInternalAuthEmail
  ) {
    updates.auth_email = createInternalAuthEmail(nextMemberNumber)
  }

  const previousMemberNumber = existingProfile.member_number
  const previousAuthEmail = existingProfile.auth_email
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

  if (typeof updates.auth_email === 'string') {
    const { error: authUpdateError } = await updateAuthUserById(supabase, id, { email: updates.auth_email })

    if (authUpdateError) {
      await profiles
        .update({
          member_number: previousMemberNumber,
          auth_email: previousAuthEmail,
        })
        .eq('id', id)
      serviceError('Failed to keep auth credentials aligned', 500)
    }
  }

  return toPublicUser(data as PublicProfileRow)
}

export async function resetNoShows(id: string) {
  const admin = getAdminDb()
  const profiles = admin.from('profiles') as unknown as AdminProfilesTableClient
  const { data: existing, error: selectError } = await profiles
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (selectError) serviceError('Internal server error', 500)
  if (!existing) serviceError('User not found', 404)

  const { error } = await admin
    .from('profiles')
    .update({ no_show_count: 0, blocked_until: null })
    .eq('id', id)
  if (error) serviceError('Internal server error', 500)
}

export async function unblockUser(id: string) {
  const admin = getAdminDb()
  const profiles = admin.from('profiles') as unknown as AdminProfilesTableClient
  const { data: existing, error: selectError } = await profiles
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (selectError) serviceError('Internal server error', 500)
  if (!existing) serviceError('User not found', 404)

  const { error } = await admin
    .from('profiles')
    .update({ blocked_until: null })
    .eq('id', id)
  if (error) serviceError('Internal server error', 500)
}

export async function deleteUser(id: string) {
  const admin = getAdminDb()
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

  const { error: deleteError } = await deleteAuthUser(admin, id)
  if (deleteError) {
    serviceError('Internal server error', 500)
  }
}
