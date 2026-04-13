export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      event_room_blocks: {
        Row: {
          date: string
          end_time: string
          event_id: string
          id: string
          room_id: string
          start_time: string
        }
        Insert: {
          date: string
          end_time: string
          event_id: string
          id?: string
          room_id: string
          start_time: string
        }
        Update: {
          date?: string
          end_time?: string
          event_id?: string
          id?: string
          room_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_room_blocks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          end_time: string
          id: string
          start_time: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          end_time: string
          id?: string
          start_time: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          end_time?: string
          id?: string
          start_time?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          blocked_until: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          member_number: string
          no_show_count: number
          role: Database["public"]["Enums"]["role"]
          updated_at: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          member_number: string
          no_show_count?: number
          role?: Database["public"]["Enums"]["role"]
          updated_at?: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          member_number?: string
          no_show_count?: number
          role?: Database["public"]["Enums"]["role"]
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          activated_at: string | null
          created_at: string
          date: string
          end_time: string
          id: string
          start_time: string
          status: Database["public"]["Enums"]["reservation_status"]
          surface: Database["public"]["Enums"]["table_surface"] | null
          table_id: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          date: string
          end_time: string
          id?: string
          start_time: string
          status?: Database["public"]["Enums"]["reservation_status"]
          surface?: Database["public"]["Enums"]["table_surface"] | null
          table_id: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          surface?: Database["public"]["Enums"]["table_surface"] | null
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          table_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          table_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          table_count?: number
        }
        Relationships: []
      }
      tables: {
        Row: {
          created_at: string
          id: string
          name: string
          pos_x: number | null
          pos_y: number | null
          qr_code: string | null
          qr_code_inf: string | null
          room_id: string
          type: Database["public"]["Enums"]["table_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pos_x?: number | null
          pos_y?: number | null
          qr_code?: string | null
          qr_code_inf?: string | null
          room_id: string
          type?: Database["public"]["Enums"]["table_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pos_x?: number | null
          pos_y?: number | null
          qr_code?: string | null
          qr_code_inf?: string | null
          room_id?: string
          type?: Database["public"]["Enums"]["table_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tables_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_expired_pending_reservations: { Args: { grace_minutes?: number }; Returns: number }
      create_event_atomic: {
        Args: {
          p_title: string
          p_description: string | null
          p_date: string
          p_start_time: string
          p_end_time: string
          p_room_id: string | null
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      mark_no_show_reservations: { Args: never; Returns: number }
      update_event_atomic: {
        Args: {
          p_id: string
          p_title: string
          p_description: string | null
          p_date: string
          p_start_time: string
          p_end_time: string
          p_room_id: string | null
        }
        Returns: Json
      }
    }
    Enums: {
      reservation_status: "active" | "cancelled" | "completed" | "pending" | "no_show"
      role: "member" | "admin"
      table_surface: "top" | "bottom"
      table_type: "small" | "large" | "removable_top"
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

export type EventRow = Database["public"]["Tables"]["events"]["Row"]
export type EventRoomBlockRow = Database["public"]["Tables"]["event_room_blocks"]["Row"]

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      reservation_status: ["active", "cancelled", "completed", "pending", "no_show"],
      role: ["member", "admin"],
      table_surface: ["top", "bottom"],
      table_type: ["small", "large", "removable_top"],
    },
  },
} as const
