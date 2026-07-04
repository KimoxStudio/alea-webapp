import type { MemberImportIssue, MemberImportRow } from '@/lib/types'
import { strFromU8, unzipSync } from 'fflate'
import { serviceError } from '@/lib/server/service-error'
import { memberNumberSchema } from '@/lib/validations/auth'
import ExcelJS from 'exceljs'

export type MemberImportOptionalColumnPresence = {
  email: boolean
  phone: boolean
}
export type ParsedMemberImportResult = {
  totalRows: number
  normalizedRows: MemberImportRow[]
  issues: MemberImportIssue[]
  optionalColumnPresence: MemberImportOptionalColumnPresence
}

export const PROFILE_IMPORT_HEADERS = {
  memberNumber: ['id', 'membernumber', 'member_number', 'numero de socio', 'numerodesocio'],
  fullName: ['usuarios', 'usuario', 'full name', 'fullname', 'nombre', 'name'],
  email: ['email', 'correo', 'mail'],
  phone: ['phone', 'telefono', 'teléfono', 'mobile', 'movil', 'móvil'],
} as const
export const PROFILE_IMPORT_HEADERS_NORMALIZED = {
  memberNumber: PROFILE_IMPORT_HEADERS.memberNumber.map(normalizeHeader),
  fullName: PROFILE_IMPORT_HEADERS.fullName.map(normalizeHeader),
  email: PROFILE_IMPORT_HEADERS.email.map(normalizeHeader),
  phone: PROFILE_IMPORT_HEADERS.phone.map(normalizeHeader),
} as const
export const CANONICAL_IMPORT_HEADERS = ['USUARIOS', 'ID', 'email', 'phone'] as const
export const MEMBER_IMPORT_PREVIEW_LIMIT = 50
const ACCEPTED_MEMBER_IMPORT_CONTENT_TYPES_BY_EXTENSION: Record<string, Set<string>> = {
  csv: new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel']),
  xlsx: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  odt: new Set(['application/vnd.oasis.opendocument.text']),
}

export function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function detectDelimiter(input: string) {
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

export function parseCsv(input: string) {
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

export function escapeCsvValue(value: string | null) {
  const normalized = value ?? ''
  if (!/[",\n\r]/.test(normalized)) return normalized
  return `"${normalized.replace(/"/g, '""')}"`
}

export function rowsToCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
    .join('\n')
}

export function buildCanonicalMemberImportCsv(rows: MemberImportRow[]) {
  return rowsToCsv([
    [...CANONICAL_IMPORT_HEADERS],
    ...rows.map((row) => [row.fullName, row.memberNumber, row.email ?? '', row.phone ?? '']),
  ])
}

export function getSourceExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) ?? '' : ''
}

export function tryReadArchive(bytes: Uint8Array, invalidMessage: string) {
  try {
    return unzipSync(bytes)
  } catch {
    serviceError(invalidMessage, 400)
  }
}

export function assertSourceArchiveMatchesExtension(extension: 'xlsx' | 'odt', bytes: Uint8Array) {
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

export async function extractSpreadsheetCsv(bytes: Uint8Array): Promise<string> {
  const wb = new ExcelJS.Workbook()

  try {
    await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  } catch {
    serviceError('Spreadsheet file is invalid or corrupted', 400)
  }

  if (wb.worksheets.length === 0) {
    serviceError('Spreadsheet does not contain any sheets', 400)
  }

  let firstNonEmptyCsv = ''

  for (const worksheet of wb.worksheets) {
    const rows: string[][] = []

    worksheet.eachRow({ includeEmpty: false }, (row: ExcelJS.Row) => {
      const cells: string[] = []
      const cellCount = row.cellCount

      for (let col = 1; col <= cellCount; col += 1) {
        const cell = row.getCell(col)
        const raw = cell.text ?? ''
        cells.push(raw.trim())
      }

      if (cells.some((cell) => cell.length > 0)) {
        rows.push(cells)
      }
    })

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

export function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&apos;/g, '\'')
    .replace(/&amp;/g, '&')
}

export function extractOdtCellText(input: string) {
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

export function extractOdtCsv(bytes: Uint8Array) {
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

export function findHeaderIndex(headers: string[], candidates: readonly string[]) {
  return headers.findIndex((header) => candidates.includes(header))
}

export function sanitizeOptionalValue(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export function pushImportIssue(issues: MemberImportIssue[], issue: MemberImportIssue) {
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

export async function normalizeMemberImportSource(input: {
  fileName: string
  contentType?: string | null
  bytes: Uint8Array
}): Promise<{
  totalRows: number
  normalizedRows: MemberImportRow[]
  issues: MemberImportIssue[]
  normalizedCsv: string
  optionalColumnPresence: MemberImportOptionalColumnPresence
}> {
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
    extractedCsv = await extractSpreadsheetCsv(sourceBytes)
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
