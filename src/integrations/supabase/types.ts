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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          acknowledged: boolean
          alert_id: string
          evidence: Json
          id: string
          message: string
          org_id: string
          triggered_at: string
          value: number
        }
        Insert: {
          acknowledged?: boolean
          alert_id: string
          evidence?: Json
          id?: string
          message: string
          org_id: string
          triggered_at?: string
          value: number
        }
        Update: {
          acknowledged?: boolean
          alert_id?: string
          evidence?: Json
          id?: string
          message?: string
          org_id?: string
          triggered_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          channels: string[]
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          last_triggered_at: string | null
          metric: string
          name: string
          operator: string
          org_id: string
          threshold: number
          window_hours: number
        }
        Insert: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          metric: string
          name: string
          operator: string
          org_id: string
          threshold: number
          window_hours?: number
        }
        Update: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          metric?: string
          name?: string
          operator?: string
          org_id?: string
          threshold?: number
          window_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      anomaly_events: {
        Row: {
          baseline: number | null
          confidence: number
          current_value: number | null
          detected_at: string
          deviation: number | null
          evidence: Json
          fingerprint: string
          id: string
          kind: string
          metric: string
          org_id: string
          scope: Json
          severity: string
          status: string
        }
        Insert: {
          baseline?: number | null
          confidence?: number
          current_value?: number | null
          detected_at?: string
          deviation?: number | null
          evidence?: Json
          fingerprint: string
          id?: string
          kind: string
          metric: string
          org_id: string
          scope?: Json
          severity: string
          status?: string
        }
        Update: {
          baseline?: number | null
          confidence?: number
          current_value?: number | null
          detected_at?: string
          deviation?: number | null
          evidence?: Json
          fingerprint?: string
          id?: string
          kind?: string
          metric?: string
          org_id?: string
          scope?: Json
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          org_id: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: number
          org_id?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: number
          org_id?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          body: string
          category: string
          created_at: string
          evidence: Json
          generated_at: string
          id: string
          metric_label: string | null
          metric_value: string | null
          org_id: string
          recommendation: string | null
          title: string
          tone: string
          window_days: number
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          evidence?: Json
          generated_at?: string
          id?: string
          metric_label?: string | null
          metric_value?: string | null
          org_id: string
          recommendation?: string | null
          title: string
          tone?: string
          window_days?: number
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          evidence?: Json
          generated_at?: string
          id?: string
          metric_label?: string | null
          metric_value?: string | null
          org_id?: string
          recommendation?: string | null
          title?: string
          tone?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_history: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          metric_date: string
          metrics: Json
          org_id: string
          platform: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          metric_date: string
          metrics?: Json
          org_id: string
          platform: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          metric_date?: string
          metrics?: Json
          org_id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_history_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_history_org_id_fkey"
            columns: ["org_id"]
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
          data: Json
          id: string
          kind: string
          org_id: string
          read_at: string | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind: string
          org_id: string
          read_at?: string | null
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          org_id?: string
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
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
          is_demo: boolean
          name: string
          owner_id: string
          retention_days: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          owner_id: string
          retention_days?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          owner_id?: string
          retention_days?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_handle: string | null
          author_name: string | null
          id: string
          ingested_at: string
          likes: number | null
          org_id: string
          post_id: string
          provider: string
          provider_comment_id: string
          published_at: string
          text: string | null
        }
        Insert: {
          author_handle?: string | null
          author_name?: string | null
          id?: string
          ingested_at?: string
          likes?: number | null
          org_id: string
          post_id: string
          provider: string
          provider_comment_id: string
          published_at: string
          text?: string | null
        }
        Update: {
          author_handle?: string | null
          author_name?: string | null
          id?: string
          ingested_at?: string
          likes?: number | null
          org_id?: string
          post_id?: string
          provider?: string
          provider_comment_id?: string
          published_at?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metric_snapshots: {
        Row: {
          captured_at: string
          comments_count: number | null
          id: number
          likes: number | null
          org_id: string
          post_id: string
          shares: number | null
          views: number | null
        }
        Insert: {
          captured_at?: string
          comments_count?: number | null
          id?: number
          likes?: number | null
          org_id: string
          post_id: string
          shares?: number | null
          views?: number | null
        }
        Update: {
          captured_at?: string
          comments_count?: number | null
          id?: number
          likes?: number | null
          org_id?: string
          post_id?: string
          shares?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_metric_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_metric_snapshots_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          metrics: Json
          org_id: string
          post_id: string
        }
        Insert: {
          captured_at?: string
          created_at?: string
          id?: string
          metrics?: Json
          org_id: string
          post_id: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          metrics?: Json
          org_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_handle: string | null
          author_id: string | null
          author_name: string | null
          comments_count: number | null
          hashtags: string[]
          id: string
          ingested_at: string
          language: string | null
          likes: number | null
          location: string | null
          media_type: string | null
          mentions: string[]
          metric_provenance: Json
          org_id: string
          permalink: string | null
          provider: string
          provider_account_id: string | null
          provider_post_id: string
          published_at: string
          raw: Json | null
          replies: number | null
          shares: number | null
          text: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          views: number | null
        }
        Insert: {
          author_handle?: string | null
          author_id?: string | null
          author_name?: string | null
          comments_count?: number | null
          hashtags?: string[]
          id?: string
          ingested_at?: string
          language?: string | null
          likes?: number | null
          location?: string | null
          media_type?: string | null
          mentions?: string[]
          metric_provenance?: Json
          org_id: string
          permalink?: string | null
          provider: string
          provider_account_id?: string | null
          provider_post_id: string
          published_at: string
          raw?: Json | null
          replies?: number | null
          shares?: number | null
          text?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          views?: number | null
        }
        Update: {
          author_handle?: string | null
          author_id?: string | null
          author_name?: string | null
          comments_count?: number | null
          hashtags?: string[]
          id?: string
          ingested_at?: string
          language?: string | null
          likes?: number | null
          location?: string | null
          media_type?: string | null
          mentions?: string[]
          metric_provenance?: Json
          org_id?: string
          permalink?: string | null
          provider?: string
          provider_account_id?: string | null
          provider_post_id?: string
          published_at?: string
          raw?: Json | null
          replies?: number | null
          shares?: number | null
          text?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: false
            referencedRelation: "provider_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_accounts: {
        Row: {
          avatar_url: string | null
          connected_by: string | null
          created_at: string
          display_name: string | null
          error_count: number
          external_id: string
          followers: number | null
          handle: string | null
          id: string
          label: string | null
          last_error: string | null
          last_synced_at: string | null
          metadata: Json
          mode: string
          next_sync_at: string | null
          org_id: string
          paused: boolean
          provider: string
          records_collected: number
          status: string
          sync_cursor: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          error_count?: number
          external_id: string
          followers?: number | null
          handle?: string | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          mode?: string
          next_sync_at?: string | null
          org_id: string
          paused?: boolean
          provider: string
          records_collected?: number
          status?: string
          sync_cursor?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          error_count?: number
          external_id?: string
          followers?: number | null
          handle?: string | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          mode?: string
          next_sync_at?: string | null
          org_id?: string
          paused?: boolean
          provider?: string
          records_collected?: number
          status?: string
          sync_cursor?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_tokens: {
        Row: {
          access_token_ciphertext: string
          created_at: string
          expires_at: string | null
          id: string
          provider_account_id: string
          refresh_token_ciphertext: string | null
          scopes: string[]
          updated_at: string
        }
        Insert: {
          access_token_ciphertext: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider_account_id: string
          refresh_token_ciphertext?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider_account_id?: string
          refresh_token_ciphertext?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_tokens_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: true
            referencedRelation: "provider_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          completed_at: string | null
          content: Json | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          org_id: string
          params: Json
          status: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          content?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          org_id: string
          params?: Json
          status?: string
          title: string
        }
        Update: {
          completed_at?: string | null
          content?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          org_id?: string
          params?: Json
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sentiment_results: {
        Row: {
          confidence: number
          created_at: string
          id: string
          label: string
          method: string
          org_id: string
          score: number
          subject_id: string
          subject_type: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          label: string
          method?: string
          org_id: string
          score: number
          subject_id: string
          subject_type: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          label?: string
          method?: string
          org_id?: string
          score?: number
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          external_id: string | null
          handle: string | null
          id: string
          last_synced_at: string | null
          metadata: Json
          next_sync_at: string | null
          org_id: string
          permissions: Json
          platform: string
          social_profile_id: string
          status: string
          sync_attempts: number
          sync_completed_at: string | null
          sync_error: string | null
          sync_interval_minutes: number
          sync_started_at: string | null
          sync_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          external_id?: string | null
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          next_sync_at?: string | null
          org_id: string
          permissions?: Json
          platform: string
          social_profile_id: string
          status?: string
          sync_attempts?: number
          sync_completed_at?: string | null
          sync_error?: string | null
          sync_interval_minutes?: number
          sync_started_at?: string | null
          sync_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          external_id?: string | null
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          next_sync_at?: string | null
          org_id?: string
          permissions?: Json
          platform?: string
          social_profile_id?: string
          status?: string
          sync_attempts?: number
          sync_completed_at?: string | null
          sync_error?: string | null
          sync_interval_minutes?: number
          sync_started_at?: string | null
          sync_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_social_profile_id_fkey"
            columns: ["social_profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_metrics: {
        Row: {
          captured_at: string
          connection_id: string
          created_at: string
          id: string
          metrics: Json
          org_id: string
          platform: string
          updated_at: string
        }
        Insert: {
          captured_at?: string
          connection_id: string
          created_at?: string
          id?: string
          metrics?: Json
          org_id: string
          platform: string
          updated_at?: string
        }
        Update: {
          captured_at?: string
          connection_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          org_id?: string
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_metrics_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          caption: string | null
          connection_id: string
          created_at: string
          external_post_id: string
          id: string
          media_type: string | null
          org_id: string
          permalink: string | null
          platform: string
          published_at: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          connection_id: string
          created_at?: string
          external_post_id: string
          id?: string
          media_type?: string | null
          org_id: string
          permalink?: string | null
          platform: string
          published_at: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          connection_id?: string
          created_at?: string
          external_post_id?: string
          id?: string
          media_type?: string | null
          org_id?: string
          permalink?: string | null
          platform?: string
          published_at?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          created_at: string
          id: string
          org_id: string
          profile_key_ciphertext: string | null
          profile_ref: string | null
          provider: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          profile_key_ciphertext?: string | null
          profile_ref?: string | null
          provider?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          profile_key_ciphertext?: string | null
          profile_ref?: string | null
          provider?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          org_id: string
          provider_account_id: string | null
          records: number
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          org_id: string
          provider_account_id?: string | null
          records?: number
          started_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          org_id?: string
          provider_account_id?: string | null
          records?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: false
            referencedRelation: "provider_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_assignments: {
        Row: {
          id: number
          org_id: string
          post_id: string
          topic_id: string
          weight: number
        }
        Insert: {
          id?: number
          org_id: string
          post_id: string
          topic_id: string
          weight?: number
        }
        Update: {
          id?: number
          org_id?: string
          post_id?: string
          topic_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "topic_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_assignments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_assignments_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          first_seen_at: string
          id: string
          keywords: string[]
          label: string
          last_seen_at: string
          org_id: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          keywords?: string[]
          label: string
          last_seen_at?: string
          org_id: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          keywords?: string[]
          label?: string
          last_seen_at?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_snapshots: {
        Row: {
          acceleration: number | null
          baseline: number | null
          computed_at: string
          engagement: number | null
          id: number
          momentum: number | null
          org_id: string
          platform_breakdown: Json
          sentiment_avg: number | null
          topic_id: string | null
          velocity: number | null
          volume: number
          window_end: string
          window_start: string
        }
        Insert: {
          acceleration?: number | null
          baseline?: number | null
          computed_at?: string
          engagement?: number | null
          id?: number
          momentum?: number | null
          org_id: string
          platform_breakdown?: Json
          sentiment_avg?: number | null
          topic_id?: string | null
          velocity?: number | null
          volume?: number
          window_end: string
          window_start: string
        }
        Update: {
          acceleration?: number | null
          baseline?: number | null
          computed_at?: string
          engagement?: number | null
          id?: number
          momentum?: number | null
          org_id?: string
          platform_breakdown?: Json
          sentiment_avg?: number | null
          topic_id?: string | null
          velocity?: number | null
          volume?: number
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_snapshots_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_range_days: number
          goal: string | null
          notification_settings: Json
          onboarding_completed: boolean
          org_id: string | null
          preferred_metrics: Json
          primary_platform: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_range_days?: number
          goal?: string | null
          notification_settings?: Json
          onboarding_completed?: boolean
          org_id?: string | null
          preferred_metrics?: Json
          primary_platform?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_range_days?: number
          goal?: string | null
          notification_settings?: Json
          onboarding_completed?: boolean
          org_id?: string | null
          preferred_metrics?: Json
          primary_platform?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_org_id_fkey"
            columns: ["org_id"]
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
      ensure_personal_workspace: {
        Args: { _name: string; _slug: string }
        Returns: {
          id: string
          is_demo: boolean
          name: string
          retention_days: number
          role: Database["public"]["Enums"]["app_role"]
          slug: string
        }[]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "analyst" | "viewer"
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
      app_role: ["owner", "admin", "analyst", "viewer"],
    },
  },
} as const
