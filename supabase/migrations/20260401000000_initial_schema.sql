-- ============================================================
-- Alea Webapp — Initial Schema
-- Migration: 20260401000000_initial_schema.sql
-- ============================================================

-- Enable required extensions for UUID generation and GiST exclusion constraints.
-- On Supabase (PG15+) these are no-ops but safe to include.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Custom types / enums
CREATE TYPE public.role AS ENUM ('member', 'admin');
CREATE TYPE public.table_type AS ENUM ('small', 'large', 'removable_top');
CREATE TYPE public.table_surface AS ENUM ('top', 'bottom');
CREATE TYPE public.reservation_status AS ENUM ('active', 'cancelled', 'completed');

-- ============================================================
-- Table: profiles
-- Extends Supabase auth.users (1:1, auth.users.id = profiles.id)
-- ============================================================
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  member_number varchar(20) NOT NULL UNIQUE,
  email         text NOT NULL,
  role          public.role NOT NULL DEFAULT 'member',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Table: rooms
-- ============================================================
CREATE TABLE public.rooms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  table_count  integer NOT NULL DEFAULT 0,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: tables
-- ============================================================
CREATE TABLE public.tables (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  name       text NOT NULL,
  type       public.table_type NOT NULL DEFAULT 'small',
  qr_code    text,
  pos_x      integer,
  pos_y      integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tables_room_id_idx ON public.tables (room_id);

-- ============================================================
-- Table: reservations
-- ============================================================
CREATE TABLE public.reservations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id   uuid NOT NULL REFERENCES public.tables (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date       date NOT NULL,
  start_time time NOT NULL,
  end_time   time NOT NULL,
  surface    public.table_surface,
  status     public.reservation_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reservation_times_valid CHECK (end_time > start_time)
);

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_active_overlap
  EXCLUDE USING gist (
    table_id WITH =,
    tsrange(date + start_time, date + end_time, '[)') WITH &&
  )
  WHERE (status = 'active'::public.reservation_status);

CREATE INDEX reservations_table_date_idx ON public.reservations (table_id, date);
CREATE INDEX reservations_user_id_idx ON public.reservations (user_id);
CREATE INDEX reservations_date_idx ON public.reservations (date);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
-- SECURITY DEFINER avoids RLS recursion when reading profiles to check role.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_catalog;

-- ---- profiles ----
CREATE POLICY "profiles_admin_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "profiles_member_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_admin_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Members can update their own profile (e.g. email) but cannot escalate their role
CREATE POLICY "profiles_member_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = 'member'::public.role);

-- ---- rooms ----
CREATE POLICY "rooms_public_select"
  ON public.rooms FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "rooms_admin_insert"
  ON public.rooms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "rooms_admin_update"
  ON public.rooms FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "rooms_admin_delete"
  ON public.rooms FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---- tables ----
CREATE POLICY "tables_public_select"
  ON public.tables FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "tables_admin_insert"
  ON public.tables FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "tables_admin_update"
  ON public.tables FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "tables_admin_delete"
  ON public.tables FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---- reservations ----
CREATE POLICY "reservations_select"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "reservations_insert"
  ON public.reservations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "reservations_update"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "reservations_delete"
  ON public.reservations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, member_number, role)
  VALUES (
    NEW.id,
    NEW.email,
    -- Auto-generate a placeholder member_number from the user UUID.
    -- An admin can assign a proper member number after creation.
    'M-' || UPPER(LEFT(REPLACE(NEW.id::text, '-', ''), 8)),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
