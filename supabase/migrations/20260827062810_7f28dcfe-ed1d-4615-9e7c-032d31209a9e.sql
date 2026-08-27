ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS next_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_interval_minutes integer NOT NULL DEFAULT 180;

CREATE INDEX IF NOT EXISTS social_connections_next_sync_idx
  ON public.social_connections (next_sync_at)
  WHERE status <> 'pending';