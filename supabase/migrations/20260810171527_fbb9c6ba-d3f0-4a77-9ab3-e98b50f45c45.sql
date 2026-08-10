ALTER TABLE public.task_type_stages
  ADD COLUMN IF NOT EXISTS auto_deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_live jsonb NOT NULL DEFAULT '[]'::jsonb;