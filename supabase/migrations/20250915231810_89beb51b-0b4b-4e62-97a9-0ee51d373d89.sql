-- Performance Optimization for Reports System - Fixed
-- Create materialized views, indexes, and reporting tables

-- 1. Create compound indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fixtures_status_competition ON public.fixtures(status, match_status, competition_type, competition_name);
CREATE INDEX IF NOT EXISTS idx_fixtures_completed ON public.fixtures(status, match_status) WHERE status = 'completed' OR match_status = 'completed';
CREATE INDEX IF NOT EXISTS idx_match_events_fixture_type ON public.match_events(fixture_id, event_type, is_our_team, player_id);
CREATE INDEX IF NOT EXISTS idx_match_events_goals_assists ON public.match_events(fixture_id, event_type, player_id) WHERE event_type IN ('goal', 'assist') AND is_our_team = true;
CREATE INDEX IF NOT EXISTS idx_player_time_logs_fixture ON public.player_time_logs(fixture_id, player_id);
CREATE INDEX IF NOT EXISTS idx_team_players_lookup ON public.team_players(player_id, team_id);

-- 2. Create materialized view for completed matches with scores
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_completed_matches AS
SELECT 
    f.id,
    f.scheduled_date,
    f.opponent_name,
    f.location,
    f.competition_type,
    f.competition_name,
    t.name as team_name,
    c.name as club_name,
    COALESCE(our_goals.count, 0) as our_goals,
    COALESCE(opp_goals.count, 0) as opponent_goals
FROM public.fixtures f
JOIN public.teams t ON f.team_id = t.id
JOIN public.clubs c ON t.club_id = c.id
LEFT JOIN (
    SELECT fixture_id, COUNT(*) as count
    FROM public.match_events 
    WHERE event_type = 'goal' AND is_our_team = true
    GROUP BY fixture_id
) our_goals ON f.id = our_goals.fixture_id
LEFT JOIN (
    SELECT fixture_id, COUNT(*) as count
    FROM public.match_events 
    WHERE event_type = 'goal' AND is_our_team = false
    GROUP BY fixture_id
) opp_goals ON f.id = opp_goals.fixture_id
WHERE f.status = 'completed' OR f.match_status = 'completed';

-- 3. Create materialized view for goal scorers stats
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_goal_scorers AS
SELECT 
    p.id as player_id,
    CONCAT(p.first_name, ' ', p.last_name) as player_name,
    t.name as team_name,
    f.competition_type,
    f.competition_name,
    SUM(CASE WHEN me.event_type = 'goal' THEN 1 ELSE 0 END) as goals,
    SUM(CASE WHEN me.event_type = 'assist' THEN 1 ELSE 0 END) as assists,
    SUM(CASE WHEN me.event_type IN ('goal', 'assist') THEN 1 ELSE 0 END) as total_contributions
FROM public.players p
JOIN public.match_events me ON p.id = me.player_id
JOIN public.fixtures f ON me.fixture_id = f.id
JOIN public.teams t ON f.team_id = t.id
WHERE me.event_type IN ('goal', 'assist') 
    AND me.is_our_team = true
    AND (f.status = 'completed' OR f.match_status = 'completed')
GROUP BY p.id, p.first_name, p.last_name, t.name, f.competition_type, f.competition_name
HAVING SUM(CASE WHEN me.event_type IN ('goal', 'assist') THEN 1 ELSE 0 END) > 0;

-- 4. Create materialized view for player playing time
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_player_playing_time AS
SELECT 
    p.id as player_id,
    CONCAT(p.first_name, ' ', p.last_name) as player_name,
    t.name as team_name,
    f.competition_type,
    f.competition_name,
    SUM(ptl.total_period_minutes) as total_minutes,
    COUNT(DISTINCT f.id) as matches_played,
    ROUND(AVG(ptl.total_period_minutes)) as average_minutes
FROM public.players p
JOIN public.player_time_logs ptl ON p.id = ptl.player_id
JOIN public.fixtures f ON ptl.fixture_id = f.id
JOIN public.teams t ON f.team_id = t.id
WHERE (f.status = 'completed' OR f.match_status = 'completed')
    AND ptl.total_period_minutes IS NOT NULL
    AND ptl.total_period_minutes > 0
GROUP BY p.id, p.first_name, p.last_name, t.name, f.competition_type, f.competition_name;

-- 5. Create materialized view for competitions
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_competitions AS
SELECT DISTINCT
    CASE 
        WHEN competition_type IS NOT NULL THEN CONCAT('type:', competition_type)
        ELSE competition_name
    END as filter_value,
    CASE 
        WHEN competition_type IS NOT NULL THEN UPPER(SUBSTRING(competition_type FROM 1 FOR 1)) || LOWER(SUBSTRING(competition_type FROM 2))
        ELSE competition_name
    END as display_name,
    competition_type,
    competition_name
FROM public.fixtures
WHERE (status = 'completed' OR match_status = 'completed')
    AND (competition_type IS NOT NULL OR competition_name IS NOT NULL);

-- 6. Create indexes on materialized views
CREATE INDEX IF NOT EXISTS idx_mv_completed_matches_competition ON public.mv_completed_matches(competition_type, competition_name);
CREATE INDEX IF NOT EXISTS idx_mv_completed_matches_date ON public.mv_completed_matches(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_mv_goal_scorers_competition ON public.mv_goal_scorers(competition_type, competition_name);
CREATE INDEX IF NOT EXISTS idx_mv_goal_scorers_contributions ON public.mv_goal_scorers(total_contributions DESC);
CREATE INDEX IF NOT EXISTS idx_mv_playing_time_competition ON public.mv_player_playing_time(competition_type, competition_name);
CREATE INDEX IF NOT EXISTS idx_mv_playing_time_total ON public.mv_player_playing_time(total_minutes DESC);

-- 7. Function to refresh all report materialized views
CREATE OR REPLACE FUNCTION public.refresh_report_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.mv_completed_matches;
    REFRESH MATERIALIZED VIEW public.mv_goal_scorers;
    REFRESH MATERIALIZED VIEW public.mv_player_playing_time;
    REFRESH MATERIALIZED VIEW public.mv_competitions;
END;
$$;

-- 8. Create triggers to refresh materialized views when data changes
CREATE OR REPLACE FUNCTION public.trigger_refresh_report_views()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Use pg_notify to trigger async refresh
    PERFORM pg_notify('refresh_reports', '');
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS refresh_reports_on_fixture_change ON public.fixtures;
DROP TRIGGER IF EXISTS refresh_reports_on_event_change ON public.match_events;
DROP TRIGGER IF EXISTS refresh_reports_on_time_change ON public.player_time_logs;

-- Create triggers
CREATE TRIGGER refresh_reports_on_fixture_change
    AFTER INSERT OR UPDATE OR DELETE ON public.fixtures
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_refresh_report_views();

CREATE TRIGGER refresh_reports_on_event_change
    AFTER INSERT OR UPDATE OR DELETE ON public.match_events
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_refresh_report_views();

CREATE TRIGGER refresh_reports_on_time_change
    AFTER INSERT OR UPDATE OR DELETE ON public.player_time_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_refresh_report_views();

-- 9. Initial refresh of all views
SELECT public.refresh_report_views();