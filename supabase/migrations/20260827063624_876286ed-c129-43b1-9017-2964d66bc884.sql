-- Direct official-platform authorization model

ALTER TABLE public.social_connections DROP CONSTRAINT IF EXISTS social_connections_social_profile_id_fkey;
ALTER TABLE public.social_connections ALTER COLUMN social_profile_id DROP NOT NULL;
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;

DROP TABLE IF EXISTS public.social_profiles CASCADE;

CREATE TABLE IF NOT EXISTS public.social_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  platform text NOT NULL,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text,
  expires_at timestamptz,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id)
);
GRANT ALL ON public.social_tokens TO service_role;
ALTER TABLE public.social_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  code_verifier text,
  redirect_to text NOT NULL,
  handle text,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.discovered_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  handle text NOT NULL,
  display_name text,
  avatar_url text,
  profile_url text,
  source text NOT NULL DEFAULT 'manual',
  confidence text NOT NULL DEFAULT 'possible',
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, platform)
);
GRANT SELECT ON public.discovered_accounts TO authenticated;
GRANT ALL ON public.discovered_accounts TO service_role;
ALTER TABLE public.discovered_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read discovered accounts" ON public.discovered_accounts
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.social_connections(id) ON DELETE CASCADE,
  platform text NOT NULL,
  status text NOT NULL,
  message text,
  items_synced integer NOT NULL DEFAULT 0,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sync_logs TO authenticated;
GRANT ALL ON public.sync_logs TO service_role;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read sync logs" ON public.sync_logs
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE INDEX IF NOT EXISTS sync_logs_org_idx ON public.sync_logs (org_id, created_at DESC);