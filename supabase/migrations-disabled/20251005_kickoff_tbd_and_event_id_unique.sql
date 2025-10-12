begin;

-- 3a) Allow fixtures without known kickoff time
alter table public.fixtures
  add column if not exists kickoff_time_tbd boolean default false;

-- 3b) Ensure ON CONFLICT works on match_events.client_event_id
-- Drop the old partial unique index (safe if missing)
drop index if exists public.match_events_client_event_id_key;

-- Add a proper UNIQUE CONSTRAINT (allows multiple NULLs)
do $$
begin
  alter table public.match_events
    add constraint match_events_client_event_id_key unique (client_event_id);
exception
  when duplicate_object then
    -- already exists, do nothing
    null;
end $$;

commit;