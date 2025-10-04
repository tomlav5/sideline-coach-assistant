-- Add unique constraint to player_time_logs table to support upsert operations
-- This will prevent duplicate entries for the same player in the same period of the same fixture
ALTER TABLE public.player_time_logs 
ADD CONSTRAINT unique_player_period_fixture 
UNIQUE (fixture_id, player_id, period_id);