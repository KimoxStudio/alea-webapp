-- OIR-203 code review (Finding 1, CRITICAL): the JS service layer used to
-- re-implement "replace all room blocks for an event" as a delete-all →
-- per-block insert → per-block reservation-cancel loop with no transaction
-- (race-prone, N+1 round trips). This mirrors what
-- create_event_with_blocks / update_event_with_blocks
-- (20260617000001_kim383_multi_day_events.sql) already do atomically for the
-- internal admin event flow — apply_club_event_room_blocks does the same for
-- the public "club events" flow (lib/server/club-events-service.ts), which
-- manages event_room_blocks independently of the event row's own
-- fields (title/date/etc — those are plain column UPDATEs, not blocks).
--
-- SECURITY DEFINER, REVOKEd from PUBLIC/anon/authenticated, granted only to
-- service_role — same grant shape as the sibling *_with_blocks functions.

-- ---------------------------------------------------------------------------
-- apply_club_event_room_blocks(p_event_id uuid, p_blocks jsonb)
--
-- p_blocks is a JSON array of objects:
--   [{ "room_id": "<uuid>|null", "date": "YYYY-MM-DD",
--      "all_day": bool, "start_time": "HH:MM", "end_time": "HH:MM" }, ...]
--
-- In one transaction: deletes all existing event_room_blocks rows for
-- p_event_id, inserts one row per block that has a non-null room_id (entries
-- with no room are informational-only, same "room blocking optional"
-- semantics as the JS caller previously enforced), and cancels overlapping
-- active/pending reservations for each newly-created block — using the
-- EXACT same overlap predicate as update_event_with_blocks.
--
-- Returns a JSONB array of the inserted block rows (same shape as
-- update_event_with_blocks' room_blocks field) so the caller can build its
-- response without a follow-up SELECT.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."apply_club_event_room_blocks"(
  "p_event_id" uuid,
  "p_blocks"   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_block_rec    public.event_room_blocks%ROWTYPE;
  v_blocks_json  jsonb := '[]'::jsonb;
  v_elem         jsonb;
  v_room_id      uuid;
  v_date         date;
  v_start        time;
  v_end          time;
  v_all_day      boolean;
  v_table_ids    uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  -- Replace all blocks for this event
  DELETE FROM public.event_room_blocks WHERE event_id = p_event_id;

  IF p_blocks IS NOT NULL THEN
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
        VALUES (p_event_id, v_room_id, v_date, v_start, v_end, v_all_day)
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
  END IF;

  RETURN v_blocks_json;
END;
$$;

ALTER FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION "public"."apply_club_event_room_blocks"(uuid, jsonb) TO "service_role";
-- authenticated users must NOT call this directly (admin-only via service layer)

-- ---------------------------------------------------------------------------
-- Finding 6 (LOW): a row with exactly one of title_es/title_en set is
-- orphaned — not visible on the internal admin event list (which excludes
-- rows where EITHER title is populated) and not visible on the public
-- landing / admin "Club events" view (which requires BOTH). Both title_es
-- and title_en must be populated together, or neither.
--
-- Verified against the 24 seeded rows from
-- 20260703000002_oir202_seed_public_landing_events.sql: all seeded club-event
-- rows have both title_es and title_en set, and all internal room-booking
-- rows have neither set — the constraint holds for existing data.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_bilingual_titles_paired"
  CHECK (("title_es" IS NULL) = ("title_en" IS NULL));
