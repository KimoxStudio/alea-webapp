import type { MemberImportIssue, MemberImportResult, MemberImportRow, PaginatedResponse, User } from '@/lib/types'
import { strFromU8, unzipSync } from 'fflate'
import { createSupabaseServerAdminClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables, TablesUpdate } from '@/lib/supabase/types'
import { memberNumberSchema } from '@/lib/validations/auth'
import { read, utils } from 'xlsx'

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
type MemberImportOptionalColumnPresence = {
  email: boolean
  phone: boolean
}
type ParsedMemberImportResult = {
  totalRows: number
  normalizedRows: MemberImportRow[]
  issues: MemberImportIssue[]
  optionalColumnPresence: MemberImportOptionalColumnPresence
}
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
type AuthAdminClient = {
  updateUserById: (id: string, attributes: { email: string }) => Promise<{ error: unknown | null }>
}

const PROFILE_COLUMNS = 'id, member_number, full_name, auth_email, email, phone, role, is_active, active_from, psw_changed, no_show_count, blocked_until, created_at, updated_at'
const PROFILE_IMPORT_HEADERS = {
  memberNumber: ['id', 'membernumber', 'member_number', 'numero de socio', 'numerodesocio'],
  fullName: ['usuarios', 'usuario', 'full name', 'fullname', 'nombre', 'name'],
  email: ['email', 'correo', 'mail'],
  phone: ['phone', 'telefono', 'teléfono', 'mobile', 'movil', 'móvil'],
} as const
const PROFILE_IMPORT_HEADERS_NORMALIZED = {
  memberNumber: PROFILE_IMPORT_HEADERS.memberNumber.map(normalizeHeader),
  fullName: PROFILE_IMPORT_HEADERS.fullName.map(normalizeHeader),
  email: PROFILE_IMPORT_HEADERS.email.map(normalizeHeader),
  phone: PROFILE_IMPORT_HEADERS.phone.map(normalizeHeader),
} as const
const CANONICAL_IMPORT_HEADERS = ['USUARIOS', 'ID', 'email', 'phone'] as const
const MEMBER_IMPORT_PREVIEW_LIMIT = 50
const ACCEPTED_MEMBER_IMPORT_CONTENT_TYPES_BY_EXTENSION: Record<string, Set<string>> = {
  csv: new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel']),
  xlsx: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  odt: new Set(['application/vnd.oasis.opendocument.text']),
}

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

function escapeCsvValue(value: string | null) {
  const normalized = value ?? ''
  if (!/[",\n\r]/.test(normalized)) return normalized
  return `"${normalized.replace(/"/g, '""')}"`
}

function rowsToCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
    .join('\n')
}

function buildCanonicalMemberImportCsv(rows: MemberImportRow[]) {
  return rowsToCsv([
    [...CANONICAL_IMPORT_HEADERS],
    ...rows.map((row) => [row.fullName, row.memberNumber, row.email ?? '', row.phone ?? '']),
  ])
}

function getSourceExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) ?? '' : ''
}

function tryReadArchive(bytes: Uint8Array, invalidMessage: string) {
  try {
    return unzipSync(bytes)
  } catch {
    serviceError(invalidMessage, 400)
  }
}

function assertSourceArchiveMatchesExtension(extension: 'xlsx' | 'odt', bytes: Uint8Array) {
  const archive = tryReadArchive(bytes, `${extension.toUpperCase()} file is invalid or corrupted`)

  if (extension === 'xlsx') {
    const hasWorkbook = Object.keys(archive).some((fileName) => (
      fileName === 'xl/workbook.xml'
      || fileName === '/xl/workbook.xml'
      || fileName.endsWith('/xl/workbook.xml')
    ))
    const hasContentTypes = Object.keys(archive).some((fileName) => (
      fileName === '[Content_Types].xml'
      || fileName === '/[Content_Types].xml'
      || fileName.endsWith('/[Content_Types].xml')
    ))

    if (!hasWorkbook || !hasContentTypes) {
      serviceError('Import file content does not match the .xlsx extension.', 400)
    }
    return
  }

  const mimetypeEntry = archive.mimetype
    ?? archive['/mimetype']
    ?? Object.entries(archive).find(([fileName]) => fileName.endsWith('/mimetype'))?.[1]
  const mimetype = mimetypeEntry ? strFromU8(mimetypeEntry).trim() : ''

  if (mimetype && mimetype !== 'application/vnd.oasis.opendocument.text') {
    serviceError('Import file content does not match the .odt extension.', 400)
  }
  if (!archive['content.xml'] && !archive['/content.xml'] && !Object.keys(archive).some((fileName) => fileName.endsWith('content.xml'))) {
    serviceError('Import file content does not match the .odt extension.', 400)
  }
}

