-- Enhanced schema for flexible periods and accurate time tracking

-- Drop existing tables that need restructuring
DROP TABLE IF EXISTS match_events CASCADE;
DROP TABLE IF EXISTS player_time_logs CASCADE;

-- Create enum for period types (more flexible than just halves)
CREATE TYPE period_type AS ENUM ('period');

-- Create enhanced match_periods table
CREATE TABLE public.match_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID NOT NULL,
  period_number INTEGER NOT NULL,
  period_type period_type NOT NULL DEFAULT 'period',
  planned_duration_minutes INTEGER NOT NULL DEFAULT 25,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  pause_time TIMESTAMP WITH TIME ZONE,
  total_paused_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fixture_id, period_number)
);

-- Enhanced match_events table with dual time tracking
CREATE TABLE public.match_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID NOT NULL,
  period_id UUID NOT NULL REFERENCES public.match_periods(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'assist', 'substitution_on', 'substitution_off')),
  player_id UUID,
  assist_player_id UUID,
  minute_in_period INTEGER NOT NULL,
  total_match_minute INTEGER NOT NULL,
  is_our_team BOOLEAN NOT NULL DEFAULT TRUE,
  is_penalty BOOLEAN DEFAULT FALSE,
  notes TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_retrospective BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enhanced player_time_logs for accurate tracking
CREATE TABLE public.player_time_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID NOT NULL,
  player_id UUID NOT NULL,
  period_id UUID NOT NULL REFERENCES public.match_periods(id) ON DELETE CASCADE,
  time_on_minute INTEGER,
  time_off_minute INTEGER,
  is_starter BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  total_period_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Player substitution status tracking
CREATE TABLE public.player_match_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID NOT NULL,
  player_id UUID NOT NULL,
  is_on_field BOOLEAN NOT NULL DEFAULT FALSE,
  position TEXT,
  last_action_minute INTEGER,
  last_action_period_id UUID REFERENCES public.match_periods(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fixture_id, player_id)
);

-- Enhanced fixtures table updates
ALTER TABLE public.fixtures 
ADD COLUMN IF NOT EXISTS current_period_id UUID REFERENCES public.match_periods(id),
ADD COLUMN IF NOT EXISTS match_state JSONB DEFAULT '{"status": "not_started", "total_time_seconds": 0}',
ADD COLUMN IF NOT EXISTS is_retrospective BOOLEAN NOT NULL DEFAULT FALSE;

-- Enable RLS on new tables
ALTER TABLE public.match_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for new tables
CREATE POLICY "Allow all for authenticated users - match_periods" 
ON public.match_periods FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users - match_events" 
ON public.match_events FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users - player_time_logs" 
ON public.player_time_logs FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users - player_match_status" 
ON public.player_match_status FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_match_periods_updated_at
BEFORE UPDATE ON public.match_periods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_match_events_updated_at
BEFORE UPDATE ON public.match_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_time_logs_updated_at
BEFORE UPDATE ON public.player_time_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_match_status_updated_at
BEFORE UPDATE ON public.player_match_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_match_periods_fixture_id ON public.match_periods(fixture_id);
CREATE INDEX idx_match_events_fixture_id ON public.match_events(fixture_id);
CREATE INDEX idx_match_events_period_id ON public.match_events(period_id);
CREATE INDEX idx_player_time_logs_fixture_player ON public.player_time_logs(fixture_id, player_id);
CREATE INDEX idx_player_match_status_fixture_player ON public.player_match_status(fixture_id, player_id);