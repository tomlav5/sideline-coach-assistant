-- =====================================================
-- Set Initial Super Admin
-- Sets the first user account as super admin
-- UUID: d0ab792f-2519-45a9-9ee0-74467fd51039
-- =====================================================

-- Update existing profile to be super admin
UPDATE profiles
SET 
  is_super_admin = true,
  account_status = 'approved',
  updated_at = NOW()
WHERE user_id = 'd0ab792f-2519-45a9-9ee0-74467fd51039';

-- If the profile doesn't exist yet, this is a safety check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = 'd0ab792f-2519-45a9-9ee0-74467fd51039'
  ) THEN
    RAISE NOTICE 'Profile not found for super admin user. Profile will be created on next login.';
  ELSE
    RAISE NOTICE 'Super admin privileges granted successfully.';
  END IF;
END $$;

-- Comment
COMMENT ON COLUMN profiles.is_super_admin IS 'Initial super admin set via migration 20260110_set_initial_super_admin';
