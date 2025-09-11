-- Clear match-related data while preserving users, clubs, teams, and players

-- Delete match events (goals, assists, etc.)
DELETE FROM public.match_events;

-- Delete player time logs (playing times)
DELETE FROM public.player_time_logs;

-- Delete fixtures (matches)
DELETE FROM public.fixtures;