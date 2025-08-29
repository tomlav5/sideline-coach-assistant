-- Clean up and recreate the trigger
DROP TRIGGER IF EXISTS add_club_creator_as_admin_trigger ON public.clubs;
DROP TRIGGER IF EXISTS add_club_admin_trigger ON public.clubs;

-- Create the trigger to add creator as admin
CREATE TRIGGER add_club_creator_as_admin_trigger
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.add_club_creator_as_admin();

-- Test function to debug auth context
CREATE OR REPLACE FUNCTION public.test_auth_context()
RETURNS TABLE(
  current_auth_uid UUID,
  is_authenticated BOOLEAN,
  current_user_role TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    auth.uid(),
    auth.uid() IS NOT NULL,
    auth.role()::TEXT;
$$;