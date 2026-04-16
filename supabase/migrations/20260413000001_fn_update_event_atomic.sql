-- ============================================================
-- Alea Webapp — Atomic event update RPC function
-- Migration: 20260413000001_fn_update_event_atomic.sql
-- KIM-373
-- ============================================================
-- This function wraps event update + room block replacement
-- + reservation cancellation in a single DB transaction, eliminating
-- the atomicity gap that existed when these steps ran as separate
-- Supabase client calls from the service layer.
-- ============================================================

-- ------------------------------------------------------------
-- update_event_atomic
-- Updates an existing event, replaces its room blocks, then cancels
-- any overlapping active/pending reservations for the updated room.
-- Returns the updated event + room blocks as JSONB.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_event_atomic(
  p_id          uuid,
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
  -- Update the event row
  UPDATE public.events
  SET
    title       = p_title,
    description = p_description,
    date        = p_date,
    start_time  = p_start_time,
    end_time    = p_end_time
  WHERE id = p_id
  RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_id;
  END IF;

  -- Replace room blocks
  DELETE FROM public.event_room_blocks WHERE event_id = p_id;

  v_blocks_json := '[]'::jsonb;

  IF p_room_id IS NOT NULL THEN
    INSERT INTO public.event_room_blocks (event_id, room_id, date, start_time, end_time)
    VALUES (p_id, p_room_id, p_date, p_start_time, p_end_time)
    RETURNING * INTO v_block;

    v_blocks_json := jsonb_build_array(
      jsonb_build_object(
        'id',         v_block.id,
        'event_id',   v_block.event_id,
        'room_id',    v_block.room_id,
        'date',       v_block.date,
        'start_time', v_block.start_time,
        'end_time',   v_block.end_time
      )
    );

    -- Collect table IDs in the (new) room
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
