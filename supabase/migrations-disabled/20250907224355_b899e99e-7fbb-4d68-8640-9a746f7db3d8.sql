-- Reset app data for testing
-- Delete in order to respect foreign key constraints

-- 1. Delete all match events first (references fixtures)
DELETE FROM match_events;

-- 2. Delete all player time logs (references fixtures)  
DELETE FROM player_time_logs;

-- 3. Delete all fixtures
DELETE FROM fixtures;

-- Verify deletions
SELECT 'Fixtures deleted' as status, COUNT(*) as remaining_count FROM fixtures
UNION ALL
SELECT 'Events deleted' as status, COUNT(*) as remaining_count FROM match_events  
UNION ALL
SELECT 'Time logs deleted' as status, COUNT(*) as remaining_count FROM player_time_logs;