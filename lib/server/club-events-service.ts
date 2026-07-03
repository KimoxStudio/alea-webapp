import 'server-only'
import type { ClubEvent, ClubEventDateKind, ClubEventStatus } from '@/lib/types'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables } from '@/lib/supabase/types'

type ClubEventRow = Tables<'club_events'>

const CLUB_EVENT_COLUMNS = 'id, title_es, title_en, blurb_es, blurb_en, description_es, description_en, date_kind, start_date, end_date, recurrence_label_es, recurrence_label_en, image_url, link_url, status, display_order'

const DEFAULT_PAST_LIMIT = 24

function toClubEvent(row: ClubEventRow): ClubEvent {
  return {
    id: row.id,
    titleEs: row.title_es,
    titleEn: row.title_en,
    blurbEs: row.blurb_es,
    blurbEn: row.blurb_en,
    descriptionEs: row.description_es,
    descriptionEn: row.description_en,
    dateKind: row.date_kind as ClubEventDateKind,
    startDate: row.start_date,
    endDate: row.end_date,
    recurrenceLabelEs: row.recurrence_label_es,
    recurrenceLabelEn: row.recurrence_label_en,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    status: row.status as ClubEventStatus,
    displayOrder: row.display_order,
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
 * history) for the landing page. Uses the RLS-respecting client since this is
 * unauthenticated, publicly readable content — no privilege checks needed.
 */
export async function listClubEvents(options: ListClubEventsOptions = {}): Promise<ListClubEventsResult> {
  const pastLimit = options.pastLimit ?? DEFAULT_PAST_LIMIT

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('club_events')
    .select(CLUB_EVENT_COLUMNS)
    .order('display_order', { ascending: true })
    .order('start_date', { ascending: true })

  if (error) {
    serviceError('Internal server error', 500)
  }

  const rows = (data ?? []) as ClubEventRow[]
  const events = rows.map(toClubEvent)

  const upcoming = events.filter((event) => event.status === 'upcoming')
  const past = events
    .filter((event) => event.status === 'past')
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, pastLimit)

  return { upcoming, past }
}
