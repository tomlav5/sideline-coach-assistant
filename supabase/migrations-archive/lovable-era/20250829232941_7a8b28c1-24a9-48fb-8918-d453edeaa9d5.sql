-- Drop existing function and recreate
DROP FUNCTION IF EXISTS public.test_auth_context();

-- Simple test to verify auth context works in this environment
CREATE OR REPLACE FUNCTION public.debug_auth()
RETURNS TABLE(
  auth_user_id UUID,
  is_auth_valid BOOLEAN
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    auth.uid() as auth_user_id,
    auth.uid() IS NOT NULL as is_auth_valid;
$$;

-- Now let's test this from the actual API context
SELECT * FROM public.debug_auth();