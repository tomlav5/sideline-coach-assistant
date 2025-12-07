-- Automatic calculation of total_period_minutes for player_time_logs
-- This trigger ensures that whenever time_on_minute or time_off_minute changes,
-- the total_period_minutes is recalculated automatically

CREATE OR REPLACE FUNCTION public.calculate_total_period_minutes()
RETURNS TRIGGER AS $$
DECLARE
  period_duration INTEGER;
BEGIN
  -- Get the planned duration for this period
  SELECT planned_duration_minutes INTO period_duration
  FROM public.match_periods
  WHERE id = NEW.period_id;

  -- Calculate total_period_minutes based on the time interval
  -- Logic:
  -- 1. If time_off_minute is NULL (still playing), use period_duration as the cap
  -- 2. For starters (time_on_minute = 0 or NULL), start from 0
  -- 3. For substitutes, start from time_on_minute
  -- 4. End time is either time_off_minute or period_duration
  
  IF NEW.time_off_minute IS NOT NULL THEN
    -- Player has been substituted off or period ended
    -- Calculate actual time played
    NEW.total_period_minutes := NEW.time_off_minute - COALESCE(NEW.time_on_minute, 0);
  ELSIF NEW.is_active = false AND period_duration IS NOT NULL THEN
    -- Period has ended, player was on field until the end
    NEW.total_period_minutes := period_duration - COALESCE(NEW.time_on_minute, 0);
  ELSE
    -- Player is still active, can't calculate final time yet
    -- Keep it at 0 or whatever was set
    IF NEW.total_period_minutes IS NULL THEN
      NEW.total_period_minutes := 0;
    END IF;
  END IF;

  -- Ensure non-negative values
  IF NEW.total_period_minutes < 0 THEN
    NEW.total_period_minutes := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trigger_calculate_player_time ON public.player_time_logs;

-- Create the trigger to run before insert or update
CREATE TRIGGER trigger_calculate_player_time
  BEFORE INSERT OR UPDATE ON public.player_time_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_total_period_minutes();

-- Update existing records with NULL or 0 total_period_minutes
-- This is a one-time fix for existing data
UPDATE public.player_time_logs
SET total_period_minutes = CASE
  WHEN time_off_minute IS NOT NULL THEN 
    time_off_minute - COALESCE(time_on_minute, 0)
  WHEN is_active = false THEN 
    (SELECT planned_duration_minutes FROM public.match_periods WHERE id = period_id) - COALESCE(time_on_minute, 0)
  ELSE 
    0
END
WHERE total_period_minutes IS NULL OR total_period_minutes = 0;
