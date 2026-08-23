


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "analytics";


ALTER SCHEMA "analytics" OWNER TO "postgres";


COMMENT ON SCHEMA "analytics" IS 'Schema containing materialized views for reporting and analytics. Views are refreshed via refresh_report_views() function.';



COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."competition_type" AS ENUM (
    'league',
    'tournament',
    'friendly'
);


ALTER TYPE "public"."competition_type" OWNER TO "postgres";


CREATE TYPE "public"."event_type" AS ENUM (
    'goal',
    'assist',
    'throw_in',
    'corner',
    'free_kick',
    'penalty',
    'goal_kick'
);


ALTER TYPE "public"."event_type" OWNER TO "postgres";


CREATE TYPE "public"."fixture_type" AS ENUM (
    'home',
    'away'
);


ALTER TYPE "public"."fixture_type" OWNER TO "postgres";


CREATE TYPE "public"."match_half" AS ENUM (
    'first',
    'second'
);


ALTER TYPE "public"."match_half" OWNER TO "postgres";


CREATE TYPE "public"."match_status" AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."match_status" OWNER TO "postgres";


CREATE TYPE "public"."period_type" AS ENUM (
    'period',
    'penalties'
);


ALTER TYPE "public"."period_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."period_type" IS 'Types of match periods: period (regular play), penalties (penalty shootout)';



CREATE TYPE "public"."team_type" AS ENUM (
    '5-a-side',
    '7-a-side',
    '9-a-side',
    '11-a-side'
);


ALTER TYPE "public"."team_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'official',
    'viewer'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_club_invitation"("p_token" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."accept_club_invitation"("p_token" "text", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."accept_club_invitation"("p_token" "text", "p_user_id" "uuid") IS 'Accept invitation and join club (with approval if official)';



