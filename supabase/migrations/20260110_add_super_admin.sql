-- =====================================================
-- Super Admin Flag
-- Adds ability to designate super admins who can:
-- - Approve/reject new registrations
-- - View all admin notifications
-- - Have global oversight
-- =====================================================

-- Add super admin flag to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Create index for super admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin ON profiles(is_super_admin) WHERE is_super_admin = true;

-- Function to check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND is_super_admin = true
      AND account_status = 'approved'
  );
$$;

-- Function to set super admin (can only be called by existing super admin or first user)
CREATE OR REPLACE FUNCTION set_super_admin(target_user_id UUID, is_admin BOOLEAN)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  caller_is_super_admin BOOLEAN;
  is_first_user BOOLEAN;
BEGIN
  -- Check if caller is super admin
  SELECT is_super_admin() INTO caller_is_super_admin;
  
  -- Check if this is the first user being promoted (no super admins exist yet)
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE is_super_admin = true) INTO is_first_user;
  
  -- Only super admins or system (for first user) can set super admin
  IF NOT caller_is_super_admin AND NOT is_first_user THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only super admins can promote other users'
    );
  END IF;
  
  -- Update target user
  UPDATE profiles
  SET 
    is_super_admin = is_admin,
    updated_at = NOW()
  WHERE user_id = target_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'is_super_admin', is_admin
  );
END;
$$;

-- Update RLS policies to use is_super_admin check

-- pending_registrations: Only super admins
DROP POLICY IF EXISTS "Admins can view all pending registrations" ON pending_registrations;
CREATE POLICY "Super admins can view all pending registrations"
  ON pending_registrations FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admins can update pending registrations"
  ON pending_registrations FOR UPDATE
  USING (is_super_admin());

-- admin_notifications: Only super admins
DROP POLICY IF EXISTS "Admins can view all notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON admin_notifications;

CREATE POLICY "Super admins can view all notifications"
  ON admin_notifications FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admins can update notifications"
  ON admin_notifications FOR UPDATE
  USING (is_super_admin());

-- Grant super admin ability to approve club officials
CREATE POLICY "Club admins can approve officials"
  ON club_members FOR UPDATE
  USING (
    -- Club admin of the club
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'active'
    )
    -- OR super admin
    OR is_super_admin()
  );

-- Comment
COMMENT ON COLUMN profiles.is_super_admin IS 'Flag indicating if user has super admin privileges for approving registrations';
COMMENT ON FUNCTION is_super_admin IS 'Returns true if current user is a super admin';
COMMENT ON FUNCTION set_super_admin IS 'Promote or demote a user to super admin status';
