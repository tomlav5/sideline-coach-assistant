-- Update the fixture status to include 'in_play' status
-- This represents an active match being tracked
ALTER TABLE public.fixtures 
ADD CONSTRAINT check_fixture_status_valid 
CHECK (status IN ('scheduled', 'in_play', 'completed', 'cancelled'));