CREATE OR REPLACE FUNCTION "public"."add_club_creator_as_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_club_creator_as_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_user_registration"("registration_id" "uuid", "approver_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."approve_user_registration"("registration_id" "uuid", "approver_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."approve_user_registration"("registration_id" "uuid", "approver_id" "uuid") IS 'Approve a pending user registration';



CREATE OR REPLACE FUNCTION "public"."calculate_total_period_minutes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  period_duration INTEGER;
BEGIN
  -- Get the planned duration for this period
  SELECT planned_duration_minutes INTO period_duration
  FROM public.match_periods
  WHERE id = NEW.period_id;

  -- Calculate total_period_minutes based on the time interval
  -- Logic:
  -- 1. If time_off_minute is NULL (still playing), use period_duration as the cap
  -- 2. For starters (time_on_minute = 0 or NULL), start from 0
  -- 3. For substitutes, start from time_on_minute
  -- 4. End time is either time_off_minute or period_duration
  
  IF NEW.time_off_minute IS NOT NULL THEN
    -- Player has been substituted off or period ended
    -- Calculate actual time played
    NEW.total_period_minutes := NEW.time_off_minute - COALESCE(NEW.time_on_minute, 0);
  ELSIF NEW.is_active = false AND period_duration IS NOT NULL THEN
    -- Period has ended, player was on field until the end
    NEW.total_period_minutes := period_duration - COALESCE(NEW.time_on_minute, 0);
  ELSE
    -- Player is still active, can't calculate final time yet
    -- Keep it at 0 or whatever was set
    IF NEW.total_period_minutes IS NULL THEN
      NEW.total_period_minutes := 0;
    END IF;
  END IF;

  -- Ensure non-negative values
  IF NEW.total_period_minutes < 0 THEN
    NEW.total_period_minutes := 0;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_total_period_minutes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_match_tracking"("fixture_id_param" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_tracker UUID;
  last_activity TIMESTAMP WITH TIME ZONE;
  timeout_minutes INTEGER := 5;
  result JSONB;
BEGIN
  SELECT active_tracker_id, last_activity_at 
  INTO current_tracker, last_activity
  FROM public.fixtures 
  WHERE id = fixture_id_param;
  
  IF current_tracker IS NOT NULL 
     AND current_tracker != auth.uid() 
     AND last_activity > (NOW() - INTERVAL '5 minutes') THEN
    
    SELECT jsonb_build_object(
      'success', false,
      'error', 'Match is already being tracked',
      'current_tracker', current_tracker,
      'tracking_started_at', (SELECT tracking_started_at FROM public.fixtures WHERE id = fixture_id_param)
    ) INTO result;
    
    RETURN result;
  END IF;
  
  UPDATE public.fixtures 
  SET 
    active_tracker_id = auth.uid(),
    tracking_started_at = NOW(),
    last_activity_at = NOW()
  WHERE id = fixture_id_param;
  
  SELECT jsonb_build_object(
    'success', true,
    'tracker_id', auth.uid(),
    'tracking_started_at', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."claim_match_tracking"("fixture_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_match_storage_data"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."clean_match_storage_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_has_no_members"("club_id_param" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_id = club_id_param
  );
$$;


ALTER FUNCTION "public"."club_has_no_members"("club_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_club_invitation"("p_club_id" "uuid", "p_invited_email" "text", "p_invited_role" "public"."user_role", "p_invited_by" "uuid", "p_expires_days" integer DEFAULT 7) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_club_invitation"("p_club_id" "uuid", "p_invited_email" "text", "p_invited_role" "public"."user_role", "p_invited_by" "uuid", "p_expires_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_club_invitation"("p_club_id" "uuid", "p_invited_email" "text", "p_invited_role" "public"."user_role", "p_invited_by" "uuid", "p_expires_days" integer) IS 'Generate invitation link for a club with specific role';



CREATE OR REPLACE FUNCTION "public"."create_pending_registration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_pending_registration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_email"("queue_name" "text", "payload" "jsonb", "scheduled_for" timestamp with time zone DEFAULT "now"()) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  queue_id UUID;
BEGIN
  INSERT INTO public.email_queue (queue_name, payload, scheduled_for)
  VALUES (queue_name, payload, scheduled_for)
  RETURNING id INTO queue_id;
  
  RETURN queue_id;
END;
$$;


ALTER FUNCTION "public"."enqueue_email"("queue_name" "text", "payload" "jsonb", "scheduled_for" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_email"("queue_name" "text", "payload" "jsonb", "scheduled_for" timestamp with time zone) IS 'Enqueue an email for async processing';



CREATE OR REPLACE FUNCTION "public"."find_user_by_email"("lookup_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."find_user_by_email"("lookup_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_user_by_email"("lookup_email" "text") IS 'Securely looks up a user ID by email address. Only callable by club admins. Returns NULL if user not found.';



CREATE OR REPLACE FUNCTION "public"."generate_invitation_token"() RETURNS "text"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."generate_invitation_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_competitions"() RETURNS TABLE("competition_type" "text", "competition_name" "text", "display_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'analytics'
    AS $$
  SELECT 
    mv.competition_type::text,
    mv.competition_name,
    mv.display_name
  FROM analytics.mv_competitions mv;
$$;


ALTER FUNCTION "public"."get_competitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_completed_matches"() RETURNS TABLE("id" "uuid", "scheduled_date" timestamp with time zone, "opponent_name" "text", "location" "text", "fixture_type" "text", "competition_type" "text", "competition_name" "text", "team_name" "text", "club_name" "text", "our_goals" bigint, "opponent_goals" bigint, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'analytics'
    AS $$
  SELECT 
    mv.id,
    mv.scheduled_date,
    mv.opponent_name,
    mv.location,
    mv.fixture_type::text,
    mv.competition_type::text,
    mv.competition_name,
    mv.team_name,
    mv.club_name,
    mv.our_goals,
    mv.opponent_goals,
    mv.created_at
  FROM analytics.mv_completed_matches mv;
$$;


ALTER FUNCTION "public"."get_completed_matches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_fixtures_with_scores_secure"() RETURNS TABLE("id" "uuid", "team_id" "uuid", "opponent_name" "text", "scheduled_date" timestamp with time zone, "location" "text", "fixture_type" "public"."fixture_type", "competition_type" "public"."competition_type", "competition_name" "text", "half_length" integer, "status" "public"."match_status", "match_status" "text", "selected_squad_data" "jsonb", "current_period_id" "uuid", "match_state" "jsonb", "is_retrospective" boolean, "active_tracker_id" "uuid", "tracking_started_at" timestamp with time zone, "last_activity_at" timestamp with time zone, "team_name" "text", "club_name" "text", "our_goals" bigint, "opponent_goals" bigint, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    f.id,
    f.team_id,
    f.opponent_name,
    f.scheduled_date,
    f.location,
    f.fixture_type,
    f.competition_type,
    f.competition_name,
    f.half_length,
    f.status,
    f.match_status,
    f.selected_squad_data,
    f.current_period_id,
    f.match_state,
    f.is_retrospective,
    f.active_tracker_id,
    f.tracking_started_at,
    f.last_activity_at,
    t.name as team_name,
    c.name as club_name,
    COALESCE(
      (SELECT COUNT(*) 
       FROM public.match_events 
       WHERE fixture_id = f.id 
         AND event_type = 'goal' 
         AND is_our_team = true),
      0
    ) as our_goals,
    COALESCE(
      (SELECT COUNT(*) 
       FROM public.match_events 
       WHERE fixture_id = f.id 
         AND event_type = 'goal' 
         AND is_our_team = false),
      0
    ) as opponent_goals,
    f.created_at,
    f.updated_at
  FROM public.fixtures f
  JOIN public.teams t ON f.team_id = t.id
  JOIN public.clubs c ON t.club_id = c.id
  WHERE user_has_club_access(t.club_id, 'viewer'::user_role);
$$;


ALTER FUNCTION "public"."get_fixtures_with_scores_secure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_goal_scorers"() RETURNS TABLE("player_id" "uuid", "first_name" "text", "last_name" "text", "jersey_number" integer, "club_name" "text", "goals" bigint, "penalty_goals" bigint, "assists" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'analytics'
    AS $$
  SELECT 
    mv.player_id,
    mv.first_name,
    mv.last_name,
    mv.jersey_number,
    mv.club_name,
    mv.goals,
    mv.penalty_goals,
    mv.assists
  FROM analytics.mv_goal_scorers mv;
$$;


ALTER FUNCTION "public"."get_goal_scorers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_emails"("p_queue_name" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "queue_name" "text", "payload" "jsonb", "attempts" integer, "max_attempts" integer, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.queue_name,
    eq.payload,
    eq.attempts,
    eq.max_attempts,
    eq.created_at
  FROM public.email_queue eq
  WHERE 
    eq.status = 'pending'
    AND eq.attempts < eq.max_attempts
    AND (eq.scheduled_for IS NULL OR eq.scheduled_for <= NOW())
    AND (p_queue_name IS NULL OR eq.queue_name = p_queue_name)
  ORDER BY eq.created_at ASC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_pending_emails"("p_queue_name" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pending_emails"("p_queue_name" "text", "p_limit" integer) IS 'Retrieve pending emails from the queue for processing';



CREATE OR REPLACE FUNCTION "public"."get_player_playing_time"() RETURNS TABLE("player_id" "uuid", "first_name" "text", "last_name" "text", "team_name" "text", "club_name" "text", "total_minutes_played" integer, "matches_played" integer, "avg_minutes_per_match" integer)
    LANGUAGE "sql" STABLE
    AS $$
with interval_minutes as (
  select
    ptl.fixture_id,
    ptl.player_id,
    ptl.period_id,
    case when coalesce(ptl.is_starter, false) then 0 else ptl.time_on_minute end as start_min,
    least(coalesce(ptl.time_off_minute, ptl.total_period_minutes), ptl.total_period_minutes) as end_min,
    ptl.total_period_minutes
  from public.player_time_logs ptl
),
period_contrib as (
  select
    fixture_id,
    player_id,
    period_id,
    case when start_min is null then 0 else greatest(0, end_min - start_min) end as minutes_in_period
  from interval_minutes
),
fixture_sums as (
  select
    pc.fixture_id,
    pc.player_id,
    sum(pc.minutes_in_period)::int as minutes_in_fixture
  from period_contrib pc
  group by pc.fixture_id, pc.player_id
),
player_totals as (
  select
    fs.player_id,
    sum(fs.minutes_in_fixture)::int as total_minutes_played,
    count(*) filter (where fs.minutes_in_fixture > 0) as matches_played
  from fixture_sums fs
  group by fs.player_id
)
select
  pt.player_id,
  pl.first_name,
  pl.last_name,
  tm.name as team_name,
  c.name as club_name,
  pt.total_minutes_played,
  pt.matches_played,
  case when pt.matches_played > 0 then round(pt.total_minutes_played::numeric / pt.matches_played)::int else 0 end as avg_minutes_per_match
from player_totals pt
join public.players pl on pl.id = pt.player_id
left join public.team_players tp on tp.player_id = pl.id
left join public.teams tm on tm.id = tp.team_id
left join public.clubs c on c.id = tm.club_id
order by pt.total_minutes_played desc, pl.last_name asc, pl.first_name asc;
$$;


ALTER FUNCTION "public"."get_player_playing_time"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_player_playing_time_v2"() RETURNS TABLE("player_id" "uuid", "first_name" "text", "last_name" "text", "team_name" "text", "club_name" "text", "total_minutes_played" integer, "matches_played" integer, "avg_minutes_per_match" integer)
    LANGUAGE "sql" STABLE
    AS $$
with interval_minutes as (
  select
    ptl.fixture_id,
    ptl.player_id,
    ptl.period_id,
    case when coalesce(ptl.is_starter, false) then 0 else ptl.time_on_minute end as start_min,
    least(coalesce(ptl.time_off_minute, ptl.total_period_minutes), ptl.total_period_minutes) as end_min,
    ptl.total_period_minutes
  from public.player_time_logs ptl
),
period_contrib as (
  select
    fixture_id,
    player_id,
    period_id,
    case when start_min is null then 0 else greatest(0, end_min - start_min) end as minutes_in_period
  from interval_minutes
),
fixture_sums as (
  select
    pc.fixture_id,
    pc.player_id,
    sum(pc.minutes_in_period)::int as minutes_in_fixture
  from period_contrib pc
  group by pc.fixture_id, pc.player_id
),
player_totals as (
  select
    fs.player_id,
    sum(fs.minutes_in_fixture)::int as total_minutes_played,
    count(*) filter (where fs.minutes_in_fixture > 0) as matches_played
  from fixture_sums fs
  group by fs.player_id
)
select
  pt.player_id,
  pl.first_name,
  pl.last_name,
  tm.name as team_name,
  c.name as club_name,
  pt.total_minutes_played,
  pt.matches_played,
  case when pt.matches_played > 0 then round(pt.total_minutes_played::numeric / pt.matches_played)::int else 0 end as avg_minutes_per_match
from player_totals pt
join public.players pl on pl.id = pt.player_id
left join public.team_players tp on tp.player_id = pl.id
left join public.teams tm on tm.id = tp.team_id
left join public.clubs c on c.id = tm.club_id
order by pt.total_minutes_played desc, pl.last_name asc, pl.first_name asc;
$$;


ALTER FUNCTION "public"."get_player_playing_time_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_players_with_teams_secure"() RETURNS TABLE("id" "uuid", "club_id" "uuid", "jersey_number" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "teams" json, "club_name" "text", "first_name" "text", "last_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    p.id,
    p.club_id,
    p.jersey_number,
    p.created_at,
    p.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', t.id,
          'name', t.name,
          'team_type', t.team_type
        )
      ) FILTER (WHERE t.id IS NOT NULL), 
      '[]'::json
    ) as teams,
    c.name as club_name,
    p.first_name,
    p.last_name
  FROM public.players p
  JOIN public.clubs c ON p.club_id = c.id
  LEFT JOIN public.team_players tp ON p.id = tp.player_id
  LEFT JOIN public.teams t ON tp.team_id = t.id
  WHERE user_has_club_access(p.club_id, 'viewer'::user_role)
  GROUP BY p.id, p.club_id, p.jersey_number, p.created_at, p.updated_at, c.name, p.first_name, p.last_name;
$$;


ALTER FUNCTION "public"."get_players_with_teams_secure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_teams_with_stats_secure"() RETURNS TABLE("id" "uuid", "club_id" "uuid", "name" "text", "team_type" "public"."team_type", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "club_name" "text", "player_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    t.id,
    t.club_id,
    t.name,
    t.team_type,
    t.created_at,
    t.updated_at,
    c.name as club_name,
    COUNT(tp.player_id) as player_count
  FROM public.teams t
  JOIN public.clubs c ON t.club_id = c.id
  LEFT JOIN public.team_players tp ON t.id = tp.team_id
  WHERE user_has_club_access(t.club_id, 'viewer'::user_role)
  GROUP BY t.id, t.club_id, t.name, t.team_type, t.created_at, t.updated_at, c.name;
$$;


ALTER FUNCTION "public"."get_teams_with_stats_secure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_dashboard_stats"() RETURNS TABLE("user_id" "uuid", "total_clubs" bigint, "total_teams" bigint, "total_players" bigint, "upcoming_fixtures" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    auth.uid() as user_id,
    count(DISTINCT c.id) AS total_clubs,
    count(DISTINCT t.id) AS total_teams,
    count(DISTINCT p.id) AS total_players,
    count(DISTINCT
        CASE
            WHEN f.status = 'scheduled'::match_status AND f.scheduled_date::date >= CURRENT_DATE THEN f.id
            ELSE NULL::uuid
        END) AS upcoming_fixtures
   FROM club_members cm
     JOIN clubs c ON cm.club_id = c.id
     LEFT JOIN teams t ON c.id = t.club_id
     LEFT JOIN players p ON c.id = p.club_id
     LEFT JOIN fixtures f ON t.id = f.team_id
  WHERE cm.user_id = auth.uid()
  GROUP BY cm.user_id;
$$;


ALTER FUNCTION "public"."get_user_dashboard_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_club_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.created_by = auth.uid();
  
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create club';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_club_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND is_super_admin = true
      AND account_status = 'approved'
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_super_admin"() IS 'Returns true if current user is a super admin';



CREATE OR REPLACE FUNCTION "public"."refresh_report_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'analytics'
    AS $$
BEGIN
    -- Refresh materialized views concurrently for better performance
    -- CONCURRENTLY allows queries during refresh but requires unique indexes
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_completed_matches;
        RAISE NOTICE 'Refreshed mv_completed_matches';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to refresh mv_completed_matches: %', SQLERRM;
    END;
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_goal_scorers;
        RAISE NOTICE 'Refreshed mv_goal_scorers';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to refresh mv_goal_scorers: %', SQLERRM;
    END;
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_player_playing_time;
        RAISE NOTICE 'Refreshed mv_player_playing_time';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to refresh mv_player_playing_time: %', SQLERRM;
    END;
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_competitions;
        RAISE NOTICE 'Refreshed mv_competitions';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to refresh mv_competitions: %', SQLERRM;
    END;
    
    -- Log the refresh
    RAISE NOTICE 'Report views refresh completed at %', now();
    
    -- Note: Individual view failures are caught and logged but don't fail the whole function
    -- This ensures that if one view has issues, others can still refresh
END;
$$;


ALTER FUNCTION "public"."refresh_report_views"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_report_views"() IS 'Refreshes all analytics materialized views concurrently with individual error handling. Safe to call frequently.';



CREATE OR REPLACE FUNCTION "public"."reject_user_registration"("registration_id" "uuid", "approver_id" "uuid", "reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."reject_user_registration"("registration_id" "uuid", "approver_id" "uuid", "reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reject_user_registration"("registration_id" "uuid", "approver_id" "uuid", "reason" "text") IS 'Reject a pending user registration with optional reason';



CREATE OR REPLACE FUNCTION "public"."release_match_tracking"("fixture_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.fixtures 
  SET 
    active_tracker_id = NULL,
    tracking_started_at = NULL,
    last_activity_at = NULL
  WHERE id = fixture_id_param 
    AND active_tracker_id = auth.uid();
    
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."release_match_tracking"("fixture_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restart_match"("fixture_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Ensure only active tracker (or untracked match) can restart
  IF NOT EXISTS (
    SELECT 1 FROM public.fixtures 
    WHERE id = fixture_id_param 
      AND (active_tracker_id = auth.uid() OR active_tracker_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'You must be the active tracker to restart this match';
  END IF;

  -- 1) Clear the FK reference first to avoid 23503 on match_periods delete
  UPDATE public.fixtures
  SET current_period_id = NULL
  WHERE id = fixture_id_param;

  -- 2) Delete dependent rows (order matters for FK constraints to match_periods)
  DELETE FROM public.match_events WHERE fixture_id = fixture_id_param;
  DELETE FROM public.player_time_logs WHERE fixture_id = fixture_id_param;
  DELETE FROM public.match_periods WHERE fixture_id = fixture_id_param;

  -- 3) Reset player match statuses
  UPDATE public.player_match_status 
  SET 
    is_on_field = false,
    position = null,
    last_action_minute = null,
    last_action_period_id = null,
    updated_at = now()
  WHERE fixture_id = fixture_id_param;

  -- 4) Reset fixture to initial state and refresh tracking timestamp if user is still tracking
  UPDATE public.fixtures 
  SET 
    status = 'scheduled',
    match_status = 'not_started',
    match_state = '{"status": "not_started", "total_time_seconds": 0}'::jsonb,
    tracking_started_at = CASE 
      WHEN active_tracker_id = auth.uid() THEN now() 
      ELSE tracking_started_at 
    END,
    last_activity_at = CASE 
      WHEN active_tracker_id = auth.uid() THEN now() 
      ELSE last_activity_at 
    END,
    updated_at = now()
  WHERE id = fixture_id_param;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."restart_match"("fixture_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_super_admin"("target_user_id" "uuid", "is_admin" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."set_super_admin"("target_user_id" "uuid", "is_admin" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_super_admin"("target_user_id" "uuid", "is_admin" boolean) IS 'Promote or demote a user to super admin status';



CREATE OR REPLACE FUNCTION "public"."test_auth_context"() RETURNS TABLE("current_auth_uid" "uuid", "is_authenticated" boolean, "auth_role" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    auth.uid() as current_auth_uid,
    auth.uid() IS NOT NULL as is_authenticated,
    auth.role() as auth_role;
$$;


ALTER FUNCTION "public"."test_auth_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_current_user"() RETURNS TABLE("auth_uid" "uuid", "session_exists" boolean, "jwt_claims" "jsonb")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    auth.uid() as auth_uid,
    auth.uid() IS NOT NULL as session_exists,
    auth.jwt() as jwt_claims;
$$;


ALTER FUNCTION "public"."test_current_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_refresh_reports"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM pg_notify('refresh_reports', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', extract(epoch from now()),
        'record_id', COALESCE(NEW.id::text, OLD.id::text)
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trigger_refresh_reports"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_queue_status"("queue_id" "uuid", "new_status" "text", "error_msg" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.email_queue
  SET 
    status = new_status,
    error_message = error_msg,
    attempts = CASE 
      WHEN new_status = 'failed' THEN attempts + 1
      ELSE attempts
    END,
    processed_at = CASE 
      WHEN new_status IN ('sent', 'failed') THEN NOW()
      ELSE processed_at
    END,
    updated_at = NOW()
  WHERE id = queue_id;
END;
$$;


ALTER FUNCTION "public"."update_email_queue_status"("queue_id" "uuid", "new_status" "text", "error_msg" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_email_queue_status"("queue_id" "uuid", "new_status" "text", "error_msg" "text") IS 'Update the status of a queued email';



CREATE OR REPLACE FUNCTION "public"."update_tracking_activity"("fixture_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.fixtures 
  SET last_activity_at = NOW()
  WHERE id = fixture_id_param 
    AND active_tracker_id = auth.uid();
    
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_tracking_activity"("fixture_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_club_access"("club_id_param" "uuid", "required_role" "public"."user_role" DEFAULT 'viewer'::"public"."user_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_id = club_id_param 
    AND user_id = auth.uid()
    AND (
      role = 'admin' OR 
      (required_role = 'official' AND role IN ('admin', 'official')) OR
      (required_role = 'viewer' AND role IN ('admin', 'official', 'viewer'))
    )
  );
$$;


ALTER FUNCTION "public"."user_has_club_access"("club_id_param" "uuid", "required_role" "public"."user_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_approved"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND account_status = 'approved'
  );
$$;


ALTER FUNCTION "public"."user_is_approved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_club_admin"("club_id_param" "uuid", "user_id_param" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_id = club_id_param 
    AND user_id = user_id_param
    AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."user_is_club_admin"("club_id_param" "uuid", "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_club_member"("club_id_param" "uuid", "user_id_param" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_id = club_id_param 
    AND user_id = user_id_param
  );
$$;


ALTER FUNCTION "public"."user_is_club_member"("club_id_param" "uuid", "user_id_param" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."fixtures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "opponent_name" "text" NOT NULL,
    "fixture_type" "public"."fixture_type" NOT NULL,
    "location" "text",
    "scheduled_date" timestamp with time zone NOT NULL,
    "half_length" integer DEFAULT 25 NOT NULL,
    "status" "public"."match_status" DEFAULT 'scheduled'::"public"."match_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "selected_squad_data" "jsonb",
    "competition_type" "public"."competition_type" DEFAULT 'friendly'::"public"."competition_type",
    "competition_name" "text",
    "match_status" "text" DEFAULT 'not_started'::"text",
    "current_period_id" "uuid",
    "match_state" "jsonb" DEFAULT '{"status": "not_started", "total_time_seconds": 0}'::"jsonb",
    "is_retrospective" boolean DEFAULT false NOT NULL,
    "active_tracker_id" "uuid",
    "tracking_started_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone,
    "kickoff_time_tbd" boolean DEFAULT false,
    CONSTRAINT "fixtures_match_status_check" CHECK (("match_status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'paused'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."fixtures" REPLICA IDENTITY FULL;


ALTER TABLE "public"."fixtures" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "analytics"."mv_competitions" AS
 SELECT "competition_type",
    "competition_name",
    COALESCE("competition_name", ("competition_type")::"text") AS "display_name",
    "count"(*) AS "match_count",
    "min"("scheduled_date") AS "first_match_date",
    "max"("scheduled_date") AS "last_match_date"
   FROM "public"."fixtures" "f"
  WHERE (("status" = 'completed'::"public"."match_status") AND (("competition_type" IS NOT NULL) OR ("competition_name" IS NOT NULL)))
  GROUP BY "competition_type", "competition_name"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "analytics"."mv_competitions" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "analytics"."mv_competitions" IS 'List of unique competitions from completed matches with match counts.';



CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fixture_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "player_id" "uuid",
    "assist_player_id" "uuid",
    "minute_in_period" integer NOT NULL,
    "total_match_minute" integer NOT NULL,
    "is_our_team" boolean DEFAULT true NOT NULL,
    "is_penalty" boolean DEFAULT false,
    "notes" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_retrospective" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_event_id" "uuid",
    CONSTRAINT "match_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['goal'::"text", 'assist'::"text", 'substitution_on'::"text", 'substitution_off'::"text"])))
);

ALTER TABLE ONLY "public"."match_events" REPLICA IDENTITY FULL;


ALTER TABLE "public"."match_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "team_type" "public"."team_type" DEFAULT '11-a-side'::"public"."team_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "analytics"."mv_completed_matches" AS
 SELECT "f"."id",
    "f"."scheduled_date",
    "f"."opponent_name",
    "f"."location",
    "f"."fixture_type",
    "f"."competition_type",
    "f"."competition_name",
    "t"."name" AS "team_name",
    "t"."team_type",
    "c"."name" AS "club_name",
    "c"."id" AS "club_id",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."match_events" "me"
          WHERE (("me"."fixture_id" = "f"."id") AND ("me"."event_type" = 'goal'::"text") AND ("me"."is_our_team" = true))), (0)::bigint) AS "our_goals",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."match_events" "me"
          WHERE (("me"."fixture_id" = "f"."id") AND ("me"."event_type" = 'goal'::"text") AND ("me"."is_our_team" = false))), (0)::bigint) AS "opponent_goals",
    "f"."created_at"
   FROM (("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("f"."team_id" = "t"."id")))
     JOIN "public"."clubs" "c" ON (("t"."club_id" = "c"."id")))
  WHERE ("f"."status" = 'completed'::"public"."match_status")
  WITH NO DATA;


ALTER MATERIALIZED VIEW "analytics"."mv_completed_matches" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "analytics"."mv_completed_matches" IS 'Pre-aggregated view of completed matches with goal counts. Matches columns expected by get_completed_matches() RPC function.';



CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "jersey_number" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "analytics"."mv_goal_scorers" AS
 SELECT "p"."id" AS "player_id",
    "p"."first_name",
    "p"."last_name",
    "p"."jersey_number",
    "c"."id" AS "club_id",
    "c"."name" AS "club_name",
    "count"(DISTINCT
        CASE
            WHEN (("me"."event_type" = 'goal'::"text") AND ("me"."player_id" = "p"."id")) THEN "me"."id"
            ELSE NULL::"uuid"
        END) AS "goals",
    "count"(DISTINCT
        CASE
            WHEN (("me"."event_type" = 'goal'::"text") AND ("me"."player_id" = "p"."id") AND ("me"."is_penalty" = true)) THEN "me"."id"
            ELSE NULL::"uuid"
        END) AS "penalty_goals",
    "count"(DISTINCT
        CASE
            WHEN (("me"."event_type" = 'goal'::"text") AND ("me"."assist_player_id" = "p"."id")) THEN "me"."id"
            ELSE NULL::"uuid"
        END) AS "assists"
   FROM ((("public"."players" "p"
     JOIN "public"."clubs" "c" ON (("p"."club_id" = "c"."id")))
     LEFT JOIN "public"."match_events" "me" ON ((("me"."player_id" = "p"."id") OR ("me"."assist_player_id" = "p"."id"))))
     LEFT JOIN "public"."fixtures" "f" ON ((("me"."fixture_id" = "f"."id") AND ("f"."status" = 'completed'::"public"."match_status"))))
  GROUP BY "p"."id", "p"."first_name", "p"."last_name", "p"."jersey_number", "c"."id", "c"."name"
 HAVING ("count"(DISTINCT
        CASE
            WHEN (("me"."event_type" = 'goal'::"text") AND (("me"."player_id" = "p"."id") OR ("me"."assist_player_id" = "p"."id"))) THEN "me"."id"
            ELSE NULL::"uuid"
        END) > 0)
  WITH NO DATA;


ALTER MATERIALIZED VIEW "analytics"."mv_goal_scorers" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "analytics"."mv_goal_scorers" IS 'Pre-aggregated player statistics for goals and assists. Only includes players with at least one goal or assist.';



CREATE TABLE IF NOT EXISTS "public"."match_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fixture_id" "uuid" NOT NULL,
    "period_number" integer NOT NULL,
    "period_type" "public"."period_type" DEFAULT 'period'::"public"."period_type" NOT NULL,
    "planned_duration_minutes" integer DEFAULT 25 NOT NULL,
    "actual_start_time" timestamp with time zone,
    "actual_end_time" timestamp with time zone,
    "is_active" boolean DEFAULT false NOT NULL,
    "pause_time" timestamp with time zone,
    "total_paused_seconds" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."match_periods" REPLICA IDENTITY FULL;


ALTER TABLE "public"."match_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_time_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fixture_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "time_on_minute" integer,
    "time_off_minute" integer,
    "is_starter" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "total_period_minutes" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."player_time_logs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."player_time_logs" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "analytics"."mv_player_playing_time" AS
 SELECT "p"."id" AS "player_id",
    "p"."first_name",
    "p"."last_name",
    "p"."jersey_number",
    "c"."id" AS "club_id",
    "c"."name" AS "club_name",
    "count"(DISTINCT "ptl"."fixture_id") AS "matches_played",
    COALESCE("sum"(
        CASE
            WHEN ("ptl"."time_off_minute" IS NOT NULL) THEN ("ptl"."time_off_minute" - COALESCE("ptl"."time_on_minute", 0))
            ELSE ("mp"."planned_duration_minutes" - COALESCE("ptl"."time_on_minute", 0))
        END), (0)::bigint) AS "total_minutes_played",
    "round"((((COALESCE("sum"(
        CASE
            WHEN ("ptl"."time_off_minute" IS NOT NULL) THEN ("ptl"."time_off_minute" - COALESCE("ptl"."time_on_minute", 0))
            ELSE ("mp"."planned_duration_minutes" - COALESCE("ptl"."time_on_minute", 0))
        END), (0)::bigint))::numeric * 1.0) / (NULLIF("count"(DISTINCT "ptl"."fixture_id"), 0))::numeric), 1) AS "avg_minutes_per_match"
   FROM (((("public"."players" "p"
     JOIN "public"."clubs" "c" ON (("p"."club_id" = "c"."id")))
     LEFT JOIN "public"."player_time_logs" "ptl" ON (("ptl"."player_id" = "p"."id")))
     LEFT JOIN "public"."match_periods" "mp" ON (("ptl"."period_id" = "mp"."id")))
     LEFT JOIN "public"."fixtures" "f" ON ((("ptl"."fixture_id" = "f"."id") AND ("f"."status" = 'completed'::"public"."match_status"))))
  WHERE ("ptl"."id" IS NOT NULL)
  GROUP BY "p"."id", "p"."first_name", "p"."last_name", "p"."jersey_number", "c"."id", "c"."name"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "analytics"."mv_player_playing_time" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "analytics"."mv_player_playing_time" IS 'Pre-aggregated player playing time statistics across all completed matches.';



CREATE TABLE IF NOT EXISTS "public"."admin_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_type" "text" NOT NULL,
    "user_id" "uuid",
    "club_id" "uuid",
    "metadata" "jsonb",
    "status" "text" DEFAULT 'unread'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "actioned_at" timestamp with time zone,
    CONSTRAINT "admin_notifications_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['new_registration'::"text", 'official_request'::"text", 'club_created'::"text"]))),
    CONSTRAINT "admin_notifications_status_check" CHECK (("status" = ANY (ARRAY['unread'::"text", 'read'::"text", 'actioned'::"text"])))
);


ALTER TABLE "public"."admin_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_notifications" IS 'Notifications for super admin about registration and approval requests';



CREATE TABLE IF NOT EXISTS "public"."club_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "invited_email" "text",
    "invited_role" "public"."user_role" NOT NULL,
    "invitation_token" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."club_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."club_invitations" IS 'Invitation links for users to join clubs with specific roles';



CREATE TABLE IF NOT EXISTS "public"."club_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'viewer'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "invited_by" "uuid",
    "invited_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    CONSTRAINT "club_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."club_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "queue_name" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scheduled_for" timestamp with time zone,
    "processed_at" timestamp with time zone,
    CONSTRAINT "email_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."email_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_queue" IS 'Queue for async email processing via Lovable email service';



CREATE TABLE IF NOT EXISTS "public"."email_send_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "template_name" "text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_send_log_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."email_send_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_send_log" IS 'Tracks all email sending attempts for audit and debugging';



CREATE TABLE IF NOT EXISTS "public"."pending_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "oauth_provider" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "rejection_reason" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "notified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pending_registrations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."pending_registrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."pending_registrations" IS 'Tracks new user registrations awaiting admin approval';



CREATE TABLE IF NOT EXISTS "public"."player_match_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fixture_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "is_on_field" boolean DEFAULT false NOT NULL,
    "position" "text",
    "last_action_minute" integer,
    "last_action_period_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."player_match_status" REPLICA IDENTITY FULL;


ALTER TABLE "public"."player_match_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "account_status" "text" DEFAULT 'pending'::"text",
    "oauth_provider" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "is_super_admin" boolean DEFAULT false,
    CONSTRAINT "profiles_account_status_check" CHECK (("account_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."is_super_admin" IS 'Initial super admin set via migration 20260110_set_initial_super_admin';



CREATE TABLE IF NOT EXISTS "public"."team_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_players" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_invitations"
    ADD CONSTRAINT "club_invitations_invitation_token_key" UNIQUE ("invitation_token");



ALTER TABLE ONLY "public"."club_invitations"
    ADD CONSTRAINT "club_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_user_id_key" UNIQUE ("club_id", "user_id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_send_log"
    ADD CONSTRAINT "email_send_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_client_event_id_key" UNIQUE ("client_event_id");



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_periods"
    ADD CONSTRAINT "match_periods_fixture_id_period_number_key" UNIQUE ("fixture_id", "period_number");



ALTER TABLE ONLY "public"."match_periods"
    ADD CONSTRAINT "match_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_registrations"
    ADD CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_match_status"
    ADD CONSTRAINT "player_match_status_fixture_id_player_id_key" UNIQUE ("fixture_id", "player_id");



ALTER TABLE ONLY "public"."player_match_status"
    ADD CONSTRAINT "player_match_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_time_logs"
    ADD CONSTRAINT "player_time_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_team_id_player_id_key" UNIQUE ("team_id", "player_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_time_logs"
    ADD CONSTRAINT "unique_player_period_fixture" UNIQUE ("fixture_id", "player_id", "period_id");



CREATE INDEX "mv_competitions_match_count_idx" ON "analytics"."mv_competitions" USING "btree" ("match_count" DESC);



CREATE UNIQUE INDEX "mv_competitions_type_name_idx" ON "analytics"."mv_competitions" USING "btree" ("competition_type", "competition_name");



CREATE INDEX "mv_completed_matches_club_id_idx" ON "analytics"."mv_completed_matches" USING "btree" ("club_id");



CREATE UNIQUE INDEX "mv_completed_matches_id_idx" ON "analytics"."mv_completed_matches" USING "btree" ("id");



CREATE INDEX "mv_completed_matches_scheduled_date_idx" ON "analytics"."mv_completed_matches" USING "btree" ("scheduled_date" DESC);



CREATE INDEX "mv_goal_scorers_club_id_idx" ON "analytics"."mv_goal_scorers" USING "btree" ("club_id");



CREATE INDEX "mv_goal_scorers_goals_idx" ON "analytics"."mv_goal_scorers" USING "btree" ("goals" DESC);



CREATE UNIQUE INDEX "mv_goal_scorers_player_id_idx" ON "analytics"."mv_goal_scorers" USING "btree" ("player_id");



CREATE INDEX "mv_player_playing_time_club_id_idx" ON "analytics"."mv_player_playing_time" USING "btree" ("club_id");



CREATE UNIQUE INDEX "mv_player_playing_time_player_id_idx" ON "analytics"."mv_player_playing_time" USING "btree" ("player_id");



CREATE INDEX "mv_player_playing_time_total_minutes_idx" ON "analytics"."mv_player_playing_time" USING "btree" ("total_minutes_played" DESC);



CREATE INDEX "idx_admin_notifications_status" ON "public"."admin_notifications" USING "btree" ("status", "created_at");



CREATE INDEX "idx_club_invitations_email" ON "public"."club_invitations" USING "btree" ("invited_email");



CREATE INDEX "idx_club_invitations_status" ON "public"."club_invitations" USING "btree" ("status", "expires_at");



CREATE INDEX "idx_club_invitations_token" ON "public"."club_invitations" USING "btree" ("invitation_token");



CREATE INDEX "idx_club_members_status" ON "public"."club_members" USING "btree" ("status");



CREATE INDEX "idx_club_members_user_id" ON "public"."club_members" USING "btree" ("user_id");



CREATE INDEX "idx_email_queue_created_at" ON "public"."email_queue" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_email_queue_queue_name" ON "public"."email_queue" USING "btree" ("queue_name");



CREATE INDEX "idx_email_queue_scheduled_for" ON "public"."email_queue" USING "btree" ("scheduled_for") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_email_queue_status" ON "public"."email_queue" USING "btree" ("status");



CREATE INDEX "idx_email_send_log_created_at" ON "public"."email_send_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_email_send_log_message_id" ON "public"."email_send_log" USING "btree" ("message_id");



CREATE INDEX "idx_email_send_log_status" ON "public"."email_send_log" USING "btree" ("status");



CREATE INDEX "idx_fixtures_active_tracking" ON "public"."fixtures" USING "btree" ("active_tracker_id", "last_activity_at") WHERE ("active_tracker_id" IS NOT NULL);



CREATE INDEX "idx_fixtures_competition_lookup" ON "public"."fixtures" USING "btree" ("competition_type", "competition_name", "scheduled_date") WHERE ("competition_name" IS NOT NULL);



CREATE INDEX "idx_fixtures_competition_name" ON "public"."fixtures" USING "btree" ("competition_name") WHERE ("competition_name" IS NOT NULL);



CREATE INDEX "idx_fixtures_competition_type" ON "public"."fixtures" USING "btree" ("competition_type");



CREATE INDEX "idx_fixtures_completed" ON "public"."fixtures" USING "btree" ("status", "match_status") WHERE (("status" = 'completed'::"public"."match_status") OR ("match_status" = 'completed'::"text"));



CREATE INDEX "idx_fixtures_match_status" ON "public"."fixtures" USING "btree" ("match_status");



CREATE INDEX "idx_fixtures_scheduled_date_range" ON "public"."fixtures" USING "btree" ("scheduled_date") WHERE ("status" = 'scheduled'::"public"."match_status");



CREATE INDEX "idx_fixtures_selected_squad" ON "public"."fixtures" USING "gin" ("selected_squad_data");



CREATE INDEX "idx_fixtures_status_competition" ON "public"."fixtures" USING "btree" ("status", "match_status", "competition_type", "competition_name");



CREATE INDEX "idx_fixtures_status_date" ON "public"."fixtures" USING "btree" ("status", "scheduled_date");



CREATE INDEX "idx_fixtures_team_id" ON "public"."fixtures" USING "btree" ("team_id");



CREATE INDEX "idx_fixtures_team_scheduled" ON "public"."fixtures" USING "btree" ("team_id", "scheduled_date");



CREATE INDEX "idx_match_events_fixture_id" ON "public"."match_events" USING "btree" ("fixture_id");



CREATE INDEX "idx_match_events_fixture_team" ON "public"."match_events" USING "btree" ("fixture_id", "is_our_team");



CREATE INDEX "idx_match_events_fixture_type" ON "public"."match_events" USING "btree" ("fixture_id", "event_type");



CREATE INDEX "idx_match_events_goals_assists" ON "public"."match_events" USING "btree" ("fixture_id", "event_type", "player_id") WHERE (("event_type" = ANY (ARRAY['goal'::"text", 'assist'::"text"])) AND ("is_our_team" = true));



CREATE INDEX "idx_match_events_period_id" ON "public"."match_events" USING "btree" ("period_id");



CREATE INDEX "idx_match_events_player_stats" ON "public"."match_events" USING "btree" ("player_id", "event_type", "fixture_id") WHERE ("event_type" = ANY (ARRAY['goal'::"text", 'assist'::"text", 'yellow_card'::"text", 'red_card'::"text"]));



CREATE INDEX "idx_match_periods_fixture_id" ON "public"."match_periods" USING "btree" ("fixture_id");



CREATE INDEX "idx_pending_registrations_status" ON "public"."pending_registrations" USING "btree" ("status");



CREATE INDEX "idx_pending_registrations_user_id" ON "public"."pending_registrations" USING "btree" ("user_id");



CREATE INDEX "idx_player_match_status_fixture_player" ON "public"."player_match_status" USING "btree" ("fixture_id", "player_id");



CREATE INDEX "idx_player_match_status_on_field" ON "public"."player_match_status" USING "btree" ("fixture_id", "is_on_field", "player_id") WHERE ("is_on_field" = true);



CREATE INDEX "idx_player_time_logs_fixture" ON "public"."player_time_logs" USING "btree" ("fixture_id", "player_id");



CREATE INDEX "idx_player_time_logs_fixture_player" ON "public"."player_time_logs" USING "btree" ("fixture_id", "player_id");



CREATE INDEX "idx_player_time_logs_player_period" ON "public"."player_time_logs" USING "btree" ("player_id", "period_id");



CREATE INDEX "idx_players_club_id" ON "public"."players" USING "btree" ("club_id");



CREATE INDEX "idx_players_club_jersey" ON "public"."players" USING "btree" ("club_id", "jersey_number") WHERE ("jersey_number" IS NOT NULL);



CREATE INDEX "idx_profiles_account_status" ON "public"."profiles" USING "btree" ("account_status");



CREATE INDEX "idx_profiles_super_admin" ON "public"."profiles" USING "btree" ("is_super_admin") WHERE ("is_super_admin" = true);



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_team_players_lookup" ON "public"."team_players" USING "btree" ("player_id", "team_id");



CREATE INDEX "idx_team_players_player_id" ON "public"."team_players" USING "btree" ("player_id");



CREATE INDEX "idx_team_players_team_id" ON "public"."team_players" USING "btree" ("team_id");



CREATE INDEX "idx_teams_club_id" ON "public"."teams" USING "btree" ("club_id");



CREATE OR REPLACE TRIGGER "add_club_creator_as_admin_trigger" AFTER INSERT ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."add_club_creator_as_admin"();



CREATE OR REPLACE TRIGGER "on_profile_created" AFTER INSERT ON "public"."profiles" FOR EACH ROW WHEN (("new"."account_status" = 'pending'::"text")) EXECUTE FUNCTION "public"."create_pending_registration"();



CREATE OR REPLACE TRIGGER "trg_add_club_creator_as_admin" AFTER INSERT ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."add_club_creator_as_admin"();



CREATE OR REPLACE TRIGGER "trg_handle_club_creation" BEFORE INSERT ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_club_creation"();



CREATE OR REPLACE TRIGGER "trigger_calculate_player_time" BEFORE INSERT OR UPDATE ON "public"."player_time_logs" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_total_period_minutes"();



CREATE OR REPLACE TRIGGER "trigger_clean_match_storage" AFTER DELETE ON "public"."fixtures" FOR EACH ROW EXECUTE FUNCTION "public"."clean_match_storage_data"();



CREATE OR REPLACE TRIGGER "trigger_fixtures_refresh_reports" AFTER INSERT OR DELETE OR UPDATE ON "public"."fixtures" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_refresh_reports"();



CREATE OR REPLACE TRIGGER "trigger_match_events_refresh_reports" AFTER INSERT OR DELETE OR UPDATE ON "public"."match_events" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_refresh_reports"();



CREATE OR REPLACE TRIGGER "trigger_player_time_logs_refresh_reports" AFTER INSERT OR DELETE OR UPDATE ON "public"."player_time_logs" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_refresh_reports"();



CREATE OR REPLACE TRIGGER "update_clubs_updated_at" BEFORE UPDATE ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_fixtures_updated_at" BEFORE UPDATE ON "public"."fixtures" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_match_events_updated_at" BEFORE UPDATE ON "public"."match_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_match_periods_updated_at" BEFORE UPDATE ON "public"."match_periods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_player_match_status_updated_at" BEFORE UPDATE ON "public"."player_match_status" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_player_time_logs_updated_at" BEFORE UPDATE ON "public"."player_time_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_players_updated_at" BEFORE UPDATE ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id");



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."club_invitations"
    ADD CONSTRAINT "club_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."club_invitations"
    ADD CONSTRAINT "club_invitations_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_invitations"
    ADD CONSTRAINT "club_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_active_tracker_id_fkey" FOREIGN KEY ("active_tracker_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_current_period_id_fkey" FOREIGN KEY ("current_period_id") REFERENCES "public"."match_periods"("id");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fk_fixtures_team_id" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "fk_match_events_assist_player_id" FOREIGN KEY ("assist_player_id") REFERENCES "public"."players"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "fk_match_events_fixture_id" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "fk_match_events_player_id" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_periods"
    ADD CONSTRAINT "fk_match_periods_fixture_id" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_match_status"
    ADD CONSTRAINT "fk_player_match_status_fixture_id" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_match_status"
    ADD CONSTRAINT "fk_player_match_status_player_id" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_time_logs"
    ADD CONSTRAINT "fk_player_time_logs_fixture_id" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_time_logs"
    ADD CONSTRAINT "fk_player_time_logs_player_id" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."match_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_registrations"
    ADD CONSTRAINT "pending_registrations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pending_registrations"
    ADD CONSTRAINT "pending_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."player_match_status"
    ADD CONSTRAINT "player_match_status_last_action_period_id_fkey" FOREIGN KEY ("last_action_period_id") REFERENCES "public"."match_periods"("id");



ALTER TABLE ONLY "public"."player_time_logs"
    ADD CONSTRAINT "player_time_logs_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."match_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated club creation" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Club admins and officials can create players" ON "public"."players" FOR INSERT WITH CHECK ("public"."user_has_club_access"("club_id", 'official'::"public"."user_role"));



CREATE POLICY "Club admins and officials can create teams" ON "public"."teams" FOR INSERT WITH CHECK ("public"."user_has_club_access"("club_id", 'official'::"public"."user_role"));



CREATE POLICY "Club admins and officials can update players" ON "public"."players" FOR UPDATE USING ("public"."user_has_club_access"("club_id", 'official'::"public"."user_role"));



CREATE POLICY "Club admins and officials can update teams" ON "public"."teams" FOR UPDATE USING ("public"."user_has_club_access"("club_id", 'official'::"public"."user_role"));



CREATE POLICY "Club admins can add members" ON "public"."club_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_is_club_admin"("club_id", "auth"."uid"()));



CREATE POLICY "Club admins can approve officials" ON "public"."club_members" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "club_members"."club_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"text")))) OR "public"."is_super_admin"()));



CREATE POLICY "Club admins can create invitations" ON "public"."club_invitations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."club_members"
  WHERE (("club_members"."club_id" = "club_invitations"."club_id") AND ("club_members"."user_id" = "auth"."uid"()) AND ("club_members"."role" = 'admin'::"public"."user_role") AND ("club_members"."status" = 'active'::"text")))));



CREATE POLICY "Club admins can delete fixtures" ON "public"."fixtures" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "fixtures"."team_id") AND "public"."user_has_club_access"("t"."club_id", 'admin'::"public"."user_role")))));



CREATE POLICY "Club admins can delete players" ON "public"."players" FOR DELETE USING ("public"."user_has_club_access"("club_id", 'admin'::"public"."user_role"));



CREATE POLICY "Club admins can delete teams" ON "public"."teams" FOR DELETE USING ("public"."user_has_club_access"("club_id", 'admin'::"public"."user_role"));



CREATE POLICY "Club admins can remove members" ON "public"."club_members" FOR DELETE TO "authenticated" USING ("public"."user_is_club_admin"("club_id", "auth"."uid"()));



CREATE POLICY "Club admins can update clubs" ON "public"."clubs" FOR UPDATE USING ("public"."user_has_club_access"("id", 'admin'::"public"."user_role"));



CREATE POLICY "Club admins can update memberships" ON "public"."club_members" FOR UPDATE TO "authenticated" USING ("public"."user_is_club_admin"("club_id", "auth"."uid"())) WITH CHECK ("public"."user_is_club_admin"("club_id", "auth"."uid"()));



CREATE POLICY "Club members can view clubs" ON "public"."clubs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_members"
  WHERE (("club_members"."club_id" = "clubs"."id") AND ("club_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Club officials can create fixtures" ON "public"."fixtures" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "fixtures"."team_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role")))));



CREATE POLICY "Club officials can delete team assignments" ON "public"."team_players" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_players"."team_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role")))));



CREATE POLICY "Club officials can manage match events" ON "public"."match_events" USING ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "match_events"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "match_events"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role")))));



CREATE POLICY "Club officials can manage match periods" ON "public"."match_periods" USING ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "match_periods"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "match_periods"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role")))));



CREATE POLICY "Club officials can manage player match status" ON "public"."player_match_status" USING ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "player_match_status"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "player_match_status"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role")))));



CREATE POLICY "Club officials can manage player time logs" ON "public"."player_time_logs" USING ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "player_time_logs"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "player_time_logs"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role")))));



CREATE POLICY "Club officials can manage team assignments" ON "public"."team_players" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_players"."team_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role")))));



CREATE POLICY "Club officials can update fixtures" ON "public"."fixtures" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "fixtures"."team_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role")))));



CREATE POLICY "Club officials can update team assignments" ON "public"."team_players" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_players"."team_id") AND "public"."user_has_club_access"("t"."club_id", 'official'::"public"."user_role")))));



CREATE POLICY "Service role can manage email_queue" ON "public"."email_queue" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage email_send_log" ON "public"."email_send_log" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Super admins can update notifications" ON "public"."admin_notifications" FOR UPDATE USING ("public"."is_super_admin"());



CREATE POLICY "Super admins can update pending registrations" ON "public"."pending_registrations" FOR UPDATE USING ("public"."is_super_admin"());



CREATE POLICY "Super admins can view all notifications" ON "public"."admin_notifications" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "Super admins can view all pending registrations" ON "public"."pending_registrations" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "Users can insert their own clubs" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view club memberships for their clubs" ON "public"."club_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."user_is_club_member"("club_id", "auth"."uid"())));



CREATE POLICY "Users can view fixtures from their clubs" ON "public"."fixtures" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "fixtures"."team_id") AND "public"."user_has_club_access"("t"."club_id", 'viewer'::"public"."user_role")))));



