-- TEMPORARY: Remove all authentication checks for debugging
-- WARNING: This allows anyone to create clubs - NOT SECURE!

DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;

CREATE POLICY "Temporary - Anyone can create clubs" 
ON public.clubs 
FOR INSERT 
WITH CHECK (true);