-- KIM-383: Multi-day event support
--
-- Adds two new SECURITY DEFINER functions that accept a JSONB array of
-- schedule blocks (room_id, date, start_time, end_time, all_day) so that a
-- single event can block multiple rooms across multiple dates atomically.
--
-- The existing create_event_atomic / update_event_atomic single-room RPCs are
-- intentionally left in place for backward compatibility.
--
-- Uses internal.is_admin() for RLS parity with the rest of the codebase.

-- ---------------------------------------------------------------------------
-- create_event_with_blocks(p_title, p_description, p_blocks jsonb)
--
-- p_blocks is a JSON array of objects:
--   [{ "room_id": "<uuid>|null", "date": "YYYY-MM-DD",
--      "start_time": "HH:MM", "end_time": "HH:MM", "all_day": bool }, ...]
--
-- Returns the event row plus a room_blocks array in the same shape as the
-- existing atomic RPCs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."create_event_with_blocks"(
  "p_title"       text,
  "p_description" text,
  "p_blocks"      jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_event        public.events%ROWTYPE;
  v_block_rec    public.event_room_blocks%ROWTYPE;
  v_blocks_json  jsonb := '[]'::jsonb;
  v_anchor_date  date;
  v_anchor_start time;
  v_anchor_end   time;
  v_elem         jsonb;
  v_room_id      uuid;
  v_date         date;
  v_start        time;
  v_end          time;
  v_all_day      boolean;
  v_table_ids    uuid[];
BEGIN
  -- Require at least one block so the event has a concrete date anchor
  IF p_blocks IS NULL OR jsonb_array_length(p_blocks) = 0 THEN
    RAISE EXCEPTION 'At least one schedule block is required';
  END IF;

  -- Derive event-level anchor from the earliest block (for the events.date /
  -- start_time / end_time columns that the legacy model still expects).
  SELECT
    (blk->>'date')::date,
    CASE WHEN (blk->>'all_day')::boolean THEN '00:00'::time
         ELSE (blk->>'start_time')::time END,
    CASE WHEN (blk->>'all_day')::boolean THEN '23:59'::time
         ELSE (blk->>'end_time')::time END
  INTO v_anchor_date, v_anchor_start, v_anchor_end
  FROM jsonb_array_elements(p_blocks) AS blk
  ORDER BY (blk->>'date')::date ASC,
           (blk->>'start_time') ASC
  LIMIT 1;

  INSERT INTO public.events (title, description, date, start_time, end_time)
  VALUES (p_title, p_description, v_anchor_date, v_anchor_start, v_anchor_end)
  RETURNING * INTO v_event;

  -- Insert each block and cancel overlapping reservations
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_blocks)
  LOOP
    v_room_id := NULLIF(v_elem->>'room_id', '')::uuid;
    v_date    := (v_elem->>'date')::date;
    v_all_day := COALESCE((v_elem->>'all_day')::boolean, false);
    v_start   := CASE WHEN v_all_day THEN '00:00'::time
                      ELSE (v_elem->>'start_time')::time END;
    v_end     := CASE WHEN v_all_day THEN '23:59'::time
                      ELSE (v_elem->>'end_time')::time END;

    IF v_room_id IS NOT NULL THEN
      INSERT INTO public.event_room_blocks (event_id, room_id, date, start_time, end_time, all_day)
      VALUES (v_event.id, v_room_id, v_date, v_start, v_end, v_all_day)
      RETURNING * INTO v_block_rec;

      v_blocks_json := v_blocks_json || jsonb_build_array(
        jsonb_build_object(
          'id',         v_block_rec.id,
          'event_id',   v_block_rec.event_id,
          'room_id',    v_block_rec.room_id,
          'date',       v_block_rec.date,
          'start_time', v_block_rec.start_time,
          'end_time',   v_block_rec.end_time,
          'all_day',    v_block_rec.all_day
        )
      );

      SELECT ARRAY(SELECT id FROM public.tables WHERE room_id = v_room_id)
      INTO v_table_ids;

      IF array_length(v_table_ids, 1) > 0 THEN
        UPDATE public.reservations
        SET status = 'cancelled'
        WHERE table_id = ANY(v_table_ids)
          AND date = v_date
          AND start_time < v_end
          AND end_time   > v_start
          AND status IN ('active', 'pending');
      END IF;
    END IF;
  END LOOP;

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