CREATE POLICY "Users can view invitations sent to their email" ON "public"."club_invitations" FOR SELECT USING (("invited_email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text"));



CREATE POLICY "Users can view invitations they created" ON "public"."club_invitations" FOR SELECT USING (("invited_by" = "auth"."uid"()));



CREATE POLICY "Users can view match events from their clubs" ON "public"."match_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "match_events"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'viewer'::"public"."user_role")))));



CREATE POLICY "Users can view match periods from their clubs" ON "public"."match_periods" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "match_periods"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'viewer'::"public"."user_role")))));



CREATE POLICY "Users can view player match status from their clubs" ON "public"."player_match_status" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "player_match_status"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'viewer'::"public"."user_role")))));



CREATE POLICY "Users can view player time logs from their clubs" ON "public"."player_time_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."fixtures" "f"
     JOIN "public"."teams" "t" ON (("t"."id" = "f"."team_id")))
  WHERE (("f"."id" = "player_time_logs"."fixture_id") AND "public"."user_has_club_access"("t"."club_id", 'viewer'::"public"."user_role")))));



CREATE POLICY "Users can view players from their clubs" ON "public"."players" FOR SELECT USING ("public"."user_has_club_access"("club_id", 'viewer'::"public"."user_role"));



CREATE POLICY "Users can view team assignments from their clubs" ON "public"."team_players" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_players"."team_id") AND "public"."user_has_club_access"("t"."club_id", 'viewer'::"public"."user_role")))));



