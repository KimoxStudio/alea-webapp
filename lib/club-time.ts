const DEFAULT_CLUB_TIMEZONE = 'Atlantic/Canary'
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>()

export const CLUB_TIMEZONE = (
  process.env.NEXT_PUBLIC_CLUB_TIMEZONE ??
  process.env.CLUB_TIMEZONE ??
  DEFAULT_CLUB_TIMEZONE
)

function getDateFormatter(timeZone: string) {
  let formatter = dateFormatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    dateFormatterCache.set(timeZone, formatter)
  }
  return formatter
}

function getDateTimeFormatter(timeZone: string) {
  let formatter = dateTimeFormatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    dateTimeFormatterCache.set(timeZone, formatter)
  }
  return formatter
}

function getFormatterParts(date: Date, timeZone: string) {
  const parts = getDateTimeFormatter(timeZone).formatToParts(date)
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, parseInt(part.value, 10)]),
  )
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getFormatterParts(date, timeZone)
  const normalizedHour = parts.hour === 24 ? 0 : parts.hour!
  const asUtc = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    normalizedHour,
    parts.minute!,
    parts.second!,
    0,
  )
  return asUtc - date.getTime()
}

export function isValidDateOnlyString(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const candidate = new Date(Date.UTC(year!, month! - 1, day!))

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month! - 1 &&
    candidate.getUTCDate() === day
  )
}

export function parseDateOnlyToLocalDate(value: string) {
  if (!isValidDateOnlyString(value)) {
    throw new Error(`Invalid date-only value: ${value}`)
  }

  const [year, month, day] = value.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

export function formatDateOnly(value: string, locale = 'es-ES') {
  return parseDateOnlyToLocalDate(value).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getCurrentClubDate(now: Date = new Date(), timeZone = CLUB_TIMEZONE) {
  return getDateFormatter(timeZone).format(now)
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone = CLUB_TIMEZONE) {
  if (!isValidDateOnlyString(date)) {
    throw new Error(`Invalid date-only value: ${date}`)
  }

  if (time === '24:00' || time === '24:00:00') {
    const [year, month, day] = date.split('-').map(Number)
    const nextDay = new Date(Date.UTC(year!, month! - 1, day! + 1, 0, 0, 0, 0))
    const nextDate = nextDay.toISOString().slice(0, 10)
    return zonedDateTimeToUtc(nextDate, '00:00:00', timeZone)
  }

  const match = time.match(TIME_PATTERN)
  if (!match) {
    throw new Error(`Invalid time value: ${time}`)
  }

  const [year, month, day] = date.split('-').map(Number)
  const hour = parseInt(match[1]!, 10)
  const minute = parseInt(match[2]!, 10)
  const second = parseInt(match[3] ?? '0', 10)

  const utcGuess = Date.UTC(year!, month! - 1, day!, hour, minute, second, 0)
  let offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
  let result = new Date(utcGuess - offsetMs)
  const settledOffsetMs = getTimeZoneOffsetMs(result, timeZone)

  if (settledOffsetMs !== offsetMs) {
    result = new Date(utcGuess - settledOffsetMs)
  }

  return result
}
