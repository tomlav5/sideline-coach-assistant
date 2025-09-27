-- Ensure creator is set and added as admin member automatically, and backfill existing data

-- 1) Create trigger to set created_by on club insert
DROP TRIGGER IF EXISTS trg_handle_club_creation ON public.clubs;
CREATE TRIGGER trg_handle_club_creation
BEFORE INSERT ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.handle_club_creation();

-- 2) Create trigger to add club creator as admin member after insert
DROP TRIGGER IF EXISTS trg_add_club_creator_as_admin ON public.clubs;
CREATE TRIGGER trg_add_club_creator_as_admin
AFTER INSERT ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.add_club_creator_as_admin();

-- 3) Backfill: ensure creators are members (admin) for existing clubs
INSERT INTO public.club_members (club_id, user_id, role)
SELECT c.id, c.created_by, 'admin'::user_role
FROM public.clubs c
LEFT JOIN public.club_members cm
  ON cm.club_id = c.id AND cm.user_id = c.created_by
WHERE cm.id IS NULL
  AND c.created_by IS NOT NULL;