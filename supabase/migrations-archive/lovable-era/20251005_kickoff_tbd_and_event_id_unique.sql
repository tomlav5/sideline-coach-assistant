begin;

-- 3a) Allow fixtures without known kickoff time
alter table public.fixtures
  add column if not exists kickoff_time_tbd boolean default false;

-- 3b) Ensure ON CONFLICT works on match_events.client_event_id
-- Drop the old standalone unique index only if the table-level constraint is not already present
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

-- Add a proper UNIQUE CONSTRAINT (allows multiple NULLs)
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