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
  SET status = 'cancelled'
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
