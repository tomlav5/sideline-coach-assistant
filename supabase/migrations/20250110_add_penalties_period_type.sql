-- Add 'penalties' to period_type ENUM
-- This allows penalty shootouts to be tracked as a distinct period type

ALTER TYPE period_type ADD VALUE IF NOT EXISTS 'penalties';

-- Add comment for documentation
COMMENT ON TYPE period_type IS 'Types of match periods: period (regular play), penalties (penalty shootout)';
