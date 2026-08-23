-- Add competition fields to fixtures table and extend event types

-- First, create the competition_type enum
CREATE TYPE competition_type AS ENUM ('league', 'tournament', 'friendly');

-- Add new columns to fixtures table
ALTER TABLE public.fixtures 
ADD COLUMN competition_type competition_type DEFAULT 'friendly',
ADD COLUMN competition_name text;

-- Add goal_kick to the existing event_type enum
ALTER TYPE event_type ADD VALUE 'goal_kick';

-- Create index for better performance on competition filtering
CREATE INDEX idx_fixtures_competition_type ON public.fixtures(competition_type);
CREATE INDEX idx_fixtures_competition_name ON public.fixtures(competition_name) WHERE competition_name IS NOT NULL;