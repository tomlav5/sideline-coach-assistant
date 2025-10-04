-- Add proper foreign key constraints and cascading deletes to maintain data consistency

-- First, add foreign key constraints to ensure referential integrity
ALTER TABLE match_events 
ADD CONSTRAINT fk_match_events_fixture_id 
FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE;

ALTER TABLE player_time_logs 
ADD CONSTRAINT fk_player_time_logs_fixture_id 
FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE;

-- Also add foreign key for players to ensure consistency
ALTER TABLE match_events 
ADD CONSTRAINT fk_match_events_player_id 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE player_time_logs 
ADD CONSTRAINT fk_player_time_logs_player_id 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- Add foreign key for fixtures to teams
ALTER TABLE fixtures 
ADD CONSTRAINT fk_fixtures_team_id 
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

-- Add indexes for better performance on foreign key lookups
CREATE INDEX IF NOT EXISTS idx_match_events_fixture_id ON match_events(fixture_id);
CREATE INDEX IF NOT EXISTS idx_player_time_logs_fixture_id ON player_time_logs(fixture_id);
CREATE INDEX IF NOT EXISTS idx_match_events_player_id ON match_events(player_id);
CREATE INDEX IF NOT EXISTS idx_player_time_logs_player_id ON player_time_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_team_id ON fixtures(team_id);

-- Create a function to clean up orphaned localStorage entries
CREATE OR REPLACE FUNCTION clean_match_storage_data()
RETURNS TRIGGER AS $$
BEGIN
  -- This function would ideally notify the frontend to clean localStorage
  -- Since we can't directly access localStorage from database, we'll rely on frontend cleanup
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run cleanup when fixtures are deleted
CREATE TRIGGER trigger_clean_match_storage
  AFTER DELETE ON fixtures
  FOR EACH ROW
  EXECUTE FUNCTION clean_match_storage_data();