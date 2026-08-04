ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS live_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tech_sheet jsonb NOT NULL DEFAULT '{}'::jsonb;