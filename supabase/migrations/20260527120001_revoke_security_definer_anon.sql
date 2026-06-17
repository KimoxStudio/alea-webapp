-- Revoke EXECUTE permission on SECURITY DEFINER functions from anon role.
-- KIM-391: Fix remaining Supabase security linter warnings.
-- These functions are SECURITY DEFINER and should not be callable by anonymous users.
-- Note: cancel_expired_pending_reservations was dropped in KIM-366, omitted here.

REVOKE EXECUTE ON FUNCTION "public"."create_event_atomic"("p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean) FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."get_database_time"() FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."mark_no_show_reservations"("reference_time" timestamp with time zone, "club_timezone" "text") FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."update_event_atomic"("p_id" "uuid", "p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean) FROM "anon";
