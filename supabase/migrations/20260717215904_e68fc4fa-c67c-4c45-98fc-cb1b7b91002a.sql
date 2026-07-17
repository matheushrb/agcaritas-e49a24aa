ALTER TABLE public.project_types
  ADD COLUMN IF NOT EXISTS base_tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS avg_task_hours numeric,
  ADD COLUMN IF NOT EXISTS avg_duration_days integer;