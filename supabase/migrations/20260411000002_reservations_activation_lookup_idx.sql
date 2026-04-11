-- Index to accelerate check-in activation lookups.
-- activateReservationByTable queries (table_id, date, user_id, status) in sequence.
CREATE INDEX IF NOT EXISTS reservations_activation_lookup_idx
  ON public.reservations (table_id, date, user_id, status);
