-- SocialPulse: provider-backed social integration model

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'ayrshare',
  profile_key_ciphertext text,
  profile_ref text,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);
GRANT SELECT ON public.social_profiles TO authenticated;
GRANT ALL ON public.social_profiles TO service_role;
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read social profiles" ON public.social_profiles
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  social_profile_id uuid NOT NULL REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  handle text,
  display_name text,
  avatar_url text,
  external_id text,
  status text NOT NULL DEFAULT 'pending',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_status text NOT NULL DEFAULT 'idle',
  sync_started_at timestamptz,
  sync_completed_at timestamptz,
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, platform)
);
GRANT SELECT ON public.social_connections TO authenticated;
GRANT ALL ON public.social_connections TO service_role;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read connections" ON public.social_connections
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE INDEX social_connections_org_idx ON public.social_connections (org_id, platform);
CREATE INDEX social_connections_profile_idx ON public.social_connections (social_profile_id);
CREATE INDEX social_connections_sync_idx ON public.social_connections (sync_status, last_synced_at);

CREATE TABLE public.social_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  platform text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id)
);
GRANT SELECT ON public.social_metrics TO authenticated;
GRANT ALL ON public.social_metrics TO service_role;
ALTER TABLE public.social_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read metrics" ON public.social_metrics
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE INDEX social_metrics_org_idx ON public.social_metrics (org_id, platform);

CREATE TABLE public.metric_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  platform text NOT NULL,
  metric_date date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, metric_date)
);
GRANT SELECT ON public.metric_history TO authenticated;
GRANT ALL ON public.metric_history TO service_role;
ALTER TABLE public.metric_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read metric history" ON public.metric_history
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE INDEX metric_history_org_date_idx ON public.metric_history (org_id, metric_date);

CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_post_id text NOT NULL,
  title text,
  caption text,
  media_type text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_post_id)
);
GRANT SELECT ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read posts" ON public.social_posts
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE INDEX social_posts_org_published_idx ON public.social_posts (org_id, published_at DESC);
CREATE INDEX social_posts_platform_idx ON public.social_posts (org_id, platform);

CREATE TABLE public.post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id)
);
GRANT SELECT ON public.post_metrics TO authenticated;
GRANT ALL ON public.post_metrics TO service_role;
ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read post metrics" ON public.post_metrics
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE INDEX post_metrics_org_idx ON public.post_metrics (org_id);

CREATE TABLE public.insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  tone text NOT NULL DEFAULT 'neutral',
  metric_label text,
  metric_value text,
  recommendation text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  window_days integer NOT NULL DEFAULT 30,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.insights TO authenticated;
GRANT ALL ON public.insights TO service_role;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read insights" ON public.insights
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE INDEX insights_org_generated_idx ON public.insights (org_id, generated_at DESC);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info',
  read_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "members update notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE INDEX notifications_org_created_idx ON public.notifications (org_id, created_at DESC);

CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  primary_platform text,
  preferred_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_range_days integer NOT NULL DEFAULT 30,
  theme text NOT NULL DEFAULT 'system',
  notification_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarding_completed boolean NOT NULL DEFAULT false,
  goal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferences" ON public.user_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_social_profiles_updated_at BEFORE UPDATE ON public.social_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_social_connections_updated_at BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_social_metrics_updated_at BEFORE UPDATE ON public.social_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_social_posts_updated_at BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();