-- Test the current authentication context and fix the trigger
DO $$
BEGIN
    RAISE NOTICE 'Current auth.uid(): %', auth.uid();
    RAISE NOTICE 'Current user: %', current_user;
    RAISE NOTICE 'Session user: %', session_user;
END $$;

-- Check if our trigger exists
SELECT tgname, tgrelid::regclass, proname 
FROM pg_trigger t 
JOIN pg_proc p ON t.tgfoid = p.oid 
WHERE tgrelid = 'public.clubs'::regclass;

-- Let's recreate the RLS policy to be more explicit
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;

-- Create a policy that should definitely work for authenticated users
CREATE POLICY "Authenticated users can create clubs"
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Also ensure the trigger is working properly
DROP TRIGGER IF EXISTS handle_club_creation_trigger ON public.clubs;
DROP TRIGGER IF EXISTS add_club_creator_as_admin_trigger ON public.clubs;

-- Recreate both triggers
CREATE TRIGGER handle_club_creation_trigger
  BEFORE INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.handle_club_creation();

CREATE TRIGGER add_club_creator_as_admin_trigger
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.add_club_creator_as_admin();