-- Add 'penalties' to period_type ENUM
-- This allows penalty shootouts to be tracked as a distinct period type

-- Create the enum type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'period_type') THEN
        CREATE TYPE period_type AS ENUM ('period');
    END IF;
END $$;

-- Add 'penalties' value if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'period_type' AND e.enumlabel = 'penalties'
    ) THEN
        ALTER TYPE period_type ADD VALUE 'penalties';
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON TYPE period_type IS 'Types of match periods: period (regular play), penalties (penalty shootout)';
