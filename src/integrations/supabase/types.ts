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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      club_members: {
        Row: {
          club_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
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
            foreignKeyName: "fixtures_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fixtures_team_id"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fixtures_team_id"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          assist_player_id: string | null
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
            foreignKeyName: "fk_match_events_assist_player_id"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "players_with_teams"
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
            foreignKeyName: "fk_match_events_fixture_id"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures_with_scores"
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
            foreignKeyName: "fk_match_events_player_id"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_with_teams"
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
          {
            foreignKeyName: "fk_match_periods_fixture_id"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures_with_scores"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "fk_player_match_status_fixture_id"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures_with_scores"
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
            foreignKeyName: "fk_player_match_status_player_id"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_with_teams"
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
            foreignKeyName: "fk_player_time_logs_fixture_id"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures_with_scores"
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
            foreignKeyName: "fk_player_time_logs_player_id"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_with_teams"
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
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
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
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_with_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_with_stats"
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
      dashboard_stats: {
        Row: {
          total_clubs: number | null
          total_players: number | null
          total_teams: number | null
          upcoming_fixtures: number | null
          user_id: string | null
        }
        Relationships: []
      }
      fixtures_with_scores: {
        Row: {
          active_tracker_id: string | null
          club_name: string | null
          competition_name: string | null
          competition_type:
            | Database["public"]["Enums"]["competition_type"]
            | null
          created_at: string | null
          current_period_id: string | null
          fixture_type: Database["public"]["Enums"]["fixture_type"] | null
          half_length: number | null
          id: string | null
          is_retrospective: boolean | null
          last_activity_at: string | null
          location: string | null
          match_state: Json | null
          match_status: string | null
          opponent_goals: number | null
          opponent_name: string | null
          our_goals: number | null
          scheduled_date: string | null
          selected_squad_data: Json | null
          status: Database["public"]["Enums"]["match_status"] | null
          team_id: string | null
          team_name: string | null
          tracking_started_at: string | null
          updated_at: string | null
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
            foreignKeyName: "fixtures_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fixtures_team_id"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fixtures_team_id"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      players_with_teams: {
        Row: {
          club_id: string | null
          club_name: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          jersey_number: number | null
          last_name: string | null
          teams: Json | null
          updated_at: string | null
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
      teams_with_stats: {
        Row: {
          club_id: string | null
          club_name: string | null
          created_at: string | null
          id: string | null
          name: string | null
          player_count: number | null
          team_type: Database["public"]["Enums"]["team_type"] | null
          updated_at: string | null
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
    Functions: {
      claim_match_tracking: {
        Args: { fixture_id_param: string }
        Returns: Json
      }
      club_has_no_members: {
        Args: { club_id_param: string }
        Returns: boolean
      }
      release_match_tracking: {
        Args: { fixture_id_param: string }
        Returns: boolean
      }
      restart_match: {
        Args: { fixture_id_param: string }
        Returns: boolean
      }
      test_auth_context: {
        Args: Record<PropertyKey, never>
        Returns: {
          auth_role: string
          current_auth_uid: string
          is_authenticated: boolean
        }[]
      }
      test_current_user: {
        Args: Record<PropertyKey, never>
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
      period_type: "period"
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
      period_type: ["period"],
      team_type: ["5-a-side", "7-a-side", "9-a-side", "11-a-side"],
      user_role: ["admin", "official", "viewer"],
    },
  },
} as const
