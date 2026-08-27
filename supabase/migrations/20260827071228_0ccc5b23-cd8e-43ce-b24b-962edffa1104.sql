CREATE TABLE public.public_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  profile_url TEXT,
  external_id TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  status_reason TEXT,
  first_tracked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, platform, handle)
);

CREATE TABLE public.account_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.public_accounts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  followers BIGINT,
  following BIGINT,
  posts BIGINT,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX account_snapshots_account_idx ON public.account_snapshots (account_id, captured_at DESC);

CREATE TABLE public.public_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.public_accounts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);
CREATE INDEX public_content_account_idx ON public.public_content (account_id, published_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_accounts TO authenticated;
GRANT ALL ON public.public_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_snapshots TO authenticated;
GRANT ALL ON public.account_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_content TO authenticated;
GRANT ALL ON public.public_content TO service_role;

ALTER TABLE public.public_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_accounts_member_all" ON public.public_accounts FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "account_snapshots_member_all" ON public.account_snapshots FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "public_content_member_all" ON public.public_content FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

CREATE TRIGGER public_accounts_updated_at BEFORE UPDATE ON public.public_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();