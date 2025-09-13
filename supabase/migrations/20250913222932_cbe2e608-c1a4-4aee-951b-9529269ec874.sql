-- Add missing foreign key relationships that were not included in the previous migration

-- Add foreign key from match_events to fixtures
ALTER TABLE public.match_events 
ADD CONSTRAINT fk_match_events_fixture_id 
FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;

-- Add foreign key from match_events to players
ALTER TABLE public.match_events 
ADD CONSTRAINT fk_match_events_player_id 
FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;

-- Add foreign key from match_events to assist players
ALTER TABLE public.match_events 
ADD CONSTRAINT fk_match_events_assist_player_id 
FOREIGN KEY (assist_player_id) REFERENCES public.players(id) ON DELETE SET NULL;

-- Add foreign key from player_time_logs to fixtures
ALTER TABLE public.player_time_logs 
ADD CONSTRAINT fk_player_time_logs_fixture_id 
FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;

-- Add foreign key from player_time_logs to players
ALTER TABLE public.player_time_logs 
ADD CONSTRAINT fk_player_time_logs_player_id 
FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

-- Add foreign key from player_match_status to fixtures
ALTER TABLE public.player_match_status 
ADD CONSTRAINT fk_player_match_status_fixture_id 
FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;

-- Add foreign key from player_match_status to players
ALTER TABLE public.player_match_status 
ADD CONSTRAINT fk_player_match_status_player_id 
FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

-- Add foreign key from match_periods to fixtures
ALTER TABLE public.match_periods 
ADD CONSTRAINT fk_match_periods_fixture_id 
FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;