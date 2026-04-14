import type { MemberImportIssue, MemberImportResult, MemberImportRow, PaginatedResponse, User } from '@/lib/types'
import { createSupabaseServerAdminClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables, TablesUpdate } from '@/lib/supabase/types'
import { memberNumberSchema } from '@/lib/validations/auth'

type ProfileRow = Tables<'profiles'>
type PublicProfileRow = Pick<ProfileRow, 'id' | 'member_number' | 'full_name' | 'auth_email' | 'email' | 'phone' | 'role' | 'is_active' | 'active_from' | 'psw_changed' | 'no_show_count' | 'blocked_until' | 'created_at' | 'updated_at'>
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

const PROFILE_COLUMNS = 'id, member_number, full_name, auth_email, email, phone, role, is_active, active_from, psw_changed, no_show_count, blocked_until, created_at, updated_at'
const PROFILE_IMPORT_HEADERS = {
  memberNumber: ['id', 'membernumber', 'member_number', 'numero de socio', 'numerodesocio'],
  fullName: ['usuarios', 'usuario', 'full name', 'fullname', 'nombre', 'name'],
  email: ['email', 'correo', 'mail'],
  phone: ['phone', 'telefono', 'teléfono', 'mobile', 'movil', 'móvil'],
} as const

function toPublicUser(profile: PublicProfileRow): User {
  return {
    id: profile.id,
    memberNumber: profile.member_number,
    fullName: profile.full_name ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    role: profile.role,
    isActive: profile.is_active,
    activeFrom: profile.active_from ?? null,
    pswChanged: profile.psw_changed ?? null,
    noShowCount: profile.no_show_count,
    blockedUntil: profile.blocked_until ?? null,
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
  return search.replace(/[^a-zA-Z0-9@._\s-]/g, '')
}

function escapeLikeWildcards(term: string) {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function detectDelimiter(input: string) {
  const firstLine = input.split(/\r?\n/, 1)[0] ?? ''
  const candidates = [',', ';', '\t']
  let bestDelimiter = ','
  let bestScore = -1

  for (const delimiter of candidates) {
    const score = firstLine.split(delimiter).length
    if (score > bestScore) {
      bestDelimiter = delimiter
      bestScore = score
    }
  }

  return bestDelimiter
}

function parseCsv(input: string) {
  const rows: string[][] = []
  const delimiter = detectDelimiter(input)
  let currentField = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const nextChar = input[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentField.trim())
      currentField = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      currentRow.push(currentField.trim())
      currentField = ''
      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      continue
    }

    currentField += char
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((value) => value.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

function findHeaderIndex(headers: string[], candidates: readonly string[]) {
  return headers.findIndex((header) => candidates.includes(header))
}

function sanitizeOptionalValue(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function sanitizeOptionalUpdateValue(value: unknown) {
  if (value === null) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

function createInternalAuthEmail(memberNumber: string) {
  return `${memberNumber}@members.alea.internal`
}

function pushImportIssue(issues: MemberImportIssue[], issue: MemberImportIssue) {
  issues.push(issue)
}

export function parseMemberImportCsv(input: string): {
  totalRows: number
  normalizedRows: MemberImportRow[]
  issues: MemberImportIssue[]
} {
  const rows = parseCsv(input)
  if (rows.length === 0) {
    serviceError('Empty CSV file', 400)
  }

  const headers = rows[0].map(normalizeHeader)
  const memberNumberIndex = findHeaderIndex(headers, PROFILE_IMPORT_HEADERS.memberNumber)
  const fullNameIndex = findHeaderIndex(headers, PROFILE_IMPORT_HEADERS.fullName)

  if (memberNumberIndex === -1 || fullNameIndex === -1) {
    serviceError('CSV headers must include member number and full name columns', 400)
  }

  const emailIndex = findHeaderIndex(headers, PROFILE_IMPORT_HEADERS.email)
  const phoneIndex = findHeaderIndex(headers, PROFILE_IMPORT_HEADERS.phone)
  const normalizedRows: MemberImportRow[] = []
  const issues: MemberImportIssue[] = []
  const seenMemberNumbers = new Set<string>()
  const totalRows = Math.max(rows.length - 1, 0)

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2
    const memberNumberRaw = row[memberNumberIndex] ?? ''
    const fullNameRaw = row[fullNameIndex] ?? ''
    const memberNumberResult = memberNumberSchema.safeParse(memberNumberRaw.trim())

    if (!memberNumberResult.success) {
      pushImportIssue(issues, { rowNumber, memberNumber: memberNumberRaw || null, code: 'invalid_member_number' })
      return
    }

    const memberNumber = memberNumberResult.data
    const fullName = fullNameRaw.trim()

    if (!fullName) {
      pushImportIssue(issues, { rowNumber, memberNumber, code: 'missing_full_name' })
      return
    }

    if (seenMemberNumbers.has(memberNumber)) {
      pushImportIssue(issues, { rowNumber, memberNumber, code: 'duplicate_member_number' })
      return
    }
    seenMemberNumbers.add(memberNumber)

    normalizedRows.push({
      rowNumber,
      memberNumber,
      fullName,
      email: emailIndex === -1 ? null : sanitizeOptionalValue(row[emailIndex]),
      phone: phoneIndex === -1 ? null : sanitizeOptionalValue(row[phoneIndex]),
    })
  })

  return { totalRows, normalizedRows, issues }
}

export async function importMembersFromCsv(input: string): Promise<MemberImportResult> {
  const { totalRows, normalizedRows, issues } = parseMemberImportCsv(input)
  const admin = createSupabaseServerAdminClient()
  const profiles = admin.from('profiles') as unknown as ProfilesImportTableClient
  let createdCount = 0
  let updatedCount = 0

  for (const row of normalizedRows) {
    const { data: existing, error: selectError } = await profiles
      .select(PROFILE_COLUMNS)
      .eq('member_number', row.memberNumber)
      .maybeSingle()

    if (selectError) {
      pushImportIssue(issues, { rowNumber: row.rowNumber, memberNumber: row.memberNumber, code: 'read_existing_failed' })
      continue
    }

    if (existing) {
      const updatePayload: TablesUpdate<'profiles'> = {
        full_name: row.fullName,
      }

      if (row.email !== null) updatePayload.email = row.email
      if (row.phone !== null) updatePayload.phone = row.phone

      const { error: updateError } = await profiles
        .update(updatePayload)
        .eq('id', existing.id)
        .select(PROFILE_COLUMNS)
        .maybeSingle()

      if (updateError) {
        pushImportIssue(issues, { rowNumber: row.rowNumber, memberNumber: row.memberNumber, code: 'update_existing_failed' })
        continue
      }

      updatedCount += 1
      continue
    }

    const authEmail = createInternalAuthEmail(row.memberNumber)
    const temporaryPassword = `Temp-${crypto.randomUUID()}-Aa1`
    const { data: authData, error: createAuthError } = await admin.auth.admin.createUser({
      email: authEmail,
      password: temporaryPassword,
      email_confirm: true,
    })

    if (createAuthError || !authData.user) {
      pushImportIssue(issues, { rowNumber: row.rowNumber, memberNumber: row.memberNumber, code: 'create_auth_failed' })
      continue
    }

    const { error: updateProfileError } = await profiles
      .update({
        member_number: row.memberNumber,
        full_name: row.fullName,
        auth_email: authEmail,
        email: row.email,
        phone: row.phone,
        role: 'member',
        is_active: false,
        active_from: null,
        psw_changed: null,
      })
      .eq('id', authData.user.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle()

    if (updateProfileError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      pushImportIssue(issues, { rowNumber: row.rowNumber, memberNumber: row.memberNumber, code: 'persist_import_failed' })
      continue
    }

    createdCount += 1
  }

  return {
    totalRows,
    createdCount,
    updatedCount,
    skippedCount: issues.length,
    normalizedRows,
    issues,
  }
}

export async function listPaginatedUsers(input: {
  page: number
  limit: number
  search?: string
}): Promise<PaginatedResponse<User>> {
  const page = normalizePage(input.page)
  const limit = normalizeLimit(input.limit)
  const search = input.search?.trim() ?? ''
  const supabase = createSupabaseServerAdminClient()
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
    updates.email = sanitizeOptionalUpdateValue(body.email)
  }
  if (body.phone !== undefined) {
    updates.phone = sanitizeOptionalUpdateValue(body.phone)
  }
  if (body.role === 'admin' || body.role === 'member') updates.role = body.role
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (Object.keys(updates).length === 0) {
    serviceError('No updatable fields provided', 400)
  }

  const supabase = createSupabaseServerAdminClient()
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

export async function resetNoShows(id: string) {
  const admin = createSupabaseServerAdminClient()
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
  const admin = createSupabaseServerAdminClient()
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
