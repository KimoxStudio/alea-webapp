-- OIR-202: seed real Alea Las Palmas club events onto the extended
-- "events" table (public landing content). Content sourced from
-- alealaspalmas.es (window.ALEA_DATA in the design) via the top-level
-- session, which had DesignSync access this agent lacked. Replaces the
-- earlier standalone "club_events" seed (removed from this branch).
--
-- Legacy single-locale columns (title, description, date, start_time,
-- end_time) are populated too for backward compatibility with the
-- existing admin event tooling: title/description default to the ES
-- copy, date mirrors the anchor start date, and start_time/end_time use
-- the existing "all day" convention (00:00-23:59) since these rows have
-- no meaningful room-block time-of-day.
--
-- Modal-only detail fields present in the source data (when/who/price/
-- organizer, multi-paragraph body, bullet list) have no dedicated schema
-- column, so they are folded into description_es/en as formatted text.
-- For past events with no English source copy, title_en/blurb_en are
-- quick faithful translations by this agent; description_en reuses the
-- Spanish long-form body/bullets (documented judgement call).
--
-- "upcoming" vs "past" is intentionally not stored: the landing service
-- derives it from date/end_date at query time.
INSERT INTO "public"."events"
  ("title", "description", "date", "start_time", "end_time",
   "title_es", "title_en", "blurb_es", "blurb_en", "description_es", "description_en",
   "date_kind", "end_date", "recurrence_label_es", "recurrence_label_en",
   "image_url", "link_url", "category_es", "category_en")
