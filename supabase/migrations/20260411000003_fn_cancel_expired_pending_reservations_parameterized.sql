-- Migration: parameterize grace_minutes in cancel_expired_pending_reservations
--
-- Replaces the hardcoded INTERVAL '20 minutes' with a grace_minutes parameter
-- (default 20) so the TypeScript constant GRACE_PERIOD_MINUTES and the SQL
-- function stay in sync via the RPC call site.
--
-- start_time is stored as TIME NOT NULL in 'HH:MM:SS' format (e.g. '14:00:00').
-- Casting start_time::time gives a PostgreSQL TIME value which can be added to a DATE
-- to produce a TIMESTAMP. Adding the grace period and comparing with NOW()
-- identifies reservations that should be marked as no_show.

CREATE OR REPLACE FUNCTION public.cancel_expired_pending_reservations(grace_minutes INTEGER DEFAULT 20)
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
    AND (date::date + start_time::time + (grace_minutes * INTERVAL '1 minute')) < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Restrict execute permission: only service_role (used by the cron route handler) may call this function.
REVOKE EXECUTE ON FUNCTION public.cancel_expired_pending_reservations(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_expired_pending_reservations(INTEGER) TO service_role;
