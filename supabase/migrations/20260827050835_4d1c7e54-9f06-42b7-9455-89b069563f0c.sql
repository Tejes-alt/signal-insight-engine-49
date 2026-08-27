-- ============ roles & helpers ============
CREATE TYPE public.app_role AS ENUM ('owner','admin','analyst','viewer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_self_upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid NOT NULL,
  retention_days integer NOT NULL DEFAULT 90,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.org_id = _org_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.org_id = _org_id AND m.user_id = auth.uid() AND m.role = ANY(_roles));
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_select_members" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "org_insert_owner" ON public.organizations FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "org_update_admin" ON public.organizations FOR UPDATE TO authenticated USING (public.has_org_role(id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "org_delete_owner" ON public.organizations FOR DELETE TO authenticated USING (owner_id = auth.uid());

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membership_select" ON public.memberships FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "membership_insert" ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_org_role(org_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "membership_update" ON public.memberships FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "membership_delete" ON public.memberships FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.app_role[]));

-- ============ sources ============
CREATE TABLE public.provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  mode text NOT NULL DEFAULT 'public',
  external_id text NOT NULL,
  handle text,
  display_name text,
  avatar_url text,
  label text,
  status text NOT NULL DEFAULT 'connected',
  paused boolean NOT NULL DEFAULT false,
  followers bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_status text NOT NULL DEFAULT 'idle',
  sync_cursor text,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  records_collected integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  last_error text,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider, external_id)
);
CREATE INDEX idx_provider_accounts_org ON public.provider_accounts(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_accounts TO authenticated;
GRANT ALL ON public.provider_accounts TO service_role;
ALTER TABLE public.provider_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_select" ON public.provider_accounts FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "pa_insert" ON public.provider_accounts FOR INSERT TO authenticated WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin','analyst']::public.app_role[]));
CREATE POLICY "pa_update" ON public.provider_accounts FOR UPDATE TO authenticated USING (public.has_org_role(org_id, ARRAY['owner','admin','analyst']::public.app_role[]));
CREATE POLICY "pa_delete" ON public.provider_accounts FOR DELETE TO authenticated USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.app_role[]));

CREATE TABLE public.provider_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_account_id uuid NOT NULL REFERENCES public.provider_accounts(id) ON DELETE CASCADE,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text,
  scopes text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_account_id)
);
GRANT ALL ON public.provider_tokens TO service_role;
ALTER TABLE public.provider_tokens ENABLE ROW LEVEL SECURITY;

-- ============ normalized social data ============
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_account_id uuid REFERENCES public.provider_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_post_id text NOT NULL,
  author_id text,
  author_name text,
  author_handle text,
  title text,
  text text,
  language text,
  location text,
  published_at timestamptz NOT NULL,
  media_type text,
  permalink text,
  thumbnail_url text,
  hashtags text[] NOT NULL DEFAULT '{}',
  mentions text[] NOT NULL DEFAULT '{}',
  likes bigint,
  comments_count bigint,
  shares bigint,
  views bigint,
  replies bigint,
  metric_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw jsonb,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider, provider_post_id)
);
CREATE INDEX idx_posts_org_time ON public.posts(org_id, published_at DESC);
CREATE INDEX idx_posts_account ON public.posts(provider_account_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select" ON public.posts FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "posts_write" ON public.posts FOR ALL TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin','analyst']::public.app_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin','analyst']::public.app_role[]));

CREATE TABLE public.post_metric_snapshots (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  likes bigint, comments_count bigint, shares bigint, views bigint
);
CREATE INDEX idx_pms_post ON public.post_metric_snapshots(post_id, captured_at DESC);
GRANT SELECT ON public.post_metric_snapshots TO authenticated;
GRANT ALL ON public.post_metric_snapshots TO service_role;
ALTER TABLE public.post_metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pms_select" ON public.post_metric_snapshots FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_comment_id text NOT NULL,
  author_name text,
  author_handle text,
  text text,
  likes bigint,
  published_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider, provider_comment_id)
);
CREATE INDEX idx_comments_org_time ON public.post_comments(org_id, published_at DESC);
GRANT SELECT ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc_select" ON public.post_comments FOR SELECT TO authenticated USING (public.is_org_member(org_id));

