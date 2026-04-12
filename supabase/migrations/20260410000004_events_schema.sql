-- ============================================================
-- Alea Webapp — Events Data Model
-- Migration: 20260410000004_events_schema.sql
-- KIM-332, KIM-343
-- ============================================================

-- ============================================================
-- Table: events
-- Stores association events (game nights, tournaments, etc.)
-- ============================================================
CREATE TABLE public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  date        date NOT NULL,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  created_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_date_idx ON public.events (date);

-- ============================================================
-- Table: event_room_blocks
-- Links events to rooms, blocking a room for a given time slot.
-- ============================================================
CREATE TABLE public.event_room_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  room_id    uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  date       date NOT NULL,
  start_time time NOT NULL,
  end_time   time NOT NULL
);

CREATE INDEX event_room_blocks_event_id_idx ON public.event_room_blocks (event_id);
CREATE INDEX event_room_blocks_room_id_idx ON public.event_room_blocks (room_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_room_blocks ENABLE ROW LEVEL SECURITY;

-- ---- events ----
CREATE POLICY "events_select"
  ON public.events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "events_admin_insert"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "events_admin_update"
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "events_admin_delete"
  ON public.events FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---- event_room_blocks ----
CREATE POLICY "event_room_blocks_select"
  ON public.event_room_blocks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "event_room_blocks_admin_insert"
  ON public.event_room_blocks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "event_room_blocks_admin_update"
  ON public.event_room_blocks FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "event_room_blocks_admin_delete"
  ON public.event_room_blocks FOR DELETE
  TO authenticated
  USING (public.is_admin());
