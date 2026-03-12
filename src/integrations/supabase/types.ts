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
      compatibility_insights: {
        Row: {
          compatibility_text: string
          created_at: string
          id: string
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          compatibility_text: string
          created_at?: string
          id?: string
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          compatibility_text?: string
          created_at?: string
          id?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      date_activity_preferences: {
        Row: {
          created_at: string
          date_id: string
          id: string
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_id: string
          id?: string
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_id?: string
          id?: string
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_activity_preferences_date_id_fkey"
            columns: ["date_id"]
            isOneToOne: false
            referencedRelation: "dates"
            referencedColumns: ["id"]
          },
        ]
      }
      date_availability: {
        Row: {
          availability: Json
          created_at: string
          date_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: Json
          created_at?: string
          date_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: Json
          created_at?: string
          date_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_availability_date_id_fkey"
            columns: ["date_id"]
            isOneToOne: false
            referencedRelation: "dates"
            referencedColumns: ["id"]
          },
        ]
      }
      date_feedback: {
        Row: {
          created_at: string | null
          date_id: string
          feedback_text: string
          id: string
          liked: boolean
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_id: string
          feedback_text: string
          id?: string
          liked: boolean
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_id?: string
          feedback_text?: string
          id?: string
          liked?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_feedback_date_id_fkey"
            columns: ["date_id"]
            isOneToOne: false
            referencedRelation: "dates"
            referencedColumns: ["id"]
          },
        ]
      }
      date_feedback_answers: {
        Row: {
          answer: string
          created_at: string | null
          date_id: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          date_id: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          date_id?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_feedback_answers_date_id_fkey"
            columns: ["date_id"]
            isOneToOne: false
            referencedRelation: "dates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_feedback_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "date_feedback_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_feedback_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_feedback_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      date_feedback_questions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          question: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question?: string
        }
        Relationships: []
      }
      dates: {
        Row: {
          activity: string | null
          address: string | null
          completed_or_cancelled_at: string | null
          created_at: string | null
          date_time: string | null
          first_possible_day: string | null
          id: string
          is_completed: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          notes: string | null
          reminder_1h_sent: boolean | null
          reminder_24h_sent: boolean | null
          reminder_planning_48h_sent: boolean | null
          reminder_planning_soon_sent: boolean | null
          reschedule_count: number
          reschedule_reason: string | null
          status: Database["public"]["Enums"]["date_status"]
          timezone: string | null
          user1_availability: Json
          user1_confirmed: boolean | null
          user1_feedback: string | null
          user1_followup_preference:
            | Database["public"]["Enums"]["date_followup_preference"]
            | null
          user1_id: string
          user1_share_phone: boolean
          user2_availability: Json
          user2_confirmed: boolean | null
          user2_feedback: string | null
          user2_followup_preference:
            | Database["public"]["Enums"]["date_followup_preference"]
            | null
          user2_id: string
          user2_share_phone: boolean
          venue_options: string[] | null
          who_rescheduled: string | null
        }
        Insert: {
          activity?: string | null
          address?: string | null
          completed_or_cancelled_at?: string | null
          created_at?: string | null
          date_time?: string | null
          first_possible_day?: string | null
          id?: string
          is_completed?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notes?: string | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          reminder_planning_48h_sent?: boolean | null
          reminder_planning_soon_sent?: boolean | null
          reschedule_count?: number
          reschedule_reason?: string | null
          status?: Database["public"]["Enums"]["date_status"]
          timezone?: string | null
          user1_availability?: Json
          user1_confirmed?: boolean | null
          user1_feedback?: string | null
          user1_followup_preference?:
            | Database["public"]["Enums"]["date_followup_preference"]
            | null
          user1_id: string
          user1_share_phone?: boolean
          user2_availability?: Json
          user2_confirmed?: boolean | null
          user2_feedback?: string | null
          user2_followup_preference?:
            | Database["public"]["Enums"]["date_followup_preference"]
            | null
          user2_id: string
          user2_share_phone?: boolean
          venue_options?: string[] | null
          who_rescheduled?: string | null
        }
        Update: {
          activity?: string | null
          address?: string | null
          completed_or_cancelled_at?: string | null
          created_at?: string | null
          date_time?: string | null
          first_possible_day?: string | null
          id?: string
          is_completed?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notes?: string | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          reminder_planning_48h_sent?: boolean | null
          reminder_planning_soon_sent?: boolean | null
          reschedule_count?: number
          reschedule_reason?: string | null
          status?: Database["public"]["Enums"]["date_status"]
          timezone?: string | null
          user1_availability?: Json
          user1_confirmed?: boolean | null
          user1_feedback?: string | null
          user1_followup_preference?:
            | Database["public"]["Enums"]["date_followup_preference"]
            | null
          user1_id?: string
          user1_share_phone?: boolean
          user2_availability?: Json
          user2_confirmed?: boolean | null
          user2_feedback?: string | null
          user2_followup_preference?:
            | Database["public"]["Enums"]["date_followup_preference"]
            | null
          user2_id?: string
          user2_share_phone?: boolean
          venue_options?: string[] | null
          who_rescheduled?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dates_user1_id_fkey1"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "admin_profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dates_user1_id_fkey1"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dates_user2_id_fkey1"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "admin_profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dates_user2_id_fkey1"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_users: {
        Row: {
          active_date_partners: string[] | null
          deleted_at: string | null
          had_to_guess_for_user_created_at: boolean
          id: string
          reason: string | null
          user_created_at: string
          user_id: string
        }
        Insert: {
          active_date_partners?: string[] | null
          deleted_at?: string | null
          had_to_guess_for_user_created_at?: boolean
          id?: string
          reason?: string | null
          user_created_at: string
          user_id: string
        }
        Update: {
          active_date_partners?: string[] | null
          deleted_at?: string | null
          had_to_guess_for_user_created_at?: boolean
          id?: string
          reason?: string | null
          user_created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dislikes: {
        Row: {
          created_at: string | null
          disliked_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          disliked_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          disliked_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendship_dislikes: {
        Row: {
          created_at: string | null
          disliked_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          disliked_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          disliked_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      event_enrollments: {
        Row: {
          created_at: string
          event_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          active: boolean
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date: string
          id?: string
          name?: string
          start_date: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      friendship_answers: {
        Row: {
          answer: string
          answer_custom: string | null
          created_at: string | null
          id: string
          question_id: number | null
          question_number: number
          user_id: string
        }
        Insert: {
          answer: string
          answer_custom?: string | null
          created_at?: string | null
          id?: string
          question_id?: number | null
          question_number: number
          user_id: string
        }
        Update: {
          answer?: string
          answer_custom?: string | null
          created_at?: string | null
          id?: string
          question_id?: number | null
          question_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendship_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "friendship_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      friendship_questions: {
        Row: {
          allow_custom: boolean | null
          default_answer: string | null
          default_range: number[] | null
          disabled: boolean
          has_dropdown: boolean
          id: number
          max_responses: number | null
          max_value: number | null
          min_responses: number | null
          min_value: number | null
          multi_select: boolean | null
          options: Json | null
          order_index: number | null
          question: string
          range_slider: boolean | null
          ranked: boolean
          show_if: Json | null
        }
        Insert: {
          allow_custom?: boolean | null
          default_answer?: string | null
          default_range?: number[] | null
          disabled?: boolean
          has_dropdown?: boolean
          id?: number
          max_responses?: number | null
          max_value?: number | null
          min_responses?: number | null
          min_value?: number | null
          multi_select?: boolean | null
          options?: Json | null
          order_index?: number | null
          question: string
          range_slider?: boolean | null
          ranked?: boolean
          show_if?: Json | null
        }
        Update: {
          allow_custom?: boolean | null
          default_answer?: string | null
          default_range?: number[] | null
          disabled?: boolean
          has_dropdown?: boolean
          id?: number
          max_responses?: number | null
          max_value?: number | null
          min_responses?: number | null
          min_value?: number | null
          multi_select?: boolean | null
          options?: Json | null
          order_index?: number | null
          question?: string
          range_slider?: boolean | null
          ranked?: boolean
          show_if?: Json | null
        }
        Relationships: []
      }
      friendship_likes: {
        Row: {
          created_at: string | null
          id: string
          liked_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          liked_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          liked_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string | null
          id: string
          liked_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          liked_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          liked_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      match_history: {
        Row: {
          compatibility_score: number
          created_at: string
          from_algorithm: Database["public"]["Enums"]["algorithm_type"] | null
          id: string
          match_date: string
          match_type: Database["public"]["Enums"]["match_type"] | null
          matched_user_id: string
          user_id: string
        }
        Insert: {
          compatibility_score: number
          created_at?: string
          from_algorithm?: Database["public"]["Enums"]["algorithm_type"] | null
          id?: string
          match_date?: string
          match_type?: Database["public"]["Enums"]["match_type"] | null
          matched_user_id: string
          user_id: string
        }
        Update: {
          compatibility_score?: number
          created_at?: string
          from_algorithm?: Database["public"]["Enums"]["algorithm_type"] | null
          id?: string
          match_date?: string
          match_type?: Database["public"]["Enums"]["match_type"] | null
          matched_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          compatibility_score: number
          created_at: string | null
          from_algorithm: Database["public"]["Enums"]["algorithm_type"] | null
          id: string
          match_type: Database["public"]["Enums"]["match_type"] | null
          matched_user_id: string
          user_id: string
        }
        Insert: {
          compatibility_score: number
          created_at?: string | null
          from_algorithm?: Database["public"]["Enums"]["algorithm_type"] | null
          id?: string
          match_type?: Database["public"]["Enums"]["match_type"] | null
          matched_user_id: string
          user_id: string
        }
        Update: {
          compatibility_score?: number
          created_at?: string | null
          from_algorithm?: Database["public"]["Enums"]["algorithm_type"] | null
          id?: string
          match_type?: Database["public"]["Enums"]["match_type"] | null
          matched_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      matching_rules: {
        Row: {
          algorithm: Database["public"]["Enums"]["algorithm_type"]
          condition: Json | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          operator: string
          params: Json | null
          rule_type: string
          source_ref: string | null
          source_type: string
          target_ref: string | null
          target_type: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          algorithm?: Database["public"]["Enums"]["algorithm_type"]
          condition?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          operator: string
          params?: Json | null
          rule_type: string
          source_ref?: string | null
          source_type: string
          target_ref?: string | null
          target_type?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          algorithm?: Database["public"]["Enums"]["algorithm_type"]
          condition?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          operator?: string
          params?: Json | null
          rule_type?: string
          source_ref?: string | null
          source_type?: string
          target_ref?: string | null
          target_type?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: []
      }
      personality_answers: {
        Row: {
          answer: string
          answer_custom: string | null
          created_at: string | null
          id: string
          question_id: number | null
          question_number: number
          user_id: string
        }
        Insert: {
          answer: string
          answer_custom?: string | null
          created_at?: string | null
          id?: string
          question_id?: number | null
          question_number: number
          user_id: string
        }
        Update: {
          answer?: string
          answer_custom?: string | null
          created_at?: string | null
          id?: string
          question_id?: number | null
          question_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personality_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      private_profile_data: {
        Row: {
          user_id: string
          email: string | null
          last_name: string | null
          birthday: string | null
          phone_number: string | null
          latitude: number | null
          longitude: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email?: string | null
          last_name?: string | null
          birthday?: string | null
          phone_number?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email?: string | null
          last_name?: string | null
          birthday?: string | null
          phone_number?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_profile_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          additional_photos: string[] | null
          age: number | null
          bio: string | null
          completed_friendship_questionnaire: boolean | null
          completed_questionnaire: boolean
          created_at: string | null
          first_name: string
          from_migration: boolean | null
          has_seen_intro_dialog: boolean | null
          id: string
          is_paused: boolean
          photo_url: string | null
          updated_at: string | null
        }
        Insert: {
          additional_photos?: string[] | null
          age?: number | null
          bio?: string | null
          completed_friendship_questionnaire?: boolean | null
          completed_questionnaire?: boolean
          created_at?: string | null
          first_name: string
          from_migration?: boolean | null
          has_seen_intro_dialog?: boolean | null
          id: string
          is_paused?: boolean
          photo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_photos?: string[] | null
          age?: number | null
          bio?: string | null
          completed_friendship_questionnaire?: boolean | null
          completed_questionnaire?: boolean
          created_at?: string | null
          first_name?: string
          from_migration?: boolean | null
          has_seen_intro_dialog?: boolean | null
          id?: string
          is_paused?: boolean
          photo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      questionnaire_questions: {
        Row: {
          allow_custom: boolean | null
          combined: boolean
          default_answer: string | null
          default_range: number[] | null
          disabled: boolean | null
          has_dropdown: boolean | null
          id: number
          max_responses: number | null
          max_value: number | null
          min_responses: number | null
          min_value: number | null
          multi_select: boolean | null
          options: Json | null
          order_index: number | null
          question: string
          range_slider: boolean | null
          ranked: boolean | null
          show_if: Json | null
        }
        Insert: {
          allow_custom?: boolean | null
          combined?: boolean
          default_answer?: string | null
          default_range?: number[] | null
          disabled?: boolean | null
          has_dropdown?: boolean | null
          id?: number
          max_responses?: number | null
          max_value?: number | null
          min_responses?: number | null
          min_value?: number | null
          multi_select?: boolean | null
          options?: Json | null
          order_index?: number | null
          question: string
          range_slider?: boolean | null
          ranked?: boolean | null
          show_if?: Json | null
        }
        Update: {
          allow_custom?: boolean | null
          combined?: boolean
          default_answer?: string | null
          default_range?: number[] | null
          disabled?: boolean | null
          has_dropdown?: boolean | null
          id?: number
          max_responses?: number | null
          max_value?: number | null
          min_responses?: number | null
          min_value?: number | null
          multi_select?: boolean | null
          options?: Json | null
          order_index?: number | null
          question?: string
          range_slider?: boolean | null
          ranked?: boolean | null
          show_if?: Json | null
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          archived: boolean | null
          created_at: string
          custom_answer: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string | null
          reporter_id: string | null
        }
        Insert: {
          archived?: boolean | null
          created_at?: string
          custom_answer?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string | null
          reporter_id?: string | null
        }
        Update: {
          archived?: boolean | null
          created_at?: string
          custom_answer?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string | null
          reporter_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string
          created_at: string | null
          hours: Json
          hours_full: Json
          id: string
          image: string
          latitude: number | null
          longitude: number | null
          name: string
          timezone: string | null
          type: string
          website: string
        }
        Insert: {
          address: string
          created_at?: string | null
          hours: Json
          hours_full?: Json
          id?: string
          image: string
          latitude?: number | null
          longitude?: number | null
          name: string
          timezone?: string | null
          type: string
          website: string
        }
        Update: {
          address?: string
          created_at?: string | null
          hours?: Json
          hours_full?: Json
          id?: string
          image?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          timezone?: string | null
          type?: string
          website?: string
        }
        Relationships: []
      }
      waiting_list: {
        Row: {
          date_added: string
          email_address: string
        }
        Insert: {
          date_added?: string
          email_address: string
        }
        Update: {
          date_added?: string
          email_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_profile_stats: {
        Row: {
          age: number | null
          completed_dates: number | null
          completed_friendship_questionnaire: boolean | null
          completed_questionnaire: boolean | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          likes_given: number | null
          likes_received: number | null
          photo_url: string | null
          total_dates: number | null
          total_matches: number | null
        }
        Insert: {
          age?: number | null
          completed_dates?: never
          completed_friendship_questionnaire?: boolean | null
          completed_questionnaire?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          likes_given?: never
          likes_received?: never
          photo_url?: string | null
          total_dates?: never
          total_matches?: never
        }
        Update: {
          age?: number | null
          completed_dates?: never
          completed_friendship_questionnaire?: boolean | null
          completed_questionnaire?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          likes_given?: never
          likes_received?: never
          photo_url?: string | null
          total_dates?: never
          total_matches?: never
        }
        Relationships: []
      }
    }
    Functions: {
      get_event_gender_counts: {
        Args: { event_name_param: string }
        Returns: {
          count: number
          gender: string
        }[]
      }
      get_total_users_joined: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      algorithm_type:
        | "relationship"
        | "friendship"
        | "event"
        | "legacy_algorithm"
      app_role: "admin" | "user" | "test"
      date_followup_preference: "match" | "friend" | "pass"
      date_status:
        | "pending"
        | "confirmed"
        | "limbo"
        | "completed"
        | "cancelled"
        | "auto_cancelled"
      match_type: "friendship" | "relationship"
      report_reason:
        | "spam_bot"
        | "harassment"
        | "inappropriate_content"
        | "other"
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
      algorithm_type: [
        "relationship",
        "friendship",
        "event",
        "legacy_algorithm",
      ],
      app_role: ["admin", "user", "test"],
      date_followup_preference: ["match", "friend", "pass"],
      date_status: [
        "pending",
        "confirmed",
        "limbo",
        "completed",
        "cancelled",
        "auto_cancelled",
      ],
      match_type: ["friendship", "relationship"],
      report_reason: [
        "spam_bot",
        "harassment",
        "inappropriate_content",
        "other",
      ],
    },
  },
} as const
