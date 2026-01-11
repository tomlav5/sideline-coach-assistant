export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          actioned_at: string | null
          club_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          actioned_at?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          actioned_at?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          club_id: string
          created_at: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by: string
          invited_email: string | null
          invited_role: Database["public"]["Enums"]["user_role"]
          status: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id: string
          created_at?: string
          expires_at: string
          id?: string
          invitation_token: string
          invited_by: string
          invited_email?: string | null
          invited_role: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string
          invited_email?: string | null
          invited_role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          approved_at: string | null
          club_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          club_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          club_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fixtures: {
        Row: {
          active_tracker_id: string | null
          competition_name: string | null
          competition_type:
            | Database["public"]["Enums"]["competition_type"]
            | null
          created_at: string
          current_period_id: string | null
          fixture_type: Database["public"]["Enums"]["fixture_type"]
          half_length: number
          id: string
          is_retrospective: boolean
          kickoff_time_tbd: boolean | null
          last_activity_at: string | null
          location: string | null
          match_state: Json | null
          match_status: string | null
          opponent_name: string
          scheduled_date: string
          selected_squad_data: Json | null
          status: Database["public"]["Enums"]["match_status"]
          team_id: string
          tracking_started_at: string | null
          updated_at: string
        }
        Insert: {
          active_tracker_id?: string | null
          competition_name?: string | null
          competition_type?:
            | Database["public"]["Enums"]["competition_type"]
            | null
          created_at?: string
          current_period_id?: string | null
          fixture_type: Database["public"]["Enums"]["fixture_type"]
          half_length?: number
          id?: string
          is_retrospective?: boolean
          kickoff_time_tbd?: boolean | null
          last_activity_at?: string | null
          location?: string | null
          match_state?: Json | null
          match_status?: string | null
          opponent_name: string
          scheduled_date: string
          selected_squad_data?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          team_id: string
          tracking_started_at?: string | null
          updated_at?: string
        }
        Update: {
          active_tracker_id?: string | null
          competition_name?: string | null
          competition_type?:
            | Database["public"]["Enums"]["competition_type"]
            | null
          created_at?: string
          current_period_id?: string | null
          fixture_type?: Database["public"]["Enums"]["fixture_type"]
          half_length?: number
          id?: string
          is_retrospective?: boolean
          kickoff_time_tbd?: boolean | null
          last_activity_at?: string | null
          location?: string | null
          match_state?: Json | null
          match_status?: string | null
          opponent_name?: string
          scheduled_date?: string
          selected_squad_data?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          team_id?: string
          tracking_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_current_period_id_fkey"
            columns: ["current_period_id"]
            isOneToOne: false
            referencedRelation: "match_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fixtures_team_id"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          assist_player_id: string | null
          client_event_id: string | null
          created_at: string
          event_type: string
          fixture_id: string
          id: string
          is_our_team: boolean
          is_penalty: boolean | null
          is_retrospective: boolean
          minute_in_period: number
          notes: string | null
          period_id: string
          player_id: string | null
          recorded_at: string
          total_match_minute: number
          updated_at: string
        }
        Insert: {
          assist_player_id?: string | null
          client_event_id?: string | null
          created_at?: string
          event_type: string
          fixture_id: string
          id?: string
          is_our_team?: boolean
          is_penalty?: boolean | null
          is_retrospective?: boolean
          minute_in_period: number
          notes?: string | null
          period_id: string
          player_id?: string | null
          recorded_at?: string
          total_match_minute: number
          updated_at?: string
        }
        Update: {
          assist_player_id?: string | null
          client_event_id?: string | null
          created_at?: string
          event_type?: string
          fixture_id?: string
          id?: string
          is_our_team?: boolean
          is_penalty?: boolean | null
          is_retrospective?: boolean
          minute_in_period?: number
          notes?: string | null
          period_id?: string
          player_id?: string | null
          recorded_at?: string
          total_match_minute?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_match_events_assist_player_id"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_match_events_fixture_id"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_match_events_player_id"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "match_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      match_periods: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          created_at: string
          fixture_id: string
          id: string
          is_active: boolean
          pause_time: string | null
          period_number: number
          period_type: Database["public"]["Enums"]["period_type"]
          planned_duration_minutes: number
          total_paused_seconds: number
          updated_at: string
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          created_at?: string
          fixture_id: string
          id?: string
          is_active?: boolean
          pause_time?: string | null
          period_number: number
          period_type?: Database["public"]["Enums"]["period_type"]
          planned_duration_minutes?: number
          total_paused_seconds?: number
          updated_at?: string
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          created_at?: string
          fixture_id?: string
          id?: string
          is_active?: boolean
          pause_time?: string | null
          period_number?: number
          period_type?: Database["public"]["Enums"]["period_type"]
          planned_duration_minutes?: number
          total_paused_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_match_periods_fixture_id"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_registrations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          notified_at: string | null
          oauth_provider: string | null
          rejection_reason: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notified_at?: string | null
          oauth_provider?: string | null
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notified_at?: string | null
          oauth_provider?: string | null
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_match_status: {
        Row: {
          created_at: string
          fixture_id: string
          id: string
          is_on_field: boolean
          last_action_minute: number | null
          last_action_period_id: string | null
          player_id: string
          position: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          id?: string
          is_on_field?: boolean
          last_action_minute?: number | null
          last_action_period_id?: string | null
          player_id: string
          position?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          id?: string
          is_on_field?: boolean
          last_action_minute?: number | null
          last_action_period_id?: string | null
          player_id?: string
          position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_player_match_status_fixture_id"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_player_match_status_player_id"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_status_last_action_period_id_fkey"
            columns: ["last_action_period_id"]
            isOneToOne: false
            referencedRelation: "match_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      player_time_logs: {
        Row: {
          created_at: string
          fixture_id: string
          id: string
          is_active: boolean
          is_starter: boolean
          period_id: string
          player_id: string
          time_off_minute: number | null
          time_on_minute: number | null
          total_period_minutes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          id?: string
          is_active?: boolean
          is_starter?: boolean
          period_id: string
          player_id: string
          time_off_minute?: number | null
          time_on_minute?: number | null
          total_period_minutes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          id?: string
          is_active?: boolean
          is_starter?: boolean
          period_id?: string
          player_id?: string
          time_off_minute?: number | null
          time_on_minute?: number | null
          total_period_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_player_time_logs_fixture_id"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_player_time_logs_player_id"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_time_logs_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "match_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          club_id: string
          created_at: string
          first_name: string
          id: string
          jersey_number: number | null
          last_name: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          first_name: string
          id?: string
          jersey_number?: number | null
          last_name: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          first_name?: string
          id?: string
          jersey_number?: number | null
          last_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_super_admin: boolean | null
          last_name: string | null
          oauth_provider: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_super_admin?: boolean | null
          last_name?: string | null
          oauth_provider?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_super_admin?: boolean | null
          last_name?: string | null
          oauth_provider?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_players: {
        Row: {
          created_at: string
          id: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          club_id: string
          created_at: string
          id: string
          name: string
          team_type: Database["public"]["Enums"]["team_type"]
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          name: string
          team_type?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          name?: string
          team_type?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_club_invitation: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      approve_user_registration: {
        Args: { approver_id: string; registration_id: string }
        Returns: Json
      }
      claim_match_tracking: {
        Args: { fixture_id_param: string }
        Returns: Json
      }
      club_has_no_members: { Args: { club_id_param: string }; Returns: boolean }
      create_club_invitation: {
        Args: {
          p_club_id: string
          p_expires_days?: number
          p_invited_by: string
          p_invited_email: string
          p_invited_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: Json
      }
      find_user_by_email: { Args: { lookup_email: string }; Returns: string }
      generate_invitation_token: { Args: never; Returns: string }
      get_competitions: {
        Args: never
        Returns: {
          competition_name: string
          competition_type: string
          display_name: string
        }[]
      }
      get_completed_matches: {
        Args: never
        Returns: {
          club_name: string
          competition_name: string
          competition_type: string
          created_at: string
          fixture_type: string
          id: string
          location: string
          opponent_goals: number
          opponent_name: string
          our_goals: number
          scheduled_date: string
          team_name: string
        }[]
      }
      get_fixtures_with_scores_secure: {
        Args: never
        Returns: {
          active_tracker_id: string
          club_name: string
          competition_name: string
          competition_type: Database["public"]["Enums"]["competition_type"]
          created_at: string
          current_period_id: string
          fixture_type: Database["public"]["Enums"]["fixture_type"]
          half_length: number
          id: string
          is_retrospective: boolean
          last_activity_at: string
          location: string
          match_state: Json
          match_status: string
          opponent_goals: number
          opponent_name: string
          our_goals: number
          scheduled_date: string
          selected_squad_data: Json
          status: Database["public"]["Enums"]["match_status"]
          team_id: string
          team_name: string
          tracking_started_at: string
          updated_at: string
        }[]
      }
      get_goal_scorers: {
        Args: never
        Returns: {
          assists: number
          club_name: string
          first_name: string
          goals: number
          jersey_number: number
          last_name: string
          penalty_goals: number
          player_id: string
        }[]
      }
      get_player_playing_time: {
        Args: never
        Returns: {
          avg_minutes_per_match: number
          club_name: string
          first_name: string
          last_name: string
          matches_played: number
          player_id: string
          team_name: string
          total_minutes_played: number
        }[]
      }
      get_player_playing_time_v2: {
        Args: never
        Returns: {
          avg_minutes_per_match: number
          club_name: string
          first_name: string
          last_name: string
          matches_played: number
          player_id: string
          team_name: string
          total_minutes_played: number
        }[]
      }
      get_players_with_teams_secure: {
        Args: never
        Returns: {
          club_id: string
          club_name: string
          created_at: string
          first_name: string
          id: string
          jersey_number: number
          last_name: string
          teams: Json
          updated_at: string
        }[]
      }
      get_teams_with_stats_secure: {
        Args: never
        Returns: {
          club_id: string
          club_name: string
          created_at: string
          id: string
          name: string
          player_count: number
          team_type: Database["public"]["Enums"]["team_type"]
          updated_at: string
        }[]
      }
      get_user_dashboard_stats: {
        Args: never
        Returns: {
          total_clubs: number
          total_players: number
          total_teams: number
          upcoming_fixtures: number
          user_id: string
        }[]
      }
      is_super_admin: { Args: never; Returns: boolean }
      refresh_report_views: { Args: never; Returns: undefined }
      reject_user_registration: {
        Args: { approver_id: string; reason?: string; registration_id: string }
        Returns: Json
      }
      release_match_tracking: {
        Args: { fixture_id_param: string }
        Returns: boolean
      }
      restart_match: { Args: { fixture_id_param: string }; Returns: boolean }
      set_super_admin: {
        Args: { is_admin: boolean; target_user_id: string }
        Returns: Json
      }
      test_auth_context: {
        Args: never
        Returns: {
          auth_role: string
          current_auth_uid: string
          is_authenticated: boolean
        }[]
      }
      test_current_user: {
        Args: never
        Returns: {
          auth_uid: string
          jwt_claims: Json
          session_exists: boolean
        }[]
      }
      update_tracking_activity: {
        Args: { fixture_id_param: string }
        Returns: boolean
      }
      user_has_club_access: {
        Args: {
          club_id_param: string
          required_role?: Database["public"]["Enums"]["user_role"]
        }
        Returns: boolean
      }
      user_is_approved: { Args: never; Returns: boolean }
      user_is_club_admin: {
        Args: { club_id_param: string; user_id_param: string }
        Returns: boolean
      }
      user_is_club_member: {
        Args: { club_id_param: string; user_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      competition_type: "league" | "tournament" | "friendly"
      event_type:
        | "goal"
        | "assist"
        | "throw_in"
        | "corner"
        | "free_kick"
        | "penalty"
        | "goal_kick"
      fixture_type: "home" | "away"
      match_half: "first" | "second"
      match_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      period_type: "period" | "penalties"
      team_type: "5-a-side" | "7-a-side" | "9-a-side" | "11-a-side"
      user_role: "admin" | "official" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      competition_type: ["league", "tournament", "friendly"],
      event_type: [
        "goal",
        "assist",
        "throw_in",
        "corner",
        "free_kick",
        "penalty",
        "goal_kick",
      ],
      fixture_type: ["home", "away"],
      match_half: ["first", "second"],
      match_status: ["scheduled", "in_progress", "completed", "cancelled"],
      period_type: ["period", "penalties"],
      team_type: ["5-a-side", "7-a-side", "9-a-side", "11-a-side"],
      user_role: ["admin", "official", "viewer"],
    },
  },
} as const
