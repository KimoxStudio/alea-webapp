-- ============================================================
-- Alea Webapp — Seed Data for Manual QA
-- ============================================================
-- Idempotent: run cleanup block first, then insert fresh data.
-- Uses deterministic UUIDs for predictability.
-- ============================================================
-- ⚠️  LOCAL DEVELOPMENT ONLY
-- Never run this file against a staging or production database.
-- The Supabase CLI applies this file automatically on: supabase db reset / supabase start.
-- To seed a remote database, apply migrations manually and load fixtures via the Supabase dashboard.
-- ============================================================

-- ============================================================
-- Cleanup (idempotent re-run)
-- ============================================================

DELETE FROM public.reservations
WHERE id IN (
  '50000000-0000-0000-0000-000000000001'::uuid,
  '50000000-0000-0000-0000-000000000002'::uuid,
  '50000000-0000-0000-0000-000000000003'::uuid,
  '50000000-0000-0000-0000-000000000004'::uuid,
  '50000000-0000-0000-0000-000000000005'::uuid,
  '50000000-0000-0000-0000-000000000006'::uuid,
  '50000000-0000-0000-0000-000000000007'::uuid,
  '50000000-0000-0000-0000-000000000008'::uuid,
  '50000000-0000-0000-0000-000000000009'::uuid,
  '50000000-0000-0000-0000-000000000010'::uuid
);

DELETE FROM public.profiles
WHERE id IN (
  '10000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000003'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  '10000000-0000-0000-0000-000000000005'::uuid
);

DELETE FROM auth.users
WHERE id IN (
  '10000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000003'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  '10000000-0000-0000-0000-000000000005'::uuid
);

DELETE FROM public.tables
WHERE id IN (
  '30000000-0000-0000-0000-000000000001'::uuid,
  '30000000-0000-0000-0000-000000000002'::uuid,
  '30000000-0000-0000-0000-000000000003'::uuid,
  '30000000-0000-0000-0000-000000000004'::uuid,
  '30000000-0000-0000-0000-000000000005'::uuid,
  '30000000-0000-0000-0000-000000000006'::uuid,
  '30000000-0000-0000-0000-000000000007'::uuid,
  '30000000-0000-0000-0000-000000000008'::uuid,
  '30000000-0000-0000-0000-000000000009'::uuid,
  '30000000-0000-0000-0000-000000000010'::uuid,
  '30000000-0000-0000-0000-000000000011'::uuid,
  '30000000-0000-0000-0000-000000000012'::uuid,
  '30000000-0000-0000-0000-000000000013'::uuid,
  '30000000-0000-0000-0000-000000000014'::uuid,
  '30000000-0000-0000-0000-000000000015'::uuid,
  '30000000-0000-0000-0000-000000000016'::uuid,
  '30000000-0000-0000-0000-000000000017'::uuid,
  '30000000-0000-0000-0000-000000000018'::uuid,
  '30000000-0000-0000-0000-000000000019'::uuid,
  '30000000-0000-0000-0000-000000000020'::uuid,
  '30000000-0000-0000-0000-000000000021'::uuid,
  '30000000-0000-0000-0000-000000000022'::uuid,
  '30000000-0000-0000-0000-000000000023'::uuid,
  '30000000-0000-0000-0000-000000000024'::uuid
);

DELETE FROM public.rooms
WHERE id IN (
  '20000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000002'::uuid,
  '20000000-0000-0000-0000-000000000003'::uuid,
  '20000000-0000-0000-0000-000000000004'::uuid,
  '20000000-0000-0000-0000-000000000005'::uuid,
  '20000000-0000-0000-0000-000000000006'::uuid
);

-- ============================================================
-- Rooms (6 RPG-themed)
-- ============================================================

