import type { ClubEvent } from '@/lib/types'
import { parseDateOnlyToLocalDate } from '@/lib/club-time'

type FormattableClubEvent = Pick<
  ClubEvent,
  'dateKind' | 'startDate' | 'endDate' | 'recurrenceLabelEs' | 'recurrenceLabelEn'
>

/**
 * Formats a ClubEvent's date/date-range/recurrence for display, locale-aware.
 * - "single": one formatted date (e.g. "5 de septiembre de 2026")
 * - "range": "{start} – {end}"
 * - "recurring": uses the pre-authored recurrence label (e.g. "Todos los jueves, 18:00–22:00")
 */
export function formatClubEventDate(event: FormattableClubEvent, locale: string): string {
  if (event.dateKind === 'recurring') {
    return (locale === 'en' ? event.recurrenceLabelEn : event.recurrenceLabelEs) ?? ''
  }

  const formatterLocale = locale === 'en' ? 'en-US' : 'es-ES'
  const dateFormatOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const start = parseDateOnlyToLocalDate(event.startDate).toLocaleDateString(formatterLocale, dateFormatOptions)

  if (event.dateKind === 'range' && event.endDate) {
    const end = parseDateOnlyToLocalDate(event.endDate).toLocaleDateString(formatterLocale, dateFormatOptions)
    return `${start} – ${end}`
  }

  return start
}
