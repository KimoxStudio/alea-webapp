import 'server-only'
import type { AdminPartner, Partner } from '@/lib/types'
import { getDb, getAdminDb } from '@/lib/db'
import { serviceError } from '@/lib/server/service-error'
import type { Tables } from '@/lib/supabase/types'
import type { SessionUser } from '@/lib/server/auth'
import { validateOptionalUrl } from '@/lib/validations/url'

type PartnerRow = Tables<'partners'>

const PUBLIC_PARTNER_COLUMNS = 'id, name, img_url, link_url, desc_es, desc_en, sort_order'
const ADMIN_PARTNER_COLUMNS = 'id, name, img_url, link_url, desc_es, desc_en, sort_order, active'

function toPartner(row: Pick<PartnerRow, 'id' | 'name' | 'img_url' | 'link_url' | 'desc_es' | 'desc_en' | 'sort_order'>): Partner {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.img_url,
    linkUrl: row.link_url,
    descriptionEs: row.desc_es,
    descriptionEn: row.desc_en,
    sortOrder: row.sort_order,
  }
}

function toAdminPartner(row: PartnerRow): AdminPartner {
  return { ...toPartner(row), active: row.active }
}

/**
 * Public read of active partners (colaboradores) for the landing page,
 * ordered the same way the board arranges them in the dashboard. Uses the
 * RLS-respecting client since this is unauthenticated, publicly readable
 * content — the "partners_select_active" RLS policy additionally restricts
 * anon/authenticated visibility to active rows.
 */
export async function listPartners(): Promise<Partner[]> {
  const supabase = await getDb()
  const { data, error } = await supabase
    .from('partners')
    .select(PUBLIC_PARTNER_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) serviceError('Internal server error', 500)

  const rows = (data ?? []) as PartnerRow[]
  return rows.map((row) => toPartner(row))
}

// ---------------------------------------------------------------------------
// Admin CRUD (OIR-204)
//
// Privilege checks (role === 'admin') live here in the service layer, not in
// the route handlers, so every entry point is protected regardless of how
// it's invoked. img_url/link_url are validated with the shared http(s)-only
// allowlist (lib/validations/url.ts) before any DB write — same rule as the
// OIR-203 club events service.
// ---------------------------------------------------------------------------

export interface PartnerInput {
  name?: unknown
  imageUrl?: unknown
  linkUrl?: unknown
  descriptionEs?: unknown
  descriptionEn?: unknown
  sortOrder?: unknown
  active?: unknown
}

function requireAdminSession(session: SessionUser): void {
  if (session.role !== 'admin') serviceError('Forbidden', 403)
}

function requireNonEmptyString(value: unknown, field: string): string {
  const str = typeof value === 'string' ? value.trim() : ''
  if (!str) serviceError(`${field} is required`, 400)
  return str
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') serviceError(`${field} must be a string`, 400)
  const str = value.trim()
  return str === '' ? null : str
}

/** img_url is required (NOT NULL) — unlike optionalString, empty is rejected. */
function requireImageUrl(value: unknown, current: string | null): string {
  const url = validateOptionalUrl(value, 'imageUrl') ?? (typeof current === 'string' ? current : null)
  if (!url) serviceError('imageUrl is required', 400)
  return url
}

function optionalInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(num)) serviceError(`${field} must be an integer`, 400)
  return num
}

function parseBooleanFlag(value: unknown): boolean {
  return value === true || value === 'true'
}

/**
 * OIR-206: English copy is optional — when descriptionEn is absent/empty,
 * fall back to the paired descriptionEs value so the landing still renders
 * content in the EN locale.
 *
 * Resolution rules (explicit, in priority order):
 * 1. `enProvided` and the trimmed value is non-empty → use it verbatim.
 * 2. `enProvided` and the trimmed value is empty → treat blanking as
 *    "re-enable auto-copy": return the (new) ES value.
 * 3. Not provided (`undefined`) → preserve `current.en` if it exists and
 *    differs from the OLD ES value (a deliberate edit); if `current.en`
 *    equals the OLD ES value (or there is no current row), auto-copy the
 *    new ES value.
 *
 * Rule 3's "identical EN === ES" auto-copy heuristic is safe because our
 * admin forms always resend every field: a deliberately identical EN is
 * resent explicitly on every update and is preserved by rule 1, so it never
 * falls into rule 3's heuristic path.
 */
function resolveBilingualEnFallback(
  field: string,
  esValue: string | null,
  rawEn: unknown,
  enProvided: boolean,
  current: { es: string | null; en: string | null } | null,
): string | null {
  if (enProvided) {
    // Finding 5 (mirrors optionalString): a non-string, non-null value (an
    // array, object, number…) must be rejected rather than silently treated
    // as "absent" and falling back to the ES value.
    if (rawEn !== null && typeof rawEn !== 'string') {
      serviceError(`${field} must be a string`, 400)
    }
    const trimmed = typeof rawEn === 'string' ? rawEn.trim() : ''
    return trimmed !== '' ? trimmed : esValue
  }
  if (!current) return esValue
  const wasAutoCopied = current.en === current.es
  return wasAutoCopied ? esValue : current.en
}

