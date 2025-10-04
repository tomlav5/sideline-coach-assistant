-- Drop the existing insert policy for clubs
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;

-- Create the correct insert policy using created_by column
CREATE POLICY "Users can insert their own clubs"
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
);