-- Two identical AFTER INSERT triggers existed on public.clubs, both calling
-- add_club_creator_as_admin(), which inserts the club creator into club_members.
-- The second call violated club_members_club_id_user_id_key, so creating a club
-- always failed. Latent in production since only one club was ever created,
-- before the duplicate trigger was introduced.
--
-- Found on staging, 30 August 2026, while seeding test data.

DROP TRIGGER IF EXISTS add_club_creator_as_admin_trigger ON public.clubs;

-- Make the insert idempotent as well, so a re-introduced duplicate trigger
-- would be harmless rather than fatal.
CREATE OR REPLACE FUNCTION public.add_club_creator_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT (club_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;