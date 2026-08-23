-- ========================================
-- COMPREHENSIVE REPORT ARCHITECTURE REBUILD
-- Creates optimized materialized views for match reporting
-- ========================================

-- 1. COMPLETED MATCHES VIEW
-- Aggregates fixtures with calculated scores and team/competition info
CREATE MATERIALIZED VIEW mv_completed_matches AS
SELECT 
    f.id,
    f.scheduled_date,
    f.opponent_name,
    f.location,
    f.competition_type,
    f.competition_name,
    t.name as team_name,
    c.name as club_name,
    -- Calculate our goals from match_events
    COALESCE((
        SELECT COUNT(*)::integer 
        FROM match_events me 
        WHERE me.fixture_id = f.id 
        AND me.event_type = 'goal' 
        AND me.is_our_team = true
    ), 0) as our_goals,
    -- Calculate opponent goals from match_events  
    COALESCE((
        SELECT COUNT(*)::integer 
        FROM match_events me 
        WHERE me.fixture_id = f.id 
        AND me.event_type = 'goal' 
        AND me.is_our_team = false
    ), 0) as opponent_goals,
    -- Match metadata
    f.created_at,
    f.updated_at
FROM fixtures f
JOIN teams t ON f.team_id = t.id
JOIN clubs c ON t.club_id = c.id
WHERE f.status = 'completed' OR f.match_status = 'completed'
ORDER BY f.scheduled_date DESC;

-- 2. GOAL SCORERS VIEW  
-- Aggregates goals and assists by player across all completed matches
CREATE MATERIALIZED VIEW mv_goal_scorers AS
WITH player_goals AS (
    SELECT 
        me.player_id,
        p.first_name || ' ' || p.last_name as player_name,
        t.name as team_name,
        c.name as club_name,
        f.competition_type,
        f.competition_name,
        COUNT(*) as goals,
        0 as assists
    FROM match_events me
    JOIN fixtures f ON me.fixture_id = f.id
    JOIN players p ON me.player_id = p.id
    JOIN teams t ON f.team_id = t.id
    JOIN clubs c ON t.club_id = c.id
    WHERE me.event_type = 'goal' 
    AND me.is_our_team = true
    AND (f.status = 'completed' OR f.match_status = 'completed')
    AND me.player_id IS NOT NULL
    GROUP BY me.player_id, p.first_name, p.last_name, t.name, c.name, f.competition_type, f.competition_name
),
player_assists AS (
    SELECT 
        me.assist_player_id as player_id,
        p.first_name || ' ' || p.last_name as player_name,
        t.name as team_name,
        c.name as club_name,
        f.competition_type,
        f.competition_name,
        0 as goals,
        COUNT(*) as assists
    FROM match_events me
    JOIN fixtures f ON me.fixture_id = f.id
    JOIN players p ON me.assist_player_id = p.id
    JOIN teams t ON f.team_id = t.id
    JOIN clubs c ON t.club_id = c.id
    WHERE me.event_type = 'goal' 
    AND me.is_our_team = true
    AND (f.status = 'completed' OR f.match_status = 'completed')
    AND me.assist_player_id IS NOT NULL
    GROUP BY me.assist_player_id, p.first_name, p.last_name, t.name, c.name, f.competition_type, f.competition_name
),
combined_stats AS (
    SELECT * FROM player_goals
    UNION ALL 
    SELECT * FROM player_assists
)
SELECT 
    player_id,
    player_name,
    team_name,
    club_name,
    competition_type,
    competition_name,
    SUM(goals)::integer as goals,
    SUM(assists)::integer as assists,
    (SUM(goals) + SUM(assists))::integer as total_contributions
FROM combined_stats
GROUP BY player_id, player_name, team_name, club_name, competition_type, competition_name
ORDER BY total_contributions DESC, goals DESC;

-- 3. PLAYER PLAYING TIME VIEW
-- Aggregates total playing time by player across all completed matches
CREATE MATERIALIZED VIEW mv_player_playing_time AS
SELECT 
    ptl.player_id,
    p.first_name || ' ' || p.last_name as player_name,
    t.name as team_name,
    c.name as club_name,
    f.competition_type,
    f.competition_name,
    SUM(COALESCE(ptl.total_period_minutes, 0))::integer as total_minutes,
    COUNT(DISTINCT ptl.fixture_id)::integer as matches_played,
    CASE 
        WHEN COUNT(DISTINCT ptl.fixture_id) > 0 
        THEN ROUND(SUM(COALESCE(ptl.total_period_minutes, 0))::numeric / COUNT(DISTINCT ptl.fixture_id))::integer
        ELSE 0
    END as average_minutes
