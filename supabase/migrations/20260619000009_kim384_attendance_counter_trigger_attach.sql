CREATE TRIGGER "saved_game_attendance_count" AFTER INSERT ON "public"."saved_game_attendances" FOR EACH ROW EXECUTE FUNCTION "public"."increment_saved_game_attendance"();