CREATE POLICY "Users can view teams from their clubs" ON "public"."teams" FOR SELECT USING ("public"."user_has_club_access"("club_id", 'viewer'::"public"."user_role"));



CREATE POLICY "Users can view their clubs" ON "public"."clubs" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."club_members"
  WHERE (("club_members"."club_id" = "clubs"."id") AND ("club_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_send_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fixtures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_match_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_time_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."fixtures";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."match_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."match_periods";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."player_match_status";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."player_time_logs";



GRANT USAGE ON SCHEMA "analytics" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."accept_club_invitation"("p_token" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_club_invitation"("p_token" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_club_invitation"("p_token" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_club_creator_as_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_club_creator_as_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_club_creator_as_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_user_registration"("registration_id" "uuid", "approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_user_registration"("registration_id" "uuid", "approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_user_registration"("registration_id" "uuid", "approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_total_period_minutes"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_total_period_minutes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_total_period_minutes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_match_tracking"("fixture_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_match_tracking"("fixture_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_match_tracking"("fixture_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_match_storage_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_match_storage_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_match_storage_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."club_has_no_members"("club_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."club_has_no_members"("club_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_has_no_members"("club_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_club_invitation"("p_club_id" "uuid", "p_invited_email" "text", "p_invited_role" "public"."user_role", "p_invited_by" "uuid", "p_expires_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_club_invitation"("p_club_id" "uuid", "p_invited_email" "text", "p_invited_role" "public"."user_role", "p_invited_by" "uuid", "p_expires_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_club_invitation"("p_club_id" "uuid", "p_invited_email" "text", "p_invited_role" "public"."user_role", "p_invited_by" "uuid", "p_expires_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_pending_registration"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_pending_registration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_pending_registration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_email"("queue_name" "text", "payload" "jsonb", "scheduled_for" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_email"("queue_name" "text", "payload" "jsonb", "scheduled_for" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_email"("queue_name" "text", "payload" "jsonb", "scheduled_for" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_user_by_email"("lookup_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_user_by_email"("lookup_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_user_by_email"("lookup_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invitation_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invitation_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invitation_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_competitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_competitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_competitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_completed_matches"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_completed_matches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_completed_matches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_fixtures_with_scores_secure"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_fixtures_with_scores_secure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_fixtures_with_scores_secure"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_goal_scorers"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_goal_scorers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_goal_scorers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_emails"("p_queue_name" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_emails"("p_queue_name" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_emails"("p_queue_name" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_player_playing_time"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_player_playing_time"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_player_playing_time"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_player_playing_time_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_player_playing_time_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_player_playing_time_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_players_with_teams_secure"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_players_with_teams_secure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_players_with_teams_secure"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_teams_with_stats_secure"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_teams_with_stats_secure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_teams_with_stats_secure"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_dashboard_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_dashboard_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_dashboard_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_club_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_club_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_club_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_report_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_report_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_report_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_user_registration"("registration_id" "uuid", "approver_id" "uuid", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_user_registration"("registration_id" "uuid", "approver_id" "uuid", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_user_registration"("registration_id" "uuid", "approver_id" "uuid", "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_match_tracking"("fixture_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_match_tracking"("fixture_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_match_tracking"("fixture_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."restart_match"("fixture_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restart_match"("fixture_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restart_match"("fixture_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_super_admin"("target_user_id" "uuid", "is_admin" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."set_super_admin"("target_user_id" "uuid", "is_admin" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_super_admin"("target_user_id" "uuid", "is_admin" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."test_auth_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_auth_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_auth_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_current_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_current_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_current_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_refresh_reports"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_refresh_reports"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_refresh_reports"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_queue_status"("queue_id" "uuid", "new_status" "text", "error_msg" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_queue_status"("queue_id" "uuid", "new_status" "text", "error_msg" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_queue_status"("queue_id" "uuid", "new_status" "text", "error_msg" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tracking_activity"("fixture_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_tracking_activity"("fixture_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tracking_activity"("fixture_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_club_access"("club_id_param" "uuid", "required_role" "public"."user_role") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_club_access"("club_id_param" "uuid", "required_role" "public"."user_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_club_access"("club_id_param" "uuid", "required_role" "public"."user_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_approved"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_approved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_club_admin"("club_id_param" "uuid", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_club_admin"("club_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_club_admin"("club_id_param" "uuid", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_club_member"("club_id_param" "uuid", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_club_member"("club_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_club_member"("club_id_param" "uuid", "user_id_param" "uuid") TO "service_role";












GRANT ALL ON TABLE "public"."fixtures" TO "anon";
GRANT ALL ON TABLE "public"."fixtures" TO "authenticated";
GRANT ALL ON TABLE "public"."fixtures" TO "service_role";



GRANT SELECT ON TABLE "analytics"."mv_competitions" TO "authenticated";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."match_events" TO "anon";
GRANT ALL ON TABLE "public"."match_events" TO "authenticated";
GRANT ALL ON TABLE "public"."match_events" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT SELECT ON TABLE "analytics"."mv_completed_matches" TO "authenticated";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT SELECT ON TABLE "analytics"."mv_goal_scorers" TO "authenticated";



GRANT ALL ON TABLE "public"."match_periods" TO "anon";
GRANT ALL ON TABLE "public"."match_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."match_periods" TO "service_role";



GRANT ALL ON TABLE "public"."player_time_logs" TO "anon";
GRANT ALL ON TABLE "public"."player_time_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."player_time_logs" TO "service_role";



GRANT SELECT ON TABLE "analytics"."mv_player_playing_time" TO "authenticated";









GRANT ALL ON TABLE "public"."admin_notifications" TO "anon";
GRANT ALL ON TABLE "public"."admin_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."club_invitations" TO "anon";
GRANT ALL ON TABLE "public"."club_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."club_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."club_members" TO "anon";
GRANT ALL ON TABLE "public"."club_members" TO "authenticated";
GRANT ALL ON TABLE "public"."club_members" TO "service_role";



GRANT ALL ON TABLE "public"."email_queue" TO "anon";
GRANT ALL ON TABLE "public"."email_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."email_queue" TO "service_role";



GRANT ALL ON TABLE "public"."email_send_log" TO "anon";
GRANT ALL ON TABLE "public"."email_send_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_send_log" TO "service_role";



GRANT ALL ON TABLE "public"."pending_registrations" TO "anon";
GRANT ALL ON TABLE "public"."pending_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."player_match_status" TO "anon";
GRANT ALL ON TABLE "public"."player_match_status" TO "authenticated";
GRANT ALL ON TABLE "public"."player_match_status" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."team_players" TO "anon";
GRANT ALL ON TABLE "public"."team_players" TO "authenticated";
GRANT ALL ON TABLE "public"."team_players" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "analytics" GRANT SELECT ON TABLES TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
