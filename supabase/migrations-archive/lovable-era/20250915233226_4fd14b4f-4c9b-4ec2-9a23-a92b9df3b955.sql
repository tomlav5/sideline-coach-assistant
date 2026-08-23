-- Clear all fixture and match data while preserving clubs, teams, and players

-- Delete in proper order to respect foreign key constraints
DELETE FROM public.match_events;
DELETE FROM public.player_time_logs;
DELETE FROM public.player_match_status;
DELETE FROM public.match_periods;
DELETE FROM public.fixtures;

-- Refresh materialized views to reflect the cleared data
REFRESH MATERIALIZED VIEW public.mv_completed_matches;
REFRESH MATERIALIZED VIEW public.mv_goal_scorers;
REFRESH MATERIALIZED VIEW public.mv_player_playing_time;
REFRESH MATERIALIZED VIEW public.mv_competitions;