-- ============ intelligence ============
CREATE TABLE public.sentiment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  label text NOT NULL,
  score double precision NOT NULL,
  confidence double precision NOT NULL DEFAULT 0.5,
  method text NOT NULL DEFAULT 'lexicon',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_id, method)
);
CREATE INDEX idx_sentiment_org ON public.sentiment_results(org_id);
GRANT SELECT ON public.sentiment_results TO authenticated;
GRANT ALL ON public.sentiment_results TO service_role;
ALTER TABLE public.sentiment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sent_select" ON public.sentiment_results FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, label)
);
GRANT SELECT ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics_select" ON public.topics FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.topic_assignments (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  weight double precision NOT NULL DEFAULT 1,
  UNIQUE (topic_id, post_id)
);
CREATE INDEX idx_ta_org ON public.topic_assignments(org_id);
GRANT SELECT ON public.topic_assignments TO authenticated;
GRANT ALL ON public.topic_assignments TO service_role;
ALTER TABLE public.topic_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta_select" ON public.topic_assignments FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.trend_snapshots (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  volume integer NOT NULL DEFAULT 0,
  baseline double precision,
  velocity double precision,
  acceleration double precision,
  momentum double precision,
  sentiment_avg double precision,
  engagement bigint,
  platform_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trend_org_time ON public.trend_snapshots(org_id, window_end DESC);
GRANT SELECT ON public.trend_snapshots TO authenticated;
GRANT ALL ON public.trend_snapshots TO service_role;
ALTER TABLE public.trend_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trend_select" ON public.trend_snapshots FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.anomaly_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  metric text NOT NULL,
  severity text NOT NULL,
  confidence double precision NOT NULL DEFAULT 0.5,
  baseline double precision,
  current_value double precision,
  deviation double precision,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  detected_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text NOT NULL,
  UNIQUE (org_id, fingerprint)
);
CREATE INDEX idx_anomaly_org_time ON public.anomaly_events(org_id, detected_at DESC);
GRANT SELECT, UPDATE ON public.anomaly_events TO authenticated;
GRANT ALL ON public.anomaly_events TO service_role;
ALTER TABLE public.anomaly_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anom_select" ON public.anomaly_events FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "anom_update" ON public.anomaly_events FOR UPDATE TO authenticated USING (public.has_org_role(org_id, ARRAY['owner','admin','analyst']::public.app_role[]));

-- ============ operations ============
CREATE TABLE public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_account_id uuid REFERENCES public.provider_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  records integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX idx_syncjobs_org ON public.sync_jobs(org_id, started_at DESC);
GRANT SELECT ON public.sync_jobs TO authenticated;
GRANT ALL ON public.sync_jobs TO service_role;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sj_select" ON public.sync_jobs FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  metric text NOT NULL,
  operator text NOT NULL,
  threshold double precision NOT NULL,
  window_hours integer NOT NULL DEFAULT 24,
  channels text[] NOT NULL DEFAULT ARRAY['in_app'],
  enabled boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_select" ON public.alerts FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "alerts_write" ON public.alerts FOR ALL TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin','analyst']::public.app_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin','analyst']::public.app_role[]));

CREATE TABLE public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  value double precision NOT NULL,
  message text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  triggered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_events_org ON public.alert_events(org_id, triggered_at DESC);
GRANT SELECT, UPDATE ON public.alert_events TO authenticated;
GRANT ALL ON public.alert_events TO service_role;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ae_select" ON public.alert_events FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "ae_update" ON public.alert_events FOR UPDATE TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'analyst_brief',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  content jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_reports_org ON public.reports(org_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select" ON public.reports FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "reports_write" ON public.reports FOR ALL TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin','analyst']::public.app_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin','analyst']::public.app_role[]));

CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  target text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org ON public.audit_logs(org_id, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.app_role[]));

-- ============ profile bootstrap ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();