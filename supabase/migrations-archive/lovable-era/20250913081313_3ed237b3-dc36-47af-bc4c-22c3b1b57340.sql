-- Clean up test match data while preserving foundational data
-- Delete in proper order to respect foreign key constraints

-- 1. Delete match events (goals, assists, cards, etc.)
DELETE FROM public.match_events;

-- 2. Delete player time logs
DELETE FROM public.player_time_logs;

-- 3. Delete fixtures (matches)
DELETE FROM public.fixtures;

-- Note: This preserves:
-- - App users (profiles table)
-- - Clubs (clubs table) 
-- - Teams (teams table)
-- - Players (players table)
-- - Team player assignments (team_players table)