function extractSpreadsheetCsv(bytes: Uint8Array) {
  let workbook: ReturnType<typeof read>

  try {
    workbook = read(bytes, { type: 'array', cellText: false, cellDates: false })
  } catch {
    serviceError('Spreadsheet file is invalid or corrupted', 400)
  }

  if (workbook.SheetNames.length === 0) {
    serviceError('Spreadsheet does not contain any sheets', 400)
  }

  let firstNonEmptyCsv = ''

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    })
      .map((row) => row.map((cell) => String(cell ?? '').trim()))
      .filter((row) => row.some((cell) => cell.length > 0))

    if (rows.length === 0) continue

    const csv = rowsToCsv(rows)
    if (!firstNonEmptyCsv) {
      firstNonEmptyCsv = csv
    }

    try {
      parseMemberImportCsv(csv)
      return csv
    } catch {
      continue
    }
  }

  if (firstNonEmptyCsv) {
    return firstNonEmptyCsv
  }

  serviceError('Spreadsheet is empty', 400)
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&apos;/g, '\'')
    .replace(/&amp;/g, '&')
}

function extractOdtCellText(input: string) {
  const withSpacing = input
    .replace(/<text:line-break\s*\/>/g, '\n')
    .replace(/<text:tab\s*\/>/g, '\t')
    .replace(/<text:s(?:\s+[^>]*?text:c="(\d+)")?[^>]*\/>/g, (_match, count) => ' '.repeat(Number(count ?? 1)))

  const paragraphs = Array.from(withSpacing.matchAll(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g))
    .map((match) => decodeXmlEntities(match[1].replace(/<[^>]+>/g, '').trim()))
    .filter((value) => value.length > 0)

  if (paragraphs.length > 0) return paragraphs.join(' ')

  const plainText = decodeXmlEntities(withSpacing.replace(/<[^>]+>/g, '').trim())
  return plainText
}

