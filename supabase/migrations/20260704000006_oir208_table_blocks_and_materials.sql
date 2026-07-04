-- OIR-208: unified events — table-level room blocks + event materials.
--
-- 1. event_room_blocks.table_id (nullable FK -> tables.id): NULL keeps
--    today's "whole room" blocking behavior; a non-null value scopes the
--    block (and its reservation-cancellation predicate) to that single
--    table, leaving sibling tables of the same room bookable. Every
--    availability read path that treats event_room_blocks as blocking has
--    been extended in application code to respect this column
--    (lib/server/tables-service.ts, lib/server/rooms-service.ts,
--    lib/server/reservations-service.ts, lib/server/saved-games-service.ts).
-- 2. event_equipment: internal-logistics "materials needed for an event"
--    join table — service-role only, never exposed to the public landing.
-- 3. apply_club_event_room_blocks is extended to accept an optional
--    table_id per block and an optional p_materials payload so the unified
--    event service (lib/server/club-events-service.ts) can replace blocks
--    and materials atomically in one call.

ALTER TABLE "public"."event_room_blocks"
  ADD COLUMN IF NOT EXISTS "table_id" uuid REFERENCES "public"."tables"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "public"."event_equipment" (
  "event_id" uuid NOT NULL REFERENCES "public"."events"("id") ON DELETE CASCADE,
  "equipment_id" uuid NOT NULL REFERENCES "public"."equipment"("id") ON DELETE CASCADE,
  "quantity" integer NOT NULL DEFAULT 1 CHECK ("quantity" > 0),
  PRIMARY KEY ("event_id", "equipment_id")
);

ALTER TABLE "public"."event_equipment" ENABLE ROW LEVEL SECURITY;

-- Internal logistics only — no anon/authenticated policies (same
-- locked-down shape as the final state of reservation_equipment): all
-- reads/writes go exclusively through the service_role client in
-- lib/server/club-events-service.ts. The landing never shows materials.
GRANT ALL ON TABLE "public"."event_equipment" TO "service_role";

-- Adding p_materials changes the function's argument signature — drop the
-- 2-arg version first so CREATE OR REPLACE below defines a single
-- unambiguous 3-arg function instead of an overload.
DROP FUNCTION IF EXISTS "public"."apply_club_event_room_blocks"(uuid, jsonb);

-- ---------------------------------------------------------------------------
-- apply_club_event_room_blocks(p_event_id uuid, p_blocks jsonb, p_materials jsonb)
--
-- p_blocks: JSON array of
--   { "room_id": "<uuid>|null", "table_id": "<uuid>|null", "date": "YYYY-MM-DD",
--     "all_day": bool, "start_time": "HH:MM", "end_time": "HH:MM" }.
--   NULL leaves existing blocks untouched; any array (including []) fully
--   replaces the event's blocks. A null table_id blocks the whole room; a
--   concrete table_id scopes both the block row and the
--   reservation-cancellation predicate to that single table.
--
-- p_materials: JSON array of { "equipment_id": "<uuid>", "quantity": int }.
--   NULL leaves existing materials untouched; any array (including [])
--   fully replaces the event's materials (event_equipment rows).
--
-- Returns the resulting event_room_blocks rows for p_event_id as JSONB.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."apply_club_event_room_blocks"(
  "p_event_id"  uuid,
  "p_blocks"    jsonb,
  "p_materials" jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_elem          jsonb;
  v_room_id       uuid;
  v_table_id      uuid;
  v_date          date;
  v_start         time;
  v_end           time;
  v_all_day       boolean;
  v_table_ids     uuid[];
  v_equipment_id  uuid;
  v_quantity      integer;
  v_blocks_json   jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  IF p_blocks IS NOT NULL THEN
    DELETE FROM public.event_room_blocks WHERE event_id = p_event_id;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_blocks)
    LOOP
      v_room_id  := NULLIF(v_elem->>'room_id', '')::uuid;
      v_table_id := NULLIF(v_elem->>'table_id', '')::uuid;
      v_date     := (v_elem->>'date')::date;
      v_all_day  := COALESCE((v_elem->>'all_day')::boolean, false);
      v_start    := CASE WHEN v_all_day THEN '00:00'::time
                         ELSE (v_elem->>'start_time')::time END;
      v_end      := CASE WHEN v_all_day THEN '23:59'::time
                         ELSE (v_elem->>'end_time')::time END;

      IF v_room_id IS NOT NULL THEN
        INSERT INTO public.event_room_blocks (event_id, room_id, table_id, date, start_time, end_time, all_day)
        VALUES (p_event_id, v_room_id, v_table_id, v_date, v_start, v_end, v_all_day);

        -- Table-level scoping (OIR-208): a block with a table_id only
        -- cancels reservations for that single table; NULL cancels
        -- reservations across every table of the room (unchanged behavior).
        IF v_table_id IS NOT NULL THEN
          v_table_ids := ARRAY[v_table_id];
        ELSE
          SELECT ARRAY(SELECT id FROM public.tables WHERE room_id = v_room_id)
          INTO v_table_ids;
        END IF;

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
  END IF;

  IF p_materials IS NOT NULL THEN
    DELETE FROM public.event_equipment WHERE event_id = p_event_id;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_materials)
    LOOP
      v_equipment_id := NULLIF(v_elem->>'equipment_id', '')::uuid;
      v_quantity     := GREATEST(COALESCE((v_elem->>'quantity')::int, 1), 1);

      IF v_equipment_id IS NOT NULL THEN
        INSERT INTO public.event_equipment (event_id, equipment_id, quantity)
        VALUES (p_event_id, v_equipment_id, v_quantity)
        ON CONFLICT (event_id, equipment_id) DO UPDATE SET quantity = EXCLUDED.quantity;
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',         b.id,
      'event_id',   b.event_id,
      'room_id',    b.room_id,
      'table_id',   b.table_id,
      'date',       b.date,
      'start_time', b.start_time,
      'end_time',   b.end_time,
      'all_day',    b.all_day
    ) ORDER BY b.date, b.start_time
  ), '[]'::jsonb)
  INTO v_blocks_json
  FROM public.event_room_blocks b
  WHERE b.event_id = p_event_id;

  RETURN v_blocks_json;
END;
$$;

ALTER FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb, jsonb) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb, jsonb) TO "service_role";
-- authenticated users must NOT call this directly (admin-only via service layer)
