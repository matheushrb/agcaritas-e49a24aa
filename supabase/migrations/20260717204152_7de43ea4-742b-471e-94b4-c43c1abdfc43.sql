ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS automation_settings jsonb NOT NULL DEFAULT '{}'::jsonb;