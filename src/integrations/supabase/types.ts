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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          kind: string | null
          organization_id: string
          owner_id: string | null
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string | null
          organization_id: string
          owner_id?: string | null
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string | null
          organization_id?: string
          owner_id?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          amount: number
          client_id: string | null
          contract_id: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["charge_status"]
          task_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          segment: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          segment?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          segment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string | null
          created_at: string
          end_date: string | null
          id: string
          number: string
          organization_id: string
          payment_day: number | null
          payment_method: string | null
          proposal_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
          value: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          number: string
          organization_id: string
          payment_day?: number | null
          payment_method?: string | null
          proposal_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          value?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          number?: string
          organization_id?: string
          payment_day?: number | null
          payment_method?: string | null
          proposal_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          client_id: string | null
          company: string | null
          created_at: string
          email: string | null
          entered_stage_at: string
          estimated_value: number | null
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          phone: string | null
          segment: string | null
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          entered_stage_at?: string
          estimated_value?: number | null
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          phone?: string | null
          segment?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          entered_stage_at?: string
          estimated_value?: number | null
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          phone?: string | null
          segment?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_plans: {
        Row: {
          briefing: Json
          client_id: string | null
          contract_id: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          organization_id: string
          segment: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["plan_status"]
          updated_at: string
        }
        Insert: {
          briefing?: Json
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          segment?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
        }
        Update: {
          briefing?: Json
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          segment?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_plans_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string | null
          organization_id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          organization_id: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          organization_id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      platform_kpis: {
        Row: {
          created_at: string
          id: string
          metrics: Json
          organization_id: string
          period_month: number
          period_year: number
          platform: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json
          organization_id: string
          period_month: number
          period_year: number
          platform: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json
          organization_id?: string
          period_month?: number
          period_year?: number
          platform?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_kpis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_kpis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          onboarding_completed: boolean
          organization_id: string
          role_title: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          onboarding_completed?: boolean
          organization_id: string
          role_title?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          onboarding_completed?: boolean
          organization_id?: string
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          marketing_plan_id: string | null
          name: string
          organization_id: string
          owner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          marketing_plan_id?: string | null
          name: string
          organization_id: string
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          marketing_plan_id?: string | null
          name?: string
          organization_id?: string
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_marketing_plan_id_fkey"
            columns: ["marketing_plan_id"]
            isOneToOne: false
            referencedRelation: "marketing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          billing_model: Database["public"]["Enums"]["billing_model"]
          client_id: string | null
          created_at: string
          id: string
          items: Json
          lead_id: string | null
          number: string
          organization_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          total_value: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          billing_model?: Database["public"]["Enums"]["billing_model"]
          client_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          lead_id?: string | null
          number: string
          organization_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          total_value?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          billing_model?: Database["public"]["Enums"]["billing_model"]
          client_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          lead_id?: string | null
          number?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          total_value?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          attachments_count: number
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          billing_value: number | null
          comments_count: number
          created_at: string
          delivery_type: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          organization_id: string
          platform: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          progress: number
          project_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          attachments_count?: number
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          billing_value?: number | null
          comments_count?: number
          created_at?: string
          delivery_type?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          organization_id: string
          platform?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          attachments_count?: number
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          billing_value?: number | null
          comments_count?: number
          created_at?: string
          delivery_type?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          organization_id?: string
          platform?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          hourly_rate: number | null
          id: string
          level: Database["public"]["Enums"]["team_level"] | null
          name: string
          organization_id: string
          phone: string | null
          role: string | null
          specialty: string | null
          status: Database["public"]["Enums"]["team_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          level?: Database["public"]["Enums"]["team_level"] | null
          name: string
          organization_id: string
          phone?: string | null
          role?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          level?: Database["public"]["Enums"]["team_level"] | null
          name?: string
          organization_id?: string
          phone?: string | null
          role?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_organization_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "member"
      billing_model: "monthly" | "one_time" | "hourly" | "package"
      charge_status: "pending" | "paid" | "overdue" | "cancelled"
      contract_status: "active" | "closed" | "suspended" | "renewing"
      lead_stage: "lead" | "contact" | "proposal" | "negotiation" | "closed"
      plan_status: "draft" | "in_review" | "approved" | "archived"
      project_status: "planning" | "active" | "review" | "done" | "paused"
      proposal_status: "draft" | "sent" | "viewed" | "approved" | "declined"
      task_priority: "low" | "medium" | "high"
      task_status: "todo" | "in_progress" | "review" | "done"
      team_level: "junior" | "mid" | "senior" | "lead"
      team_status: "active" | "vacation" | "away" | "inactive"
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
      app_role: ["admin", "manager", "member"],
      billing_model: ["monthly", "one_time", "hourly", "package"],
      charge_status: ["pending", "paid", "overdue", "cancelled"],
      contract_status: ["active", "closed", "suspended", "renewing"],
      lead_stage: ["lead", "contact", "proposal", "negotiation", "closed"],
      plan_status: ["draft", "in_review", "approved", "archived"],
      project_status: ["planning", "active", "review", "done", "paused"],
      proposal_status: ["draft", "sent", "viewed", "approved", "declined"],
      task_priority: ["low", "medium", "high"],
      task_status: ["todo", "in_progress", "review", "done"],
      team_level: ["junior", "mid", "senior", "lead"],
      team_status: ["active", "vacation", "away", "inactive"],
    },
  },
} as const
