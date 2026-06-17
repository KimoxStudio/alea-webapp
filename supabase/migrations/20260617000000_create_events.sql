CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.event_rooms (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, room_id)
);

CREATE TABLE public.event_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  CONSTRAINT event_schedules_time_valid CHECK (end_time > start_time)
);

CREATE INDEX event_rooms_room_id_idx ON public.event_rooms(room_id);
CREATE INDEX event_schedules_event_date_idx ON public.event_schedules(event_id, date);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_admin_all"
  ON public.events FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "event_rooms_admin_all"
  ON public.event_rooms FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "event_schedules_admin_all"
  ON public.event_schedules FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
