-- OIR-205: library_games (ludoteca highlights) shown on the public landing
-- page. Today these are hardcoded in components/landing/game-library-data.ts
-- — moving them to the DB lets the board manage the featured games from the
-- dashboard without a deploy. Same RLS/grant shape as public.partners
-- (public SELECT restricted to "active" content, writes via service_role
-- only through the admin service layer).
CREATE TABLE "public"."library_games" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "category_es" text NOT NULL,
  "category_en" text NOT NULL,
  "players" text NOT NULL,
  "play_time" text NOT NULL,
  "weight" numeric(2,1) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."library_games" ENABLE ROW LEVEL SECURITY;

-- Public read: anon + authenticated visitors only ever see active games.
-- No INSERT/UPDATE/DELETE policies are defined — writes go exclusively
-- through the service_role client (lib/server/library-games-service.ts),
-- which bypasses RLS via createSupabaseServerAdminClient().
CREATE POLICY "library_games_select_active" ON "public"."library_games"
  FOR SELECT TO "anon", "authenticated"
  USING ("active" = true);

GRANT SELECT ON TABLE "public"."library_games" TO "anon", "authenticated";

-- Seed: the 8 featured games from components/landing/game-library-data.ts,
-- preserving today's landing display order via sort_order (0-based, matches
-- array index in the source file). The single-language "category" from the
-- source data is split into its ES/EN pair.
INSERT INTO "public"."library_games"
  ("title", "category_es", "category_en", "players", "play_time", "weight", "sort_order")
VALUES
  ('Bolt Action', 'Wargame', 'Wargame', '2', '120m', 3.2, 0),
  ('Pathfinder 2e', 'Rol', 'RPG', '3–6', '∞', 4.1, 1),
  ('Warhammer 40K', 'Wargame', 'Wargame', '2', '150m', 4.4, 2),
  ('Blood on the Clocktower', 'Deducción', 'Deduction', '5–20', '180m', 2.7, 3),
  ('Cascadia', 'Familiar', 'Family', '1–4', '45m', 1.9, 4),
  ('Heat: Pedal to the Metal', 'Carreras', 'Racing', '2–6', '60m', 2.4, 5),
  ('Dune: Imperium', 'Estrategia', 'Strategy', '1–4', '90m', 3.0, 6),
  ('Blood Bowl', 'Deportes', 'Sports', '2', '90m', 3.0, 7);
