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
      cached_messages: {
        Row: {
          account_id: string
          attachment_count: number
          body_html: string | null
          body_text: string | null
          created_at: string
          has_attachments: boolean
          id: string
          is_pinned: boolean
          is_read: boolean
          is_starred: boolean
          labels: string[] | null
          message_id: string
          received_at: string
          recipient_emails: string[] | null
          sender_email: string
          sender_name: string | null
          snippet: string | null
          subject: string | null
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          attachment_count?: number
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          has_attachments?: boolean
          id?: string
          is_pinned?: boolean
          is_read?: boolean
          is_starred?: boolean
          labels?: string[] | null
          message_id: string
          received_at: string
          recipient_emails?: string[] | null
          sender_email: string
          sender_name?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          attachment_count?: number
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          has_attachments?: boolean
          id?: string
          is_pinned?: boolean
          is_read?: boolean
          is_starred?: boolean
          labels?: string[] | null
          message_id?: string
          received_at?: string
          recipient_emails?: string[] | null
          sender_email?: string
          sender_name?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cached_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string | null
          picture_url: string | null
          provider: Database["public"]["Enums"]["account_provider"]
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string | null
          picture_url?: string | null
          provider?: Database["public"]["Enums"]["account_provider"]
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string | null
          picture_url?: string | null
          provider?: Database["public"]["Enums"]["account_provider"]
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_watches: {
        Row: {
          account_id: string | null
          created_at: string | null
          expiration: string
          history_id: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          expiration: string
          history_id: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          expiration?: string
          history_id?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gmail_watches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token: string
          account_id: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      outlook_subscriptions: {
        Row: {
          account_id: string | null
          client_state: string | null
          created_at: string | null
          expiration: string
          id: string
          is_active: boolean | null
          resource: string
          subscription_id: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          client_state?: string | null
          created_at?: string | null
          expiration: string
          id?: string
          is_active?: boolean | null
          resource: string
          subscription_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          client_state?: string | null
          created_at?: string | null
          expiration?: string
          id?: string
          is_active?: boolean | null
          resource?: string
          subscription_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outlook_subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          account_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          messages_synced: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["sync_status"]
          timeout_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          messages_synced?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          timeout_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          messages_synced?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          timeout_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_queue: {
        Row: {
          account_id: string
          change_type: string | null
          created_at: string
          email_address: string
          error_message: string | null
          history_id: string
          id: string
          next_retry_at: string | null
          processed_at: string | null
          provider: string | null
          retry_count: number
          status: string
        }
        Insert: {
          account_id: string
          change_type?: string | null
          created_at?: string
          email_address: string
          error_message?: string | null
          history_id: string
          id?: string
          next_retry_at?: string | null
          processed_at?: string | null
          provider?: string | null
          retry_count?: number
          status?: string
        }
        Update: {
          account_id?: string
          change_type?: string | null
          created_at?: string
          email_address?: string
          error_message?: string | null
          history_id?: string
          id?: string
          next_retry_at?: string | null
          processed_at?: string | null
          provider?: string | null
          retry_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_stuck_sync_jobs: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_provider: "gmail" | "outlook"
      app_role: "viewer" | "responder" | "admin"
      sync_status: "pending" | "processing" | "completed" | "failed"
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
      account_provider: ["gmail", "outlook"],
      app_role: ["viewer", "responder", "admin"],
      sync_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
