ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS final_client text,
  ADD COLUMN IF NOT EXISTS doc_id text,
  ADD COLUMN IF NOT EXISTS compliance_notes jsonb NOT NULL DEFAULT '[]'::jsonb;