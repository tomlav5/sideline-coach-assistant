-- Fix function search path security issue only
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