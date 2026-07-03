-- OIR-202: extend the existing "events" table with the bilingual/display
-- metadata needed by the public marketing landing page, instead of creating
-- a separate table. "events" already models the club's calendar (used today
-- for internal room-reservation blocking via lib/server/events-service.ts);
-- this reuses it rather than duplicating a parallel model.
--
-- Supersedes the earlier standalone "club_events" table/migrations (removed
-- from this branch) per updated architecture decision.
ALTER TABLE "public"."events"
  ADD COLUMN "title_es" text,
  ADD COLUMN "title_en" text,
  ADD COLUMN "blurb_es" text,
  ADD COLUMN "blurb_en" text,
  ADD COLUMN "description_es" text,
  ADD COLUMN "description_en" text,
  ADD COLUMN "date_kind" text NOT NULL DEFAULT 'single',
  ADD COLUMN "end_date" date,
  ADD COLUMN "recurrence_label_es" text,
  ADD COLUMN "recurrence_label_en" text,
  ADD COLUMN "image_url" text,
  ADD COLUMN "link_url" text,
  ADD COLUMN "category_es" text,
  ADD COLUMN "category_en" text;

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_valid_date_kind" CHECK ("date_kind" IN ('single', 'range', 'recurring')),
  ADD CONSTRAINT "events_valid_end_date" CHECK ("end_date" IS NULL OR "end_date" >= "date");

-- Public landing content: a row becomes publicly visible once it carries
-- bilingual marketing copy. Internal admin-created room-blocking events
-- (which only ever populate the legacy single-locale "title") are never
-- exposed to anonymous visitors. No separate public/private flag column is
-- introduced — "public" is implied by the presence of title_es/title_en,
-- and "upcoming" vs "past" is derived from date/end_date at query time
-- rather than stored.
CREATE POLICY "events_select_public" ON "public"."events"
  FOR SELECT TO "anon"
  USING ("title_es" IS NOT NULL AND "title_en" IS NOT NULL);
