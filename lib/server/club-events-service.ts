import 'server-only'
import type { ClubEvent, ClubEventDateKind, ClubEventStatus } from '@/lib/types'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import { getCurrentClubDate } from '@/lib/club-time'
import type { Tables } from '@/lib/supabase/types'

type EventRow = Tables<'events'>

const CLUB_EVENT_COLUMNS = 'id, title_es, title_en, blurb_es, blurb_en, description_es, description_en, date_kind, date, end_date, recurrence_label_es, recurrence_label_en, image_url, link_url'

const DEFAULT_PAST_LIMIT = 24

/**
 * "Upcoming" vs "past" is derived from date/end_date at read time rather than
 * stored — a recurring event (e.g. "every Friday") is always upcoming since
 * it has no defined end.
 */
function statusFor(row: Pick<EventRow, 'date_kind' | 'date' | 'end_date'>, today: string): ClubEventStatus {
  if (row.date_kind === 'recurring') return 'upcoming'
  const referenceDate = row.end_date ?? row.date
  return referenceDate < today ? 'past' : 'upcoming'
}

function toClubEvent(row: EventRow, today: string): ClubEvent {
  return {
    id: row.id,
    titleEs: row.title_es ?? row.title,
    titleEn: row.title_en ?? row.title,
    blurbEs: row.blurb_es ?? '',
    blurbEn: row.blurb_en ?? '',
    descriptionEs: row.description_es,
    descriptionEn: row.description_en,
    dateKind: (row.date_kind as ClubEventDateKind) ?? 'single',
    startDate: row.date,
    endDate: row.end_date,
    recurrenceLabelEs: row.recurrence_label_es,
    recurrenceLabelEn: row.recurrence_label_en,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    status: statusFor(row, today),
  }
}

export interface ListClubEventsOptions {
  /** Maximum number of past events to return (most recent first). Defaults to 24. */
  pastLimit?: number
}

export interface ListClubEventsResult {
  upcoming: ClubEvent[]
  past: ClubEvent[]
}

/**
 * Public read of club marketing events (tournaments, game nights, club
 * history) for the landing page. These live in the same "events" table used
 * for internal room-reservation blocking (lib/server/events-service.ts) —
 * a row is landing-eligible once it carries bilingual copy (title_es/title_en).
 * Uses the RLS-respecting client since this is unauthenticated, publicly
 * readable content; the "events_select_public" RLS policy additionally
 * restricts anon visibility to rows with bilingual copy populated.
 */
export async function listClubEvents(options: ListClubEventsOptions = {}): Promise<ListClubEventsResult> {
  const pastLimit = options.pastLimit ?? DEFAULT_PAST_LIMIT
  const today = getCurrentClubDate()

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('events')
    .select(CLUB_EVENT_COLUMNS)
    .not('title_es', 'is', null)
    .not('title_en', 'is', null)
    .order('date', { ascending: true })

  if (error) {
    serviceError('Internal server error', 500)
  }

  const rows = (data ?? []) as EventRow[]
  const events = rows.map((row) => toClubEvent(row, today))

  const upcoming = events.filter((event) => event.status === 'upcoming')
  const past = events
    .filter((event) => event.status === 'past')
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, pastLimit)

  return { upcoming, past }
}
