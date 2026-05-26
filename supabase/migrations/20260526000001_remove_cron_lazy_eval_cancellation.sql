-- Remove cron-based auto-cancellation infrastructure (KIM-366)
-- Expired pending reservations are now handled via lazy evaluation at query time

-- Drop the cancel_expired_pending_reservations function (no longer needed)
DROP FUNCTION IF EXISTS "public"."cancel_expired_pending_reservations"(
  "grace_minutes" integer,
  "reference_time" timestamp with time zone,
  "club_timezone" "text"
);

-- Note: No pg_cron scheduled job exists to drop (function was never scheduled)
-- The /api/cron/cancel-pending endpoint now returns HTTP 410 Gone
