-- Clean up and recreate everything properly
DROP TRIGGER IF EXISTS add_club_creator_as_admin_trigger ON public.clubs;
DROP TRIGGER IF EXISTS add_club_admin_trigger ON public.clubs;

-- Create the trigger to add creator as admin
CREATE TRIGGER add_club_creator_as_admin_trigger
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.add_club_creator_as_admin();

-- Test the authentication context is working
-- Let's create a test function to debug auth context
CREATE OR REPLACE FUNCTION public.test_auth_context()
RETURNS TABLE(
  current_auth_uid UUID,
  is_authenticated BOOLEAN,
  current_role TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    auth.uid() as current_auth_uid,
    auth.uid() IS NOT NULL as is_authenticated,
    auth.role() as current_role;
$$;