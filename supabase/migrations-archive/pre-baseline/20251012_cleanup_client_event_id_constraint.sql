-- Cleanup migration to make client_event_id uniqueness idempotent
-- Ensures legacy index is dropped only if not constraint-backed, and unique constraint exists

begin;

-- Drop standalone index only if the table-level constraint does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'match_events_client_event_id_key'
      AND c.conrelid = 'public.match_events'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'match_events_client_event_id_key'
    ) THEN
      EXECUTE 'DROP INDEX public.match_events_client_event_id_key';
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

-- Ensure the UNIQUE constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'match_events_client_event_id_key'
      AND c.conrelid = 'public.match_events'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.match_events ADD CONSTRAINT match_events_client_event_id_key UNIQUE (client_event_id)';
  END IF;
END
$$ LANGUAGE plpgsql;

commit;
