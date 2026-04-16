-- ============================================================
-- Alea Webapp — Atomic event create RPC function
-- Migration: 20260413000000_fn_create_event_atomic.sql
-- KIM-373
-- ============================================================
-- This function wraps event insertion + room block management
-- + reservation cancellation in a single DB transaction, eliminating
-- the atomicity gap that existed when these steps ran as separate
-- Supabase client calls from the service layer.
-- ============================================================

-- ------------------------------------------------------------
-- create_event_atomic
-- Inserts a new event (and optionally a room block), then cancels
-- any overlapping active/pending reservations for that room.
-- Returns the created event + room blocks as JSONB.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_event_atomic(
  p_title       text,
  p_description text,
  p_date        date,
  p_start_time  time,
  p_end_time    time,
  p_room_id     uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_event       public.events%ROWTYPE;
  v_block       public.event_room_blocks%ROWTYPE;
  v_table_ids   uuid[];
  v_blocks_json jsonb;
BEGIN
  -- Insert the event
  INSERT INTO public.events (title, description, date, start_time, end_time)
  VALUES (p_title, p_description, p_date, p_start_time, p_end_time)
  RETURNING * INTO v_event;

  v_blocks_json := '[]'::jsonb;

  IF p_room_id IS NOT NULL THEN
    -- Insert room block
    INSERT INTO public.event_room_blocks (event_id, room_id, date, start_time, end_time)
    VALUES (v_event.id, p_room_id, p_date, p_start_time, p_end_time)
    RETURNING * INTO v_block;

    v_blocks_json := jsonb_build_array(
      jsonb_build_object(
        'id',       v_block.id,
        'event_id', v_block.event_id,
        'room_id',  v_block.room_id,
        'date',     v_block.date,
        'start_time', v_block.start_time,
        'end_time', v_block.end_time
      )
    );

    -- Collect table IDs in the room
    SELECT ARRAY(
      SELECT id FROM public.tables WHERE room_id = p_room_id
    ) INTO v_table_ids;

    -- Cancel overlapping active/pending reservations
    IF array_length(v_table_ids, 1) > 0 THEN
      UPDATE public.reservations
      SET status = 'cancelled'
      WHERE table_id = ANY(v_table_ids)
        AND date = p_date
        AND start_time < p_end_time
        AND end_time > p_start_time
        AND status IN ('active', 'pending');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id',          v_event.id,
    'title',       v_event.title,
    'description', v_event.description,
    'date',        v_event.date,
    'start_time',  v_event.start_time,
    'end_time',    v_event.end_time,
    'created_by',  v_event.created_by,
    'created_at',  v_event.created_at,
    'room_blocks', v_blocks_json
  );
END;
$$;
