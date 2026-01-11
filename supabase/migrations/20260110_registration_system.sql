-- =====================================================
-- Registration System Migration
-- Implements Gold Standard registration workflow with:
-- - Manual admin approval for new users
-- - OAuth provider tracking
-- - Invitation system for clubs
-- - Official approval workflow
-- =====================================================

-- Add account status and OAuth tracking to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'pending' CHECK (account_status IN ('pending', 'approved', 'rejected', 'suspended')),
ADD COLUMN IF NOT EXISTS oauth_provider TEXT,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add status and invitation tracking to club_members
ALTER TABLE club_members
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'rejected')),
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Create pending_registrations table for tracking new sign-ups
CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  oauth_provider TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create club_invitations table for invite links
CREATE TABLE IF NOT EXISTS club_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  invited_email TEXT,
  invited_role user_role NOT NULL,
  invitation_token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create admin_notifications table for tracking approval requests
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('new_registration', 'official_request', 'club_created')),
  user_id UUID REFERENCES auth.users(id),
  club_id UUID REFERENCES clubs(id),
  metadata JSONB,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'actioned')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  read_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_registrations_status ON pending_registrations(status);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_user_id ON pending_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_club_invitations_token ON club_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_club_invitations_status ON club_invitations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_club_invitations_email ON club_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_club_members_status ON club_members(status);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status, created_at);

-- Function: Create pending registration on new user signup
CREATE OR REPLACE FUNCTION create_pending_registration()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_email TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
  provider TEXT;
BEGIN
  -- Get user details from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
  
  -- Get metadata from profile or auth
  user_first_name := NEW.first_name;
  user_last_name := NEW.last_name;
  
  -- Determine OAuth provider (if any)
  SELECT 
    CASE 
      WHEN raw_user_meta_data->>'provider' IS NOT NULL THEN raw_user_meta_data->>'provider'
      ELSE 'email'
    END INTO provider
  FROM auth.users 
  WHERE id = NEW.user_id;
  
  -- Create pending registration record
  INSERT INTO pending_registrations (
    user_id,
    email,
    first_name,
    last_name,
    oauth_provider,
    status
  ) VALUES (
    NEW.user_id,
    user_email,
    user_first_name,
    user_last_name,
    provider,
    'pending'
  );
  
  -- Create admin notification
  INSERT INTO admin_notifications (
    notification_type,
    user_id,
    metadata,
    status
  ) VALUES (
    'new_registration',
    NEW.user_id,
    jsonb_build_object(
      'email', user_email,
      'first_name', user_first_name,
      'last_name', user_last_name,
      'provider', provider
    ),
    'unread'
  );
  
  RETURN NEW;
END;
$$;

-- Trigger: Create pending registration when profile is created
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.account_status = 'pending')
  EXECUTE FUNCTION create_pending_registration();

-- Function: Approve user registration
CREATE OR REPLACE FUNCTION approve_user_registration(
  registration_id UUID,
  approver_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id UUID;
  result JSONB;
BEGIN
  -- Get user_id from pending registration
  SELECT user_id INTO target_user_id
  FROM pending_registrations
  WHERE id = registration_id AND status = 'pending';
  
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Registration not found or already processed'
    );
  END IF;
  
  -- Update pending registration
  UPDATE pending_registrations
  SET 
    status = 'approved',
    approved_by = approver_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = registration_id;
  
  -- Update profile
  UPDATE profiles
  SET 
    account_status = 'approved',
    approved_by = approver_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE user_id = target_user_id;
  
  -- Mark admin notification as actioned
  UPDATE admin_notifications
  SET 
    status = 'actioned',
    actioned_at = NOW()
  WHERE user_id = target_user_id 
    AND notification_type = 'new_registration';
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id
  );
END;
$$;

-- Function: Reject user registration
CREATE OR REPLACE FUNCTION reject_user_registration(
  registration_id UUID,
  approver_id UUID,
  reason TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get user_id from pending registration
  SELECT user_id INTO target_user_id
  FROM pending_registrations
  WHERE id = registration_id AND status = 'pending';
  
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Registration not found or already processed'
    );
  END IF;
  
  -- Update pending registration
  UPDATE pending_registrations
  SET 
    status = 'rejected',
    rejection_reason = reason,
    approved_by = approver_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = registration_id;
  
  -- Update profile
  UPDATE profiles
  SET 
    account_status = 'rejected',
    approved_by = approver_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE user_id = target_user_id;
  
  -- Mark admin notification as actioned
  UPDATE admin_notifications
  SET 
    status = 'actioned',
    actioned_at = NOW()
  WHERE user_id = target_user_id 
    AND notification_type = 'new_registration';
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id
  );
END;
$$;

