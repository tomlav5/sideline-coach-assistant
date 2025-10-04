


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



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
    'period'
);


ALTER TYPE "public"."period_type" OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_player_playing_time"() RETURNS TABLE("player_id" "uuid", "first_name" "text", "last_name" "text", "jersey_number" integer, "club_name" "text", "team_name" "text", "matches_played" bigint, "total_minutes_played" numeric, "avg_minutes_per_match" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'analytics'
    AS $$
  SELECT 
    mv.player_id,
    mv.first_name,
    mv.last_name,
    mv.jersey_number,
    mv.club_name,
    mv.team_name,
    mv.matches_played,
    mv.total_minutes_played,
    mv.avg_minutes_per_match
  FROM analytics.mv_player_playing_time mv;
$$;


ALTER FUNCTION "public"."get_player_playing_time"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."refresh_report_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'analytics'
    AS $$
BEGIN
    -- Refresh materialized views in analytics schema
    REFRESH MATERIALIZED VIEW analytics.mv_completed_matches;
    REFRESH MATERIALIZED VIEW analytics.mv_goal_scorers;
    REFRESH MATERIALIZED VIEW analytics.mv_player_playing_time;  
    REFRESH MATERIALIZED VIEW analytics.mv_competitions;
    
    -- Log the refresh for monitoring
    RAISE NOTICE 'Report views refreshed at %', now();
END;
$$;


ALTER FUNCTION "public"."refresh_report_views"() OWNER TO "postgres";


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
    CONSTRAINT "fixtures_match_status_check" CHECK (("match_status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'paused'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."fixtures" REPLICA IDENTITY FULL;


ALTER TABLE "public"."fixtures" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."team_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'viewer'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."club_members" OWNER TO "postgres";


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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_user_id_key" UNIQUE ("club_id", "user_id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_periods"
    ADD CONSTRAINT "match_periods_fixture_id_period_number_key" UNIQUE ("fixture_id", "period_number");



ALTER TABLE ONLY "public"."match_periods"
    ADD CONSTRAINT "match_periods_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "idx_club_members_user_id" ON "public"."club_members" USING "btree" ("user_id");



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



CREATE INDEX "idx_player_match_status_fixture_player" ON "public"."player_match_status" USING "btree" ("fixture_id", "player_id");



CREATE INDEX "idx_player_match_status_on_field" ON "public"."player_match_status" USING "btree" ("fixture_id", "is_on_field", "player_id") WHERE ("is_on_field" = true);



CREATE INDEX "idx_player_time_logs_fixture" ON "public"."player_time_logs" USING "btree" ("fixture_id", "player_id");



CREATE INDEX "idx_player_time_logs_fixture_player" ON "public"."player_time_logs" USING "btree" ("fixture_id", "player_id");



CREATE INDEX "idx_player_time_logs_player_period" ON "public"."player_time_logs" USING "btree" ("player_id", "period_id");



CREATE INDEX "idx_players_club_id" ON "public"."players" USING "btree" ("club_id");



CREATE INDEX "idx_players_club_jersey" ON "public"."players" USING "btree" ("club_id", "jersey_number") WHERE ("jersey_number" IS NOT NULL);



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_team_players_lookup" ON "public"."team_players" USING "btree" ("player_id", "team_id");



CREATE INDEX "idx_team_players_player_id" ON "public"."team_players" USING "btree" ("player_id");



CREATE INDEX "idx_team_players_team_id" ON "public"."team_players" USING "btree" ("team_id");



CREATE INDEX "idx_teams_club_id" ON "public"."teams" USING "btree" ("club_id");



CREATE OR REPLACE TRIGGER "add_club_creator_as_admin_trigger" AFTER INSERT ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."add_club_creator_as_admin"();



CREATE OR REPLACE TRIGGER "trg_add_club_creator_as_admin" AFTER INSERT ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."add_club_creator_as_admin"();



CREATE OR REPLACE TRIGGER "trg_handle_club_creation" BEFORE INSERT ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_club_creation"();



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



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."player_match_status"
    ADD CONSTRAINT "player_match_status_last_action_period_id_fkey" FOREIGN KEY ("last_action_period_id") REFERENCES "public"."match_periods"("id");



ALTER TABLE ONLY "public"."player_time_logs"
    ADD CONSTRAINT "player_time_logs_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."match_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



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



CREATE POLICY "Users can insert their own clubs" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view club memberships for their clubs" ON "public"."club_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."user_is_club_member"("club_id", "auth"."uid"())));



CREATE POLICY "Users can view fixtures from their clubs" ON "public"."fixtures" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "fixtures"."team_id") AND "public"."user_has_club_access"("t"."club_id", 'viewer'::"public"."user_role")))));



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



ALTER TABLE "public"."club_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fixtures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_match_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_time_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_club_creator_as_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_club_creator_as_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_club_creator_as_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_match_tracking"("fixture_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_match_tracking"("fixture_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_match_tracking"("fixture_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_match_storage_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_match_storage_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_match_storage_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."club_has_no_members"("club_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."club_has_no_members"("club_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_has_no_members"("club_id_param" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."get_player_playing_time"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_player_playing_time"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_player_playing_time"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."refresh_report_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_report_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_report_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."release_match_tracking"("fixture_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_match_tracking"("fixture_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_match_tracking"("fixture_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."restart_match"("fixture_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restart_match"("fixture_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restart_match"("fixture_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_auth_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_auth_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_auth_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_current_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_current_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_current_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_refresh_reports"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_refresh_reports"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_refresh_reports"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tracking_activity"("fixture_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_tracking_activity"("fixture_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tracking_activity"("fixture_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_club_access"("club_id_param" "uuid", "required_role" "public"."user_role") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_club_access"("club_id_param" "uuid", "required_role" "public"."user_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_club_access"("club_id_param" "uuid", "required_role" "public"."user_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_club_admin"("club_id_param" "uuid", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_club_admin"("club_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_club_admin"("club_id_param" "uuid", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_club_member"("club_id_param" "uuid", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_club_member"("club_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_club_member"("club_id_param" "uuid", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."fixtures" TO "anon";
GRANT ALL ON TABLE "public"."fixtures" TO "authenticated";
GRANT ALL ON TABLE "public"."fixtures" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."match_events" TO "anon";
GRANT ALL ON TABLE "public"."match_events" TO "authenticated";
GRANT ALL ON TABLE "public"."match_events" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."player_time_logs" TO "anon";
GRANT ALL ON TABLE "public"."player_time_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."player_time_logs" TO "service_role";



GRANT ALL ON TABLE "public"."team_players" TO "anon";
GRANT ALL ON TABLE "public"."team_players" TO "authenticated";
GRANT ALL ON TABLE "public"."team_players" TO "service_role";



GRANT ALL ON TABLE "public"."club_members" TO "anon";
GRANT ALL ON TABLE "public"."club_members" TO "authenticated";
GRANT ALL ON TABLE "public"."club_members" TO "service_role";



GRANT ALL ON TABLE "public"."match_periods" TO "anon";
GRANT ALL ON TABLE "public"."match_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."match_periods" TO "service_role";



GRANT ALL ON TABLE "public"."player_match_status" TO "anon";
GRANT ALL ON TABLE "public"."player_match_status" TO "authenticated";
GRANT ALL ON TABLE "public"."player_match_status" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



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
