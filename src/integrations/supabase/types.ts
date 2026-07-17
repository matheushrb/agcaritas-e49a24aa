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
      approval_comments: {
        Row: {
          comment: string
          commenter_email: string | null
          commenter_name: string | null
          content_item_id: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          comment: string
          commenter_email?: string | null
          commenter_name?: string | null
          content_item_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          comment?: string
          commenter_email?: string | null
          commenter_name?: string | null
          content_item_id?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_comments_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          category: string | null
          client_id: string | null
          contract_id: string | null
          created_at: string
          deliverable_id: string | null
          description: string
          due_date: string
          id: string
          organization_id: string
          paid_at: string | null
          parent_charge_id: string | null
          payment_method: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["charge_status"]
          task_id: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          deliverable_id?: string | null
          description: string
          due_date: string
          id?: string
          organization_id: string
          paid_at?: string | null
          parent_charge_id?: string | null
          payment_method?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          task_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          deliverable_id?: string | null
          description?: string
          due_date?: string
          id?: string
          organization_id?: string
          paid_at?: string | null
          parent_charge_id?: string | null
          payment_method?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          task_id?: string | null
          type?: string | null
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
            foreignKeyName: "charges_parent_charge_id_fkey"
            columns: ["parent_charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
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
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          role: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          segment: string | null
          status: string | null
          tax_id: string | null
          type: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          segment?: string | null
          status?: string | null
          tax_id?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          segment?: string | null
          status?: string | null
          tax_id?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
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
      content_items: {
        Row: {
          approval_token: string | null
          approved_at: string | null
          approved_by_email: string | null
          approved_by_name: string | null
          assignee_id: string | null
          content_type: string | null
          copy_text: string | null
          created_at: string
          grid_order: number | null
          id: string
          is_internal: boolean
          notes: string | null
          organization_id: string
          platform: string | null
          project_id: string | null
          publish_date: string | null
          publish_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_token?: string | null
          approved_at?: string | null
          approved_by_email?: string | null
          approved_by_name?: string | null
          assignee_id?: string | null
          content_type?: string | null
          copy_text?: string | null
          created_at?: string
          grid_order?: number | null
          id?: string
          is_internal?: boolean
          notes?: string | null
          organization_id: string
          platform?: string | null
          project_id?: string | null
          publish_date?: string | null
          publish_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_token?: string | null
          approved_at?: string | null
          approved_by_email?: string | null
          approved_by_name?: string | null
          assignee_id?: string | null
          content_type?: string | null
          copy_text?: string | null
          created_at?: string
          grid_order?: number | null
          id?: string
          is_internal?: boolean
          notes?: string | null
          organization_id?: string
          platform?: string | null
          project_id?: string | null
          publish_date?: string | null
          publish_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          billing_day: number | null
          client_id: string | null
          created_at: string
          end_date: string | null
          id: string
          monthly_value: number | null
          name: string | null
          notes: string | null
          number: string
          object: string | null
          organization_id: string
          payment_day: number | null
          payment_method: string | null
          project_id: string | null
          proposal_id: string | null
          services: Json | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          total_value: number | null
          updated_at: string
          value: number
        }
        Insert: {
          billing_day?: number | null
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_value?: number | null
          name?: string | null
          notes?: string | null
          number: string
          object?: string | null
          organization_id: string
          payment_day?: number | null
          payment_method?: string | null
          project_id?: string | null
          proposal_id?: string | null
          services?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          total_value?: number | null
          updated_at?: string
          value?: number
        }
        Update: {
          billing_day?: number | null
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_value?: number | null
          name?: string | null
          notes?: string | null
          number?: string
          object?: string | null
          organization_id?: string
          payment_day?: number | null
          payment_method?: string | null
          project_id?: string | null
          proposal_id?: string | null
          services?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          total_value?: number | null
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
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      dashboard_preferences: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: []
      }
      goals: {
        Row: {
          auto_calculate: boolean
          category: string
          created_at: string
          current_value: number
          end_date: string | null
          id: string
          organization_id: string
          period: string | null
          start_date: string | null
          target_value: number
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          auto_calculate?: boolean
          category: string
          created_at?: string
          current_value?: number
          end_date?: string | null
          id?: string
          organization_id: string
          period?: string | null
          start_date?: string | null
          target_value?: number
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          auto_calculate?: boolean
          category?: string
          created_at?: string
          current_value?: number
          end_date?: string | null
          id?: string
          organization_id?: string
          period?: string | null
          start_date?: string | null
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_bank: {
        Row: {
          created_at: string
          description: string | null
          id: string
          organization_id: string
          platform: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          platform?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          platform?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_bank_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_campaigns: {
        Row: {
          budget: number | null
          channel: string | null
          created_at: string
          end_date: string | null
          expected_result: string | null
          id: string
          name: string
          notes: string | null
          objective: string | null
          organization_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          channel?: string | null
          created_at?: string
          end_date?: string | null
          expected_result?: string | null
          id?: string
          name: string
          notes?: string | null
          objective?: string | null
          organization_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          channel?: string | null
          created_at?: string
          end_date?: string | null
          expected_result?: string | null
          id?: string
          name?: string
          notes?: string | null
          objective?: string | null
          organization_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          number: string
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          project_id: string | null
          proposal_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          number: string
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          project_id?: string | null
          proposal_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          number?: string
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          project_id?: string | null
          proposal_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_proposal_id_fkey"
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
          automation_settings: Json
          created_at: string
          id: string
          name: string
        }
        Insert: {
          automation_settings?: Json
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          automation_settings?: Json
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
          display_name: string | null
          full_name: string
          id: string
          onboarding_completed: boolean
          organization_id: string
          role_title: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name: string
          id: string
          onboarding_completed?: boolean
          organization_id: string
          role_title?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
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
      project_action_items: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          order_index: number
          organization_id: string
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          organization_id: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          organization_id?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_action_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_benchmarks: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          project_id: string
          strengths: string | null
          updated_at: string
          url: string | null
          weaknesses: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          project_id: string
          strengths?: string | null
          updated_at?: string
          url?: string | null
          weaknesses?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          project_id?: string
          strengths?: string | null
          updated_at?: string
          url?: string | null
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_benchmarks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_personas: {
        Row: {
          age: number | null
          channels: Json | null
          created_at: string
          desires: Json | null
          id: string
          name: string
          organization_id: string
          pains: Json | null
          project_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          channels?: Json | null
          created_at?: string
          desires?: Json | null
          id?: string
          name: string
          organization_id: string
          pains?: Json | null
          project_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          channels?: Json | null
          created_at?: string
          desires?: Json | null
          id?: string
          name?: string
          organization_id?: string
          pains?: Json | null
          project_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_personas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_personas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_swot: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          position: number
          project_id: string
          quadrant: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id: string
          position?: number
          project_id: string
          quadrant: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          position?: number
          project_id?: string
          quadrant?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_swot_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_swot_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          billing_model: string | null
          client_id: string | null
          contract_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          fixed_value: number | null
          id: string
          marketing_plan_id: string | null
          name: string
          notes: string | null
          organization_id: string
          other_budgets: Json | null
          owner_id: string | null
          project_type: string | null
          scope_flags: Json | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          traffic_budget: Json | null
          updated_at: string
          urgency: string | null
        }
        Insert: {
          billing_model?: string | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          fixed_value?: number | null
          id?: string
          marketing_plan_id?: string | null
          name: string
          notes?: string | null
          organization_id: string
          other_budgets?: Json | null
          owner_id?: string | null
          project_type?: string | null
          scope_flags?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          traffic_budget?: Json | null
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          billing_model?: string | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          fixed_value?: number | null
          id?: string
          marketing_plan_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          other_budgets?: Json | null
          owner_id?: string | null
          project_type?: string | null
          scope_flags?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          traffic_budget?: Json | null
          updated_at?: string
          urgency?: string | null
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
            foreignKeyName: "projects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
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
      suppliers: {
        Row: {
          category: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          status: string
          tax_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_type_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          order: number
          organization_id: string
          status_group: Database["public"]["Enums"]["stage_status_group"]
          task_type_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          order?: number
          organization_id: string
          status_group?: Database["public"]["Enums"]["stage_status_group"]
          task_type_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          order?: number
          organization_id?: string
          status_group?: Database["public"]["Enums"]["stage_status_group"]
          task_type_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_type_stages_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
      task_types: {
        Row: {
          active: boolean
          color: string
          created_at: string
          default_billing_model: string | null
          default_price: number | null
          description: string | null
          icon: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          default_billing_model?: string | null
          default_price?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          default_billing_model?: string | null
          default_price?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          attachments_count: number
          billing_enabled: boolean
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          billing_value: number | null
          client_id: string | null
          comments_count: number
          created_at: string
          current_stage_id: string | null
          deliverables: Json
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
          stage: Database["public"]["Enums"]["task_stage"]
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          subtasks: Json
          task_type_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          attachments_count?: number
          billing_enabled?: boolean
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          billing_value?: number | null
          client_id?: string | null
          comments_count?: number
          created_at?: string
          current_stage_id?: string | null
          deliverables?: Json
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
          stage?: Database["public"]["Enums"]["task_stage"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          subtasks?: Json
          task_type_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          attachments_count?: number
          billing_enabled?: boolean
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          billing_value?: number | null
          client_id?: string | null
          comments_count?: number
          created_at?: string
          current_stage_id?: string | null
          deliverables?: Json
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
          stage?: Database["public"]["Enums"]["task_stage"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          subtasks?: Json
          task_type_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "task_type_stages"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "tasks_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "task_types"
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
      time_entries: {
        Row: {
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          organization_id: string
          started_at: string | null
          task_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          organization_id: string
          started_at?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          organization_id?: string
          started_at?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      billing_model: "monthly" | "one_time" | "hourly" | "package" | "per_task"
      charge_status: "pending" | "paid" | "overdue" | "cancelled"
      contract_status: "active" | "closed" | "suspended" | "renewing"
      lead_stage: "lead" | "contact" | "proposal" | "negotiation" | "closed"
      plan_status: "draft" | "in_review" | "approved" | "archived"
      project_status: "planning" | "active" | "review" | "done" | "paused"
      proposal_status: "draft" | "sent" | "viewed" | "approved" | "declined"
      stage_status_group: "todo" | "in_progress" | "review" | "done"
      task_priority: "low" | "medium" | "high"
      task_stage: "briefing" | "creation" | "review" | "approval" | "delivery"
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
      billing_model: ["monthly", "one_time", "hourly", "package", "per_task"],
      charge_status: ["pending", "paid", "overdue", "cancelled"],
      contract_status: ["active", "closed", "suspended", "renewing"],
      lead_stage: ["lead", "contact", "proposal", "negotiation", "closed"],
      plan_status: ["draft", "in_review", "approved", "archived"],
      project_status: ["planning", "active", "review", "done", "paused"],
      proposal_status: ["draft", "sent", "viewed", "approved", "declined"],
      stage_status_group: ["todo", "in_progress", "review", "done"],
      task_priority: ["low", "medium", "high"],
      task_stage: ["briefing", "creation", "review", "approval", "delivery"],
      task_status: ["todo", "in_progress", "review", "done"],
      team_level: ["junior", "mid", "senior", "lead"],
      team_status: ["active", "vacation", "away", "inactive"],
    },
  },
} as const
