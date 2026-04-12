-- Migration: add function to mark pending reservations as no_show after session end time
--
-- end_time is stored as TIME NOT NULL in 'HH:MM:SS' format (e.g. '22:00:00').
-- Casting end_time::time gives a PostgreSQL TIME value which can be added to a DATE
-- to produce a TIMESTAMP. Comparing with NOW() identifies reservations where the
-- session has completely ended but the reservation was never activated.
--
-- This complements cancel_expired_pending_reservations (which marks no_show after
-- start_time + grace_minutes). This function handles any residual pending
-- reservations that remain after the full session end time has passed.

CREATE OR REPLACE FUNCTION public.mark_no_show_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.reservations
  SET status = 'no_show'
  WHERE status = 'pending'
    AND activated_at IS NULL
    AND (date::date + end_time::time) < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Restrict execute permission: only service_role (used by the cron route handler) may call this function.
REVOKE EXECUTE ON FUNCTION public.mark_no_show_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_no_show_reservations() TO service_role;