interface PartnerFieldSet {
  name: string
  img_url: string
  link_url: string | null
  desc_es: string | null
  desc_en: string | null
  sort_order: number
  active: boolean
}

/**
 * Resolve the full field set for a create/update, falling back to the
 * current row's values for anything omitted from the payload. `current` is
 * null for creates, where every field not provided by the caller falls back
 * to empty/required validation instead. Validation (including the URL
 * allowlist) happens here, before any DB write.
 */
function resolvePartnerFields(body: PartnerInput, current: PartnerRow | null): PartnerFieldSet {
  const name = body.name !== undefined
    ? requireNonEmptyString(body.name, 'name')
    : requireNonEmptyString(current?.name, 'name')

  const imgUrl = body.imageUrl !== undefined
    ? requireImageUrl(body.imageUrl, current?.img_url ?? null)
    : requireImageUrl(current?.img_url, current?.img_url ?? null)

  const linkUrl = body.linkUrl !== undefined ? validateOptionalUrl(body.linkUrl, 'linkUrl') : (current?.link_url ?? null)
  const descEs = body.descriptionEs !== undefined ? optionalString(body.descriptionEs, 'descriptionEs') : (current?.desc_es ?? null)
  const descEn = resolveBilingualEnFallback(
    'descriptionEn',
    descEs,
    body.descriptionEn,
    body.descriptionEn !== undefined,
    current ? { es: current.desc_es, en: current.desc_en } : null,
  )

  const sortOrder = body.sortOrder !== undefined
    ? (optionalInteger(body.sortOrder, 'sortOrder') ?? 0)
    : (current?.sort_order ?? 0)

  const active = body.active !== undefined ? parseBooleanFlag(body.active) : (current?.active ?? true)

  return {
    name,
    img_url: imgUrl,
    link_url: linkUrl,
    desc_es: descEs,
    desc_en: descEn,
    sort_order: sortOrder,
    active,
  }
}

/** Admin read of every partner (active + inactive), ordered by sort_order. */
export async function listAdminPartners(session: SessionUser): Promise<AdminPartner[]> {
  requireAdminSession(session)

  const admin = getAdminDb()
  const { data, error } = await admin
    .from('partners')
    .select(ADMIN_PARTNER_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) serviceError('Internal server error', 500)

  const rows = (data ?? []) as PartnerRow[]
  return rows.map((row) => toAdminPartner(row))
}

export async function createPartner(session: SessionUser, body: PartnerInput): Promise<AdminPartner> {
  requireAdminSession(session)

  // Validate EVERYTHING — fields and the URL allowlist — before any DB write.
  const fields = resolvePartnerFields(body, null)

  const admin = getAdminDb()
  const { data, error } = await admin
    .from('partners')
    .insert(fields)
    .select(ADMIN_PARTNER_COLUMNS)
    .maybeSingle()

  if (error) {
    const pgCode = (error as { code?: string }).code
    if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
      serviceError('Invalid partner data', 400)
    }
    serviceError('Internal server error', 500)
  }
  if (!data) serviceError('Internal server error', 500)

  return toAdminPartner(data as PartnerRow)
}

export async function updatePartner(session: SessionUser, id: string, body: PartnerInput): Promise<AdminPartner> {
  requireAdminSession(session)

  const admin = getAdminDb()
  const { data: currentData, error: fetchError } = await admin
    .from('partners')
    .select(ADMIN_PARTNER_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (fetchError) serviceError('Internal server error', 500)
  const current = currentData as PartnerRow | null
  if (!current) serviceError('Partner not found', 404)

  // Validate EVERYTHING before the UPDATE below.
  const fields = resolvePartnerFields(body, current)

  const { data, error } = await admin
    .from('partners')
    .update(fields)
    .eq('id', id)
    .select(ADMIN_PARTNER_COLUMNS)
    .maybeSingle()

  if (error) {
    const pgCode = (error as { code?: string }).code
    if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
      serviceError('Invalid partner data', 400)
    }
    serviceError('Internal server error', 500)
  }
  if (!data) serviceError('Partner not found', 404)

  return toAdminPartner(data as PartnerRow)
}

export async function deletePartner(session: SessionUser, id: string): Promise<void> {
  requireAdminSession(session)

  const admin = getAdminDb()
  const { data, error } = await admin
    .from('partners')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (error) serviceError('Internal server error', 500)
  if (!data) serviceError('Partner not found', 404)

  const { error: deleteError } = await admin.from('partners').delete().eq('id', id)
  if (deleteError) serviceError('Internal server error', 500)
}
