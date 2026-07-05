-- OIR-204: partners (colaboradores) shown on the public landing page.
-- Today these are hardcoded in components/landing/partners-data.ts — moving
-- them to the DB lets the board manage partners from the dashboard without a
-- deploy. Same RLS/grant shape as public.events' landing-visible rows
-- (public SELECT restricted to "active" content, writes via service_role
-- only through the admin service layer).
CREATE TABLE "public"."partners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "img_url" text NOT NULL,
  "link_url" text,
  "desc_es" text,
  "desc_en" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."partners" ENABLE ROW LEVEL SECURITY;

-- Public read: anon + authenticated visitors only ever see active partners.
-- No INSERT/UPDATE/DELETE policies are defined — writes go exclusively
-- through the service_role client (lib/server/partners-service.ts), which
-- bypasses RLS via createSupabaseServerAdminClient().
CREATE POLICY "partners_select_active" ON "public"."partners"
  FOR SELECT TO "anon", "authenticated"
  USING ("active" = true);

GRANT SELECT ON TABLE "public"."partners" TO "anon", "authenticated";

-- Seed: all current partners from components/landing/partners-data.ts,
-- preserving today's landing display order via sort_order (0-based, matches
-- array index in the source file).
INSERT INTO "public"."partners"
  ("name", "img_url", "link_url", "desc_es", "desc_en", "sort_order")
