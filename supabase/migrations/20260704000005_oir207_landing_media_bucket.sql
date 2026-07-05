-- OIR-207: image upload from device to Supabase Storage for landing content
-- (club events, partners, game library). Creates the "landing-media" bucket
-- (public read, no client writes) and adds the optional img_url column to
-- library_games so featured games can show an uploaded cover image, mirroring
-- the existing partners.img_url / events image_url pattern.

-- Public bucket: file uploads always go through the service_role client
-- (lib/server/uploads-service.ts), which bypasses RLS/storage policies —
-- there are intentionally no client INSERT/UPDATE/DELETE policies below.
-- ON CONFLICT DO UPDATE keeps this migration idempotent/re-runnable AND
-- converges a pre-existing "landing-media" bucket (e.g. created manually,
-- or by an older migration) back to the intended security-relevant
-- configuration instead of silently leaving stale settings in place.
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES (
  'landing-media',
  'landing-media',
  true,
  5242880, -- 5 MB, mirrors the service-layer limit enforced in uploads-service.ts
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT ("id") DO UPDATE SET
  "public" = true,
  "file_size_limit" = 5242880,
  "allowed_mime_types" = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Public read: anon + authenticated visitors can read any object in this
-- bucket only (uploaded event/partner/game images are public landing
-- content by design). No write policies are defined — writes go exclusively
-- through the service_role client, which bypasses storage RLS entirely.
DROP POLICY IF EXISTS "landing_media_select_public" ON "storage"."objects";
CREATE POLICY "landing_media_select_public" ON "storage"."objects"
  FOR SELECT TO "anon", "authenticated"
  USING ("bucket_id" = 'landing-media');

-- Optional cover image for featured library games (ludoteca), same shape as
-- partners.img_url but nullable — existing games render the gradient cover
-- fallback until the board uploads/sets an image.
ALTER TABLE "public"."library_games" ADD COLUMN IF NOT EXISTS "img_url" text;
