-- Phase 1: Performance Optimization - Database Indexes and Views

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_team_players_player_id ON team_players(player_id);
CREATE INDEX IF NOT EXISTS idx_team_players_team_id ON team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_team_scheduled ON fixtures(team_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_match_events_fixture_type ON match_events(fixture_id, event_type);
CREATE INDEX IF NOT EXISTS idx_match_events_fixture_team ON match_events(fixture_id, is_our_team);
CREATE INDEX IF NOT EXISTS idx_players_club_id ON players(club_id);
CREATE INDEX IF NOT EXISTS idx_teams_club_id ON teams(club_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_status_date ON fixtures(status, scheduled_date);

-- Create optimized view for players with their teams
CREATE OR REPLACE VIEW players_with_teams AS
SELECT 
  p.*,
  c.name as club_name,
  COALESCE(
    json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'team_type', t.team_type,
        'club_id', t.club_id
      )
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'::json
  ) as teams
FROM players p
JOIN clubs c ON p.club_id = c.id
LEFT JOIN team_players tp ON p.id = tp.player_id
LEFT JOIN teams t ON tp.team_id = t.id
GROUP BY p.id, c.name;

-- Create optimized view for teams with player counts
CREATE OR REPLACE VIEW teams_with_stats AS
SELECT 
  t.*,
  c.name as club_name,
  COALESCE(COUNT(tp.player_id), 0) as player_count
FROM teams t
JOIN clubs c ON t.club_id = c.id
LEFT JOIN team_players tp ON t.id = tp.team_id
GROUP BY t.id, c.name;

-- Create optimized view for dashboard statistics
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
  cm.user_id,
  COUNT(DISTINCT c.id) as total_clubs,
  COUNT(DISTINCT t.id) as total_teams,
  COUNT(DISTINCT p.id) as total_players,
  COUNT(DISTINCT CASE 
    WHEN f.status = 'scheduled' AND f.scheduled_date >= NOW() 
    THEN f.id 
  END) as upcoming_fixtures
FROM club_members cm
JOIN clubs c ON cm.club_id = c.id
LEFT JOIN teams t ON c.id = t.club_id
LEFT JOIN players p ON c.id = p.club_id
LEFT JOIN fixtures f ON t.id = f.team_id
GROUP BY cm.user_id;

-- Create optimized view for match reports with scores
CREATE OR REPLACE VIEW fixtures_with_scores AS
SELECT 
  f.*,
  t.name as team_name,
  c.name as club_name,
  COALESCE(our_goals.goal_count, 0) as our_goals,
  COALESCE(opponent_goals.goal_count, 0) as opponent_goals
FROM fixtures f
JOIN teams t ON f.team_id = t.id
JOIN clubs c ON t.club_id = c.id
LEFT JOIN (
  SELECT 
    fixture_id,
    COUNT(*) as goal_count
  FROM match_events 
  WHERE event_type = 'goal' AND is_our_team = true
  GROUP BY fixture_id
) our_goals ON f.id = our_goals.fixture_id
LEFT JOIN (
  SELECT 
    fixture_id,
    COUNT(*) as goal_count
  FROM match_events 
  WHERE event_type = 'goal' AND is_our_team = false
  GROUP BY fixture_id
) opponent_goals ON f.id = opponent_goals.fixture_id;