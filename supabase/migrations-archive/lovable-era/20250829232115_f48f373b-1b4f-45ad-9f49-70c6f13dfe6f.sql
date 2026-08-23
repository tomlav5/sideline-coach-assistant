-- Check and fix all club policies
-- Drop ALL existing insert policies for clubs
DROP POLICY IF EXISTS "Users can insert their own clubs" ON public.clubs;
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;

-- Create the correct insert policy
CREATE POLICY "Authenticated users can create clubs"
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also update the frontend code to not set created_by
-- The trigger will handle it automatically