FROM player_time_logs ptl
JOIN fixtures f ON ptl.fixture_id = f.id
JOIN players p ON ptl.player_id = p.id
JOIN teams t ON f.team_id = t.id  
JOIN clubs c ON t.club_id = c.id
WHERE (f.status = 'completed' OR f.match_status = 'completed')
AND ptl.total_period_minutes > 0
GROUP BY ptl.player_id, p.first_name, p.last_name, t.name, c.name, f.competition_type, f.competition_name
ORDER BY total_minutes DESC;

-- 4. COMPETITIONS VIEW
-- Lists all available competitions for filtering
CREATE MATERIALIZED VIEW mv_competitions AS
SELECT DISTINCT
    CASE 
        WHEN competition_name IS NOT NULL AND competition_name != '' 
        THEN competition_name
        ELSE competition_type::text
    END as filter_value,
    CASE 
        WHEN competition_name IS NOT NULL AND competition_name != '' 
        THEN competition_name
        ELSE INITCAP(competition_type::text)
    END as display_name,
    competition_type,
    competition_name
FROM fixtures 
WHERE (status = 'completed' OR match_status = 'completed')
AND competition_type IS NOT NULL
ORDER BY display_name;

-- ========================================
-- PERFORMANCE OPTIMIZATIONS
-- ========================================

-- Indexes for mv_completed_matches
CREATE INDEX idx_mv_completed_matches_date ON mv_completed_matches(scheduled_date DESC);
CREATE INDEX idx_mv_completed_matches_competition ON mv_completed_matches(competition_type);
CREATE INDEX idx_mv_completed_matches_club ON mv_completed_matches(club_name);

-- Indexes for mv_goal_scorers  
CREATE INDEX idx_mv_goal_scorers_contributions ON mv_goal_scorers(total_contributions DESC);
CREATE INDEX idx_mv_goal_scorers_player ON mv_goal_scorers(player_id);
CREATE INDEX idx_mv_goal_scorers_competition ON mv_goal_scorers(competition_type);

-- Indexes for mv_player_playing_time
CREATE INDEX idx_mv_player_playing_time_minutes ON mv_player_playing_time(total_minutes DESC);
CREATE INDEX idx_mv_player_playing_time_player ON mv_player_playing_time(player_id);
CREATE INDEX idx_mv_player_playing_time_competition ON mv_player_playing_time(competition_type);

-- Indexes for mv_competitions
CREATE INDEX idx_mv_competitions_filter ON mv_competitions(filter_value);

-- ========================================
-- AUTOMATIC REFRESH TRIGGERS  
-- ========================================

-- Function to refresh all report views
CREATE OR REPLACE FUNCTION refresh_report_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_completed_matches;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_goal_scorers;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_player_playing_time;  
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_competitions;
END;
$$;

-- Trigger function to refresh views when relevant data changes
CREATE OR REPLACE FUNCTION trigger_refresh_reports()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Use pg_notify to signal that reports need refreshing
    -- This allows the frontend to listen and refresh data
    PERFORM pg_notify('refresh_reports', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', extract(epoch from now())
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers on relevant tables
CREATE TRIGGER trigger_fixtures_refresh_reports
    AFTER INSERT OR UPDATE OR DELETE ON fixtures
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_reports();

CREATE TRIGGER trigger_match_events_refresh_reports  
    AFTER INSERT OR UPDATE OR DELETE ON match_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_reports();

CREATE TRIGGER trigger_player_time_logs_refresh_reports
    AFTER INSERT OR UPDATE OR DELETE ON player_time_logs  
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_reports();

-- ========================================
-- ENABLE REALTIME FOR AUTOMATIC UPDATES
-- ========================================

-- Add materialized views to realtime publication (if needed)
-- Note: Materialized views can't have realtime directly, but we'll use notifications

-- Grant necessary permissions
GRANT SELECT ON mv_completed_matches TO authenticated;
GRANT SELECT ON mv_goal_scorers TO authenticated;
GRANT SELECT ON mv_player_playing_time TO authenticated;
GRANT SELECT ON mv_competitions TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_report_views() TO authenticated;