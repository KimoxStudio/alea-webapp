-- Index to support user-level slot overlap check in createReservationForSession.
-- Covers the (user_id, date, status) filter before start_time/end_time range predicates.
CREATE INDEX IF NOT EXISTS reservations_user_date_status_idx
  ON public.reservations (user_id, date, status);
