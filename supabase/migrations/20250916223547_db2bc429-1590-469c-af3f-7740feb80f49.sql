-- Add RLS policies for teams_with_stats view to allow authenticated access
ALTER TABLE teams_with_stats ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read teams_with_stats view
CREATE POLICY "Allow authenticated read on teams_with_stats" 
  ON teams_with_stats FOR SELECT 
  TO authenticated 
  USING (true);

-- Ensure other necessary views also have RLS access
ALTER TABLE players_with_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on players_with_teams" 
  ON players_with_teams FOR SELECT 
  TO authenticated 
  USING (true);

ALTER TABLE fixtures_with_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on fixtures_with_scores" 
  ON fixtures_with_scores FOR SELECT 
  TO authenticated 
  USING (true);

ALTER TABLE dashboard_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on dashboard_stats" 
  ON dashboard_stats FOR SELECT 
  TO authenticated 
  USING (true);