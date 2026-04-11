-- Migration: add function to cancel pending reservations not activated within 20 minutes
--
-- start_time is stored as VARCHAR in 'HH:MM' format (e.g. '14:00').
-- Casting 'HH:MM'::time gives a PostgreSQL TIME value which can be added to a DATE
-- to produce a TIMESTAMP. Adding the 20-minute grace period and comparing with NOW()
-- identifies reservations that should be marked as no_show.

CREATE OR REPLACE FUNCTION public.cancel_expired_pending_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.reservations
  SET status = 'no_show'
  WHERE status = 'pending'
    AND activated_at IS NULL
    AND (date::date + start_time::time + INTERVAL '20 minutes') < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Restrict execute permission: only service_role (used by the cron route handler) may call this function.
REVOKE EXECUTE ON FUNCTION public.cancel_expired_pending_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_expired_pending_reservations() TO service_role;

-- Partial index to speed up the WHERE clause used by the cron UPDATE.
-- Only indexes rows that are still pending, keeping the index small and write-cheap.
CREATE INDEX IF NOT EXISTS reservations_pending_date_idx
  ON public.reservations (date, start_time)
  WHERE status = 'pending';
