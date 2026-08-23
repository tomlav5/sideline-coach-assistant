-- Create secure function for admin-only email lookup
-- This function queries auth.users securely and restricts access to club admins only

CREATE OR REPLACE FUNCTION public.find_user_by_email(lookup_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_user_id uuid;
  caller_is_admin boolean;
BEGIN
  -- Check if the caller is an admin of any club
  SELECT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE user_id = auth.uid() 
      AND role = 'admin'
  ) INTO caller_is_admin;
  
  -- Only allow club admins to look up users by email
  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only club admins can look up users by email';
  END IF;
  
  -- Look up the user in auth.users
  SELECT id INTO found_user_id
  FROM auth.users
  WHERE email = lower(trim(lookup_email));
  
  RETURN found_user_id;
END;
$$;

-- Grant execute permission to authenticated users (RLS handles authorization)
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.find_user_by_email(text) IS 
'Securely looks up a user ID by email address. Only callable by club admins. Returns NULL if user not found.';