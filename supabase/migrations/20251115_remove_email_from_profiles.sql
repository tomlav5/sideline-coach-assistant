-- Migration: Remove email from profiles table for improved security
-- Email is already securely stored in auth.users, no need to duplicate it

-- Step 1: Create secure server-side function for admin email lookups
CREATE OR REPLACE FUNCTION public.find_user_by_email(lookup_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_user_id uuid;
BEGIN
  -- Only allow club admins to use this function
  IF NOT EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.user_id = auth.uid()
    AND cm.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only club admins can lookup users by email';
  END IF;

  -- Look up user from auth.users (secure source of truth)
  SELECT id INTO found_user_id
  FROM auth.users
  WHERE email = lookup_email
  AND deleted_at IS NULL
  LIMIT 1;

  RETURN found_user_id;
END;
$$;

-- Grant execute permission only to authenticated users
-- (still protected by admin check inside function)
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;

COMMENT ON FUNCTION public.find_user_by_email(text) IS 
'Securely lookup user ID by email. Only callable by club admins. Uses auth.users as source of truth.';


-- Step 2: Update handle_new_user trigger to not insert email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 
'Trigger function to create profile when new user signs up. Email not stored (uses auth.users).';


-- Step 3: Remove email column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

COMMENT ON TABLE public.profiles IS 
'User profiles. Email is stored in auth.users, not duplicated here for security.';


-- Step 4: Tighten permissions on profiles table
-- Revoke overly broad permissions
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;

-- Grant specific, minimal permissions
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT DELETE ON TABLE public.profiles TO service_role; -- Only service role can delete

COMMENT ON TABLE public.profiles IS 
'User profiles with first/last names. Email stored securely in auth.users only. RLS enforced.';
