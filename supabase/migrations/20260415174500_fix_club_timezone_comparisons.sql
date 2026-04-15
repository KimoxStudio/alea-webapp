-- Migration: align reservation time comparisons with the club timezone
--
-- Reservations store the business date and time as local civil values.
-- Compare them against an explicit UTC reference timestamp only after
-- converting the local slot boundary through the club timezone.

CREATE OR REPLACE FUNCTION public.get_database_time()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT now();
$$;

REVOKE EXECUTE ON FUNCTION public.get_database_time() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_database_time() TO service_role;

DROP FUNCTION IF EXISTS public.cancel_expired_pending_reservations(INTEGER);

CREATE OR REPLACE FUNCTION public.cancel_expired_pending_reservations(
  grace_minutes INTEGER DEFAULT 20,
  reference_time timestamptz DEFAULT now(),
  club_timezone text DEFAULT 'Atlantic/Canary'
)
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
    AND (
      (
        date::timestamp
        + start_time::time
        + (grace_minutes * INTERVAL '1 minute')
      ) AT TIME ZONE club_timezone
    ) < reference_time;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_expired_pending_reservations(INTEGER, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_expired_pending_reservations(INTEGER, timestamptz, text) TO service_role;

DROP FUNCTION IF EXISTS public.mark_no_show_reservations();

CREATE OR REPLACE FUNCTION public.mark_no_show_reservations(
  reference_time timestamptz DEFAULT now(),
  club_timezone text DEFAULT 'Atlantic/Canary'
)
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
    AND ((date::timestamp + end_time::time) AT TIME ZONE club_timezone) < reference_time;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_no_show_reservations(timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_no_show_reservations(timestamptz, text) TO service_role;