-- Function: Generate invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
BEGIN
  -- Generate a random token (URL-safe)
  token := encode(gen_random_bytes(32), 'base64');
  token := replace(token, '/', '_');
  token := replace(token, '+', '-');
  token := replace(token, '=', '');
  RETURN token;
END;
$$;

-- Function: Create club invitation
CREATE OR REPLACE FUNCTION create_club_invitation(
  p_club_id UUID,
  p_invited_email TEXT,
  p_invited_role user_role,
  p_invited_by UUID,
  p_expires_days INTEGER DEFAULT 7
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_token TEXT;
  invitation_id UUID;
BEGIN
  -- Generate unique token
  new_token := generate_invitation_token();
  
  -- Create invitation
  INSERT INTO club_invitations (
    club_id,
    invited_email,
    invited_role,
    invitation_token,
    invited_by,
    expires_at
  ) VALUES (
    p_club_id,
    p_invited_email,
    p_invited_role,
    new_token,
    p_invited_by,
    NOW() + (p_expires_days || ' days')::INTERVAL
  )
  RETURNING id INTO invitation_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', invitation_id,
    'token', new_token,
    'expires_at', NOW() + (p_expires_days || ' days')::INTERVAL
  );
END;
$$;

-- Function: Accept club invitation
CREATE OR REPLACE FUNCTION accept_club_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  invitation RECORD;
  needs_approval BOOLEAN;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation
  FROM club_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found, already used, or expired'
    );
  END IF;
  
  -- Check if user's account is approved
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = p_user_id AND account_status = 'approved'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Your account is pending approval. Please wait for admin approval.'
    );
  END IF;
  
  -- Determine if approval is needed (officials need approval)
  needs_approval := (invitation.invited_role = 'official');
  
  -- Add user to club
  INSERT INTO club_members (
    club_id,
    user_id,
    role,
    status,
    invited_by,
    invited_at
  ) VALUES (
    invitation.club_id,
    p_user_id,
    invitation.invited_role,
    CASE WHEN needs_approval THEN 'pending' ELSE 'active' END,
    invitation.invited_by,
    NOW()
  )
  ON CONFLICT (club_id, user_id) 
  DO UPDATE SET
    role = invitation.invited_role,
    status = CASE WHEN needs_approval THEN 'pending' ELSE 'active' END,
    invited_by = invitation.invited_by,
    invited_at = NOW();
  
  -- Mark invitation as accepted
  UPDATE club_invitations
  SET 
    status = 'accepted',
    accepted_by = p_user_id,
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = invitation.id;
  
  -- Create notification for club admin if official needs approval
  IF needs_approval THEN
    INSERT INTO admin_notifications (
      notification_type,
      user_id,
      club_id,
      metadata,
      status
    ) VALUES (
      'official_request',
      p_user_id,
      invitation.club_id,
      jsonb_build_object(
        'role', invitation.invited_role,
        'invited_by', invitation.invited_by
      ),
      'unread'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'club_id', invitation.club_id,
    'role', invitation.invited_role,
    'needs_approval', needs_approval
  );
END;
$$;

-- RLS Policies

-- pending_registrations: Only accessible by admins (superusers)
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all pending registrations"
  ON pending_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() 
        AND account_status = 'approved'
        -- TODO: Add is_super_admin flag to identify your account
    )
  );

-- club_invitations: Inviter and invitee can see
ALTER TABLE club_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations they created"
  ON club_invitations FOR SELECT
  USING (invited_by = auth.uid());

CREATE POLICY "Users can view invitations sent to their email"
  ON club_invitations FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Club admins can create invitations"
  ON club_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_invitations.club_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );

-- admin_notifications: Only accessible by admins
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all notifications"
  ON admin_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() 
        AND account_status = 'approved'
        -- TODO: Add is_super_admin flag
    )
  );

CREATE POLICY "Admins can update notifications"
  ON admin_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() 
        AND account_status = 'approved'
    )
  );

-- Update existing RLS policies to check account_status
-- Prevent access for pending/rejected users
CREATE OR REPLACE FUNCTION user_is_approved()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND account_status = 'approved'
  );
$$;

-- Comments for documentation
COMMENT ON TABLE pending_registrations IS 'Tracks new user registrations awaiting admin approval';
COMMENT ON TABLE club_invitations IS 'Invitation links for users to join clubs with specific roles';
COMMENT ON TABLE admin_notifications IS 'Notifications for super admin about registration and approval requests';
COMMENT ON FUNCTION approve_user_registration IS 'Approve a pending user registration';
COMMENT ON FUNCTION reject_user_registration IS 'Reject a pending user registration with optional reason';
COMMENT ON FUNCTION create_club_invitation IS 'Generate invitation link for a club with specific role';
COMMENT ON FUNCTION accept_club_invitation IS 'Accept invitation and join club (with approval if official)';
