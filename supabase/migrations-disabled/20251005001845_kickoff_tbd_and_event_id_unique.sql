begin;

-- 1) Allow fixtures without known kickoff time (safe if already present)
alter table public.fixtures
  add column if not exists kickoff_time_tbd boolean default false;

-- 2) Ensure ON CONFLICT works on match_events.client_event_id
-- Drop any legacy partial unique index if present
 do $$
 begin
   if exists (
     select 1 from pg_indexes 
     where schemaname = 'public' 
       and indexname = 'match_events_client_event_id_key'
   ) then
     execute 'drop index public.match_events_client_event_id_key';
   end if;
 end $$;

-- Add a proper UNIQUE CONSTRAINT (allows multiple NULLs)
 do $$
 begin
   alter table public.match_events
     add constraint match_events_client_event_id_key unique (client_event_id);
 exception
   when duplicate_object then
     -- Constraint already exists
     null;
 end $$;

commit;
