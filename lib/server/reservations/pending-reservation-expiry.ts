import { zonedDateTimeToUtc } from '@/lib/club-time'

export const CHECK_IN_LATE_MINUTES = 60

type PendingReservationSlot = {
  date: string
  start_time: string
  end_time: string
}

export function getPendingCheckInDeadline(reservation: PendingReservationSlot): Date {
  const start = zonedDateTimeToUtc(reservation.date, reservation.start_time)
  const end = zonedDateTimeToUtc(reservation.date, reservation.end_time)
  const lateDeadline = new Date(start.getTime() + CHECK_IN_LATE_MINUTES * 60 * 1000)

  return lateDeadline < end ? lateDeadline : end
}

export function isPendingReservationExpired(
  reservation: PendingReservationSlot,
  now: Date,
): boolean {
  return now.getTime() > getPendingCheckInDeadline(reservation).getTime()
}