VALUES
  ('Torneo de Bolt Action', 'Early Theater · Sábado completo de partidas con material cedido por el club. Cuatro rondas suizas, premios para los tres primeros.', '2026-05-10', '00:00:00', '23:59:00', 'Torneo de Bolt Action', 'Bolt Action Tournament', 'Early Theater · Sábado completo de partidas con material cedido por el club. Cuatro rondas suizas, premios para los tres primeros.', 'Early Theater · Full Saturday of games with club-provided material. Four Swiss rounds, prizes for top three.', 'Cuándo: Sábado 10 de mayo de 2026 · 10:00–20:00
Plazas: 16 plazas
Precio: 15 € socios · 20 € no socios
Organiza: Comisión de Wargames

Cuatro rondas suizas en formato Early Theater (1939–1941). Listas de 1000 puntos según el reglamento Bolt Action 3rd Edition.

El club aporta mesas terrenadas, escenografía y árbitros. Los participantes traen sus ejércitos.

Comida y bebida disponible durante toda la jornada en la barra del local. Premios para los tres primeros y un premio especial al ejército mejor pintado.

Lo esencial:
• 4 rondas suizas
• Listas de 1000 puntos
• Premios para top 3 + mejor pintado
• Material de mesa cedido por Alea', 'When: Saturday 10 May 2026 · 10:00–20:00
Seats: 16 seats
Price: €15 members · €20 non-members
Organized by: Wargames committee

Four Swiss rounds in Early Theater format (1939-1941). 1000-point lists per Bolt Action 3rd Edition.

The club provides terrained tables, scenery and umpires. Bring your own army.

Food and drinks available all day at the bar. Prizes for the top three plus a special award for best-painted army.

The essentials:
• 4 Swiss rounds
• 1000-point lists
• Top-3 + best-painted prizes
• Table material provided by Alea', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2026/04/ChatGPT-Image-10-abr-2026-16_36_29.png', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-12/', 'Wargame · Histórico', 'Wargame · Historical'),
  ('BOLT-DAYS', 'Cada viernes montamos mesas de Bolt Action con escenarios temáticos. Llega cuando puedas, juega hasta que cierren.', '2026-01-02', '00:00:00', '23:59:00', 'BOLT-DAYS', 'BOLT-DAYS', 'Cada viernes montamos mesas de Bolt Action con escenarios temáticos. Llega cuando puedas, juega hasta que cierren.', 'Every Friday we set up Bolt Action tables with themed scenarios. Drop in any time, play till close.', 'Cuándo: Todos los viernes del año · 18:00–cierre
Plazas: Mesa abierta
Precio: Gratis para socios
Organiza: Comunidad Bolt de Alea

El viernes es el día sagrado del Bolt en Alea. Montamos 4–6 mesas con escenarios rotativos: Stalingrado, Normandía, Pacífico, Norte de África.

Pasan principiantes, veteranos y todo lo que hay entre medias. Si vienes sin ejército, te emparejamos con alguien que te preste fuerzas.

No hace falta apuntarse, sólo asomar la cabeza. Cierra cuando los jugadores deciden — habitualmente pasada la medianoche.

Lo esencial:
• Escenarios temáticos rotativos
• Sin inscripción previa
• Mesas y miniaturas disponibles
• Cerveza fría en la barra', 'When: Every Friday of the year · 18:00 until close
Seats: Open table
Price: Free for members
Organized by: Alea Bolt community

Friday is the sacred Bolt day at Alea. We set up 4-6 tables with rotating scenarios: Stalingrad, Normandy, Pacific, North Africa.

Beginners, veterans and everything in between drop in. No army? We''ll pair you with someone who''ll loan you forces.

No sign-up needed, just show up. The night ends when the players decide - usually past midnight.

The essentials:
• Rotating themed scenarios
• No sign-up needed
• Tables & miniatures available
• Cold beer at the bar', 'recurring', NULL, 'Cada viernes, 18:00–cierre', 'Every Friday, 6:00 PM until close', 'https://alealaspalmas.es/wp-content/uploads/2025/11/LOGO-ALEA-BOLT.png', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-4/', 'Liga semanal', 'Weekly league'),
  ('Los Puños del Fénix Rubí', 'Javi vuelve a dirigir la campaña insignia: torneo marcial en Goka, intrigas en la Liga Inmortal, mecánicas crujientes.', '2026-01-01', '00:00:00', '23:59:00', 'Los Puños del Fénix Rubí', 'Ruby Phoenix Tournament', 'Javi vuelve a dirigir la campaña insignia: torneo marcial en Goka, intrigas en la Liga Inmortal, mecánicas crujientes.', 'Javi runs the flagship campaign again: martial tournament in Goka, intrigue in the Immortal League, crunchy mechanics.', 'Cuándo: Campaña anual 2026 · sesiones quincenales, viernes 19:00–23:00
Plazas: 6 jugadores
Precio: Incluido en la cuota de socio
Organiza: Javi (GM)

La campaña insignia del club vuelve por tercer año. Pathfinder 2e con personajes de nivel 11 a 20 en Tian Xia, en la ciudad-Estado de Goka.

Estructura mixta: arenas de torneo con luchas tácticas crujientes alternándose con sesiones de intriga y exploración por la ciudad.

Cinco plazas reservadas + una rotativa para socios nuevos que quieran probar el sistema. Mesa cerrada tras la sesión 3.

Lo esencial:
• Pathfinder 2e nivel 11–20
• Sesiones quincenales
• 5 plazas fijas + 1 rotativa
• Personaje y fichas listas en sesión 0', 'When: Year-long campaign 2026 · bi-weekly sessions, Fridays 7-11 PM
Seats: 6 players
Price: Included in membership
Organized by: Javi (GM)

The club''s flagship campaign returns for its third year. Pathfinder 2e with level 11-20 characters in Tian Xia, in the city-state of Goka.

Mixed structure: tournament arenas with crunchy tactical fights alternating with city-wide intrigue and exploration.

Five reserved seats + one rotating seat for new members to try the system. Roster closes after session 3.

The essentials:
• Pathfinder 2e levels 11-20
• Bi-weekly sessions
• 5 fixed + 1 rotating seat
• Character & sheets ready at session 0', 'range', '2026-12-31', NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/ruby-phoenix.jpg', 'https://alealaspalmas.es/los-punos-del-fenix-rubi-en-2026/', 'Rol · Pathfinder 2e', 'TTRPG · Pathfinder 2e'),
  ('Jornadas Gastro-Lúdicas', 'Nos ponemos los delantales: cocinamos juntos y combinamos cena con cooperativos en mesa larga.', '2026-01-09', '00:00:00', '23:59:00', 'Jornadas Gastro-Lúdicas', 'Gastro-Gaming Nights', 'Nos ponemos los delantales: cocinamos juntos y combinamos cena con cooperativos en mesa larga.', 'Aprons on: we cook together and pair dinner with co-op games on the long table.', 'Cuándo: La mayoría de viernes del mes · 20:30–00:00
Plazas: Para socios
Precio: 5 € (cubre los ingredientes)
Organiza: Comisión Gastro

Cocinamos entre todos un menú temático (japonés, mexicano, isleño...) y luego sacamos cooperativos de mesa larga: Spirit Island, Pandemic Legacy, Aeon’s End.

Es una de las actividades más queridas del club: socios que llegan tarde encuentran sitio en la mesa, plato caliente y un meeple.

Plazas limitadas a 14 para que quepamos todos en la mesa. Se abren inscripciones el lunes anterior.

Lo esencial:
• Menú temático rotativo
• Cooperativos de mesa larga
• 14 plazas máximo
• Veggie/celíaco siempre disponible', 'When: Most Fridays each month · 8:30 PM until midnight
Seats: Members only
Price: €5 (covers ingredients)
Organized by: Gastro committee

We cook a themed menu together (Japanese, Mexican, island...) and then pull out long-table co-ops: Spirit Island, Pandemic Legacy, Aeon''s End.

One of the club''s most beloved activities: latecomers find a seat at the table, a hot plate and a meeple.

Limited to 14 seats so we all fit around the table. Sign-ups open the Monday before.

The essentials:
• Rotating themed menu
• Long-table co-op games
• 14 seats max
• Veggie/GF always available', 'recurring', NULL, 'La mayoría de viernes del mes, 20:30–00:00', 'Most Fridays each month, 8:30 PM until midnight', 'https://alealaspalmas.es/wp-content/uploads/2025/11/2025-11-05-19_15_07-Vista-superior-del-banquete-con-mucha-comida-_-Foto-gratuita.png', 'https://alealaspalmas.es/jornadas-gastro-ludicas-2025/', 'Cultural · Cooperativo', 'Cultural · Co-op'),
  ('Blood on the Clocktower', 'De la mano de Osiris, una noche de deducción social con 18 plazas completas.', '2026-05-08', '00:00:00', '23:59:00', 'Blood on the Clocktower', 'Blood on the Clocktower', 'De la mano de Osiris, una noche de deducción social con 18 plazas completas.', 'Hosted by Osiris, a night of social deduction with all 18 seats full.', 'Osiris dirigió una noche memorable de Blood on the Clocktower con 18 plazas completas y reservas en espera. Mecánica social, deducción intensa y un Bardo legendario que acabó ganando la noche.

Repetiremos en 2027.

Lo esencial:
• 18 plazas
• GM: Osiris
• Storyteller pack 2024', 'Osiris dirigió una noche memorable de Blood on the Clocktower con 18 plazas completas y reservas en espera. Mecánica social, deducción intensa y un Bardo legendario que acabó ganando la noche.

Repetiremos en 2027.

The essentials:
• 18 plazas
• GM: Osiris
• Storyteller pack 2024', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2026/04/ChatGPT-Image-16-abr-2026-12_06_38.png', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-13/', NULL, NULL),
  ('Torneo de Cascadia', 'Tres rondas tranquilas, una final preciosa. Ganó la mesa de Marta.', '2026-04-26', '00:00:00', '23:59:00', 'Torneo de Cascadia', 'Cascadia Tournament', 'Tres rondas tranquilas, una final preciosa. Ganó la mesa de Marta.', 'Three relaxed rounds, a beautiful final. Marta''s table took the win.', 'Tres rondas suizas + final a cuatro. 24 jugadores, ambiente familiar y tablones llenos de bichos.

Premios donados por La Comarca Games y NOVAilusión.

Lo esencial:
• 24 participantes
• 3 rondas + final
• Premios cedidos por colaboradores', 'Tres rondas suizas + final a cuatro. 24 jugadores, ambiente familiar y tablones llenos de bichos.

Premios donados por La Comarca Games y NOVAilusión.

The essentials:
• 24 participantes
• 3 rondas + final
• Premios cedidos por colaboradores', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2026/04/Cascadia-1086x1536.jpeg', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-11/', NULL, NULL),
  ('Guindilla Bowl', 'Blood Bowl en formato corto: 7 entrenadores, una jornada épica.', '2026-04-25', '00:00:00', '23:59:00', 'Guindilla Bowl', 'Guindilla Bowl', 'Blood Bowl en formato corto: 7 entrenadores, una jornada épica.', 'Short-format Blood Bowl: 7 coaches, one epic day.', 'Torneo NAF de Blood Bowl en formato Sevens, organizado junto a Demon Cup. Jornada completa con cuatro rondas y premios para los tres primeros.

Lo esencial:
• Formato Sevens
• NAF-rated
• Co-organizado con Demon Cup', 'Torneo NAF de Blood Bowl en formato Sevens, organizado junto a Demon Cup. Jornada completa con cuatro rondas y premios para los tres primeros.

The essentials:
• Formato Sevens
• NAF-rated
• Co-organizado con Demon Cup', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2026/03/Guindilla-Bowl.jpeg', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-10-2-2/', NULL, NULL),
  ('Blood on the Clocktower', 'Segunda noche de Clocktower en 2026: storyteller invitado y guion personalizado.', '2026-03-21', '00:00:00', '23:59:00', 'Blood on the Clocktower', 'Blood on the Clocktower', 'Segunda noche de Clocktower en 2026: storyteller invitado y guion personalizado.', 'The second Clocktower night of 2026: guest storyteller and a custom script.', 'La fiebre de Clocktower llegó pronto a 2026. Esta sesión la dirigió Adri con un guion personalizado para el local.

Lo esencial:
• 16 plazas
• Guion exclusivo
• Storyteller: Adri', 'La fiebre de Clocktower llegó pronto a 2026. Esta sesión la dirigió Adri con un guion personalizado para el local.

The essentials:
• 16 plazas
• Guion exclusivo
• Storyteller: Adri', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2026/03/clocktower.jpeg', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-10-2/', NULL, NULL),
  ('Torneo de Sushi-Go!', 'Familiar, rápido, delicioso. Mesas de 4 + final con maki-roll.', '2026-03-08', '00:00:00', '23:59:00', 'Torneo de Sushi-Go!', 'Sushi-Go! Tournament', 'Familiar, rápido, delicioso. Mesas de 4 + final con maki-roll.', 'Family-friendly, fast, delicious. Tables of 4 plus a maki-roll final.', 'Torneo familiar de Sushi-Go! con tres rondas, mesas de 4 y final a 6. Atrajo a muchas familias del barrio.

Lo esencial:
• Familiar
• 3 rondas + final
• Premios Lifer', 'Torneo familiar de Sushi-Go! con tres rondas, mesas de 4 y final a 6. Atrajo a muchas familias del barrio.

The essentials:
• Familiar
• 3 rondas + final
• Premios Lifer', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2026/03/sushi-go.jpeg', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-10/', NULL, NULL),
  ('Demon Cup', 'El clásico anual NAF en Gran Canaria. Casa llena.', '2026-03-06', '00:00:00', '23:59:00', 'Demon Cup', 'Demon Cup', 'El clásico anual NAF en Gran Canaria. Casa llena.', 'The annual NAF classic in Gran Canaria. Packed house.', 'El torneo más esperado del calendario blood-bowlero en Canarias. Tres días, 32 entrenadores y nivel altísimo. Co-organizado con Demon Cup.

Lo esencial:
• NAF-rated
• 32 entrenadores
• 3 días', 'El torneo más esperado del calendario blood-bowlero en Canarias. Tres días, 32 entrenadores y nivel altísimo. Co-organizado con Demon Cup.

The essentials:
• NAF-rated
• 32 entrenadores
• 3 días', 'range', '2026-03-08', NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/demon-cup.jpg', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-2/', NULL, NULL),
  ('Convivencia Ludens-Alea', 'Tres días con la asociación hermana Ludens. Casa rural, mesas las 24h.', '2026-01-23', '00:00:00', '23:59:00', 'Convivencia Ludens-Alea', 'Ludens-Alea Retreat', 'Tres días con la asociación hermana Ludens. Casa rural, mesas las 24h.', 'Three days with our sister association Ludens. Country house, tables running 24h.', 'Convivencia anual con la asociación Ludens en una casa rural del norte. Mesas montadas las 24 horas, comida común y mucha amistad.

Lo esencial:
• Casa rural
• 3 días
• Junto a Ludens', 'Convivencia anual con la asociación Ludens en una casa rural del norte. Mesas montadas las 24 horas, comida común y mucha amistad.

The essentials:
• Casa rural
• 3 días
• Junto a Ludens', 'range', '2026-01-25', NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/12/Convivencia-2026.jpeg', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-9/', NULL, NULL),
  ('Encendido de Luces Navideñas', 'Decoramos el local entre todos. Música, vino caliente y el árbol del club.', '2025-12-05', '00:00:00', '23:59:00', 'Encendido de Luces Navideñas', 'Christmas Lights Switch-On', 'Decoramos el local entre todos. Música, vino caliente y el árbol del club.', 'We decorated the venue together. Music, mulled wine and the club tree.', 'La tarde-noche en la que el local se transforma: montaje del árbol, decoración temática y mesas espontáneas hasta tarde.

Lo esencial:
• Tradición anual
• Vino caliente
• Mesas espontáneas', 'La tarde-noche en la que el local se transforma: montaje del árbol, decoración temática y mesas espontáneas hasta tarde.

The essentials:
• Tradición anual
• Vino caliente
• Mesas espontáneas', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/12/ChatGPT-Image-2-dic-2025-00_02_53.png', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-8/', NULL, NULL),
  ('Torneo Navideño en Level Up', 'W40K en Level Up: torneo de cierre de año, 16 listas.', '2025-12-27', '00:00:00', '23:59:00', 'Torneo Navideño en Level Up', 'Level Up Christmas Tournament', 'W40K en Level Up: torneo de cierre de año, 16 listas.', 'W40K at Level Up: the year-end tournament, 16 lists.', 'Co-organizado con Level Up, este torneo cerró el año warhammero con 16 listas y altísimo nivel de pintura.

Lo esencial:
• Warhammer 40K
• 16 listas
• Co-organizado con Level Up', 'Co-organizado con Level Up, este torneo cerró el año warhammero con 16 listas y altísimo nivel de pintura.

The essentials:
• Warhammer 40K
• 16 listas
• Co-organizado con Level Up', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/cartel-torneo-w40k-lvl-up-1090x1536.jpg', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-7/', NULL, NULL),
  ('Torneo del Señor de los Anillos', 'VI Torneo Navideño SDA: tres días en el puente, 24 jugadores.', '2025-12-06', '00:00:00', '23:59:00', 'Torneo del Señor de los Anillos', 'Lord of the Rings Tournament', 'VI Torneo Navideño SDA: tres días en el puente, 24 jugadores.', '6th Christmas LotR Tournament: a three-day long weekend, 24 players.', 'El sexto Torneo Navideño de SDA Strategy Battle Game: tres días, 24 jugadores y la Comarca llena de fans.

Lo esencial:
• 6ª edición
• SBG Middle-earth
• 3 días', 'El sexto Torneo Navideño de SDA Strategy Battle Game: tres días, 24 jugadores y la Comarca llena de fans.

The essentials:
• 6ª edición
• SBG Middle-earth
• 3 días', 'range', '2025-12-08', NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/Torneo-Senor-de-los-Anillos-recortado.jpg', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-6/', NULL, NULL),
  ('II Torneo Spearhead', 'Spearhead AoS junto a El Bastión del Sur. Mesas espectaculares.', '2025-11-29', '00:00:00', '23:59:00', 'II Torneo Spearhead', '2nd Spearhead Tournament', 'Spearhead AoS junto a El Bastión del Sur. Mesas espectaculares.', 'AoS Spearhead with El Bastión del Sur. Spectacular tables.', 'Segunda edición del torneo Spearhead de Age of Sigmar, co-organizado con El Bastión del Sur. Mesas terrenadas a juego con los ejércitos.

Lo esencial:
• AoS Spearhead
• Co-org. Bastión del Sur
• Mesas terrenadas', 'Segunda edición del torneo Spearhead de Age of Sigmar, co-organizado con El Bastión del Sur. Mesas terrenadas a juego con los ejércitos.

The essentials:
• AoS Spearhead
• Co-org. Bastión del Sur
• Mesas terrenadas', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/Cartel-Torneo-Spearhead-1220x1536.jpg', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-3/', NULL, NULL),
  ('Liga Warhammer 40K en Alea', 'Liga rotativa con sistema de puntuación propio. 18 entrenadores.', '2025-11-01', '00:00:00', '23:59:00', 'Liga Warhammer 40K en Alea', 'Alea Warhammer 40K League', 'Liga rotativa con sistema de puntuación propio. 18 entrenadores.', 'Rotating league with our own scoring system. 18 coaches.', 'Liga interna abierta para socios. Sistema de puntuación propio que premia la consistencia y el espíritu deportivo.

Lo esencial:
• 18 entrenadores
• Sistema de puntos propio
• Abierta a socios', 'Liga interna abierta para socios. Sistema de puntuación propio que premia la consistencia y el espíritu deportivo.

The essentials:
• 18 entrenadores
• Sistema de puntos propio
• Abierta a socios', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/logo-alea.40k.png', 'https://alealaspalmas.es/copia-template-evento-nombre-colaborador-y-logo-en-imagen-destacada-7-9-5/', NULL, NULL),
  ('Jornadas de Rol Terroríficas', 'Mesas de rol de terror simultáneas, decoración a juego.', '2025-10-31', '00:00:00', '23:59:00', 'Jornadas de Rol Terroríficas', 'Horror RPG Sessions', 'Mesas de rol de terror simultáneas, decoración a juego.', 'Simultaneous horror RPG tables, matching decor.', 'Aprovechamos el Día de los Finados para montar 4 mesas paralelas de rol de terror: Call of Cthulhu, Vaesen, World of Darkness y una de partida one-shot improvisada.

Lo esencial:
• 4 mesas paralelas
• Sistemas variados
• Decoración inmersiva', 'Aprovechamos el Día de los Finados para montar 4 mesas paralelas de rol de terror: Call of Cthulhu, Vaesen, World of Darkness y una de partida one-shot improvisada.

The essentials:
• 4 mesas paralelas
• Sistemas variados
• Decoración inmersiva', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/10/cartel-hallowen-1086x1536.jpg', 'https://alealaspalmas.es/jornadas-de-rol-terrorificas-2025/', NULL, NULL),
  ('Las Bóvedas de la Abominación', 'Campaña de Pathfinder en Belkorra: ¡el alcalde ha muerto!', '2025-09-29', '00:00:00', '23:59:00', 'Las Bóvedas de la Abominación', 'The Abomination Vaults', 'Campaña de Pathfinder en Belkorra: ¡el alcalde ha muerto!', 'Pathfinder campaign in Belkorra: the mayor is dead!', 'Campaña insignia de Pathfinder 2e, ambientada en la pequeña ciudad de Belkorra. Sesiones quincenales con dos mesas paralelas.

Lo esencial:
• Pathfinder 2e
• Niveles 1–10
• 2 mesas paralelas', 'Campaña insignia de Pathfinder 2e, ambientada en la pequeña ciudad de Belkorra. Sesiones quincenales con dos mesas paralelas.

The essentials:
• Pathfinder 2e
• Niveles 1–10
• 2 mesas paralelas', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/abomination-vaults.jpg', 'https://alealaspalmas.es/las-bovedas-de-la-abominacion/', NULL, NULL),
  ('Nos vemos en la Comic-Can 2025', 'Mostramos el club en el salón con mesas abiertas todo el día.', '2025-11-08', '00:00:00', '23:59:00', 'Nos vemos en la Comic-Can 2025', 'See You at Comic-Can 2025', 'Mostramos el club en el salón con mesas abiertas todo el día.', 'We showed off the club at the convention with open tables all day.', 'Stand en la Comic-Can con mesas demo de wargames, rol y juegos familiares. Captamos +20 socios nuevos.

Lo esencial:
• Stand Alea
• Mesas demo abiertas
• +20 socios nuevos', 'Stand en la Comic-Can con mesas demo de wargames, rol y juegos familiares. Captamos +20 socios nuevos.

The essentials:
• Stand Alea
• Mesas demo abiertas
• +20 socios nuevos', 'range', '2025-11-09', NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/Cartel-comic-can-2025.png', 'https://alealaspalmas.es/nos-vemos-en-la-comic-can-2025/', NULL, NULL),
  ('Torneo de Heat 2025', 'Pilotos, arranquen motores. Heat: Pedal to the Metal con 12 corredores.', '2025-12-22', '00:00:00', '23:59:00', 'Torneo de Heat 2025', 'Heat Tournament 2025', 'Pilotos, arranquen motores. Heat: Pedal to the Metal con 12 corredores.', 'Drivers, start your engines. Heat: Pedal to the Metal with 12 racers.', 'Torneo de Heat con sistema de carreras consecutivas. Doce pilotos, tres pistas distintas y ambiente de fórmula de la Sierra.

Lo esencial:
• 12 pilotos
• 3 pistas
• Sistema acumulativo', 'Torneo de Heat con sistema de carreras consecutivas. Doce pilotos, tres pistas distintas y ambiente de fórmula de la Sierra.

The essentials:
• 12 pilotos
• 3 pistas
• Sistema acumulativo', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/heat.png', 'https://alealaspalmas.es/torneo-de-heat-2025/', NULL, NULL),
  ('Torneo W40K en Los Alisios', 'Primer Alea-Gaming Experience: W40K en CC Los Alisios.', '2025-06-15', '00:00:00', '23:59:00', 'Torneo W40K en Los Alisios', 'W40K Tournament at Los Alisios', 'Primer Alea-Gaming Experience: W40K en CC Los Alisios.', 'The first Alea Gaming Experience: W40K at Los Alisios mall.', 'Primer torneo de W40K llevado fuera del local, en el espacio Gaming Experience de Los Alisios. 14 listas y mucho público.

Lo esencial:
• W40K
• 14 listas
• Centro comercial Los Alisios', 'Primer torneo de W40K llevado fuera del local, en el espacio Gaming Experience de Los Alisios. 14 listas y mucho público.

The essentials:
• W40K
• 14 listas
• Centro comercial Los Alisios', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/torneo-de-Alisios.png', 'https://alealaspalmas.es/primer-torneo-w40k-alea-gaming-experience-en-los-alisios-2025/', NULL, NULL),
  ('Gran Fiesta de Aniversario', 'Cinco años de Alea: tarta, mesas las 24 horas y socios fundadores en la barra.', '2025-07-05', '00:00:00', '23:59:00', 'Gran Fiesta de Aniversario', 'Big Anniversary Party', 'Cinco años de Alea: tarta, mesas las 24 horas y socios fundadores en la barra.', 'Five years of Alea: cake, 24-hour tables and founding members at the bar.', 'Celebramos los cinco años del club con tarta, ronda de discursos cortos, mesas 24 horas y los socios fundadores reviviendo la primera partida del club.

Lo esencial:
• 5º aniversario
• Mesas 24h
• Socios fundadores', 'Celebramos los cinco años del club con tarta, ronda de discursos cortos, mesas 24 horas y los socios fundadores reviviendo la primera partida del club.

The essentials:
• 5º aniversario
• Mesas 24h
• Socios fundadores', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/aniversario.png', 'https://alealaspalmas.es/gran-fiesta-de-aniversario-2025/', NULL, NULL),
  ('Torneo de Dune: Imperium', 'Dune: Imperium con final a cuatro y mucho Arrakis en mesa.', '2025-08-24', '00:00:00', '23:59:00', 'Torneo de Dune: Imperium', 'Dune: Imperium Tournament', 'Dune: Imperium con final a cuatro y mucho Arrakis en mesa.', 'Dune: Imperium with a four-player final and plenty of Arrakis on the table.', 'Torneo de Dune: Imperium con tres rondas suizas y final a cuatro. Carteles personalizados y mucho ambiente especiero.

Lo esencial:
• 3 rondas + final
• Dune: Imperium
• Premios Comarca', 'Torneo de Dune: Imperium con tres rondas suizas y final a cuatro. Carteles personalizados y mucho ambiente especiero.

The essentials:
• 3 rondas + final
• Dune: Imperium
• Premios Comarca', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/dune-imperium.png', 'https://alealaspalmas.es/torneo-de-dune-imperium-2024/', NULL, NULL),
  ('Curso de pintura con Belselch Medina', 'Master class de pintura de miniaturas con Belselch Medina.', '2024-12-28', '00:00:00', '23:59:00', 'Curso de pintura con Belselch Medina', 'Painting Course with Belselch Medina', 'Master class de pintura de miniaturas con Belselch Medina.', 'A miniature-painting masterclass with Belselch Medina.', 'Belselch Medina, referente de la pintura en Canarias, impartió un curso de un día completo en el local con plazas limitadas.

Lo esencial:
• Master class
• 8 plazas
• Pintura de miniaturas', 'Belselch Medina, referente de la pintura en Canarias, impartió un curso de un día completo en el local con plazas limitadas.

The essentials:
• Master class
• 8 plazas
• Pintura de miniaturas', 'single', NULL, NULL, NULL, 'https://alealaspalmas.es/wp-content/uploads/2025/11/belselch.png', 'https://alealaspalmas.es/curso-de-pintura-con-belselch-medina-2024/', NULL, NULL);