function extractOdtCsv(bytes: Uint8Array) {
  const archive = tryReadArchive(bytes, 'ODT file is invalid or corrupted')

  const contentXml = archive['content.xml']
    ?? archive['/content.xml']
    ?? Object.entries(archive).find(([fileName]) => fileName.endsWith('content.xml'))?.[1]

  if (!contentXml) {
    serviceError('ODT file is missing content.xml', 400)
  }

  const xml = strFromU8(contentXml)
  const rows: string[][] = []

  for (const rowMatch of xml.matchAll(/<table:table-row\b([^>]*)>([\s\S]*?)<\/table:table-row>/g)) {
    const row: string[] = []
    const rowRepeatMatch = rowMatch[1].match(/table:number-rows-repeated="(\d+)"/)
    const rowRepeats = Math.max(1, Number.parseInt(rowRepeatMatch?.[1] ?? '1', 10) || 1)

    for (const cellMatch of rowMatch[2].matchAll(/<table:table-cell\b([^>]*?)(?:>([\s\S]*?)<\/table:table-cell>|\s*\/>)/g)) {
      const repeatMatch = cellMatch[1].match(/table:number-columns-repeated="(\d+)"/)
      const repeats = Math.max(1, Number.parseInt(repeatMatch?.[1] ?? '1', 10) || 1)
      const cellText = extractOdtCellText(cellMatch[2] ?? '')

      for (let index = 0; index < repeats; index += 1) {
        row.push(cellText)
      }
    }

    if (row.some((cell) => cell.trim().length > 0)) {
      const normalizedRow = row.map((cell) => cell.trim())
      for (let index = 0; index < rowRepeats; index += 1) {
        rows.push([...normalizedRow])
      }
    }
  }

  if (rows.length === 0) {
    serviceError('ODT file does not contain any importable table rows', 400)
  }

  return rowsToCsv(rows)
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

function assertNullableStringField(value: unknown, fieldName: string) {
  if (value !== null && typeof value !== 'string') {
    serviceError(`${fieldName} must be a string or null`, 400)
  }
}

function createInternalAuthEmail(memberNumber: string) {
  return `${memberNumber}@members.alea.internal`
}

function pushImportIssue(issues: MemberImportIssue[], issue: MemberImportIssue) {
  issues.push(issue)
}

export function parseMemberImportCsv(input: string): ParsedMemberImportResult {
  const rows = parseCsv(input)
  if (rows.length === 0) {
    serviceError('Empty CSV file', 400)
  }

  const headers = rows[0].map(normalizeHeader)
  const memberNumberIndex = findHeaderIndex(headers, PROFILE_IMPORT_HEADERS_NORMALIZED.memberNumber)
  const fullNameIndex = findHeaderIndex(headers, PROFILE_IMPORT_HEADERS_NORMALIZED.fullName)

  if (memberNumberIndex === -1 || fullNameIndex === -1) {
    serviceError('CSV headers must include member number and full name columns', 400)
  }

  const emailIndex = findHeaderIndex(headers, PROFILE_IMPORT_HEADERS_NORMALIZED.email)
  const phoneIndex = findHeaderIndex(headers, PROFILE_IMPORT_HEADERS_NORMALIZED.phone)
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

  return {
    totalRows,
    normalizedRows,
    issues,
    optionalColumnPresence: {
      email: emailIndex !== -1,
      phone: phoneIndex !== -1,
    },
  }
}

export function normalizeMemberImportSource(input: {
  fileName: string
  contentType?: string | null
  bytes: Uint8Array
}): {
  totalRows: number
  normalizedRows: MemberImportRow[]
  issues: MemberImportIssue[]
  normalizedCsv: string
  optionalColumnPresence: MemberImportOptionalColumnPresence
} {
  const extension = getSourceExtension(input.fileName)
  const normalizedContentType = input.contentType?.trim() ?? ''
  const allowedContentTypes = ACCEPTED_MEMBER_IMPORT_CONTENT_TYPES_BY_EXTENSION[extension]

  if (!allowedContentTypes) {
    serviceError('Unsupported import file type. Upload CSV, XLSX, or ODT.', 400)
  }
  if (normalizedContentType && !allowedContentTypes.has(normalizedContentType)) {
    serviceError('Import file extension and MIME type do not match.', 400)
  }

  const sourceBytes = input.bytes.slice()
  let extractedCsv = ''

  if (extension === 'csv') {
    extractedCsv = new TextDecoder('utf-8').decode(sourceBytes).trim()
  } else if (extension === 'xlsx') {
    assertSourceArchiveMatchesExtension('xlsx', sourceBytes)
    extractedCsv = extractSpreadsheetCsv(sourceBytes)
  } else if (extension === 'odt') {
    assertSourceArchiveMatchesExtension('odt', sourceBytes)
    extractedCsv = extractOdtCsv(sourceBytes)
  } else {
    serviceError('Unsupported import file type. Upload CSV, XLSX, or ODT.', 400)
  }

  if (!extractedCsv) {
    serviceError('Import file is empty', 400)
  }

  const parsed = parseMemberImportCsv(extractedCsv)
  return {
    ...parsed,
    normalizedCsv: buildCanonicalMemberImportCsv(parsed.normalizedRows),
  }
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
  const admin = createSupabaseServerAdminClient()
  const profiles = admin.from('profiles') as unknown as ProfilesImportTableClient
  const authAdmin = admin.auth.admin as AuthAdminClient
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
    const { data: authData, error: createAuthError } = await admin.auth.admin.createUser({
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
      await admin.auth.admin.deleteUser(authData.user.id)
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
  const normalized = normalizeMemberImportSource(input)
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

  const supabase = createSupabaseServerAdminClient()
  const profiles = supabase.from('profiles') as unknown as ProfilesTableClient
  const authAdmin = supabase.auth.admin as AuthAdminClient
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
    const { error: authUpdateError } = await authAdmin.updateUserById(id, { email: updates.auth_email })

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
