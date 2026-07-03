-- OIR-202: seed data for "club_events".
--
-- NOTE FOR REVIEWERS: this seed was authored without access to the source
-- design's data.js (window.ALEA_DATA.upcoming / .past) because the DesignSync
-- MCP tool was not available in this agent's execution environment. The rows
-- below are representative placeholder content covering all three date_kind
-- variants (single, range, recurring) and both statuses (upcoming, past) so
-- the landing page and its date-formatting logic can be built/tested end to
-- end. Replace these rows with the real event history from the design source
-- before this feature is considered content-complete.
INSERT INTO "public"."club_events"
  ("title_es", "title_en", "blurb_es", "blurb_en", "description_es", "description_en",
   "date_kind", "start_date", "end_date", "recurrence_label_es", "recurrence_label_en",
   "image_url", "link_url", "status", "display_order")
VALUES
  (
    'Torneo de Warhammer 40.000 — Edición Otoño',
    'Warhammer 40,000 Tournament — Autumn Edition',
    'Un fin de semana de batallas épicas en el universo de Warhammer 40.000.',
    'A weekend of epic battles set in the Warhammer 40,000 universe.',
    'Torneo abierto a socios y no socios, formato de 3 rondas con listas de 2000 puntos. Habrá premios para los primeros clasificados y sorteos entre todos los participantes.',
    'Tournament open to members and non-members, 3-round format with 2000-point lists. Prizes for top finishers and raffles for all participants.',
    'range', '2026-10-17', '2026-10-18', NULL, NULL,
    NULL, NULL, 'upcoming', 10
  ),
  (
    'Jornada de Rol: Convocatoria de Cthulhu',
    'RPG Session: Call of Cthulhu One-Shot',
    'Una tarde de horror cósmico para jugadores de todos los niveles.',
    'An afternoon of cosmic horror for players of all experience levels.',
    'Sesión única (one-shot) narrada por un máster invitado. Plazas limitadas, inscripción previa necesaria en recepción.',
    'One-shot session run by a guest game master. Limited seats, sign-up required at the front desk.',
    'single', '2026-09-05', NULL, NULL, NULL,
    NULL, NULL, 'upcoming', 20
  ),
  (
    'Noche de Juegos de Mesa',
    'Board Game Night',
    'Cita semanal para descubrir novedades y clásicos de la ludoteca del club.',
    'Weekly meetup to discover new releases and classics from the club library.',
    'Todos los jueves abrimos las salas comunes para jugar en grupo. No hace falta reservar mesa ni traer nada, solo ganas de jugar.',
    'Every Thursday we open the common rooms for group play. No table booking or equipment needed — just bring yourself.',
    'recurring', '2026-01-08', NULL, 'Todos los jueves, 18:00–22:00', 'Every Thursday, 6:00–10:00 PM',
    NULL, NULL, 'upcoming', 30
  ),
  (
    'Campeonato Local de Magic: The Gathering',
    'Local Magic: The Gathering Championship',
    'Duelistas de toda la ciudad se dieron cita en nuestro campeonato anual.',
    'Duelists from across the city gathered for our annual championship.',
    'Formato Standard, 5 rondas suizas más top 8. Enhorabuena a todos los participantes por una gran edición.',
    'Standard format, 5 Swiss rounds plus top 8. Congratulations to all participants on a great edition.',
    'single', '2026-05-16', NULL, NULL, NULL,
    NULL, NULL, 'past', 100
  ),
  (
    'Maratón de Rol de 24 Horas',
    '24-Hour RPG Marathon',
    'Una maratón solidaria de partidas ininterrumpidas para recaudar fondos benéficos.',
    'A charity marathon of back-to-back sessions raising funds for a good cause.',
    'Más de 40 socios se turnaron durante 24 horas seguidas para completar mesas de rol de todo tipo de ambientación, recaudando fondos para la asociación benéfica local.',
    'More than 40 members took turns over 24 straight hours running RPG tables across every setting imaginable, raising funds for a local charity.',
    'range', '2026-03-14', '2026-03-15', NULL, NULL,
    NULL, NULL, 'past', 110
  ),
  (
    'Presentación de Novedades de Otoño',
    'Autumn New Releases Showcase',
    'Descubrimos en primicia las últimas incorporaciones a la ludoteca del club.',
    'A first look at the newest additions to the club library.',
    'Sesión de demostración de los juegos de mesa recién adquiridos, con partidas guiadas por los propios socios.',
    'A demo session for newly acquired board games, with tables guided by fellow members.',
    'single', '2025-11-08', NULL, NULL, NULL,
    NULL, NULL, 'past', 120
  );
