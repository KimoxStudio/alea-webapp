-- OIR-202: public club events for the marketing landing page.
-- This is distinct from "events" (lib/server/events-service.ts), which models
-- room-reservation blocking events for the booking platform. "club_events" is
-- public marketing content (tournaments, game nights, club history) with no PII.
CREATE TABLE "public"."club_events" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "title_es" text NOT NULL,
  "title_en" text NOT NULL,
  "blurb_es" text NOT NULL,
  "blurb_en" text NOT NULL,
  "description_es" text,
  "description_en" text,
  "date_kind" text NOT NULL DEFAULT 'single',
  "start_date" date NOT NULL,
  "end_date" date,
  "recurrence_label_es" text,
  "recurrence_label_en" text,
  "image_url" text,
  "link_url" text,
  "status" text NOT NULL DEFAULT 'upcoming',
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "club_events_valid_date_kind" CHECK ("date_kind" IN ('single', 'range', 'recurring')),
  CONSTRAINT "club_events_valid_status" CHECK ("status" IN ('upcoming', 'past')),
  CONSTRAINT "club_events_valid_date_range" CHECK ("end_date" IS NULL OR "end_date" >= "start_date")
);

CREATE INDEX "club_events_status_start_date_idx" ON "public"."club_events" ("status", "start_date" DESC);

ALTER TABLE "public"."club_events" ENABLE ROW LEVEL SECURITY;

-- Public marketing content: readable by anyone, including unauthenticated visitors.
-- No INSERT/UPDATE/DELETE policy is granted here — admin CRUD is an explicit
-- follow-up issue (folded into the existing admin dashboard) and will use the
-- admin client (createSupabaseServerAdminClient) which bypasses RLS.
CREATE POLICY "club_events_select" ON "public"."club_events" FOR SELECT TO "anon", "authenticated" USING (true);
