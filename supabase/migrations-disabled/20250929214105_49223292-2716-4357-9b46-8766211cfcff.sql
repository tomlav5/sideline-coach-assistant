-- Drop the insecure players_with_teams view since it cannot have RLS policies
-- The application already uses the secure function get_players_with_teams_secure() instead
DROP VIEW IF EXISTS players_with_teams;