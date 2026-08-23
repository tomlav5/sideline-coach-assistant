-- Fix security issues from materialized views and functions
-- 1. Fix function search path issues by adding SET search_path = ''
CREATE OR REPLACE FUNCTION public.refresh_report_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.mv_completed_matches;
    REFRESH MATERIALIZED VIEW public.mv_goal_scorers;
    REFRESH MATERIALIZED VIEW public.mv_player_playing_time;
    REFRESH MATERIALIZED VIEW public.mv_competitions;
END;
$$;

-- 2. Add RLS to materialized views to secure API access
ALTER MATERIALIZED VIEW public.mv_completed_matches ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_goal_scorers ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_player_playing_time ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_competitions ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for materialized views
CREATE POLICY "Allow authenticated users to view completed matches" 
ON public.mv_completed_matches 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to view goal scorers" 
ON public.mv_goal_scorers 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to view playing time" 
ON public.mv_player_playing_time 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to view competitions" 
ON public.mv_competitions 
FOR SELECT 
USING (true);