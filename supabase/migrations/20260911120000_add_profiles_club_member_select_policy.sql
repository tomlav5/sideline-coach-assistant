-- UX-027: Club Members shows "Unknown User" for everyone except the viewer,
-- because public.profiles only had a SELECT policy for auth.uid() = user_id.
-- An admin couldn't identify their own coaches, and no future feature that
-- needs to display another club member's name (e.g. "active tracker: Jane")
-- can work either.
--
-- This adds a SELECT policy letting any club member read the profile of any
-- other member of a club they share, regardless of either member's role.
--
-- Recursion note: a policy on profiles that queried club_members directly
-- would trigger club_members' own RLS policies during evaluation. To match
-- the existing pattern in this codebase (user_has_club_access,
-- user_is_club_member, user_is_club_admin), the membership check is done in
-- a SECURITY DEFINER helper function that queries club_members with RLS
-- bypassed, so evaluating the profiles policy never re-enters RLS on another
-- table.
--
-- Accepted trade-off: this policy exposes the full profiles row, including
-- email, to every fellow club member. RLS is row-level, not column-level, so
-- restricting which columns are visible would require a view or an RPC
-- instead of a table policy. For a small grassroots-club context where
-- coaches already know each other, the simpler row-level policy is the
-- deliberate choice here, not an oversight.

CREATE OR REPLACE FUNCTION "public"."user_shares_club_with"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members AS my_membership
    JOIN public.club_members AS their_membership
      ON their_membership.club_id = my_membership.club_id
    WHERE my_membership.user_id = auth.uid()
      AND their_membership.user_id = target_user_id
  );
$$;

ALTER FUNCTION "public"."user_shares_club_with"("target_user_id" "uuid") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."user_shares_club_with"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_shares_club_with"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_shares_club_with"("target_user_id" "uuid") TO "service_role";

CREATE POLICY "Users can view profiles of fellow club members" ON "public"."profiles" FOR SELECT USING ("public"."user_shares_club_with"("user_id"));

COMMENT ON POLICY "Users can view profiles of fellow club members" ON "public"."profiles" IS 'UX-027: lets a user read the profile row (including email) of anyone sharing a club with them, any role. Row-level only — hiding email from club members would need a view or RPC; exposing it is an accepted trade-off, not an oversight.';
