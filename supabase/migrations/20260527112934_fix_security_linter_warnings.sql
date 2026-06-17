-- Fix remaining function_search_path_mutable warnings (Supabase security linter).
-- Migration 20260417000004 fixed handle_updated_at, is_admin, is_active_member.
-- These five SECURITY DEFINER functions still had SET search_path = 'public', 'pg_catalog'.
-- All bodies already use fully-qualified references so SET search_path = '' is safe.

CREATE OR REPLACE FUNCTION "public"."get_database_time"() RETURNS timestamp with time zone
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT now();
$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, auth_email, member_number, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.email,
    'M-' || UPPER(RIGHT(REPLACE(NEW.id::text, '-', ''), 12)),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."mark_no_show_reservations"("reference_time" timestamp with time zone DEFAULT "now"(), "club_timezone" "text" DEFAULT 'Atlantic/Canary'::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.reservations
  SET status = 'no_show'
  WHERE status = 'pending'
    AND activated_at IS NULL
    AND ((date::timestamp + end_time::time) AT TIME ZONE club_timezone) < reference_time;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."create_event_atomic"("p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_event       public.events%ROWTYPE;
  v_block       public.event_room_blocks%ROWTYPE;
  v_table_ids   uuid[];
  v_blocks_json jsonb;
  v_start_time  time := CASE WHEN COALESCE(p_all_day, false) THEN '00:00'::time ELSE p_start_time END;
  v_end_time    time := CASE WHEN COALESCE(p_all_day, false) THEN '23:59'::time ELSE p_end_time END;
BEGIN
  INSERT INTO public.events (title, description, date, start_time, end_time)
  VALUES (p_title, p_description, p_date, v_start_time, v_end_time)
  RETURNING * INTO v_event;

  v_blocks_json := '[]'::jsonb;

  IF p_room_id IS NOT NULL THEN
    INSERT INTO public.event_room_blocks (event_id, room_id, date, start_time, end_time, all_day)
    VALUES (v_event.id, p_room_id, p_date, v_start_time, v_end_time, COALESCE(p_all_day, false))
    RETURNING * INTO v_block;

    v_blocks_json := jsonb_build_array(
      jsonb_build_object(
        'id',         v_block.id,
        'event_id',   v_block.event_id,
        'room_id',    v_block.room_id,
        'date',       v_block.date,
        'start_time', v_block.start_time,
        'end_time',   v_block.end_time,
        'all_day',    v_block.all_day
      )
    );

    SELECT ARRAY(
      SELECT id FROM public.tables WHERE room_id = p_room_id
    ) INTO v_table_ids;

    IF array_length(v_table_ids, 1) > 0 THEN
      UPDATE public.reservations
      SET status = 'cancelled'
      WHERE table_id = ANY(v_table_ids)
        AND date = p_date
        AND start_time < v_end_time
        AND end_time > v_start_time
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

CREATE OR REPLACE FUNCTION "public"."update_event_atomic"("p_id" "uuid", "p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_event       public.events%ROWTYPE;
  v_block       public.event_room_blocks%ROWTYPE;
  v_table_ids   uuid[];
  v_blocks_json jsonb;
  v_start_time  time := CASE WHEN COALESCE(p_all_day, false) THEN '00:00'::time ELSE p_start_time END;
  v_end_time    time := CASE WHEN COALESCE(p_all_day, false) THEN '23:59'::time ELSE p_end_time END;
BEGIN
  UPDATE public.events
  SET
    title       = p_title,
    description = p_description,
    date        = p_date,
    start_time  = v_start_time,
    end_time    = v_end_time
  WHERE id = p_id
  RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_id;
  END IF;

  DELETE FROM public.event_room_blocks WHERE event_id = p_id;

  v_blocks_json := '[]'::jsonb;

  IF p_room_id IS NOT NULL THEN
    INSERT INTO public.event_room_blocks (event_id, room_id, date, start_time, end_time, all_day)
    VALUES (p_id, p_room_id, p_date, v_start_time, v_end_time, COALESCE(p_all_day, false))
    RETURNING * INTO v_block;

    v_blocks_json := jsonb_build_array(
      jsonb_build_object(
        'id',         v_block.id,
        'event_id',   v_block.event_id,
        'room_id',    v_block.room_id,
        'date',       v_block.date,
        'start_time', v_block.start_time,
        'end_time',   v_block.end_time,
        'all_day',    v_block.all_day
      )
    );

    SELECT ARRAY(
      SELECT id FROM public.tables WHERE room_id = p_room_id
    ) INTO v_table_ids;

    IF array_length(v_table_ids, 1) > 0 THEN
      UPDATE public.reservations
      SET status = 'cancelled'
      WHERE table_id = ANY(v_table_ids)
        AND date = p_date
        AND start_time < v_end_time
        AND end_time > v_start_time
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