VALUES
  ('Amantis Informática', 'https://alealaspalmas.es/wp-content/uploads/2025/10/amantisinformatica.png', 'https://maps.app.goo.gl/KPiF4nxabjBYu8YA6', 'Tienda de informática: ordenadores a medida, portátiles, móviles, tablets y mucho más.', 'Computer store: custom PCs, laptops, phones, tablets and more.', 0),
  ('El Desván del Leprechaun', 'https://alealaspalmas.es/wp-content/uploads/2025/10/eldesvandelleprechaun.png', 'https://maps.app.goo.gl/CM96Gnighr4YGMbC7', 'Videojuegos, anime, manga, series y películas míticas.', 'Video games, anime, manga, classic TV and film.', 1),
  ('Friki Bar', 'https://alealaspalmas.es/wp-content/uploads/2026/03/FrikiBar.png', 'https://maps.app.goo.gl/i8yYakbETaJWTx197', 'Bar-cafetería alternativa: videojuegos, juegos de mesa, rol, cómics y decoración 100 % única.', 'Alternative café: video games, board games, RPGs, comics — fully themed.', 2),
  ('El Bastión del Sur', 'https://alealaspalmas.es/wp-content/uploads/2025/10/elbationdelsur.png', 'https://maps.app.goo.gl/VH1ugGjcKhaZpA8i8', 'Productos relacionados con videojuegos, anime, manga, series y películas míticas.', 'Video games, anime, manga, TV and film merchandise.', 3),
  ('La Galería Bellas Artes', 'https://alealaspalmas.es/wp-content/uploads/2025/10/lagaleriadebellasartes--300x103.png', 'https://maps.app.goo.gl/FGjD5c5x6QsAHGif9', 'Bellas artes: materiales de arte, manualidades, modelismo y scrapbooking.', 'Fine art store: art supplies, crafts, modelling and scrapbooking.', 4),
  ('NOVAilusión', 'https://alealaspalmas.es/wp-content/uploads/2026/03/NovaIlusion.png', 'https://maps.app.goo.gl/h1K93SkEPfcrdhg56', 'Juguetería y librería: juegos de mesa, madera, cuentos, manualidades y puericultura.', 'Toys & books: board games, wooden toys, kids'' books, crafts and parenting.', 5),
  ('Jugueterías LIFER', 'https://alealaspalmas.es/wp-content/uploads/2026/03/lifer-white.png', 'https://maps.app.goo.gl/j44Ls2e65vyUNXFEA', 'Empresa familiar canaria: red de jugueterías especializadas en juegos, didáctica y libros.', 'Family-run Canarian chain: specialised toy stores, learning material and books.', 6),
  ('Shintori II', 'https://alealaspalmas.es/wp-content/uploads/2026/03/Shintori-1024x375.png', 'https://maps.app.goo.gl/Jz6EF2jeWv4GSqpg9', 'Restaurante buffet a la carta: cocina china y japonesa.', 'All-you-can-eat à-la-carte: Chinese & Japanese cuisine.', 7),
  ('TCGuti', 'https://alealaspalmas.es/wp-content/uploads/2026/03/TCGUTI-1-1.png', 'https://maps.app.goo.gl/wKXMW3RBdXvd55eJ8', 'Coleccionismo: Funko Pops, juegos de mesa, Magic, Pokémon, Yu-Gi-Oh!, Lorcana y más.', 'Collectibles: Funko Pops, board games, Magic, Pokémon, Yu-Gi-Oh!, Lorcana and more.', 8),
  ('Juguetería Peluso', 'https://alealaspalmas.es/wp-content/uploads/2026/03/Peluso.png', 'https://maps.app.goo.gl/bPhyoUJFbeDs4pht8', 'Una idea cocinada a fuego lento: jugar y fascinar al público más exquisito, los niños.', 'Slow-cooked toy shop with one goal: delighting the most demanding crowd — kids.', 9),
  ('Comic y Mazmorras', 'https://alealaspalmas.es/wp-content/uploads/2025/11/comicy-mazmorras.png', 'https://maps.app.goo.gl/GMHQg1wfJ5aB1NfP6', 'Cómics, juegos de mesa, miniaturas y merchandise.', 'Comics, board games, miniatures and merchandise.', 10),
  ('Ludens', 'https://alealaspalmas.es/wp-content/uploads/2025/10/asociacionlundens.png', 'https://www.instagram.com/asoludens/', 'Asociación para la divulgación de los juegos de mesa como herramienta socioeducativa.', 'Non-profit promoting board games as a socio-educational tool.', 11),
  ('Samurai Cat Studio', 'https://alealaspalmas.es/wp-content/uploads/2025/10/samuraicat.png', 'https://www.instagram.com/samuraicatstudio/', 'Taller de impresión 3D y tienda de coleccionables de rol, videojuegos y fantasía.', '3D-print workshop & store for RPG, video game and fantasy collectibles.', 12),
  ('Level Up', 'https://alealaspalmas.es/wp-content/uploads/2025/10/levelup.png', 'https://maps.app.goo.gl/v5GzQPrSfDoqMWGd8', 'Juegos de mesa, cartas, miniaturas y rol. Ven a probarlos y disfrutarlos.', 'Board games, card games, miniatures and TTRPGs. Come and try them.', 13),
  ('La Comarca Games', 'https://alealaspalmas.es/wp-content/uploads/2025/10/lacomarca.png', 'https://maps.app.goo.gl/Kpw7utWtqKY1bqbp7', 'Juegos de tablero, cartas, rol y wargames en Las Palmas de Gran Canaria.', 'Board games, card games, RPGs and wargames in Las Palmas.', 14),
  ('La Gruta del Goblin', 'https://alealaspalmas.es/wp-content/uploads/2025/10/lagrutadelgoblin-.png', 'https://maps.app.goo.gl/yxy89D1hHWpoXg6a6', 'Cómics, manga, libros, merchandising, juegos de mesa, wargames, pinturas, Magic, etc.', 'Comics, manga, books, merch, board games, wargames, paints, Magic, etc.', 15),
  ('La Fortaleza', 'https://alealaspalmas.es/wp-content/uploads/2025/10/lafortaleza-.png', 'https://maps.app.goo.gl/kv2DdkJARASkubWK8', 'Ordenadores, juegos, cartas, merchandising, wargames y centro de juegos.', 'Computers, games, cards, merch, wargames and play centre.', 16),
  ('La Forja 3D Lab', 'https://alealaspalmas.es/wp-content/uploads/2025/11/LaForja.png', 'https://maps.app.goo.gl/PM5RftUDW5GGLRRT6', 'Miniaturas, escenarios y accesorios 3D para rol y juegos de cartas.', '3D miniatures, scenery and accessories for RPGs and card games.', 17),
  ('El Trastero Mágico', 'https://alealaspalmas.es/wp-content/uploads/2025/10/eltrasteromagico.png', 'https://maps.app.goo.gl/xWWxKpNM38oNSiX4A', 'Juegos de mesa, Warhammer, merchandising, Magic y organización de partidas.', 'Board games, Warhammer, merch, Magic and event hosting.', 18),
  ('Demon Cup', 'https://alealaspalmas.es/wp-content/uploads/2025/11/LOGO-DEMON-CUP.jpg', 'https://x.com/DemonCupBB?s=20', 'Impulsa el Blood Bowl en Gran Canaria: torneos NAF, ligas y eventos durante todo el año.', 'Driving Blood Bowl in Gran Canaria: NAF tournaments, leagues and events year-round.', 19);