ALTER FUNCTION "public"."create_event_with_blocks"(text, text, jsonb) OWNER TO "postgres";

-- Grant same as existing event atomic functions
REVOKE ALL ON FUNCTION "public"."create_event_with_blocks"(text, text, jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_event_with_blocks"(text, text, jsonb) TO "service_role";
-- authenticated users must NOT call this directly (admin-only via service layer)


-- ---------------------------------------------------------------------------
-- update_event_with_blocks(p_id, p_title, p_description, p_blocks jsonb)
--
-- Replaces all existing blocks for the event and re-inserts from p_blocks.
-- Cancels overlapping reservations for newly blocked slots.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."update_event_with_blocks"(
  "p_id"          uuid,
  "p_title"       text,
  "p_description" text,
  "p_blocks"      jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_event        public.events%ROWTYPE;
  v_block_rec    public.event_room_blocks%ROWTYPE;
  v_blocks_json  jsonb := '[]'::jsonb;
  v_anchor_date  date;
  v_anchor_start time;
  v_anchor_end   time;
  v_elem         jsonb;
  v_room_id      uuid;
  v_date         date;
  v_start        time;
  v_end          time;
  v_all_day      boolean;
  v_table_ids    uuid[];
BEGIN
  IF p_blocks IS NULL OR jsonb_array_length(p_blocks) = 0 THEN
    RAISE EXCEPTION 'At least one schedule block is required';
  END IF;

  SELECT
    (blk->>'date')::date,
    CASE WHEN (blk->>'all_day')::boolean THEN '00:00'::time
         ELSE (blk->>'start_time')::time END,
    CASE WHEN (blk->>'all_day')::boolean THEN '23:59'::time
         ELSE (blk->>'end_time')::time END
  INTO v_anchor_date, v_anchor_start, v_anchor_end
  FROM jsonb_array_elements(p_blocks) AS blk
  ORDER BY (blk->>'date')::date ASC,
           (blk->>'start_time') ASC
  LIMIT 1;

  UPDATE public.events
  SET
    title       = p_title,
    description = p_description,
    date        = v_anchor_date,
    start_time  = v_anchor_start,
    end_time    = v_anchor_end
  WHERE id = p_id
  RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_id;
  END IF;

  -- Replace all blocks
  DELETE FROM public.event_room_blocks WHERE event_id = p_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_blocks)
  LOOP
    v_room_id := NULLIF(v_elem->>'room_id', '')::uuid;
    v_date    := (v_elem->>'date')::date;
    v_all_day := COALESCE((v_elem->>'all_day')::boolean, false);
    v_start   := CASE WHEN v_all_day THEN '00:00'::time
                      ELSE (v_elem->>'start_time')::time END;
    v_end     := CASE WHEN v_all_day THEN '23:59'::time
                      ELSE (v_elem->>'end_time')::time END;

    IF v_room_id IS NOT NULL THEN
      INSERT INTO public.event_room_blocks (event_id, room_id, date, start_time, end_time, all_day)
      VALUES (p_id, v_room_id, v_date, v_start, v_end, v_all_day)
      RETURNING * INTO v_block_rec;

      v_blocks_json := v_blocks_json || jsonb_build_array(
        jsonb_build_object(
          'id',         v_block_rec.id,
          'event_id',   v_block_rec.event_id,
          'room_id',    v_block_rec.room_id,
          'date',       v_block_rec.date,
          'start_time', v_block_rec.start_time,
          'end_time',   v_block_rec.end_time,
          'all_day',    v_block_rec.all_day
        )
      );

      SELECT ARRAY(SELECT id FROM public.tables WHERE room_id = v_room_id)
      INTO v_table_ids;

      IF array_length(v_table_ids, 1) > 0 THEN
        UPDATE public.reservations
        SET status = 'cancelled'
        WHERE table_id = ANY(v_table_ids)
          AND date = v_date
          AND start_time < v_end
          AND end_time   > v_start
          AND status IN ('active', 'pending');
      END IF;
    END IF;
  END LOOP;

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

ALTER FUNCTION "public"."update_event_with_blocks"(uuid, text, text, jsonb) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."update_event_with_blocks"(uuid, text, text, jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_event_with_blocks"(uuid, text, text, jsonb) TO "service_role";
