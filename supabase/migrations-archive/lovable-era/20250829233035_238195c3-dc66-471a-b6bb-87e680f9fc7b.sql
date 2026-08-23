-- Complete reset - drop all existing debug functions
DROP FUNCTION IF EXISTS public.debug_auth() CASCADE;

-- Now create the simplest possible club creation system
-- The key insight: we need to make sure the RLS policy allows inserts properly

-- First, let's see what policies currently exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'clubs';