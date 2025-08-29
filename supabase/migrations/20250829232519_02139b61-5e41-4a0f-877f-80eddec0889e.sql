-- Simplify the RLS policy - allow authenticated users to insert with their own user_id
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;

CREATE POLICY "Users can insert their own clubs"
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Remove the problematic trigger that's setting created_by
DROP TRIGGER IF EXISTS handle_club_creation_trigger ON public.clubs;
DROP TRIGGER IF EXISTS clubs_creation_trigger ON public.clubs;