INSERT INTO public.rooms (id, name, description, table_count)
VALUES
  (
    '20000000-0000-0000-0000-000000000001'::uuid,
    'Sala del Dragón',
    'La gran sala donde los aventureros se reúnen bajo la mirada de un dragón tallado en piedra.',
    4
  ),
  (
    '20000000-0000-0000-0000-000000000002'::uuid,
    'Biblioteca Arcana',
    'Estantes repletos de tomos y pergaminos. El silencio es la norma aquí.',
    4
  ),
  (
    '20000000-0000-0000-0000-000000000003'::uuid,
    'Forja de Goblins',
    'Un espacio caótico y creativo donde los artesanos trabajan sus proyectos.',
    4
  ),
  (
    '20000000-0000-0000-0000-000000000004'::uuid,
    'Taberna del Aventurero',
    'El lugar de encuentro por excelencia: ruidoso, animado y siempre lleno de historias.',
    4
  ),
  (
    '20000000-0000-0000-0000-000000000005'::uuid,
    'Torre del Mago',
    'Sala de torneo en la planta alta. Las vistas son tan buenas como las partidas.',
    4
  ),
  (
    '20000000-0000-0000-0000-000000000006'::uuid,
    'Cripta de los Muertos',
    'Para los devotos de los juegos de terror y dungeon crawl.',
    4
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Tables (4 per room = 24 total)
-- table_type: 'small' (2-4 players), 'large' (6-8 players), 'removable_top' (dual-surface)
-- ============================================================

-- Sala del Dragón
INSERT INTO public.tables (id, room_id, name, type, pos_x, pos_y)
VALUES
  ('30000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'Mesa del Héroe',      'small',        100, 100),
  ('30000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'Mesa del Caballero',  'large',        300, 100),
  ('30000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'Mesa del Paladín',    'small',        100, 300),
  ('30000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'Mesa del Dragón',     'removable_top',300, 300)
ON CONFLICT (id) DO NOTHING;

-- Biblioteca Arcana
INSERT INTO public.tables (id, room_id, name, type, pos_x, pos_y)
VALUES
  ('30000000-0000-0000-0000-000000000005'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Mesa del Archivist',  'small',        100, 100),
  ('30000000-0000-0000-0000-000000000006'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Mesa del Escriba',    'small',        300, 100),
  ('30000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Mesa del Sabio',      'large',        100, 300),
  ('30000000-0000-0000-0000-000000000008'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Mesa del Maestro',    'removable_top',300, 300)
ON CONFLICT (id) DO NOTHING;

-- Forja de Goblins
INSERT INTO public.tables (id, room_id, name, type, pos_x, pos_y)
VALUES
  ('30000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'Mesa del Artesano',   'small',        100, 100),
  ('30000000-0000-0000-0000-000000000010'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'Mesa del Herrero',    'large',        300, 100),
  ('30000000-0000-0000-0000-000000000011'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'Mesa del Goblin',     'small',        100, 300),
  ('30000000-0000-0000-0000-000000000012'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'Mesa del Inventor',   'removable_top',300, 300)
ON CONFLICT (id) DO NOTHING;

-- Taberna del Aventurero
INSERT INTO public.tables (id, room_id, name, type, pos_x, pos_y)
VALUES
  ('30000000-0000-0000-0000-000000000013'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 'Mesa de la Barra',    'small',        100, 100),
  ('30000000-0000-0000-0000-000000000014'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 'Mesa de la Fogata',   'large',        300, 100),
  ('30000000-0000-0000-0000-000000000015'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 'Mesa del Bardo',      'small',        100, 300),
  ('30000000-0000-0000-0000-000000000016'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 'Mesa del Posadero',   'removable_top',300, 300)
ON CONFLICT (id) DO NOTHING;

-- Torre del Mago
INSERT INTO public.tables (id, room_id, name, type, pos_x, pos_y)
VALUES
  ('30000000-0000-0000-0000-000000000017'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 'Mesa del Aprendiz',   'small',        100, 100),
  ('30000000-0000-0000-0000-000000000018'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 'Mesa del Hechicero',  'large',        300, 100),
  ('30000000-0000-0000-0000-000000000019'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 'Mesa del Brujo',      'small',        100, 300),
  ('30000000-0000-0000-0000-000000000020'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 'Mesa del Archimago',  'removable_top',300, 300)
ON CONFLICT (id) DO NOTHING;

-- Cripta de los Muertos
INSERT INTO public.tables (id, room_id, name, type, pos_x, pos_y)
VALUES
  ('30000000-0000-0000-0000-000000000021'::uuid, '20000000-0000-0000-0000-000000000006'::uuid, 'Mesa del Nigromante', 'small',        100, 100),
  ('30000000-0000-0000-0000-000000000022'::uuid, '20000000-0000-0000-0000-000000000006'::uuid, 'Mesa del Liche',      'large',        300, 100),
  ('30000000-0000-0000-0000-000000000023'::uuid, '20000000-0000-0000-0000-000000000006'::uuid, 'Mesa del Vampiro',    'small',        100, 300),
  ('30000000-0000-0000-0000-000000000024'::uuid, '20000000-0000-0000-0000-000000000006'::uuid, 'Mesa de las Sombras', 'removable_top',300, 300)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Auth Users (5 test users)
-- The on_auth_user_created trigger will fire and attempt to
-- INSERT into public.profiles; we handle that via ON CONFLICT.
-- ============================================================

-- Test password for ALL users: TestPass123!
-- ⚠️  Never reuse this password on any real account. Local QA use only.
-- bcrypt cost factor 10 (~100ms/user): adequate for 5 test users; lower to extensions.gen_salt('bf', 4) if seed time becomes a CI bottleneck.
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role,
  aud,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'admin@alea.test',
    extensions.crypt('TestPass123!', extensions.gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false
  ),
  (
    '10000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'member1@alea.test',
    extensions.crypt('TestPass123!', extensions.gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false
  ),
  (
    '10000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'member2@alea.test',
    extensions.crypt('TestPass123!', extensions.gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false
  ),
  (
    '10000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'member3@alea.test',
    extensions.crypt('TestPass123!', extensions.gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false
  ),
  (
    '10000000-0000-0000-0000-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'member4@alea.test',
    extensions.crypt('TestPass123!', extensions.gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Profiles (upsert to override the trigger-generated rows)
-- The trigger creates profiles with a generated member_number
-- and role='member'. We upsert to set the correct values.
-- ============================================================

INSERT INTO public.profiles (id, member_number, auth_email, email, role, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, '00001', 'admin@alea.test',   'admin@alea.test',   'admin',  true),
  ('10000000-0000-0000-0000-000000000002'::uuid, '00002', 'member1@alea.test', 'member1@alea.test', 'member', true),
  ('10000000-0000-0000-0000-000000000003'::uuid, '00003', 'member2@alea.test', 'member2@alea.test', 'member', true),
  ('10000000-0000-0000-0000-000000000004'::uuid, '00004', 'member3@alea.test', 'member3@alea.test', 'member', true),
  ('10000000-0000-0000-0000-000000000005'::uuid, '00005', 'member4@alea.test', 'member4@alea.test', 'member', true)
ON CONFLICT (id) DO UPDATE
  SET member_number = EXCLUDED.member_number,
      auth_email    = EXCLUDED.auth_email,
      email         = EXCLUDED.email,
      role          = EXCLUDED.role,
      is_active     = EXCLUDED.is_active,
      updated_at    = now();

-- ============================================================
-- Reservations (10 sample reservations)
--
-- Dates are relative to CURRENT_DATE so the seed stays valid
-- regardless of when it is applied:
--   Past  (completed/cancelled/no_show): CURRENT_DATE - 14d, -10d, -6d, -3d
--   Future (active/pending):             CURRENT_DATE +  1d,  +3d,  +7d,  +9d
--
-- NOTE: The exclusion constraint only fires for status='active'.
-- Active reservations on the same table must not overlap in time.
-- All active entries below use distinct tables or non-overlapping times.
--
-- NOTE: surface must be NULL for table types other than 'removable_top'.
-- ============================================================

INSERT INTO public.reservations (id, table_id, user_id, date, start_time, end_time, surface, status, activated_at)
VALUES
  -- Past: completed (member1, Sala del Dragón, Mesa del Héroe)
  (
    '50000000-0000-0000-0000-000000000001'::uuid,
    '30000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    CURRENT_DATE - INTERVAL '14 days', '10:00', '12:00',
    NULL,
    'completed',
    (CURRENT_DATE - INTERVAL '14 days')::timestamp + INTERVAL '10 hours 5 minutes'
  ),
  -- Past: completed (member2, Biblioteca Arcana, Mesa del Archivist)
  (
    '50000000-0000-0000-0000-000000000002'::uuid,
    '30000000-0000-0000-0000-000000000005'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid,
    CURRENT_DATE - INTERVAL '10 days', '16:00', '18:00',
    NULL,
    'completed',
    (CURRENT_DATE - INTERVAL '10 days')::timestamp + INTERVAL '16 hours 3 minutes'
  ),
  -- Past: cancelled (member3, Forja de Goblins, Mesa del Artesano)
  (
    '50000000-0000-0000-0000-000000000003'::uuid,
    '30000000-0000-0000-0000-000000000009'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    CURRENT_DATE - INTERVAL '6 days', '11:00', '13:00',
    NULL,
    'cancelled',
    NULL
  ),
  -- Past: no_show (member4, Taberna del Aventurero, Mesa de la Barra)
  (
    '50000000-0000-0000-0000-000000000004'::uuid,
    '30000000-0000-0000-0000-000000000013'::uuid,
    '10000000-0000-0000-0000-000000000005'::uuid,
    CURRENT_DATE - INTERVAL '3 days', '18:00', '20:00',
    NULL,
    'no_show',
    NULL
  ),
  -- Past: cancelled (member1, Torre del Mago, Mesa del Aprendiz)
  (
    '50000000-0000-0000-0000-000000000005'::uuid,
    '30000000-0000-0000-0000-000000000017'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    CURRENT_DATE - INTERVAL '3 days', '14:00', '16:00',
    NULL,
    'cancelled',
    NULL
  ),
  -- Future: active (member1, Sala del Dragón, Mesa del Caballero — large table)
  (
    '50000000-0000-0000-0000-000000000006'::uuid,
    '30000000-0000-0000-0000-000000000002'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    CURRENT_DATE + INTERVAL '1 day', '10:00', '13:00',
    NULL,
    'active',
    (CURRENT_DATE + INTERVAL '1 day')::timestamp + INTERVAL '10 hours 5 minutes'
  ),
  -- Future: pending (member2, Biblioteca Arcana, Mesa del Escriba)
  (
    '50000000-0000-0000-0000-000000000007'::uuid,
    '30000000-0000-0000-0000-000000000006'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid,
    CURRENT_DATE + INTERVAL '3 days', '17:00', '19:00',
    NULL,
    'pending',
    NULL
  ),
  -- Future: active (member3, Cripta de los Muertos, Mesa del Nigromante — small table, no surface)
  (
    '50000000-0000-0000-0000-000000000008'::uuid,
    '30000000-0000-0000-0000-000000000021'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    CURRENT_DATE + INTERVAL '7 days', '11:00', '14:00',
    NULL,
    'active',
    (CURRENT_DATE + INTERVAL '7 days')::timestamp + INTERVAL '11 hours 5 minutes'
  ),
  -- Future: pending (member4, Torre del Mago, Mesa del Hechicero — large table)
  (
    '50000000-0000-0000-0000-000000000009'::uuid,
    '30000000-0000-0000-0000-000000000018'::uuid,
    '10000000-0000-0000-0000-000000000005'::uuid,
    CURRENT_DATE + INTERVAL '9 days', '15:00', '17:00',
    NULL,
    'pending',
    NULL
  ),
  -- Future: active (admin, Forja de Goblins, Mesa del Herrero — large table, no surface)
  (
    '50000000-0000-0000-0000-000000000010'::uuid,
    '30000000-0000-0000-0000-000000000010'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    CURRENT_DATE + INTERVAL '9 days', '10:00', '12:00',
    NULL,
    'active',
    (CURRENT_DATE + INTERVAL '9 days')::timestamp + INTERVAL '10 hours 5 minutes'
  )
ON CONFLICT (id) DO NOTHING;
