-- Critical Fix: Remove rogue standalone 'assist' events
-- These were created due to a UI bug where 'assist' was incorrectly offered as a standalone event type
-- Assists should only exist as attributes of goal events (via assist_player_id field)

-- Log the number of rogue assists before deletion
DO $$
DECLARE
  rogue_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rogue_count FROM match_events WHERE event_type = 'assist';
  RAISE NOTICE 'Found % rogue assist events to be deleted', rogue_count;
END $$;

-- Delete all standalone 'assist' events
DELETE FROM match_events 
WHERE event_type = 'assist';

-- Update the constraint to prevent future standalone assists
-- The constraint already exists but we're making it more explicit
ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_event_type_check;

ALTER TABLE match_events 
ADD CONSTRAINT match_events_event_type_check 
CHECK (event_type = ANY (ARRAY['goal'::text, 'substitution'::text]));

-- Add comment explaining the correct usage
COMMENT ON COLUMN match_events.assist_player_id IS 
'Player who provided the assist for a goal. This is an attribute of goal events, not a separate event type.';

-- Refresh materialized views to ensure correct assist counts
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_goal_scorers;
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_completed_matches;
