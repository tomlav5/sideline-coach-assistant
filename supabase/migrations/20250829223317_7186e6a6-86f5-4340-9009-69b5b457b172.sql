-- Debug authentication issue and temporarily simplify RLS policy for clubs

-- 1. First, let's create a simple test function to check what auth.uid() returns
CREATE OR REPLACE FUNCTION public.test_current_user()
RETURNS TABLE (
  auth_uid uuid,
  session_exists boolean,
  jwt_claims jsonb
) 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid() as auth_uid,
    auth.uid() IS NOT NULL as session_exists,
    auth.jwt() as jwt_claims;
$$;

-- 2. Temporarily simplify the clubs INSERT policy to allow any authenticated user
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;

CREATE POLICY "Authenticated users can create clubs" 
ON public.clubs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Also ensure the trigger is working correctly by making it more robust
CREATE OR REPLACE FUNCTION public.handle_club_creation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log what's happening for debugging
  RAISE NOTICE 'Club creation trigger: auth.uid() = %, NEW.created_by = %', auth.uid(), NEW.created_by;
  
  -- Auto-set created_by to current user if not provided
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
    RAISE NOTICE 'Set created_by to: %', NEW.created_by;
  END IF;
  
  -- For now, just ensure we have a valid auth.uid()
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found (auth.uid() is NULL)';
  END IF;
  
  RETURN NEW;
END;
$$;