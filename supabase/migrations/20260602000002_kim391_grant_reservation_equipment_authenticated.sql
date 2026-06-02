-- KIM-391: Grant table-level permissions for reservation_equipment to authenticated role
-- The 4 RLS policies added in 20260528000006 (SELECT/INSERT/UPDATE/DELETE scoped to own
-- reservations via EXISTS subquery) require a matching GRANT to take effect.
-- Without this GRANT, authenticated users cannot access the table at all (default-deny).
-- Design change: reservation_equipment now accessible to authenticated users via RLS,
-- replacing the previous service-role-only access model.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."reservation_equipment" TO "authenticated";

-- Restore performance indexes dropped in 20260528000006 (user decision: keep for performance)
CREATE INDEX IF NOT EXISTS "reservations_activation_lookup_idx" ON "public"."reservations" USING "btree" ("table_id", "date", "user_id", "status");
CREATE INDEX IF NOT EXISTS "reservations_user_date_status_idx" ON "public"."reservations" USING "btree" ("user_id", "date", "status") WHERE ("status" = ANY (ARRAY['pending'::"public"."reservation_status", 'active'::"public"."reservation_status"]));
CREATE INDEX IF NOT EXISTS "reservations_pending_no_show_idx" ON "public"."reservations" USING "btree" ("date", "end_time") WHERE (("status" = 'pending'::"public"."reservation_status") AND ("activated_at" IS NULL));
CREATE INDEX IF NOT EXISTS "reservations_pending_date_idx" ON "public"."reservations" USING "btree" ("date", "start_time") WHERE ("status" = 'pending'::"public"."reservation_status");
