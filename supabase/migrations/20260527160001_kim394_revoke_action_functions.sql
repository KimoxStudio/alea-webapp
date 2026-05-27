-- KIM-394: Force revoke EXECUTE on action functions from anon/authenticated
-- cancel_expired_pending_reservations and handle_new_user must not be callable via /rpc/

REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"() FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"() FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "authenticated";
