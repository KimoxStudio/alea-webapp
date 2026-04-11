-- Partial index to support user-level slot overlap check in createReservationForSession.
-- Covers the (user_id, date, status) filter before start_time/end_time range predicates.
-- Only indexes rows in blocking statuses ('pending', 'active') to reduce index size and write overhead.
CREATE INDEX IF NOT EXISTS reservations_user_date_status_idx
  ON public.reservations (user_id, date, status)
  WHERE status IN ('pending', 'active');
