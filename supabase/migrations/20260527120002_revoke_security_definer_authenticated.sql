-- Revoke EXECUTE permission on SECURITY DEFINER functions from authenticated role.
-- KIM-391: Fix remaining Supabase security linter warnings.
-- These 9 functions are SECURITY DEFINER and should not be directly callable by authenticated users;
-- they should be invoked through API routes or RPC calls with proper authorization checks.

REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"("grace_minutes" integer, "reference_time" timestamp with time zone, "club_timezone" "text") FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."create_event_atomic"("p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."get_database_time"() FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."mark_no_show_reservations"("reference_time" timestamp with time zone, "club_timezone" "text") FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."update_event_atomic"("p_id" "uuid", "p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean) FROM "authenticated";
