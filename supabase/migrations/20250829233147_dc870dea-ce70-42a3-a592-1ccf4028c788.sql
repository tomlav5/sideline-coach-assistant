-- Temporarily disable RLS on clubs table to test basic functionality
ALTER TABLE public.clubs DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS but with a very permissive policy for testing
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Create a simple policy that allows any authenticated user to do anything
-- This is for testing only
CREATE POLICY "Allow all for authenticated users - TESTING ONLY"
ON public.clubs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);