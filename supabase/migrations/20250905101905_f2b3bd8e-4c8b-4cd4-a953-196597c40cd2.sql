-- Add match_status to fixtures table for persistent tracking
ALTER TABLE public.fixtures 
ADD COLUMN match_status TEXT DEFAULT 'not_started' CHECK (match_status IN ('not_started', 'in_progress', 'paused', 'completed'));

-- Create index for better performance when querying by status
CREATE INDEX idx_fixtures_match_status ON public.fixtures(match_status);

-- Update existing fixtures to have proper status
UPDATE public.fixtures 
SET match_status = CASE 
  WHEN status = 'completed' THEN 'completed'
  ELSE 'not_started'
END;