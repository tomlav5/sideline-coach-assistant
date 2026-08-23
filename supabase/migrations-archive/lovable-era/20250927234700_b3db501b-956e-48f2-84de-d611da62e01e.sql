-- Database Performance Optimization Migration
-- Adding strategic indexes for improved query performance

-- 1. Club Members - Critical for authentication and access control
-- Already has good indexes, but add one for user lookups
CREATE INDEX IF NOT EXISTS idx_club_members_user_id 
ON public.club_members(user_id);

-- 2. Players - Frequently joined and filtered
CREATE INDEX IF NOT EXISTS idx_players_club_id 
ON public.players(club_id);

CREATE INDEX IF NOT EXISTS idx_players_club_jersey 
ON public.players(club_id, jersey_number) 
WHERE jersey_number IS NOT NULL;

-- 3. Teams - Core entity for navigation
CREATE INDEX IF NOT EXISTS idx_teams_club_id 
ON public.teams(club_id);

-- 4. Team Players - Junction table needs compound indexes
CREATE INDEX IF NOT EXISTS idx_team_players_player_id 
ON public.team_players(player_id);

CREATE INDEX IF NOT EXISTS idx_team_players_team_id 
ON public.team_players(team_id);

-- 5. Player Time Logs - Heavy read/write during matches
CREATE INDEX IF NOT EXISTS idx_player_time_logs_player_period 
ON public.player_time_logs(player_id, period_id);

CREATE INDEX IF NOT EXISTS idx_player_time_logs_fixture_player 
ON public.player_time_logs(fixture_id, player_id);

-- 6. Profiles - User data lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles(user_id);

-- 7. Optimize dashboard queries - scheduled date range queries
CREATE INDEX IF NOT EXISTS idx_fixtures_scheduled_date_range 
ON public.fixtures(scheduled_date) 
WHERE status = 'scheduled';

-- 8. Active tracking queries optimization
CREATE INDEX IF NOT EXISTS idx_fixtures_active_tracking 
ON public.fixtures(active_tracker_id, last_activity_at) 
WHERE active_tracker_id IS NOT NULL;

-- 9. Match events optimization for statistics
CREATE INDEX IF NOT EXISTS idx_match_events_player_stats 
ON public.match_events(player_id, event_type, fixture_id) 
WHERE event_type IN ('goal', 'assist', 'yellow_card', 'red_card');

-- 10. Competition-based filtering
CREATE INDEX IF NOT EXISTS idx_fixtures_competition_lookup 
ON public.fixtures(competition_type, competition_name, scheduled_date) 
WHERE competition_name IS NOT NULL;

-- 11. Player match status for live tracking
CREATE INDEX IF NOT EXISTS idx_player_match_status_on_field 
ON public.player_match_status(fixture_id, is_on_field, player_id) 
WHERE is_on_field = true;

ANALYZE public.clubs;
ANALYZE public.teams;
ANALYZE public.players;
ANALYZE public.fixtures;
ANALYZE public.club_members;
ANALYZE public.match_events;
ANALYZE public.player_match_status;
ANALYZE public.team_players;
ANALYZE public.player_time_logs;