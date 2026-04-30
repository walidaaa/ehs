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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          doctor_id: string | null
          id: string
          notes: string | null
          patient_id: string
          status: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          status?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string | null
          date: string | null
          id: string
          notes: string | null
          patient_id: string
          present: boolean | null
          recorded_by: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          present?: boolean | null
          recorded_by?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          present?: boolean | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_type: string
          read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      parents: {
        Row: {
          archived: boolean | null
          created_at: string | null
          created_by: string | null
          full_name: string
          id: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          created_by?: string | null
          full_name: string
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          created_by?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      patient_doctors: {
        Row: {
          created_at: string | null
          doctor_id: string
          id: string
          patient_id: string
        }
        Insert: {
          created_at?: string | null
          doctor_id: string
          id?: string
          patient_id: string
        }
        Update: {
          created_at?: string | null
          doctor_id?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_doctors_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_tasks: {
        Row: {
          created_at: string | null
          description: string | null
          doctor_id: string
          due_date: string | null
          evaluation: string | null
          evaluation_notes: string | null
          id: string
          parent_id: string | null
          patient_id: string
          status: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          doctor_id: string
          due_date?: string | null
          evaluation?: string | null
          evaluation_notes?: string | null
          id?: string
          parent_id?: string | null
          patient_id: string
          status?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          doctor_id?: string
          due_date?: string | null
          evaluation?: string | null
          evaluation_notes?: string | null
          id?: string
          parent_id?: string | null
          patient_id?: string
          status?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number
          archived: boolean | null
          birth_complications: string | null
          birth_type: string | null
          center_id: string | null
          created_at: string | null
          diagnosis_type: string | null
          doctor_id: string | null
          entry_date: string | null
          id: string
          mother_health_notes: string | null
          name: string
          notes: string | null
          parent_id: string | null
          photo_url: string | null
          pregnancy_months: number | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          age: number
          archived?: boolean | null
          birth_complications?: string | null
          birth_type?: string | null
          center_id?: string | null
          created_at?: string | null
          diagnosis_type?: string | null
          doctor_id?: string | null
          entry_date?: string | null
          id?: string
          mother_health_notes?: string | null
          name: string
          notes?: string | null
          parent_id?: string | null
          photo_url?: string | null
          pregnancy_months?: number | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          age?: number
          archived?: boolean | null
          birth_complications?: string | null
          birth_type?: string | null
          center_id?: string | null
          created_at?: string | null
          diagnosis_type?: string | null
          doctor_id?: string | null
          entry_date?: string | null
          id?: string
          mother_health_notes?: string | null
          name?: string
          notes?: string | null
          parent_id?: string | null
          photo_url?: string | null
          pregnancy_months?: number | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          created_by: string | null
          full_name: string
          id: string
          last_seen: string | null
          phone: string | null
          service_name: string | null
          specialty: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          full_name: string
          id: string
          last_seen?: string | null
          phone?: string | null
          service_name?: string | null
          specialty?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          full_name?: string
          id?: string
          last_seen?: string | null
          phone?: string | null
          service_name?: string | null
          specialty?: string | null
        }
        Relationships: []
      }
      task_reports: {
        Row: {
          created_at: string | null
          id: string
          parent_id: string | null
          report_text: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_id?: string | null
          report_text: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_id?: string | null
          report_text?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reports_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "patient_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_medications: {
        Row: {
          created_at: string | null
          evening_dose: number | null
          id: string
          meal_timing: string | null
          medication_name: string
          morning_dose: number | null
          night_dose: number | null
          treatment_id: string
        }
        Insert: {
          created_at?: string | null
          evening_dose?: number | null
          id?: string
          meal_timing?: string | null
          medication_name: string
          morning_dose?: number | null
          night_dose?: number | null
          treatment_id: string
        }
        Update: {
          created_at?: string | null
          evening_dose?: number | null
          id?: string
          meal_timing?: string | null
          medication_name?: string
          morning_dose?: number | null
          night_dose?: number | null
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_medications_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          created_at: string | null
          created_by: string | null
          dosage: string
          end_date: string | null
          frequency: string
          id: string
          medication: string
          notes: string | null
          patient_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dosage: string
          end_date?: string | null
          frequency?: string
          id?: string
          medication: string
          notes?: string | null
          patient_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dosage?: string
          end_date?: string | null
          frequency?: string
          id?: string
          medication?: string
          notes?: string | null
          patient_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_created_by: { Args: { _user_id: string }; Returns: string }
      get_created_user_ids: { Args: { _creator_id: string }; Returns: string[] }
      get_doctor_parent_ids: { Args: { _doctor_id: string }; Returns: string[] }
      get_doctor_patient_ids: {
        Args: { _doctor_id: string }
        Returns: string[]
      }
      get_my_created_by: { Args: never; Returns: string }
      get_service_doctor_ids: { Args: { _admin_id: string }; Returns: string[] }
      get_super_admin_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_doctor_of_patient: {
        Args: { _doctor_id: string; _patient_id: string }
        Returns: boolean
      }
      is_receptionist: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user" | "parent" | "receptionist"
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
      app_role: ["super_admin", "admin", "user", "parent", "receptionist"],
    },
  },
} as const
